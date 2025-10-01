/**
 * Trigger Setup for MTÜ Kaiu Kodukant
 * Functions to create time-based triggers
 */

/**
 * Setup calendar sync trigger (every 5 minutes)
 */
function setupCalendarTrigger() {
  // Delete existing calendar triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncCalendar') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger: every 5 minutes
  ScriptApp.newTrigger('syncCalendar')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('✓ Calendar sync trigger created (every 5 minutes)');
}

/**
 * Setup gallery sync trigger
 * Option 1: Time-based (every 15 minutes)
 * Option 2: Change-based (when files added to Drive)
 */
function setupGalleryTrigger(useChangeTrigger = false) {
  // Delete existing gallery triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncGallery' ||
        trigger.getHandlerFunction() === 'syncGalleryIncremental' ||
        trigger.getHandlerFunction() === 'checkForGalleryChanges') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  if (useChangeTrigger) {
    // Use change-based trigger (recommended)
    // Creates a trigger that checks for changes every 10 minutes
    // Only syncs if changes are detected (requires drive-change-trigger.gs)
    ScriptApp.newTrigger('checkForGalleryChanges')
      .timeBased()
      .everyMinutes(10)
      .create();
    Logger.log('✓ Gallery change detection trigger created (checks every 10 minutes)');
  } else {
    // Use time-based trigger (simple but may sync unnecessarily)
    ScriptApp.newTrigger('syncGalleryIncremental')
      .timeBased()
      .everyMinutes(15)
      .create();
    Logger.log('✓ Gallery time-based trigger created (every 15 minutes)');
  }
}

/**
 * List all current triggers
 */
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  Logger.log(`Found ${triggers.length} triggers:`);

  triggers.forEach(trigger => {
    const handlerFunction = trigger.getHandlerFunction();
    const eventType = trigger.getEventType();

    Logger.log(`- ${handlerFunction} (${eventType})`);
  });

  return triggers;
}
