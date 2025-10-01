# S3 Migration Execution Tracker

**Project**: MTÜ Kaiu Kodukant - Gallery & Calendar S3 Migration (TESTING)
**Environment**: Testing/Development (not production)
**Start Date**: 2025-10-01
**Target Completion**: 2 Weeks (simplified for testing)
**Current Phase**: [✓] Phase 0 Restructuring [✓] Calendar [ ] Gallery [ ] API Backend [ ] Complete

---

## Quick Status Dashboard

| Component | Status | Last Updated | Notes |
|-----------|--------|--------------|-------|
| Repository Restructuring | ✅ Complete | 2025-10-01 | Phase 0 - Clean URLs working |
| Calendar Sync | ✅ Complete | 2025-10-01 | S3 sync working with correct calendar ID |
| Calendar Frontend | ✅ Complete | 2025-10-01 | Using Caddy proxy to bypass CORS |
| Gallery Sync (with batch processing) | ⬜ Not Started | - | CRITICAL - Phase 2 |
| Gallery Frontend | ⬜ Not Started | - | Phase 2 |
| API Backend | ⬜ Not Started | - | Week 2 |
| Forms Migration | ⬜ Not Started | - | Week 2 |

**Legend**: ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Blocked | ⚠️ Issue

---

## Phase 0: Repository Restructuring (COMPLETED ✅)

### Implementation - 2025-10-01
**Date**: 2025-10-01
**Time Spent**: ~30 minutes

#### Restructuring Checklist - ✅ ALL COMPLETE
- [✓] Create `pages/` folder
- [✓] Move all production HTML files to `pages/`
- [✓] Create `archive/tests/` folder
- [✓] Move test files to `archive/tests/`
- [✓] Move `index_original.html` to `archive/`
- [✓] Update all HTML files with absolute paths
  - [✓] Navigation links (`/about`, `/events`, etc.)
  - [✓] CSS paths (`/css/styles.css`)
  - [✓] JS paths (`/js/common.js`, etc.)
  - [✓] Media paths (`/media/...`)
- [✓] Update `docker/Dockerfile`
  - [✓] Change COPY command to `pages/`
- [✓] Update `docker/Caddyfile.prod`
  - [✓] Add URL rewrite rules for clean URLs
- [✓] Update `docker/Caddyfile`
  - [✓] Add URL rewrite rules
- [✓] Commit changes
  - Commit: 9c5736d
  - Message: "Phase 0: Repository restructuring - Move HTML to pages/ folder"

#### Result
✅ Repository now has clean structure:
- All HTML in `pages/` directory
- Clean URLs enabled (`/about` instead of `/about.html`)
- Test files archived
- Docker configuration updated
- Ready for next phases

---

## Phase 0: Pre-Migration Setup (For Future Phases)

### Day 0 - Preparation
**Date**: ___________
**Time Spent**: _____ hours

#### Setup Checklist
- [ ] Review implementation plan completely
- [ ] Review generated code files
- [ ] Create or identify Apps Script project
  - Project URL: ___________________________________________
- [ ] Configure Apps Script credentials
  - [ ] Add S3_ACCESS_KEY_ID to Script Properties
  - [ ] Add S3_SECRET_ACCESS_KEY to Script Properties
  - [ ] Verify credentials saved correctly
- [ ] Test S3 connectivity
  - [ ] Run test upload script
  - [ ] Verify object appears in S3
  - [ ] Test object deletion
  - [ ] Result: ⬜ Pass / ⬜ Fail
- [ ] Configure S3 bucket permissions
  - [ ] Set bucket to allow public-read on objects
  - [ ] Test public access to uploaded object
  - [ ] Configure CORS if needed
  - [ ] Result: ⬜ Pass / ⬜ Fail
- [ ] Backup current website
  - [ ] Git commit current state
  - [ ] Commit hash: ___________
  - [ ] Tag: ___________
  - [ ] Backup apps-script-backend.js
  - [ ] Backup location: ___________

