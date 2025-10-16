/**
 * Complete Gallery Sync Implementation
 * Ready-to-use gallery synchronization service with incremental updates
 */

const axios = require('axios');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const pLimit = require('p-limit');

class GallerySyncService {
  constructor(config) {
    // Google Drive configuration
    this.rootFolderId = config.GOOGLE_DRIVE_FOLDER_ID;
    this.googleApiKey = config.GOOGLE_API_KEY; // Optional

    // S3 configuration
    this.s3 = new AWS.S3({
      endpoint: config.S3_ENDPOINT,
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      region: config.S3_REGION || 'eu-west-1',
      s3ForcePathStyle: true,
    });
    this.bucket = config.S3_BUCKET;

    // Image processing configuration
    this.imageSizes = config.IMAGE_SIZES || {
      small: 300,
      medium: 600,
      large: 1200,
    };

    // Sync configuration
    this.batchSize = config.GALLERY_BATCH_SIZE || 10;
    this.maxRuntime = (config.GALLERY_MAX_RUNTIME || 300) * 1000; // Convert to ms
    this.parallelLimit = pLimit(3); // Process 3 images in parallel

    // Dependencies
    this.database = config.database;
    this.emailService = config.emailService;
  }

  /**
   * Main sync method - call this from cron job
   */
  async syncGallery() {
    const startTime = Date.now();
    console.log('=== Starting Gallery Sync ===');

    // Load sync state from database
    const state = await this.loadSyncState();

    let processedCount = 0;
    let skippedCount = 0;
    let uploadedCount = 0;

    try {
      // Step 1: Get all albums from Google Drive
      const albums = await this.fetchAlbums();
      console.log(`Found ${albums.length} albums in Google Drive`);

      // Resume from saved position
      let albumIndex = state.albumIndex || 0;
      let photoIndex = state.photoIndex || 0;

      // Process albums
      while (albumIndex < albums.length) {
        // Check if we've exceeded runtime or batch size
        if (Date.now() - startTime > this.maxRuntime || processedCount >= this.batchSize) {
          console.log('⏸ Batch/time limit reached, saving state...');
          await this.saveSyncState({ albumIndex, photoIndex });

          return {
            status: 'partial',
            processed: processedCount,
            uploaded: uploadedCount,
            skipped: skippedCount,
          };
        }

        const album = albums[albumIndex];
        console.log(`\nProcessing album: ${album.name} (${albumIndex + 1}/${albums.length})`);

        // Get existing photos from S3
        const existingPhotos = await this.getExistingPhotosFromS3(album.id);

        // Get photos from Google Drive
        const photos = await this.fetchPhotosFromAlbum(album.id);
        console.log(`Found ${photos.length} photos in album`);

        // Process photos in album
        const albumPhotos = [];
        while (photoIndex < photos.length && processedCount < this.batchSize) {
          const photo = photos[photoIndex];

          // Check if photo already processed
          if (existingPhotos.has(photo.id) || await this.isPhotoProcessed(photo.id)) {
            skippedCount++;
            albumPhotos.push(this.createPhotoMetadata(photo, true));
          } else {
            // Process and upload new photo
            try {
              console.log(`📤 Processing: ${photo.name}`);
              await this.processAndUploadPhoto(photo, album.id);
              uploadedCount++;
              albumPhotos.push(this.createPhotoMetadata(photo, true));
            } catch (error) {
              console.error(`Failed to process ${photo.name}:`, error.message);
              albumPhotos.push(this.createPhotoMetadata(photo, false));
            }
            processedCount++;
          }

          photoIndex++;
        }

        // If album is complete, update its metadata
        if (photoIndex >= photos.length) {
          await this.updateAlbumMetadata(album, photos);
          console.log(`✓ Completed album: ${album.name}`);
          albumIndex++;
          photoIndex = 0;
        }
      }

      // All albums complete
      console.log('\n✅ Gallery sync complete!');
      await this.updateGalleryManifest(albums);
      await this.clearSyncState();
      await this.updateVersionFile();

      return {
        status: 'complete',
        processed: processedCount,
        uploaded: uploadedCount,
        skipped: skippedCount,
        totalAlbums: albums.length,
      };

    } catch (error) {
      console.error('✗ Gallery sync failed:', error);
      await this.saveSyncState({ albumIndex: state.albumIndex || 0, photoIndex: state.photoIndex || 0 });
      await this.checkAndSendAlert(error);
      throw error;
    }
  }

