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
  return manualSyncGallery();
}

function runCheckGalleryStatus() {
  return checkGallerySyncStatus();
}

function runResetGallerySync() {
  return resetGallerySync();
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
 * Setup function - run this once to create triggers
 */
function setupTriggers() {
  setupCalendarTrigger();
  setupGalleryTrigger();
  Logger.log('✓ All triggers set up successfully');
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
