/**
 * Gallery Sync to S3 with TRUE Incremental Processing
 * Only uploads new or modified photos
 */

/**
 * Main incremental gallery sync function
 * Properly checks existing S3 content before uploading
 */
function syncGalleryIncremental() {
  const startTime = new Date().getTime();
  const MAX_RUNTIME = 5 * 60 * 1000; // 5 minutes
  const BATCH_SIZE = 30; // Process 30 images per run

  Logger.log('=== Starting Incremental Gallery Sync ===');

  // Load or initialize sync state
  const props = PropertiesService.getScriptProperties();
  const stateJson = props.getProperty('gallerySyncState');
  const syncState = stateJson ? JSON.parse(stateJson) : {};

  try {
    // Get all albums from Drive
    const driveAlbums = syncState.albums || getAllAlbumsFromDrive();
    let albumIndex = syncState.albumIndex || 0;
    let photoIndex = syncState.photoIndex || 0;
    let processedCount = 0;
    let skippedCount = 0;
    let uploadedCount = 0;

    Logger.log(`Resuming from: Album ${albumIndex}/${driveAlbums.length}, Photo ${photoIndex}`);

    // Process albums
    while (albumIndex < driveAlbums.length && processedCount < BATCH_SIZE) {
      const album = driveAlbums[albumIndex];

      // Load existing S3 album data if not cached
      if (!album.s3Data) {
        album.s3Data = loadS3AlbumData(album.id);
        Logger.log(`Loaded S3 data for album ${album.name}: ${album.s3Data ? Object.keys(album.s3Data).length + ' existing photos' : 'new album'}`);
      }

      // Get photos from Drive if not cached
      if (!album.photos) {
        album.photos = getAlbumPhotos(album.id);
        Logger.log(`Loaded ${album.photos.length} photos from Drive album: ${album.name}`);
      }

      // Process photos in current album
      while (photoIndex < album.photos.length && processedCount < BATCH_SIZE) {
        // Check time limit
        if (new Date().getTime() - startTime > MAX_RUNTIME) {
          // Save state and exit
          saveGalleryState(props, {
            albums: driveAlbums,
            albumIndex: albumIndex,
            photoIndex: photoIndex,
            lastRun: new Date().toISOString(),
            status: 'paused',
            processedInRun: processedCount,
            skippedInRun: skippedCount,
            uploadedInRun: uploadedCount
          });

          Logger.log(`⏸ Timeout approaching. Processed ${processedCount} (${uploadedCount} uploaded, ${skippedCount} skipped)`);
          return {
            status: 'paused',
            processed: processedCount,
            uploaded: uploadedCount,
            skipped: skippedCount
          };
        }

        const photo = album.photos[photoIndex];

        // Check if photo already exists in S3 with all sizes
        if (photoExistsInS3Complete(photo.id, album.s3Data)) {
          // Photo already fully uploaded, update URLs from S3 data
          const s3Photo = album.s3Data[photo.id];
          photo.smallS3Url = s3Photo.urls?.small || `https://s3.pilw.io/kaiugalerii/images/${photo.id}-300.jpg`;
          photo.mediumS3Url = s3Photo.urls?.medium || `https://s3.pilw.io/kaiugalerii/images/${photo.id}-600.jpg`;
          photo.largeS3Url = s3Photo.urls?.large || `https://s3.pilw.io/kaiugalerii/images/${photo.id}-1200.jpg`;
          photo.originalS3Url = s3Photo.urls?.original || `https://s3.pilw.io/kaiugalerii/images/${photo.id}-original.jpg`;

          skippedCount++;
          if (skippedCount % 10 === 0) {
            Logger.log(`⏭ Skipped ${skippedCount} existing photos`);
          }
        } else {
          // New or incomplete photo - upload to S3
          try {
            Logger.log(`📤 Uploading new photo: ${photo.name} (${photoIndex + 1}/${album.photos.length})`);
            processPhotoToS3(photo, album);
            uploadedCount++;

            // Update S3 data cache
            if (!album.s3Data) album.s3Data = {};
            album.s3Data[photo.id] = {
              id: photo.id,
              name: photo.name,
              urls: {
                small: photo.smallS3Url,
                medium: photo.mediumS3Url,
                large: photo.largeS3Url,
                original: photo.originalS3Url
              }
            };
          } catch (error) {
            Logger.log(`✗ Failed to upload ${photo.name}: ${error.message}`);
          }
        }

        processedCount++;
        photoIndex++;
      }

      // Album complete - upload metadata
      if (photoIndex >= album.photos.length) {
        Logger.log(`✓ Completed album: ${album.name} (${uploadedCount} new, ${skippedCount} existing)`);
        uploadAlbumToS3(album);
        albumIndex++;
        photoIndex = 0;
        // Reset counters for next album
        uploadedCount = 0;
        skippedCount = 0;
      }
    }

    // All albums processed
    if (albumIndex >= driveAlbums.length) {
      Logger.log(`✅ SYNC COMPLETE! Final run: ${uploadedCount} uploaded, ${skippedCount} skipped`);

      // Clear state
      props.deleteProperty('gallerySyncState');

      // Upload gallery manifest
      uploadGalleryManifest(driveAlbums);
      updateVersionFile('gallery');

      logSyncAttempt('gallery', true, `Complete - ${getTotalPhotoCount(driveAlbums)} total photos`);
      resetFailureCount('gallery');

      return {
        status: 'complete',
        processed: processedCount,
        uploaded: uploadedCount,
        skipped: skippedCount
      };
    } else {
      // Partial sync - save state
      saveGalleryState(props, {
        albums: driveAlbums,
        albumIndex: albumIndex,
        photoIndex: photoIndex,
        lastRun: new Date().toISOString(),
        status: 'partial',
        processedInRun: processedCount,
        uploadedInRun: uploadedCount,
        skippedInRun: skippedCount
      });

      Logger.log(`📊 Partial sync: ${processedCount} processed (${uploadedCount} new, ${skippedCount} existing)`);
      return {
        status: 'partial',
        processed: processedCount,
        uploaded: uploadedCount,
        skipped: skippedCount
      };
    }

  } catch (error) {
    Logger.log(`✗ Gallery sync error: ${error.message}`);
    logSyncAttempt('gallery', false, error.message);
    trackFailure('gallery', error.message);
    throw error;
  }
}

