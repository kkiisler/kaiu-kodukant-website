/**
 * Gallery Sync to S3 with Resumable Batch Processing
 * Handles 200+ photos without timeout using state management
 */

/**
 * Main gallery sync function with batch processing
 * Called by 15-minute trigger
 */
function syncGallery() {
  const startTime = new Date().getTime();
  const MAX_RUNTIME = 5 * 60 * 1000; // 5 minutes (1 min safety buffer)
  const BATCH_SIZE = 30; // Optimized to 30 images per run (~3.5 minutes)

  Logger.log('=== Starting Gallery Sync ===');

  // Load or initialize sync state
  const props = PropertiesService.getScriptProperties();
  const stateJson = props.getProperty('gallerySyncState');
  const syncState = stateJson ? JSON.parse(stateJson) : {};

  try {
    // Get all albums (or resume from saved state)
    const albums = syncState.albums || getAllAlbumsFromDrive();
    let albumIndex = syncState.albumIndex || 0;
    let photoIndex = syncState.photoIndex || 0;
    let processedCount = 0;

    Logger.log(`Resuming from: Album ${albumIndex}/${albums.length}, Photo ${photoIndex}`);

    // Process photos in batches
    while (albumIndex < albums.length && processedCount < BATCH_SIZE) {
      const album = albums[albumIndex];

      // Get photos for current album (or use cached)
      if (!album.photos) {
        album.photos = getAlbumPhotos(album.id);
        Logger.log(`Loaded ${album.photos.length} photos from album: ${album.name}`);
      }

      while (photoIndex < album.photos.length && processedCount < BATCH_SIZE) {
        // Check if approaching time limit
        if (new Date().getTime() - startTime > MAX_RUNTIME) {
          // Save state and exit gracefully
          saveGalleryState(props, {
            albums: albums,
            albumIndex: albumIndex,
            photoIndex: photoIndex,
            lastRun: new Date().toISOString(),
            status: 'paused',
            processedInRun: processedCount
          });

          Logger.log(`⏸ Approaching timeout. Processed ${processedCount} photos. Will resume at Album ${albumIndex}, Photo ${photoIndex}`);
          return { status: 'paused', processed: processedCount };
        }

        // Process one photo with actual S3 upload
        const photo = album.photos[photoIndex];
        try {
          // Check if already processed (has S3 URLs)
          if (!photo.smallS3Url) {
            // Check if image already exists in S3
            const testKey = `images/${photo.id}-300.jpg`;
            if (imageExistsInS3(testKey)) {
              // Image already in S3, just update URLs
              Logger.log(`⏭ Skipping ${photo.name} - already in S3`);
              photo.smallS3Url = `https://s3.pilw.io/kaiugalerii/images/${photo.id}-300.jpg`;
              photo.mediumS3Url = `https://s3.pilw.io/kaiugalerii/images/${photo.id}-600.jpg`;
              photo.largeS3Url = `https://s3.pilw.io/kaiugalerii/images/${photo.id}-1200.jpg`;
              photo.originalS3Url = `https://s3.pilw.io/kaiugalerii/images/${photo.id}-original.jpg`;
            } else {
              // Process and upload photo to S3
              processPhotoToS3(photo, album);
            }
          }
          processedCount++;

          if (processedCount % 5 === 0) {
            Logger.log(`Progress: ${processedCount} photos processed in this run`);
          }
        } catch (error) {
          Logger.log(`✗ Failed photo ${photoIndex} in ${album.name}: ${error.message}`);
        }

        photoIndex++;
      }

      // Album complete, upload its metadata
      if (photoIndex >= album.photos.length) {
        Logger.log(`✓ Completed album: ${album.name} (${album.photos.length} photos)`);
        uploadAlbumToS3(album);
        albumIndex++;
        photoIndex = 0;
      }
    }

    // All albums processed - sync complete!
    if (albumIndex >= albums.length) {
      Logger.log(`✅ FULL SYNC COMPLETE! Processed ${processedCount} photos in final run`);

      // Clear state
      props.deleteProperty('gallerySyncState');

      // Upload gallery manifest
      uploadGalleryManifest(albums);
      updateVersionFile('gallery');

      // Log success
      logSyncAttempt('gallery', true, `Complete sync - ${getTotalPhotoCount(albums)} photos`);
      resetFailureCount('gallery');

      return { status: 'complete', processed: processedCount };
    } else {
      // Partial sync - save state
      saveGalleryState(props, {
        albums: albums,
        albumIndex: albumIndex,
        photoIndex: photoIndex,
        lastRun: new Date().toISOString(),
        status: 'partial',
        processedInRun: processedCount
      });

      Logger.log(`📊 Partial sync: ${processedCount} photos. Next: Album ${albumIndex}`);
      return { status: 'partial', processed: processedCount };
    }

  } catch (error) {
    Logger.log(`✗ Gallery sync error: ${error.message}`);
    logSyncAttempt('gallery', false, error.message);
    trackFailure('gallery', error.message);
    throw error;
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
 * Process photo metadata (without image generation for now)
 */
function processPhotoMetadata(photo, album) {
  // In Phase 2, we're storing metadata only
  // Actual image processing would happen here in production

  // For now, just ensure the photo object has all required fields
  if (!photo.processedAt) {
    photo.processedAt = new Date().toISOString();
    photo.albumId = album.id;
    photo.albumName = album.name;
  }

  return photo;
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
      s3Processed: !!(photo.smallS3Url && photo.mediumS3Url && photo.largeS3Url)
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

/**
 * Force restart gallery sync from beginning
 */
function resetGallerySync() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('gallerySyncState');
  Logger.log('Gallery sync state cleared - will start fresh on next run');
}

/**
 * Manual trigger for gallery sync
 */
function manualSyncGallery() {
  Logger.log('Manual gallery sync triggered');
  return syncGallery();
}

/**
 * Check gallery sync status
 */
function checkGallerySyncStatus() {
  const props = PropertiesService.getScriptProperties();
  const state = props.getProperty('gallerySyncState');

  if (state) {
    const syncState = JSON.parse(state);
    Logger.log('Gallery sync in progress:');
    Logger.log(`  Album: ${syncState.albumIndex} / ${syncState.albums.length}`);
    Logger.log(`  Photo: ${syncState.photoIndex}`);
    Logger.log(`  Last run: ${syncState.lastRun}`);
    Logger.log(`  Status: ${syncState.status}`);
    return syncState;
  } else {
    Logger.log('No gallery sync in progress');
    return null;
  }
}