# Gallery Sync Implementation Guide - Resumable Batch Processing

**Critical**: This document details the REQUIRED implementation for handling 200+ photos without timeout
**Last Updated**: 2025-10-01
**Environment**: Google Apps Script (6-minute execution limit)
**Target**: Process 200 photos × 3 sizes = 600 operations

---

## Executive Summary

Google Apps Script has a **hard 6-minute execution limit** for time-based triggers. With 200 photos requiring 3 sizes each (600 operations), a single sync run WILL timeout. This guide provides the **mandatory** resumable batch processing implementation.

**Solution**: Process 50 images per run, save state, auto-resume on next trigger.

---

## Core Implementation

### 1. Main Sync Function with State Management

```javascript
// gallery-sync.gs

/**
 * Main gallery sync function - MUST handle timeouts
 * Called by 15-minute trigger
 */
function syncGallery() {
  const startTime = new Date().getTime();
  const MAX_RUNTIME = 5 * 60 * 1000; // 5 minutes (1 min safety buffer)
  const BATCH_SIZE = 50; // Process max 50 images per run

  // Load or initialize sync state
  const props = PropertiesService.getScriptProperties();
  const syncState = JSON.parse(props.getProperty('syncState') || '{}');

  try {
    // Get all albums (or resume from saved state)
    const albums = syncState.albums || getAllAlbumsFromDrive();
    let albumIndex = syncState.albumIndex || 0;
    let photoIndex = syncState.photoIndex || 0;
    let processedCount = 0;

    console.log(`Starting sync - Album ${albumIndex}, Photo ${photoIndex}`);

    // Process photos in batches
    while (albumIndex < albums.length && processedCount < BATCH_SIZE) {
      const album = albums[albumIndex];
      const photos = album.photos || getAlbumPhotos(album.id);

      while (photoIndex < photos.length && processedCount < BATCH_SIZE) {
        // Check if we're approaching time limit
        if (new Date().getTime() - startTime > MAX_RUNTIME) {
          // Save state and exit gracefully
          saveState(props, {
            albums: albums,
            albumIndex: albumIndex,
            photoIndex: photoIndex,
            lastRun: new Date().toISOString(),
            status: 'paused'
          });

          console.log(`Approaching timeout. Processed ${processedCount} photos. Will resume at Album ${albumIndex}, Photo ${photoIndex}`);
          return; // Exit - will continue on next trigger
        }

        // Process one photo (all 3 sizes)
        try {
          processPhotoToS3(photos[photoIndex], album);
          processedCount++;
        } catch (error) {
          console.error(`Failed to process photo ${photoIndex} in album ${album.title}: ${error}`);
          // Continue with next photo even if one fails
        }

        photoIndex++;
      }

      // Album complete, move to next
      if (photoIndex >= photos.length) {
        console.log(`Completed album ${album.title} (${photos.length} photos)`);
        uploadAlbumMetadata(album); // Upload album JSON to S3
        albumIndex++;
        photoIndex = 0;
      }
    }

    // All albums processed - sync complete!
    if (albumIndex >= albums.length) {
      console.log(`Full sync complete! Processed ${processedCount} photos in this run`);
      props.deleteProperty('syncState'); // Clear state

      // Upload final metadata
      uploadGalleryManifest(albums);
      updateVersionFile('gallery');

      // Reset failure counter on success
      resetFailureCounter('gallery');
    } else {
      // More work to do - save state for next run
      saveState(props, {
        albums: albums,
        albumIndex: albumIndex,
        photoIndex: photoIndex,
        lastRun: new Date().toISOString(),
        status: 'in_progress'
      });

      console.log(`Batch complete. Processed ${processedCount} photos. Will continue next run.`);
    }

  } catch (error) {
    console.error('Fatal sync error:', error);
    trackFailure('gallery', error.toString());

    // Save state even on error so we can resume
    if (syncState.albumIndex !== undefined) {
      saveState(props, syncState);
    }

    throw error;
  }
}

/**
 * Helper to save sync state
 */
function saveState(props, state) {
  props.setProperty('syncState', JSON.stringify(state));
  props.setProperty('lastSyncAttempt', new Date().toISOString());
}

/**
 * Continue an interrupted sync
 * Can be called manually or by trigger
 */
function continueSync() {
  const props = PropertiesService.getScriptProperties();
  const syncState = props.getProperty('syncState');

  if (!syncState) {
    console.log('No sync to continue');
    return;
  }

  const state = JSON.parse(syncState);
  console.log(`Continuing sync from Album ${state.albumIndex}, Photo ${state.photoIndex}`);

  // Call main sync which will resume from saved state
  syncGallery();
}
```

### 2. Photo Processing Function

