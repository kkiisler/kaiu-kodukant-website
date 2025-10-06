/**
 * Calendar Sync to S3
 * Fetches events from Google Calendar and uploads to S3 as JSON
 */

/**
 * Main calendar sync function
 * Called by time-based trigger (every 5 minutes)
 */
function syncCalendar() {
  Logger.log('=== Starting Calendar Sync ===');

  try {
    // Verify configuration
    verifyConfiguration();

    // Fetch events from Google Calendar
    const events = getCalendarEvents();
    Logger.log(`Fetched ${events.length} events from calendar`);

    // Format for FullCalendar.js
    const formattedEvents = formatEventsForFullCalendar(events);

    // Convert to JSON
    const eventsJson = JSON.stringify({
      events: formattedEvents,
      lastUpdated: new Date().toISOString(),
      count: formattedEvents.length
    }, null, 2);

    // Upload to S3
    uploadToS3('calendar/events.json', eventsJson, 'application/json', true);

    // Update version file for cache busting
    updateVersionFile('calendar');

    // Log success
    logSyncAttempt('calendar', true, `Synced ${formattedEvents.length} events`);

    // Reset failure counter
    resetFailureCount('calendar');

    Logger.log('✓ Calendar sync complete');
    return { success: true, count: formattedEvents.length };

  } catch (error) {
    Logger.log(`✗ Calendar sync failed: ${error.message}`);
    logSyncAttempt('calendar', false, error.message);
    trackFailure('calendar', error.message);
    throw error;
  }
}

/**
 * Fetch events from Google Calendar
 *
 * @returns {array} Array of calendar events
 */
function getCalendarEvents() {
  const calendarId = CALENDAR_CONFIG.calendarId;

  // Calculate time range
  const now = new Date();
  const startDate = new Date(now);
  startDate.setMonth(now.getMonth() - CALENDAR_CONFIG.monthsBack);

  const endDate = new Date(now);
  endDate.setMonth(now.getMonth() + CALENDAR_CONFIG.monthsForward);

  // Try Advanced Calendar Service first (if available)
  try {
    if (typeof Calendar !== 'undefined') {
      Logger.log('Using Advanced Calendar Service...');
      const events = Calendar.Events.list(calendarId, {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 500
      });

      return events.items || [];
    }
  } catch (error) {
    Logger.log(`Advanced Calendar Service error: ${error.message}`);
    Logger.log('Falling back to built-in CalendarApp...');
  }

  // Fallback to built-in CalendarApp service
  try {
    const calendar = CalendarApp.getCalendarById(calendarId);

    if (!calendar) {
      Logger.log(`Calendar not found with ID: ${calendarId}`);
      Logger.log('Make sure the calendar is shared with the Apps Script service account');
      return [];
    }

    Logger.log(`Using built-in CalendarApp for calendar: ${calendar.getName()}`);
    const events = calendar.getEvents(startDate, endDate);

    // Convert CalendarApp events to match Advanced Service format
    return events.map(event => ({
      id: event.getId(),
      summary: event.getTitle(),
      description: event.getDescription(),
      location: event.getLocation(),
      start: event.isAllDayEvent() ?
        { date: Utilities.formatDate(event.getStartTime(), 'UTC', 'yyyy-MM-dd') } :
        { dateTime: event.getStartTime().toISOString() },
      end: event.isAllDayEvent() ?
        { date: Utilities.formatDate(event.getEndTime(), 'UTC', 'yyyy-MM-dd') } :
        { dateTime: event.getEndTime().toISOString() },
      status: 'confirmed'
    }));

  } catch (error) {
    Logger.log(`CalendarApp error: ${error.message}`);
    return [];
  }
}

/**
 * Format events for FullCalendar.js
 *
 * @param {array} events - Raw calendar events
 * @returns {array} Formatted events
 */
function formatEventsForFullCalendar(events) {
  return events.map(event => {
    // Determine if all-day event
    const isAllDay = !event.start.dateTime;

    // Build formatted event
    const formatted = {
      id: event.id,
      title: event.summary || 'Unnamed Event',
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      allDay: isAllDay
    };

    // Add optional fields
    if (event.description) {
      formatted.description = event.description;
    }

    if (event.location) {
      formatted.location = event.location;
    }

    // Add custom styling based on event type (if needed)
    if (event.colorId) {
      formatted.colorId = event.colorId;
    }

    return formatted;
  });
}

/**
 * Update version file for cache busting
 *
 * @param {string} component - Component name ('calendar' or 'gallery')
 */
