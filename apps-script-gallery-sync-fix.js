/**
 * FIX FOR GALLERY SYNC TIMESTAMP IN APPS SCRIPT
 *
 * Add this to your Google Apps Script to properly update gallery sync timestamp
 * This should be added to the checkForGalleryChanges function
 */

/**
 * Update version.json after gallery sync
 * Call this function after successful gallery sync
 */
function updateGalleryVersionInS3() {
  try {
    // First, fetch current version.json
    const versionUrl = `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/metadata/version.json`;

    let currentVersion = {};
    try {
      const response = UrlFetchApp.fetch(versionUrl, {
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 200) {
        currentVersion = JSON.parse(response.getContentText());
      }
    } catch (e) {
      console.log('Version file does not exist yet, creating new one');
    }

    // Update with new gallery timestamp
    const now = Date.now();
    const updatedVersion = {
      ...currentVersion,
      gallery: now,  // Use timestamp instead of 1
      lastUpdated: new Date(now).toISOString()
    };

    // Upload updated version.json to S3
    const result = s3PutObjectV4({
      endpoint: S3_CONFIG.endpoint,
      region: S3_CONFIG.region,
      bucket: S3_CONFIG.bucket,
      key: 'metadata/version.json',
      body: JSON.stringify(updatedVersion, null, 2),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });

    console.log('✅ Gallery version updated in S3:', now);
    return result;

  } catch (error) {
    console.error('❌ Failed to update gallery version:', error);
    throw error;
  }
}

/**
 * Modified checkForGalleryChanges function
 * This is the main function that runs on a timer
 */
function checkForGalleryChanges() {
  const startTime = Date.now();

  try {
    console.log('🔄 Starting gallery sync check...');

    // Your existing gallery sync logic here
    // ... (fetch folders, process albums, etc.)

    // After successful gallery sync, update the version
    const albums = syncGalleryToS3(); // Your existing sync function

    if (albums) {
      // Update version.json with current timestamp
      updateGalleryVersionInS3();

      // Optional: Log sync details
      const syncLog = {
        timestamp: new Date().toISOString(),
        status: 'success',
        albumsCount: albums.length || 0,
        photosCount: albums.reduce((sum, album) => sum + (album.photos?.length || 0), 0),
        duration: Date.now() - startTime,
        source: 'apps-script'
      };

      // Optional: Save sync log to S3
      saveSyncLogToS3('gallery', syncLog);

      console.log(`✅ Gallery sync completed: ${albums.length} albums synced`);
    }

  } catch (error) {
    console.error('❌ Gallery sync failed:', error);

    // Still update version with error status
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.toString(),
        duration: Date.now() - startTime,
        source: 'apps-script'
      };
      saveSyncLogToS3('gallery', errorLog);
    } catch (e) {
      console.error('Failed to save error log:', e);
    }

    throw error;
  }
}

/**
 * Optional: Save detailed sync logs to S3 for monitoring
 */
function saveSyncLogToS3(type, logEntry) {
  try {
    const date = new Date().toISOString().split('T')[0];
    const logKey = `logs/${type}-sync-${date}.json`;

    // Fetch existing logs for today
    let logs = [];
    try {
      const response = UrlFetchApp.fetch(
        `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/${logKey}`,
        { muteHttpExceptions: true }
      );

      if (response.getResponseCode() === 200) {
        logs = JSON.parse(response.getContentText());
        if (!Array.isArray(logs)) logs = [logs];
      }
    } catch (e) {
      // Log file doesn't exist yet
    }

    // Add new log entry
    logs.push(logEntry);

    // Keep only last 100 entries for the day
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }

    // Upload updated logs
    s3PutObjectV4({
      endpoint: S3_CONFIG.endpoint,
      region: S3_CONFIG.region,
      bucket: S3_CONFIG.bucket,
      key: logKey,
      body: JSON.stringify(logs, null, 2),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });

    console.log(`📝 Sync log saved to S3: ${logKey}`);

  } catch (error) {
    console.error('Failed to save sync log:', error);
    // Don't throw - this is optional functionality
  }
}

/**
 * Example of complete gallery sync function with timestamp update
 */
function syncGalleryToS3() {
  try {
    // Your existing gallery sync logic
    const albums = getGalleryAlbums(); // Your function to get albums

    if (!albums || albums.length === 0) {
      console.log('No albums to sync');
      return [];
    }

    // Upload albums.json
    const albumsJson = JSON.stringify(albums, null, 2);
    s3PutObjectV4({
      endpoint: S3_CONFIG.endpoint,
      region: S3_CONFIG.region,
      bucket: S3_CONFIG.bucket,
      key: 'gallery/albums.json',
      body: albumsJson,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900'
      }
    });

    console.log(`✅ Uploaded ${albums.length} albums to S3`);

    // Return albums for logging
    return albums;

  } catch (error) {
    console.error('Gallery sync failed:', error);
    throw error;
  }
}

/**
 * Manual trigger to fix the current gallery timestamp
 * Run this once to fix the existing issue
 */
function fixGalleryTimestamp() {
  try {
    console.log('🔧 Fixing gallery timestamp...');

    // Fetch current version
    const versionUrl = `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/metadata/version.json`;
    const response = UrlFetchApp.fetch(versionUrl);
    const currentVersion = JSON.parse(response.getContentText());

    console.log('Current version:', currentVersion);

    // Update with proper timestamp
    const now = Date.now();
    const fixedVersion = {
      calendar: currentVersion.calendar || now,
      gallery: now, // Fix the gallery timestamp
      lastUpdated: new Date(now).toISOString()
    };

    // Upload fixed version
    s3PutObjectV4({
      endpoint: S3_CONFIG.endpoint,
      region: S3_CONFIG.region,
      bucket: S3_CONFIG.bucket,
      key: 'metadata/version.json',
      body: JSON.stringify(fixedVersion, null, 2),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });

    console.log('✅ Gallery timestamp fixed:', fixedVersion);
    return fixedVersion;

  } catch (error) {
    console.error('❌ Failed to fix gallery timestamp:', error);
    throw error;
  }
}