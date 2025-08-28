# Gallery Performance Testing Checklist

## Overview
Comprehensive testing checklist to validate gallery performance optimizations at each implementation phase.

---

## Pre-Optimization Baseline

### Metrics to Record
Record these metrics BEFORE any changes for comparison:

| Metric | Tool | Baseline Value |
|--------|------|----------------|
| Initial Page Load | Chrome DevTools Network | _____ seconds |
| Total Image Requests | Network tab count | _____ requests |
| Total Bandwidth | Network tab size | _____ MB |
| Time to First Image | Performance tab | _____ seconds |
| Time to Interactive | Lighthouse | _____ seconds |
| Cache Performance | Network (2nd load) | _____ seconds |

### Baseline Testing Steps
1. Open Chrome DevTools → Network tab
2. Clear cache and hard reload (Cmd+Shift+R)
3. Navigate to gallery page
4. Record total load time
5. Count number of image requests
6. Note total page size
7. Reload page (with cache) and note time
8. Save HAR file for comparison

---

## Phase 1: Frontend Optimizations

### 1.1 Preconnect Headers
- [ ] View page source, verify `<link rel="preconnect">` tags present
- [ ] Network tab shows early connection to drive.google.com
- [ ] Waterfall chart shows DNS/TCP happening in parallel with HTML parse

**Expected Result**: 100-200ms saved on first image request

### 1.2 Image Sizing
- [ ] Grid thumbnails load at 300px width (not 1200px)
- [ ] Network tab shows `sz=w300` parameter in thumbnail URLs
- [ ] No images larger than 400px loading for grid view
- [ ] Retina displays show 2x resolution images

**Test Commands**:
```javascript
// Run in console to check image sizes
Array.from(document.querySelectorAll('.photo-thumbnail img')).forEach(img => {
    console.log(`${img.alt}: Natural ${img.naturalWidth}x${img.naturalHeight}, Display ${img.width}x${img.height}`);
});
```

**Expected Result**: 70% reduction in bandwidth for grid view

### 1.3 Lazy Loading
- [ ] Only visible images load initially
- [ ] Scrolling triggers new image loads
- [ ] Network tab shows staggered image requests
- [ ] `loading="lazy"` attribute present on images

**Test Steps**:
1. Load gallery page
2. Note number of images loaded
3. Scroll down slowly
4. Verify new images load as they approach viewport

**Expected Result**: Initial load contains only 6-12 images

### 1.4 Loading States
- [ ] Skeleton loaders visible before images
- [ ] Smooth fade-in when images load
- [ ] No layout shift during loading
- [ ] Failed images show placeholder

**Expected Result**: Perceived performance improvement

### Phase 1 Performance Validation
| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Grid Load Time | <3 seconds | _____ | [ ] |
| Bandwidth Usage | <2MB | _____ | [ ] |
| Images Loaded | <20 initially | _____ | [ ] |
| Layout Shift | <0.1 | _____ | [ ] |

---

## Phase 2: CDN Proxy

### 2.1 Worker Deployment
- [ ] Worker responds at images.kaiukodukant.ee
- [ ] Health check endpoint works: `/health`
- [ ] CORS headers present in response
- [ ] Valid SSL certificate

**Test Commands**:
```bash
# Test worker is running
curl -I https://images.kaiukodukant.ee/health

# Test image proxy
curl -I https://images.kaiukodukant.ee/FILE_ID/w300
```

