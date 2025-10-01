/**
 * Incremental Gallery Sync Functions
 * Handles detecting and syncing only changes
 */

/**
 * Check if album needs syncing by comparing with S3 metadata
 */
function albumNeedsSync(album) {
  try {
    // Try to fetch existing album metadata from S3
    const s3Key = `gallery/albums/${album.id}.json`;
    const url = `https://s3.pilw.io/kaiugalerii/${s3Key}`;

    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const existingData = JSON.parse(response.getContentText());

      // Compare modified dates
      const s3Modified = new Date(existingData.modified);
      const driveModified = new Date(album.modified);

      if (driveModified > s3Modified) {
        Logger.log(`Album ${album.name} has been modified - needs sync`);
        return true;
      }

      // Check if photo count changed
      if (existingData.photoCount !== album.photos?.length) {
        Logger.log(`Album ${album.name} photo count changed - needs sync`);
        return true;
      }

      Logger.log(`Album ${album.name} is up to date - skipping`);
      return false;
    }
  } catch (error) {
    // Album doesn't exist in S3, needs sync
    Logger.log(`Album ${album.name} not in S3 - needs sync`);
    return true;
  }

  return true; // Default to sync if unsure
}

/**
 * Get list of photos that need syncing
 * Compares with existing S3 album data
 */
function getPhotosNeedingSync(album) {
  try {
    // Fetch existing album data from S3
    const s3Key = `gallery/albums/${album.id}.json`;
    const url = `https://s3.pilw.io/kaiugalerii/${s3Key}`;

    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const existingData = JSON.parse(response.getContentText());
      const existingPhotoIds = new Set(existingData.photos.map(p => p.id));
      const s3ProcessedIds = new Set(
        existingData.photos.filter(p => p.s3Processed).map(p => p.id)
      );

      // Get current photos
      const currentPhotos = album.photos || getAlbumPhotos(album.id);

      // Identify photos that need processing
      const photosToProcess = currentPhotos.map(photo => {
        if (s3ProcessedIds.has(photo.id)) {
          // Photo already processed, add S3 URLs
          Logger.log(`Photo ${photo.name} already processed`);
          photo.smallS3Url = `https://s3.pilw.io/kaiugalerii/images/${photo.id}-300.jpg`;
          photo.mediumS3Url = `https://s3.pilw.io/kaiugalerii/images/${photo.id}-600.jpg`;
          photo.largeS3Url = `https://s3.pilw.io/kaiugalerii/images/${photo.id}-1200.jpg`;
          photo.originalS3Url = `https://s3.pilw.io/kaiugalerii/images/${photo.id}-original.jpg`;
          photo.needsProcessing = false;
        } else {
          // New photo or not processed
          Logger.log(`Photo ${photo.name} needs processing`);
          photo.needsProcessing = true;
        }
        return photo;
      });

      // Count photos needing processing
      const needProcessing = photosToProcess.filter(p => p.needsProcessing).length;
      Logger.log(`${needProcessing} of ${photosToProcess.length} photos need processing`);

      return photosToProcess;
    }
  } catch (error) {
    Logger.log(`Could not fetch existing album data: ${error.message}`);
    // Return all photos as needing processing
    return album.photos || getAlbumPhotos(album.id);
  }

  return album.photos || getAlbumPhotos(album.id);
}

/**
 * Smart gallery sync that only processes changes
 */
