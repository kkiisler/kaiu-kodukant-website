# Google API Migration - Implementation Progress

**Started**: 2025-10-16
**Status**: In Progress

## Overview
Migrating from Google Apps Script (weekly reauth required) to Node.js backend with Google API Key (no reauth needed).

---

## Phase 1: Calendar Sync ⏳ IN PROGRESS
**Estimated**: 2-3 hours
**Started**: 2025-10-16

### Tasks
- [ ] 1.1 Install dependencies (googleapis)
- [ ] 1.2 Create calendar sync service (`api/services/calendar-sync.js`)
- [ ] 1.3 Create S3 utility service (`api/services/s3-utils.js`)
- [ ] 1.4 Add configuration to `api/config/index.js`
- [ ] 1.5 Create calendar sync endpoint (`api/routes/calendar.js`)
- [ ] 1.6 Set up cron job for automated sync
- [ ] 1.7 Test calendar sync manually
- [ ] 1.8 Update frontend to use new S3 calendar data
- [ ] 1.9 Verify end-to-end calendar functionality

### Notes
- API Key configured: ✅
- Environment variables added: ✅
- Backend location: `/home/kkiisler/kaiu-kodukant-website/api`

---

## Phase 2: Gallery Sync ⏸️ PENDING
**Estimated**: 3-4 hours
**Status**: Not started

### Tasks
- [ ] 2.1 Create gallery sync service with incremental updates
- [ ] 2.2 Add SQLite database for sync state tracking
- [ ] 2.3 Implement image processing with Sharp
- [ ] 2.4 Create gallery sync endpoint
- [ ] 2.5 Set up cron job for automated sync
- [ ] 2.6 Test gallery sync manually
- [ ] 2.7 Update frontend to use new S3 gallery data
- [ ] 2.8 Verify end-to-end gallery functionality

### Notes
- Pending Phase 1 completion

---

## Phase 3: Monitoring & Cleanup ⏸️ PENDING
**Estimated**: 2-3 hours
**Status**: Not started

### Tasks
- [ ] 3.1 Create monitoring endpoints
- [ ] 3.2 Update admin dashboard
- [ ] 3.3 Add health checks
- [ ] 3.4 Test all monitoring features
- [ ] 3.5 Disable Google Apps Script triggers
- [ ] 3.6 Document new system
- [ ] 3.7 Final verification

### Notes
- Pending Phase 1 & 2 completion

---

## Timeline

| Phase | Status | Started | Completed | Duration |
|-------|--------|---------|-----------|----------|
| Phase 1: Calendar | 🟡 In Progress | 2025-10-16 | - | - |
| Phase 2: Gallery | ⚪ Pending | - | - | - |
| Phase 3: Monitoring | ⚪ Pending | - | - | - |

---

## Issues & Blockers

None currently.

---

## Testing Checklist

### Phase 1 Testing
- [ ] Calendar events load in frontend
- [ ] Events are properly formatted for FullCalendar.js
- [ ] S3 upload successful
- [ ] Cron job runs on schedule
- [ ] Error handling works correctly

### Phase 2 Testing
- [ ] Gallery albums load in frontend
- [ ] Images are properly processed and uploaded
- [ ] Incremental sync resumes correctly
- [ ] State tracking works
- [ ] Batch processing handles large galleries

### Phase 3 Testing
- [ ] Monitoring dashboard shows correct status
- [ ] Health checks return proper data
- [ ] Alerts work as expected

---

## Deployment Notes

- Production VM: `kkiisler@kaiukodukant.ee`
- Backend path: `/home/kkiisler/kaiu-kodukant-website/api`
- Environment file: `/home/kkiisler/kaiu-kodukant-website/docker/.env`
- Deployment: Docker containers (web and api)

---

## Next Steps

1. Install googleapis dependency
2. Create calendar sync service
3. Create S3 utilities
4. Set up calendar endpoint
5. Configure cron job
