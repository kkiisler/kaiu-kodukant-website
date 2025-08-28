# Calendar S3 Implementation Checklist

## Project Information
**Project**: Calendar S3/CloudFront Optimization  
**Bucket**: `PILVIO_BUCKET_NAME` *(Your Pilvio bucket)*  
**Region**: `eu-central-1`  
**Start Date**: ___________  
**Target Go-Live**: ___________  
**Responsible**: ___________

---

## Phase 1: AWS Infrastructure Setup ⏱️ 2 hours

### IAM Configuration
- [ ] Log into AWS Console with Pilvio account
- [ ] Navigate to IAM → Users
- [ ] Create user: `kaiu-calendar-sync`
- [ ] Create custom policy: `KaiuCalendarS3WritePolicy`
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["s3:PutObject", "s3:PutObjectAcl"],
        "Resource": "arn:aws:s3:::PILVIO_BUCKET_NAME/sites/kaiu-kodukant/calendar/*"
      }
    ]
  }
  ```
- [ ] Attach policy to user
- [ ] Generate access keys
- [ ] **SAVE CREDENTIALS SECURELY:**
  - Access Key ID: _________________
  - Secret Access Key: _________________

### S3 Bucket Setup
- [ ] Verify bucket exists: `PILVIO_BUCKET_NAME`
- [ ] Create folder structure:
  ```
  /sites
    /kaiu-kodukant
      /calendar
        /archive
  ```
- [ ] Enable versioning (optional but recommended)
- [ ] Configure CORS (if serving directly):
  ```xml
  <CORSConfiguration>
    <CORSRule>
      <AllowedOrigin>https://kaiukodukant.ee</AllowedOrigin>
      <AllowedOrigin>https://www.kaiukodukant.ee</AllowedOrigin>
      <AllowedOrigin>https://tore.kaiukodukant.ee</AllowedOrigin>
      <AllowedMethod>GET</AllowedMethod>
      <MaxAgeSeconds>86400</MaxAgeSeconds>
    </CORSRule>
  </CORSConfiguration>
  ```

### CloudFront Distribution
- [ ] Create new distribution or use existing
- [ ] **Distribution ID**: _________________
- [ ] **Distribution URL**: _________________
- [ ] Configure origin:
  - Origin Domain: `PILVIO_BUCKET_NAME.s3.eu-central-1.amazonaws.com`
  - Origin Path: `/sites/kaiu-kodukant/calendar`
- [ ] Create Origin Access Control (OAC)
- [ ] Update S3 bucket policy with OAC
- [ ] Configure cache behavior:
  - TTL: 900 seconds (15 minutes)
  - Compress objects: Yes
  - Query strings: Forward `v` parameter
- [ ] Configure CORS headers in response policy
- [ ] Optional: Set up custom domain `calendar.kaiukodukant.ee`
  - [ ] Request/import SSL certificate
  - [ ] Add CNAME to distribution
  - [ ] Update DNS records

### Testing AWS Setup
- [ ] Upload test file to S3:
  ```bash
  echo '{"test":true}' > test.json
  aws s3 cp test.json s3://PILVIO_BUCKET_NAME/sites/kaiu-kodukant/calendar/test.json
  ```
- [ ] Access via CloudFront: `https://DISTRIBUTION.cloudfront.net/test.json`
- [ ] Verify CORS headers with curl:
  ```bash
  curl -H "Origin: https://kaiukodukant.ee" -I https://DISTRIBUTION.cloudfront.net/test.json
  ```
- [ ] Check cache headers are present
- [ ] Delete test file

**Phase 1 Completed**: _____ **Verified by**: _____

---

## Phase 2: Apps Script Setup ⏱️ 1.5 hours

### Google Calendar Configuration
- [ ] Open Google Calendar
- [ ] Find calendar to sync
- [ ] Copy Calendar ID: _________________
- [ ] Verify calendar is accessible

