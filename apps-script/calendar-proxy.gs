/**
 * Calendar Proxy for CORS bypass
 * This provides a proxy endpoint to fetch calendar events from S3
 * without CORS restrictions
 */

/**
 * Handle GET requests for calendar events
 * This bypasses CORS by proxying through Apps Script
 */
function doGetCalendarProxy(e) {
  try {
    // Fetch events from S3
    const s3Url = 'https://s3.pilw.io/kaiugalerii/calendar/events.json';
    const response = UrlFetchApp.fetch(s3Url, {
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      // Return the S3 content with CORS headers
      return ContentService
        .createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Return error
      return ContentService
        .createTextOutput(JSON.stringify({
          error: 'Failed to fetch from S3',
          status: responseCode
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Alternative: Direct calendar fetch from Google Calendar
 * This can be used if S3 is unavailable
 */
function doGetCalendarDirect(e) {
  try {
    const calendarId = CALENDAR_CONFIG.calendarId;
    const calendar = CalendarApp.getCalendarById(calendarId);

    if (!calendar) {
      throw new Error('Calendar not found');
    }

    // Get time range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 1);

    const endDate = new Date(now);
    endDate.setMonth(now.getMonth() + 6);

    // Fetch events
    const events = calendar.getEvents(startDate, endDate);

    // Format for FullCalendar
    const formattedEvents = events.map(event => {
      const isAllDay = event.isAllDayEvent();

      return {
        id: event.getId(),
        title: event.getTitle(),
        start: isAllDay ?
          Utilities.formatDate(event.getStartTime(), 'UTC', 'yyyy-MM-dd') :
          event.getStartTime().toISOString(),
        end: isAllDay ?
          Utilities.formatDate(event.getEndTime(), 'UTC', 'yyyy-MM-dd') :
          event.getEndTime().toISOString(),
        allDay: isAllDay,
        description: event.getDescription(),
        location: event.getLocation()
      };
    });

    // Return formatted events
    return ContentService
      .createTextOutput(JSON.stringify({
        events: formattedEvents,
        lastUpdated: new Date().toISOString(),
        count: formattedEvents.length,
        source: 'direct'
      }, null, 2))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}