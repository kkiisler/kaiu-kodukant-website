# Form POST Solution for Google Apps Script without CORS

Since Google Apps Script doesn't support CORS headers and JSONP only works for GET requests, we have two options for handling form submissions:

## Option 1: Direct Form Submission (Recommended for simplicity)

Submit forms directly to Apps Script without JavaScript. The browser will navigate to the Apps Script response page.

```html
<!-- In contact.html and membership.html -->
<form action="YOUR_APPS_SCRIPT_URL" method="POST" target="_blank">
    <input type="hidden" name="formType" value="membership">
    <input type="text" name="name" required>
    <input type="email" name="email" required>
    <!-- reCAPTCHA will need to be handled differently -->
    <button type="submit">Saada</button>
</form>
```

After submission, the Apps Script can return an HTML page with a redirect:

```javascript
// In Apps Script
function doPost(e) {
    // Process form...
    
    // Return HTML with redirect
    return HtmlService.createHtmlOutput(`
        <html>
        <body>
            <p>Aitäh! Sinu taotlus on vastu võetud.</p>
            <script>
                setTimeout(function() {
                    window.location.href = 'https://tore.kaiukodukant.ee/membership.html?success=true';
                }, 2000);
            </script>
        </body>
        </html>
    `);
}
```

## Option 2: Use an iframe for submission (Hidden iframe technique)

This allows staying on the same page:

```html
<!-- Add hidden iframe to page -->
<iframe name="hidden_iframe" id="hidden_iframe" style="display:none;"></iframe>

<form id="membershipForm" 
      action="YOUR_APPS_SCRIPT_URL" 
      method="POST" 
      target="hidden_iframe"
      onsubmit="handleFormSubmit(event)">
    <!-- form fields -->
</form>

<script>
function handleFormSubmit(event) {
    // Show loading state
    document.getElementById('submit-btn').disabled = true;
    document.getElementById('submit-btn').textContent = 'Saatmine...';
    
    // After 3 seconds, assume success and show message
    setTimeout(function() {
        document.getElementById('success-message').classList.remove('hidden');
        document.getElementById('membershipForm').reset();
        document.getElementById('submit-btn').disabled = false;
        document.getElementById('submit-btn').textContent = 'Saada';
    }, 3000);
    
    // Form will submit to iframe
    return true;
}
</script>
```

## Option 3: Proxy Server (Most robust but requires infrastructure)

Set up a simple proxy on your domain that forwards requests to Apps Script:

1. Deploy a Cloudflare Worker or small Node.js server on your domain
2. The proxy adds CORS headers and forwards to Apps Script
3. Your forms can use fetch() normally

Example Cloudflare Worker:

```javascript
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const url = 'YOUR_APPS_SCRIPT_URL';
    
    // Forward the request
    const response = await fetch(url, {
        method: request.method,
        body: request.body,
        headers: request.headers
    });
    
    // Add CORS headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', 'https://tore.kaiukodukant.ee');
    newResponse.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    
    return newResponse;
}
```

## Recommended Approach

For your case, I recommend **Option 2 (Hidden iframe)** because:
- It keeps users on your site
- No additional infrastructure needed
- Works with reCAPTCHA (you'll need to get the token before submission)
- Simple to implement

The forms will submit to the iframe, and you can show a success message after a few seconds.