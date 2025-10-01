/**
 * MTÜ Kaiu Kodukant - Apps Script Entry Points
 * Main functions that can be called manually or by triggers
 */

/**
 * Handle GET requests - Calendar proxy for CORS bypass
 * Deploy this as a Web App to create a proxy endpoint
 */
function doGet(e) {
  // Check for action parameter
  const action = e.parameter.action || 'calendar';

  switch(action) {
    case 'calendar':
      // Proxy calendar events from S3
      return doGetCalendarProxy(e);

    case 'calendar-direct':
      // Get calendar events directly from Google Calendar
      return doGetCalendarDirect(e);

    default:
      return ContentService
        .createTextOutput(JSON.stringify({
          error: 'Invalid action',
          validActions: ['calendar', 'calendar-direct']
        }))
        .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Manual sync functions
 * These can be run from the Apps Script editor for testing
 */

function runCalendarSync() {
  return manualSyncCalendar();
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