/**
 * Load existing album data from S3
 * Returns a map of photo IDs to photo metadata
 */
function loadS3AlbumData(albumId) {
  try {
    const url = `https://s3.pilw.io/kaiugalerii/gallery/albums/${albumId}.json`;
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const albumData = JSON.parse(response.getContentText());

      // Create a map for faster lookup
      const photoMap = {};
      if (albumData.photos && Array.isArray(albumData.photos)) {
        albumData.photos.forEach(photo => {
          // Check if this photo has S3 URLs
          if (photo.s3Processed || (photo.urls && photo.urls.small)) {
            photoMap[photo.id] = photo;
          }
        });
      }

      Logger.log(`Loaded ${Object.keys(photoMap).length} existing photos from S3 for album ${albumId}`);
      return photoMap;
    } else {
      // Album doesn't exist in S3 yet
      return null;
    }
  } catch (error) {
    Logger.log(`Could not load S3 album data for ${albumId}: ${error.message}`);
    return null;
  }
}

/**
 * Check if a photo exists completely in S3 (all sizes)
 */
function photoExistsInS3Complete(photoId, s3AlbumData) {
  if (!s3AlbumData || !s3AlbumData[photoId]) {
    return false;
  }

  const s3Photo = s3AlbumData[photoId];

  // Check if all required URLs exist
  const hasAllUrls = s3Photo.urls &&
                     s3Photo.urls.small &&
                     s3Photo.urls.medium &&
                     s3Photo.urls.large;

  // Also check the s3Processed flag if available
  const isProcessed = s3Photo.s3Processed === true;

  return hasAllUrls || isProcessed;
}

/**
 * Quick check if a single image exists in S3
 * Used for verification
 */
