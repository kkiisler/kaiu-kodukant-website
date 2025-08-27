# Calendar Security Migration Plan

## Executive Summary
Migrate calendar functionality from client-side Google Calendar API calls (with exposed API key) to server-side Google Apps Script proxy for enhanced security.

## 1. Security Vulnerability Analysis

### Current State (VULNERABLE)
```
Frontend (calendar.js) → Google Calendar API
         ↑
    API Key (EXPOSED)
```

**Critical Issues:**
- ❌ **API Key Exposure**: `GOOGLE_API_KEY` visible in `js/calendar.js` line 8
- ❌ **Quota Theft**: Anyone can use the API key for their own purposes
- ❌ **No Access Control**: Cannot restrict who uses the API
- ❌ **Billing Risk**: Potential for unexpected charges if quota exceeded
- ❌ **No Rate Limiting**: Vulnerable to abuse

### Risk Assessment
- **Severity**: CRITICAL
- **Exploitability**: HIGH (API key visible in browser DevTools)
- **Impact**: HIGH (quota exhaustion, potential costs, service disruption)
- **Current Status**: API key already removed from GitHub repository

## 2. Proposed Secure Architecture

### New Architecture
```
Frontend (calendar.js) → Google Apps Script → Google Calendar Service
                              ↑
                         (Server-side auth)
```

**Security Benefits:**
- ✅ **No Client Secrets**: API credentials stay server-side
- ✅ **Access Control**: CORS headers restrict domains
- ✅ **Rate Limiting**: Apps Script quotas prevent abuse
- ✅ **Caching**: Reduces API calls (15-minute cache)
- ✅ **Audit Trail**: Apps Script logs all requests

## 3. Technical Implementation

### 3.1 Backend Implementation (apps-script-backend.js)

Add the missing `getCalendarEvents()` function:

```javascript
/**
 * Gets calendar events from Google Calendar with caching
 * Called via: GET ?action=calendar
 */
function getCalendarEvents(headers) {
  try {
    // Check cache first (15-minute cache)
    const cache = CacheService.getScriptCache();
    const cacheKey = 'calendar_events';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached calendar events');
      return createResponse({
        status: 'success',
        events: JSON.parse(cachedData),
        cached: true
      }, 200, headers);
    }
    
    // Get calendar
    const calendar = CalendarApp.getCalendarById(GOOGLE_CALENDAR_ID);
    if (!calendar) {
      console.error('Calendar not found:', GOOGLE_CALENDAR_ID);
      return getExampleCalendarEvents(headers);
    }
    
    // Define time range (1 month ago to 6 months ahead)
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    
    // Get events
    const events = calendar.getEvents(timeMin, timeMax);
    console.log(`Found ${events.length} calendar events`);
    
    // Format events for FullCalendar
    const formattedEvents = events.map(event => ({
      id: event.getId(),
      title: event.getTitle(),
      start: event.getStartTime().toISOString(),
      end: event.getEndTime().toISOString(),
      description: event.getDescription() || '',
      location: event.getLocation() || '',
      allDay: event.isAllDayEvent()
    }));
    
    // Cache the formatted events
    cache.put(cacheKey, JSON.stringify(formattedEvents), CALENDAR_CACHE_MINUTES * 60);
    console.log(`Cached ${formattedEvents.length} events for ${CALENDAR_CACHE_MINUTES} minutes`);
    
    return createResponse({
      status: 'success',
      events: formattedEvents,
      cached: false,
      count: formattedEvents.length
    }, 200, headers);
    
  } catch (error) {
    console.error('Error getting calendar events:', error.toString());
    // Fallback to example events
    return getExampleCalendarEvents(headers);
  }
}

/**
 * Returns example calendar events when Calendar API fails
 */
function getExampleCalendarEvents(headers) {
  const now = new Date();
  const exampleEvents = [
    {
      id: 'example1',
      title: 'Näidisündmus - Kogukonna koosolek',
      start: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      description: 'See on näidisündmus. Palun seadista Google Calendar backend.',
      location: 'Kaiu Kultuurimaja',
      allDay: false
    },
    {
      id: 'example2',
      title: 'Suvefestival (Näidis)',
      start: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Traditsioonilline suvefestival kogu perele.',
      location: 'Kaiu keskväljak',
      allDay: true
    }
  ];
  
  return createResponse({
    status: 'success',
    events: exampleEvents,
    cached: false,
    example: true
  }, 200, headers);
}
```

