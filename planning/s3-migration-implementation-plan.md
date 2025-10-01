# S3 Migration Implementation Plan

**Last Updated**: 2025-10-01
**Status**: PLANNING (TESTING ENVIRONMENT)
**Target Completion**: 2 Weeks
**Environment**: Testing/Development (not production)

---

## Executive Summary

Migrate MTÜ Kaiu Kodukant gallery and calendar from direct Apps Script serving to S3-based architecture:
- **Apps Script syncs data to S3** on schedule (private, no public access needed)
- **Frontend fetches from S3** (fast, cacheable, reliable)
- **Gallery syncs every 15 minutes** with resumable batch processing (critical for 200+ photos)
- **Calendar syncs every 5 minutes**
- **All images copied to S3** with multiple sizes (300px, 600px, 1200px)

**Note**: This is a testing environment - simplified approach without production safeguards like fallback mechanisms or parallel operation phases.

---

## Phase 1: Calendar Migration (Days 1-2)
**Goal**: Validate S3 architecture with calendar data before tackling gallery

### 1.1 Create S3 Helper Library
**File**: `apps-script/s3-utils.gs` (NEW)

**Features**:
- AWS Signature V4 authentication for Pilvio (s3.pilw.io)
- Upload file to S3
- Delete file from S3
- List files in S3 (for cleanup)
- Retry logic (3 attempts with exponential backoff)
- Error handling and logging

**Key Functions**:
```javascript
uploadToS3(bucket, key, content, contentType, isPublic)
deleteFromS3(bucket, key)
listS3Objects(bucket, prefix)
```

### 1.2 Create Configuration File
**File**: `apps-script/config.gs` (NEW)

**Contents**:
```javascript
// S3 Configuration (stored in Script Properties for security)
const S3_CONFIG = {
  endpoint: 's3.pilw.io',
  bucket: 'kaiugalerii',
  region: 'auto', // or specific region if required
  // Access keys loaded from Script Properties
  accessKeyId: PropertiesService.getScriptProperties().getProperty('S3_ACCESS_KEY_ID'),
  secretAccessKey: PropertiesService.getScriptProperties().getProperty('S3_SECRET_ACCESS_KEY')
};

// Sync Configuration
const SYNC_CONFIG = {
  calendarId: 'a0b18dc4b7e4b9b40858746a7edddaa51b41014085ba2f4b2f89bf038ac13f12@group.calendar.google.com',
  galleryFolderId: '1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg',

  // Alert configuration
  alertEmail: 'kaur.kiisler@gmail.com',
  alertAfterFailures: 3,

  // Staleness thresholds (minutes)
  calendarMaxAge: 60,
  galleryMaxAge: 60
};
```

### 1.3 Create Calendar Sync Script
**File**: `apps-script/calendar-sync.gs` (NEW)

**Features**:
- Fetch events from Google Calendar (1 month back, 6 months forward)
- Format for FullCalendar.js
- Generate events.json
- Upload to S3: `calendar/events.json`
- Update `metadata/version.json`
- Log sync status to S3: `logs/calendar-sync-YYYY-MM-DD.json`
- Track consecutive failures for alerting

**Key Functions**:
```javascript
syncCalendar()          // Main sync function (called by trigger)
manualSyncCalendar()    // Manual trigger for immediate sync
getCalendarEvents()     // Fetch from Google Calendar
formatEventsForJson()   // Format data structure
uploadCalendarToS3()    // Upload to S3
updateVersionFile()     // Bump version for cache busting
```

### 1.4 Update Frontend Calendar
**File**: `js/calendar.js` (MODIFY)

**Changes**:
1. Replace Apps Script URL with S3 URL
2. Add version fetching for cache busting
3. Add staleness detection (60 minute threshold)
4. Remove JSONP (use direct fetch)
5. Add error handling for S3 failures

