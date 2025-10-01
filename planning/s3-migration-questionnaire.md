# S3 Migration Architecture - Questions & Decisions

## Project Goal
Migrate gallery and calendar from Apps Script direct serving to S3-based architecture:
- Apps Script syncs data to S3 on schedule (not called from webpage)
- Frontend fetches data directly from S3
- Gallery syncs every 15 minutes
- Calendar syncs every 5 minutes

---

## Questions Requiring Answers

### 1. Pilvio S3 Configuration

**Q1.1: What is your Pilvio S3 endpoint URL?**
```
Answer: s3.pilw.io
Example: s3.pilvio.com or compatible-endpoint.pilvio.com
```

**Q1.2: Is it standard AWS S3 API compatible?**
```
Answer: [x] Yes, standard S3 API
        [ ] No, custom API (please describe)
        [ ] Not sure
```

**Q1.3: Do you have S3 credentials?**
```
Access Key ID: G1ZW8BDISGFYVG2SIKZ7
Secret Access Key: TEXyfkbNFK4Vff8YBxCS9onsuw9KQD0SLb31VQFO
Bucket Name: kaiugalerii
Region (if applicable): _____________________________________
```

**Q1.4: Should the S3 bucket be public-read or private with signed URLs?**
```
Answer: [x] Public-read (simpler, faster, recommended for this use case)
        [ ] Private with signed URLs (more secure but adds complexity)

Note: Public-read means anyone with the URL can read the JSON files,
but they can't list files or modify anything. This is standard for
websites serving public content.
```

---

### 2. Image Storage Strategy

**Q2.1: Where should images be stored?**
```
Answer: [ ] Option A: Keep all images in Google Drive
           - S3 only stores metadata (JSON with Drive URLs)
           - Simplest, no image copying needed
           - Still depends on Drive's performance

        [x] Option B: Copy ALL images to S3
           - Best performance, full control
           - Requires more storage/bandwidth
           - Apps Script copies images on each sync

        [ ] Option C: Hybrid - Copy only thumbnails to S3
           - Thumbnails (~300px) in S3 for fast grid loading
           - Full-resolution stays in Drive for lightbox
           - Balanced approach (RECOMMENDED)
           - Moderate storage usage
```

**Q2.2: Current gallery statistics (rough estimates are fine):**
```
Number of albums: 20
Number of total photos: 200
Approximate total size of all photos: _____ GB
Average photo size: _____ MB
```

**Q2.3: If copying images to S3, should we pre-generate thumbnails?**
```
Answer: [x] Yes, generate multiple sizes (300px, 600px, 1200px)
        [ ] No, just copy originals and let Drive handle thumbnails
        [ ] Only if Option C above is chosen
```

---

### 3. S3 Data Structure

**Q3.1: Proposed S3 bucket structure (review and approve):**
```
s3://your-bucket-name/
├── gallery/
│   ├── albums.json                    # List of all albums with metadata
│   └── albums/
│       ├── album-{folder-id}.json     # Photos in each album
│       ├── album-{folder-id}.json
│       └── ...
├── calendar/
│   └── events.json                    # All calendar events
├── thumbnails/                        # (Optional, if copying images)
│   ├── {file-id}-300.jpg
│   ├── {file-id}-600.jpg
│   └── ...
└── metadata/
    ├── version.json                   # Version info for cache busting
    └── last-sync.json                 # Sync status and timestamps

Answer: [x] Approve this structure
        [ ] Suggest modifications (describe below):

Modifications:
_________________________________________________________________
_________________________________________________________________
```

---

### 4. Sync Strategy

**Q4.1: Should sync be incremental or always full?**
```
Answer: [x] Smart sync - Only sync if Drive folder modified (RECOMMENDED)
           - Checks folder.getLastUpdated() before syncing
           - Saves quota and execution time

        [ ] Always full sync
           - Re-processes everything every time
           - Simpler logic but more resource intensive
```

**Q4.2: How should deleted albums/photos be handled?**
```
Answer: [x] Detect and remove from S3 immediately
        [ ] Keep in S3 until next full sync
        [ ] Manual cleanup only
```

**Q4.3: Should there be a manual sync trigger?**
```
Answer: [x] Yes, add a manual trigger function I can run from Apps Script editor
        [ ] No, automatic triggers only
```

---

### 5. Monitoring & Error Handling

**Q5.1: Email alerts for sync failures?**
```
Answer: [ ] Yes, send email on every failure
        [x] Yes, but only after 3 consecutive failures
        [ ] No email alerts

If yes, email address: kaur.kiisler@gmail.com
```

