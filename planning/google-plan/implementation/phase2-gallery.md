# Phase 2: Gallery Sync Implementation Guide

## Overview
Implement incremental gallery synchronization from public Google Drive folder to S3 with image processing.

## Implementation Steps

### Step 1: Install Additional Dependencies

```bash
cd api
npm install sharp p-limit
```

### Step 2: Create Google Drive Client

**File: `api/services/google/drive-client.js`**
```javascript
const axios = require('axios');

class GoogleDriveClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.googleapis.com/drive/v3';
  }

  async listFolders(parentId) {
    try {
      const params = {
        q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name,createdTime,modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 1000,
      };

      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(`${this.baseUrl}/files`, { params });
      return response.data.files || [];
    } catch (error) {
      console.error('Error listing folders:', error.response?.data || error.message);
      throw error;
    }
  }

  async listImages(folderId) {
    try {
      const params = {
        q: `'${folderId}' in parents and (mimeType contains 'image/') and trashed=false`,
        fields: 'files(id,name,createdTime,modifiedTime,size,imageMediaMetadata)',
        orderBy: 'createdTime',
        pageSize: 1000,
      };

      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(`${this.baseUrl}/files`, { params });
      return response.data.files || [];
    } catch (error) {
      console.error('Error listing images:', error.response?.data || error.message);
      throw error;
    }
  }

  async downloadImage(fileId) {
    try {
      const params = {
        alt: 'media',
      };

      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(
        `${this.baseUrl}/files/${fileId}`,
        {
          params,
          responseType: 'arraybuffer',
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading image:', error.response?.data || error.message);
      throw error;
    }
  }

  getThumbnailUrl(fileId, width = 300) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
  }
}

module.exports = GoogleDriveClient;
```

### Step 3: Create Image Processor

**File: `api/services/sync/image-processor.js`**
```javascript
const sharp = require('sharp');

class ImageProcessor {
  constructor(sizes = { small: 300, medium: 600, large: 1200 }) {
    this.sizes = sizes;
  }

  async processImage(buffer, fileId) {
    const results = {};

    // Process each size
    for (const [sizeName, width] of Object.entries(this.sizes)) {
      try {
        const processed = await sharp(buffer)
          .resize(width, null, {
            withoutEnlargement: true,
            fit: 'inside',
          })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();

        results[sizeName] = {
          buffer: processed,
          key: `images/${fileId}-${width}.jpg`,
        };
      } catch (error) {
        console.error(`Error processing ${sizeName} for ${fileId}:`, error);
        throw error;
      }
    }

    // Also save original (compressed)
    try {
      const original = await sharp(buffer)
        .jpeg({ quality: 90, progressive: true })
        .toBuffer();

      results.original = {
        buffer: original,
        key: `images/${fileId}-original.jpg`,
      };
    } catch (error) {
      console.error(`Error processing original for ${fileId}:`, error);
      throw error;
    }

    return results;
  }

  async getImageMetadata(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
      };
    } catch (error) {
      console.error('Error getting image metadata:', error);
      return null;
    }
  }
}

module.exports = ImageProcessor;
```

### Step 4: Create Gallery Sync Service