  /**
   * Fetch album list from Google Drive
   */
  async fetchAlbums() {
    const params = {
      q: `'${this.rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name,createdTime,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 1000,
    };

    if (this.googleApiKey) {
      params.key = this.googleApiKey;
    }

    try {
      const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
        params,
        timeout: 30000,
      });

      return response.data.files || [];
    } catch (error) {
      throw new Error(`Failed to fetch albums: ${error.message}`);
    }
  }

  /**
   * Fetch photos from a specific album
   */
  async fetchPhotosFromAlbum(albumId) {
    const params = {
      q: `'${albumId}' in parents and (mimeType contains 'image/') and trashed=false`,
      fields: 'files(id,name,createdTime,modifiedTime,size,imageMediaMetadata)',
      orderBy: 'createdTime',
      pageSize: 1000,
    };

    if (this.googleApiKey) {
      params.key = this.googleApiKey;
    }

    try {
      const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
        params,
        timeout: 30000,
      });

      return response.data.files || [];
    } catch (error) {
      throw new Error(`Failed to fetch photos from album: ${error.message}`);
    }
  }

  /**
   * Download and process a photo
   */
  async processAndUploadPhoto(photo, albumId) {
    // Download original image
    const imageBuffer = await this.downloadImage(photo.id);

    // Process to multiple sizes
    const processedImages = await this.processImageSizes(imageBuffer, photo.id);

    // Upload all sizes to S3 in parallel
    const uploadPromises = Object.entries(processedImages).map(([size, data]) =>
      this.parallelLimit(() => this.uploadImageToS3(data.key, data.buffer))
    );

    await Promise.all(uploadPromises);

    // Record in database
    await this.recordProcessedPhoto(photo.id, albumId, Object.values(processedImages).map(d => d.key));

    console.log(`✓ Uploaded ${photo.name} (${Object.keys(processedImages).length} sizes)`);
  }

  /**
   * Download image from Google Drive
   */
  async downloadImage(fileId) {
    const params = {
      alt: 'media',
    };

    if (this.googleApiKey) {
      params.key = this.googleApiKey;
    }

    try {
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          params,
          responseType: 'arraybuffer',
          timeout: 60000, // 60 second timeout for large images
          maxContentLength: 100 * 1024 * 1024, // 100MB max
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  /**
   * Process image to multiple sizes
   */
  async processImageSizes(buffer, fileId) {
    const results = {};

    // Process each size
    for (const [sizeName, width] of Object.entries(this.imageSizes)) {
      try {
        const processed = await sharp(buffer)
          .resize(width, null, {
            withoutEnlargement: true,
            fit: 'inside',
          })
          .jpeg({
            quality: 85,
            progressive: true,
            mozjpeg: true,
          })
          .toBuffer();

        results[sizeName] = {
          buffer: processed,
          key: `images/${fileId}-${width}.jpg`,
        };
      } catch (error) {
        console.error(`Error processing ${sizeName} size:`, error);
        throw error;
      }
    }

    // Also save original (optimized)
    try {
      const original = await sharp(buffer)
        .jpeg({
          quality: 90,
          progressive: true,
        })
        .toBuffer();

      results.original = {
        buffer: original,
        key: `images/${fileId}-original.jpg`,
      };
    } catch (error) {
      console.error('Error processing original:', error);
      throw error;
    }

    return results;
  }

  /**
   * Upload image to S3
   */
  async uploadImageToS3(key, buffer) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000', // Cache for 1 year
    };

    try {
      await this.s3.putObject(params).promise();
    } catch (error) {
      throw new Error(`Failed to upload ${key}: ${error.message}`);
    }
  }

  /**
   * Get existing photos from S3 album metadata
   */
  async getExistingPhotosFromS3(albumId) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: `gallery/albums/${albumId}.json`,
      };

      const data = await this.s3.getObject(params).promise();
      const albumData = JSON.parse(data.Body.toString());

      // Return set of photo IDs that are marked as processed
      const processedPhotos = new Set();
      if (albumData.photos) {
        albumData.photos.forEach(photo => {
          if (photo.s3Processed) {
            processedPhotos.add(photo.id);
          }
        });
      }

      return processedPhotos;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return new Set(); // Album doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Check if photo is already processed (database check)
   */
  async isPhotoProcessed(photoId) {
    if (!this.database) return false;

    const db = this.database.getDb();
    const photo = db.prepare('SELECT photo_id FROM processed_photos WHERE photo_id = ?').get(photoId);
    return !!photo;
  }

  /**
   * Record processed photo in database
   */
  async recordProcessedPhoto(photoId, albumId, s3Keys) {
    if (!this.database) return;

    const db = this.database.getDb();
    db.prepare(`
      INSERT OR REPLACE INTO processed_photos
      (photo_id, album_id, s3_keys, processed_at)
      VALUES (?, ?, ?, ?)
    `).run(
      photoId,
      albumId,
      JSON.stringify(s3Keys),
      new Date().toISOString()
    );
  }

  /**
   * Create photo metadata object
   */
  createPhotoMetadata(photo, isProcessed) {
    const baseUrl = `https://${this.s3.endpoint}/${this.bucket}/images/${photo.id}`;

    return {
      id: photo.id,
      name: photo.name,
      created: photo.createdTime,
      thumbnailUrl: isProcessed
        ? `${baseUrl}-300.jpg`
        : `https://drive.google.com/thumbnail?id=${photo.id}&sz=w300`,
      mediumUrl: isProcessed
        ? `${baseUrl}-600.jpg`
        : `https://drive.google.com/thumbnail?id=${photo.id}&sz=w600`,
      largeUrl: isProcessed
        ? `${baseUrl}-1200.jpg`
        : `https://drive.google.com/thumbnail?id=${photo.id}&sz=w1200`,
      originalUrl: isProcessed
        ? `${baseUrl}-original.jpg`
        : `https://drive.google.com/uc?export=view&id=${photo.id}`,
      s3Processed: isProcessed,
      size: photo.size,
      dimensions: photo.imageMediaMetadata || null,
    };
  }

  /**
   * Update album metadata in S3
   */
  async updateAlbumMetadata(album, photos) {
    const processedPhotos = [];

    for (const photo of photos) {
      const isProcessed = await this.isPhotoProcessed(photo.id);
      processedPhotos.push(this.createPhotoMetadata(photo, isProcessed));
    }

    const albumData = {
      id: album.id,
      name: album.name,
      created: album.createdTime,
      modified: album.modifiedTime,
      photoCount: photos.length,
      photos: processedPhotos,
      lastUpdated: new Date().toISOString(),
    };

    await this.uploadJsonToS3(`gallery/albums/${album.id}.json`, albumData);
  }

  /**
   * Update main gallery manifest
   */
  async updateGalleryManifest(albums) {
    const albumsData = [];

    for (const album of albums) {
      try {
        // Get album data from S3
        const albumData = await this.getAlbumFromS3(album.id);

        albumsData.push({
          id: album.id,
          name: album.name,
          created: album.createdTime,
          modified: album.modifiedTime,
          photoCount: albumData?.photos?.length || 0,
          coverPhoto: albumData?.photos?.[0] || null,
        });
      } catch (error) {
        console.warn(`Could not get album data for ${album.name}:`, error.message);
      }
    }

    const manifest = {
      albums: albumsData,
      totalAlbums: albums.length,
      totalPhotos: albumsData.reduce((sum, album) => sum + album.photoCount, 0),
      lastUpdated: new Date().toISOString(),
    };

    await this.uploadJsonToS3('gallery/albums.json', manifest);
    console.log(`✓ Updated gallery manifest: ${manifest.totalAlbums} albums, ${manifest.totalPhotos} photos`);
  }

  /**
   * Get album data from S3
   */
  async getAlbumFromS3(albumId) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: `gallery/albums/${albumId}.json`,
      };