**Q5.2: Where should sync logs be stored?**
```
Answer: [ ] Google Sheets (easy to view/analyze)
        [x] S3 (logs/sync-history.json)
        [ ] Apps Script Logger only (Cloud Console)
        [ ] No logging needed
```

**Q5.3: What's acceptable data staleness before showing error?**
```
Answer: Gallery can be stale up to 60 minutes
        Calendar can be stale up to 60 minutes

Note: This determines when frontend shows "Unable to load" vs displaying
slightly outdated data.
```

---

### 6. Cache & Performance

**Q6.1: Cache-Control headers for S3 objects:**
```
Answer: [ ] Short TTL (5 minutes) - Always fresh, more S3 requests
        [ ] Medium TTL (1 hour) - Balanced
        [x] Long TTL (24 hours) with version param - Fastest, requires version bumping (RECOMMENDED)
```

**Q6.2: How should cache busting work?**
```
Answer: [ ] Version query parameter (?v=timestamp)
           Example: albums.json?v=1234567890

        [ ] Content hash in filename
           Example: albums-a3f5b2c.json

        [x] Version in separate file
           Fetch version.json first, then use version for other files
           (RECOMMENDED)
```

---

### 7. Migration Plan

**Q7.1: Preferred migration approach:**
```
Answer: [ ] Parallel operation (RECOMMENDED)
           - Apps Script writes to BOTH old cache AND new S3
           - Frontend tries S3 first, falls back to Apps Script
           - Gradual rollout, easy rollback
           - Phase 1: Dual write
           - Phase 2: Frontend uses S3
           - Phase 3: Remove Apps Script doGet endpoint

        [x] Hard cutover
           - Deploy everything at once
           - Faster but riskier
           - Requires testing window
```

**Q7.2: Testing strategy:**
```
Answer: [ ] Test on staging/development site first
        [ ] Test with URL parameter (?use_s3=true) on production
        [x] Deploy directly to production
        [ ] Other (describe):

_________________________________________________________________
```

**Q7.3: Acceptable downtime during migration:**
```
Answer: [ ] Zero downtime required
        [ ] Brief downtime (< 5 minutes) acceptable
        [x] Can schedule maintenance window
```

---

### 8. Timeline & Priority

**Q8.1: When do you want this implemented?**
```
Answer: [x] ASAP (this week)
        [ ] Next week
        [ ] Within 2 weeks
        [ ] Within a month
        [ ] No rush, when convenient
```

**Q8.2: Which should be implemented first?**
```
Answer: [x] Calendar (smaller dataset, easier to test)
        [ ] Gallery (main pain point)
        [ ] Both simultaneously
```

**Q8.3: Estimated time you can dedicate to testing/feedback:**
```
Answer: 4 hours per week
```

---

### 9. Additional Features (Optional)

**Q9.1: Would you like a simple admin dashboard to:**
```
[ ] Trigger manual sync
[ ] View sync status
[ ] View sync logs
[ ] Purge cache/force full re-sync
[ ] Monitor S3 usage

Note: Can be a simple HTML page with buttons that call Apps Script functions
```

**Q9.2: Should we add retry logic?**
```
Answer: [x] Yes, retry failed S3 uploads up to 3 times
        [ ] No, fail fast and alert
```

**Q9.3: Compression for JSON files?**
```
Answer: [ ] Yes, gzip compress JSON before uploading to S3
        [x] No, keep as plain JSON
```

---

## Architecture Summary (Review & Approve)

Based on the recommended approach:

### Data Flow:
```
1. Google Drive (images) ←───────┐
2. Google Calendar (events) ←────┤
                                 │
                    Apps Script (Private, Scheduled)
                         │ Timer Triggers:
                         │ - Gallery: every 15 min
                         │ - Calendar: every 5 min
                         │
                         │ Smart Sync:
                         │ - Check if changed
                         │ - Generate JSON
                         │ - Upload to S3
                         │
                         ▼
              S3 / Pilvio.com (Static JSON)
                         │
                         │ Simple fetch()
                         │
                         ▼
              Website Frontend (gallery.html, events.html)
```

### Key Benefits:
- ✅ No more Apps Script "anyone" publishing
- ✅ No more manual redeployments breaking site
- ✅ Fast S3 serving with proper cache headers
- ✅ Decoupled architecture
- ✅ Predictable, minimal costs

### Approve this architecture?
```
Answer: [x] Yes, proceed with implementation
        [ ] No, I have concerns (describe below):

Concerns:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Next Steps

Once you've filled out this questionnaire:
1. Save this file
2. Let me know it's ready for review
3. I'll create a detailed implementation plan with code
4. We'll review the plan together
5. Proceed with implementation upon your approval

---

## Notes / Additional Questions

Use this space for any additional questions, concerns, or requirements:

```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```
