# Gallery Performance Monitoring Guide

## Overview
This document outlines monitoring strategies and tools for tracking gallery performance after optimization implementation.

---

## Key Performance Indicators (KPIs)

### Primary Metrics
| Metric | Target | Alert Threshold | Measurement Method |
|--------|--------|-----------------|-------------------|
| Page Load Time | <3s | >5s | Real User Monitoring (RUM) |
| Time to First Image | <1s | >2s | Performance Observer API |
| Cache Hit Rate | >80% | <60% | X-Cache-Status headers |
| Error Rate | <1% | >5% | Console errors + failed requests |
| Bandwidth Usage | <2MB/page | >5MB/page | Network monitoring |

### Secondary Metrics
| Metric | Target | Alert Threshold | Measurement Method |
|--------|--------|-----------------|-------------------|
| CDN Response Time | <200ms | >500ms | Worker analytics |
| API Response Time | <1s | >3s | Apps Script metrics |
| Image Load Failures | <0.5% | >2% | Error tracking |
| Cache Storage Size | <50MB | >100MB | Browser storage API |
| Concurrent Users | N/A | System dependent | Analytics |

---

## Browser-Side Monitoring

### 1. Performance Observer Implementation

Add to `js/gallery.js`:

```javascript
/**
 * Gallery Performance Monitor
 * Tracks real user metrics and sends to analytics
 */
class GalleryMonitor {
    constructor() {
        this.metrics = {
            navigationTiming: {},
            resourceTimings: [],
            errors: [],
            cacheStats: {
                hits: 0,
                misses: 0,
                failures: 0
            }
        };
        
        this.initObservers();
        this.initErrorTracking();
        this.startPeriodicReporting();
    }
    
    initObservers() {
        // Navigation timing
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            const navigationStart = timing.navigationStart;
            
            this.metrics.navigationTiming = {
                domContentLoaded: timing.domContentLoadedEventEnd - navigationStart,
                loadComplete: timing.loadEventEnd - navigationStart,
                firstPaint: this.getFirstPaint(),
                firstContentfulPaint: this.getFirstContentfulPaint()
            };
        }
        
        // Resource timing for images
        if (window.PerformanceObserver) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.initiatorType === 'img') {
                        this.trackImageLoad(entry);
                    }
                }
            });
            
            observer.observe({ entryTypes: ['resource'] });
        }
        
        // Long tasks monitoring
        if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
            const longTaskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    console.warn('Long task detected:', entry.duration + 'ms');
                    this.reportLongTask(entry);
                }
            });
            
            longTaskObserver.observe({ entryTypes: ['longtask'] });
        }
    }
    
    initErrorTracking() {
        // Track image load errors
        window.addEventListener('error', (event) => {
            if (event.target.tagName === 'IMG') {
                this.trackImageError(event.target);
            }
        }, true);
        
        // Track unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.trackError({
                type: 'unhandledRejection',
                reason: event.reason,
                promise: event.promise
            });
        });
    }
    
    trackImageLoad(entry) {
        const isCacheHit = entry.transferSize === 0 && entry.decodedBodySize > 0;
        const isFromCDN = entry.name.includes('images.kaiukodukant.ee');
        
        const imageMetric = {
            url: entry.name,
            duration: entry.duration,
            size: entry.transferSize,
            cacheHit: isCacheHit,
            fromCDN: isFromCDN,
            timestamp: Date.now()
        };
        
        this.metrics.resourceTimings.push(imageMetric);
        
        // Update cache stats
        if (isCacheHit) {
            this.metrics.cacheStats.hits++;
        } else {
            this.metrics.cacheStats.misses++;
        }
        
        // Alert on slow loads
        if (entry.duration > 2000) {
            console.warn(`Slow image load: ${entry.name} took ${entry.duration}ms`);
        }
    }
    
    trackImageError(img) {
        const error = {
            url: img.src,
            alt: img.alt,
            timestamp: Date.now(),
            type: 'imageLoadError'
        };
        
        this.metrics.errors.push(error);
        this.metrics.cacheStats.failures++;
        
        console.error('Image failed to load:', img.src);
        
        // Send immediate alert for CDN failures
        if (img.src.includes('images.kaiukodukant.ee')) {
            this.sendAlert('CDN Image Failure', error);
        }
    }
    
    getFirstPaint() {
        if (window.performance && window.performance.getEntriesByType) {
            const paintEntries = performance.getEntriesByType('paint');
            const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
            return firstPaint ? firstPaint.startTime : 0;
        }
        return 0;
    }
    
    getFirstContentfulPaint() {
        if (window.performance && window.performance.getEntriesByType) {
            const paintEntries = performance.getEntriesByType('paint');
            const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
            return fcp ? fcp.startTime : 0;
        }
        return 0;
    }
    
    calculateStats() {
        const timings = this.metrics.resourceTimings;
        if (timings.length === 0) return null;
        
        const durations = timings.map(t => t.duration);
        const sizes = timings.map(t => t.size);
        
        return {
            imageCount: timings.length,
            avgLoadTime: durations.reduce((a, b) => a + b, 0) / durations.length,
            medianLoadTime: this.median(durations),
            p95LoadTime: this.percentile(durations, 95),
            totalSize: sizes.reduce((a, b) => a + b, 0),
            cacheHitRate: this.metrics.cacheStats.hits / 
                         (this.metrics.cacheStats.hits + this.metrics.cacheStats.misses),
            errorRate: this.metrics.cacheStats.failures / timings.length,
            cdnUsage: timings.filter(t => t.fromCDN).length / timings.length
        };
    }
    
    median(values) {
        if (values.length === 0) return 0;
        values.sort((a, b) => a - b);
        const half = Math.floor(values.length / 2);
        return values.length % 2 ? values[half] : (values[half - 1] + values[half]) / 2;
    }
    
    percentile(values, p) {
        if (values.length === 0) return 0;
        values.sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * values.length) - 1;
        return values[index];
    }
    
    reportMetrics() {
        const stats = this.calculateStats();
        if (!stats) return;
        
        const report = {
            ...this.metrics.navigationTiming,
            ...stats,
            errors: this.metrics.errors.length,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null
        };
        
        console.log('Gallery Performance Report:', report);
        
        // Send to analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'gallery_performance', {
                'event_category': 'Performance',
                'avg_load_time': Math.round(report.avgLoadTime),
                'cache_hit_rate': Math.round(report.cacheHitRate * 100),
                'error_rate': Math.round(report.errorRate * 100),
                'total_images': report.imageCount
            });
        }
        
        // Send to custom endpoint if configured
        if (window.MONITORING_ENDPOINT) {
            fetch(window.MONITORING_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report)
            }).catch(e => console.error('Failed to send metrics:', e));
        }
        
        return report;
    }
    
    reportLongTask(entry) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'long_task', {
                'event_category': 'Performance',
                'duration': Math.round(entry.duration),
                'timestamp': Date.now()
            });
        }
    }
    
    sendAlert(type, data) {
        console.error(`ALERT: ${type}`, data);
        
        // Send to monitoring service
        if (window.ALERT_ENDPOINT) {
            fetch(window.ALERT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    data,
                    url: window.location.href,
                    timestamp: Date.now()
                })
            }).catch(e => console.error('Failed to send alert:', e));
        }
    }
    
    startPeriodicReporting() {
        // Report metrics every 30 seconds if page is visible
        setInterval(() => {
            if (!document.hidden) {
                this.reportMetrics();
            }
        }, 30000);
        
        // Report on page unload
        window.addEventListener('beforeunload', () => {
            this.reportMetrics();
        });
    }
}

// Initialize monitoring
let galleryMonitor;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        galleryMonitor = new GalleryMonitor();
    });
} else {
    galleryMonitor = new GalleryMonitor();
}
```

