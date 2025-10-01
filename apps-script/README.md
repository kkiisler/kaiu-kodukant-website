# MTÜ Kaiu Kodukant - Apps Script Backend

This folder contains Google Apps Script files that sync calendar and gallery data to S3 storage.

## Files

- **config.gs** - Configuration and Script Properties setup
- **s3-utils.gs** - S3 upload/download utilities with AWS Signature V4
- **calendar-sync.gs** - Calendar sync logic (Phase 1)
- **gallery-sync.gs** - Gallery sync logic (Phase 2) - *To be created*
- **Code.gs** - Main entry points and manual functions
- **triggers-setup.gs** - Trigger creation utilities

## Setup Instructions

### 1. Create Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Create a new project
3. Name it "MTU Kaiu Kodukant S3 Sync"

### 2. Copy Code Files

Copy all `.gs` files from this folder to your Apps Script project:
- config.gs
- s3-utils.gs
- calendar-sync.gs
- Code.gs
- triggers-setup.gs

### 3. Configure Script Properties

1. In Apps Script editor, click ⚙️ **Project Settings**
2. Scroll to **Script Properties**
3. Add the following properties:

| Property | Value | Description |
|----------|-------|-------------|
| `S3_ACCESS_KEY_ID` | `G1ZW8BDISGFYVG2SIKZ7` | Pilvio S3 access key |
| `S3_SECRET_ACCESS_KEY` | `TEXyfkbNFK4Vff8YBxCS9onsuw9KQD0SLb31VQFO` | Pilvio S3 secret key |
| `ADMIN_EMAIL` | `kaur.kiisler@gmail.com` | Email for error alerts |

### 4. Enable Google Calendar API

1. In Apps Script editor, click ➕ next to **Services**
2. Find **Google Calendar API**
3. Click **Add**

### 5. Test Configuration

Run these functions from Apps Script editor to verify setup:

1. **Test configuration**: Run `runVerifyConfiguration()`
   - Should log "✓ Configuration verified"

2. **Test S3 connection**: Run `runTestS3Connection()`
   - Should upload and delete a test file
   - Check logs for success messages

3. **Test calendar sync**: Run `runCalendarSync()`
   - Should sync events to S3
   - Check S3 bucket for `calendar/events.json`

### 6. Setup Triggers

Once testing is successful, create automatic triggers:

1. Run `setupTriggers()` function
2. This creates a trigger to run `syncCalendar()` every 5 minutes
3. Verify triggers in **Triggers** menu (clock icon on left sidebar)

## Usage

### Manual Functions

Run these from Apps Script editor:

- `runCalendarSync()` - Manually sync calendar
- `runViewSyncStatus()` - View last sync times and status
- `runTestS3Connection()` - Test S3 connectivity
- `listTriggers()` - List all active triggers

### Monitoring

- Check **Executions** tab (▶️ icon) to see sync history
- Failed syncs will send email alerts after 3 consecutive failures
- Logs are written to S3 at `logs/calendar-sync-YYYY-MM-DD.json`

## S3 Structure

```
kaiugalerii/
├── calendar/
│   └── events.json              # Calendar events for FullCalendar.js
├── metadata/
│   └── version.json             # Version numbers for cache busting
└── logs/
    ├── calendar-sync-*.json     # Sync logs
    └── gallery-sync-*.json      # Gallery sync logs (Phase 2)
```

## Troubleshooting

### "Missing required Script Properties"

- Make sure all three Script Properties are configured (see Setup step 3)

### "S3 upload failed"

- Verify S3 credentials are correct
- Check Pilvio dashboard for bucket permissions
- Ensure bucket name is `kaiugalerii`

### "Calendar API error"

- Make sure Google Calendar API is enabled (see Setup step 4)
- Verify calendar ID in `config.gs` is correct

### Trigger not running

- Check **Triggers** tab to verify trigger exists
- Look at **Executions** tab for error messages
- Triggers may take 5-15 minutes to start after creation

## Next Steps

After Phase 1 (Calendar) is complete:
- Phase 2 will add gallery sync with batch processing
- Gallery sync will run every 15 minutes