function verifySingleImageInS3(key) {
  try {
    const url = `https://s3.pilw.io/kaiugalerii/${key}`;
    const response = UrlFetchApp.fetch(url, {
      method: 'HEAD',
      muteHttpExceptions: true
    });

    return response.getResponseCode() === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Manual trigger for incremental sync
 */
function manualIncrementalSync() {
  Logger.log('=== Manual incremental sync triggered ===');
  return syncGalleryIncremental();
}

/**
 * Test function to check S3 album data loading
 */
function testLoadS3Album() {
  // Test with a known album ID
  const testAlbumId = '1cW3JJz_BpeBwh2OX7w6YyPfZDJUy_4ON'; // Replace with actual album ID
  const s3Data = loadS3AlbumData(testAlbumId);

  if (s3Data) {
    Logger.log(`Successfully loaded album with ${Object.keys(s3Data).length} photos`);
    // Show first photo as example
    const firstPhotoId = Object.keys(s3Data)[0];
    if (firstPhotoId) {
      Logger.log(`First photo: ${JSON.stringify(s3Data[firstPhotoId], null, 2)}`);
    }
  } else {
    Logger.log('Album not found in S3 or error loading');
  }
}

/**
 * Debug function to check current sync state
 */
function debugSyncState() {
  const props = PropertiesService.getScriptProperties();
  const state = props.getProperty('gallerySyncState');

  if (state) {
    const syncState = JSON.parse(state);
    Logger.log('Current sync state:');
    Logger.log(`  Album: ${syncState.albumIndex} / ${syncState.albums?.length}`);
    Logger.log(`  Photo: ${syncState.photoIndex}`);
    Logger.log(`  Last run: ${syncState.lastRun}`);
    Logger.log(`  Uploaded in last run: ${syncState.uploadedInRun}`);
    Logger.log(`  Skipped in last run: ${syncState.skippedInRun}`);

    if (syncState.albums && syncState.albumIndex < syncState.albums.length) {
      const currentAlbum = syncState.albums[syncState.albumIndex];
      Logger.log(`  Current album: ${currentAlbum.name}`);
      Logger.log(`  Has S3 data: ${!!currentAlbum.s3Data}`);
    }
  } else {
    Logger.log('No sync in progress');
  }
}

/**
 * Get all albums from Google Drive
 */
function getAllAlbumsFromDrive() {
  const folderId = GALLERY_CONFIG.folderId;
  const folder = DriveApp.getFolderById(folderId);
  const albums = [];

  // Get all subfolders (albums)
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const albumFolder = folders.next();
    albums.push({
      id: albumFolder.getId(),
      name: albumFolder.getName(),
      created: albumFolder.getDateCreated(),
      modified: albumFolder.getLastUpdated(),
      photos: null // Will be loaded when needed
    });
  }

  // Sort albums by date (newest first)
  albums.sort((a, b) => b.modified - a.modified);

  Logger.log(`Found ${albums.length} albums in Drive`);
  return albums;
}

/**
 * Get photos from an album folder
 */
function getAlbumPhotos(albumId) {
  const folder = DriveApp.getFolderById(albumId);
  const photos = [];

  // Get all image files
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const mimeType = file.getMimeType();

    // Only process image files
    if (mimeType.startsWith('image/')) {
      photos.push({
        id: file.getId(),
        name: file.getName(),
        size: file.getSize(),
        created: file.getDateCreated(),
        mimeType: mimeType,
        width: null,  // Would need to download to get dimensions
        height: null,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w300`,
        mediumUrl: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w600`,
        largeUrl: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1200`,
        originalUrl: `https://drive.google.com/uc?export=view&id=${file.getId()}`
      });
    }
  }

  // Sort by creation date
  photos.sort((a, b) => a.created - b.created);

  return photos;
}

/**
 * Upload album metadata to S3
 */
function uploadAlbumToS3(album) {
  const albumData = {
    id: album.id,
    name: album.name,
    created: album.created,
    modified: album.modified,
    photoCount: album.photos.length,
    photos: album.photos.map(photo => ({
      id: photo.id,
      name: photo.name,
      // Use S3 URLs if available, otherwise Drive URLs
      thumbnailUrl: photo.smallS3Url || photo.thumbnailUrl,
      mediumUrl: photo.mediumS3Url || photo.mediumUrl,
      largeUrl: photo.largeS3Url || photo.largeUrl,
      originalUrl: photo.originalS3Url || photo.originalUrl,
      created: photo.created,
      // Include S3 status
      s3Processed: !!(photo.smallS3Url && photo.mediumS3Url && photo.largeS3Url),
      // Include URL structure for incremental sync
      urls: {
        small: photo.smallS3Url || null,
        medium: photo.mediumS3Url || null,
        large: photo.largeS3Url || null,
        original: photo.originalS3Url || null
      }
    }))
  };

  const albumJson = JSON.stringify(albumData, null, 2);
  const s3Key = `gallery/albums/${album.id}.json`;

  uploadToS3(s3Key, albumJson, 'application/json', true);
  Logger.log(`✓ Uploaded album metadata: ${s3Key}`);
}

/**
 * Upload gallery manifest (main albums list)
 */
function uploadGalleryManifest(albums) {
  const manifest = {
    albums: albums.map(album => ({
      id: album.id,
      name: album.name,
      created: album.created,
      modified: album.modified,
      photoCount: album.photos ? album.photos.length : 0,
      coverPhoto: album.photos && album.photos.length > 0 ? {
        thumbnailUrl: album.photos[0].smallS3Url || album.photos[0].thumbnailUrl,
        mediumUrl: album.photos[0].mediumS3Url || album.photos[0].mediumUrl
      } : null
    })),
    totalAlbums: albums.length,
    totalPhotos: getTotalPhotoCount(albums),
    lastUpdated: new Date().toISOString()
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  uploadToS3('gallery/albums.json', manifestJson, 'application/json', true);

  Logger.log(`✓ Uploaded gallery manifest with ${manifest.totalAlbums} albums, ${manifest.totalPhotos} photos`);

  // Update version.json with gallery timestamp (fixes monitoring showing gallery as "never synced")
  updateVersionFile('gallery');
}

/**
 * Save sync state to Script Properties
 */
function saveGalleryState(props, state) {
  props.setProperty('gallerySyncState', JSON.stringify(state));
  props.setProperty('galleryLastSync', new Date().toISOString());
}

/**
 * Get total photo count across all albums
 */
function getTotalPhotoCount(albums) {
  return albums.reduce((total, album) => {
    return total + (album.photos ? album.photos.length : 0);
  }, 0);
}