# Deploy Latest Google Apps Script Version

## The Issue
You're getting CORS errors even though your script has the correct `ALLOWED_DOMAIN`. This usually means the deployed version isn't the latest code.

## Solution Steps

### 1. Open Google Apps Script
Go to your script at [Google Apps Script](https://script.google.com)

### 2. Ensure Latest Code is Saved
Make sure your script has this configuration at the top:
```javascript
const ALLOWED_DOMAIN = 'https://tore.kaiukodukant.ee';
```

### 3. Deploy New Version (IMPORTANT!)
1. Click **Deploy** → **Manage deployments**
2. Click the **pencil icon** (Edit) next to your deployment
3. In the **Version** dropdown, select **"New version"**
4. Add description: "Fix CORS for tore.kaiukodukant.ee"
5. Click **Deploy**

### 4. Test the Deployment
After deploying, click the deployment URL to test it directly:
- Try: `YOUR_SCRIPT_URL?action=calendar`
- You should see JSON data (might show CORS error in browser, but that's OK)

### 5. Check Deployment URL
**IMPORTANT**: The deployment URL might have changed. Make sure your `.env` file has the correct URL.

The URL should look like:
```
https://script.google.com/macros/s/AKfycbx9yw-6pItsupVsKSAA4VPMdAgL3hQ_p--_wfWVm6zVm5GtaE1leN-Fzwq_3d4fuZ5eQA/exec
```

### 6. If URL Changed
If the deployment URL changed after redeployment:
1. Update your `.env` file in the docker folder
2. Rebuild and redeploy Docker:
```bash
cd docker
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Alternative: Allow Multiple Domains
If you want to test from different domains, update your Apps Script to:

```javascript
// Allow multiple domains
const ALLOWED_DOMAINS = [
  'https://tore.kaiukodukant.ee',
  'https://kaiukodukant.ee',
  'http://localhost',
  'https://localhost'
];

function doGet(e) {
  // Get the request origin
  const origin = e.parameter.origin || '';
  
  // Check if origin is allowed, default to first domain if not provided
  const allowedOrigin = ALLOWED_DOMAINS.includes(origin) ? origin : ALLOWED_DOMAINS[0];
  
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // ... rest of your code
}
```

## Debug Tips
1. In Chrome DevTools, check the Network tab
2. Look at the Response Headers for your Apps Script request
3. You should see: `Access-Control-Allow-Origin: https://tore.kaiukodukant.ee`
4. If you don't see this header, the deployment isn't updated

## Common Issues
- **Forgetting to deploy new version**: Always select "New version" when deploying
- **Wrong URL in .env**: Check that Docker is using the correct Apps Script URL
- **Browser cache**: Try hard refresh (Ctrl+Shift+R) or incognito mode