### Apps Script Project
- [ ] Create new Apps Script project or use existing
- [ ] Project name: `Kaiu Calendar S3 Sync`
- [ ] **Script ID**: _________________
- [ ] **Script URL**: _________________

### Add Script Properties
Navigate to Project Settings → Script Properties and add:

| Property | Value | Added |
|----------|-------|-------|
| AWS_ACCESS_KEY_ID | *(from Phase 1)* | [ ] |
| AWS_SECRET_ACCESS_KEY | *(from Phase 1)* | [ ] |
| AWS_REGION | eu-central-1 | [ ] |
| S3_BUCKET | PILVIO_BUCKET_NAME | [ ] |
| S3_KEY | sites/kaiu-kodukant/calendar/calendar.json | [ ] |
| GOOGLE_CALENDAR_ID | *(calendar ID)* | [ ] |
| ADMIN_EMAIL | admin@kaiukodukant.ee | [ ] |

### Implement Code
- [ ] Copy main sync function from `apps-script-s3-sync.md`
- [ ] Copy AWS Signature v4 functions
- [ ] Copy helper functions
- [ ] Copy test functions
- [ ] Save project

### Test Sync
- [ ] Run `testCalendarSync()` function
- [ ] Check console for success messages
- [ ] Verify JSON structure is correct
- [ ] Confirm upload to S3 succeeded
- [ ] Check file at CloudFront URL

### Schedule Trigger
- [ ] Run `setupTrigger()` function
- [ ] Verify trigger created (every 15 minutes)
- [ ] Check first automated sync after 15 minutes
- [ ] Verify no errors in logs

**Phase 2 Completed**: _____ **Verified by**: _____

---

## Phase 3: Frontend Updates ⏱️ 1 hour

### Configuration Updates
- [ ] Open `js/config.js`
- [ ] Add S3/CloudFront URL:
  ```javascript
  window.CALENDAR_S3_URL = 'https://DISTRIBUTION.cloudfront.net/calendar.json';
  ```
- [ ] Add calendar configuration:
  ```javascript
  window.CALENDAR_CONFIG = {
    useS3: false, // Start with false for testing
    s3Url: window.CALENDAR_S3_URL,
    fallbackUrl: window.GOOGLE_APPS_SCRIPT_URL,
    cacheTime: 900000,
    timeout: 3000,
    enableLocalCache: true
  };
  ```

### Update calendar.js
- [ ] Backup existing `calendar.js`
- [ ] Add new loading functions from `frontend-migration.md`
- [ ] Keep existing JSONP as fallback
- [ ] Add performance monitoring
- [ ] Add error handling
- [ ] Add cache management

### Test in Development
- [ ] Test with `useS3: false` (Apps Script only)
- [ ] Verify calendar loads correctly
- [ ] Test with `useS3: true` (S3 primary)
- [ ] Verify S3 loading works
- [ ] Test fallback (block CloudFront URL)
- [ ] Verify fallback kicks in
- [ ] Test cache functionality
- [ ] Check localStorage for cached data

**Phase 3 Completed**: _____ **Verified by**: _____

---

## Phase 4: Testing & Validation ⏱️ 2 hours

### Functionality Testing
- [ ] Calendar displays correctly
- [ ] Events load from S3
- [ ] Event details modal works
- [ ] Upcoming events list populates
- [ ] Navigation (prev/next month) works
- [ ] Refresh button works

### Performance Testing
- [ ] Measure load time with S3: _____ms
- [ ] Measure load time with cache: _____ms
- [ ] Compare to Apps Script baseline: _____ms
- [ ] Verify >90% improvement

### Cross-Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Error Scenarios
- [ ] S3 unavailable (use fallback)
- [ ] CloudFront timeout
- [ ] Invalid JSON response
- [ ] Network offline
- [ ] Calendar has no events

### Cache Testing
- [ ] Initial load caches data
- [ ] Reload uses cache
- [ ] Cache expires after 15 minutes
- [ ] Manual refresh clears cache
- [ ] Cache survives page navigation

**Phase 4 Completed**: _____ **Verified by**: _____

---

