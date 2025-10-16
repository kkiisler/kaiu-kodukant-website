# Phase 1: Calendar Sync Implementation Guide

## Overview
Implement calendar synchronization from public Google Calendar to S3 storage using Node.js backend.

## Implementation Steps

### Step 1: Install Required Dependencies

```bash
cd api
npm install axios aws-sdk node-cron
```

### Step 2: Create Calendar Client Service

**File: `api/services/google/calendar-client.js`**
```javascript
const axios = require('axios');

class GoogleCalendarClient {
  constructor(calendarId, apiKey = null) {
    this.calendarId = calendarId;
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.googleapis.com/calendar/v3';
  }

  async getEvents(timeMin, timeMax) {
    try {
      const params = {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 500,
      };

      // Add API key if provided (for higher quotas)
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await axios.get(
        `${this.baseUrl}/calendars/${encodeURIComponent(this.calendarId)}/events`,
        { params }
      );

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = GoogleCalendarClient;
```

### Step 3: Create S3 Client Service

**File: `api/services/sync/s3-client.js`**
```javascript
const AWS = require('aws-sdk');

class S3Client {
  constructor(config) {
    this.s3 = new AWS.S3({
      endpoint: config.endpoint,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      s3ForcePathStyle: true, // Required for custom endpoints
    });
    this.bucket = config.bucket;
  }

  async uploadJson(key, data, isPublic = true) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    };

    if (isPublic) {
      params.ACL = 'public-read';
    }

    try {
      const result = await this.s3.putObject(params).promise();
      console.log(`✓ Uploaded to S3: ${key}`);
      return result;
    } catch (error) {
      console.error(`✗ S3 upload error for ${key}:`, error);
      throw error;
    }
  }

  async getJson(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
      };
      const result = await this.s3.getObject(params).promise();
      return JSON.parse(result.Body.toString());
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  async exists(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
      };
      await this.s3.headObject(params).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}

module.exports = S3Client;
```

### Step 4: Create Calendar Sync Service