**Before**:
```javascript
const url = `${GOOGLE_APPS_SCRIPT_URL}?action=calendar`;
jsonp(url, displayEvents, handleError);
```

**After**:
```javascript
const baseUrl = 'https://s3.pilw.io/kaiugalerii';
const version = await fetch(`${baseUrl}/metadata/version.json`).then(r => r.json());
const events = await fetch(`${baseUrl}/calendar/events.json?v=${version.calendar}`).then(r => r.json());
```

### 1.5 Setup Time-Based Trigger
**Function**: Create in Apps Script UI or via code

```javascript
function setupCalendarTrigger() {
  // Delete existing triggers
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncCalendar') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger: every 5 minutes
  ScriptApp.newTrigger('syncCalendar')
    .timeBased()
    .everyMinutes(5)
    .create();
}
```

### 1.6 Calendar Phase Checklist
- [ ] Create s3-utils.gs with AWS signing
- [ ] Create config.gs with credentials
- [ ] Add S3 credentials to Script Properties
- [ ] Create calendar-sync.gs
- [ ] Test manual calendar sync
- [ ] Verify events.json appears in S3
- [ ] Test S3 fetch in browser console
- [ ] Update calendar.js frontend
- [ ] Deploy frontend changes
- [ ] Monitor for 4 hours
- [ ] Create time-based trigger (5 min)
- [ ] Verify trigger runs successfully
- [ ] Monitor for 24 hours before gallery

---

## Phase 2: Gallery Migration (Days 3-5)
**Goal**: Migrate gallery to S3 with full image copying

### 2.1 Create Image Processor
**File**: `apps-script/image-processor.gs` (NEW)

**Features**:
- Download image from Google Drive
- Generate multiple sizes using Drive's export API
- Upload images to S3 in 3 sizes (300px, 600px, 1200px)
- Handle Drive API rate limits
- Fallback: If resizing fails, upload original only

