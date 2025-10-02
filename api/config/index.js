// Configuration module - centralizes all environment variables
const path = require('path');

module.exports = {
  // Server configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3000,

  // Domain configuration
  ALLOWED_DOMAIN: process.env.ALLOWED_DOMAIN || 'https://kaiukodukant.ee',
  API_DOMAIN: process.env.API_DOMAIN || 'https://api.kaiukodukant.ee',

  // Database
  DATABASE_PATH: process.env.DATABASE_PATH || path.join(__dirname, '../data/forms.db'),

  // Email configuration (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'noreply@kaiukodukant.ee',
  INFO_EMAIL: process.env.INFO_EMAIL || 'info@kaiukodukant.ee',

  // Authentication
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '',
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret-in-production',
  JWT_EXPIRY: '24h',

  // reCAPTCHA
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY || '',
  RECAPTCHA_THRESHOLD: parseFloat(process.env.RECAPTCHA_THRESHOLD) || 0.5,

  // S3 Configuration (for monitoring)
  S3_ENDPOINT: process.env.S3_ENDPOINT || 'https://s3.pilw.io',
  S3_BUCKET: process.env.S3_BUCKET || 'kaiugalerii',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
  S3_REGION: process.env.S3_REGION || 'eu-west-1',

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  RATE_LIMIT_MAX_REQUESTS: 5, // max requests per window
  RATE_LIMIT_EMAIL_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  RATE_LIMIT_EMAIL_MAX: 1, // max submissions per email per hour

  // Google Sheets Integration (optional)
  GOOGLE_SHEETS_ENABLED: process.env.GOOGLE_SHEETS_ENABLED === 'true',
  MEMBERSHIP_SPREADSHEET_ID: process.env.MEMBERSHIP_SPREADSHEET_ID || '1scwMSkGu0wz0pZYSGX1lQvo2xJnR_UdFhGT_wEa-Upw',
  CONTACT_SPREADSHEET_ID: process.env.CONTACT_SPREADSHEET_ID || '1U0gW3V6DLbuVSDfryuIVzfaoOe1JqG-DXo9NXIm3AF0',
  GOOGLE_SERVICE_ACCOUNT: process.env.GOOGLE_SERVICE_ACCOUNT || '', // JSON string of service account key

  // Data retention
  DATA_RETENTION_DAYS: parseInt(process.env.DATA_RETENTION_DAYS) || 0, // 0 = keep forever
};