**File: `api/services/sync/gallery-sync.js`**
```javascript
const GoogleDriveClient = require('../google/drive-client');
const S3Client = require('./s3-client');
const ImageProcessor = require('./image-processor');
const database = require('../database');
const pLimit = require('p-limit');

class GallerySync {
  constructor(config) {
    this.driveClient = new GoogleDriveClient(config.googleApiKey);
    this.s3Client = new S3Client({
      endpoint: config.s3Endpoint,
      bucket: config.s3Bucket,
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      region: config.s3Region,
    });
    this.imageProcessor = new ImageProcessor(config.imageSizes);
    this.rootFolderId = config.driveFolderId;
    this.batchSize = config.batchSize || 10;
    this.maxRuntime = (config.maxRuntime || 300) * 1000; // Convert to ms
    this.parallelLimit = pLimit(3); // Process 3 images in parallel
  }

  async sync() {
    const startTime = Date.now();
    console.log('=== Starting Gallery Sync ===');

    const state = await this.loadSyncState();
    let processedCount = 0;
    let skippedCount = 0;
    let uploadedCount = 0;

    try {
      // Get all albums
      const albums = await this.driveClient.listFolders(this.rootFolderId);
      console.log(`Found ${albums.length} albums in Drive`);

      // Resume from saved position
      let albumIndex = state.albumIndex || 0;
      let photoIndex = state.photoIndex || 0;

      while (albumIndex < albums.length) {
        const album = albums[albumIndex];
        console.log(`Processing album: ${album.name} (${albumIndex + 1}/${albums.length})`);

        // Load existing album data from S3
        const s3AlbumData = await this.loadS3Album(album.id);
        const existingPhotos = new Set(
          s3AlbumData?.photos?.filter(p => p.s3Processed).map(p => p.id) || []
        );

        // Get photos from Drive
        const photos = await this.driveClient.listImages(album.id);
        console.log(`Found ${photos.length} photos in album`);

        // Process photos
        while (photoIndex < photos.length && processedCount < this.batchSize) {
          // Check runtime limit
          if (Date.now() - startTime > this.maxRuntime) {
            console.log('⏸ Approaching runtime limit, saving state...');
            await this.saveSyncState({ albumIndex, photoIndex });
            return {
              status: 'partial',
              processed: processedCount,
              uploaded: uploadedCount,
              skipped: skippedCount,
            };
          }

          const photo = photos[photoIndex];

          if (existingPhotos.has(photo.id)) {
            skippedCount++;
            photoIndex++;
            continue;
          }

          // Process new photo
          try {
            await this.processPhoto(photo, album);
            uploadedCount++;
            processedCount++;
          } catch (error) {
            console.error(`Failed to process ${photo.name}:`, error.message);
          }

          photoIndex++;
        }

        // Album complete - update metadata
        if (photoIndex >= photos.length) {
          await this.updateAlbumMetadata(album, photos);
          albumIndex++;
          photoIndex = 0;
          console.log(`✓ Completed album: ${album.name}`);
        }

        // Check if batch limit reached
        if (processedCount >= this.batchSize) {
          console.log('📊 Batch limit reached, saving state...');
          await this.saveSyncState({ albumIndex, photoIndex });
          return {
            status: 'partial',
            processed: processedCount,
            uploaded: uploadedCount,
            skipped: skippedCount,
          };
        }
      }

      // All albums complete
      console.log('✅ Gallery sync complete!');
      await this.updateGalleryManifest(albums);
      await this.clearSyncState();
      await this.updateVersionFile('gallery');

      return {
        status: 'complete',
        processed: processedCount,
        uploaded: uploadedCount,
        skipped: skippedCount,
      };

    } catch (error) {
      console.error('✗ Gallery sync failed:', error);
      await this.saveSyncState({ albumIndex: state.albumIndex, photoIndex: state.photoIndex });
      throw error;
    }
  }

  async processPhoto(photo, album) {
    console.log(`📤 Processing: ${photo.name}`);

    // Download image from Drive
    const imageBuffer = await this.driveClient.downloadImage(photo.id);

    // Process image to multiple sizes
    const processedImages = await this.imageProcessor.processImage(imageBuffer, photo.id);

    // Upload all sizes to S3 in parallel
    const uploadPromises = Object.entries(processedImages).map(([size, data]) =>
      this.parallelLimit(() =>
        this.s3Client.s3.putObject({
          Bucket: this.s3Client.bucket,
          Key: data.key,
          Body: data.buffer,
          ContentType: 'image/jpeg',
          ACL: 'public-read',
        }).promise()
      )
    );

    await Promise.all(uploadPromises);

    // Record in database
    await this.recordProcessedPhoto(photo.id, album.id, Object.values(processedImages).map(p => p.key));

    console.log(`✓ Uploaded ${photo.name} in ${Object.keys(processedImages).length} sizes`);
  }

  async loadS3Album(albumId) {
    try {
      return await this.s3Client.getJson(`gallery/albums/${albumId}.json`);
    } catch (error) {
      return null; // Album doesn't exist yet
    }
  }

  async updateAlbumMetadata(album, photos) {
    const processedPhotos = await this.getProcessedPhotos(album.id);

    const albumData = {
      id: album.id,
      name: album.name,
      created: album.createdTime,
      modified: album.modifiedTime,
      photoCount: photos.length,
      photos: photos.map(photo => {
        const isProcessed = processedPhotos.has(photo.id);
        return {
          id: photo.id,
          name: photo.name,
          created: photo.createdTime,
          thumbnailUrl: isProcessed
            ? `https://s3.pilw.io/kaiugalerii/images/${photo.id}-300.jpg`
            : this.driveClient.getThumbnailUrl(photo.id, 300),
          mediumUrl: isProcessed
            ? `https://s3.pilw.io/kaiugalerii/images/${photo.id}-600.jpg`
            : this.driveClient.getThumbnailUrl(photo.id, 600),
          largeUrl: isProcessed
            ? `https://s3.pilw.io/kaiugalerii/images/${photo.id}-1200.jpg`
            : this.driveClient.getThumbnailUrl(photo.id, 1200),
          originalUrl: isProcessed
            ? `https://s3.pilw.io/kaiugalerii/images/${photo.id}-original.jpg`
            : `https://drive.google.com/uc?export=view&id=${photo.id}`,
          s3Processed: isProcessed,
        };
      }),
    };

    await this.s3Client.uploadJson(`gallery/albums/${album.id}.json`, albumData, true);
  }

  async updateGalleryManifest(albums) {
    const manifest = {
      albums: await Promise.all(albums.map(async album => {
        const albumData = await this.loadS3Album(album.id);
        return {
          id: album.id,
          name: album.name,
          created: album.createdTime,
          modified: album.modifiedTime,
          photoCount: albumData?.photos?.length || 0,
          coverPhoto: albumData?.photos?.[0] || null,
        };
      })),
      totalAlbums: albums.length,
      lastUpdated: new Date().toISOString(),
    };

    await this.s3Client.uploadJson('gallery/albums.json', manifest, true);
    console.log(`✓ Updated gallery manifest with ${albums.length} albums`);
  }

  async loadSyncState() {
    const db = database.getDb();
    const state = db.prepare('SELECT state_data FROM sync_state WHERE component = ?')
      .get('gallery');
    return state ? JSON.parse(state.state_data || '{}') : {};
  }

  async saveSyncState(state) {
    const db = database.getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sync_state
      (component, last_sync, state_data, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      'gallery',
      new Date().toISOString(),
      JSON.stringify(state),
      new Date().toISOString()
    );
  }

  async clearSyncState() {
    const db = database.getDb();
    db.prepare('UPDATE sync_state SET state_data = ? WHERE component = ?')
      .run('{}', 'gallery');
  }

  async recordProcessedPhoto(photoId, albumId, s3Keys) {
    const db = database.getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO processed_photos
      (photo_id, album_id, s3_keys, processed_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      photoId,
      albumId,
      JSON.stringify(s3Keys),
      new Date().toISOString()
    );
  }

  async getProcessedPhotos(albumId) {
    const db = database.getDb();
    const photos = db.prepare('SELECT photo_id FROM processed_photos WHERE album_id = ?')
      .all(albumId);
    return new Set(photos.map(p => p.photo_id));
  }

  async updateVersionFile(component) {
    try {
      let versionData = await this.s3Client.getJson('metadata/version.json') || {};
      versionData[component] = Date.now();
      versionData.lastUpdated = new Date().toISOString();
      await this.s3Client.uploadJson('metadata/version.json', versionData, true);
    } catch (error) {
      console.warn('Could not update version file:', error.message);
    }
  }
}