**Challenge**: Apps Script has no native image resizing. Solutions:
- **Option A**: Use Drive's thumbnail API (sz=w300, sz=w600, sz=w1200)
- **Option B**: Fetch image, use UrlFetchApp to external resize service
- **Recommendation**: Option A (simpler, uses Drive's built-in resizing)

**Key Functions**:
```javascript
processAndUploadImage(fileId, fileName)
getImageFromDrive(fileId, size)  // Uses Drive export/thumbnail API
uploadImageToS3(fileId, size, imageBlob)
```

### 2.2 Create Gallery Sync Script (WITH RESUMABLE BATCH PROCESSING)
**File**: `apps-script/gallery-sync.gs` (NEW)

**Critical Feature - Resumable Sync Implementation**:
```javascript
// CRITICAL: Resumable sync to handle 6-minute timeout
function syncGallery() {
  const props = PropertiesService.getScriptProperties();
  const syncState = JSON.parse(props.getProperty('syncState') || '{}');

  const startTime = new Date().getTime();
  const MAX_RUNTIME = 5 * 60 * 1000; // 5 minutes (1 min buffer)
  const BATCH_SIZE = 50; // Process max 50 images per run

  // Resume from saved state or start fresh
  const albums = syncState.albums || getAllAlbums();
  let albumIndex = syncState.albumIndex || 0;
  let photoIndex = syncState.photoIndex || 0;
  let processed = 0;

  // Process photos in batches
  while (albumIndex < albums.length && processed < BATCH_SIZE) {
    const album = albums[albumIndex];
    const photos = album.photos;

    while (photoIndex < photos.length && processed < BATCH_SIZE) {
      // Check time limit
      if (new Date().getTime() - startTime > MAX_RUNTIME) {
        // Save state and exit for continuation
        props.setProperty('syncState', JSON.stringify({
          albums: albums,
          albumIndex: albumIndex,
          photoIndex: photoIndex,
          lastRun: new Date().toISOString()
        }));
        console.log(`Timeout approaching. Saved state: album ${albumIndex}, photo ${photoIndex}`);
        return; // Will continue on next trigger
      }

      // Process one photo (3 sizes)
      processPhotoToS3(photos[photoIndex], album.id);
      processed++;
      photoIndex++;
    }

    if (photoIndex >= photos.length) {
      // Album complete, move to next
      albumIndex++;
      photoIndex = 0;
    }
  }

  // All done - clear state
  props.deleteProperty('syncState');
  console.log(`Sync complete. Processed ${processed} photos`);

  // Update metadata files
  uploadGalleryMetadata(albums);
  updateVersionFile('gallery');
}

// Helper to continue interrupted sync
function continueSync() {
  const props = PropertiesService.getScriptProperties();
  const syncState = props.getProperty('syncState');

  if (syncState) {
    console.log('Continuing previous sync...');
    syncGallery();
  } else {
    console.log('No sync to continue');
  }
}
```

**Features**:
- Scan all album folders in Google Drive (GALLERY_FOLDER_ID)
- Smart sync: Check folder.getLastUpdated() vs last sync time
- **CRITICAL: Batch processing with state persistence**
- Process max 50 images per 6-minute run
- Auto-resume on next trigger if needed
- Track progress in Script Properties
- Generate albums.json (list of all albums)
- Detect deleted albums/photos and remove from S3
- Update version.json
- Log to S3
- Track consecutive failures

**Key Functions**:
```javascript
syncGallery()              // Main sync with resumable batching
continueSync()             // Resume interrupted sync
manualSyncGallery()        // Manual trigger
forceFullSync()            // Ignore smart sync, re-process everything
processPhotoToS3(photo)    // Process one photo (3 sizes)
shouldSyncAlbum(folder)    // Check if album changed
detectDeletedItems()       // Find items in S3 not in Drive
uploadGalleryMetadata()    // Upload albums.json
```

**Execution Time Management**:
- 200 photos × 3 sizes = 600 image operations
- Apps Script time limit: 6 minutes for triggers
- **Solution**: Process 50 images per run, save state, auto-continue
- Initial full sync will take ~4-5 trigger runs (about 1 hour total)
- Subsequent syncs only process changed albums

### 2.3 Update Frontend Gallery
**File**: `js/gallery.js` (MODIFY)

**Changes**:
1. Replace Apps Script URLs with S3 URLs
2. Update image URLs to S3 paths
3. Add responsive image srcset
4. Add version-based cache busting
5. Remove JSONP, use fetch
6. Keep Drive URLs as fallback (in case of S3 issue)
7. Add staleness detection

**Before**:
```javascript
const url = `${GOOGLE_APPS_SCRIPT_URL}?action=gallery`;
jsonp(url, displayAlbums, handleError);

// Images from Drive
<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w400">
```

**After**:
```javascript
const baseUrl = 'https://s3.pilw.io/kaiugalerii';
const version = await fetch(`${baseUrl}/metadata/version.json`).then(r => r.json());
const albums = await fetch(`${baseUrl}/gallery/albums.json?v=${version.gallery}`).then(r => r.json());

// Images from S3 with responsive srcset
<img src="${baseUrl}/images/${fileId}-300.jpg"
     srcset="${baseUrl}/images/${fileId}-300.jpg 1x,
             ${baseUrl}/images/${fileId}-600.jpg 2x"
     loading="lazy">

// Lightbox: larger size
<img src="${baseUrl}/images/${fileId}-1200.jpg">
```

### 2.4 Update Config
**File**: `js/config.js` (MODIFY)

**Add**:
```javascript
// S3 Configuration
const S3_CONFIG = {
  baseUrl: 'https://s3.pilw.io/kaiugalerii',
  endpoints: {
    version: '/metadata/version.json',
    calendarEvents: '/calendar/events.json',
    galleryAlbums: '/gallery/albums.json',
    galleryAlbum: '/gallery/albums/album-{id}.json',
    images: '/images/{fileId}-{size}.jpg'
  },
  imageSizes: {
    thumbnail: 300,
    medium: 600,
    large: 1200
  },
  staleness: {
    calendar: 60, // minutes
    gallery: 60
  }
};
```

### 2.5 Setup Time-Based Trigger
```javascript
function setupGalleryTrigger() {
  // Delete existing triggers
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncGallery') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger: every 15 minutes
  ScriptApp.newTrigger('syncGallery')
    .timeBased()
    .everyMinutes(15)
    .create();
}
```

### 2.6 Gallery Phase Checklist
- [ ] Create image-processor.gs
- [ ] Test image download and resize from Drive
- [ ] Create gallery-sync.gs with batch processing
- [ ] Test manual gallery sync (expect 10-15 min for 200 photos)
- [ ] Verify albums.json in S3
- [ ] Verify images in S3 (check a few manually)
- [ ] Check S3 storage usage (~1-1.5GB expected)
- [ ] Update gallery.js frontend
- [ ] Update config.js with S3 URLs
- [ ] Deploy frontend changes
- [ ] Announce maintenance window (15 min)
- [ ] Test gallery loading from S3
- [ ] Verify images display correctly
- [ ] Create time-based trigger (15 min)
- [ ] Monitor for 48 hours

---

## Phase 3: Monitoring & Admin (Days 6-7)
**Goal**: Add monitoring, alerts, and admin controls

### 3.1 Create Monitoring System
**File**: `apps-script/monitoring.gs` (NEW)

**Features**:
- Track consecutive failures (separate for calendar and gallery)
- Send email alert after 3 consecutive failures
- Log all sync attempts to S3 with timestamps
- Store failure count in Script Properties
- Reset failure count on successful sync

**Key Functions**:
```javascript
trackSyncAttempt(type, success, details)
checkAndAlert(type, error)
logToS3(type, status, details)
getLastSyncStatus()
resetFailureCount(type)
```

### 3.2 Manual Sync Functions
**File**: `apps-script/Code.gs` or add to existing files

```javascript
// Manual triggers (run from Apps Script editor)
function manualSyncCalendar() {
  return syncCalendar();
}

function manualSyncGallery() {
  return syncGallery();
}

function forceFullSync() {
  // Ignore lastModified checks, re-sync everything
  PropertiesService.getScriptProperties().deleteProperty('lastGallerySync');
  return syncGallery();
}

function viewSyncStatus() {
  const calendar = PropertiesService.getScriptProperties().getProperty('lastCalendarSync');
  const gallery = PropertiesService.getScriptProperties().getProperty('lastGallerySync');

  Logger.log('Calendar last sync: ' + calendar);
  Logger.log('Gallery last sync: ' + gallery);
}
```

### 3.3 Admin Dashboard (Optional)
**File**: `admin-dashboard.html` (NEW, OPTIONAL)

**Features**:
- Display last sync times
- Show sync status (success/failure)
- Buttons to trigger manual sync
- View recent logs
- Display S3 storage usage (if API available)

**Access**: Deploy as web app (restricted to you only)

### 3.4 Monitoring Phase Checklist
- [ ] Create monitoring.gs
- [ ] Test failure tracking
- [ ] Test email alerts (simulate 3 failures)
- [ ] Verify logs appear in S3
- [ ] Create manual sync functions
- [ ] Test manual triggers
- [ ] (Optional) Create admin dashboard
- [ ] Document monitoring procedures

---

## Migration Plan for Testing Environment

### Pre-Migration (Day 0)
**Time**: 1 hour

- [ ] Review all generated code files
- [ ] Create Apps Script project (or use existing)
- [ ] Add S3 credentials to Script Properties
- [ ] Test S3 upload manually with simple script
- [ ] Configure S3 bucket permissions (public-read for objects)
- [ ] Backup current files (git commit)

### Week 1, Day 1-2: Calendar Migration
**Time**: 4-5 hours total

- [ ] Deploy calendar sync code to Apps Script
- [ ] Run `manualSyncCalendar()` and verify S3 upload
- [ ] Update frontend to fetch from S3
- [ ] Deploy and test
- [ ] Setup 5-minute trigger

### Week 1, Day 3-5: Gallery Migration
**Time**: 8-10 hours total

**Day 3: Deploy Sync Code**
- [ ] Deploy gallery sync code with batch processing
- [ ] Run `manualSyncGallery()` - expect multiple runs
- [ ] Monitor syncState in Script Properties
- [ ] Verify batch processing works (50 images per run)
- [ ] Initial sync will take ~4-5 trigger runs

**Day 4-5: Frontend Updates**
- [ ] Update gallery.js to fetch from S3
- [ ] Deploy and test thoroughly
- [ ] Setup 15-minute trigger
- [ ] Monitor for 24 hours

### Week 2: API Backend & Finalization
**Time**: 15-20 hours total

**Days 1-3: API Implementation**
- [ ] Generate API code
- [ ] Deploy with Docker
- [ ] Test form submissions
- [ ] Setup admin dashboard

**Days 4-5: Testing & Direct Cutover**
- [ ] Direct cutover (no parallel operation needed for testing)
- [ ] Disable Apps Script public endpoints
- [ ] Final testing
- [ ] Document any issues

**Daily checks**:
- [ ] Check email for any alert messages
- [ ] Verify website loads correctly
- [ ] Check Apps Script execution logs
- [ ] Monitor S3 bandwidth usage (Pilvio dashboard)
- [ ] Verify sync triggers running on schedule
- [ ] Test adding a new photo to Drive, verify it appears after sync

**Week 1 review**:
- [ ] Document any issues encountered
- [ ] Optimize if needed (batch sizes, timing)
- [ ] Confirm all features working
- [ ] Update documentation

---

## Simplified Rollback Plan (Testing Environment)

Since this is a testing environment, rollback is straightforward:

1. **Git revert**: `git revert <commit-hash>`
2. **Disable triggers**: Delete all Apps Script triggers
3. **Verify**: Site loads from old endpoints
4. **Note**: S3 data can remain (no harm)

---

## Success Criteria

### Calendar (after 24 hours)
- [ ] Events loading from S3 without errors
- [ ] No 404 errors in browser console
- [ ] Sync trigger running every 5 minutes
- [ ] No email alerts received
- [ ] events.json timestamp updates every 5 minutes
- [ ] Calendar displays current events correctly
- [ ] Version.json updates properly

### Gallery (after 48 hours)
- [ ] Albums loading from S3
- [ ] All 200 images displaying correctly
- [ ] Images served from S3, not Drive (check Network tab)
- [ ] Sync trigger running every 15 minutes
- [ ] No email alerts received
- [ ] albums.json updates when Drive changes
- [ ] Page load time <2 seconds (vs 5-10s before)
- [ ] Responsive images working (300px for grid, 1200px for lightbox)
- [ ] New photos appear after sync (test by adding one)

---

## Performance Targets

### Before Migration (Current State)
- Gallery initial load: 5-10 seconds
- Calendar load: 2-3 seconds
- Repeat visit: No cache benefit (3-5s)
- Apps Script reliability: Requires frequent redeployment

### After Migration (Expected)
- Gallery initial load: 2-3 seconds (60-70% improvement)
- Calendar load: <1 second (50%+ improvement)
- Repeat visit: <500ms (cached with version)
- Apps Script reliability: Never needs redeployment
- Image load speed: 70-80% faster (S3 vs Drive)

---

## Cost Estimate

### Pilvio S3 Usage
**Storage**:
- Images: ~1.2GB (200 photos × 3 sizes)
- JSON: <1MB
- Logs: ~10MB/month
- **Total**: ~1.3GB

**Requests** (monthly):
- Calendar sync: 8,640/month (every 5 min)
- Gallery sync: 2,880/month (every 15 min)
- Frontend fetches: ~5,000/month (estimated traffic)
- **Total**: ~16,500 requests/month

**Bandwidth** (monthly):
- JSON downloads: <100MB
- Image downloads: ~10-20GB (depends on traffic)
- **Total**: ~20GB/month

**Expected Cost**: Within Pilvio free tier (essentially $0)

---

## Risk Assessment

### Low Risk ✅
- Calendar migration (small dataset, easy to test)
- S3 serving static files (proven technology)
- Version-based cache busting (standard approach)

### Medium Risk ⚠️
- Gallery image processing (Apps Script limitations)
- 6-minute timeout for large syncs
- First-time S3 integration with Apps Script

### Mitigation Strategies
1. **Batch processing**: Split gallery sync into chunks
2. **Calendar first**: Validate approach with simpler dataset
3. **Extensive testing**: Manual sync before automation
4. **Quick rollback**: Git commits at each step
5. **Monitoring**: Email alerts for failures

---

## Technical Constraints & Considerations

### Apps Script Limitations
- **Execution time**: 6 minutes max for triggers
- **URL Fetch calls**: 20,000/day quota
- **Image processing**: No native library
- **Solution**: Use Drive's thumbnail API, batch processing

### S3/Pilvio Constraints
- **API compatibility**: Standard S3 (confirmed)
- **Endpoint**: s3.pilw.io
- **Authentication**: AWS Signature V4
- **CORS**: Must be configured for public-read

### Frontend Considerations
- **CORS**: S3 must allow cross-origin requests
- **Cache headers**: Set Cache-Control: max-age=86400 on S3 objects
- **Fallback**: Keep Drive URLs as backup
- **Staleness**: Show error if data >60 minutes old

---

## Dependencies & Prerequisites

### Before Starting
- [ ] Pilvio S3 account configured
- [ ] Bucket "kaiugalerii" created
- [ ] S3 credentials obtained (Access Key ID + Secret)
- [ ] Google Apps Script project created
- [ ] Access to website hosting/deployment
- [ ] Git repository for version control

### External Services
- Google Drive API (already in use)
- Google Calendar API (already in use)
- Pilvio S3 API (new)
- No additional external dependencies

---

## Documentation Requirements

### Code Documentation
- [ ] Comment all major functions
- [ ] Document S3 bucket structure
- [ ] Explain version.json format
- [ ] Provide example JSON structures

### Operational Documentation
- [ ] How to manually trigger sync
- [ ] How to check sync status
- [ ] How to interpret logs
- [ ] Troubleshooting common issues
- [ ] How to add new albums/photos

### Handoff Documentation
- [ ] Architecture overview
- [ ] How to modify sync intervals
- [ ] How to update S3 credentials
- [ ] Monitoring and alerting setup
- [ ] Rollback procedures

---

## Future Enhancements (Post-Migration)

### Phase 4 (Optional, Later)
- [ ] Add admin dashboard
- [ ] Implement image preloading
- [ ] Add WebP format support
- [ ] Implement progressive image loading (blurhash)
- [ ] Add analytics for image views
- [ ] Optimize batch sizes based on usage
- [ ] Add CDN (Cloudflare) in front of S3
- [ ] Implement incremental sync (only changed files)

---

## Contact & Support

**Developer**: Claude Code
**Client Contact**: kaur.kiisler@gmail.com
**Emergency Rollback**: See "Rollback Plan" section
**S3 Provider**: Pilvio.com
**Estimated Implementation Time**: 3-5 days (calendar + gallery)

---

## Sign-Off

**Plan Reviewed**: [ ]
**Ready to Generate Code**: [ ]
**Credentials Configured**: [ ]
**Backup Completed**: [ ]
**Migration Date Scheduled**: ___________

---

**END OF IMPLEMENTATION PLAN**
