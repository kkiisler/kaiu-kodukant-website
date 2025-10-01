// Configuration for MTÜ Kaiu Kodukant Website
// This file contains configuration values that need to be set for the website to function properly

// Google Apps Script Backend URL (LEGACY - for forms only after S3 migration)
// Replace this with your actual deployed Apps Script URL
// Get this from: Google Apps Script Editor > Deploy > Manage Deployments > Web App URL
window.GOOGLE_APPS_SCRIPT_URL = 'YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE';

// Note: After S3 migration, this is only used for:
// - Contact form submissions (contact.html)
// - Membership registrations (membership.html)
// Calendar and gallery now load from S3 (see S3_CONFIG below)

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