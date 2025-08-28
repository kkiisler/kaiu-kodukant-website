# Apps Script Pilvio S3 Sync Implementation

## Overview
Complete Google Apps Script implementation for syncing calendar data to Pilvio's S3-compatible storage service using AWS Signature v4 authentication.

---

## Complete Implementation Code

### Main Sync Function

```javascript
/**
 * Main function to sync calendar to S3
 * Schedule this to run every 15 minutes
 */
function syncCalendarToS3() {
  const startTime = Date.now();
  
  try {
    // 1. Fetch calendar events
    const calendarData = buildCalendarJson();
    
    // 2. Upload to S3
    const result = uploadToS3(calendarData);
    
    // 3. Log success
    const duration = Date.now() - startTime;
    console.log(`✅ Calendar sync completed in ${duration}ms`);
    console.log(`📦 Uploaded ${result.size} bytes to ${result.url}`);
    
    // 4. Optional: Send success notification
    notifySuccess(result);
    
    return result;
    
  } catch (error) {
    // Log error and send alert
    console.error('❌ Calendar sync failed:', error);
    notifyError(error);
    throw error;
  }
}

/**
 * Build optimized calendar JSON from Google Calendar
 */
function buildCalendarJson() {
  const CALENDAR_ID = 'YOUR_GOOGLE_CALENDAR_ID'; // Update this
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  
  if (!calendar) {
    throw new Error('Calendar not found: ' + CALENDAR_ID);
  }
  
  // Define time range: 7 days past, 90 days future
  const now = new Date();
  const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  
  // Fetch events
  const events = calendar.getEvents(startDate, endDate);
  
  // Build optimized event array
  const eventData = events.map(event => {
    // Only include essential fields to minimize size
    const eventObj = {
      id: event.getId(),
      title: event.getTitle(),
      start: event.getStartTime().toISOString(),
      end: event.getEndTime().toISOString(),
      allDay: event.isAllDayEvent()
    };
    
    // Only add optional fields if they have values
    const location = event.getLocation();
    if (location) eventObj.location = location;
    
    const description = event.getDescription();
    if (description && description.length < 500) {
      // Limit description length
      eventObj.description = description;
    }
    
    // Add color for calendar display
    const color = event.getColor();
    if (color) eventObj.color = color;
    
    return eventObj;
  });
  
  // Build final JSON structure
  const calendarJson = {
    version: Utilities.formatDate(now, 'UTC', 'yyyyMMdd\'T\'HHmmss'),
    generated: now.toISOString(),
    events: eventData,
    meta: {
      totalEvents: eventData.length,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      calendarName: calendar.getName(),
      calendarTimezone: calendar.getTimeZone()
    }
  };
  
  return JSON.stringify(calendarJson);
}

/**
 * Upload JSON to S3 with AWS Signature v4
 */
function uploadToS3(jsonData) {
  // Get configuration from Script Properties
  const props = PropertiesService.getScriptProperties();
  const config = {
    accessKeyId: props.getProperty('S3_ACCESS_KEY_ID'),
    secretAccessKey: props.getProperty('S3_SECRET_ACCESS_KEY'),
    endpoint: props.getProperty('S3_ENDPOINT') || 'https://s3.pilvio.com',
    region: props.getProperty('S3_REGION') || 'us-east-1', // Pilvio may ignore this
    bucket: props.getProperty('S3_BUCKET') || 'kaiu-static',
    key: props.getProperty('S3_KEY') || 'calendar/calendar.json'
  };
  
  // Validate configuration
  if (!config.accessKeyId || !config.secretAccessKey || !config.bucket) {
    throw new Error('Missing Pilvio S3 configuration in Script Properties');
  }
  
  // Set cache headers for 15 minutes
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=900, s-maxage=900',
    'x-amz-acl': 'public-read', // Only if not using CloudFront OAC
    'x-amz-meta-generator': 'kaiu-calendar-sync-v1',
    'x-amz-meta-updated': new Date().toISOString()
  };
  
  // Perform S3 upload
  const result = s3PutObjectV4({
    endpoint: config.endpoint,
    region: config.region,
    bucket: config.bucket,
    key: config.key,
    body: jsonData,
    headers: headers
  });
  
  // Archive a copy with timestamp (optional)
  const archiveKey = `calendar/archive/calendar-${Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd-HHmmss')}.json`;
  try {
    s3PutObjectV4({
      endpoint: config.endpoint,
      region: config.region,
      bucket: config.bucket,
      key: archiveKey,
      body: jsonData,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
        // Note: Pilvio may not support storage classes
      }
    });
  } catch (e) {
    console.warn('Archive upload failed (non-critical):', e);
  }
  
  return {
    url: `${config.endpoint}/${config.bucket}/${config.key}`,
    size: jsonData.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * AWS Signature v4 implementation for S3-compatible services (Pilvio)
 */
function s3PutObjectV4(params) {
  const { endpoint, region, bucket, key, body, headers = {} } = params;
  
  // Get S3 credentials
  const props = PropertiesService.getScriptProperties();
  const accessKey = props.getProperty('S3_ACCESS_KEY_ID');
  const secretKey = props.getProperty('S3_SECRET_ACCESS_KEY');
  
  if (!accessKey || !secretKey) {
    throw new Error('S3 credentials not found in Script Properties');
  }
  
  // S3 service constants
  const service = 's3';
  const endpointUrl = new URL(endpoint);
  const host = endpointUrl.hostname;
  const fullUrl = `${endpoint}/${bucket}/${encodeURI(key).replace(/\+/g, '%20')}`;
  
  // Generate timestamps
  const now = new Date();
  const amzDate = Utilities.formatDate(now, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  
  // Prepare request
  const method = 'PUT';
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  const payloadHash = sha256Hash(payload);
  
  // Merge headers
  const requestHeaders = Object.assign({}, headers, {
    'host': host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash
  });
  
  // Create canonical request
  const canonicalHeaders = createCanonicalHeaders(requestHeaders);
  const signedHeaders = Object.keys(requestHeaders)
    .map(k => k.toLowerCase())
    .sort()
    .join(';');
  
  const canonicalRequest = [
    method,
    '/' + encodeURI(key).replace(/\+/g, '%20'),
    '', // Query string (empty)
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  
  // Create string to sign
  const canonicalRequestHash = sha256Hash(canonicalRequest);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n');
  
  // Calculate signature
  const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
  const signature = hmacSha256(stringToSign, signingKey);
  
  // Create authorization header
  const authorizationHeader = [
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ');
  
  // Prepare final headers
  const finalHeaders = {};
  Object.keys(requestHeaders).forEach(key => {
    finalHeaders[key] = requestHeaders[key];
  });
  finalHeaders['Authorization'] = authorizationHeader;
  
  // Make the request
  const response = UrlFetchApp.fetch(fullUrl, {
    method: 'PUT',
    payload: payload,
    headers: finalHeaders,
    muteHttpExceptions: true
  });
  
  const statusCode = response.getResponseCode();
  
  if (statusCode >= 200 && statusCode < 300) {
    console.log(`✅ S3 PUT successful: ${fullUrl}`);
    return {
      success: true,
      statusCode: statusCode,
      etag: response.getHeaders()['ETag']
    };
  } else {
    const errorText = response.getContentText();
    console.error(`❌ S3 PUT failed (${statusCode}):`, errorText);
    throw new Error(`S3 upload failed with status ${statusCode}: ${errorText}`);
  }
}

/**
 * Helper: Create canonical headers for AWS signature
 */
function createCanonicalHeaders(headers) {
  const canonical = {};
  Object.keys(headers).forEach(key => {
    canonical[key.toLowerCase()] = headers[key].trim();
  });
  
  return Object.keys(canonical)
    .sort()
    .map(key => `${key}:${canonical[key]}\n`)
    .join('');
}

/**
 * Helper: Generate AWS signature key
 */
function getSignatureKey(secretKey, dateStamp, region, service) {
  const kDate = Utilities.computeHmacSha256Signature(dateStamp, 'AWS4' + secretKey);
  const kRegion = Utilities.computeHmacSha256Signature(region, kDate);
  const kService = Utilities.computeHmacSha256Signature(service, kRegion);
  const kSigning = Utilities.computeHmacSha256Signature('aws4_request', kService);
  return kSigning;
}

/**
 * Helper: HMAC-SHA256 with hex output
 */
function hmacSha256(data, key) {
  const signature = Utilities.computeHmacSha256Signature(data, key);
  return signature.map(byte => {
    const val = (byte < 0) ? 256 + byte : byte;
    return ('0' + val.toString(16)).slice(-2);
  }).join('');
}

/**
 * Helper: SHA256 hash with hex output
 */
function sha256Hash(data) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data);
  return hash.map(byte => {
    const val = (byte < 0) ? 256 + byte : byte;
    return ('0' + val.toString(16)).slice(-2);
  }).join('');
}

/**
 * Send success notification (optional)
 */
function notifySuccess(result) {
  // Option 1: Log to spreadsheet
  try {
    const sheet = SpreadsheetApp.openById('YOUR_LOG_SPREADSHEET_ID').getSheetByName('SyncLog');
    sheet.appendRow([
      new Date(),
      'SUCCESS',
      result.size,
      result.url,
      result.timestamp
    ]);
  } catch (e) {
    console.warn('Could not log to spreadsheet:', e);
  }
  
  // Option 2: Send email (only on issues)
  // Commented out to avoid spam
  /*
  MailApp.sendEmail({
    to: 'admin@example.com',
    subject: 'Calendar Sync Success',
    body: `Calendar synced successfully at ${result.timestamp}`
  });
  */
}

/**
 * Send error notification
 */
function notifyError(error) {
  const errorDetails = {
    timestamp: new Date().toISOString(),
    error: error.toString(),
    stack: error.stack || 'No stack trace'
  };
  
  // Log to console
  console.error('Calendar sync error:', errorDetails);
  
  // Send email alert
  try {
    MailApp.sendEmail({
      to: props.getProperty('ADMIN_EMAIL') || 'admin@example.com',
      subject: '🚨 Calendar Sync Failed',
      htmlBody: `
        <h2>Calendar Sync Error</h2>
        <p><strong>Time:</strong> ${errorDetails.timestamp}</p>
        <p><strong>Error:</strong> ${errorDetails.error}</p>
        <pre>${errorDetails.stack}</pre>
        <p>Please check the Apps Script logs for more details.</p>
      `
    });
  } catch (e) {
    console.error('Could not send error email:', e);
  }
}
```

---

## Setup Instructions

### 1. Script Properties Configuration

In Apps Script Editor → Project Settings → Script Properties, add:

| Property | Value | Description |
|----------|-------|-------------|
| S3_ACCESS_KEY_ID | your-key... | Pilvio S3 access key |
| S3_SECRET_ACCESS_KEY | your-secret... | Pilvio S3 secret key |
| S3_ENDPOINT | https://s3.pilvio.com | Pilvio S3 endpoint URL |
| S3_REGION | us-east-1 | Region (usually us-east-1 for S3-compatible) |
| S3_BUCKET | kaiu-static | Your bucket name |
| S3_KEY | calendar/calendar.json | S3 object key |
| GOOGLE_CALENDAR_ID | abc123@group.calendar.google.com | Your calendar ID |
| ADMIN_EMAIL | admin@kaiukodukant.ee | For error notifications |

### 2. Calendar ID

Find your Google Calendar ID:
1. Open Google Calendar
2. Settings → Settings for my calendars
3. Click on your calendar
4. Scroll to "Integrate calendar"
5. Copy the Calendar ID

### 3. Deploy and Test

```javascript
/**
 * Test function - run this manually first
 */
function testCalendarSync() {
  try {
    // Test calendar access
    const props = PropertiesService.getScriptProperties();
    const calendarId = props.getProperty('GOOGLE_CALENDAR_ID');
    const calendar = CalendarApp.getCalendarById(calendarId);
    
    if (!calendar) {
      throw new Error('Calendar not found. Check GOOGLE_CALENDAR_ID');
    }
    
    console.log('✅ Calendar found:', calendar.getName());
    
    // Test building JSON
    const json = buildCalendarJson();
    const data = JSON.parse(json);
    console.log('✅ JSON built:', data.events.length, 'events');
    
    // Test S3 upload with a test file
    const testKey = props.getProperty('S3_KEY').replace('.json', '-test.json');
    props.setProperty('S3_KEY', testKey);
    
    const result = uploadToS3(json);
    console.log('✅ Upload successful:', result);
    
    // Restore original key
    props.setProperty('S3_KEY', testKey.replace('-test.json', '.json'));
    
    return result;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}
```

### 4. Schedule Trigger

```javascript
/**
 * Set up automatic sync trigger
 */
function setupTrigger() {
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncCalendarToS3') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger - every 15 minutes
  ScriptApp.newTrigger('syncCalendarToS3')
    .timeBased()
    .everyMinutes(15)
    .create();
  
  console.log('✅ Trigger created: sync every 15 minutes');
}

/**
 * Remove trigger (if needed)
 */
function removeTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncCalendarToS3') {
      ScriptApp.deleteTrigger(trigger);
      console.log('✅ Trigger removed');
    }
  });
}
```

---

## Advanced Features

### 1. Incremental Updates

```javascript
/**
 * Only sync events that have changed
 */
