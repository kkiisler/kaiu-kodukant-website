// Gallery Sync Service
// Fetches photos from Google Drive and uploads to S3 with image processing
// Replaces Google Apps Script gallery sync with incremental updates

const { google } = require('googleapis');
const sharp = require('sharp');
const axios = require('axios');
const config = require('../config');
const s3Upload = require('./s3-upload');
const database = require('./database');
const syncHistory = require('./syncHistory');

class GallerySyncService {
  constructor() {
    this.apiKey = config.GOOGLE_API_KEY;
    this.folderId = config.GOOGLE_DRIVE_FOLDER_ID;
    this.batchSize = config.GALLERY_BATCH_SIZE || 10;
    this.maxRuntime = config.GALLERY_MAX_RUNTIME || 300; // 5 minutes

    // Initialize Google Drive API client
    this.drive = google.drive({
      version: 'v3',
      auth: this.apiKey
    });

    this.imageSizes = {
      thumbnail: 300,
      medium: 600,
      large: 1200
    };
  }

  /**
   * Get current sync state from database
   * @returns {Object} Sync state
   */
  getSyncState() {
    const db = database.getDb();
    const stmt = db.prepare('SELECT * FROM gallery_sync_state ORDER BY id DESC LIMIT 1');
    const state = stmt.get();

    if (!state) {
      // Initialize first sync state
      const insertStmt = db.prepare(`
        INSERT INTO gallery_sync_state (sync_status) VALUES ('idle')
      `);
      insertStmt.run();
      return this.getSyncState();
    }

    return state;
  }

  /**
   * Update sync state
   * @param {Object} updates - State updates
   */
  updateSyncState(updates) {
    const db = database.getDb();
    const state = this.getSyncState();

    const fields = Object.keys(updates).map(key => `${key} = @${key}`).join(', ');
    const stmt = db.prepare(`UPDATE gallery_sync_state SET ${fields} WHERE id = @id`);

    stmt.run({ id: state.id, ...updates });
  }

  /**
   * Check if photo is already processed
   * @param {string} fileId - Google Drive file ID
   * @returns {boolean}
   */
  isPhotoProcessed(fileId) {
    const db = database.getDb();
    const stmt = db.prepare('SELECT file_id FROM gallery_photos WHERE file_id = ?');
    return !!stmt.get(fileId);
  }