## Phase 5: Production Deployment ⏱️ 1 hour

### Pre-Deployment
- [ ] All previous phases completed
- [ ] Team informed of deployment
- [ ] Rollback plan reviewed
- [ ] Monitoring tools ready

### Deploy Frontend
- [ ] Set `useS3: true` in config.js
- [ ] Deploy updated files:
  - [ ] js/config.js
  - [ ] js/calendar.js
- [ ] Clear CDN cache if using one
- [ ] Test immediately after deployment

### Monitor Initial Hours
- [ ] Check Apps Script logs
- [ ] Monitor CloudFront metrics
- [ ] Check browser console for errors
- [ ] Verify calendar loads for users
- [ ] Monitor performance metrics

### Post-Deployment (Day 1)
- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Document any issues
- [ ] Adjust cache times if needed

**Phase 5 Completed**: _____ **Verified by**: _____

---

## Phase 6: Monitoring & Optimization ⏱️ Ongoing

### Week 1 Monitoring
- [ ] Daily check of sync logs
- [ ] Review CloudFront analytics
- [ ] Monitor error rates
- [ ] Check cache hit rates
- [ ] Review performance metrics

### Optimization Tasks
- [ ] Fine-tune cache duration
- [ ] Optimize JSON size
- [ ] Review sync frequency
- [ ] Consider compression
- [ ] Add CloudWatch alarms

### Documentation
- [ ] Update README with S3 setup
- [ ] Document AWS credentials location
- [ ] Create runbook for issues
- [ ] Train team on monitoring
- [ ] Document rollback procedure

---

## Configuration Summary

Fill in these values as you complete setup:

```javascript
// AWS Configuration
const AWS_CONFIG = {
  // IAM User
  accessKeyId: '_______________________',
  secretAccessKey: '_______________________',
  
  // S3 Settings
  region: 'eu-central-1',
  bucket: '_______________________',
  key: 'sites/kaiu-kodukant/calendar/calendar.json',
  
  // CloudFront
  distributionId: '_______________________',
  distributionUrl: 'https://_______________________',
  
  // Google Calendar
  calendarId: '_______________________',
  
  // Monitoring
  adminEmail: '_______________________'
};
```

---

## Rollback Procedure

If issues occur, follow these steps:

### Immediate Rollback (< 5 minutes)
1. [ ] Set `useS3: false` in config.js
2. [ ] Deploy updated config.js
3. [ ] Clear browser caches
4. [ ] Verify calendar loads via Apps Script

### Investigation
1. [ ] Check Apps Script logs for sync errors
2. [ ] Review CloudFront access logs
3. [ ] Check S3 bucket for calendar.json
4. [ ] Verify JSON structure is valid
5. [ ] Test CloudFront URL directly

### Fix and Retry
1. [ ] Fix identified issues
2. [ ] Test in development
3. [ ] Set `useS3: true`
4. [ ] Monitor closely

---

## Success Criteria

All items must be checked for project completion:

- [ ] Calendar loads in <100ms (cached)
- [ ] Calendar loads in <500ms (uncached)
- [ ] Zero CORS errors
- [ ] Fallback works when S3 fails
- [ ] Sync runs every 15 minutes
- [ ] No user-reported issues
- [ ] 90% cache hit rate
- [ ] Performance metrics tracked

---

## Sign-offs

| Phase | Completed By | Date | Signature |
|-------|--------------|------|-----------|
| AWS Setup | | | |
| Apps Script | | | |
| Frontend | | | |
| Testing | | | |
| Production | | | |
| Monitoring | | | |

### Final Approval
- **Technical Lead**: _________________ Date: _____ Signature: _____
- **Project Owner**: _________________ Date: _____ Signature: _____

---

## Notes & Issues Log

### Issues Encountered
| Date | Issue | Resolution | Resolved By |
|------|-------|------------|-------------|
| | | | |
| | | | |

### Lessons Learned
- 
- 
- 

---

**Checklist Last Updated**: ___________  
**Updated By**: ___________