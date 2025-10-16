# Google Apps Script to Node.js Backend Migration Plan

## Executive Summary

This document outlines the migration strategy from Google Apps Script to Node.js backend for syncing Google Calendar and Gallery data to S3. The primary driver for this migration is to eliminate the weekly reauthorization requirement that impacts system reliability.

## Current Challenges

- **Weekly Reauthorization**: Google Apps Script requires manual reauthorization approximately once per week
- **Limited Control**: Running on Google's infrastructure limits debugging and monitoring capabilities
- **Performance Constraints**: Apps Script has execution time limits and memory constraints
- **Split Codebase**: Sync logic is separated from main application code

## Proposed Solution

Migrate the sync functionality to the existing Node.js backend, leveraging public Google APIs to eliminate authentication requirements.

## Migration Benefits

### ✅ Reliability Improvements
- **No reauthorization needed** - Uses public calendar and drive APIs
- **Predictable execution** - Runs on controlled infrastructure
- **Better error handling** - Full control over retry logic and error recovery

### ✅ Operational Benefits
- **Unified codebase** - All application logic in one repository
- **Integrated monitoring** - Sync status visible in existing dashboard
- **Easier debugging** - Standard Node.js debugging tools available
- **Version control** - All code tracked in Git

### ✅ Performance Advantages
- **Faster execution** - Node.js is more efficient than Apps Script
- **Parallel processing** - Can process multiple albums simultaneously
- **Better caching** - Local caching of processed items
- **No timeout limits** - Can run long-running sync operations

### ✅ Cost Effectiveness
- **No additional infrastructure** - Uses existing Node.js backend
- **No Google Apps Script quotas** - Avoids potential quota limits
- **Reduced API calls** - Smarter incremental sync logic

## Implementation Phases

### Phase 1: Calendar Sync (2-3 hours)
Migrate calendar synchronization to Node.js backend
- Implement public calendar API access
- Set up cron job for periodic sync
- Add monitoring endpoints

### Phase 2: Gallery Sync (3-4 hours)
Migrate gallery synchronization with incremental updates
- Implement public Drive API access
- Add state management for incremental sync
- Process and resize images

### Phase 3: Enhanced Features (2-3 hours)
Add monitoring and administrative capabilities
- Real-time sync status dashboard
- Manual trigger controls
- Email alerts for failures
- Detailed logging and metrics

## Directory Structure

```
planning/google-plan/
├── README.md                    # This file
├── ARCHITECTURE.md             # Technical architecture details
├── COMPARISON.md               # Detailed comparison of approaches
├── implementation/
│   ├── phase1-calendar.md      # Calendar sync implementation guide
│   ├── phase2-gallery.md       # Gallery sync implementation guide
│   └── phase3-monitoring.md    # Monitoring and admin features
└── code-samples/
    ├── calendar-sync.js         # Sample calendar sync service
    ├── gallery-sync.js          # Sample gallery sync service
    └── s3-utils.js             # S3 utility functions
```

## Key Technical Decisions

1. **Use Public APIs**: Both calendar and gallery are public, eliminating OAuth complexity
2. **Leverage Existing Stack**: Use current Node.js, Express, SQLite infrastructure
3. **Incremental Sync**: Check S3 before uploading to avoid redundant transfers
4. **State Management**: Use SQLite to track sync progress and handle interruptions
5. **Error Recovery**: Implement robust retry logic with exponential backoff

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|-------------------|
| API Rate Limits | Implement request throttling and caching |
| Large Gallery Sync | Batch processing with state persistence |
| Network Failures | Retry logic with exponential backoff |
| Data Consistency | Verify uploads with checksums |
| Monitoring Gaps | Comprehensive logging and alerts |

## Success Criteria

- ✅ Zero manual interventions required
- ✅ Calendar updates visible within 5 minutes
- ✅ Gallery updates processed within 15 minutes
- ✅ 99.9% uptime for sync operations
- ✅ Clear visibility into sync status
- ✅ Automated error recovery

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| Phase 1: Calendar | 2-3 hours | None |
| Phase 2: Gallery | 3-4 hours | Phase 1 complete |
| Phase 3: Monitoring | 2-3 hours | Phase 1 & 2 complete |
| Testing & Deployment | 1-2 hours | All phases complete |
| **Total** | **8-12 hours** | |

## Next Steps

1. Review and approve this migration plan
2. Begin Phase 1 implementation (Calendar sync)
3. Test calendar sync thoroughly
4. Proceed with Phase 2 (Gallery sync)
5. Implement monitoring and admin features
6. Deploy to production
7. Disable Google Apps Script triggers

## Questions for Review

1. Are there any specific monitoring requirements beyond what's outlined?
2. Should we maintain Apps Script as a fallback initially?
3. Are there any additional calendar or gallery features needed?
4. What's the preferred deployment schedule?

---

*Document created: 2025-10-16*
*Author: Development Team*
*Status: Ready for Review*