### 2. Console Monitoring Dashboard

```javascript
/**
 * Console-based monitoring dashboard
 * Run: galleryDashboard.show()
 */
const galleryDashboard = {
    show() {
        if (!galleryMonitor) {
            console.error('Gallery monitor not initialized');
            return;
        }
        
        const stats = galleryMonitor.calculateStats();
        const cache = galleryMonitor.metrics.cacheStats;
        
        console.group('🎨 Gallery Performance Dashboard');
        
        console.group('📊 Performance Metrics');
        console.table({
            'Average Load Time': `${stats?.avgLoadTime?.toFixed(0)}ms`,
            'Median Load Time': `${stats?.medianLoadTime?.toFixed(0)}ms`,
            'P95 Load Time': `${stats?.p95LoadTime?.toFixed(0)}ms`,
            'Total Images': stats?.imageCount,
            'Total Size': `${(stats?.totalSize / 1024 / 1024).toFixed(2)}MB`
        });
        console.groupEnd();
        
        console.group('💾 Cache Performance');
        console.table({
            'Cache Hits': cache.hits,
            'Cache Misses': cache.misses,
            'Hit Rate': `${(stats?.cacheHitRate * 100).toFixed(1)}%`,
            'CDN Usage': `${(stats?.cdnUsage * 100).toFixed(1)}%`
        });
        console.groupEnd();
        
        console.group('❌ Errors');
        console.table({
            'Failed Images': cache.failures,
            'Error Rate': `${(stats?.errorRate * 100).toFixed(2)}%`,
            'Total Errors': galleryMonitor.metrics.errors.length
        });
        if (galleryMonitor.metrics.errors.length > 0) {
            console.table(galleryMonitor.metrics.errors.slice(-5));
        }
        console.groupEnd();
        
        console.groupEnd();
    },
    
    reset() {
        if (galleryMonitor) {
            galleryMonitor.metrics.resourceTimings = [];
            galleryMonitor.metrics.errors = [];
            galleryMonitor.metrics.cacheStats = { hits: 0, misses: 0, failures: 0 };
            console.log('✅ Metrics reset');
        }
    }
};
```

