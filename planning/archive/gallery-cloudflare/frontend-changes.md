# Frontend Gallery Optimization Guide

## Overview
This document details all frontend changes needed to optimize gallery performance, with before/after code examples.

## File Structure
```
js/
├── gallery.js (main changes)
├── config.js (add CDN configuration)
└── gallery-performance.js (new file for monitoring)

gallery.html
└── Add preconnect tags
```

---

## 1. HTML Changes

### File: `gallery.html`

#### Add Preconnect Tags (Head Section)
```html
<!-- BEFORE: No preconnect -->

<!-- AFTER: Add these to <head> -->
<link rel="preconnect" href="https://drive.google.com" crossorigin>
<link rel="preconnect" href="https://lh3.googleusercontent.com" crossorigin>
<link rel="preconnect" href="https://images.kaiukodukant.ee" crossorigin>
<link rel="dns-prefetch" href="https://drive.google.com">
<link rel="dns-prefetch" href="https://lh3.googleusercontent.com">
<link rel="dns-prefetch" href="https://images.kaiukodukant.ee">

<!-- Preload critical CSS -->
<link rel="preload" href="css/styles.css" as="style">
```

---

## 2. Configuration Updates

### File: `js/config.js`

```javascript
// BEFORE: Basic configuration
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';

// AFTER: Extended configuration with CDN
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';

// Gallery CDN Configuration
const GALLERY_CONFIG = {
    // Feature flags
    USE_CDN: true,
    USE_RESPONSIVE_IMAGES: true,
    USE_LAZY_LOADING: true,
    USE_PERFORMANCE_MONITORING: true,
    
    // CDN settings
    CDN_BASE_URL: 'https://images.kaiukodukant.ee',
    CDN_FALLBACK_ENABLED: true,
    
    // Image sizes (pixels)
    SIZES: {
        THUMB_SMALL: 300,
        THUMB_MEDIUM: 600,
        FULL_SMALL: 800,
        FULL_MEDIUM: 1200,
        FULL_LARGE: 1600
    },
    
    // Performance
    LAZY_LOAD_OFFSET: 50, // pixels before viewport
    MAX_CONCURRENT_LOADS: 4,
    
    // Cache settings (for future localStorage implementation)
    CACHE_ENABLED: false,
    CACHE_DURATION_HOURS: 24,
    CACHE_MAX_SIZE_MB: 50
};
```

---

## 3. Main Gallery JavaScript Changes

### File: `js/gallery.js`

#### Image URL Generation

```javascript
// BEFORE: Single size, direct Drive URLs
function displayAlbumPhotos(photos) {
    photos.forEach((photo, index) => {
        let thumbnailUrl = photo.thumbnailUrl;
        let fullUrl = photo.url;
        
        if (thumbnailUrl && thumbnailUrl.includes('drive.google.com/uc?id=')) {
            const fileId = thumbnailUrl.split('id=')[1]?.split('&')[0];
            if (fileId) {
                thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
                fullUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
            }
        }
        
        photoEl.innerHTML = `
            <img src="${thumbnailUrl}" 
                 alt="${photo.caption || photo.name}" 
                 loading="lazy" 
                 class="object-cover w-full h-full">
        `;
    });
}

// AFTER: Responsive images with CDN and srcset
class ImageUrlBuilder {
    constructor(config = GALLERY_CONFIG) {
        this.config = config;
    }
    
    getImageUrls(photo, context = 'grid') {
        const fileId = this.extractFileId(photo.thumbnailUrl || photo.url);
        if (!fileId) return this.getFallbackUrls();
        
        if (context === 'grid') {
            return this.getGridImageUrls(fileId, photo.version);
        } else {
            return this.getLightboxImageUrls(fileId, photo.version);
        }
    }
    
    extractFileId(url) {
        if (!url) return null;
        const match = url.match(/id=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }
    
    getGridImageUrls(fileId, version) {
        const { SIZES } = this.config;
        
        if (this.config.USE_CDN) {
            return {
                src: this.getCdnUrl(fileId, SIZES.THUMB_SMALL, version),
                srcset: `
                    ${this.getCdnUrl(fileId, SIZES.THUMB_SMALL, version)} 1x,
                    ${this.getCdnUrl(fileId, SIZES.THUMB_MEDIUM, version)} 2x
                `,
                fallback: this.getDriveUrl(fileId, SIZES.THUMB_SMALL)
            };
        } else {
            return {
                src: this.getDriveUrl(fileId, SIZES.THUMB_SMALL),
                srcset: `
                    ${this.getDriveUrl(fileId, SIZES.THUMB_SMALL)} 1x,
                    ${this.getDriveUrl(fileId, SIZES.THUMB_MEDIUM)} 2x
                `
            };
        }
    }
    
    getLightboxImageUrls(fileId, version) {
        const { SIZES } = this.config;
        
        if (this.config.USE_CDN) {
            return {
                src: this.getCdnUrl(fileId, SIZES.FULL_MEDIUM, version),
                srcset: `
                    ${this.getCdnUrl(fileId, SIZES.FULL_SMALL, version)} 800w,
                    ${this.getCdnUrl(fileId, SIZES.FULL_MEDIUM, version)} 1200w,
                    ${this.getCdnUrl(fileId, SIZES.FULL_LARGE, version)} 1600w
                `,
                sizes: '(max-width: 800px) 100vw, (max-width: 1200px) 80vw, 1200px',
                fallback: this.getDriveUrl(fileId, SIZES.FULL_LARGE)
            };
        } else {
            return {
                src: this.getDriveUrl(fileId, SIZES.FULL_LARGE),
                srcset: null,
                sizes: null
            };
        }
    }
    
    getCdnUrl(fileId, width, version) {
        const base = `${this.config.CDN_BASE_URL}/${fileId}/w${width}`;
        return version ? `${base}?v=${version}` : base;
    }
    
    getDriveUrl(fileId, width) {
        if (width <= 600) {
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
        } else {
            return `https://drive.google.com/uc?export=view&id=${fileId}`;
        }
    }
    
    getFallbackUrls() {
        return {
            src: 'data:image/svg+xml,...', // placeholder SVG
            srcset: null
        };
    }
}

