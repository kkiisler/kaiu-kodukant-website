/**
 * Drive Change Detection for Gallery Sync
 * Triggers gallery sync when new content is added to Google Drive
 */

/**
 * Setup change-based trigger for gallery
 * Uses polling to detect changes (since folder triggers aren't supported)
 */
function setupDriveChangeTrigger() {
  // Remove existing gallery time triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncGalleryIncremental' ||
        trigger.getHandlerFunction() === 'syncGallery') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`Removed time-based trigger: ${trigger.getHandlerFunction()}`);
    }
  });

  // Google Apps Script doesn't support folder change triggers
  // Use polling-based change detection instead
  setupPollingTrigger();
}

/**
 * Alternative: Polling-based change detection
 * Checks for changes every 10 minutes but only syncs if changes detected
 */
function setupPollingTrigger() {
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkForGalleryChanges') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new polling trigger (every 10 minutes)
  ScriptApp.newTrigger('checkForGalleryChanges')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('✓ Polling trigger created (checks every 10 minutes for changes)');
}

/**
 * Check for changes in gallery folder
 * Only triggers sync if changes are detected
 */
function checkForGalleryChanges() {
  const props = PropertiesService.getScriptProperties();
  const lastCheckKey = 'lastGalleryChangeCheck';
  const lastSyncKey = 'lastGallerySync';

  // Get last check time
  const lastCheck = props.getProperty(lastCheckKey);
  const lastCheckTime = lastCheck ? new Date(lastCheck) : new Date(0);

  // Set current check time
  const currentTime = new Date();
  props.setProperty(lastCheckKey, currentTime.toISOString());

  Logger.log(`Checking for gallery changes since ${lastCheckTime.toISOString()}`);

  // Check for changes in gallery folder
  const changes = detectGalleryChanges(lastCheckTime);

  if (changes.hasChanges) {
    Logger.log(`✓ Detected ${changes.newFiles} new files, ${changes.modifiedFiles} modified files`);
    Logger.log(`  Changed albums: ${changes.changedAlbums.join(', ')}`);

    // Store change metadata for the sync
    props.setProperty('pendingGalleryChanges', JSON.stringify(changes));

    // Trigger incremental sync
    Logger.log('Triggering gallery sync due to detected changes...');
    syncGalleryIncrementalWithChanges(changes);

    // Update version timestamp after successful sync
    updateVersionFile('gallery');
  } else {
    Logger.log('No changes detected in gallery folder');

    // Still update the version timestamp to show gallery check is running
    // This prevents monitoring from showing gallery as "failed" when there are no changes
    updateVersionFile('gallery');
  }
}

/**
 * Detect changes in gallery folder and subfolders
 */
function detectGalleryChanges(sinceTime) {
  const folderId = GALLERY_CONFIG.folderId;
  const folder = DriveApp.getFolderById(folderId);

  let newFiles = 0;
  let modifiedFiles = 0;
  const changedAlbums = [];
  const changedAlbumIds = new Set();

  // Check all album folders
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const albumFolder = folders.next();
    let albumHasChanges = false;

    // Check if album folder itself was modified
    if (albumFolder.getLastUpdated() > sinceTime) {
      albumHasChanges = true;
    }

    // Check files in album
    const files = albumFolder.getFiles();
    while (files.hasNext()) {
      const file = files.next();

      // Only check image files
      if (file.getMimeType().startsWith('image/')) {
        const created = file.getDateCreated();
        const modified = file.getLastUpdated();

        if (created > sinceTime) {
          newFiles++;
          albumHasChanges = true;
        } else if (modified > sinceTime) {
          modifiedFiles++;
          albumHasChanges = true;
        }
      }
    }

    if (albumHasChanges) {
      changedAlbums.push(albumFolder.getName());
      changedAlbumIds.add(albumFolder.getId());
    }
  }

  return {
    hasChanges: newFiles > 0 || modifiedFiles > 0,
    newFiles: newFiles,
    modifiedFiles: modifiedFiles,
    changedAlbums: changedAlbums,
    changedAlbumIds: Array.from(changedAlbumIds),
    checkedAt: new Date().toISOString()
  };
}

/**
 * Enhanced incremental sync that prioritizes changed albums
 */
function syncGalleryIncrementalWithChanges(changes) {
  if (!changes || !changes.changedAlbumIds || changes.changedAlbumIds.length === 0) {
    // No specific changes, run normal incremental sync
    return syncGalleryIncremental();
  }

  Logger.log(`=== Starting targeted sync for ${changes.changedAlbumIds.length} changed albums ===`);

  const props = PropertiesService.getScriptProperties();

  try {
    // Process only the changed albums first
    changes.changedAlbumIds.forEach(albumId => {
      Logger.log(`Processing changed album: ${albumId}`);

      // Clear S3 cache for this album to force re-check
      const stateJson = props.getProperty('gallerySyncState');
      if (stateJson) {
        const syncState = JSON.parse(stateJson);
        if (syncState.albums) {
          const album = syncState.albums.find(a => a.id === albumId);
          if (album) {
            delete album.s3Data; // Clear cached S3 data
            delete album.photos; // Clear cached photos
          }
          props.setProperty('gallerySyncState', JSON.stringify(syncState));
        }
      }
    });

    // Run incremental sync (will now re-check the changed albums)
    return syncGalleryIncremental();

  } catch (error) {
    Logger.log(`Error in targeted sync: ${error.message}`);
    // Fall back to regular sync
    return syncGalleryIncremental();
  }
}

// Note: Direct folder change triggers are not supported in Google Apps Script
// The onGalleryFolderChange function has been removed as it cannot be triggered
// Use checkForGalleryChanges with time-based polling instead

/**
 * Manual test function for change detection
 */
function testChangeDetection() {
  // Check for changes in last 24 hours
  const sinceTime = new Date();
  sinceTime.setHours(sinceTime.getHours() - 24);

  const changes = detectGalleryChanges(sinceTime);

  Logger.log('Change detection test results:');
  Logger.log(`  Has changes: ${changes.hasChanges}`);
  Logger.log(`  New files: ${changes.newFiles}`);
  Logger.log(`  Modified files: ${changes.modifiedFiles}`);
  Logger.log(`  Changed albums: ${changes.changedAlbums.join(', ')}`);

  return changes;
}

/**
 * Setup function to switch from time-based to change-based triggers
 */
function switchToChangeTrigger() {
  // Use polling-based change detection (folder triggers not supported)
  setupDriveChangeTrigger();
  Logger.log('✓ Switched to change-based sync (polls every 10 minutes)');
}

/**
 * Get sync statistics
 */
function getGallerySyncStats() {
  const props = PropertiesService.getScriptProperties();

  return {
    lastCheck: props.getProperty('lastGalleryChangeCheck') || 'Never',
    lastSync: props.getProperty('lastGallerySync') || 'Never',
    pendingChanges: props.getProperty('pendingGalleryChanges') || 'None',
    syncState: props.getProperty('gallerySyncState') ? 'In Progress' : 'Idle'
  };
}