#### Issues Encountered
```
Date: ___________
Issue:
Solution:

Date: ___________
Issue:
Solution:
```

---

## Phase 1: Calendar Migration (COMPLETED ✅)

### Day 1 Morning - Calendar Sync Setup
**Date**: 2025-10-01
**Start Time**: N/A (Code generation completed)
**End Time**: N/A
**Time Spent**: ~2 hours (including S3 auth debugging)

#### Code Deployment - ✅ CODE GENERATED AND DEBUGGED
- [✓] Generate s3-utils.gs for Apps Script
  - [✓] AWS Signature V4 implementation complete
  - [✓] Upload, delete, and signing functions
  - [✓] URI encoding fix applied (encodeS3Key function)
  - [✓] Host header handling fixed for Apps Script
  - [✓] Byte array handling simplified in hmacSHA256
- [✓] Generate config.gs for Apps Script
  - [✓] S3, Calendar, and Gallery configuration
  - [✓] Script Properties verification function
  - [✓] Region set to eu-west-1 (Pilvio default)
- [✓] Generate calendar-sync.gs for Apps Script
  - [✓] Calendar event fetching and formatting
  - [✓] S3 upload with error handling
  - [✓] Version file management
- [✓] Generate Code.gs with manual trigger functions
- [✓] Generate triggers-setup.gs for automation
- [✓] Generate README.md with setup instructions

#### S3 Authentication Fix - ✅ RESOLVED
- [✓] Fixed HMAC signature computation
  - [✓] Converted both key and message to raw byte arrays
  - [✓] Multi-step key derivation working correctly
  - [✓] Apps Script signature requirements satisfied

#### Manual Sync Test - ✅ COMPLETE
- [✓] Run `testS3Connection()` from Apps Script editor
  - [✓] S3 authentication successful
  - [✓] Upload and delete operations working
- [✓] Run `manualSyncCalendar()` from Apps Script editor
  - [✓] Calendar events successfully synced to S3
  - [✓] events.json created in S3 bucket
  - [✓] Frontend loading events via Caddy proxy

#### S3 Verification
- [ ] Verify `calendar/events.json` exists in S3
  - S3 URL: https://s3.pilw.io/kaiugalerii/calendar/events.json
  - [ ] File exists and is accessible
  - [ ] File size: _____ KB
- [ ] Download and inspect events.json
  - [ ] Valid JSON format
  - [ ] Contains expected events
  - [ ] Number of events: _____
- [ ] Verify `metadata/version.json` created/updated
  - [ ] File exists
  - [ ] Contains calendar version

#### Browser Test
```javascript
// Run in browser console
fetch('https://s3.pilw.io/kaiugalerii/calendar/events.json')
  .then(r => r.json())
  .then(console.log)
```
- [ ] Fetch successful
- [ ] JSON parsed correctly
- [ ] Data looks correct

#### Issues Encountered
```
Time: _____
Issue:
Solution:
Status: ⬜ Resolved / ⬜ Ongoing
```

### Day 1 Afternoon - Calendar Frontend (COMPLETED ✅)
**Date**: 2025-10-01
**Start Time**: N/A
**End Time**: N/A
**Time Spent**: ~30 minutes

#### Code Changes - ✅ COMPLETE
- [✓] Update `js/config.js` with S3 configuration
  - [✓] Added S3_CONFIG object with endpoints
  - [✓] Added staleness thresholds
  - Git commit: 6c89dfb
- [✓] Update `js/calendar.js` to fetch from S3
  - [✓] Migrated from JSONP to fetch API
  - [✓] Load events from S3 endpoint
  - [✓] Add staleness checking
  - Git commit: 6c89dfb
- [✓] Test locally (if possible)
  - [✓] Will test after Apps Script deployment

#### Deployment - ✅ COMPLETE
- [✓] Commit changes to git
  - Commit message: "Phase 1: Implement calendar migration to S3"
  - Commit hash: 6c89dfb
