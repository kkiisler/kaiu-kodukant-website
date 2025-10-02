// Configuration for MTÜ Kaiu Kodukant Website
// This file contains configuration values that need to be set for the website to function properly

// API Backend URL (NEW - Phase 3: API backend for forms)
// This is the Node.js API that handles form submissions and admin dashboard
// In production, this will be https://api.kaiukodukant.ee
window.API_BASE_URL = 'https://api.kaiukodukant.ee';

// Google Apps Script Backend URL (LEGACY - being phased out)
// This is now only used as a fallback if API is not available
// Replace this with your actual deployed Apps Script URL
// Get this from: Google Apps Script Editor > Deploy > Manage Deployments > Web App URL
window.GOOGLE_APPS_SCRIPT_URL = 'YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE';

// Note: Form submission priority:
// 1. Try API_BASE_URL first (if configured)
// 2. Fall back to GOOGLE_APPS_SCRIPT_URL if API fails

// reCAPTCHA Site Key (for forms)
// Get this from: https://www.google.com/recaptcha/admin
window.RECAPTCHA_SITE_KEY = 'YOUR_RECAPTCHA_SITE_KEY_HERE';

// S3 Configuration (NEW - Phase 1: Calendar & Gallery)
// Using proxy endpoints to bypass CORS
window.S3_CONFIG = {
    baseUrl: '',  // Using local proxy paths
    endpoints: {
        version: '/api/metadata/version.json',
        calendarEvents: '/api/calendar/events.json',
        galleryAlbums: '/api/gallery/albums.json',
        galleryAlbum: '/api/gallery/albums/{id}.json',
        images: '/api/images/{fileId}-{size}.jpg'
    },
    imageSizes: {
        thumbnail: 300,
        medium: 600,
        large: 1200
    },
    // Staleness thresholds (minutes)
    staleness: {
        calendar: 60,
        gallery: 60
    }
};