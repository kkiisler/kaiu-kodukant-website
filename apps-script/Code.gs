/**
 * MTÜ Kaiu Kodukant - Apps Script Entry Points
 * Main functions that can be called manually or by triggers
 */

/**
 * Manual sync functions
 * These can be run from the Apps Script editor for testing
 */

function runCalendarSync() {
  return manualSyncCalendar();
}

function runGallerySync() {
  // Use the new incremental sync
  return manualIncrementalSync();
}

function runCheckGalleryStatus() {
  // Use the debug function from incremental sync
  return debugSyncState();
}

function runResetGallerySync() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('gallerySyncState');
  Logger.log('Gallery sync state cleared - will start fresh on next run');
  return 'Gallery sync reset';
}

function runTestS3Connection() {
  return testS3Connection();
}

function runVerifyConfiguration() {
  return verifyConfiguration();
}

function runViewSyncStatus() {
  return viewCalendarSyncStatus();
}

/**
 * Test the S3 album data loading
 */
function runTestS3AlbumLoad() {
  return testLoadS3Album();
}

/**
 * Setup function - run this once to create triggers
 * @param {boolean} useChangeTrigger - If true, uses change detection instead of time-based sync
 */
function setupTriggers(useChangeTrigger = false) {
  setupCalendarTrigger();
  setupGalleryTrigger(useChangeTrigger);
  Logger.log('✓ All triggers set up successfully');
}

/**
 * Switch to change-based gallery sync
 * Recommended for better efficiency
 */
function switchToChangeBasedSync() {
  switchToChangeTrigger();
  return 'Switched to change-based sync';
}

/**
 * Test change detection
 */
function runTestChangeDetection() {
  return testChangeDetection();
}

/**
 * Remove all triggers
 * Use this if you need to clean up or reconfigure
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  Logger.log(`Removed ${triggers.length} triggers`);
}

/**
 * View current system status
 */
function viewSystemStatus() {
  Logger.log('=== SYSTEM STATUS ===');

  // Check configuration
  try {
    verifyConfiguration();
  } catch (e) {
    Logger.log(`✗ Configuration error: ${e.message}`);
  }

  // Check calendar sync
  const calendarStatus = viewCalendarSyncStatus();
  Logger.log(`Calendar: ${calendarStatus.status || 'Unknown'}`);

  // Check gallery sync
  debugSyncState();

  // Check triggers
  const triggers = listTriggers();

  return {
    configuration: 'OK',
    calendarSync: calendarStatus,
    triggers: triggers.length
  };
}