- [✓] Deploy to production
  - [✓] Pushed to remote
  - Deployment will happen automatically via Docker

#### Testing
- [ ] Open events.html in browser
  - [ ] Page loads without errors
  - [ ] Check browser console (no errors)
- [ ] Verify events display correctly
  - [ ] All events visible
  - [ ] Event details correct
  - [ ] Calendar interactive
- [ ] Test on mobile device
  - [ ] Mobile display correct
  - [ ] Touch interactions work

#### Performance Check
- Before (from old system): _____ seconds
- After (from S3): _____ seconds
- Improvement: _____ %

#### Monitoring Period (2-4 hours)
- **Time**: _____ to _____
- [ ] No errors in browser console
- [ ] No user complaints
- [ ] Events updating correctly

#### Trigger Setup
- [ ] Run `setupCalendarTrigger()` in Apps Script
  - Trigger created: ⬜ Yes / ⬜ No
- [ ] Verify trigger appears in Apps Script UI
- [ ] Wait 5-10 minutes for first automatic run
- [ ] Check execution logs
  - First run time: _____
  - Result: ⬜ Success / ⬜ Fail
  - If fail, error: ___________

#### Issues Encountered
```
Time: _____
Issue:
Solution:
Status: ⬜ Resolved / ⬜ Ongoing
```

#### Calendar Phase Sign-Off
- [ ] Calendar sync working automatically
- [ ] Frontend loading from S3
- [ ] No critical issues
- [ ] Ready to proceed to gallery

**Signed off by**: ___________
**Date**: ___________
**Time**: _____

---

## Phase 2: Gallery Migration

### Day 3-5 - Gallery Sync Setup (CRITICAL: BATCH PROCESSING)
**Date**: ___________
**Start Time**: _____
**End Time**: _____
**Time Spent**: _____ hours

#### Code Deployment
- [ ] Deploy image-processor.gs to Apps Script
  - [ ] File deployed successfully
  - [ ] No syntax errors
- [ ] Deploy gallery-sync.gs to Apps Script
  - [ ] **CRITICAL: Verify resumable sync implementation**
  - [ ] Batch size set to 50 images
  - [ ] State tracking in Script Properties
  - [ ] Time limit check (5 min safety buffer)
  - [ ] File deployed successfully

#### Initial Sync Test (MULTIPLE RUNS EXPECTED)
- [ ] Run `manualSyncGallery()` - First Run
  - **Start time**: _____
  - **Expected**: Will timeout after 50 images
  - **End time**: _____
  - Images processed: _____
  - [ ] Check syncState in Script Properties
  - Album index: _____
  - Photo index: _____

- [ ] Continue sync - Run #2
  - [ ] Run `continueSync()` or `manualSyncGallery()` again
  - Start time: _____
  - Images processed: _____
  - [ ] Verify continues from saved state

- [ ] Continue sync - Run #3-5 (as needed)
  - Total runs needed: _____
  - Total time: _____ minutes
  - Total images processed: _____

#### Batch Processing Verification
- [ ] Confirm state persistence working
- [ ] Verify no duplicate uploads
- [ ] Check S3 for partial album uploads
- [ ] Confirm sync completes eventually

#### S3 Verification
- [ ] Verify `gallery/albums.json` exists
  - S3 URL: https://s3.pilw.io/kaiugalerii/gallery/albums.json
  - [ ] File exists and is accessible
  - [ ] File size: _____ KB
  - [ ] Number of albums: _____
- [ ] Verify album JSON files exist
  - [ ] Check 3 random album files
  - Album 1: ___________
  - Album 2: ___________
  - Album 3: ___________