### 3.2 Frontend Implementation (js/calendar.js)

Replace direct API calls with Apps Script proxy:

```javascript
// REMOVE these lines:
// const GOOGLE_CALENDAR_ID = '3ab658c2becd62b9af62343da736243b73e1d56523c7c04b8ed46d944eb0e8fb@group.calendar.google.com';
// const GOOGLE_API_KEY = 'PUT YOUR GOOGLE API KEY HERE';

// ADD this configuration:
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL';

function loadCalendarEvents(successCallback, failureCallback) {
    // Build URL for Apps Script endpoint
    const url = `${GOOGLE_APPS_SCRIPT_URL}?action=calendar`;
    
    // Show loading state
    console.log('Fetching calendar events from backend...');
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Calendar response:', data);
            
            if (data.status === 'success' && data.events) {
                // Format events for FullCalendar
                const events = data.events.map(item => ({
                    id: item.id,
                    title: item.title,
                    start: item.start,
                    end: item.end,
                    description: item.description || '',
                    location: item.location || '',
                    allDay: item.allDay || false
                }));
                
                console.log(`Loaded ${events.length} events${data.cached ? ' (cached)' : ''}`);
                successCallback(events);
            } else {
                console.warn('Invalid calendar response, using example events');
                loadExampleCalendarEvents(successCallback);
            }
        })
        .catch(error => {
            console.error('Calendar fetch error:', error);
            // Fallback to example events
            loadExampleCalendarEvents(successCallback);
        });
}
```

### 3.3 Configuration Updates

#### Frontend Configuration (add to each HTML file or common.js)
```javascript
// Google Apps Script configuration
window.GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

#### Apps Script Services to Enable
1. Calendar Service (built-in, no API key needed)
2. Cache Service (for performance)

## 4. Implementation Steps

### Phase 1: Backend Preparation
1. Open Google Apps Script project
2. Add `getCalendarEvents()` and `getExampleCalendarEvents()` functions
3. Test the calendar endpoint directly
4. Verify caching works

### Phase 2: Frontend Migration
1. Remove API key from calendar.js
2. Update `loadCalendarEvents()` to use Apps Script
3. Add Apps Script URL configuration
4. Test event loading

### Phase 3: Testing
1. Verify events load correctly
2. Test error handling (invalid calendar ID)
3. Confirm caching reduces load times
4. Test CORS restrictions

### Phase 4: Documentation
1. Update SETUP.md with new configuration
2. Update CLAUDE.md architecture section
3. Add security notes to README.md

## 5. Testing Strategy

### Unit Tests
- [ ] `getCalendarEvents()` returns correct format
- [ ] Cache mechanism works (15-minute TTL)
- [ ] Example events returned on error
- [ ] CORS headers properly set

### Integration Tests
- [ ] Frontend successfully fetches from backend
- [ ] FullCalendar renders events correctly
- [ ] Event modal shows all details
- [ ] Fallback to example events works

### Security Tests
- [ ] No API keys in frontend code
- [ ] CORS restricts to allowed domains
- [ ] Rate limiting prevents abuse
- [ ] Error messages don't leak sensitive info

## 6. Rollback Plan

If issues occur during migration:

1. **Immediate Fallback**: Example events are already implemented
2. **Quick Fix**: Can temporarily hardcode events in frontend
3. **Communication**: Update status message to inform users
4. **Resolution Timeline**: 24-48 hours to fix backend issues

## 7. Success Criteria

- ✅ No API keys exposed in frontend
- ✅ Calendar events load within 2 seconds
- ✅ Cache reduces subsequent load times to <500ms
- ✅ Graceful fallback on errors
- ✅ No functionality regression

## 8. Long-term Benefits

1. **Security**: Credentials never exposed to clients
2. **Performance**: Server-side caching reduces API calls
3. **Maintainability**: Single point of configuration
4. **Scalability**: Apps Script handles load distribution
5. **Cost**: Stays within free tier limits

## 9. Timeline

- **Planning**: ✅ Complete
- **Implementation**: 2-3 hours
- **Testing**: 1-2 hours
- **Documentation**: 30 minutes
- **Total**: ~4-5 hours

## 10. Dependencies

- Google Apps Script deployment access
- Calendar Service permissions
- Test calendar with events
- Browser DevTools for testing

---

*Document Version: 1.0*  
*Created: November 2024*  
*Status: Ready for Implementation*