# Calendar S3 Monitoring & Operations Guide

## Overview
This guide covers monitoring, maintenance, and operational procedures for the S3-based calendar system.

---

## Monitoring Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Monitoring Stack                        │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  Apps Script → CloudWatch → S3 Metrics → CloudFront      │
│       ↓            ↓           ↓            ↓            │
│    Logging     Alarms      Storage      Analytics        │
│       ↓            ↓           ↓            ↓            │
│              Monitoring Dashboard (Console)               │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Key Metrics to Monitor

### 1. Sync Health Metrics

| Metric | Target | Alert Threshold | Check Frequency |
|--------|--------|-----------------|-----------------|
| Sync Success Rate | 100% | <95% | Every 15 min |
| Sync Duration | <5s | >10s | Every sync |
| JSON File Size | <50KB | >100KB | Daily |
| Events Count | >0 | 0 events | Every sync |
| Last Sync Time | <20 min ago | >30 min | Continuous |

### 2. Performance Metrics

| Metric | Target | Alert Threshold | Check Frequency |
|--------|--------|-----------------|-----------------|
| CloudFront Cache Hit Rate | >90% | <80% | Hourly |
| CloudFront Response Time | <50ms | >200ms | Every request |
| S3 GET Latency | <100ms | >500ms | Every request |
| Frontend Load Time | <500ms | >2000ms | Daily sample |
| Fallback Usage Rate | <1% | >5% | Daily |

### 3. Error Metrics

| Metric | Target | Alert Threshold | Check Frequency |
|--------|--------|-----------------|-----------------|
| 4xx Error Rate | <1% | >5% | Hourly |
| 5xx Error Rate | 0% | >0.1% | Real-time |
| CORS Errors | 0 | >0 | Real-time |
| JSON Parse Errors | 0 | >0 | Every load |
| Timeout Errors | <0.1% | >1% | Hourly |

---

## Monitoring Setup

### 1. CloudWatch Configuration

#### Create Dashboard
```bash
aws cloudwatch put-dashboard \
  --dashboard-name KaiuCalendarMonitoring \
  --dashboard-body file://dashboard.json
```

**dashboard.json:**
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/CloudFront", "Requests", {"stat": "Sum"}],
          [".", "BytesDownloaded", {"stat": "Sum"}],
          [".", "4xxErrorRate", {"stat": "Average"}],
          [".", "5xxErrorRate", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "CloudFront Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/S3", "NumberOfObjects", {"dimensions": {"BucketName": "PILVIO_BUCKET"}}],
          [".", "BucketSizeBytes", {"dimensions": {"BucketName": "PILVIO_BUCKET"}}]
        ],
        "period": 86400,
        "stat": "Average",
        "region": "eu-central-1",
        "title": "S3 Storage"
      }
    }
  ]
}
```

#### Create Alarms

**High Error Rate Alarm:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name kaiu-calendar-high-error-rate \
  --alarm-description "Alert when calendar error rate is high" \
  --metric-name 4xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:eu-central-1:ACCOUNT:kaiu-alerts
```

**Sync Failure Alarm:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name kaiu-calendar-sync-failure \
  --alarm-description "Alert when calendar sync fails" \
  --metric-name SyncFailures \
  --namespace CustomApp/Calendar \
  --statistic Sum \
  --period 900 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:eu-central-1:ACCOUNT:kaiu-alerts
```

### 2. Apps Script Monitoring

#### Add Monitoring to Sync Function
```javascript
/**
 * Enhanced sync with metrics reporting
 */
function syncCalendarToS3WithMetrics() {
  const startTime = Date.now();
  let success = false;
  let eventCount = 0;
  let fileSize = 0;
  
  try {
    const calendarData = buildCalendarJson();
    const data = JSON.parse(calendarData);
    eventCount = data.events.length;
    fileSize = calendarData.length;
    
    const result = uploadToS3(calendarData);
    success = true;
    
    // Report metrics
    reportMetrics({
      success: true,
      duration: Date.now() - startTime,
      eventCount: eventCount,
      fileSize: fileSize
    });
    
    return result;
    
  } catch (error) {
    // Report failure
    reportMetrics({
      success: false,
      duration: Date.now() - startTime,
      error: error.toString()
    });
    
    throw error;
  }
}

