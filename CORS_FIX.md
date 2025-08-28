# Fix CORS Error for Google Apps Script

## Problem
The Google Apps Script backend is blocking requests from `https://tore.kaiukodukant.ee` due to CORS policy.

## Solution

You need to update the Google Apps Script code to allow your domain:

### Step 1: Open Google Apps Script Editor
1. Go to [Google Apps Script](https://script.google.com)
2. Open your deployed script project

### Step 2: Update the ALLOWED_DOMAIN
Find this line (around line 11):
```javascript
const ALLOWED_DOMAIN = 'https://yourdomain.com';
```

Change it to:
```javascript
const ALLOWED_DOMAIN = 'https://tore.kaiukodukant.ee';
```

### Step 3: Update doGet function (if not already updated)
Make sure your `doGet` function also includes the CORS headers. Find the `doGet` function and ensure it has:

```javascript
function doGet(e) {
  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_DOMAIN,
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // ... rest of your code
  
  // Make sure all responses include headers
  return createResponse(result, 200, headers);
}
```

### Step 4: Deploy New Version
1. Click "Deploy" > "Manage deployments"
2. Click the pencil icon to edit
3. Under "Version", select "New version"
4. Add description: "Fix CORS for tore.kaiukodukant.ee"
5. Click "Deploy"

### Alternative: Allow Multiple Domains
If you want to allow both localhost (for testing) and production:

```javascript
// At the top of your script
const ALLOWED_DOMAINS = [
  'https://tore.kaiukodukant.ee',
  'https://kaiukodukant.ee',  // If you use main domain too
  'http://localhost',          // For local testing
  'https://localhost'          // For local testing with HTTPS
];

// In your doGet and doPost functions
function doGet(e) {
  const origin = e.parameter.origin || e.headers?.Origin || '';
  const allowedOrigin = ALLOWED_DOMAINS.includes(origin) ? origin : ALLOWED_DOMAINS[0];
  
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // ... rest of your code
}
```

### Step 5: Test
After deploying, test the website again. The CORS errors should be resolved.

## Important Notes
- The Apps Script URL might change after redeployment. If it does, update your `.env` file with the new URL and redeploy the Docker container.
- Always use HTTPS for production domains in the ALLOWED_DOMAIN setting.