**File: `api/services/sync/calendar-sync.js`**
```javascript
const GoogleCalendarClient = require('../google/calendar-client');
const S3Client = require('./s3-client');
const database = require('../database');

class CalendarSync {
  constructor(config) {
    this.calendarClient = new GoogleCalendarClient(
      config.calendarId,
      config.googleApiKey
    );

    this.s3Client = new S3Client({
      endpoint: config.s3Endpoint,
      bucket: config.s3Bucket,
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      region: config.s3Region,
    });

    this.monthsBack = config.monthsBack || 1;
    this.monthsForward = config.monthsForward || 6;
  }

  async sync() {
    const startTime = Date.now();
    console.log('=== Starting Calendar Sync ===');

    try {
      // Calculate time range
      const now = new Date();
      const timeMin = new Date(now);
      timeMin.setMonth(now.getMonth() - this.monthsBack);
      const timeMax = new Date(now);
      timeMax.setMonth(now.getMonth() + this.monthsForward);

      // Fetch events from Google Calendar
      const events = await this.calendarClient.getEvents(timeMin, timeMax);
      console.log(`Fetched ${events.length} events from calendar`);

      // Format for FullCalendar.js
      const formattedEvents = this.formatEventsForFullCalendar(events);

      // Prepare data for S3
      const eventsData = {
        events: formattedEvents,
        lastUpdated: new Date().toISOString(),
        count: formattedEvents.length,
      };

      // Upload to S3
      await this.s3Client.uploadJson('calendar/events.json', eventsData, true);

      // Update version file for cache busting
      await this.updateVersionFile('calendar');

      // Log success to database
      this.logSyncSuccess('calendar', formattedEvents.length);

      const duration = Date.now() - startTime;
      console.log(`✓ Calendar sync complete in ${duration}ms`);

      return {
        success: true,
        count: formattedEvents.length,
        duration,
      };
    } catch (error) {
      console.error('✗ Calendar sync failed:', error);
      this.logSyncFailure('calendar', error.message);
      throw error;
    }
  }

  formatEventsForFullCalendar(events) {
    return events.map(event => {
      const isAllDay = !event.start?.dateTime;

      const formatted = {
        id: event.id,
        title: event.summary || 'Unnamed Event',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        allDay: isAllDay,
      };

      if (event.description) {
        formatted.description = event.description;
      }

      if (event.location) {
        formatted.location = event.location;
      }

      if (event.colorId) {
        formatted.colorId = event.colorId;
      }

      return formatted;
    });
  }

  async updateVersionFile(component) {
    try {
      // Load existing version file or create new
      let versionData = await this.s3Client.getJson('metadata/version.json') || {
        calendar: Date.now(),
        gallery: Date.now(),
      };

      // Update timestamp for component
      versionData[component] = Date.now();
      versionData.lastUpdated = new Date().toISOString();

      // Upload updated version file
      await this.s3Client.uploadJson('metadata/version.json', versionData, true);
      console.log(`✓ Version file updated: ${component} = ${versionData[component]}`);
    } catch (error) {
      console.warn('Could not update version file:', error.message);
    }
  }

  logSyncSuccess(component, count) {
    try {
      const db = database.getDb();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO sync_state
        (component, last_sync, last_success, failure_count, state_data, updated_at)
        VALUES (?, ?, ?, 0, ?, ?)
      `);

      stmt.run(
        component,
        new Date().toISOString(),
        new Date().toISOString(),
        JSON.stringify({ eventCount: count }),
        new Date().toISOString()
      );
    } catch (error) {
      console.warn('Could not log sync success:', error.message);
    }
  }

  logSyncFailure(component, errorMessage) {
    try {
      const db = database.getDb();

      // Get current failure count
      const current = db.prepare('SELECT failure_count FROM sync_state WHERE component = ?')
        .get(component);

      const failureCount = (current?.failure_count || 0) + 1;

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO sync_state
        (component, last_sync, failure_count, state_data, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        component,
        new Date().toISOString(),
        failureCount,
        JSON.stringify({ lastError: errorMessage }),
        new Date().toISOString()
      );

      // Send alert if threshold reached
      if (failureCount >= 3) {
        this.sendFailureAlert(component, failureCount, errorMessage);
      }
    } catch (error) {
      console.warn('Could not log sync failure:', error.message);
    }
  }

  async sendFailureAlert(component, failureCount, errorMessage) {
    // Implement email alert using existing email service
    const emailService = require('../email');
    await emailService.sendAlert({
      subject: `⚠️ Calendar Sync Failing`,
      text: `Calendar sync has failed ${failureCount} times. Last error: ${errorMessage}`,
    });
  }
}

module.exports = CalendarSync;
```

### Step 5: Add Database Schema

**Add to existing database initialization:**
```javascript
// In api/services/database.js, add to initDatabase function:

