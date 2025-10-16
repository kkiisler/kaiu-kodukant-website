// Google Calendar Sync Service
// Fetches events from Google Calendar and uploads to S3
// Replaces Google Apps Script calendar sync

const { google } = require('googleapis');
const config = require('../config');
const s3Upload = require('./s3-upload');

class CalendarSyncService {
  constructor() {
    this.apiKey = config.GOOGLE_API_KEY;
    this.calendarId = config.GOOGLE_CALENDAR_ID;
    this.monthsBack = config.CALENDAR_MONTHS_BACK || 1;
    this.monthsForward = config.CALENDAR_MONTHS_FORWARD || 6;

    // Initialize Google Calendar API client
    this.calendar = google.calendar({
      version: 'v3',
      auth: this.apiKey
    });
  }

  /**
   * Calculate date range for fetching events
   * @returns {Object} Start and end dates
   */
  getDateRange() {
    const now = new Date();

    // Start date: N months back
    const timeMin = new Date(now);
    timeMin.setMonth(timeMin.getMonth() - this.monthsBack);
    timeMin.setHours(0, 0, 0, 0);

    // End date: N months forward
    const timeMax = new Date(now);
    timeMax.setMonth(timeMax.getMonth() + this.monthsForward);
    timeMax.setHours(23, 59, 59, 999);

    return {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString()
    };
  }

  /**
   * Fetch events from Google Calendar
   * @returns {Promise<Array>} Calendar events
   */
  async fetchCalendarEvents() {
    const { timeMin, timeMax } = this.getDateRange();

    console.log(`Fetching calendar events from ${timeMin} to ${timeMax}`);

    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin,
        timeMax,
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      console.log(`✓ Fetched ${events.length} events from Google Calendar`);

      return events;
    } catch (error) {
      console.error('✗ Failed to fetch calendar events:', error.message);
      throw new Error(`Calendar API error: ${error.message}`);
    }
  }

  /**
   * Format events for FullCalendar.js
   * @param {Array} events - Raw Google Calendar events
   * @returns {Array} Formatted events
   */
  formatEventsForFullCalendar(events) {
    return events.map(event => {
      const isAllDay = !event.start.dateTime;

      // Parse start date/time
      const startStr = event.start.dateTime || event.start.date;
      const endStr = event.end.dateTime || event.end.date;

      // Format for FullCalendar
      const formattedEvent = {
        id: event.id,
        title: event.summary || 'Unnamed Event',
        start: startStr,
        end: endStr,
        allDay: isAllDay,
        description: event.description || '',
        location: event.location || '',
        url: event.htmlLink || '',
        backgroundColor: this.getEventColor(event),
        borderColor: this.getEventColor(event),
        textColor: '#ffffff'
      };

      return formattedEvent;
    });
  }

  /**
   * Get event color based on event properties
   * @param {Object} event - Google Calendar event
   * @returns {string} Color code
   */
  getEventColor(event) {
    // You can customize this based on event categories, keywords, etc.
    // For now, use a default color from your theme
    return '#10b981'; // Green from Tailwind emerald-500
  }

  /**
   * Sync calendar events to S3
   * @returns {Promise<Object>} Sync result
   */
  async syncCalendar() {
    const startTime = Date.now();

    try {
      console.log('🗓️  Starting calendar sync...');

      // Fetch events from Google Calendar
      const rawEvents = await this.fetchCalendarEvents();

      // Format events for FullCalendar.js
      const formattedEvents = this.formatEventsForFullCalendar(rawEvents);

      // Prepare calendar data
      const calendarData = {
        events: formattedEvents,
        metadata: {
          lastSync: new Date().toISOString(),
          eventCount: formattedEvents.length,
          dateRange: this.getDateRange(),
          source: 'google-calendar-api',
          version: '1.0.0'
        }
      };

      // Upload to S3
      await s3Upload.uploadJSON('calendar/events.json', calendarData);

      // Update version file
      await s3Upload.updateVersionFile('calendar');

      // Upload sync log
      const duration = Date.now() - startTime;
      await s3Upload.uploadSyncLog('calendar', {
        success: true,
        eventCount: formattedEvents.length,
        duration,
        dateRange: this.getDateRange()
      });

      console.log(`✓ Calendar sync completed in ${duration}ms`);

      return {
        success: true,
        eventCount: formattedEvents.length,
        duration,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('✗ Calendar sync failed:', error.message);

      // Upload error log
      try {
        await s3Upload.uploadSyncLog('calendar', {
          success: false,
          error: error.message,
          duration
        });
      } catch (logError) {
        console.error('✗ Failed to upload error log:', logError.message);
      }

      throw error;
    }
  }

  /**
   * Get current sync status from S3
   * @returns {Promise<Object>} Sync status
   */
  async getSyncStatus() {
    try {
      const s3Client = require('./s3-client');
      const events = await s3Client.getCalendarEvents();

      if (!events || !events.metadata) {
        return {
          synced: false,
          message: 'No calendar data found in S3'
        };
      }

      const lastSync = new Date(events.metadata.lastSync);
      const now = new Date();
      const ageMinutes = Math.floor((now - lastSync) / 1000 / 60);

      return {
        synced: true,
        lastSync: events.metadata.lastSync,
        eventCount: events.metadata.eventCount,
        ageMinutes,
        isStale: ageMinutes > 30, // Consider stale if older than 30 minutes
        source: events.metadata.source
      };
    } catch (error) {
      return {
        synced: false,
        error: error.message
      };
    }
  }

  /**
   * Force a manual sync
   * @returns {Promise<Object>} Sync result
   */
  async forceSync() {
    console.log('🔄 Manual calendar sync triggered');
    return this.syncCalendar();
  }
}

// Export singleton instance
module.exports = new CalendarSyncService();
