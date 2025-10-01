/**
 * Debug Calendar Sync Issues
 * Run these functions to identify why events aren't being fetched
 */

/**
 * Debug function to test calendar access and event fetching
 */
function debugCalendarFetch() {
  Logger.log('=== CALENDAR DEBUG START ===');

  // 1. Check if Calendar service is enabled
  try {
    Logger.log('\n1. Testing Calendar Service availability...');
    const testCal = CalendarApp.getCalendarById('primary');
    Logger.log('✓ CalendarApp is available');
  } catch (e) {
    Logger.log('✗ CalendarApp error: ' + e.message);
  }

  // 2. Check Calendar ID
  const calendarId = CALENDAR_CONFIG.calendarId;
  Logger.log('\n2. Calendar ID: ' + calendarId);

  // 3. Try using CalendarApp (built-in service) instead of Advanced Calendar Service
  try {
    Logger.log('\n3. Testing with CalendarApp (built-in service)...');

    // Get calendar by ID
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      Logger.log('✗ Calendar not found with ID: ' + calendarId);
      Logger.log('   Make sure the calendar is shared with the Apps Script service account');
      return;
    }

    Logger.log('✓ Calendar found: ' + calendar.getName());

    // Get time range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 1); // 1 month back

    const endDate = new Date(now);
    endDate.setMonth(now.getMonth() + 6); // 6 months forward

    Logger.log('\n4. Time range:');
    Logger.log('   From: ' + startDate.toISOString());
    Logger.log('   To: ' + endDate.toISOString());

    // Fetch events
    Logger.log('\n5. Fetching events...');
    const events = calendar.getEvents(startDate, endDate);
    Logger.log('✓ Found ' + events.length + ' events');

    // Show first 3 events
    if (events.length > 0) {
      Logger.log('\n6. Sample events:');
      for (let i = 0; i < Math.min(3, events.length); i++) {
        const event = events[i];
        Logger.log(`   Event ${i+1}: "${event.getTitle()}" on ${event.getStartTime()}`);
      }
    }

    return events.length;

  } catch (error) {
    Logger.log('✗ Error fetching with CalendarApp: ' + error.message);
    Logger.log('Stack: ' + error.stack);
  }

  // 4. Try with Advanced Calendar Service (if enabled)
  try {
    Logger.log('\n7. Testing with Advanced Calendar Service...');

    if (typeof Calendar === 'undefined') {
      Logger.log('✗ Advanced Calendar Service not enabled');
      Logger.log('   To enable: Resources > Advanced Google Services > Calendar API v3');
      return;
    }

    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 1);

    const endDate = new Date(now);
    endDate.setMonth(now.getMonth() + 6);

    const events = Calendar.Events.list(calendarId, {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10
    });

    Logger.log('✓ Advanced Service found ' + (events.items ? events.items.length : 0) + ' events');

    if (events.items && events.items.length > 0) {
      Logger.log('\n8. Sample events from Advanced Service:');
      for (let i = 0; i < Math.min(3, events.items.length); i++) {
        const event = events.items[i];
        Logger.log(`   Event ${i+1}: "${event.summary}" on ${event.start.dateTime || event.start.date}`);
      }
    }

  } catch (error) {
    Logger.log('✗ Advanced Calendar Service error: ' + error.message);
    if (error.message.includes('Calendar is not defined')) {
      Logger.log('   The Advanced Calendar Service needs to be enabled');
      Logger.log('   Go to: Resources > Advanced Google Services > Enable "Calendar API v3"');
    }
  }

  Logger.log('\n=== CALENDAR DEBUG END ===');
}

/**
 * Alternative calendar sync using CalendarApp (built-in service)
 * This doesn't require enabling Advanced Services
 */