// Initialize URL builder
const imageUrlBuilder = new ImageUrlBuilder();
```

#### Enhanced Image Loading

```javascript
// AFTER: Advanced image loading with error handling
class GalleryImageLoader {
    constructor() {
        this.loadingImages = new Set();
        this.loadedImages = new Set();
        this.failedImages = new Map();
        this.observer = null;
        this.initIntersectionObserver();
    }
    
    initIntersectionObserver() {
        if (!('IntersectionObserver' in window)) return;
        
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                rootMargin: `${GALLERY_CONFIG.LAZY_LOAD_OFFSET}px`,
                threshold: 0.01
            }
        );
    }
    
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                this.loadImage(img);
                this.observer.unobserve(img);
            }
        });
    }
    
    createImageElement(photo, context = 'grid') {
        const urls = imageUrlBuilder.getImageUrls(photo, context);
        const img = document.createElement('img');
        
        // Set attributes
        img.alt = photo.caption || photo.name || 'Gallery image';
        img.className = 'gallery-image opacity-0 transition-opacity duration-300';
        img.loading = 'lazy';
        img.decoding = 'async';
        
        // Set dimensions for layout stability
        if (context === 'grid') {
            img.width = GALLERY_CONFIG.SIZES.THUMB_SMALL;
            img.height = GALLERY_CONFIG.SIZES.THUMB_SMALL;
        }
        
        // Store URLs in data attributes
        img.dataset.src = urls.src;
        if (urls.srcset) img.dataset.srcset = urls.srcset;
        if (urls.sizes) img.dataset.sizes = urls.sizes;
        if (urls.fallback) img.dataset.fallback = urls.fallback;
        img.dataset.photoId = photo.id;
        
        // Add placeholder
        img.src = this.getPlaceholder(context);
        
        // Add error handling
        img.onerror = () => this.handleImageError(img);
        img.onload = () => this.handleImageLoad(img);
        
        return img;
    }
    
    loadImage(img) {
        const src = img.dataset.src;
        if (!src || this.loadingImages.has(src)) return;
        
        this.loadingImages.add(src);
        
        // Check if already failed recently
        if (this.failedImages.has(src)) {
            const failTime = this.failedImages.get(src);
            if (Date.now() - failTime < 60000) { // Retry after 1 minute
                return;
            }
        }
        
        // Load image
        img.src = src;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        if (img.dataset.sizes) img.sizes = img.dataset.sizes;
    }
    
    handleImageLoad(img) {
        const src = img.src;
        this.loadingImages.delete(src);
        this.loadedImages.add(src);
        img.classList.remove('opacity-0');
        
        // Report performance
        if (window.galleryPerformance) {
            window.galleryPerformance.recordImageLoad(src, true);
        }
    }
    
    handleImageError(img) {
        const src = img.src;
        console.warn('Image failed to load:', src);
        
        this.loadingImages.delete(src);
        this.failedImages.set(src, Date.now());
        
        // Try fallback if available
        if (img.dataset.fallback && !img.dataset.fallbackTried) {
            img.dataset.fallbackTried = 'true';
            img.src = img.dataset.fallback;
        } else {
            // Show error placeholder
            img.src = this.getErrorPlaceholder();
            img.classList.remove('opacity-0');
        }
        
        // Report performance
        if (window.galleryPerformance) {
            window.galleryPerformance.recordImageError(src);
        }
    }
    
    observeImage(img) {
        if (this.observer) {
            this.observer.observe(img);
        } else {
            // Fallback for browsers without IntersectionObserver
            this.loadImage(img);
        }
    }
    
    getPlaceholder(context) {
        // Tiny base64 blurred placeholder or SVG
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2U1ZTdlYiIvPjwvc3ZnPg==';
    }
    
    getErrorPlaceholder() {
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Crect fill="%23f3f4f6"/%3E%3Ctext x="150" y="150" text-anchor="middle" fill="%239ca3af"%3EImage unavailable%3C/text%3E%3C/svg%3E';
    }
    
    preloadImage(url) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        document.head.appendChild(link);
    }
}