```javascript
/**
 * Process a single photo to S3 (all sizes)
 * MUST be efficient to maximize photos per run
 */
function processPhotoToS3(photo, album) {
  const sizes = [
    { width: 300, suffix: '300' },
    { width: 600, suffix: '600' },
    { width: 1200, suffix: '1200' }
  ];

  // Use Drive's thumbnail API for resizing
  sizes.forEach(size => {
    try {
      // Get image from Drive at specified size
      const imageBlob = getImageFromDrive(photo.id, size.width);

      // Upload to S3
      const s3Key = `images/${photo.id}-${size.suffix}.jpg`;
      uploadToS3(S3_CONFIG.bucket, s3Key, imageBlob, 'image/jpeg', true);

    } catch (error) {
      console.error(`Failed to process ${photo.name} at ${size.width}px: ${error}`);
      // Don't throw - continue with other sizes
    }
  });

  // Update photo metadata with S3 URLs
  photo.s3Urls = {
    small: `${S3_CONFIG.baseUrl}/images/${photo.id}-300.jpg`,
    medium: `${S3_CONFIG.baseUrl}/images/${photo.id}-600.jpg`,
    large: `${S3_CONFIG.baseUrl}/images/${photo.id}-1200.jpg`
  };
}

/**
 * Get image from Drive at specific size using thumbnail API
 */
function getImageFromDrive(fileId, width) {
  // Use Drive's export API with size parameter
  const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(`Drive API returned ${response.getResponseCode()}`);
    }

    return response.getBlob();

  } catch (error) {
    // Fallback: Try getting original if resize fails
    if (width === 1200) {
      const file = DriveApp.getFileById(fileId);
      return file.getBlob();
    }
    throw error;
  }
}
```

### 3. Album Discovery and Metadata

```javascript
/**
 * Get all albums from Drive
 * Caches result in sync state to avoid re-scanning
 */
function getAllAlbumsFromDrive() {
  const galleryFolder = DriveApp.getFolderById(GALLERY_FOLDER_ID);
  const albumFolders = galleryFolder.getFolders();
  const albums = [];

  while (albumFolders.hasNext()) {
    const folder = albumFolders.next();
    const album = {
      id: folder.getId(),
      title: folder.getName(),
      description: getAlbumDescription(folder),
      lastModified: folder.getLastUpdated(),
      photos: [] // Will be populated later
    };

    // Get photo count (but not full list yet - save memory)
    const photos = folder.getFilesByType(MimeType.JPEG);
    let photoCount = 0;
    while (photos.hasNext()) {
      photos.next();
      photoCount++;
    }
    album.photoCount = photoCount;

    albums.push(album);
  }

  // Sort by date (newest first)
  albums.sort((a, b) => b.lastModified - a.lastModified);

  return albums;
}

/**
 * Get photos for a specific album
 * Only called when processing that album
 */
function getAlbumPhotos(albumId) {
  const folder = DriveApp.getFolderById(albumId);
  const files = folder.getFilesByType(MimeType.JPEG);
  const photos = [];

  while (files.hasNext()) {
    const file = files.next();
    photos.push({
      id: file.getId(),
      name: file.getName(),
      size: file.getSize(),
      mimeType: file.getMimeType(),
      createdDate: file.getDateCreated(),
      modifiedDate: file.getLastUpdated()
    });
  }

  return photos;
}
```

### 4. Monitoring and Status Functions

```javascript
/**
 * Get current sync status
 * Useful for monitoring and debugging
 */
function getSyncStatus() {
  const props = PropertiesService.getScriptProperties();
  const syncState = props.getProperty('syncState');
  const lastAttempt = props.getProperty('lastSyncAttempt');
  const lastSuccess = props.getProperty('lastGallerySuccess');

  if (!syncState) {
    return {
      status: 'idle',
      lastAttempt: lastAttempt,
      lastSuccess: lastSuccess
    };
  }

  const state = JSON.parse(syncState);
  return {
    status: state.status || 'in_progress',
    albumIndex: state.albumIndex,
    photoIndex: state.photoIndex,
    totalAlbums: state.albums ? state.albums.length : 'unknown',
    lastRun: state.lastRun,
    lastAttempt: lastAttempt,
    lastSuccess: lastSuccess
  };
}

/**
 * Force start a fresh sync
 * Clears any existing state
 */
function forceFullSync() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('syncState');
  props.deleteProperty('lastGallerySync');

  console.log('Starting forced full sync...');
  syncGallery();
}

/**
 * Manual function to check and fix stuck syncs
 */
function checkSyncHealth() {
  const status = getSyncStatus();
  console.log('Sync Status:', JSON.stringify(status, null, 2));

  if (status.status === 'in_progress') {
    const lastRun = new Date(status.lastRun);
    const hoursSinceRun = (new Date() - lastRun) / (1000 * 60 * 60);

    if (hoursSinceRun > 1) {
      console.log(`Sync appears stuck (last run ${hoursSinceRun.toFixed(1)} hours ago)`);
      console.log('Run continueSync() to resume or forceFullSync() to restart');
    } else {
      console.log('Sync in progress, waiting for next trigger');
    }
  }

  return status;
}
```