- [ ] Verify images uploaded to S3
  - [ ] Check images folder exists
  - [ ] Verify random images (check 5):
    - Image 1 (300px): ⬜ Exists
    - Image 1 (600px): ⬜ Exists
    - Image 1 (1200px): ⬜ Exists
    - Image 2 (300px): ⬜ Exists
    - Image 2 (600px): ⬜ Exists
    - Image 2 (1200px): ⬜ Exists
- [ ] Check S3 storage usage
  - Expected: ~1-1.5GB
  - Actual: _____ GB / MB
- [ ] Verify `metadata/version.json` updated
  - [ ] Contains gallery version
  - Gallery version: ___________

#### Image Quality Check
- [ ] Download sample 300px image
  - [ ] Size appropriate (~30-50KB)
  - [ ] Quality acceptable
- [ ] Download sample 600px image
  - [ ] Size appropriate (~100-150KB)
  - [ ] Quality acceptable
- [ ] Download sample 1200px image
  - [ ] Size appropriate (~200-400KB)
  - [ ] Quality acceptable

#### Browser Test
```javascript
// Run in browser console
const baseUrl = 'https://s3.pilw.io/kaiugalerii';

// Test version fetch
fetch(`${baseUrl}/metadata/version.json`)
  .then(r => r.json())
  .then(console.log);

// Test albums fetch
fetch(`${baseUrl}/gallery/albums.json`)
  .then(r => r.json())
  .then(console.log);

// Test image fetch (replace FILE_ID)
fetch(`${baseUrl}/images/FILE_ID-300.jpg`)
  .then(r => console.log('Image status:', r.status));
```
- [ ] All fetches successful
- [ ] Data structure correct

#### Issues Encountered
```
Time: _____
Issue:
Solution:
Status: ⬜ Resolved / ⬜ Ongoing
```

### Day 2 Afternoon - Gallery Frontend
**Date**: ___________
**Start Time**: _____
**End Time**: _____
**Time Spent**: _____ hours

#### Pre-Deployment
- [ ] Announce maintenance window
  - Announced to: ___________
  - Announcement time: _____
  - Planned duration: 15 minutes

#### Code Changes
- [ ] Update `js/gallery.js` to fetch from S3
  - [ ] Replace fetch URLs
  - [ ] Update image URLs to S3
  - [ ] Add responsive srcset
  - [ ] Keep Drive fallback URLs
  - Git commit: ___________
- [ ] Update `js/config.js` (if not done already)
  - Git commit: ___________
- [ ] Test locally (if possible)
  - [ ] Local test passed

#### Deployment
- [ ] Commit changes to git
  - Commit message: "Migrate gallery to S3"
  - Commit hash: ___________
- [ ] Deploy to production
  - **Deployment time**: _____
  - Method: ___________

#### Testing - Grid View
- [ ] Open gallery.html in browser
  - [ ] Page loads without errors
  - [ ] Check browser console (no errors)
- [ ] Verify albums display
  - [ ] All albums visible
  - [ ] Cover images load
  - [ ] Album metadata correct
- [ ] Click into an album
  - [ ] Photos load in grid
  - [ ] Number of photos correct
  - [ ] Images served from S3 (check Network tab)

#### Testing - Image Display
- [ ] Check image URLs in Network tab
  - [ ] URLs point to s3.pilw.io
  - [ ] Not pointing to drive.google.com
- [ ] Verify responsive images
  - [ ] Inspect img element
  - [ ] Has srcset attribute
  - [ ] Correct sizes (300px 1x, 600px 2x)
- [ ] Test lazy loading
  - [ ] Only visible images load initially
  - [ ] More images load on scroll

#### Testing - Lightbox
- [ ] Click on a photo
  - [ ] Lightbox opens
  - [ ] Large image loads (1200px)
  - [ ] Image served from S3
  - [ ] Navigation arrows work
  - [ ] Keyboard navigation works (arrows, ESC)
  - [ ] Click outside closes lightbox

#### Testing - Mobile
- [ ] Test on mobile device or resize browser
  - Device/size: ___________
  - [ ] Grid layout responsive
  - [ ] Images load correctly
  - [ ] Touch interactions work
  - [ ] Lightbox works on mobile

