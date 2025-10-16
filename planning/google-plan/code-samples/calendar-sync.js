/**
 * Complete Calendar Sync Implementation
 * Ready-to-use calendar synchronization service
 */

const axios = require('axios');
const AWS = require('aws-sdk');

class CalendarSyncService {
  constructor(config) {
    // Google Calendar configuration
    this.calendarId = config.GOOGLE_CALENDAR_ID;
    this.googleApiKey = config.GOOGLE_API_KEY; // Optional for higher quotas

    // S3 configuration
    this.s3 = new AWS.S3({
      endpoint: config.S3_ENDPOINT,
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      region: config.S3_REGION || 'eu-west-1',
      s3ForcePathStyle: true,
    });
    this.bucket = config.S3_BUCKET;

    // Sync configuration
    this.monthsBack = config.CALENDAR_MONTHS_BACK || 1;
    this.monthsForward = config.CALENDAR_MONTHS_FORWARD || 6;

    // Dependencies
    this.database = config.database;
    this.emailService = config.emailService;
  }

  /**
   * Main sync method - call this from cron job
   */
  async syncCalendar() {
    const startTime = Date.now();
    console.log('=== Starting Calendar Sync ===');

    try {
      // Step 1: Fetch events from Google Calendar
      const events = await this.fetchCalendarEvents();
      console.log(`Fetched ${events.length} events from Google Calendar`);

      // Step 2: Format events for FullCalendar.js
      const formattedEvents = this.formatEventsForFullCalendar(events);

      // Step 3: Prepare data object
      const calendarData = {
        events: formattedEvents,
        lastUpdated: new Date().toISOString(),
        count: formattedEvents.length,
        source: 'google-calendar-public-api',
        syncVersion: '2.0',
      };

      // Step 4: Upload to S3
      await this.uploadToS3('calendar/events.json', calendarData);

      // Step 5: Update version file for cache busting
      await this.updateVersionFile();

      // Step 6: Log success
      await this.logSyncResult(true, formattedEvents.length, Date.now() - startTime);

      console.log(`✓ Calendar sync completed successfully in ${Date.now() - startTime}ms`);

      return {
        success: true,
        eventCount: formattedEvents.length,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      console.error('✗ Calendar sync failed:', error);

      // Log failure
      await this.logSyncResult(false, 0, Date.now() - startTime, error.message);

      // Send alert if needed
      await this.checkAndSendAlert(error);

      throw error;
    }
  }

  /**
   * Fetch events from Google Calendar public API
   */
  async fetchCalendarEvents() {
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setMonth(now.getMonth() - this.monthsBack);
    const timeMax = new Date(now);
    timeMax.setMonth(now.getMonth() + this.monthsForward);

    const params = {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500,
    };

    // Add API key if provided (increases quota)
    if (this.googleApiKey) {
      params.key = this.googleApiKey;
    }

    try {
      const response = await axios.get(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events`,
        { params, timeout: 30000 }
      );

      return response.data.items || [];
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Calendar not found or not public');
      } else if (error.response?.status === 403) {
        throw new Error('Calendar API quota exceeded or calendar not accessible');
      }
      throw error;
    }
  }

  /**
   * Format Google Calendar events for FullCalendar.js
   */
  formatEventsForFullCalendar(googleEvents) {
    return googleEvents.map(event => {
      const isAllDay = !event.start?.dateTime;

      const formattedEvent = {
        id: event.id,
        title: event.summary || 'Unnamed Event',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        allDay: isAllDay,
      };

      // Add optional fields
      if (event.description) {
        formattedEvent.description = event.description;
      }

      if (event.location) {
        formattedEvent.location = event.location;
      }

      if (event.htmlLink) {
        formattedEvent.url = event.htmlLink;
      }

      // Add color if specified
      if (event.colorId) {
        formattedEvent.colorId = event.colorId;
        formattedEvent.backgroundColor = this.getColorForId(event.colorId);
      }

      // Add recurrence info if available
      if (event.recurringEventId) {
        formattedEvent.recurringEventId = event.recurringEventId;
      }

      return formattedEvent;
    });
  }

  /**
   * Upload JSON data to S3
   */
  async uploadToS3(key, data) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
      ACL: 'public-read',
      CacheControl: 'public, max-age=300', // Cache for 5 minutes
    };

    try {
      await this.s3.putObject(params).promise();
      console.log(`✓ Uploaded to S3: s3://${this.bucket}/${key}`);
    } catch (error) {
      console.error(`✗ S3 upload failed for ${key}:`, error);
      throw new Error(`Failed to upload to S3: ${error.message}`);
    }
  }

  /**
   * Update version file for cache busting
   */
  async updateVersionFile() {
    try {
      // Try to get existing version file
      let versionData = {};

      try {
        const existingVersion = await this.s3.getObject({
          Bucket: this.bucket,
          Key: 'metadata/version.json',
        }).promise();

        versionData = JSON.parse(existingVersion.Body.toString());
      } catch (error) {
        // Version file doesn't exist yet
        console.log('Creating new version file');
      }

      // Update calendar version
      versionData.calendar = Date.now();
      versionData.lastUpdated = new Date().toISOString();

      // Upload updated version file
      await this.uploadToS3('metadata/version.json', versionData);

    } catch (error) {
      // Non-critical error, just log it
      console.warn('Could not update version file:', error.message);
    }
  }

  /**
   * Log sync result to database
   */
  async logSyncResult(success, eventCount, duration, errorMessage = null) {
    if (!this.database) return;

    try {
      const db = this.database.getDb();

      if (success) {
        // Update sync state for success
        db.prepare(`
          INSERT OR REPLACE INTO sync_state
          (component, last_sync, last_success, failure_count, state_data, updated_at)
          VALUES (?, ?, ?, 0, ?, ?)
        `).run(
          'calendar',
          new Date().toISOString(),
          new Date().toISOString(),
          JSON.stringify({ eventCount, duration }),
          new Date().toISOString()
        );
      } else {
        // Increment failure count
        const current = db.prepare('SELECT failure_count FROM sync_state WHERE component = ?')
          .get('calendar');

        const failureCount = (current?.failure_count || 0) + 1;

        db.prepare(`
          INSERT OR REPLACE INTO sync_state
          (component, last_sync, failure_count, state_data, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          'calendar',
          new Date().toISOString(),
          failureCount,
          JSON.stringify({ lastError: errorMessage, duration }),
          new Date().toISOString()
        );
      }

      // Log to sync_logs table
      db.prepare(`
        INSERT INTO sync_logs
        (component, level, message, details, duration, success, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'calendar',
        success ? 'info' : 'error',
        success ? `Synced ${eventCount} events` : `Sync failed: ${errorMessage}`,
        JSON.stringify({ eventCount, duration }),
        duration,
        success ? 1 : 0,
        new Date().toISOString()
      );

    } catch (error) {
      console.warn('Could not log sync result:', error.message);
    }
  }

  /**
   * Check if alert should be sent and send it
   */
  async checkAndSendAlert(error) {
    if (!this.database || !this.emailService) return;

    try {
      const db = this.database.getDb();
      const state = db.prepare('SELECT failure_count FROM sync_state WHERE component = ?')
        .get('calendar');

      if (state?.failure_count >= 3) {
        await this.emailService.sendEmail({
          to: process.env.SYNC_ALERT_EMAIL,
          subject: '⚠️ Calendar Sync Failing',
          text: `Calendar sync has failed ${state.failure_count} consecutive times.\n\nLast error: ${error.message}\n\nPlease check the system.`,
        });

        console.log('Alert email sent for calendar sync failures');
      }
    } catch (error) {
      console.warn('Could not send alert:', error.message);
    }
  }

  /**
   * Get color for Google Calendar color ID
   */
  getColorForId(colorId) {
    const colors = {
      '1': '#a4bdfc',
      '2': '#7ae7bf',
      '3': '#dbadff',
      '4': '#ff887c',
      '5': '#fbd75b',
      '6': '#ffb878',
      '7': '#46d6db',
      '8': '#e1e1e1',
      '9': '#5484ed',
      '10': '#51b749',
      '11': '#dc2127',
    };

    return colors[colorId] || '#4285f4';
  }

  /**
   * Manual sync trigger (for testing or admin panel)
   */
  async triggerManualSync() {
    console.log('Manual calendar sync triggered');
    return await this.syncCalendar();
  }

  /**
   * Get sync status
   */
  async getStatus() {
    if (!this.database) {
      return { status: 'unknown' };
    }

    const db = this.database.getDb();
    const state = db.prepare('SELECT * FROM sync_state WHERE component = ?')
      .get('calendar');

    if (!state) {
      return { status: 'never_synced' };
    }

    return {
      status: state.failure_count > 2 ? 'failing' : 'healthy',
      lastSync: state.last_sync,
      lastSuccess: state.last_success,
      failureCount: state.failure_count,
      data: JSON.parse(state.state_data || '{}'),
    };
  }
}

// Export for use in Node.js application
module.exports = CalendarSyncService;

// Example usage:
if (require.main === module) {
  // Test the service
  const service = new CalendarSyncService({
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_REGION: process.env.S3_REGION,
    CALENDAR_MONTHS_BACK: 1,
    CALENDAR_MONTHS_FORWARD: 6,
  });

  service.syncCalendar()
    .then(result => console.log('Sync result:', result))
    .catch(error => console.error('Sync error:', error));
}