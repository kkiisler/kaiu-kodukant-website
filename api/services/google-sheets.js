// Google Sheets Integration Service
// Syncs form submissions to Google Sheets using Service Account

const { google } = require('googleapis');
const config = require('../config');

let sheets = null;
let auth = null;

// Initialize Google Sheets client
const initialize = async () => {
  try {
    // Check if Google Sheets is enabled
    if (!config.GOOGLE_SHEETS_ENABLED) {
      console.log('Google Sheets sync is disabled');
      return false;
    }

    // Check if service account is configured
    if (!config.GOOGLE_SERVICE_ACCOUNT) {
      console.warn('Google Sheets enabled but service account not configured');
      return false;
    }

    // Parse service account credentials
    let credentials;
    try {
      credentials = typeof config.GOOGLE_SERVICE_ACCOUNT === 'string'
        ? JSON.parse(config.GOOGLE_SERVICE_ACCOUNT)
        : config.GOOGLE_SERVICE_ACCOUNT;
    } catch (error) {
      console.error('Failed to parse Google Service Account JSON:', error);
      return false;
    }

    // Create auth client
    auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    // Get authenticated client
    const authClient = await auth.getClient();

    // Create sheets client
    sheets = google.sheets({ version: 'v4', auth: authClient });

    console.log('✅ Google Sheets service initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize Google Sheets:', error);
    return false;
  }
};

// Append membership submission to sheet
const appendMembershipSubmission = async (data) => {
  if (!sheets) {
    const initialized = await initialize();
    if (!initialized) return { success: false, error: 'Sheets not initialized' };
  }

  try {
    const values = [[
      new Date().toLocaleString('et-EE'),  // Timestamp
      data.name,                           // Name
      data.email,                          // Email
      data.recaptcha_score || '',         // reCAPTCHA score
      data.ip_address || '',              // IP address
      'API'                               // Source
    ]];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: config.MEMBERSHIP_SPREADSHEET_ID,
      range: 'Liikmed!A:F',  // Assuming sheet is named "Liikmed"
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: values
      }
    });

    console.log('Membership submission synced to Sheets:', response.data.updates);
    return { success: true, updates: response.data.updates };
  } catch (error) {
    console.error('Failed to sync membership to Sheets:', error.message);
    return { success: false, error: error.message };
  }
};

// Append contact submission to sheet
const appendContactSubmission = async (data) => {
  if (!sheets) {
    const initialized = await initialize();
    if (!initialized) return { success: false, error: 'Sheets not initialized' };
  }

  try {
    const values = [[
      new Date().toLocaleString('et-EE'),  // Timestamp
      data.name,                           // Name
      data.email,                          // Email
      data.subject || '',                  // Subject
      data.message,                        // Message
      data.recaptcha_score || '',         // reCAPTCHA score
      data.ip_address || '',              // IP address
      'API'                               // Source
    ]];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: config.CONTACT_SPREADSHEET_ID,
      range: 'Sõnumid!A:H',  // Assuming sheet is named "Sõnumid"
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: values
      }
    });

    console.log('Contact submission synced to Sheets:', response.data.updates);
    return { success: true, updates: response.data.updates };
  } catch (error) {
    console.error('Failed to sync contact to Sheets:', error.message);
    return { success: false, error: error.message };
  }
};

// Test connection to Google Sheets
const testConnection = async () => {
  if (!sheets) {
    const initialized = await initialize();
    if (!initialized) {
      throw new Error('Google Sheets service not configured');
    }
  }

  try {
    // Try to read from membership sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.MEMBERSHIP_SPREADSHEET_ID,
      range: 'A1:A1'
    });

    console.log('✅ Google Sheets connection verified');
    return { success: true, connected: true };
  } catch (error) {
    console.error('Google Sheets connection test failed:', error.message);
    throw error;
  }
};

// Get sheet info (for debugging)
const getSheetInfo = async (spreadsheetId) => {
  if (!sheets) {
    const initialized = await initialize();
    if (!initialized) return null;
  }

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId
    });

    return {
      title: response.data.properties.title,
      sheets: response.data.sheets.map(sheet => ({
        title: sheet.properties.title,
        sheetId: sheet.properties.sheetId,
        rowCount: sheet.properties.gridProperties.rowCount,
        columnCount: sheet.properties.gridProperties.columnCount
      }))
    };
  } catch (error) {
    console.error('Failed to get sheet info:', error.message);
    return null;
  }
};

// Batch sync unsynced submissions from database
const syncUnsyncedSubmissions = async (database) => {
  if (!sheets) {
    const initialized = await initialize();
    if (!initialized) return { success: false, error: 'Sheets not initialized' };
  }

  const results = {
    membership: { synced: 0, failed: 0 },
    contact: { synced: 0, failed: 0 }
  };

  try {
    // Sync unsynced membership submissions
    const unsyncedMembership = database.getUnsyncedSubmissions('membership_submissions');
    for (const submission of unsyncedMembership) {
      const result = await appendMembershipSubmission(submission);
      if (result.success) {
        database.markAsSynced('membership_submissions', submission.id);
        results.membership.synced++;
      } else {
        results.membership.failed++;
      }
    }

    // Sync unsynced contact submissions
    const unsyncedContact = database.getUnsyncedSubmissions('contact_submissions');
    for (const submission of unsyncedContact) {
      const result = await appendContactSubmission(submission);
      if (result.success) {
        database.markAsSynced('contact_submissions', submission.id);
        results.contact.synced++;
      } else {
        results.contact.failed++;
      }
    }

    console.log('Sync completed:', results);
    return { success: true, results };
  } catch (error) {
    console.error('Batch sync failed:', error);
    return { success: false, error: error.message, results };
  }
};

// Initialize on module load if enabled
if (config.GOOGLE_SHEETS_ENABLED) {
  initialize().catch(err => {
    console.error('Failed to initialize Google Sheets on startup:', err);
  });
}

module.exports = {
  initialize,
  appendMembershipSubmission,
  appendContactSubmission,
  testConnection,
  getSheetInfo,
  syncUnsyncedSubmissions
};