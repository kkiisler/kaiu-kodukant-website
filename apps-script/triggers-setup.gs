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
 * Setup gallery sync trigger (every 15 minutes)
 * This is for Phase 2 - Gallery Migration
 */
function setupGalleryTrigger() {
  // Delete existing gallery triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncGallery') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger: every 15 minutes
  ScriptApp.newTrigger('syncGallery')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('✓ Gallery sync trigger created (every 15 minutes)');
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