module.exports = GallerySync;
```

### Step 5: Update Database Schema

**Add to database initialization:**
```javascript
// Additional tables for gallery sync
db.exec(`
  CREATE TABLE IF NOT EXISTS processed_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id TEXT UNIQUE NOT NULL,
    album_id TEXT NOT NULL,
    file_name TEXT,
    s3_keys TEXT,
    checksum TEXT,
    processed_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_photo_id ON processed_photos(photo_id);
  CREATE INDEX IF NOT EXISTS idx_album_id ON processed_photos(album_id);

  CREATE TABLE IF NOT EXISTS gallery_sync_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id TEXT NOT NULL,
    album_name TEXT,
    total_photos INTEGER,
    processed_photos INTEGER,
    status TEXT,
    last_photo_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
```

### Step 6: Add Gallery Routes

**Update `api/routes/sync.js`:**
```javascript
const GallerySync = require('../services/sync/gallery-sync');

// Initialize gallery sync
const gallerySync = new GallerySync({
  googleApiKey: config.GOOGLE_API_KEY,
  driveFolderId: config.GOOGLE_DRIVE_FOLDER_ID,
  s3Endpoint: config.S3_ENDPOINT,
  s3Bucket: config.S3_BUCKET,
  s3AccessKeyId: config.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: config.S3_SECRET_ACCESS_KEY,
  s3Region: config.S3_REGION,
  imageSizes: config.GALLERY_IMAGE_SIZES,
  batchSize: config.GALLERY_BATCH_SIZE,
  maxRuntime: config.GALLERY_MAX_RUNTIME,
});

// Add to status endpoint
router.get('/status', async (req, res) => {
  try {
    const db = require('../services/database').getDb();
    const calendarState = db.prepare('SELECT * FROM sync_state WHERE component = ?').get('calendar');
    const galleryState = db.prepare('SELECT * FROM sync_state WHERE component = ?').get('gallery');

    res.json({
      calendar: {
        lastSync: calendarState?.last_sync || null,
        lastSuccess: calendarState?.last_success || null,
        failureCount: calendarState?.failure_count || 0,
        status: calendarState?.failure_count > 2 ? 'failing' : 'healthy',
      },
      gallery: {
        lastSync: galleryState?.last_sync || null,
        lastSuccess: galleryState?.last_success || null,
        state: galleryState?.state_data ? JSON.parse(galleryState.state_data) : {},
        status: galleryState?.state_data ? 'syncing' : 'idle',
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Admin: Trigger gallery sync
router.post('/gallery/trigger', authenticateAdmin, async (req, res) => {
  try {
    // Start sync in background
    gallerySync.sync().catch(err =>
      console.error('Background gallery sync error:', err)
    );

    res.json({
      message: 'Gallery sync triggered',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger gallery sync' });
  }
});

// Admin: Reset gallery sync state
router.post('/gallery/reset', authenticateAdmin, async (req, res) => {
  try {
    const db = require('../services/database').getDb();
    db.prepare('DELETE FROM processed_photos').run();
    db.prepare('DELETE FROM gallery_sync_progress').run();
    db.prepare('UPDATE sync_state SET state_data = ? WHERE component = ?').run('{}', 'gallery');

    res.json({ message: 'Gallery sync state reset' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset gallery sync' });
  }
});
```

### Step 7: Add Gallery Cron Job

**In `api/server.js`:**
```javascript
const GallerySync = require('./services/sync/gallery-sync');

// Initialize gallery sync
const gallerySync = new GallerySync({
  googleApiKey: process.env.GOOGLE_API_KEY,
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Bucket: process.env.S3_BUCKET,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  s3Region: process.env.S3_REGION,
  imageSizes: {
    small: 300,
    medium: 600,
    large: 1200,
  },
  batchSize: parseInt(process.env.GALLERY_BATCH_SIZE) || 10,
  maxRuntime: parseInt(process.env.GALLERY_MAX_RUNTIME) || 300,
});

// Schedule gallery sync every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Running scheduled gallery sync...');
  try {
    const result = await gallerySync.sync();
    console.log('Gallery sync result:', result);
  } catch (error) {
    console.error('Scheduled gallery sync failed:', error);
  }
});
```

### Step 8: Environment Variables

**Add to `.env`:**
```env
# Google Drive Configuration
GOOGLE_DRIVE_FOLDER_ID=1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg

# Gallery Sync Configuration
GALLERY_BATCH_SIZE=10
GALLERY_MAX_RUNTIME=300
```

## Testing

### Manual Testing
```bash
# Trigger gallery sync
curl -X POST http://localhost:3000/api/sync/gallery/trigger \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check sync status
curl http://localhost:3000/api/sync/status

# Reset sync state (if needed)
curl -X POST http://localhost:3000/api/sync/gallery/reset \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Verify S3 uploads
curl https://s3.pilw.io/kaiugalerii/gallery/albums.json
```

## Deployment Checklist

- [ ] Install sharp and p-limit
- [ ] Add gallery tables to database
- [ ] Deploy gallery sync code
- [ ] Set environment variables
- [ ] Test manual sync trigger
- [ ] Monitor first automatic run
- [ ] Verify image uploads to S3
- [ ] Check website gallery display
- [ ] Monitor for 48 hours
- [ ] Disable Apps Script gallery triggers

## Performance Considerations

- Process images in parallel (3 at a time)
- Batch processing to avoid timeouts
- Incremental sync to skip processed photos
- Resume capability for large galleries
- Efficient memory usage with streaming

## Success Metrics

- Gallery updates within 15 minutes
- All images processed to multiple sizes
- Incremental sync working correctly
- No memory issues
- Stable long-term operation

---

*Phase 2 Implementation Guide v1.0*
*Estimated Time: 3-4 hours*