      const data = await this.s3.getObject(params).promise();
      return JSON.parse(data.Body.toString());
    } catch (error) {
      return null;
    }
  }

  /**
   * Upload JSON to S3
   */
  async uploadJsonToS3(key, data) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
      ACL: 'public-read',
      CacheControl: 'public, max-age=300', // Cache for 5 minutes
    };

    await this.s3.putObject(params).promise();
  }

  /**
   * Update version file for cache busting
   */
  async updateVersionFile() {
    try {
      let versionData = {};

      try {
        const existing = await this.s3.getObject({
          Bucket: this.bucket,
          Key: 'metadata/version.json',
        }).promise();

        versionData = JSON.parse(existing.Body.toString());
      } catch (error) {
        // Version file doesn't exist yet
      }

      versionData.gallery = Date.now();
      versionData.lastUpdated = new Date().toISOString();

      await this.uploadJsonToS3('metadata/version.json', versionData);
    } catch (error) {
      console.warn('Could not update version file:', error.message);
    }
  }

  /**
   * Load sync state from database
   */
  async loadSyncState() {
    if (!this.database) return {};

    const db = this.database.getDb();
    const state = db.prepare('SELECT state_data FROM sync_state WHERE component = ?').get('gallery');
    return state ? JSON.parse(state.state_data || '{}') : {};
  }

  /**
   * Save sync state to database
   */
  async saveSyncState(state) {
    if (!this.database) return;

    const db = this.database.getDb();
    db.prepare(`
      INSERT OR REPLACE INTO sync_state
      (component, last_sync, state_data, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'gallery',
      new Date().toISOString(),
      JSON.stringify(state),
      new Date().toISOString()
    );
  }

  /**
   * Clear sync state
   */
  async clearSyncState() {
    if (!this.database) return;

    const db = this.database.getDb();
    db.prepare('UPDATE sync_state SET state_data = ? WHERE component = ?').run('{}', 'gallery');
  }

  /**
   * Check and send alert if needed
   */
  async checkAndSendAlert(error) {
    if (!this.database || !this.emailService) return;

    try {
      const db = this.database.getDb();
      const state = db.prepare('SELECT failure_count FROM sync_state WHERE component = ?').get('gallery');

      if (state?.failure_count >= 3) {
        await this.emailService.sendEmail({
          to: process.env.SYNC_ALERT_EMAIL,
          subject: '⚠️ Gallery Sync Failing',
          text: `Gallery sync has failed ${state.failure_count} consecutive times.\n\nLast error: ${error.message}`,
        });
      }
    } catch (error) {
      console.warn('Could not send alert:', error.message);
    }
  }

  /**
   * Get sync status
   */
  async getStatus() {
    if (!this.database) {
      return { status: 'unknown' };
    }

    const db = this.database.getDb();
    const state = db.prepare('SELECT * FROM sync_state WHERE component = ?').get('gallery');

    if (!state) {
      return { status: 'never_synced' };
    }

    const syncState = JSON.parse(state.state_data || '{}');

    return {
      status: syncState.albumIndex !== undefined ? 'syncing' : 'idle',
      lastSync: state.last_sync,
      lastSuccess: state.last_success,
      progress: syncState.albumIndex !== undefined ? {
        albumIndex: syncState.albumIndex,
        photoIndex: syncState.photoIndex,
      } : null,
    };
  }
}

// Export for use in Node.js application
module.exports = GallerySyncService;

// Example usage:
if (require.main === module) {
  const service = new GallerySyncService({
    GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_REGION: process.env.S3_REGION,
    GALLERY_BATCH_SIZE: 10,
    GALLERY_MAX_RUNTIME: 300,
  });

  service.syncGallery()
    .then(result => console.log('Sync result:', result))
    .catch(error => console.error('Sync error:', error));
}