# MTÜ Kaiu Kodukant Website Setup Guide

This guide will help you set up the Google Apps Script backend and configure all the necessary services for the website.

## Overview

The website now uses Google Apps Script as a backend to handle:
- Membership form submissions
- Contact form submissions  
- Google Calendar API proxy (secure and free)
- Google Drive gallery management
- Email notifications
- Data storage in Google Sheets and Google Drive

## Prerequisites

- Google account
- Access to Google Apps Script
- Access to Google Sheets
- Access to Google Calendar
- reCAPTCHA account (free)

## Step 1: Create Google Sheets

### 1.1 Membership Sheet
1. Create a new Google Sheet
2. Name it "MTÜ Kaiu Kodukant - Liikmed"
3. Set up columns: `Timestamp | Nimi | E-post | reCAPTCHA Score`
4. Copy the Spreadsheet ID from the URL (long string between `/d/` and `/edit`)

### 1.2 Contact Sheet
1. Create another Google Sheet
2. Name it "MTÜ Kaiu Kodukant - Sõnumid"
3. Set up columns: `Timestamp | Nimi | E-post | Teema | Sõnum | reCAPTCHA Score`
4. Copy this Spreadsheet ID as well

## Step 2: Set up reCAPTCHA

1. Go to [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
2. Click "Create" to add a new site
3. Choose reCAPTCHA v3
4. Add your domain (e.g., `yourdomain.com`)
5. Get your **Site Key** and **Secret Key**

## Step 3: Deploy Google Apps Script

### 3.1 Create Apps Script Project
1. Go to [Google Apps Script](https://script.google.com)
2. Click "New project"
3. Replace the default code with the content from `apps-script-backend.js`

### 3.2 Configure the Script
Replace these values in the script:

```javascript
// Configuration
const MEMBERSHIP_SPREADSHEET_ID = 'YOUR_MEMBERSHIP_SPREADSHEET_ID'; // From Step 1.1
const CONTACT_SPREADSHEET_ID = 'YOUR_CONTACT_SPREADSHEET_ID'; // From Step 1.2
const ALLOWED_DOMAIN = 'https://yourdomain.com'; // Your actual domain
const GOOGLE_CALENDAR_ID = '3ab658c2becd62b9af62343da736243b73e1d56523c7c04b8ed46d944eb0e8fb@group.calendar.google.com'; // Your calendar ID
const GALLERY_DRIVE_FOLDER_ID = 'YOUR_GALLERY_FOLDER_ID'; // From Step 6.2
```

### 3.3 Set up Script Properties
1. In Apps Script, go to Project Settings (gear icon)
2. In "Script Properties" section, add:
   - Key: `RECAPTCHA_SECRET_KEY`
   - Value: Your reCAPTCHA Secret Key from Step 2

### 3.4 Enable Required Services
1. In Apps Script, go to Services (+)
2. Add these services:
   - Google Sheets API
   - Gmail API  
   - Google Calendar API
   - Google Drive API

### 3.5 Deploy the Script
1. Click "Deploy" → "New deployment"
2. Choose type: "Web app"
3. Execute as: "Me"
4. Who has access: "Anyone"
5. Click "Deploy"
6. Copy the Web App URL

## Step 4: Configure Website

### 4.1 Update HTML Configuration
In `index.html`, replace these values:

```javascript
// Form configuration  
const GOOGLE_APPS_SCRIPT_URL = 'YOUR_DEPLOYED_APPS_SCRIPT_URL'; // From Step 3.5
const RECAPTCHA_SITE_KEY = 'YOUR_RECAPTCHA_SITE_KEY'; // From Step 2
```

### 4.2 Update reCAPTCHA Script Tag
Replace the reCAPTCHA script src with your site key:
```html
<script src="https://www.google.com/recaptcha/api.js?render=YOUR_RECAPTCHA_SITE_KEY"></script>
```

## Step 5: Set up Google Calendar Access

### 5.1 Calendar Permissions
1. Open Google Calendar
2. Go to your organization's calendar
3. In calendar settings, add the Apps Script project's email as an editor
4. The project email can be found in Apps Script under Project Settings

### 5.2 Get Calendar ID
1. In Google Calendar, go to your calendar settings
2. Find "Calendar ID" - it should match the one in your configuration
3. Update `GOOGLE_CALENDAR_ID` in the Apps Script if different

## Step 6: Set up Google Drive Gallery

### 6.1 Create Gallery Folder Structure
1. Create a main folder in Google Drive called "Kaiu Galerii"
2. Share this folder with the Apps Script project (same email as calendar)
3. Create subfolders for each photo album:
   ```
   📁 Kaiu Galerii
     📁 2024-Suvefestival
       🖼️ cover.jpg (optional - first image used as cover if not present)
       🖼️ festival-1.jpg
       🖼️ festival-2.jpg
       📄 info.txt (optional - first line: date, rest: description)
     📁 2024-Kevadkorrastus
       🖼️ cleanup-1.jpg
       📄 info.txt
   ```

### 6.2 Configure Gallery in Apps Script
1. Get the main gallery folder ID from Google Drive (in the URL when viewing the folder)
2. Update `GALLERY_DRIVE_FOLDER_ID` in the Apps Script configuration

### 6.3 Album Management Tips
- **Folder names**: Use format "YYYY-Event-Name" for automatic sorting
- **Cover images**: Name one image "cover.jpg" or let the system use the first image
- **Album info**: Create "info.txt" with date on first line, description on following lines
- **Image optimization**: Google Drive automatically optimizes images for web delivery

### 6.4 Community Photo Management
1. Give album managers (MTÜ board) Editor access to the gallery folder
2. They can create new albums by adding subfolders
3. Photos can be uploaded via drag-and-drop or Google Drive mobile app
4. Albums appear automatically on the website (cached for 30 minutes)

## Step 7: Test Everything

### 6.1 Test Forms
1. Open the website
2. Try submitting the membership form
3. Try submitting the contact form
4. Check that data appears in your Google Sheets
5. Check that you receive email notifications

### 6.2 Test Calendar
1. Add some test events to your Google Calendar
2. Refresh the website's events page
3. Verify events appear correctly
4. Test clicking on events to see details

## Step 8: Email Notifications

### 7.1 Update Recipient Email
In the Apps Script, update these lines with your actual email:

```javascript
const recipient = 'info@kaiukodukant.ee'; // Replace with actual email
```

### 7.2 Gmail Permissions
The first time emails are sent, you'll need to authorize Gmail access in the Apps Script execution log.

## Step 9: Troubleshooting

### Forms Not Working
- Check the Apps Script execution logs for errors
- Verify all IDs and keys are correctly configured
- Test reCAPTCHA by checking browser console for errors

### Calendar Not Loading
- Check that the Apps Script has Calendar API enabled
- Verify the calendar ID is correct
- Check that the Apps Script project has access to the calendar

### Gallery Not Loading
- Check that the Apps Script has Drive API enabled
- Verify the gallery folder ID is correct
- Ensure the Apps Script project has Editor access to the gallery folder
- Check that album folders contain image files (jpg, png, gif, webp)
- Run `clearGalleryCaches()` function in Apps Script to refresh cache

### Email Notifications Not Sending
- Check Gmail API is enabled in Apps Script
- Authorize Gmail permissions in execution logs
- Verify recipient email addresses are correct

## Step 10: Security Notes

- Never commit API keys to version control
- Use Script Properties for sensitive data
- Regularly review Apps Script permissions
- Monitor execution logs for suspicious activity

## Step 11: Maintenance

### Monthly Tasks
- Review form submissions in Google Sheets
- Check Apps Script execution quotas
- Update calendar events as needed

### Clearing Caches
- **Calendar cache**: Run `clearCalendarCache()` function in Apps Script editor
- **Gallery cache**: Run `clearGalleryCaches()` function in Apps Script editor
- **Both caches**: Apps Script caches refresh automatically (15min for calendar, 30min for gallery albums, 60min for album photos)

## Step 12: Support

For technical issues:
1. Check Apps Script execution logs
2. Verify all configuration values
3. Test each component individually
4. Contact the developer if issues persist

The system is designed to be lightweight, free, and maintainable by non-technical users once initially set up.