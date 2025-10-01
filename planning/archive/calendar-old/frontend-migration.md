# Frontend Migration Guide for Pilvio S3 Calendar

## Overview
This guide covers migrating the frontend from JSONP/Apps Script to fetching static JSON from Pilvio's S3-compatible storage service.

---

## Current Implementation Analysis

### Current Code (JSONP-based)
```javascript
// Current implementation in calendar.js
function loadCalendarEvents() {
    const url = `${GOOGLE_APPS_SCRIPT_URL}?action=calendar`;
    
    jsonp(url, function(data) {
        if (data.status === 'success' && data.events) {
            displayEvents(data.events);
        }
    }, function(error) {
        console.error('Error loading calendar:', error);
    });
}
```

### Issues with Current Approach
- JSONP is a security risk (script injection)
- No proper error handling
- Cannot use modern fetch features
- No caching control
- High latency (500-2000ms)

---

## New Implementation

### 1. Update Configuration

**File: `js/config.js`**

```javascript
// Configuration for MTÜ Kaiu Kodukant Website

// Existing Apps Script URL (keep as fallback)
window.GOOGLE_APPS_SCRIPT_URL = 'YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE';

// NEW: Pilvio S3 calendar URL
window.CALENDAR_S3_URL = 'https://s3.pilvio.com/kaiu-static/calendar/calendar.json';
// Or if using custom domain:
// window.CALENDAR_S3_URL = 'https://calendar.kaiukodukant.ee/calendar.json';
// Or with Pilvio CDN:
// window.CALENDAR_S3_URL = 'https://cdn.pilvio.com/kaiu-static/calendar/calendar.json';

// Calendar configuration
window.CALENDAR_CONFIG = {
  useS3: true,                    // Enable S3 fetching
  s3Url: window.CALENDAR_S3_URL,
  fallbackUrl: window.GOOGLE_APPS_SCRIPT_URL,
  cacheTime: 900000,             // 15 minutes in ms
  timeout: 3000,                  // 3 second timeout for S3
  retryAttempts: 2,              // Number of retries
  enableLocalCache: true          // Use localStorage for offline
};

// Existing reCAPTCHA configuration
window.RECAPTCHA_SITE_KEY = 'YOUR_RECAPTCHA_SITE_KEY_HERE';
```

### 2. New Calendar Loading Implementation

**File: `js/calendar.js` (updated)**