function updateVersionFile(component) {
  try {
    // Try to fetch existing version file first
    let versionData = {
      calendar: Date.now(),
      gallery: Date.now(),
      lastUpdated: new Date().toISOString()
    };

    // Try to load existing version data
    try {
      const versionUrl = `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/metadata/version.json`;
      const response = UrlFetchApp.fetch(versionUrl, { muteHttpExceptions: true });

      if (response.getResponseCode() === 200) {
        const existingData = JSON.parse(response.getContentText());
        // Preserve existing timestamps
        versionData.calendar = existingData.calendar || Date.now();
        versionData.gallery = existingData.gallery || Date.now();
      }
    } catch (e) {
      Logger.log('Version file does not exist yet, creating new one');
    }

    // Update timestamp for the specified component
    if (component === 'calendar') {
      versionData.calendar = Date.now();
    } else if (component === 'gallery') {
      versionData.gallery = Date.now();
    }

    versionData.lastUpdated = new Date().toISOString();

    // Upload updated version file
    const versionJson = JSON.stringify(versionData, null, 2);
    uploadToS3('metadata/version.json', versionJson, 'application/json', true);

    Logger.log(`✓ Version file updated: ${component} = ${versionData[component]}`);

  } catch (error) {
    Logger.log(`Warning: Could not update version file: ${error.message}`);
    // Don't throw - version file is nice to have but not critical
  }
}

/**
 * Log sync attempt to Script Properties
 *
 * @param {string} type - 'calendar' or 'gallery'
 * @param {boolean} success - Was sync successful
 * @param {string} details - Additional details
 */
function logSyncAttempt(type, success, details) {
  const props = PropertiesService.getScriptProperties();
  const timestamp = new Date().toISOString();

  // Store last sync time
  props.setProperty(`last${capitalize(type)}Sync`, timestamp);

  if (success) {
    props.setProperty(`last${capitalize(type)}Success`, timestamp);
  }

  // Log to S3 (optional - for detailed monitoring)
  try {
    const dateStr = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
    const logKey = `logs/${type}-sync-${dateStr}.json`;

    const logEntry = {
      timestamp: timestamp,
      success: success,
      details: details
    };

    // Note: In production, you might want to append to existing log
    // For now, we just overwrite with latest entry
    uploadToS3(logKey, JSON.stringify(logEntry, null, 2), 'application/json', false);

  } catch (error) {
    Logger.log(`Warning: Could not write log to S3: ${error.message}`);
  }
}

/**
 * Track failure count for alerting
 *
 * @param {string} type - 'calendar' or 'gallery'
 * @param {string} errorMessage - Error message
 */
function trackFailure(type, errorMessage) {
  const props = PropertiesService.getScriptProperties();
  const key = `${type}FailureCount`;
  const currentCount = parseInt(props.getProperty(key) || '0');
  const newCount = currentCount + 1;

  props.setProperty(key, newCount.toString());
  Logger.log(`Failure count for ${type}: ${newCount}`);

  // Send alert if threshold reached
  if (newCount >= MONITORING_CONFIG.alertAfterFailures) {
    sendAlert(type, newCount, errorMessage);
  }
}

/**
 * Reset failure counter
 *
 * @param {string} type - 'calendar' or 'gallery'
 */
function resetFailureCount(type) {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(`${type}FailureCount`);
}

/**
 * Send email alert
 *
 * @param {string} type - 'calendar' or 'gallery'
 * @param {number} failureCount - Number of consecutive failures
 * @param {string} errorMessage - Error message
 */
function sendAlert(type, failureCount, errorMessage) {
  const email = MONITORING_CONFIG.alertEmail;

  if (!email) {
    Logger.log('No alert email configured');
    return;
  }

  const subject = `⚠️ MTÜ Kaiu Kodukant: ${capitalize(type)} Sync Failing`;
  const body = `
The ${type} sync has failed ${failureCount} times in a row.

Last error: ${errorMessage}

Time: ${new Date().toLocaleString('et-EE')}

Please check the Apps Script logs and S3 configuration.

---
This is an automated alert from MTÜ Kaiu Kodukant website sync system.
`;

  try {
    MailApp.sendEmail(email, subject, body);
    Logger.log(`✓ Alert email sent to ${email}`);
  } catch (error) {
    Logger.log(`✗ Could not send alert email: ${error.message}`);
  }
}

/**
 * Capitalize first letter
 *
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Manual trigger for calendar sync
 * Use this to test sync without waiting for trigger
 */
function manualSyncCalendar() {
  Logger.log('Manual calendar sync triggered');
  return syncCalendar();
}

/**
 * View current sync status
 */
function viewCalendarSyncStatus() {
  const props = PropertiesService.getScriptProperties();

  const status = {
    lastSync: props.getProperty('lastCalendarSync') || 'Never',
    lastSuccess: props.getProperty('lastCalendarSuccess') || 'Never',
    failureCount: props.getProperty('calendarFailureCount') || '0'
  };

  Logger.log('Calendar Sync Status:');
  Logger.log(JSON.stringify(status, null, 2));

  return status;
}