/**
 * Report metrics to monitoring system
 */
function reportMetrics(metrics) {
  // Log to spreadsheet
  try {
    const sheet = SpreadsheetApp.openById('MONITORING_SHEET_ID')
      .getSheetByName('CalendarMetrics');
    
    sheet.appendRow([
      new Date(),
      metrics.success ? 'SUCCESS' : 'FAILURE',
      metrics.duration,
      metrics.eventCount || 0,
      metrics.fileSize || 0,
      metrics.error || ''
    ]);
  } catch (e) {
    console.error('Failed to log metrics:', e);
  }
  
  // Send to CloudWatch (via custom endpoint)
  if (PropertiesService.getScriptProperties().getProperty('METRICS_ENDPOINT')) {
    UrlFetchApp.fetch(METRICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        namespace: 'CustomApp/Calendar',
        metrics: metrics,
        timestamp: new Date().toISOString()
      })
    });
  }
}
```

#### Create Monitoring Spreadsheet

1. Create new Google Sheet: "Kaiu Calendar Monitoring"
2. Create sheet: "CalendarMetrics"
3. Add headers:
   - Timestamp
   - Status
   - Duration (ms)
   - Event Count
   - File Size (bytes)
   - Error

### 3. Frontend Monitoring

#### Add to calendar.js:
```javascript
/**
 * Report performance metrics
 */
function reportCalendarMetrics(source, duration, success, cached = false) {
  // Console logging
  console.log(`Calendar Performance: ${source} - ${duration}ms - ${success ? 'SUCCESS' : 'FAILURE'} - ${cached ? 'CACHED' : 'FRESH'}`);
  
  // Send to analytics
  if (typeof gtag !== 'undefined') {
    gtag('event', 'calendar_performance', {
      event_category: 'Performance',
      event_label: source,
      value: Math.round(duration),
      custom_dimensions: {
        success: success,
        cached: cached
      }
    });
  }
  
  // Store for dashboard
  const metrics = JSON.parse(localStorage.getItem('calendar_metrics') || '[]');
  metrics.push({
    timestamp: Date.now(),
    source,
    duration,
    success,
    cached
  });
  
  // Keep last 100 metrics
  if (metrics.length > 100) {
    metrics.shift();
  }
  
  localStorage.setItem('calendar_metrics', JSON.stringify(metrics));
}
```

---

## Operational Procedures

### Daily Operations

#### Morning Check (9:00 AM)
1. [ ] Check sync status in Apps Script logs
2. [ ] Verify calendar.json exists in S3
3. [ ] Review CloudWatch dashboard
4. [ ] Check error alerts
5. [ ] Verify calendar loads on website

#### Evening Review (5:00 PM)
1. [ ] Review day's metrics
2. [ ] Check sync success rate
3. [ ] Note any anomalies
4. [ ] Clear resolved alerts

### Weekly Operations

#### Monday - Performance Review
1. [ ] Generate weekly performance report
2. [ ] Review cache hit rates
3. [ ] Check response times trend
4. [ ] Identify optimization opportunities

#### Wednesday - Capacity Check
1. [ ] Check S3 storage usage
2. [ ] Review CloudFront bandwidth
3. [ ] Monitor JSON file size growth
4. [ ] Verify cost projections

#### Friday - Maintenance
1. [ ] Clear old archive files
2. [ ] Review and clear logs
3. [ ] Test fallback mechanism
4. [ ] Update documentation

### Monthly Operations

#### First Monday - Deep Analysis
1. [ ] Full performance audit
2. [ ] Cost analysis
3. [ ] Security review
4. [ ] Update monitoring thresholds

#### Mid-Month - Testing
1. [ ] Disaster recovery test
2. [ ] Fallback testing
3. [ ] Load testing
4. [ ] Cross-browser testing

---

## Alert Response Procedures

### Severity Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| Critical | < 15 min | Complete sync failure, S3 down |
| High | < 1 hour | High error rate, performance degradation |
| Medium | < 4 hours | Cache issues, minor errors |
| Low | < 24 hours | Optimization opportunities |

### Alert Runbooks

#### ALERT: Calendar Sync Failed

**Severity**: Critical

**Steps**:
1. Check Apps Script execution logs
2. Verify Google Calendar accessibility
3. Check AWS credentials validity
4. Verify S3 bucket permissions
5. Test manual sync execution
6. If persistent, enable fallback mode
7. Investigate root cause
8. Document incident

**Commands**:
```bash
# Check S3 file
aws s3 ls s3://BUCKET/sites/kaiu-kodukant/calendar/