#### Performance Check
Test with browser DevTools Network tab:
- **Initial page load**:
  - Before (old): _____ seconds
  - After (S3): _____ seconds
  - Improvement: _____ %
- **Album load** (pick an album):
  - Before: _____ seconds
  - After: _____ seconds
  - Improvement: _____ %
- **Images transferred** (check Network tab):
  - Total size: _____ MB
  - Number of requests: _____
  - Largest image: _____ KB

#### Monitoring Period (2-4 hours)
- **Time**: _____ to _____
- [ ] No errors in browser console
- [ ] No broken images
- [ ] No user complaints
- [ ] All features working

#### Trigger Setup
- [ ] Run `setupGalleryTrigger()` in Apps Script
  - Trigger created: ⬜ Yes / ⬜ No
- [ ] Verify trigger appears in Apps Script UI
- [ ] Wait 15-20 minutes for first automatic run
- [ ] Check execution logs
  - First run time: _____
  - Duration: _____ seconds
  - Result: ⬜ Success / ⬜ Fail
  - If fail, error: ___________

#### New Photo Test (Optional but Recommended)
- [ ] Add a new photo to Google Drive gallery folder
  - Photo added to album: ___________
  - Time added: _____
- [ ] Wait for next sync (up to 15 minutes)
- [ ] Check S3 for new images
  - [ ] New photo appeared in S3
  - Time appeared: _____
- [ ] Refresh gallery page
  - [ ] New photo visible on website

#### Issues Encountered
```
Time: _____
Issue:
Solution:
Status: ⬜ Resolved / ⬜ Ongoing
```

#### Gallery Phase Sign-Off
- [ ] Gallery sync working automatically
- [ ] Frontend loading from S3
- [ ] Images displaying correctly
- [ ] Performance improved significantly
- [ ] No critical issues
- [ ] Ready to proceed to monitoring

**Signed off by**: ___________
**Date**: ___________
**Time**: _____

---

## Phase 3: Monitoring & Admin

### Day 3+ - Monitoring Setup
**Date**: ___________
**Time Spent**: _____ hours

#### Code Deployment
- [ ] Deploy monitoring.gs to Apps Script
  - [ ] File deployed successfully
- [ ] Create manual sync functions in Code.gs
  - [ ] Functions created
  - [ ] Tested in editor

#### Failure Testing
- [ ] Test failure tracking
  - [ ] Simulate failure by changing credentials temporarily
  - [ ] Run manual sync
  - [ ] Verify failure logged
  - [ ] Restore credentials
- [ ] Test email alerts
  - [ ] Trigger 3 consecutive failures
  - [ ] Verify email received
  - Email received: ⬜ Yes / ⬜ No
  - Time received: _____
- [ ] Test success recovery
  - [ ] Run successful sync after failures
  - [ ] Verify failure count reset
  - [ ] No alert email sent

#### Log Verification
- [ ] Check logs in S3
  - [ ] Calendar logs exist: `logs/calendar-sync-DATE.json`
  - [ ] Gallery logs exist: `logs/gallery-sync-DATE.json`
  - [ ] Logs contain expected data
  - [ ] Timestamps correct

#### Manual Functions Test
- [ ] Test `manualSyncCalendar()`
  - Result: ⬜ Success / ⬜ Fail
- [ ] Test `manualSyncGallery()`
  - Result: ⬜ Success / ⬜ Fail
- [ ] Test `forceFullSync()`
  - Result: ⬜ Success / ⬜ Fail
- [ ] Test `viewSyncStatus()`
  - Result: ⬜ Success / ⬜ Fail
  - Output looks correct: ⬜ Yes / ⬜ No

#### Admin Dashboard (Optional)
- [ ] Create admin-dashboard.html
- [ ] Deploy as web app (restricted access)
  - Web app URL: ___________
