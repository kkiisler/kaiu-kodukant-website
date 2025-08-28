# reCAPTCHA Setup Checklist

## 1. Google reCAPTCHA Console Setup
Go to: https://www.google.com/recaptcha/admin

### Verify these settings:
- [ ] **reCAPTCHA Type**: v3 (not v2)
- [ ] **Domains**: Must include:
  - `tore.kaiukodukant.ee` 
  - `localhost` (for testing)
  - Any other domains you're using

### Keys:
- **Site Key**: `6Ld90bQrAAAAABzrX0xTEHJVKmBpOtyS36fp0W0u` (already in your config.js)
- **Secret Key**: Must be added to Google Apps Script properties

## 2. Google Apps Script Setup

### In your Apps Script project:

1. **Add Secret Key to Script Properties**:
   - Go to Project Settings (gear icon)
   - Scroll to "Script properties"
   - Add property:
     - Name: `RECAPTCHA_SECRET_KEY`
     - Value: Your secret key from reCAPTCHA console

2. **Deploy Settings**:
   - Deploy → Manage deployments
   - Edit deployment:
     - **Execute as**: Me (your account)
     - **Who has access**: Anyone
   - Use the `/exec` URL (NOT `/dev`)
   - Current URL: `https://script.google.com/macros/s/AKfycby4FBWptelJFqaboIsGq3qKH5uoK9JblHRRlSLOWouQ8ELxo4PkN_h7S6GRD-np3JBUVw/exec`

## 3. Testing

### Option A: Test with DEV_BYPASS (temporary)
Add this to your Apps Script (temporarily for testing):

```javascript
// In verifyRecaptcha function, before the actual verification:
if (token === 'DEV_BYPASS') {
    console.log('Using DEV_BYPASS for testing');
    return { success: true, score: 1.0 };
}
```

### Option B: Lower the threshold
Change in your Apps Script:
```javascript
const RECAPTCHA_THRESHOLD = 0.3; // Lower from 0.5 for testing
```

### Option C: Test URL directly
```bash
# Test with curl (replace with your actual URL)
curl -i -X POST "https://script.google.com/macros/s/AKfycby4FBWptelJFqaboIsGq3qKH5uoK9JblHRRlSLOWouQ8ELxo4PkN_h7S6GRD-np3JBUVw/exec" \
  -d "formType=contact" \
  -d "name=Test" \
  -d "email=test@example.com" \
  -d "message=Hello" \
  -d "recaptchaToken=DEV_BYPASS"
```

## 4. Debug the 403

The 403 is coming from your Apps Script. Common causes:

1. **Missing RECAPTCHA_SECRET_KEY** in Script Properties
2. **Domain not in reCAPTCHA allowed domains**
3. **Score too low** (bot detected)
4. **Web app not deployed as "Anyone"**

## 5. Check Apps Script Logs

In your Apps Script:
1. Go to "Executions" (clock icon)
2. Look for recent executions
3. Check the logs for error messages

## Quick Fix for Testing

Replace this in your Apps Script to bypass reCAPTCHA temporarily:

```javascript
function verifyRecaptcha(recaptchaSecretKey, token) {
    // TEMPORARY: Accept DEV_BYPASS for testing
    if (token === 'DEV_BYPASS') {
        console.log('DEV_BYPASS token accepted for testing');
        return { success: true, score: 1.0 };
    }
    
    // Your existing verification code...
}
```