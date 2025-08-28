# Calendar S3 Optimization Strategy

## Executive Summary

Replace the current JSONP-based calendar loading from Google Apps Script with a static JSON file served from S3/CloudFront. This approach eliminates CORS issues, reduces latency from 500-2000ms to 10-50ms, and provides true caching capabilities at multiple layers.

## Current Architecture Problems

### Performance Issues
- **Latency**: 500-2000ms per request to Apps Script
- **No Caching**: Apps Script doesn't set cache headers
- **CORS Complexity**: Requires JSONP workaround
- **Cold Starts**: Apps Script instances need warming
- **Rate Limits**: Apps Script has execution quotas

### Technical Debt
- JSONP is a legacy pattern with security implications
- No ability to use modern fetch() with proper error handling
- Cannot leverage browser caching effectively
- No CDN or edge caching possible

## Proposed S3/CloudFront Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                     BACKGROUND SYNC (Every 15 min)          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Google Calendar → Apps Script → Generate JSON → S3 Bucket  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND REQUEST PATH                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Browser → CloudFront Edge → S3 Static JSON                 │
│    ↑           ↓                                            │
│    └─── Cached Response (10-50ms)                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Background Process** (Google Apps Script):
   - Runs every 15 minutes via trigger
   - Fetches events from Google Calendar
   - Generates optimized JSON structure
   - Uploads to S3 with cache headers
   - Uses AWS Signature v4 for authentication

2. **Frontend Access** (Website):
   - Fetches static JSON from CloudFront URL
   - Benefits from edge caching (global)
   - Falls back to Apps Script if S3 fails
   - Uses standard fetch() API

### S3 Bucket Structure

Using existing Pilvio bucket with organized structure:
```
pilvio-bucket/
└── sites/
    └── kaiu-kodukant/
        └── calendar/
            ├── calendar.json          # Main calendar data
            ├── calendar-v2.json       # Version for testing
            └── archive/               # Historical versions
                └── calendar-20250828.json
```

## Performance Improvements

### Latency Reduction

| Layer | Current (Apps Script) | Proposed (S3/CF) | Improvement |
|-------|----------------------|------------------|-------------|
| First Request | 500-2000ms | 30-50ms | 95% faster |
| Cached Request | 500-2000ms | 10-20ms | 99% faster |
| Global Users | 1000-3000ms | 20-40ms | 98% faster |

### Caching Strategy

```
Browser Cache (15 min) → CloudFront Edge (15 min) → S3 Origin
                ↓                    ↓                    ↓
             instant            10-20ms              30-50ms
```

**Cache Headers Configuration**:
```
Cache-Control: public, max-age=900, s-maxage=900
ETag: [MD5 hash of content]
Last-Modified: [Upload timestamp]
```

## JSON Structure Optimization

### Minimal Event Data
```json
{
  "version": "20250828T1230",
  "generated": "2025-08-28T12:30:00Z",
  "events": [
    {
      "id": "event_123",
      "title": "Küla koosolek",
      "start": "2025-09-01T18:00:00Z",
      "end": "2025-09-01T20:00:00Z",
      "allDay": false,
      "location": "Kaiu Rahvamaja"
    }
  ],
  "meta": {
    "totalEvents": 25,
    "timeRange": {
      "start": "2025-08-21T00:00:00Z",
      "end": "2025-11-28T23:59:59Z"
    }
  }
}
```

### Size Optimization
- Include only essential fields
- Use ISO 8601 dates (no timezone objects)
- Limit to 90 days future + 7 days past
- Gzip compression via CloudFront
- Target size: <20KB compressed

## Security Considerations

### IAM Permissions (Minimal)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::pilvio-bucket/sites/kaiu-kodukant/calendar/*"
    }
  ]
}
```

### Access Control
- S3: Private bucket with specific object ACLs
- CloudFront: Origin Access Control (OAC)
- Apps Script: Secure storage of AWS credentials
- No direct public S3 access

### CORS Configuration
```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://kaiukodukant.ee</AllowedOrigin>
    <AllowedOrigin>https://www.kaiukodukant.ee</AllowedOrigin>
    <AllowedOrigin>https://tore.kaiukodukant.ee</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <MaxAgeSeconds>86400</MaxAgeSeconds>
    <AllowedHeader>*</AllowedHeader>
  </CORSRule>