---

## Cloudflare Worker Monitoring

### 1. Built-in Analytics
Access via Cloudflare Dashboard → Workers → Analytics

**Key Metrics**:
- Request count and trends
- Error rate and status codes
- CPU time consumption
- Response time percentiles
- Bandwidth usage

### 2. Custom Worker Logging

Add to Cloudflare Worker:

```javascript
// Enhanced monitoring in worker
async function handleRequest(request, env, ctx) {
    const startTime = Date.now();
    const metrics = {
        cacheStatus: 'MISS',
        responseTime: 0,
        imageSize: 0,
        error: null
    };
    
    try {
        // ... main worker logic ...
        
        // Log successful request
        metrics.responseTime = Date.now() - startTime;
        await logMetrics(env, metrics);
        
        return response;
        
    } catch (error) {
        metrics.error = error.message;
        await logMetrics(env, metrics);
        throw error;
    }
}

async function logMetrics(env, metrics) {
    // Log to Cloudflare Analytics Engine (if available)
    if (env.ANALYTICS) {
        env.ANALYTICS.writeDataPoint({
            blobs: [metrics.cacheStatus],
            doubles: [metrics.responseTime, metrics.imageSize],
            indexes: [metrics.error ? 1 : 0]
        });
    }
    
    // Log to external service
    if (env.METRICS_ENDPOINT) {
        await fetch(env.METRICS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...metrics,
                timestamp: Date.now(),
                region: request.cf?.colo
            })
        });
    }
}
```

### 3. Wrangler Tail for Real-time Logs

```bash
# Real-time log streaming
wrangler tail --format pretty

# Filter for errors only
wrangler tail --format pretty --status error

# Save logs to file
wrangler tail --format json > worker-logs.json
```

---

## Google Apps Script Monitoring

### 1. Built-in Monitoring

**Google Cloud Console**:
1. Go to console.cloud.google.com
2. Select project
3. APIs & Services → Dashboard
4. View Drive API metrics

### 2. Custom Logging in Apps Script

```javascript
/**
 * Performance logging for Apps Script
 */
class ScriptMonitor {
    constructor() {
        this.startTime = Date.now();
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            apiCalls: 0,
            errors: []
        };
    }
    
    logCacheHit(key) {
        this.metrics.cacheHits++;
        console.log(`Cache HIT: ${key}`);
    }
    
    logCacheMiss(key) {
        this.metrics.cacheMisses++;
        console.log(`Cache MISS: ${key}`);
    }
    
    logApiCall(api) {
        this.metrics.apiCalls++;
        console.log(`API call: ${api}`);
    }
    
    logError(error) {
        this.metrics.errors.push({
            message: error.toString(),
            timestamp: Date.now()
        });
        console.error('Error:', error);
    }
    
    getReport() {
        const executionTime = Date.now() - this.startTime;
        const cacheHitRate = this.metrics.cacheHits / 
                           (this.metrics.cacheHits + this.metrics.cacheMisses);
        
        return {
            executionTime: executionTime + 'ms',
            cacheHitRate: (cacheHitRate * 100).toFixed(1) + '%',
            apiCalls: this.metrics.apiCalls,
            errors: this.metrics.errors.length,
            metrics: this.metrics
        };
    }
}

// Use in Apps Script
const monitor = new ScriptMonitor();

function doGet(e) {
    try {
        // ... your code ...
        
        const report = monitor.getReport();
        response.monitoring = report;
        
        // Log to Stackdriver if needed
        console.log('Request completed:', report);
        
    } catch (error) {
        monitor.logError(error);
        throw error;
    }
}
```

---

## Synthetic Monitoring

### 1. Automated Testing Script

Create `monitoring/synthetic-test.js`:

```javascript
/**
 * Synthetic monitoring - run periodically
 */
const puppeteer = require('puppeteer');

async function runSyntheticTest() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    const metrics = {
        timestamp: Date.now(),
        loadTime: 0,
        imageCount: 0,
        errors: [],
        cachePerformance: {}
    };
    
    try {
        // Monitor network
        page.on('response', response => {
            if (response.url().includes('images.kaiukodukant.ee')) {
                const headers = response.headers();
                if (headers['x-cache-status']) {
                    metrics.cachePerformance[response.url()] = headers['x-cache-status'];
                }
            }
        });
        
        // Monitor errors
        page.on('error', error => {
            metrics.errors.push(error.message);
        });
        
        // Navigate to gallery
        const startTime = Date.now();
        await page.goto('https://kaiukodukant.ee/gallery.html', {
            waitUntil: 'networkidle2'
        });
        metrics.loadTime = Date.now() - startTime;
        
        // Count images
        metrics.imageCount = await page.$$eval('img', images => images.length);
        
        // Check for errors
        const consoleErrors = await page.evaluate(() => {
            return window.galleryMonitor?.metrics.errors || [];
        });
        metrics.errors.push(...consoleErrors);
        
        // Test cache
        await page.reload();
        const reloadTime = Date.now();
        await page.waitForSelector('img');
        metrics.cachedLoadTime = Date.now() - reloadTime;
        
        console.log('Synthetic test results:', metrics);
        
        // Alert if thresholds exceeded
        if (metrics.loadTime > 5000) {
            sendAlert('High load time detected', metrics);
        }
        
        if (metrics.errors.length > 0) {
            sendAlert('Errors detected', metrics);
        }
        
    } catch (error) {
        console.error('Synthetic test failed:', error);
        sendAlert('Synthetic test failure', { error: error.message });
    } finally {
        await browser.close();
    }
    
    return metrics;
}

// Run every 5 minutes
setInterval(runSyntheticTest, 5 * 60 * 1000);
```

### 2. Lighthouse CI Integration

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push, pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://kaiukodukant.ee/gallery.html
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
          temporaryPublicStorage: true
```

```json
// lighthouse-budget.json
{
  "path": "/gallery.html",
  "timings": [
    { "metric": "first-contentful-paint", "budget": 2000 },
    { "metric": "largest-contentful-paint", "budget": 3000 },
    { "metric": "cumulative-layout-shift", "budget": 0.1 },
    { "metric": "total-blocking-time", "budget": 300 }
  ],
  "resourceSizes": [
    { "resourceType": "image", "budget": 2000 },
    { "resourceType": "script", "budget": 100 },
    { "resourceType": "total", "budget": 3000 }
  ],
  "resourceCounts": [
    { "resourceType": "image", "budget": 30 }
  ]
}
```

---

## Alert Configuration

### 1. Performance Degradation Alerts

```javascript
// Alert thresholds configuration
const ALERT_THRESHOLDS = {
    pageLoadTime: 5000,        // 5 seconds
    imageLoadTime: 2000,       // 2 seconds
    cacheHitRate: 0.6,         // 60%
    errorRate: 0.05,           // 5%
    cdnResponseTime: 500,      // 500ms
    apiResponseTime: 3000      // 3 seconds
};

// Check and send alerts
function checkThresholds(metrics) {
    const alerts = [];
    
    if (metrics.avgLoadTime > ALERT_THRESHOLDS.imageLoadTime) {
        alerts.push({
            type: 'SLOW_IMAGES',
            message: `Average image load time ${metrics.avgLoadTime}ms exceeds threshold`,
            severity: 'warning'
        });
    }
    
    if (metrics.cacheHitRate < ALERT_THRESHOLDS.cacheHitRate) {
        alerts.push({
            type: 'LOW_CACHE_HIT',
            message: `Cache hit rate ${(metrics.cacheHitRate * 100).toFixed(1)}% below threshold`,
            severity: 'warning'
        });
    }
    
    if (metrics.errorRate > ALERT_THRESHOLDS.errorRate) {
        alerts.push({
            type: 'HIGH_ERROR_RATE',
            message: `Error rate ${(metrics.errorRate * 100).toFixed(1)}% exceeds threshold`,
            severity: 'critical'
        });
    }
    
    return alerts;
}
```

### 2. Email Alert Setup (Apps Script)

```javascript
// Send email alerts from Apps Script
function sendEmailAlert(subject, body) {
    const recipients = 'admin@kaiukodukant.ee';
    
    MailApp.sendEmail({
        to: recipients,
        subject: `[Gallery Alert] ${subject}`,
        htmlBody: `
            <h2>Gallery Performance Alert</h2>
            <p>${body}</p>
            <p>Time: ${new Date().toISOString()}</p>
            <p>View dashboard: <a href="https://kaiukodukant.ee/gallery.html">Gallery</a></p>
        `
    });
}
```

---

## Dashboard Setup

### 1. Simple HTML Dashboard

Create `monitoring-dashboard.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Gallery Monitoring Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .metric { 
            display: inline-block; 
            margin: 10px; 
            padding: 20px; 
            border: 1px solid #ddd; 
            border-radius: 5px;
        }
        .metric-value { 
            font-size: 2em; 
            font-weight: bold; 
        }
        .metric-label { 
            color: #666; 
            margin-top: 5px; 
        }
        .good { color: green; }
        .warning { color: orange; }
        .critical { color: red; }
    </style>