```javascript
// Calendar functionality for events page

// Remove old JSONP function (no longer needed with S3)
// Keep it temporarily for fallback

let calendar;
let calendarInitialized = false;
let allEvents = [];
let lastFetchTime = null;
let cachedData = null;

// Configuration
const CALENDAR_CONFIG = window.CALENDAR_CONFIG || {
  useS3: false,
  cacheTime: 900000
};

document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    const eventModal = document.getElementById('event-modal');
    const modalCloseBtn = document.getElementById('modal-close');
    const upcomingEventsEl = document.getElementById('upcoming-events');
    
    if (!calendarEl) return;

    // Initialize calendar with new loading method
    initializeCalendar();

    // ... existing modal handlers ...
});

/**
 * Initialize calendar with S3 or fallback loading
 */
async function initializeCalendar() {
    if (calendarInitialized) return;
    
    try {
        // Show loading state
        showCalendarLoading(true);
        
        // Load events from S3 or fallback
        const events = await loadCalendarEvents();
        
        // Initialize FullCalendar with events
        initFullCalendar(events);
        
        // Display upcoming events
        displayUpcomingEvents(events);
        
        calendarInitialized = true;
        
    } catch (error) {
        console.error('Failed to initialize calendar:', error);
        showCalendarError('Kalendri laadimine ebaõnnestus. Palun proovi hiljem uuesti.');
    } finally {
        showCalendarLoading(false);
    }
}

/**
 * Load calendar events from S3 with fallback
 */
async function loadCalendarEvents() {
    // Check cache first
    const cached = getCachedEvents();
    if (cached) {
        console.log('Using cached calendar data');
        return cached;
    }
    
    // Try S3 first if enabled
    if (CALENDAR_CONFIG.useS3) {
        try {
            const events = await loadFromS3();
            cacheEvents(events);
            return events;
        } catch (error) {
            console.warn('S3 load failed, trying fallback:', error);
        }
    }
    
    // Fallback to Apps Script
    return await loadFromAppsScript();
}

/**
 * Load events from Pilvio S3
 */
async function loadFromS3() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CALENDAR_CONFIG.timeout || 3000);
    
    try {
        const response = await fetch(CALENDAR_CONFIG.s3Url, {
            method: 'GET',
            signal: controller.signal,
            cache: 'default', // Use browser cache
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Check cache headers for debugging (if available)
        const cacheControl = response.headers.get('cache-control');
        const lastModified = response.headers.get('last-modified');
        console.log(`Pilvio S3 Calendar loaded (Cache-Control: ${cacheControl}, Last-Modified: ${lastModified})`);
        
        const data = await response.json();
        
        // Validate data structure
        if (!data.events || !Array.isArray(data.events)) {
            throw new Error('Invalid calendar data structure');
        }
        
        // Transform to FullCalendar format
        return transformEventsForFullCalendar(data.events);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw error;
    }
}

/**
 * Fallback: Load events from Apps Script
 */
async function loadFromAppsScript() {
    return new Promise((resolve, reject) => {
        const url = `${window.GOOGLE_APPS_SCRIPT_URL}?action=calendar`;
        
        console.log('Using Apps Script fallback');
        
        // Use existing JSONP for compatibility
        jsonp(url, 
            function(data) {
                if (data.status === 'success' && data.events) {
                    const events = transformEventsForFullCalendar(data.events);
                    cacheEvents(events);
                    resolve(events);
                } else {
                    reject(new Error(data.message || 'Failed to load calendar'));
                }
            },
            function(error) {
                reject(error);
            }
        );
    });
}

/**
 * Transform events to FullCalendar format
 */
function transformEventsForFullCalendar(events) {
    return events.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay || false,
        extendedProps: {
            location: event.location || '',
            description: event.description || ''
        },
        color: event.color || '#3788d8',
        textColor: '#ffffff'
    }));
}

/**
 * Cache events in localStorage
 */
function cacheEvents(events) {
    if (!CALENDAR_CONFIG.enableLocalCache) return;
    
    try {
        const cacheData = {
            events: events,
            timestamp: Date.now(),
            version: 1
        };
        localStorage.setItem('kaiu_calendar_cache', JSON.stringify(cacheData));
        cachedData = events;
        lastFetchTime = Date.now();
    } catch (e) {
        console.warn('Failed to cache events:', e);
    }
}

/**
 * Get cached events if still valid
 */
function getCachedEvents() {
    if (!CALENDAR_CONFIG.enableLocalCache) return null;
    
    // Check memory cache first
    if (cachedData && lastFetchTime) {
        const age = Date.now() - lastFetchTime;
        if (age < CALENDAR_CONFIG.cacheTime) {
            return cachedData;
        }
    }
    
    // Check localStorage
    try {
        const stored = localStorage.getItem('kaiu_calendar_cache');
        if (!stored) return null;
        
        const cacheData = JSON.parse(stored);
        const age = Date.now() - cacheData.timestamp;
        
        // Check if cache is still valid (15 minutes)
        if (age < CALENDAR_CONFIG.cacheTime) {
            cachedData = cacheData.events;
            lastFetchTime = cacheData.timestamp;
            return cacheData.events;
        }
        
        // Clear expired cache
        localStorage.removeItem('kaiu_calendar_cache');
        
    } catch (e) {
        console.warn('Failed to read cache:', e);
    }
    
    return null;
}

/**
 * Force refresh calendar (bypass cache)
 */
async function refreshCalendar() {
    // Clear cache
    localStorage.removeItem('kaiu_calendar_cache');
    cachedData = null;
    lastFetchTime = null;
    
    // Reload
    await initializeCalendar();
}

/**
 * Initialize FullCalendar with events
 */
function initFullCalendar(events) {
    const calendarEl = document.getElementById('calendar');
    
    // Store events globally for upcoming events list
    allEvents = events;
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'et',
        height: 'auto',
        events: events,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'refresh' // Add refresh button
        },
        customButtons: {
            refresh: {
                text: '🔄',
                hint: 'Värskenda kalendrit',
                click: async function() {
                    await refreshCalendar();
                }
            }
        },
        eventClick: function(info) {
            showEventModal(info.event);
        },
        // ... rest of existing calendar config ...
    });
    
    calendar.render();
}

/**
 * Show loading state
 */
function showCalendarLoading(show) {
    const calendarEl = document.getElementById('calendar');
    const loadingEl = document.getElementById('calendar-loading');
    
    if (show) {
        if (!loadingEl) {
            const loading = document.createElement('div');
            loading.id = 'calendar-loading';
            loading.className = 'text-center py-8';
            loading.innerHTML = `
                <div class="inline-flex items-center">
                    <svg class="animate-spin h-8 w-8 text-blue-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-lg text-gray-600">Kalendri laadimine...</span>
                </div>
            `;
            calendarEl.parentNode.insertBefore(loading, calendarEl);
        }
    } else {
        if (loadingEl) {
            loadingEl.remove();
        }
    }
}

/**
 * Show error message
 */
function showCalendarError(message) {
    const calendarEl = document.getElementById('calendar');
    const errorEl = document.createElement('div');
    errorEl.className = 'bg-red-50 border-l-4 border-red-500 p-4 mb-4';
    errorEl.innerHTML = `
        <div class="flex">
            <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
            </div>
            <div class="ml-3">
                <p class="text-sm text-red-700">${message}</p>
                <button onclick="refreshCalendar()" class="mt-2 text-sm text-red-600 hover:text-red-500 underline">
                    Proovi uuesti
                </button>
            </div>
        </div>
    `;
    calendarEl.parentNode.insertBefore(errorEl, calendarEl);
}

// ... rest of existing calendar.js code (upcoming events, modal, etc.) ...
```

