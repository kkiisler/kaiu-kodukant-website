# Calendar Migration Implementation Checklist

## Pre-Implementation Tasks
- [ ] Review [calendar-migration-plan.md](./calendar-migration-plan.md)
- [ ] Access Google Apps Script project
- [ ] Backup current calendar.js file
- [ ] Note current Google Apps Script deployment URL
- [ ] Verify Calendar Service is available in Apps Script

## Phase 1: Backend Implementation (apps-script-backend.js)

### Add Calendar Functions
- [ ] Add `getCalendarEvents()` function after line 717
- [ ] Add `getExampleCalendarEvents()` helper function
- [ ] Verify `GOOGLE_CALENDAR_ID` is correctly set (line 14)
- [ ] Verify `CALENDAR_CACHE_MINUTES` is set to 15 (line 15)

### Code to Add
```javascript
// Insert after line 717 (after clearCalendarCache function)

/**
 * Gets calendar events from Google Calendar with caching
 * Called via: GET ?action=calendar
 */
function getCalendarEvents(headers) {
  // [Implementation from migration plan]
}

/**
 * Returns example calendar events when Calendar API fails
 */
function getExampleCalendarEvents(headers) {
  // [Implementation from migration plan]
}
```

### Test Backend
- [ ] Save Apps Script project
- [ ] Deploy new version (if needed)
- [ ] Test URL: `YOUR_SCRIPT_URL?action=calendar`
- [ ] Verify JSON response contains events
- [ ] Check Apps Script logs for errors

## Phase 2: Frontend Implementation (js/calendar.js)

### Remove Vulnerable Code
- [ ] Delete line 7: `const GOOGLE_CALENDAR_ID = ...`
- [ ] Delete line 8: `const GOOGLE_API_KEY = ...`

### Add Secure Configuration
- [ ] Add Apps Script URL configuration at top of file:
```javascript
// Configuration - Google Apps Script backend
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL';
```

### Update loadCalendarEvents Function
- [ ] Replace entire `loadCalendarEvents()` function (lines 73-109)
- [ ] Keep `loadExampleCalendarEvents()` as fallback
- [ ] Keep `showEventModal()` unchanged

### New loadCalendarEvents Implementation
```javascript
function loadCalendarEvents(successCallback, failureCallback) {
    const url = `${GOOGLE_APPS_SCRIPT_URL}?action=calendar`;
    
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
                console.warn('Invalid response, using example events');
                loadExampleCalendarEvents(successCallback);
            }
        })
        .catch(error => {
            console.error('Calendar fetch error:', error);
            loadExampleCalendarEvents(successCallback);
        });
}
```

## Phase 3: Configuration

### Update HTML Files
- [ ] Add to events.html (or create config.js):
```html
<script>
  window.GOOGLE_APPS_SCRIPT_URL = 'YOUR_ACTUAL_DEPLOYMENT_URL';
</script>
```

### Apps Script Permissions
- [ ] Enable Calendar Service in Apps Script
- [ ] Grant calendar read permissions when prompted
- [ ] Verify Apps Script can access the calendar

## Phase 4: Testing

### Functionality Tests
- [ ] Open events.html in browser
- [ ] Check console for errors
- [ ] Verify events load and display
- [ ] Click on event to test modal
- [ ] Check that event details show correctly

### Security Tests
- [ ] View page source - no API keys visible
- [ ] Check Network tab - requests go to Apps Script
- [ ] Test from unauthorized domain (should fail)
- [ ] Verify no sensitive data in console logs

### Performance Tests
- [ ] First load: should complete in <2 seconds
- [ ] Subsequent loads: should use cache (<500ms)
- [ ] Check Apps Script logs for cache hits

### Error Handling Tests
- [ ] Disconnect internet after page load
- [ ] Test with wrong Apps Script URL
- [ ] Test with invalid calendar ID
- [ ] Verify example events show as fallback

## Phase 5: Documentation Updates

### Update SETUP.md
- [ ] Remove Google Calendar API key setup section
- [ ] Add Apps Script calendar configuration
- [ ] Update testing instructions
- [ ] Add troubleshooting for calendar

### Update CLAUDE.md
- [ ] Update architecture section
- [ ] Note security improvements
- [ ] Update configuration section

### Update README.md
- [ ] Add security note about backend proxy
- [ ] Update features list if needed

## Phase 6: Deployment

### Final Deployment Steps
- [ ] Commit all changes to Git
- [ ] Push to GitHub
- [ ] Deploy Apps Script (if not auto-deployed)
- [ ] Upload updated JS files to web server
- [ ] Clear browser cache and test

### Verification
- [ ] Test on production URL
- [ ] Verify no console errors
- [ ] Check events load correctly
- [ ] Monitor Apps Script dashboard for errors

## Phase 7: Post-Deployment

### Monitoring (First 24 Hours)
- [ ] Check Apps Script execution logs
- [ ] Monitor for any error reports
- [ ] Verify cache is working (check logs)
- [ ] Check quota usage in Apps Script

### Cleanup
- [ ] Remove any test console.log statements
- [ ] Delete old API key from any config files
- [ ] Update any internal documentation
- [ ] Notify team of completion

## Rollback Procedure (If Needed)

If critical issues arise:
1. [ ] Keep example events as temporary solution
2. [ ] Debug Apps Script logs for errors
3. [ ] Check Calendar Service permissions
4. [ ] Verify CORS headers are correct
5. [ ] Test with direct Apps Script URL

## Success Verification

### All items should be checked:
- [ ] No API keys in frontend code
- [ ] Calendar events loading properly
- [ ] Cache working (15-minute TTL)
- [ ] Error handling functioning
- [ ] Documentation updated
- [ ] Security improved

## Notes Section

**Apps Script URL**: ___________________________

**Calendar ID**: `3ab658c2becd62b9af62343da736243b73e1d56523c7c04b8ed46d944eb0e8fb@group.calendar.google.com`

**Issues Encountered**: 
_________________________________
_________________________________
_________________________________

**Resolution Time**: _______ hours

---

*Checklist Version: 1.0*  
*Created: November 2024*  
*Implementer: ________________*  
*Date Completed: ______________*