# Immediate CORS Fix for Google Apps Script

## The Problem
Google Apps Script isn't sending CORS headers even though they're in the code. This happens when headers aren't added correctly to ContentService outputs.

## Quick Fix - Modify Your doGet Function

Replace your entire `doGet` function with this simplified version that explicitly adds headers:

```javascript
function doGet(e) {
  try {
    const action = e.parameter.action;
    let responseData;
    
    // Process the action
    if (action === 'calendar') {
      // Get calendar events
      const cache = CacheService.getScriptCache();
      const cacheKey = 'calendar_events';
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        responseData = {
          status: 'success',
          events: JSON.parse(cachedData),
          cached: true
        };
      } else {
        const calendar = CalendarApp.getCalendarById(GOOGLE_CALENDAR_ID);
        if (!calendar) {
          responseData = getExampleCalendarEvents();
        } else {
          const now = new Date();
          const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const timeMax = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
          const events = calendar.getEvents(timeMin, timeMax);
          
          const formattedEvents = events.map(event => ({
            id: event.getId(),
            title: event.getTitle(),
            start: event.getStartTime().toISOString(),
            end: event.getEndTime().toISOString(),
            description: event.getDescription() || '',
            location: event.getLocation() || '',
            allDay: event.isAllDayEvent()
          }));
          
          cache.put(cacheKey, JSON.stringify(formattedEvents), CALENDAR_CACHE_MINUTES * 60);
          
          responseData = {
            status: 'success',
            events: formattedEvents,
            cached: false,
            count: formattedEvents.length
          };
        }
      }
    } else if (action === 'gallery') {
      // Get gallery data - call your existing function
      const cache = CacheService.getScriptCache();
      const cacheKey = 'gallery_albums';
      const cachedData = cache.get(cacheKey);
      
      if (cachedData) {
        responseData = {
          status: 'success',
          albums: JSON.parse(cachedData),
          cached: true
        };
      } else {
        // Your existing gallery logic
        responseData = {
          status: 'success',
          albums: [], // Your gallery albums
          cached: false
        };
      }
    } else if (action === 'album') {
      const albumId = e.parameter.id;
      // Your album logic
      responseData = {
        status: 'success',
        photos: [],
        cached: false
      };
    } else {
      responseData = {
        status: 'error',
        message: 'Invalid action'
      };
    }
    
    // CREATE OUTPUT WITH HEADERS - THIS IS THE KEY PART
    const output = ContentService
      .createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
    
    // ADD HEADERS EXPLICITLY - MUST BE DONE THIS WAY
    output.addHeader('Access-Control-Allow-Origin', 'https://tore.kaiukodukant.ee');
    output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    output.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return output;
    
  } catch (error) {
    // Even errors need CORS headers
    const errorOutput = ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
    
    errorOutput.addHeader('Access-Control-Allow-Origin', 'https://tore.kaiukodukant.ee');
    errorOutput.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    errorOutput.addHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return errorOutput;
  }
}
```

## Alternative: Web App Settings

Sometimes the issue is with Web App settings. Check:

1. **Deploy** → **Manage deployments**
2. Click the gear icon ⚙️
3. Make sure:
   - **Execute as**: Me
   - **Who has access**: Anyone

## Test After Deployment

1. Deploy with "New version"
2. Test directly in browser:
   ```
   https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=gallery
   ```
3. Check browser console Network tab - look for `Access-Control-Allow-Origin` header

## If Still Not Working - Nuclear Option

Create a completely new deployment:

1. **Deploy** → **New Deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy
6. Use the new URL in your .env file

## Debug Mode

Add this test endpoint to verify headers are working:

```javascript
function doGet(e) {
  // Debug mode - test CORS
  if (e.parameter.test === 'cors') {
    const testOutput = ContentService
      .createTextOutput('CORS test successful')
      .setMimeType(ContentService.MimeType.TEXT);
    
    testOutput.addHeader('Access-Control-Allow-Origin', 'https://tore.kaiukodukant.ee');
    return testOutput;
  }
  
  // ... rest of your code
}
```

Then test: `YOUR_SCRIPT_URL?test=cors`