### 5. Trigger Setup

```javascript
/**
 * Setup time-based trigger for gallery sync
 * IMPORTANT: Set to 15 minutes to allow batch processing
 */
function setupGalleryTrigger() {
  // Delete existing gallery triggers
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncGallery') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new 15-minute trigger
  ScriptApp.newTrigger('syncGallery')
    .timeBased()
    .everyMinutes(15)
    .create();

  console.log('Gallery sync trigger created (every 15 minutes)');
}
```

## Testing Strategy

### Initial Sync Test Plan

1. **Small Test First**
   - Create test folder with 5-10 images
   - Run `syncGallery()` manually
   - Verify all images uploaded to S3
   - Check all 3 sizes created

2. **Timeout Simulation**
   - Add 60 images to test folder
   - Set `MAX_RUNTIME` to 30 seconds (for testing)
   - Run sync and verify it saves state
   - Run `continueSync()` and verify it resumes
   - Check final result has all images

3. **Full Gallery Test**
   - Point to actual gallery (200+ photos)
   - Run `syncGallery()` manually
   - Monitor Script Properties for state updates
   - Check logs for progress
   - Expect 4-5 runs to complete
   - Verify all images in S3

### Monitoring During Initial Sync

```javascript
// Run this in Apps Script editor to monitor progress
function monitorSync() {
  const status = getSyncStatus();

  console.log(`Status: ${status.status}`);
  console.log(`Progress: Album ${status.albumIndex}/${status.totalAlbums}`);
  console.log(`Photo: ${status.photoIndex}`);
  console.log(`Last Run: ${status.lastRun}`);

  // Check S3 for uploaded images
  const s3Objects = listS3Objects(S3_CONFIG.bucket, 'images/');
  console.log(`Images in S3: ${s3Objects.length}`);
}
```

## Troubleshooting

### Common Issues

1. **Sync Stuck in Progress**
   ```javascript
   // Check status
   checkSyncHealth();

   // If stuck, force restart
   forceFullSync();
   ```

2. **Specific Album Failing**
   - Check logs for error pattern
   - Manually process album:
   ```javascript
   function debugAlbum(albumId) {
     const folder = DriveApp.getFolderById(albumId);
     const photos = getAlbumPhotos(albumId);
     console.log(`Album: ${folder.getName()}, Photos: ${photos.length}`);

     // Try processing first photo
     if (photos.length > 0) {
       processPhotoToS3(photos[0], {id: albumId, title: folder.getName()});
     }
   }
   ```

3. **Memory Issues**
   - Reduce BATCH_SIZE to 30
   - Clear unnecessary variables
   - Don't load all photos at once

4. **Drive API Rate Limits**
   - Add delays between operations:
   ```javascript
   Utilities.sleep(100); // 100ms delay
   ```
   - Reduce batch size
   - Increase trigger interval to 30 minutes

## Performance Optimization

### Current Performance
- **50 photos per run** @ 6 minutes = ~7 seconds per photo
- **200 photos** = 4 runs = 1 hour total
- **Subsequent syncs** = Only changed albums

### Optimization Tips

1. **Parallel Processing** (Limited in Apps Script)
   ```javascript
   // Can't truly parallelize, but can batch API calls
   const batch = Drive.Files.batch();
   ```

2. **Skip Unchanged Albums**
   ```javascript
   function shouldSyncAlbum(album) {
     const lastSync = props.getProperty(`album_${album.id}_lastSync`);
     if (!lastSync) return true;

     const lastSyncDate = new Date(lastSync);
     return album.lastModified > lastSyncDate;
   }
   ```

3. **Incremental Updates**
   - Track individual photo modifications
   - Only upload changed photos
   - Keep manifest of existing S3 objects

## Critical Success Factors

1. ✅ **State Persistence** - MUST save progress between runs
2. ✅ **Time Management** - MUST check runtime and exit gracefully
3. ✅ **Error Recovery** - MUST continue despite individual failures
4. ✅ **Batch Size** - MUST be small enough to complete in 6 minutes
5. ✅ **Monitoring** - MUST log progress for debugging

## Implementation Checklist

- [ ] Copy gallery-sync.gs to Apps Script
- [ ] Set GALLERY_FOLDER_ID in config
- [ ] Set S3 credentials in Script Properties
- [ ] Test with small album first
- [ ] Simulate timeout scenario
- [ ] Run full sync (expect multiple runs)
- [ ] Verify all images in S3
- [ ] Setup 15-minute trigger
- [ ] Monitor for 24 hours

---

**Remember**: The 6-minute timeout is NON-NEGOTIABLE. This implementation MUST be used for galleries with 50+ photos.