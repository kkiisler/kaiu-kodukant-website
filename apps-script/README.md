# MTÜ Kaiu Kodukant - Apps Script Backend

Google Apps Script backend that syncs calendar events and gallery photos from Google services to Pilvio S3 for the static website.

## Features

- **Calendar Sync**: Fetches events from Google Calendar and uploads to S3
- **Gallery Sync**: Processes photos from Google Drive folders and uploads to S3
- **Incremental Sync**: Only uploads new/changed content to save resources
- **Change Detection**: Optional smart sync that only runs when changes detected
- **Error Handling**: Automatic retries and email alerts on failures

## Files Overview

### Core Files (Required)
- **`Code.gs`** - Entry point functions for manual testing and management
- **`config.gs`** - Configuration for S3, Calendar, Gallery, and monitoring
- **`triggers-setup.gs`** - Functions to create and manage triggers

### S3 Operations
- **`s3-utils.gs`** - AWS Signature V4 implementation for Pilvio S3

### Calendar Sync
- **`calendar-sync.gs`** - Fetches Google Calendar events and syncs to S3

### Gallery Sync
- **`gallery-sync-incremental.gs`** - Main gallery sync with incremental processing
- **`image-processor.gs`** - Downloads and processes images from Drive to S3
- **`drive-change-trigger.gs`** - Optional change detection for smart syncing

## Setup Instructions

### 1. Configure Script Properties

In Apps Script Editor, go to Project Settings > Script Properties and add:

```
S3_ACCESS_KEY_ID = your_pilvio_access_key
S3_SECRET_ACCESS_KEY = your_pilvio_secret_key
ADMIN_EMAIL = your_email@example.com (optional, for alerts)
```

### 2. Deploy Files

Copy all `.gs` files to your Google Apps Script project:
1. Open [script.google.com](https://script.google.com)
2. Create a new project or open existing
3. Copy each `.gs` file content
4. Save the project

### 3. Initial Configuration

Run these functions once to verify setup:

```javascript
// Verify configuration
runVerifyConfiguration();

// Test S3 connection
runTestS3Connection();
```

### 4. Setup Triggers

Choose one of two approaches:

#### Option A: Standard Time-Based Sync
```javascript
// Syncs on schedule regardless of changes
setupTriggers(false);
// Calendar: every 5 minutes
// Gallery: every 15 minutes
```

#### Option B: Smart Change-Based Sync (Recommended)
```javascript
// Only syncs when changes detected
setupTriggers(true);
// Calendar: every 5 minutes (always)
// Gallery: checks every 10 min, syncs only if changes
```

## Usage

### Manual Functions

Run these from Apps Script editor for testing:

```javascript
runCalendarSync();        // Manual calendar sync
runGallerySync();         // Manual gallery sync
runCheckGalleryStatus();  // Check sync progress
runResetGallerySync();    // Clear stuck sync state
runTestChangeDetection(); // Test change detection
```

### Monitor Sync Status

```javascript
// View all system status
viewSystemStatus();

// Check gallery sync progress
debugSyncState();

// List active triggers
listTriggers();
```

### Switch Between Sync Modes

```javascript
// Switch to change-based (smart) sync
switchToChangeBasedSync();

// Switch back to time-based sync
removeAllTriggers();
setupTriggers(false);
```

## Configuration Details

### Calendar Settings (config.gs)

```javascript
CALENDAR_CONFIG = {
  calendarId: 'your_calendar_id@group.calendar.google.com',
  monthsBack: 1,    // Fetch events from 1 month ago
  monthsForward: 6  // Fetch events up to 6 months ahead
}
```

### Gallery Settings (config.gs)

```javascript
GALLERY_CONFIG = {
  folderId: 'google_drive_folder_id', // Root gallery folder
  imageSizes: {
    small: 300,   // Thumbnail
    medium: 600,  // Preview
    large: 1200   // Full view
  }
}
```

### S3 Structure

Files are uploaded to Pilvio S3 with this structure:

```
kaiugalerii/
├── calendar/
│   └── events.json              # Calendar events
├── gallery/
│   ├── albums.json              # Album list and metadata
│   └── albums/
│       └── {albumId}.json       # Individual album data
├── images/
│   ├── {photoId}-300.jpg        # Small thumbnail
│   ├── {photoId}-600.jpg        # Medium size
│   ├── {photoId}-1200.jpg       # Large size
│   └── {photoId}-original.jpg   # Original (if <10MB)
└── logs/
    └── {type}-sync-{date}.json  # Sync logs
```

## How It Works

### Calendar Sync
1. Fetches events from Google Calendar API
2. Filters events within date range
3. Formats events for frontend display
4. Uploads JSON to S3
5. Runs every 5 minutes

### Gallery Sync
1. Scans Google Drive folders (albums)
2. Loads existing S3 metadata to check what's already uploaded
3. Downloads new photos from Drive
4. Creates multiple sizes using Drive's thumbnail API
5. Uploads images and metadata to S3
6. Processes in batches (30 images per run) to avoid timeouts

### Incremental Sync
- Checks existing content in S3 before uploading
- Skips photos that already exist
- Updates only changed metadata
- Tracks sync state to resume if interrupted

### Change Detection (Optional)
- Checks Drive for changes every 10 minutes
- Compares file timestamps with last check
- Only triggers sync if new/modified files found
- Reduces unnecessary API calls by ~95%

## Monitoring

### Execution Logs
View in Apps Script Editor > Executions

Look for:
- `✅ SYNC COMPLETE` - Successful completion
- `⏸ Timeout approaching` - Partial sync (will resume)
- `⏭ Skipped X existing photos` - Incremental sync working
- `✗ Error` - Something failed

### Email Alerts
After 3 consecutive failures, sends alert to `ADMIN_EMAIL`

### Manual Health Check
```javascript
getGallerySyncStats();
// Returns: lastCheck, lastSync, pendingChanges, syncState
```

## Troubleshooting

### Gallery sync stuck
```javascript
runResetGallerySync(); // Clear state
runGallerySync();      // Restart
```

### S3 authentication errors
- Verify Script Properties are set correctly
- Check S3 credentials are valid
- Ensure bucket name is correct (`kaiugalerii`)

### Photos not uploading
- Check Drive folder permissions
- Verify folder ID in config.gs
- Look for errors in execution logs

### Sync taking too long
- Normal for initial sync (200+ photos = ~2 hours)
- Subsequent syncs much faster with incremental mode
- Consider reducing batch size if timeouts occur

## Performance

### Initial Sync
- First run processes all content
- 200 photos: ~7-8 runs over 2 hours
- Calendar: immediate

### Incremental Sync
- Only processes new/changed content
- Typical run: <1 minute
- Skips existing content

### Resource Usage
- Apps Script quota: 6 min/execution, 90 min/day
- Drive API: 1,000,000 queries/day
- S3 API: Based on Pilvio plan

## Security

- No API keys in code (uses Script Properties)
- S3 credentials never exposed
- Uses AWS Signature V4 for secure uploads
- CORS headers configured for website domain only

## Support

For issues or questions:
- Check execution logs first
- Verify all Script Properties are set
- Test with manual functions before automation
- Ensure Google services permissions are granted