function incrementalSync() {
  const props = PropertiesService.getScriptProperties();
  const lastSyncToken = props.getProperty('CALENDAR_SYNC_TOKEN');
  
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  
  // Get events updated since last sync
  if (lastSyncToken) {
    // Use sync token for incremental updates
    // Note: CalendarApp doesn't support sync tokens directly
    // Would need to use Calendar API v3 for this
  }
  
  // For now, do full sync
  return syncCalendarToS3();
}
```

### 2. Multiple Calendars

```javascript
/**
 * Sync multiple calendars to separate files
 */
function syncMultipleCalendars() {
  const calendars = [
    { id: 'calendar1@group.calendar.google.com', key: 'calendar1.json' },
    { id: 'calendar2@group.calendar.google.com', key: 'calendar2.json' }
  ];
  
  calendars.forEach(cal => {
    try {
      props.setProperty('GOOGLE_CALENDAR_ID', cal.id);
      props.setProperty('S3_KEY', `sites/kaiu-kodukant/calendar/${cal.key}`);
      syncCalendarToS3();
    } catch (e) {
      console.error(`Failed to sync ${cal.id}:`, e);
    }
  });
}
```

### 3. Compression

```javascript
/**
 * Compress JSON before upload (for large calendars)
 */
function uploadCompressed(jsonData) {
  const compressed = Utilities.gzip(Utilities.newBlob(jsonData)).getBytes();
  
  const headers = {
    'Content-Type': 'application/json',
    'Content-Encoding': 'gzip',
    'Cache-Control': 'public, max-age=900'
  };
  
  return s3PutObjectV4({
    region: config.region,
    bucket: config.bucket,
    key: config.key + '.gz',
    body: compressed,
    headers: headers
  });
}
```

---

## Monitoring & Debugging

### 1. Logging Dashboard

```javascript
/**
 * Get sync statistics
 */