  /**
   * Mark photo as processed
   * @param {Object} photoData - Photo metadata
   */
  markPhotoProcessed(photoData) {
    const db = database.getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO gallery_photos
      (file_id, file_name, album_id, album_name, thumbnail_uploaded, medium_uploaded, large_uploaded, original_size, modified_time)
      VALUES (@file_id, @file_name, @album_id, @album_name, @thumbnail_uploaded, @medium_uploaded, @large_uploaded, @original_size, @modified_time)
    `);

    stmt.run(photoData);
  }

  /**
   * Fetch albums (folders) from Google Drive
   * @returns {Promise<Array>} Albums
   */
  async fetchAlbums() {
    console.log(`Fetching albums from Google Drive folder: ${this.folderId}`);

    try {
      const response = await this.drive.files.list({
        q: `'${this.folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, createdTime, modifiedTime)',
        orderBy: 'createdTime desc'
      });

      const albums = response.data.files || [];
      console.log(`✓ Found ${albums.length} albums`);

      return albums;
    } catch (error) {
      console.error('✗ Failed to fetch albums:', error.message);
      throw new Error(`Drive API error: ${error.message}`);
    }
  }

  /**
   * Fetch photos from an album
   * @param {string} albumId - Album folder ID
   * @param {number} maxResults - Maximum number of photos to fetch
   * @returns {Promise<Array>} Photos
   */
  async fetchPhotosFromAlbum(albumId, maxResults = 100) {
    try {
      const response = await this.drive.files.list({
        q: `'${albumId}' in parents and mimeType contains 'image/' and trashed=false`,
        fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webContentLink, thumbnailLink)',
        orderBy: 'createdTime desc',
        pageSize: maxResults
      });

      return response.data.files || [];
    } catch (error) {
      console.error(`✗ Failed to fetch photos from album ${albumId}:`, error.message);
      return [];
    }
  }

  /**
   * Download image from Google Drive
   * @param {string} fileId - File ID
   * @returns {Promise<Buffer>} Image buffer
   */
  async downloadImage(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error(`✗ Failed to download image ${fileId}:`, error.message);
      throw error;
    }
  }

  /**
   * Resize image to specified width
   * @param {Buffer} imageBuffer - Original image
   * @param {number} width - Target width
   * @returns {Promise<Buffer>} Resized image
   */
  async resizeImage(imageBuffer, width) {
    try {
      return await sharp(imageBuffer)
        .rotate() // Auto-rotate based on EXIF orientation (fixes portrait photos)
        .resize(width, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
    } catch (error) {
      console.error(`✗ Failed to resize image to ${width}px:`, error.message);
      throw error;
    }
  }

  /**
   * Process and upload a single photo
   * @param {Object} photo - Photo metadata
   * @param {string} albumId - Album ID
   * @param {string} albumName - Album name
   * @returns {Promise<Object>} Processing result
   */
  async processPhoto(photo, albumId, albumName) {
    const startTime = Date.now();

    try {
      // Skip if already processed
      if (this.isPhotoProcessed(photo.id)) {
        console.log(`  ⏭ Skipping already processed: ${photo.name}`);
        return { skipped: true, fileId: photo.id };
      }

      console.log(`  📸 Processing: ${photo.name}`);

      // Download original image
      const originalImage = await this.downloadImage(photo.id);

      // Generate all sizes
      const sizes = ['thumbnail', 'medium', 'large'];
      const uploadResults = {};

      for (const size of sizes) {
        const targetWidth = this.imageSizes[size];
        const resizedImage = await this.resizeImage(originalImage, targetWidth);

        // Upload to S3
        const s3Key = `images/${photo.id}-${size}.jpg`;
        await s3Upload.uploadBinary(s3Key, resizedImage, 'image/jpeg');

        uploadResults[`${size}_uploaded`] = 1;
      }

      // Mark as processed
      this.markPhotoProcessed({
        file_id: photo.id,
        file_name: photo.name,
        album_id: albumId,
        album_name: albumName,
        thumbnail_uploaded: 1,
        medium_uploaded: 1,
        large_uploaded: 1,
        original_size: photo.size || 0,
        modified_time: photo.modifiedTime
      });

      const duration = Date.now() - startTime;
      console.log(`  ✓ Processed ${photo.name} in ${duration}ms`);

      return {
        success: true,
        fileId: photo.id,
        fileName: photo.name,
        duration
      };
    } catch (error) {
      console.error(`  ✗ Failed to process ${photo.name}:`, error.message);
      return {
        success: false,
        fileId: photo.id,
        fileName: photo.name,
        error: error.message
      };
    }
  }

  /**
   * Generate albums.json metadata
   * @param {Array} albums - Albums with photos
   * @returns {Object} Albums metadata
   */
  generateAlbumsMetadata(albums) {
    return {
      albums: albums.map(album => ({
        id: album.id,
        name: album.name,
        photoCount: album.photos.length,
        coverPhoto: album.photos[0]?.id || null,
        createdTime: album.createdTime,
        modifiedTime: album.modifiedTime
      })),
      metadata: {
        lastSync: new Date().toISOString(),
        albumCount: albums.length,
        totalPhotos: albums.reduce((sum, album) => sum + album.photos.length, 0),
        source: 'google-drive-api',
        version: '1.0.0'
      }
    };
  }

  /**
   * Main sync function
   * @returns {Promise<Object>} Sync result
   */
  async syncGallery() {
    const startTime = Date.now();
    const state = this.getSyncState();

    // Check if already running
    if (state.sync_status === 'running') {
      console.log('⚠️  Gallery sync already running');
      return { skipped: true, reason: 'Already running' };
    }

    try {
      console.log('🖼️  Starting gallery sync...');

      // Update state to running
      this.updateSyncState({
        sync_status: 'running',
        started_at: new Date().toISOString(),
        error_message: null
      });

      // Fetch all albums
      const albums = await this.fetchAlbums();

      let totalProcessed = 0;
      let totalSkipped = 0;
      const albumsData = [];

      // Process each album
      for (const album of albums) {
        console.log(`\n📁 Processing album: ${album.name}`);

        // Fetch photos from album
        const photos = await this.fetchPhotosFromAlbum(album.id);
        console.log(`  Found ${photos.length} photos`);

        // Process all photos in the album
        const processedPhotos = [];
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const result = await this.processPhoto(photo, album.id, album.name);

          if (result.skipped) {
            totalSkipped++;
          } else if (result.success) {
            totalProcessed++;
            processedPhotos.push({
              id: photo.id,
              name: photo.name,
              createdTime: photo.createdTime,
              modifiedTime: photo.modifiedTime
            });
          }

          // Check runtime limit
          const elapsed = (Date.now() - startTime) / 1000;
          if (elapsed > this.maxRuntime) {
            console.log(`⏱️  Max runtime reached (${this.maxRuntime}s), stopping...`);
            break;
          }
        }

        // Add album data
        albumsData.push({
          ...album,
          photos: photos.map(p => ({
            id: p.id,
            name: p.name,
            createdTime: p.createdTime,
            modifiedTime: p.modifiedTime
          }))
        });
      }

      // Generate and upload albums.json
      const albumsMetadata = this.generateAlbumsMetadata(albumsData);
      await s3Upload.uploadJSON('gallery/albums.json', albumsMetadata);

      // Upload individual album JSON files with full photo data
      for (const album of albumsData) {
        const albumData = {
          id: album.id,
          name: album.name,
          createdTime: album.createdTime,
          modifiedTime: album.modifiedTime,
          photoCount: album.photos.length,
          photos: album.photos.map(photo => ({
            id: photo.id,
            name: photo.name,
            // S3 image URLs
            thumbnailUrl: `https://s3.pilw.io/kaiugalerii/images/${photo.id}-thumbnail.jpg`,
            mediumUrl: `https://s3.pilw.io/kaiugalerii/images/${photo.id}-medium.jpg`,
            largeUrl: `https://s3.pilw.io/kaiugalerii/images/${photo.id}-large.jpg`,
            createdTime: photo.createdTime,
            modifiedTime: photo.modifiedTime
          })),
          metadata: {
            lastSync: new Date().toISOString(),
            source: 'google-drive-api',
            version: '1.0.0'
          }
        };
        await s3Upload.uploadJSON(`gallery/albums/${album.id}.json`, albumData);
        console.log(`✓ Uploaded album data for: ${album.name}`);
      }

      // Update version file
      await s3Upload.updateVersionFile('gallery');

      // Upload sync log
      const duration = Date.now() - startTime;
      await s3Upload.uploadSyncLog('gallery', {
        success: true,
        albumCount: albums.length,
        photosProcessed: totalProcessed,
        photosSkipped: totalSkipped,
        duration
      });

      // Update state
      this.updateSyncState({
        sync_status: 'idle',
        last_sync_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        total_photos_processed: state.total_photos_processed + totalProcessed,
        total_albums_processed: state.total_albums_processed + albums.length
      });

      console.log(`✓ Gallery sync completed in ${duration}ms`);

      // Record successful sync to history
      await syncHistory.recordSyncEvent('gallery', {
        status: 'success',
        albumsCount: albums.length,
        photosCount: totalProcessed,
        source: 'api-sync'
      });

      return {
        success: true,
        albumCount: albums.length,
        photosProcessed: totalProcessed,
        photosSkipped: totalSkipped,
        duration,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('✗ Gallery sync failed:', error.message);

      // Record failed sync to history
      await syncHistory.recordSyncEvent('gallery', {
        status: 'error',
        error: error.message,
        source: 'api-sync'
      });

      // Update state with error
      this.updateSyncState({
        sync_status: 'error',
        error_message: error.message,
        completed_at: new Date().toISOString()
      });

      // Upload error log
      try {
        await s3Upload.uploadSyncLog('gallery', {
          success: false,
          error: error.message,
          duration
        });
      } catch (logError) {
        console.error('✗ Failed to upload error log:', logError.message);
      }

      throw error;
    }
  }

  /**
   * Get current sync status
   * @returns {Object} Sync status
   */
  getStatus() {
    const state = this.getSyncState();
    const db = database.getDb();

    // Get total photos count
    const photoCountStmt = db.prepare('SELECT COUNT(*) as count FROM gallery_photos');
    const photoCount = photoCountStmt.get().count;

    // Get actual number of albums (unique album count from photos table)
    const albumCountStmt = db.prepare('SELECT COUNT(DISTINCT album_id) as count FROM gallery_photos');
    const albumCount = albumCountStmt.get().count;

    return {
      status: state.sync_status,
      lastSync: state.last_sync_at,
      totalPhotos: photoCount,
      totalAlbums: albumCount,
      errorMessage: state.error_message
    };
  }

  /**
   * Force a manual sync
   * @returns {Promise<Object>} Sync result
   */
  async forceSync() {
    console.log('🔄 Manual gallery sync triggered');
    return this.syncGallery();
  }

  /**
   * Reset gallery database to force complete re-sync
   * @returns {Object} Reset result
   */
  resetGallery() {
    const db = database.getDb();

    try {
      // Delete all gallery photos to force re-upload
      const deleteStmt = db.prepare('DELETE FROM gallery_photos');
      const deleteResult = deleteStmt.run();

      // Reset sync state
      const resetStmt = db.prepare(`
        UPDATE gallery_sync_state
        SET total_photos_processed = 0,
            total_albums_processed = 0,
            last_sync_at = NULL,
            sync_status = 'idle',
            error_message = NULL
      `);
      resetStmt.run();

      console.log(`✓ Gallery reset: ${deleteResult.changes} photos removed`);

      return {
        success: true,
        photosDeleted: deleteResult.changes,
        message: 'Gallery database reset. Next sync will re-process all photos.'
      };
    } catch (error) {
      console.error('✗ Gallery reset failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new GallerySyncService();