# Check last modified
aws s3api head-object --bucket BUCKET --key sites/kaiu-kodukant/calendar/calendar.json

# Download and validate JSON
aws s3 cp s3://BUCKET/sites/kaiu-kodukant/calendar/calendar.json - | jq .
```

#### ALERT: High Error Rate

**Severity**: High

**Steps**:
1. Check CloudFront metrics
2. Verify CORS configuration
3. Check S3 bucket policy
4. Review recent changes
5. Check for traffic spikes
6. Enable detailed logging
7. Analyze error patterns

**Commands**:
```bash
# Check CloudFront distribution
aws cloudfront get-distribution --id DISTRIBUTION_ID

# Check recent errors
aws logs tail /aws/cloudfront/DISTRIBUTION_ID --since 1h --filter-pattern "ERROR"

# Invalidate cache if needed
aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
```

#### ALERT: Performance Degradation

**Severity**: Medium

**Steps**:
1. Check cache hit rates
2. Review CloudFront metrics
3. Check S3 response times
4. Verify JSON file size
5. Check network path
6. Review recent deployments

---

## Maintenance Procedures

### Routine Maintenance

#### Weekly Tasks
```bash
# Clean up old archive files (keep 30 days)
aws s3 rm s3://BUCKET/sites/kaiu-kodukant/calendar/archive/ \
  --recursive \
  --exclude "*" \
  --include "calendar-*.json" \
  --older-than 30

# Check file sizes
aws s3 ls s3://BUCKET/sites/kaiu-kodukant/calendar/ --recursive --human-readable

# Verify permissions
aws s3api get-bucket-acl --bucket BUCKET
```

#### Monthly Tasks
```bash
# Rotate IAM access keys
aws iam create-access-key --user-name kaiu-calendar-sync
# Update Apps Script with new keys
# Delete old keys after verification

# Review and optimize
aws cloudfront get-distribution-config --id DISTRIBUTION_ID > dist-config.json
# Review and update if needed

# Cost analysis
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```

### Emergency Procedures

#### Complete System Failure
1. **Immediate**: Enable Apps Script fallback
   ```javascript
   // In config.js
   window.CALENDAR_CONFIG.useS3 = false;
   ```

2. **Diagnose**: Check all components
   ```bash
   # Check S3
   aws s3api head-bucket --bucket BUCKET
   
   # Check CloudFront
   curl -I https://DISTRIBUTION.cloudfront.net/calendar.json
   
   # Check Apps Script
   curl "APPS_SCRIPT_URL?action=calendar&callback=test"
   ```

3. **Restore**: Fix and test
   ```bash
   # Re-upload from backup
   aws s3 cp backup/calendar.json s3://BUCKET/sites/kaiu-kodukant/calendar/calendar.json
   
   # Invalidate cache
   aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/calendar.json"
   ```

#### Data Corruption
1. Restore from archive
2. Verify JSON structure
3. Re-sync from Google Calendar
4. Clear all caches
5. Test thoroughly

---

## Performance Optimization

### Continuous Optimization

#### Weekly Review Checklist
- [ ] JSON file size trend
- [ ] Event count changes
- [ ] Cache hit rate analysis
- [ ] Response time patterns
- [ ] Error rate trends

#### Optimization Actions

**If JSON > 50KB:**
1. Reduce event window (60 days instead of 90)
2. Remove unnecessary fields
3. Implement compression
4. Consider pagination

**If Cache Hit Rate < 80%:**
1. Increase cache TTL
2. Review invalidation patterns
3. Check for unnecessary refreshes
4. Optimize sync frequency

**If Response Time > 100ms:**
1. Check CloudFront configuration
2. Review origin response times
3. Verify compression enabled
4. Check for network issues

---

## Troubleshooting Guide

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Stale Calendar | Old events showing | Check sync logs, verify S3 upload, invalidate cache |
| CORS Errors | Console errors | Verify CloudFront CORS headers, check origin |
| Slow Loading | >1s load time | Check cache status, verify CDN, check fallback |
| Missing Events | Events not showing | Check calendar permissions, verify JSON structure |
| Sync Failures | No updates | Check Apps Script logs, verify credentials |

### Debug Commands

```javascript
// Frontend debugging (browser console)