</CORSConfiguration>
```

## Cost Analysis

### AWS Costs (Monthly Estimate)

| Service | Usage | Cost |
|---------|-------|------|
| S3 Storage | <1 MB | $0.00 |
| S3 PUT Requests | ~3,000 (every 15 min) | $0.02 |
| S3 GET Requests | ~10,000 | $0.01 |
| CloudFront Transfer | <1 GB | $0.00 |
| CloudFront Requests | ~10,000 | $0.01 |
| **Total** | | **~$0.04** |

*Within AWS Free Tier for most usage patterns*

### Cost Optimization
- Use existing Pilvio infrastructure
- Leverage free tier limits
- Implement appropriate cache times
- Monitor usage via CloudWatch

## Reliability & Fallback

### Multi-Layer Redundancy

1. **Primary**: CloudFront edge cache
2. **Secondary**: S3 origin
3. **Fallback**: Apps Script endpoint
4. **Emergency**: Cached data in localStorage

### Error Handling
```javascript
async function loadCalendar() {
  try {
    // Try CloudFront/S3 first
    const response = await fetch(CLOUDFRONT_URL, {
      signal: AbortSignal.timeout(3000)
    });
    return await response.json();
  } catch (error) {
    console.warn('S3 failed, falling back to Apps Script');
    // Fallback to Apps Script
    return loadViaAppsScript();
  }
}
```

## Implementation Phases

### Phase 1: Infrastructure (Week 1)
- Configure IAM user and permissions
- Set up S3 bucket structure
- Deploy CloudFront distribution
- Configure CORS

### Phase 2: Backend (Week 1-2)
- Implement Apps Script S3 sync
- Add AWS Signature v4
- Set up scheduled triggers
- Test upload process

### Phase 3: Frontend (Week 2)
- Update calendar.js
- Implement caching logic
- Add fallback mechanism
- Deploy and test

### Phase 4: Optimization (Week 3)
- Fine-tune cache times
- Add monitoring
- Optimize JSON structure
- Performance testing

## Success Metrics

### Performance KPIs
- [ ] Page load time <1 second
- [ ] Calendar data load <50ms (cached)
- [ ] 95% cache hit rate
- [ ] Zero CORS errors
- [ ] 99.9% availability

### User Experience
- [ ] Instant calendar rendering
- [ ] No loading spinners for cached data
- [ ] Smooth navigation
- [ ] Works offline (cached)

## Risk Mitigation

### Potential Issues & Solutions

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| S3 outage | Low | High | Apps Script fallback |
| Sync failure | Medium | Low | CloudWatch alerts |
| Cache invalidation | Low | Low | Manual refresh option |
| Cost overrun | Very Low | Low | Budget alerts |

## Monitoring Strategy

### Key Metrics
- S3 upload success rate
- CloudFront cache hit ratio
- Response times (P50, P95, P99)
- Error rates
- Data freshness

### Alerting
- Failed S3 uploads
- High error rates
- Slow response times
- Cost threshold exceeded

## Long-term Benefits

1. **Scalability**: Can handle 1000x more traffic
2. **Global Performance**: Edge locations worldwide
3. **Cost Predictability**: Minimal variable costs
4. **Maintenance**: Less code, more reliable
5. **Modern Architecture**: Industry best practices

## Migration Rollback Plan

If issues arise, rollback is simple:
1. Change frontend URL back to Apps Script
2. No data migration needed
3. Keep S3 sync running for monitoring
4. Investigate and fix issues
5. Re-attempt migration

## Conclusion

The S3/CloudFront architecture provides:
- **95% performance improvement**
- **99.9% reliability**
- **Negligible costs** (<$1/month)
- **Zero CORS issues**
- **Global edge caching**

This is a production-ready solution that aligns with modern web architecture best practices while leveraging existing Pilvio infrastructure.