# Gallery Sync Monitoring Fix

## Problem
The gallery sync monitoring shows all failures (red dots) even though the gallery is actually syncing. The issue is that `version.json` has `gallery: 1` instead of a proper timestamp.

## Root Cause
The Apps Script `checkForGalleryChanges` function is not updating the timestamp in `metadata/version.json` after successful sync.

## Quick Fix (Immediate)

### Step 1: Manual Fix via Apps Script
Run this function once in your Google Apps Script editor to fix the current timestamp:

```javascript
function fixGalleryTimestampNow() {
  const props = PropertiesService.getScriptProperties();
  const S3_CONFIG = {
    endpoint: props.getProperty('S3_ENDPOINT'),
    bucket: props.getProperty('S3_BUCKET'),
    region: props.getProperty('S3_REGION') || 'eu-west-1',
    accessKeyId: props.getProperty('S3_ACCESS_KEY_ID'),
    secretAccessKey: props.getProperty('S3_SECRET_ACCESS_KEY')
  };

  // Fetch current version.json
  const versionUrl = `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/metadata/version.json`;
  const response = UrlFetchApp.fetch(versionUrl);
  const currentVersion = JSON.parse(response.getContentText());

  // Update with current timestamp
  const now = Date.now();
  const fixedVersion = {
    calendar: currentVersion.calendar,
    gallery: now,  // Fix: use timestamp instead of 1
    lastUpdated: new Date(now).toISOString()
  };

  // Upload fixed version using your existing s3PutObjectV4 function
  s3PutObjectV4({
    endpoint: S3_CONFIG.endpoint,
    region: S3_CONFIG.region,
    bucket: S3_CONFIG.bucket,
    key: 'metadata/version.json',
    body: JSON.stringify(fixedVersion, null, 2),
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60'
    }
  });

  console.log('✅ Gallery timestamp fixed:', fixedVersion);
}
```

### Step 2: Update checkForGalleryChanges Function

Find your `checkForGalleryChanges` function and add this after successful sync:

```javascript
function checkForGalleryChanges() {
  try {
    // ... your existing gallery sync logic ...

    // After successful sync, update version.json
    const now = Date.now();

    // Fetch current version
    const versionUrl = `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/metadata/version.json`;
    let currentVersion = { calendar: Date.now() };

    try {
      const response = UrlFetchApp.fetch(versionUrl, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        currentVersion = JSON.parse(response.getContentText());
      }
    } catch (e) {
      // Version file might not exist
    }

    // Update gallery timestamp
    const updatedVersion = {
      calendar: currentVersion.calendar || now,
      gallery: now,  // ← THIS IS THE KEY FIX
      lastUpdated: new Date(now).toISOString()
    };

    // Upload updated version.json
    s3PutObjectV4({
      endpoint: S3_CONFIG.endpoint,
      region: S3_CONFIG.region,
      bucket: S3_CONFIG.bucket,
      key: 'metadata/version.json',
      body: JSON.stringify(updatedVersion, null, 2),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });

    console.log('✅ Gallery sync completed and version updated');

  } catch (error) {
    console.error('Gallery sync failed:', error);
    throw error;
  }
}
```

## Permanent Fix (Complete Implementation)

See `apps-script-gallery-sync-fix.js` for a complete implementation that includes:
1. Proper timestamp updates after each sync
2. Detailed sync logging to S3
3. Error handling and recovery
4. Sync statistics tracking

## Testing

After implementing the fix:
1. Run `fixGalleryTimestampNow()` once to fix the current state
2. Wait for the next scheduled `checkForGalleryChanges` run (or trigger manually)
3. Check https://api.kaiukodukant.ee/admin/monitoring-enhanced
4. Gallery should now show green dots and proper timestamps

## Verification

Check if the fix is working:
```bash
curl https://s3.pilw.io/kaiugalerii/metadata/version.json | jq .
```

You should see:
```json
{
  "calendar": 1759759315909,
  "gallery": 1759759315909,  // ← Should be a timestamp, not 1
  "lastUpdated": "2025-10-06T14:01:55.909Z"
}
```

## Timeline Explanation

- Green dot = successful sync (staleness < 30 minutes)
- Yellow dot = warning (staleness 30-60 minutes)
- Red dot = error (staleness > 60 minutes or value = 1)