// Check configuration
console.log(window.CALENDAR_CONFIG);

// Force refresh
localStorage.removeItem('kaiu_calendar_cache');
location.reload();

// Check metrics
const metrics = JSON.parse(localStorage.getItem('calendar_metrics') || '[]');
console.table(metrics.slice(-10));

// Test S3 directly
fetch(window.CALENDAR_CONFIG.s3Url)
  .then(r => r.json())
  .then(data => console.log('Events:', data.events.length))
  .catch(e => console.error('S3 Error:', e));

// Test fallback
window.CALENDAR_CONFIG.useS3 = false;
loadCalendarEvents().then(console.log);
```

```bash
# Backend debugging (terminal)

# Check S3 sync
aws s3api head-object \
  --bucket BUCKET \
  --key sites/kaiu-kodukant/calendar/calendar.json \
  --query "LastModified"

# Check CloudFront cache
curl -I https://DISTRIBUTION.cloudfront.net/calendar.json | grep -E "x-cache|age"

# Validate JSON
aws s3 cp s3://BUCKET/sites/kaiu-kodukant/calendar/calendar.json - | \
  jq '.events | length'

# Check logs
aws logs tail /aws/lambda/calendar-sync --follow
```

---

## Reporting

### Weekly Report Template

```markdown
# Calendar System Weekly Report
**Week**: [Date Range]
**Prepared By**: [Name]

## Executive Summary
- Overall Health: [Green/Yellow/Red]
- Availability: XX.X%
- Performance: XXms average

## Key Metrics
| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| Sync Success Rate | | | |
| Cache Hit Rate | | | |
| Avg Response Time | | | |
| Error Rate | | | |
| Events Synced | | | |

## Incidents
- [Date]: [Description] - [Resolution]

## Actions Taken
- 
- 

## Recommendations
- 
- 

## Next Week Focus
- 
- 
```

### Monthly Report Additions
- Cost analysis
- Capacity planning
- Performance trends
- User feedback
- Improvement recommendations

---

## Disaster Recovery

### Backup Strategy

#### What to Backup
1. **Apps Script Code** - Version control
2. **AWS Configuration** - Infrastructure as Code
3. **Calendar Data** - S3 versioning + archive
4. **Monitoring Config** - Export dashboards

#### Backup Schedule
- **Daily**: Calendar JSON to S3 archive
- **Weekly**: Apps Script code export
- **Monthly**: Full configuration backup

### Recovery Procedures

#### RTO/RPO Targets
- **RTO** (Recovery Time): < 30 minutes
- **RPO** (Data Loss): < 15 minutes

#### Recovery Steps
1. **Assess** damage/failure
2. **Activate** fallback if needed
3. **Restore** from appropriate backup
4. **Verify** functionality
5. **Document** incident

---

## Contact Information

### Escalation Path

| Level | Contact | Method | When |
|-------|---------|--------|------|
| L1 | On-call Dev | Slack/Email | First response |
| L2 | Tech Lead | Phone | After 30 min |
| L3 | Project Owner | Phone | Critical issues |

### Key Contacts
- **AWS Support**: [Support Case URL]
- **Google Workspace Admin**: [Contact]
- **Domain Registrar**: [Contact]

---

## Appendix

### Useful Links
- AWS Console: https://console.aws.amazon.com
- CloudWatch Dashboard: [Direct Link]
- Apps Script Project: [Direct Link]
- Monitoring Spreadsheet: [Direct Link]

### Tool Versions
- AWS CLI: 2.x
- Node.js: 18+
- jq: 1.6+

This completes the monitoring and operations guide for the S3 calendar system.