// Initialize loader
const imageLoader = new GalleryImageLoader();
```

#### Updated Display Functions

```javascript
// AFTER: Optimized display function
function displayAlbumPhotos(photos) {
    document.getElementById('photo-album-title').textContent = currentAlbumTitle;
    document.getElementById('photo-album-description').textContent = currentAlbumDescription;

    photoGrid.innerHTML = '';
    lightboxPhotos = [];

    if (photos.length === 0) {
        photoGrid.innerHTML = '<p class="text-center text-text-secondary col-span-full">Selles albumis pole veel pilte.</p>';
        return;
    }
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    photos.forEach((photo, index) => {
        // Store for lightbox
        const lightboxUrls = imageUrlBuilder.getImageUrls(photo, 'lightbox');
        lightboxPhotos.push({
            src: lightboxUrls.src,
            srcset: lightboxUrls.srcset,
            sizes: lightboxUrls.sizes,
            caption: photo.caption || photo.name
        });
        
        // Create photo element
        const photoEl = document.createElement('div');
        photoEl.className = 'photo-thumbnail cursor-pointer overflow-hidden rounded-lg aspect-square bg-gray-200 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300';
        
        // Create image with optimization
        const img = imageLoader.createImageElement(photo, 'grid');
        photoEl.appendChild(img);
        
        // Add click handler
        photoEl.addEventListener('click', () => openLightbox(index));
        
        // Add to fragment
        fragment.appendChild(photoEl);
        
        // Start observing for lazy load
        imageLoader.observeImage(img);
        
        // Preload first 3 images immediately
        if (index < 3) {
            imageLoader.loadImage(img);
        }
    });
    
    // Add all elements at once
    photoGrid.appendChild(fragment);
}
```

---

## 4. Performance Monitoring

### File: `js/gallery-performance.js` (NEW)

```javascript
// Gallery Performance Monitoring
class GalleryPerformance {
    constructor() {
        this.metrics = {
            pageLoadTime: 0,
            imagesLoaded: 0,
            imagesFailed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalBytesLoaded: 0,
            loadTimes: [],
            errors: []
        };
        
        this.initPerformanceObserver();
        this.startTime = performance.now();
    }
    
    initPerformanceObserver() {
        if (!('PerformanceObserver' in window)) return;
        
        // Observe resource timing
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name.includes('images.kaiukodukant.ee') || 
                    entry.name.includes('drive.google.com')) {
                    this.recordResourceTiming(entry);
                }
            }
        });
        
        observer.observe({ entryTypes: ['resource'] });
    }
    
    recordResourceTiming(entry) {
        const loadTime = entry.responseEnd - entry.startTime;
        this.metrics.loadTimes.push({
            url: entry.name,
            duration: loadTime,
            size: entry.transferSize,
            cached: entry.transferSize === 0
        });
        
        if (entry.transferSize === 0) {
            this.metrics.cacheHits++;
        } else {
            this.metrics.cacheMisses++;
            this.metrics.totalBytesLoaded += entry.transferSize;
        }
    }
    
    recordImageLoad(url, cached = false) {
        this.metrics.imagesLoaded++;
        if (cached) this.metrics.cacheHits++;
        this.checkAndReport();
    }
    
    recordImageError(url) {
        this.metrics.imagesFailed++;
        this.metrics.errors.push({
            url,
            timestamp: Date.now()
        });
        this.checkAndReport();
    }
    
    checkAndReport() {
        // Report every 10 images
        if ((this.metrics.imagesLoaded + this.metrics.imagesFailed) % 10 === 0) {
            this.report();
        }
    }
    
    report() {
        const totalImages = this.metrics.imagesLoaded + this.metrics.imagesFailed;
        const avgLoadTime = this.metrics.loadTimes.length > 0
            ? this.metrics.loadTimes.reduce((a, b) => a + b.duration, 0) / this.metrics.loadTimes.length
            : 0;
        
        const cacheRate = totalImages > 0
            ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
            : 0;
        
        const report = {
            totalImages,
            successRate: totalImages > 0 ? (this.metrics.imagesLoaded / totalImages) * 100 : 0,
            cacheHitRate: cacheRate,
            avgLoadTime: avgLoadTime.toFixed(2),
            totalMB: (this.metrics.totalBytesLoaded / 1024 / 1024).toFixed(2),
            pageLoadTime: (performance.now() - this.startTime) / 1000
        };
        
        console.log('📊 Gallery Performance:', report);
        
        // Send to analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'gallery_performance', {
                'event_category': 'Performance',
                'event_label': 'Gallery Load',
                'value': Math.round(avgLoadTime),
                'custom_map': {
                    'dimension1': report.cacheHitRate,
                    'dimension2': report.successRate,
                    'dimension3': report.totalMB
                }
            });
        }
        
        return report;
    }
    
    getReport() {
        return this.report();
    }
}