</head>
<body>
    <h1>Gallery Performance Dashboard</h1>
    <div id="metrics"></div>
    <div id="chart"></div>
    
    <script>
        async function updateDashboard() {
            // Fetch metrics from your monitoring endpoint
            const response = await fetch('/api/metrics');
            const data = await response.json();
            
            const metricsDiv = document.getElementById('metrics');
            metricsDiv.innerHTML = `
                <div class="metric">
                    <div class="metric-value ${getColorClass(data.avgLoadTime, 1000, 2000)}">
                        ${data.avgLoadTime.toFixed(0)}ms
                    </div>
                    <div class="metric-label">Avg Load Time</div>
                </div>
                <div class="metric">
                    <div class="metric-value ${getColorClass(data.cacheHitRate, 0.8, 0.6, true)}">
                        ${(data.cacheHitRate * 100).toFixed(1)}%
                    </div>
                    <div class="metric-label">Cache Hit Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value ${getColorClass(data.errorRate, 0.01, 0.05)}">
                        ${(data.errorRate * 100).toFixed(2)}%
                    </div>
                    <div class="metric-label">Error Rate</div>
                </div>
            `;
        }
        
        function getColorClass(value, warning, critical, reverse = false) {
            if (reverse) {
                if (value > warning) return 'good';
                if (value > critical) return 'warning';
                return 'critical';
            } else {
                if (value < warning) return 'good';
                if (value < critical) return 'warning';
                return 'critical';
            }
        }
        
        // Update every 30 seconds
        updateDashboard();
        setInterval(updateDashboard, 30000);
    </script>
</body>
</html>
```

---

## Reporting

### Weekly Performance Report Template

```markdown
# Gallery Performance Report
**Week of**: [Date]

## Executive Summary
- Overall performance: [Good/Degraded/Critical]
- Key achievements: [List]
- Issues identified: [List]
- Actions required: [List]

## Metrics Summary

### Performance
| Metric | This Week | Last Week | Change | Target |
|--------|-----------|-----------|--------|--------|
| Avg Load Time | XXXms | XXXms | +X% | <1000ms |
| P95 Load Time | XXXms | XXXms | +X% | <2000ms |
| Cache Hit Rate | XX% | XX% | +X% | >80% |
| Error Rate | X.X% | X.X% | +X% | <1% |

### Usage
| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| Page Views | XXX | XXX | +X% |
| Unique Users | XXX | XXX | +X% |
| Images Served | XXX | XXX | +X% |
| Bandwidth Used | XXXGB | XXXGB | +X% |

### CDN Performance
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Cache Hit Rate | XX% | >90% | ✅/⚠️/❌ |
| Response Time | XXXms | <200ms | ✅/⚠️/❌ |
| Error Rate | X.X% | <0.1% | ✅/⚠️/❌ |

## Incidents
[List any incidents, their impact, and resolution]

## Recommendations
1. [Action item 1]
2. [Action item 2]
3. [Action item 3]

## Next Steps
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### High Load Times
1. Check cache hit rates
2. Verify CDN is working
3. Check image sizes
4. Review network throttling

#### Low Cache Hit Rate
1. Check cache headers
2. Verify version parameters
3. Review cache invalidation
4. Check browser settings

#### High Error Rate
1. Check CDN status
2. Verify Google Drive access
3. Review CORS configuration
4. Check rate limiting

---

## Long-term Monitoring Strategy

### Monthly Reviews
- Analyze trends
- Identify patterns
- Plan optimizations
- Update thresholds

### Quarterly Assessments
- Full performance audit
- User satisfaction survey
- Cost-benefit analysis
- Technology updates

### Annual Planning
- Infrastructure review
- Budget planning
- Technology roadmap
- Team training