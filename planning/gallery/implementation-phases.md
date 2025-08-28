# Gallery Performance Implementation Phases

## Overview
This document provides detailed implementation steps for each optimization phase, with code examples and specific tasks.

---

## Phase 1: Frontend Quick Wins (2 hours)

### Objective
Achieve 50-70% performance improvement without infrastructure changes.

### 1.1 Add Preconnect Hints (15 minutes)

**File**: `gallery.html`

Add to `<head>` section:
```html
<!-- Preconnect to Google Drive domains -->
<link rel="preconnect" href="https://drive.google.com">
<link rel="preconnect" href="https://lh3.googleusercontent.com">
<link rel="dns-prefetch" href="https://drive.google.com">
<link rel="dns-prefetch" href="https://lh3.googleusercontent.com">
```

### 1.2 Implement Proper Image Sizes (45 minutes)

**File**: `js/gallery.js`

Current problematic code:
```javascript
// All images use same size
thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
fullUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
```

New optimized code:
```javascript
// Multiple sizes for different contexts
const SIZES = {
    GRID_THUMB: 300,
    GRID_RETINA: 600,
    LIGHTBOX_SMALL: 800,
    LIGHTBOX_MEDIUM: 1200,
    LIGHTBOX_LARGE: 1600
};

function getOptimizedImageUrl(fileId, context = 'grid') {
    switch(context) {
        case 'grid':
            return {
                src: `https://drive.google.com/thumbnail?id=${fileId}&sz=w${SIZES.GRID_THUMB}`,
                srcset: `
                    https://drive.google.com/thumbnail?id=${fileId}&sz=w${SIZES.GRID_THUMB} 1x,
                    https://drive.google.com/thumbnail?id=${fileId}&sz=w${SIZES.GRID_RETINA} 2x
                `
            };
        case 'lightbox':
            return {
                src: `https://drive.google.com/uc?export=view&id=${fileId}`,
                srcset: `
                    https://drive.google.com/thumbnail?id=${fileId}&sz=w${SIZES.LIGHTBOX_SMALL} 800w,
                    https://drive.google.com/thumbnail?id=${fileId}&sz=w${SIZES.LIGHTBOX_MEDIUM} 1200w,
                    https://drive.google.com/thumbnail?id=${fileId}&sz=w${SIZES.LIGHTBOX_LARGE} 1600w
                `,
                sizes: '(max-width: 800px) 100vw, (max-width: 1200px) 80vw, 1200px'
            };
    }
}
```

### 1.3 Update Image Markup (30 minutes)

**File**: `js/gallery.js` - displayAlbumPhotos function

Replace image creation:
```javascript
// Old single-size approach
photoEl.innerHTML = `
    <img src="${thumbnailUrl}" 
         alt="${photo.caption || photo.name}" 
         loading="lazy" 
         class="object-cover w-full h-full">
`;

// New responsive approach
const imageUrls = getOptimizedImageUrl(fileId, 'grid');
photoEl.innerHTML = `
    <img src="${imageUrls.src}" 
         srcset="${imageUrls.srcset}"
         alt="${photo.caption || photo.name}" 
         loading="lazy"
         decoding="async"
         width="300"
         height="300"
         class="object-cover w-full h-full">
`;
```

### 1.4 Add Loading States (30 minutes)

**File**: `js/gallery.js`

Add skeleton loaders:
```javascript
function createImageSkeleton() {
    return `
        <div class="animate-pulse bg-gray-300 w-full h-full">
            <div class="h-full w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300"></div>
        </div>
    `;
}