### 2.2 Cache Headers
- [ ] Cache-Control header shows `max-age=31536000`
- [ ] X-Cache-Status header present
- [ ] Timing-Allow-Origin header set
- [ ] Content-Type is image/*

**Chrome DevTools Check**:
1. Network tab → Click on image request
2. Response Headers section
3. Verify Cache-Control: `public, max-age=31536000, immutable`

### 2.3 Cache Performance
- [ ] First load shows X-Cache-Status: MISS
- [ ] Second load shows X-Cache-Status: HIT
- [ ] Cached images load in <50ms
- [ ] Browser cache working (304 responses)

**Performance Test**:
```javascript
// Measure cache performance
async function testCache() {
    const url = 'https://images.kaiukodukant.ee/FILE_ID/w300';
    
    // Clear entry from cache
    const cache = await caches.open('test');
    await cache.delete(url);
    
    // First load (MISS)
    const t1 = performance.now();
    const r1 = await fetch(url);
    const time1 = performance.now() - t1;
    
    // Second load (HIT)
    const t2 = performance.now();
    const r2 = await fetch(url);
    const time2 = performance.now() - t2;
    
    console.log({
        firstLoad: `${time1.toFixed(0)}ms (${r1.headers.get('X-Cache-Status')})`,
        secondLoad: `${time2.toFixed(0)}ms (${r2.headers.get('X-Cache-Status')})`,
        improvement: `${((1 - time2/time1) * 100).toFixed(0)}% faster`
    });
}
```

### 2.4 Fallback Mechanism
- [ ] Disable CDN temporarily
- [ ] Images still load from Google Drive
- [ ] Console shows fallback message
- [ ] No broken images

**Test Steps**:
1. Block images.kaiukodukant.ee in DevTools
2. Reload gallery
3. Verify images load from drive.google.com
4. Check console for fallback messages

### 2.5 Different Image Sizes
- [ ] `/w300` returns 300px wide image
- [ ] `/w600` returns 600px wide image  
- [ ] `/w1200` returns larger image
- [ ] Invalid widths return error

### Phase 2 Performance Validation
| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| CDN Response Time | <200ms | _____ | [ ] |
| Cache Hit Rate | >80% | _____ | [ ] |
| Second Visit Load | <1 second | _____ | [ ] |
| Bandwidth Savings | >50% | _____ | [ ] |

---

## Phase 3: Advanced Optimizations

### 3.1 Version Parameters
- [ ] Image URLs contain version parameter
- [ ] Version changes when image updated
- [ ] Old versions still cached
- [ ] New versions fetch fresh

**Test Steps**:
1. Note image URL with version
2. Update image in Google Drive
3. Refresh gallery
4. Verify new version parameter
5. Confirm new image loads

### 3.2 Apps Script Performance
- [ ] Response includes cacheInfo object
- [ ] Execution time in performance metrics
- [ ] Cached responses return faster
- [ ] Version fields in photo objects

**Validation**:
```javascript
// Check Apps Script response
fetch('YOUR_SCRIPT_URL?action=gallery&callback=test')
    .then(r => r.text())
    .then(text => {
        // Remove JSONP wrapper
        const json = text.replace(/^test\(/, '').replace(/\)$/, '');
        const data = JSON.parse(json);
        console.log('Cache Info:', data.cacheInfo);
        console.log('Performance:', data.performance);
        console.log('Has versions:', data.albums[0]?.coverImageVersion);
    });
```

### 3.3 Performance Monitoring
- [ ] Console logs show performance metrics
- [ ] Average load time tracked
- [ ] Cache hit rate calculated
- [ ] Failed loads counted

**Check Metrics**:
```javascript
// View performance metrics (if implemented)
if (typeof galleryPerf !== 'undefined') {
    galleryPerf.reportMetrics();
}
```

### Phase 3 Performance Validation
| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Apps Script Cache Hit | >70% | _____ | [ ] |
| Version Tracking | Working | _____ | [ ] |
| Monitoring Active | Yes | _____ | [ ] |
| Error Rate | <1% | _____ | [ ] |

---

## Cross-Browser Testing

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] iOS Safari
- [ ] Chrome Mobile
- [ ] Firefox Mobile
- [ ] Samsung Internet

### Testing Points
- [ ] Images load correctly
- [ ] Lazy loading works
- [ ] Lightbox functions
- [ ] No console errors
- [ ] Acceptable performance

---

## Network Condition Testing

### Chrome DevTools Network Throttling

#### Fast 3G
- [ ] Page loads within 8 seconds
- [ ] Images load progressively
- [ ] No timeouts
- [ ] Usable experience

#### Slow 3G
- [ ] Page loads within 15 seconds
- [ ] Critical content first
- [ ] Graceful degradation
- [ ] Loading indicators work

#### Offline
- [ ] Cached images display
- [ ] Error messages for new content
- [ ] No JavaScript errors
- [ ] Navigation still works

---

## Accessibility Testing

### Image Loading
- [ ] Alt text present on all images
- [ ] Loading states announced
- [ ] Keyboard navigation works
- [ ] Screen reader compatible

### Lightbox
- [ ] Escape key closes
- [ ] Arrow keys navigate
- [ ] Focus management correct
- [ ] ARIA labels present

---

## Performance Regression Testing

### Automated Checks
```javascript
// Performance regression test
function performanceTest() {
    const metrics = {
        images: document.querySelectorAll('img').length,
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        requests: performance.getEntriesByType('resource').length,
        cacheHits: performance.getEntriesByType('resource')
            .filter(r => r.transferSize === 0).length
    };
    
    const thresholds = {
        loadTime: 3000,
        requests: 50,
        cacheRatio: 0.5
    };
    
    console.log('Performance Test Results:');
    console.log(`Load Time: ${metrics.loadTime}ms (threshold: ${thresholds.loadTime}ms)`);
    console.log(`Requests: ${metrics.requests} (threshold: ${thresholds.requests})`);
    console.log(`Cache Ratio: ${(metrics.cacheHits/metrics.requests*100).toFixed(0)}%`);
    
    const passed = metrics.loadTime < thresholds.loadTime && 
                   metrics.requests < thresholds.requests;
    
    console.log(passed ? '✅ PASSED' : '❌ FAILED');
    return passed;
}
```

---

## Load Testing

### Single User
- [ ] 50 images load correctly
- [ ] 100 images load correctly
- [ ] 200 images handle gracefully
- [ ] Memory usage acceptable

### Concurrent Users (if applicable)
- [ ] CDN handles multiple requests
- [ ] No rate limiting issues
- [ ] Consistent response times
- [ ] No 429 errors

---

## Security Testing

### CDN Proxy
- [ ] Only allows valid file IDs
- [ ] Rejects path traversal attempts
- [ ] CORS properly configured
- [ ] No sensitive headers exposed

### Input Validation
```bash
# Test invalid inputs
curl https://images.kaiukodukant.ee/../../etc/passwd/w300
curl https://images.kaiukodukant.ee/;alert(1)/w300
curl https://images.kaiukodukant.ee/FILE_ID/w999999
```

---

## Final Validation Checklist

### Performance Goals Met
- [ ] 70% reduction in initial load time
- [ ] 90% reduction in repeat visit time
- [ ] 60% bandwidth reduction
- [ ] <2 second Time to Interactive

### User Experience
- [ ] No visual quality loss
- [ ] Smooth scrolling
- [ ] Fast navigation
- [ ] Mobile friendly

### Technical Implementation
- [ ] All tests passing
- [ ] No console errors
- [ ] Monitoring active
- [ ] Documentation complete

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Tester | | | |
| User Representative | | | |

## Notes & Observations

_Space for additional notes during testing:_

---

## Issues Found

| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| | | | |
| | | | |
| | | | |