### 3. Performance Monitoring

Add performance tracking to measure improvements:

```javascript
/**
 * Performance monitoring for calendar loading
 */
class CalendarPerformance {
    constructor() {
        this.metrics = [];
    }
    
    async measureLoad(loadFunction, source) {
        const startTime = performance.now();
        
        try {
            const result = await loadFunction();
            const duration = performance.now() - startTime;
            
            this.recordMetric({
                source: source,
                duration: duration,
                success: true,
                timestamp: Date.now(),
                eventCount: result.length
            });
            
            console.log(`Calendar loaded from ${source} in ${duration.toFixed(2)}ms`);
            
            return result;
            
        } catch (error) {
            const duration = performance.now() - startTime;
            
            this.recordMetric({
                source: source,
                duration: duration,
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
            
            throw error;
        }
    }
    
    recordMetric(metric) {
        this.metrics.push(metric);
        
        // Send to analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'calendar_load', {
                event_category: 'Performance',
                event_label: metric.source,
                value: Math.round(metric.duration),
                custom_map: {
                    dimension1: metric.success ? 'success' : 'failure'
                }
            });
        }
        
        // Store metrics for analysis
        try {
            const stored = JSON.parse(localStorage.getItem('calendar_metrics') || '[]');
            stored.push(metric);
            // Keep only last 50 metrics
            if (stored.length > 50) {
                stored.shift();
            }
            localStorage.setItem('calendar_metrics', JSON.stringify(stored));
        } catch (e) {
            // Ignore storage errors
        }
    }
    
    getStats() {
        const s3Metrics = this.metrics.filter(m => m.source === 's3');
        const fallbackMetrics = this.metrics.filter(m => m.source === 'appsScript');
        
        return {
            s3: {
                count: s3Metrics.length,
                successRate: s3Metrics.filter(m => m.success).length / s3Metrics.length,
                avgDuration: s3Metrics.reduce((sum, m) => sum + m.duration, 0) / s3Metrics.length
            },
            fallback: {
                count: fallbackMetrics.length,
                successRate: fallbackMetrics.filter(m => m.success).length / fallbackMetrics.length,
                avgDuration: fallbackMetrics.reduce((sum, m) => sum + m.duration, 0) / fallbackMetrics.length
            }
        };
    }
}

const calendarPerf = new CalendarPerformance();

// Use in loading functions
async function loadFromS3() {
    return calendarPerf.measureLoad(async () => {
        // ... existing S3 loading code ...
    }, 's3');
}

async function loadFromAppsScript() {
    return calendarPerf.measureLoad(async () => {
        // ... existing Apps Script loading code ...
    }, 'appsScript');
}
```

### 4. Progressive Enhancement

Support browsers without fetch API:

```javascript
/**
 * Polyfill for older browsers
 */
if (!window.fetch) {
    console.warn('Fetch not supported, using Apps Script fallback only');
    CALENDAR_CONFIG.useS3 = false;
}

/**
 * Check if browser supports required features
 */
function checkBrowserSupport() {
    const required = {
        fetch: typeof window.fetch !== 'undefined',
        promise: typeof Promise !== 'undefined',
        localStorage: typeof localStorage !== 'undefined',
        json: typeof JSON !== 'undefined'
    };
    
    const supported = Object.values(required).every(v => v);
    
    if (!supported) {
        console.warn('Browser missing required features:', required);
        // Use simplified fallback
        loadLegacyCalendar();
    }
    
    return supported;
}
```

---

## Migration Steps

### Phase 1: Preparation (Before S3 Setup)
1. **Add configuration** to config.js
2. **Keep existing JSONP** code as fallback
3. **Test existing functionality** still works
4. **Add performance monitoring**

### Phase 2: Dual Mode (Pilvio S3 + Fallback)
1. **Configure Pilvio S3 bucket**
2. **Deploy Apps Script sync**
3. **Update calendar.js** with new code
4. **Set useS3: false** initially
5. **Test fallback works**
6. **Enable S3 gradually**

### Phase 3: S3 Primary
1. **Set useS3: true**
2. **Monitor performance**
3. **Check error rates**
4. **Verify caching works**

### Phase 4: Optimization
1. **Fine-tune cache times**
2. **Add preloading**
3. **Remove JSONP code** (after 30 days)