function smartGallerySync() {
  const startTime = new Date().getTime();
  const MAX_RUNTIME = 5 * 60 * 1000;
  const BATCH_SIZE = 30;

  Logger.log('=== Starting Smart Gallery Sync ===');

  const props = PropertiesService.getScriptProperties();
  const stateJson = props.getProperty('gallerySyncState');
  const syncState = stateJson ? JSON.parse(stateJson) : {};

  try {
    const albums = syncState.albums || getAllAlbumsFromDrive();
    let albumIndex = syncState.albumIndex || 0;
    let photoIndex = syncState.photoIndex || 0;
    let processedCount = 0;
    let skippedCount = 0;

    while (albumIndex < albums.length && processedCount < BATCH_SIZE) {
      const album = albums[albumIndex];

      // Load photos with sync status if not cached
      if (!album.photos) {
        album.photos = getPhotosNeedingSync(album);
      }

      // Process only photos that need it
      while (photoIndex < album.photos.length && processedCount < BATCH_SIZE) {
        if (new Date().getTime() - startTime > MAX_RUNTIME) {
          saveGalleryState(props, {
            albums: albums,
            albumIndex: albumIndex,
            photoIndex: photoIndex,
            lastRun: new Date().toISOString(),
            status: 'paused',
            processedInRun: processedCount,
            skippedInRun: skippedCount
          });

          Logger.log(`⏸ Timeout approaching. Processed: ${processedCount}, Skipped: ${skippedCount}`);
          return { status: 'paused', processed: processedCount, skipped: skippedCount };
        }

        const photo = album.photos[photoIndex];

        if (photo.needsProcessing && !photo.smallS3Url) {
          try {
            processPhotoToS3(photo, album);
            processedCount++;
          } catch (error) {
            Logger.log(`✗ Failed processing ${photo.name}: ${error.message}`);
          }
        } else {
          skippedCount++;
          if (skippedCount % 10 === 0) {
            Logger.log(`Skipped ${skippedCount} already processed photos`);
          }
        }

        photoIndex++;
      }

      // Album complete
      if (photoIndex >= album.photos.length) {
        Logger.log(`✓ Completed album: ${album.name}`);
        uploadAlbumToS3(album);
        albumIndex++;
        photoIndex = 0;
      }
    }

    // All done
    if (albumIndex >= albums.length) {
      Logger.log(`✅ Smart sync complete! Processed: ${processedCount}, Skipped: ${skippedCount}`);
      props.deleteProperty('gallerySyncState');
      uploadGalleryManifest(albums);
      updateVersionFile('gallery');
      return { status: 'complete', processed: processedCount, skipped: skippedCount };
    } else {
      // Save state for resume
      saveGalleryState(props, {
        albums: albums,
        albumIndex: albumIndex,
        photoIndex: photoIndex,
        lastRun: new Date().toISOString(),
        status: 'partial',
        processedInRun: processedCount,
        skippedInRun: skippedCount
      });

      Logger.log(`📊 Partial sync. Processed: ${processedCount}, Skipped: ${skippedCount}`);
      return { status: 'partial', processed: processedCount, skipped: skippedCount };
    }

  } catch (error) {
    Logger.log(`✗ Smart sync error: ${error.message}`);
    throw error;
  }
}

/**
 * Quick sync - only checks for new albums or photos
 */
function quickGalleryCheck() {
  try {
    // Get current manifest from S3
    const manifestUrl = 'https://s3.pilw.io/kaiugalerii/gallery/albums.json';
    const response = UrlFetchApp.fetch(manifestUrl, {
      method: 'GET',
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const s3Manifest = JSON.parse(response.getContentText());
      const s3AlbumIds = new Set(s3Manifest.albums.map(a => a.id));

      // Get current albums from Drive
      const driveAlbums = getAllAlbumsFromDrive();

      // Check for new albums
      const newAlbums = driveAlbums.filter(album => !s3AlbumIds.has(album.id));

      if (newAlbums.length > 0) {
        Logger.log(`Found ${newAlbums.length} new albums to sync`);
        return { needsSync: true, newAlbums: newAlbums.length };
      }

      // Check for modified albums
      let modifiedCount = 0;
      for (const album of driveAlbums) {
        const s3Album = s3Manifest.albums.find(a => a.id === album.id);
        if (s3Album) {
          const s3Date = new Date(s3Album.modified);
          const driveDate = new Date(album.modified);
          if (driveDate > s3Date) {
            modifiedCount++;
          }
        }
      }

      if (modifiedCount > 0) {
        Logger.log(`Found ${modifiedCount} modified albums to sync`);
        return { needsSync: true, modifiedAlbums: modifiedCount };
      }

      Logger.log('Gallery is up to date');
      return { needsSync: false };
    }
  } catch (error) {
    Logger.log(`Could not check gallery status: ${error.message}`);
    return { needsSync: true, error: error.message };
  }

  return { needsSync: true };
}