function syncCalendarWithBuiltInService() {
  Logger.log('=== Calendar Sync with Built-in Service ===');

  try {
    const calendarId = CALENDAR_CONFIG.calendarId;
    const calendar = CalendarApp.getCalendarById(calendarId);

    if (!calendar) {
      throw new Error('Calendar not found. Check calendar ID and permissions.');
    }

    // Get time range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(now.getMonth() - CALENDAR_CONFIG.monthsBack);

    const endDate = new Date(now);
    endDate.setMonth(now.getMonth() + CALENDAR_CONFIG.monthsForward);

    Logger.log('Fetching events from ' + calendar.getName());
    Logger.log('Date range: ' + startDate.toDateString() + ' to ' + endDate.toDateString());

    // Fetch events
    const events = calendar.getEvents(startDate, endDate);
    Logger.log('Found ' + events.length + ' events');

    // Format for FullCalendar
    const formattedEvents = events.map(event => {
      const isAllDay = event.isAllDayEvent();

      const formatted = {
        id: event.getId(),
        title: event.getTitle(),
        start: isAllDay ?
          Utilities.formatDate(event.getStartTime(), 'UTC', 'yyyy-MM-dd') :
          event.getStartTime().toISOString(),
        allDay: isAllDay
      };

      // Add end date if different from start
      if (isAllDay) {
        const endDate = event.getEndTime();
        endDate.setDate(endDate.getDate() - 1); // All-day events end at midnight next day
        if (endDate.getTime() !== event.getStartTime().getTime()) {
          formatted.end = Utilities.formatDate(endDate, 'UTC', 'yyyy-MM-dd');
        }
      } else if (event.getEndTime().getTime() !== event.getStartTime().getTime()) {
        formatted.end = event.getEndTime().toISOString();
      }

      // Add description if exists
      const description = event.getDescription();
      if (description) {
        formatted.description = description;
      }

      // Add location if exists
      const location = event.getLocation();
      if (location) {
        formatted.location = location;
      }

      // Color based on event status or default
      formatted.color = '#006A93'; // Default color from your theme

      return formatted;
    });

    // Create JSON payload
    const eventsJson = JSON.stringify({
      events: formattedEvents,
      lastUpdated: new Date().toISOString(),
      count: formattedEvents.length
    }, null, 2);

    Logger.log('Formatted ' + formattedEvents.length + ' events for FullCalendar');

    // Upload to S3
    Logger.log('Uploading to S3...');
    uploadToS3('calendar/events.json', eventsJson, 'application/json', true);

    // Update version file
    updateVersionFile('calendar');

    Logger.log('✓ Calendar sync complete with ' + formattedEvents.length + ' events');

    // Save last sync time
    PropertiesService.getScriptProperties().setProperty('calendar_last_sync', new Date().toISOString());

    return {
      success: true,
      eventCount: formattedEvents.length,
      s3Key: 'calendar/events.json',
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    Logger.log('✗ Calendar sync error: ' + error.message);
    throw error;
  }
}

/**
 * Test calendar permissions
 */
function testCalendarPermissions() {
  Logger.log('=== Testing Calendar Permissions ===');

  const calendarId = CALENDAR_CONFIG.calendarId;
  Logger.log('Calendar ID: ' + calendarId);

  try {
    // Method 1: Try to get calendar
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (calendar) {
      Logger.log('✓ Calendar accessible');
      Logger.log('  Name: ' + calendar.getName());
      Logger.log('  Description: ' + calendar.getDescription());
      Logger.log('  Time Zone: ' + calendar.getTimeZone());

      // Check if we can read events
      const testDate = new Date();
      const events = calendar.getEventsForDay(testDate);
      Logger.log('  Can read events: ✓ (' + events.length + ' events today)');

    } else {
      Logger.log('✗ Calendar not accessible');
      Logger.log('  Possible issues:');
      Logger.log('  1. Calendar ID is incorrect');
      Logger.log('  2. Calendar is not shared with the script');
      Logger.log('  3. Calendar permissions are insufficient');
    }

  } catch (error) {
    Logger.log('✗ Error accessing calendar: ' + error.message);
    Logger.log('  This usually means the calendar is not shared with the script');
  }

  // Try to list all accessible calendars
  try {
    Logger.log('\n=== All Accessible Calendars ===');
    const calendars = CalendarApp.getAllCalendars();
    Logger.log('Found ' + calendars.length + ' accessible calendars:');

    calendars.forEach((cal, index) => {
      Logger.log(`  ${index + 1}. ${cal.getName()} (ID: ${cal.getId()})`);
    });

  } catch (error) {
    Logger.log('Error listing calendars: ' + error.message);
  }
}