---

## Testing Plan

### Unit Tests

```javascript
// Test calendar loading
async function testCalendarLoading() {
    console.group('Calendar Loading Tests');
    
    // Test S3 loading
    try {
        const events = await loadFromS3();
        console.log('✅ S3 loading:', events.length, 'events');
    } catch (e) {
        console.error('❌ S3 loading failed:', e);
    }
    
    // Test fallback
    try {
        CALENDAR_CONFIG.useS3 = false;
        const events = await loadFromAppsScript();
        console.log('✅ Fallback loading:', events.length, 'events');
    } catch (e) {
        console.error('❌ Fallback loading failed:', e);
    }
    
    // Test caching
    const cached1 = getCachedEvents();
    console.log('✅ Cache check 1:', cached1 ? 'Hit' : 'Miss');
    
    // Test cache expiry
    lastFetchTime = Date.now() - (CALENDAR_CONFIG.cacheTime + 1000);
    const cached2 = getCachedEvents();
    console.log('✅ Cache expiry:', cached2 ? 'Failed' : 'Passed');
    
    console.groupEnd();
}
```

### Integration Tests

```javascript
// Full integration test
async function testFullIntegration() {
    const results = {
        s3Load: false,
        fallback: false,
        caching: false,
        performance: false,
        ui: false
    };
    
    // Test S3 load time
    const start = performance.now();
    try {
        await loadFromS3();
        const duration = performance.now() - start;
        results.s3Load = duration < 500;
        console.log(`S3 Load: ${duration}ms (${results.s3Load ? 'PASS' : 'FAIL'})`);
    } catch (e) {
        console.error('S3 failed:', e);
    }
    
    // Test fallback
    CALENDAR_CONFIG.useS3 = false;
    try {
        await loadCalendarEvents();
        results.fallback = true;
    } catch (e) {
        console.error('Fallback failed:', e);
    }
    
    // Test caching
    CALENDAR_CONFIG.useS3 = true;
    await loadCalendarEvents();
    const cached = getCachedEvents();
    results.caching = cached !== null;
    
    // Check UI rendering
    results.ui = document.querySelector('.fc-event') !== null;
    
    console.table(results);
    return Object.values(results).every(v => v);
}
```

---

## Rollback Plan

If issues occur, rollback is simple:

```javascript
// In config.js - disable S3
window.CALENDAR_CONFIG = {
  useS3: false,  // Set to false to use Apps Script only
  // ... rest of config
};

// Or via console for immediate rollback
CALENDAR_CONFIG.useS3 = false;
localStorage.removeItem('kaiu_calendar_cache');
location.reload();
```

---

## Performance Expectations

### Before (Apps Script)
- First Load: 500-2000ms
- Cached Load: 500-2000ms (no cache)
- Global Users: 1000-3000ms

### After (Pilvio S3)
- First Load: 30-100ms (same datacenter)
- Cached Load: 0-10ms (localStorage)
- Same Region: 10-50ms
- With CDN: 20-100ms globally

### Improvement
- **95% faster first load**
- **99% faster cached load**
- **Network savings: 100% on cached loads**

---

## Monitoring Dashboard

```javascript
// Console dashboard for monitoring
const CalendarDashboard = {
    show() {
        const stats = calendarPerf.getStats();
        const cache = getCachedEvents();
        
        console.group('📊 Calendar Performance Dashboard');
        
        console.table({
            'S3 Requests': stats.s3.count,
            'S3 Success Rate': (stats.s3.successRate * 100).toFixed(1) + '%',
            'S3 Avg Time': stats.s3.avgDuration?.toFixed(2) + 'ms',
            'Fallback Used': stats.fallback.count,
            'Cache Status': cache ? 'HIT' : 'MISS',
            'Cache Age': cache ? ((Date.now() - lastFetchTime) / 1000).toFixed(0) + 's' : 'N/A'
        });
        
        console.groupEnd();
    },
    
    clearCache() {
        localStorage.removeItem('kaiu_calendar_cache');
        cachedData = null;
        lastFetchTime = null;
        console.log('✅ Cache cleared');
    },
    
    testPerformance() {
        return testFullIntegration();
    }
};

// Make available globally for debugging
window.CalendarDashboard = CalendarDashboard;
```

---

## Go-Live Checklist

- [ ] S3 bucket configured and accessible
- [ ] CloudFront distribution active
- [ ] Apps Script uploading to S3
- [ ] config.js updated with S3 URL
- [ ] calendar.js updated with new code
- [ ] Fallback tested and working
- [ ] Caching tested
- [ ] Performance monitoring active
- [ ] Error handling tested
- [ ] Rollback plan documented
- [ ] Team trained on monitoring

This completes the frontend migration guide for S3 calendar integration.