db.exec(`
  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component TEXT UNIQUE NOT NULL,
    last_sync TEXT,
    last_success TEXT,
    failure_count INTEGER DEFAULT 0,
    state_data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
```

### Step 6: Create Sync Routes

**File: `api/routes/sync.js`**
```javascript
const express = require('express');
const router = express.Router();
const CalendarSync = require('../services/sync/calendar-sync');
const { authenticateAdmin } = require('../middleware/auth');
const config = require('../config');

// Initialize sync service
const calendarSync = new CalendarSync({
  calendarId: config.GOOGLE_CALENDAR_ID,
  googleApiKey: config.GOOGLE_API_KEY,
  s3Endpoint: config.S3_ENDPOINT,
  s3Bucket: config.S3_BUCKET,
  s3AccessKeyId: config.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: config.S3_SECRET_ACCESS_KEY,
  s3Region: config.S3_REGION,
  monthsBack: config.CALENDAR_MONTHS_BACK,
  monthsForward: config.CALENDAR_MONTHS_FORWARD,
});

// Public status endpoint
router.get('/status', async (req, res) => {
  try {
    const db = require('../services/database').getDb();
    const syncState = db.prepare('SELECT * FROM sync_state WHERE component = ?')
      .get('calendar');

    res.json({
      calendar: {
        lastSync: syncState?.last_sync || null,
        lastSuccess: syncState?.last_success || null,
        failureCount: syncState?.failure_count || 0,
        status: syncState?.failure_count > 2 ? 'failing' : 'healthy',
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Admin: Trigger manual sync
router.post('/calendar/trigger', authenticateAdmin, async (req, res) => {
  try {
    // Start sync in background
    calendarSync.sync().catch(err =>
      console.error('Background sync error:', err)
    );

    res.json({
      message: 'Calendar sync triggered',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

// Admin: Get sync logs
router.get('/logs', authenticateAdmin, async (req, res) => {
  try {
    const db = require('../services/database').getDb();
    const logs = db.prepare(`
      SELECT * FROM sync_state
      ORDER BY updated_at DESC
      LIMIT 100
    `).all();

    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

module.exports = router;
```

### Step 7: Add Cron Job

**In `api/server.js`, add:**
```javascript
const cron = require('node-cron');
const CalendarSync = require('./services/sync/calendar-sync');

// Initialize calendar sync
const calendarSync = new CalendarSync({
  calendarId: process.env.GOOGLE_CALENDAR_ID,
  googleApiKey: process.env.GOOGLE_API_KEY,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Bucket: process.env.S3_BUCKET,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  s3Region: process.env.S3_REGION,
  monthsBack: parseInt(process.env.CALENDAR_MONTHS_BACK) || 1,
  monthsForward: parseInt(process.env.CALENDAR_MONTHS_FORWARD) || 6,
});

// Schedule calendar sync every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running scheduled calendar sync...');
  try {
    await calendarSync.sync();
  } catch (error) {
    console.error('Scheduled sync failed:', error);
  }
});

// Add sync routes
const syncRouter = require('./routes/sync');
app.use('/api/sync', syncRouter);
```

### Step 8: Environment Variables

**Add to `.env`:**
```env
# Google Calendar Configuration
GOOGLE_CALENDAR_ID=a0b18dc4b7e4b9b40858746a7edddaa51b41014085ba2f4b2f89bf038ac13f12@group.calendar.google.com
GOOGLE_API_KEY=optional_for_higher_quotas
CALENDAR_MONTHS_BACK=1
CALENDAR_MONTHS_FORWARD=6

# S3 Configuration (should already exist)
S3_ENDPOINT=https://s3.pilw.io
S3_BUCKET=kaiugalerii
S3_ACCESS_KEY_ID=your_key_id
S3_SECRET_ACCESS_KEY=your_secret_key
S3_REGION=eu-west-1
```

## Testing

### Manual Testing
```bash
# Test calendar sync manually
curl -X POST http://localhost:3000/api/sync/calendar/trigger \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check sync status
curl http://localhost:3000/api/sync/status

# Verify S3 upload
curl https://s3.pilw.io/kaiugalerii/calendar/events.json
```

### Unit Tests
```javascript
// tests/calendar-sync.test.js
const CalendarSync = require('../api/services/sync/calendar-sync');

describe('Calendar Sync', () => {
  it('should format events correctly', () => {
    const sync = new CalendarSync(mockConfig);
    const googleEvent = {
      id: '123',
      summary: 'Test Event',
      start: { dateTime: '2024-01-15T10:00:00Z' },
      end: { dateTime: '2024-01-15T11:00:00Z' },
    };

    const formatted = sync.formatEventsForFullCalendar([googleEvent]);
    expect(formatted[0]).toEqual({
      id: '123',
      title: 'Test Event',
      start: '2024-01-15T10:00:00Z',
      end: '2024-01-15T11:00:00Z',
      allDay: false,
    });
  });
});
```

## Deployment Checklist

- [ ] Install dependencies
- [ ] Add environment variables
- [ ] Update database schema
- [ ] Deploy code to server
- [ ] Test manual sync trigger
- [ ] Verify cron job execution
- [ ] Check S3 file upload
- [ ] Confirm website reads new data
- [ ] Monitor for 24 hours
- [ ] Disable Apps Script triggers

## Rollback Plan

If issues occur:
1. Comment out cron job in server.js
2. Re-enable Apps Script triggers
3. Website continues using existing S3 data
4. Debug and fix issues
5. Re-deploy when ready

## Success Metrics

- Calendar updates appear in S3 within 5 minutes
- Zero manual interventions required
- Sync success rate > 99.9%
- No authentication errors
- Monitoring dashboard shows healthy status

---

*Phase 1 Implementation Guide v1.0*
*Estimated Time: 2-3 hours*