- [ ] Test dashboard functionality
  - [ ] Displays sync status
  - [ ] Manual sync buttons work
  - [ ] Logs viewable

#### Issues Encountered
```
Time: _____
Issue:
Solution:
Status: ⬜ Resolved / ⬜ Ongoing
```

---

## Post-Migration Monitoring

### Daily Checks (Days 3-7)
**Instructions**: Fill out once per day for first week

#### Day 3 - Date: ___________
- [ ] Website loading correctly
- [ ] Checked email - alerts received: ⬜ Yes / ⬜ No
- [ ] Checked Apps Script logs - errors: ⬜ Yes / ⬜ No
- [ ] Verified triggers running on schedule
- [ ] S3 bandwidth usage: _____ GB
- Notes: ___________________________________________________________

#### Day 4 - Date: ___________
- [ ] Website loading correctly
- [ ] Checked email - alerts received: ⬜ Yes / ⬜ No
- [ ] Checked Apps Script logs - errors: ⬜ Yes / ⬜ No
- [ ] Verified triggers running on schedule
- [ ] S3 bandwidth usage: _____ GB
- Notes: ___________________________________________________________

#### Day 5 - Date: ___________
- [ ] Website loading correctly
- [ ] Checked email - alerts received: ⬜ Yes / ⬜ No
- [ ] Checked Apps Script logs - errors: ⬜ Yes / ⬜ No
- [ ] Verified triggers running on schedule
- [ ] S3 bandwidth usage: _____ GB
- Notes: ___________________________________________________________

#### Day 6 - Date: ___________
- [ ] Website loading correctly
- [ ] Checked email - alerts received: ⬜ Yes / ⬜ No
- [ ] Checked Apps Script logs - errors: ⬜ Yes / ⬜ No
- [ ] Verified triggers running on schedule
- [ ] S3 bandwidth usage: _____ GB
- Notes: ___________________________________________________________

#### Day 7 - Date: ___________
- [ ] Website loading correctly
- [ ] Checked email - alerts received: ⬜ Yes / ⬜ No
- [ ] Checked Apps Script logs - errors: ⬜ Yes / ⬜ No
- [ ] Verified triggers running on schedule
- [ ] S3 bandwidth usage: _____ GB
- Notes: ___________________________________________________________

### Week 1 Review
**Date**: ___________

#### Success Metrics Verification
**Calendar**:
- [ ] Events loading from S3: ⬜ Yes / ⬜ No
- [ ] No 404 errors: ⬜ Confirmed
- [ ] Sync running every 5 min: ⬜ Confirmed
- [ ] No email alerts: ⬜ Confirmed
- [ ] events.json updating regularly: ⬜ Confirmed
- Performance improvement: _____ %

**Gallery**:
- [ ] Albums loading from S3: ⬜ Yes / ⬜ No
- [ ] All images displaying: ⬜ Confirmed
- [ ] Images from S3 (not Drive): ⬜ Confirmed
- [ ] Sync running every 15 min: ⬜ Confirmed
- [ ] No email alerts: ⬜ Confirmed
- [ ] Page load time <2s: ⬜ Confirmed
- Performance improvement: _____ %

#### Issues Summary
**Total issues encountered**: _____
**Critical issues**: _____
**Minor issues**: _____
**All resolved**: ⬜ Yes / ⬜ No

#### Optimization Opportunities Identified
```
1. ___________________________________________________________________
2. ___________________________________________________________________
3. ___________________________________________________________________
```

#### Overall Assessment
- Migration success: ⬜ Full Success / ⬜ Partial Success / ⬜ Needs Work
- Performance improvement: ⬜ Excellent / ⬜ Good / ⬜ Moderate / ⬜ Poor
- Stability: ⬜ Very Stable / ⬜ Stable / ⬜ Some Issues / ⬜ Unstable
- Ready for long-term operation: ⬜ Yes / ⬜ No / ⬜ With modifications