// Initialize performance monitoring
window.galleryPerformance = new GalleryPerformance();
```

---

## 5. Lightbox Optimizations

```javascript
// AFTER: Optimized lightbox with preloading
function openLightbox(index) {
    currentLightboxIndex = index;
    updateLightboxImage();
    
    // Preload adjacent images
    preloadAdjacentImages(index);
    
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
}

function preloadAdjacentImages(currentIndex) {
    const preloadIndexes = [
        currentIndex - 1,
        currentIndex + 1,
        currentIndex - 2,
        currentIndex + 2
    ];
    
    preloadIndexes.forEach(index => {
        if (index >= 0 && index < lightboxPhotos.length) {
            const photo = lightboxPhotos[index];
            if (photo.src && !imageLoader.loadedImages.has(photo.src)) {
                imageLoader.preloadImage(photo.src);
            }
        }
    });
}

function updateLightboxImage() {
    const photo = lightboxPhotos[currentLightboxIndex];
    
    // Show loading state
    lightboxImg.classList.add('opacity-50');
    
    // Update image with srcset
    lightboxImg.src = photo.src;
    if (photo.srcset) lightboxImg.srcset = photo.srcset;
    if (photo.sizes) lightboxImg.sizes = photo.sizes;
    lightboxImg.alt = photo.caption;
    
    // Update caption
    lightboxCaption.textContent = photo.caption;
    
    // Handle load complete
    lightboxImg.onload = () => {
        lightboxImg.classList.remove('opacity-50');
        preloadAdjacentImages(currentLightboxIndex);
    };
    
    // Update navigation visibility
    lightboxPrev.style.display = lightboxPhotos.length > 1 ? 'flex' : 'none';
    lightboxNext.style.display = lightboxPhotos.length > 1 ? 'flex' : 'none';
}
```

---

## 6. Complete Integration Example

```javascript
// Complete optimized gallery initialization
document.addEventListener('DOMContentLoaded', function() {
    // Initialize components
    const imageLoader = new GalleryImageLoader();
    const performance = new GalleryPerformance();
    
    // ... existing gallery code ...
    
    // Add performance reporting on page unload
    window.addEventListener('beforeunload', () => {
        const report = performance.getReport();
        
        // Send beacon with final metrics
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/analytics', JSON.stringify(report));
        }
    });
});
```

---

## Migration Checklist

### Phase 1: Preparation
- [ ] Backup current gallery.js
- [ ] Add configuration to config.js
- [ ] Test in development environment

### Phase 2: Implementation
- [ ] Add preconnect tags to HTML
- [ ] Implement ImageUrlBuilder class
- [ ] Update displayAlbumPhotos function
- [ ] Add GalleryImageLoader class
- [ ] Integrate performance monitoring

### Phase 3: Testing
- [ ] Test grid image loading
- [ ] Test lightbox functionality
- [ ] Verify fallback mechanism
- [ ] Check performance metrics
- [ ] Test on mobile devices

### Phase 4: Optimization
- [ ] Fine-tune lazy loading offset
- [ ] Adjust image sizes based on analytics
- [ ] Optimize concurrent loading limits
- [ ] Review error rates

## Rollback Plan

If issues arise, revert by:

1. **Disable CDN**:
```javascript
GALLERY_CONFIG.USE_CDN = false;
```

2. **Disable responsive images**:
```javascript
GALLERY_CONFIG.USE_RESPONSIVE_IMAGES = false;
```

3. **Full revert**: Replace gallery.js with backup

## Performance Targets

After implementation, verify:

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Image Display | <1s | Performance.now() |
| Grid Fully Loaded | <3s | All images loaded |
| Cache Hit Rate | >80% | X-Cache-Status headers |
| Bandwidth Saved | >60% | Network tab total |
| Error Rate | <1% | Failed loads / total |