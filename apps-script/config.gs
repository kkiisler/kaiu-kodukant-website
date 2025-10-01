/**
 * Configuration for MTÜ Kaiu Kodukant S3 Sync
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to Project Settings (gear icon) > Script Properties
 * 2. Add the following properties:
 *    - S3_ACCESS_KEY_ID: Your Pilvio S3 access key
 *    - S3_SECRET_ACCESS_KEY: Your Pilvio S3 secret key
 *    - ADMIN_EMAIL: Email for error alerts (e.g., kaur.kiisler@gmail.com)
 */

// S3 Configuration
const S3_CONFIG = {
  endpoint: 's3.pilw.io',
  bucket: 'kaiugalerii',
  region: 'auto',
  // Credentials loaded from Script Properties for security
  accessKeyId: PropertiesService.getScriptProperties().getProperty('S3_ACCESS_KEY_ID'),
  secretAccessKey: PropertiesService.getScriptProperties().getProperty('S3_SECRET_ACCESS_KEY')
};

// Google Calendar Configuration
const CALENDAR_CONFIG = {
  // Calendar ID for MTÜ Kaiu Kodukant
  calendarId: '3ab658c2becd62b9af62343da736243b73e1d56523c7c04b8ed46d944eb0e8fb@group.calendar.google.com',

  // Fetch events from 1 month back to 6 months forward
  monthsBack: 1,
  monthsForward: 6
};

// Gallery Configuration (for Phase 2)
const GALLERY_CONFIG = {
  // Google Drive folder ID for gallery
  folderId: '1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg',

  // Image sizes to generate
  imageSizes: {
    small: 300,
    medium: 600,
    large: 1200
  }
};

// Monitoring Configuration
const MONITORING_CONFIG = {
  // Email for alerts
  alertEmail: PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || 'kaur.kiisler@gmail.com',

  // Send alert after this many consecutive failures
  alertAfterFailures: 3,

  // Maximum age before considering data stale (minutes)
  calendarMaxAge: 60,
  galleryMaxAge: 60
};

/**
 * Verify that all required Script Properties are configured
 */
function verifyConfiguration() {
  const props = PropertiesService.getScriptProperties();
  const required = ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
  const missing = [];

  required.forEach(prop => {
    if (!props.getProperty(prop)) {
      missing.push(prop);
    }
  });

  if (missing.length > 0) {
    throw new Error(`Missing required Script Properties: ${missing.join(', ')}`);
  }

  Logger.log('✓ Configuration verified - all required properties set');
  return true;
}