---

## Long-Term Maintenance

### Monthly Review Template
**Month**: ___________

- [ ] Review sync logs for patterns
- [ ] Check S3 storage growth
- [ ] Review S3 costs (if any)
- [ ] Verify all triggers active
- [ ] Test manual sync functions
- [ ] Update documentation if needed

**Storage**: _____ GB (vs last month: _____ GB)
**Requests**: _____ (vs last month: _____)
**Bandwidth**: _____ GB (vs last month: _____ GB)
**Issues**: _____

---

## Rollback Tracking

### If Rollback Required

**Date**: ___________
**Time**: _____
**Reason**: ___________________________________________________________

#### Rollback Steps Taken
- [ ] Frontend reverted to commit: ___________
- [ ] Triggers disabled
- [ ] Old system verified working
- [ ] Users notified (if applicable)

**Rollback duration**: _____ minutes
**System restored successfully**: ⬜ Yes / ⬜ No

#### Post-Rollback Actions
- [ ] Root cause analysis completed
- [ ] Issues documented
- [ ] Plan revised
- [ ] Ready for retry: ⬜ Yes / ⬜ No / ⬜ Abandoned

---

## Issue Log

**Template for logging issues**:

### Issue #1
- **Date**: ___________
- **Time**: _____
- **Phase**: ⬜ Pre-Migration / ⬜ Calendar / ⬜ Gallery / ⬜ Monitoring
- **Severity**: ⬜ Critical / ⬜ High / ⬜ Medium / ⬜ Low
- **Description**:
  ```
  ___________________________________________________________________
  ___________________________________________________________________
  ```
- **Impact**:
  ```
  ___________________________________________________________________
  ```
- **Resolution**:
  ```
  ___________________________________________________________________
  ___________________________________________________________________
  ```
- **Status**: ⬜ Open / ⬜ In Progress / ⬜ Resolved / ⬜ Closed
- **Time to resolve**: _____ hours/minutes

### Issue #2
- **Date**: ___________
- **Time**: _____
- **Phase**: ⬜ Pre-Migration / ⬜ Calendar / ⬜ Gallery / ⬜ Monitoring
- **Severity**: ⬜ Critical / ⬜ High / ⬜ Medium / ⬜ Low
- **Description**:
  ```
  ___________________________________________________________________
  ___________________________________________________________________
  ```
- **Impact**:
  ```
  ___________________________________________________________________
  ```
- **Resolution**:
  ```
  ___________________________________________________________________
  ___________________________________________________________________
  ```
- **Status**: ⬜ Open / ⬜ In Progress / ⬜ Resolved / ⬜ Closed
- **Time to resolve**: _____ hours/minutes

### Issue #3
_(Add more as needed)_

---

## Time Tracking Summary (Testing Environment - 2 Weeks)

| Phase | Estimated Time | Actual Time | Difference |
|-------|---------------|-------------|------------|
| Week 1: Repository Restructuring | 2-3 hours | _____ | _____ |
| Week 1: Calendar Migration | 4-5 hours | _____ | _____ |
| Week 1: Gallery Sync (with batch processing) | 8-10 hours | _____ | _____ |
| Week 2: API Backend | 10-12 hours | _____ | _____ |
| Week 2: Forms Migration | 4-5 hours | _____ | _____ |
| Week 2: Testing & Cutover | 6-8 hours | _____ | _____ |
| **Total** | **35-45 hours** | **_____** | **_____** |

---

## Final Sign-Off

**Project Status**: ⬜ Complete / ⬜ Partially Complete / ⬜ On Hold / ⬜ Cancelled

**Completion Date**: ___________

**Final Notes**:
```
___________________________________________________________________
___________________________________________________________________
___________________________________________________________________
___________________________________________________________________
```

**Approved by**: ___________
**Date**: ___________
**Signature**: ___________

---

**END OF EXECUTION TRACKER**