// Use in image loading
photoEl.innerHTML = createImageSkeleton();
const img = new Image();
img.onload = () => {
    photoEl.innerHTML = ''; // Clear skeleton
    photoEl.appendChild(img);
};
img.src = imageUrls.src;
img.srcset = imageUrls.srcset;
```

### Phase 1 Testing Checklist
- [ ] Preconnect headers present in network tab
- [ ] Images load with correct sizes (300px for grid, not 1200px)
- [ ] Loading="lazy" working (images load as scrolled)
- [ ] Measure bandwidth reduction (should be 60-70% less)

---

## Phase 2: CDN Proxy Setup (4 hours)

### Objective
Add edge caching with proper cache headers for 90% faster repeat loads.

### 2.1 Cloudflare Account Setup (30 minutes)

1. Create free Cloudflare account
2. Add domain kaiukodukant.ee
3. Update nameservers if needed
4. Create Workers subdomain: `images.kaiukodukant.ee`

### 2.2 Deploy Worker Code (1 hour)

**File**: Create new Cloudflare Worker

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Parse URL: /fileId/w300?v=123
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length !== 2) {
      return new Response('Invalid URL format', { status: 400 });
    }
    
    const [fileId, sizeParam] = pathParts;
    const width = sizeParam.replace('w', '');
    
    // Validate inputs
    if (!fileId.match(/^[a-zA-Z0-9_-]+$/)) {
      return new Response('Invalid file ID', { status: 400 });
    }
    
    if (!width.match(/^\d{2,4}$/) || width > 2000) {
      return new Response('Invalid width', { status: 400 });
    }
    
    // Build Google Drive URL
    const driveUrl = width <= 400 
      ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`
      : `https://drive.google.com/uc?export=view&id=${fileId}`;
    
    // Create cache key
    const version = url.searchParams.get('v') || 'default';
    const cacheKey = new Request(
      `https://cache/${fileId}/w${width}?v=${version}`,
      request
    );
    
    const cache = caches.default;
    
    // Check cache
    let response = await cache.match(cacheKey);
    
    if (!response) {
      // Fetch from Google Drive
      response = await fetch(driveUrl, {
        cf: {
          cacheEverything: true,
          cacheTtl: 86400 // 1 day at CF edge
        }
      });
      
      if (!response.ok) {
        return new Response('Image fetch failed', { 
          status: response.status 
        });
      }
      
      // Clone response and add cache headers
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'X-Cache-Status': 'MISS',
          'Timing-Allow-Origin': '*'
        }
      });
      
      // Store in cache
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
      // Add cache HIT header
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          'X-Cache-Status': 'HIT'
        }
      });
    }
    
    return response;
  }
};
```

### 2.3 Configure Worker Routes (30 minutes)

In Cloudflare Dashboard:
1. Workers → Your Worker → Triggers
2. Add route: `images.kaiukodukant.ee/*`
3. Add DNS: CNAME `images` → `workers.dev`

### 2.4 Update Frontend URLs (1 hour)

**File**: `js/gallery.js`

```javascript
// Configuration
const USE_CDN = true;
const CDN_BASE = 'https://images.kaiukodukant.ee';

function getCDNUrl(fileId, width, version = null) {
    if (!USE_CDN) {
        // Fallback to direct Drive URL
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
    }
    
    let url = `${CDN_BASE}/${fileId}/w${width}`;
    if (version) {
        url += `?v=${version}`;
    }
    return url;
}

// Update image loading
const imageUrls = {
    src: getCDNUrl(photo.id, 300, photo.version),
    srcset: `
        ${getCDNUrl(photo.id, 300, photo.version)} 1x,
        ${getCDNUrl(photo.id, 600, photo.version)} 2x
    `
};
```

### 2.5 Add Fallback Mechanism (1 hour)

```javascript
function loadImageWithFallback(imgElement, cdnUrl, fallbackUrl) {
    imgElement.onerror = function() {
        if (this.src.includes('images.kaiukodukant.ee')) {
            // CDN failed, try direct Drive URL
            console.warn('CDN failed, falling back to Drive:', cdnUrl);
            this.onerror = null; // Prevent infinite loop
            this.src = fallbackUrl;
        }
    };
    imgElement.src = cdnUrl;
}
```

### Phase 2 Testing Checklist
- [ ] Worker responds at images.kaiukodukant.ee
- [ ] Cache headers set correctly (check DevTools)
- [ ] X-Cache-Status shows HIT on repeat loads
- [ ] Fallback works when CDN fails
- [ ] CORS headers present

---

## Phase 3: Advanced Optimizations (2 hours)

### Objective
Add versioning, advanced caching, and monitoring.

### 3.1 Add Version Parameters (1 hour)

**File**: Apps Script - Update backend

```javascript
// Enable Advanced Drive API in Apps Script
// Services → Add → Drive API → Add

function getAlbumPhotos(folderId, callback) {
    // ... existing code ...
    
    while (files.hasNext()) {
        const file = files.next();
        if (isImageFile(file)) {
            // Get file metadata for versioning
            let version = 'default';
            try {
                const metadata = Drive.Files.get(file.getId(), {
                    fields: 'md5Checksum,modifiedTime'
                });
                version = metadata.md5Checksum || 
                         new Date(metadata.modifiedTime).getTime();
            } catch(e) {
                // Fallback to file date
                version = file.getLastUpdated().getTime();
            }
            
            photos.push({
                id: file.getId(),
                name: file.getName(),
                version: version, // Add version for cache busting
                // ... other properties
            });
        }
    }
}
```

### 3.2 Implement ThumbnailLink (30 minutes)

```javascript
// Use Google's optimized thumbnail service
function getGoogleThumbnail(file) {
    try {
        const metadata = Drive.Files.get(file.getId(), {
            fields: 'thumbnailLink'
        });
        
        if (metadata.thumbnailLink) {
            // Format: https://lh3.googleusercontent.com/...=s220
            // Can adjust size by changing s parameter
            return {
                small: metadata.thumbnailLink.replace(/=s\d+/, '=s300'),
                medium: metadata.thumbnailLink.replace(/=s\d+/, '=s600'),
                large: metadata.thumbnailLink.replace(/=s\d+/, '=s1200')
            };
        }
    } catch(e) {
        console.error('ThumbnailLink failed:', e);
    }
    return null;
}
```

### 3.3 Add Performance Monitoring (30 minutes)

**File**: `js/gallery.js`

```javascript
// Performance monitoring
class GalleryPerformance {
    constructor() {
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            loadTimes: [],
            failedLoads: 0
        };
    }
    
    recordImageLoad(startTime, wasCached) {
        const loadTime = performance.now() - startTime;
        this.metrics.loadTimes.push(loadTime);
        
        if (wasCached) {
            this.metrics.cacheHits++;
        } else {
            this.metrics.cacheMisses++;
        }
        
        // Report if significant
        if (this.metrics.loadTimes.length % 10 === 0) {
            this.reportMetrics();
        }
    }
    
    reportMetrics() {
        const avgLoadTime = this.metrics.loadTimes.reduce((a,b) => a+b, 0) 
                          / this.metrics.loadTimes.length;
        const cacheHitRate = this.metrics.cacheHits 
                          / (this.metrics.cacheHits + this.metrics.cacheMisses);
        
        console.log('Gallery Performance:', {
            avgLoadTime: avgLoadTime.toFixed(2) + 'ms',
            cacheHitRate: (cacheHitRate * 100).toFixed(1) + '%',
            totalImages: this.metrics.loadTimes.length,
            failedLoads: this.metrics.failedLoads
        });
        
        // Send to analytics if configured
        if (typeof gtag !== 'undefined') {
            gtag('event', 'gallery_performance', {
                avg_load_time: avgLoadTime,
                cache_hit_rate: cacheHitRate
            });
        }
    }
}

const galleryPerf = new GalleryPerformance();
```

### Phase 3 Testing Checklist
- [ ] Version parameters in image URLs
- [ ] Cache busts on image update
- [ ] ThumbnailLink URLs working
- [ ] Performance metrics logging
- [ ] Analytics events firing

---

## Rollout Schedule

### Week 1
- **Monday-Tuesday**: Implement Phase 1
- **Wednesday**: Test and measure improvements
- **Thursday-Friday**: Set up Cloudflare account and worker

### Week 2
- **Monday-Tuesday**: Deploy Phase 2 CDN
- **Wednesday**: Monitor and optimize
- **Thursday-Friday**: Implement Phase 3 if needed

## Rollback Plan

Each phase can be independently rolled back:

### Phase 1 Rollback
```javascript
// Set flag in gallery.js
const USE_OPTIMIZED_IMAGES = false; // Revert to old behavior
```

### Phase 2 Rollback
```javascript
// Disable CDN
const USE_CDN = false; // Falls back to direct Drive URLs
```

### Phase 3 Rollback
```javascript
// Disable versioning
const USE_VERSIONING = false; // Use default cache behavior
```

## Success Metrics

Track these KPIs after each phase:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Initial Load Time | <3s | Chrome DevTools Performance |
| Repeat Load Time | <500ms | Disable cache, reload, enable, reload |
| Cache Hit Rate | >80% | X-Cache-Status headers |
| Failed Loads | <1% | Error tracking in gallery.js |
| User Satisfaction | >90% | Simple feedback widget |

## Support & Troubleshooting

Common issues and solutions:

### Images not loading
1. Check browser console for errors
2. Verify CDN worker is running
3. Test fallback URLs directly
4. Clear browser cache

### Slow performance
1. Check X-Cache-Status (should be HIT)
2. Verify correct image sizes loading
3. Check network throttling in DevTools
4. Monitor Cloudflare analytics

### Cache not updating
1. Verify version parameters changing
2. Check Cache-Control headers
3. Purge Cloudflare cache if needed
4. Wait for browser cache expiry