function getSyncStats() {
  const logs = SpreadsheetApp.openById('LOG_SPREADSHEET_ID')
    .getSheetByName('SyncLog')
    .getDataRange()
    .getValues();
  
  const stats = {
    totalSyncs: logs.length,
    successCount: logs.filter(row => row[1] === 'SUCCESS').length,
    errorCount: logs.filter(row => row[1] === 'ERROR').length,
    averageSize: logs.reduce((sum, row) => sum + (row[2] || 0), 0) / logs.length,
    lastSync: logs[logs.length - 1][0]
  };
  
  console.log('Sync Statistics:', stats);
  return stats;
}
```

### 2. Debug Mode

```javascript
/**
 * Enable detailed logging
 */
function debugSync() {
  // Enable verbose logging
  PropertiesService.getScriptProperties().setProperty('DEBUG_MODE', 'true');
  
  try {
    syncCalendarToS3();
  } finally {
    PropertiesService.getScriptProperties().deleteProperty('DEBUG_MODE');
  }
}
```

---

## Error Handling

### Common Issues and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| SignatureDoesNotMatch | Wrong credentials or region | Verify AWS keys and region |
| AccessDenied | IAM permissions | Check IAM policy |
| NoSuchBucket | Bucket doesn't exist | Verify bucket name |
| Calendar not found | Wrong calendar ID | Check calendar ID and permissions |
| Quota exceeded | Too many API calls | Reduce sync frequency |

### Retry Logic

```javascript
/**
 * Sync with retry logic
 */
function syncWithRetry(maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return syncCalendarToS3();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed:`, error);
      
      // Exponential backoff
      if (i < maxRetries - 1) {
        Utilities.sleep(Math.pow(2, i) * 1000);
      }
    }
  }
  
  throw lastError;
}
```

---

## Testing Checklist

- [ ] Calendar ID is correct and accessible
- [ ] AWS credentials are set in Script Properties
- [ ] S3 bucket and path exist
- [ ] IAM permissions are correct
- [ ] Test function runs successfully
- [ ] JSON structure is valid
- [ ] S3 upload completes
- [ ] File is accessible via CloudFront
- [ ] Cache headers are set correctly
- [ ] Trigger is scheduled
- [ ] Error notifications work
- [ ] Monitoring is configured

---

## Security Best Practices

1. **Never hardcode credentials** - Always use Script Properties
2. **Use minimal IAM permissions** - Only allow PutObject to specific path
3. **Rotate keys regularly** - Update AWS keys quarterly
4. **Monitor access logs** - Check CloudWatch for unusual activity
5. **Use HTTPS only** - Ensure all URLs use HTTPS
6. **Limit calendar data** - Don't include sensitive information

This completes the Apps Script implementation for S3 calendar sync.