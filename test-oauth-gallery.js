#!/usr/bin/env node

/**
 * Test Google Drive Gallery Access using OAuth2 Client Credentials
 * This uses Service Account or OAuth2 authentication
 */

const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { promisify } = require('util');

// Configuration
const GALLERY_FOLDER_ID = '1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg';
const CALENDAR_ID = 'a0b18dc4b7e4b9b40858746a7edddaa51b41014085ba2f4b2f89bf038ac13f12@group.calendar.google.com';

// OAuth2 credentials file path
const CREDENTIALS_PATH = path.join(__dirname, 'planning/google-plan/client_secret_1063545230535-2imsmvanchvj5nfs14u3klia5riqcm0i.apps.googleusercontent.com.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Scopes needed for access
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly'
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Create an OAuth2 client with the given credentials
 */
async function authorize() {
  try {
    // Load client credentials
    const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    const credentials = JSON.parse(credentialsContent);

    // Check if it's web or installed app credentials
    const { client_secret, client_id, redirect_uris } = credentials.web || credentials.installed;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris ? redirect_uris[0] : 'http://localhost:3000/oauth2callback'
    );

    // Check if we have a previously stored token
    try {
      const token = await fs.readFile(TOKEN_PATH, 'utf8');
      oAuth2Client.setCredentials(JSON.parse(token));
      log('✅ Using existing authentication token', 'green');
      return oAuth2Client;
    } catch (error) {
      // No token found, need to get one
      log('⚠️  No stored token found, need to authenticate', 'yellow');
      return await getNewToken(oAuth2Client);
    }
  } catch (error) {
    log(`❌ Error loading credentials: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Get a new token after prompting for user authorization
 */
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  log('\n🔐 Authorization Required', 'cyan');
  log('════════════════════════════════════════', 'cyan');
  log('\nPlease visit this URL to authorize the application:', 'yellow');
  log(authUrl, 'green');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = promisify(rl.question).bind(rl);

  try {
    const code = await question('\nEnter the authorization code from that page here: ');
    rl.close();

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Store the token for future use
    await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
    log('\n✅ Authorization successful! Token saved.', 'green');

    return oAuth2Client;
  } catch (error) {
    log(`\n❌ Error retrieving access token: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Test Drive API access
 */
async function testDriveAccess(auth) {
  log('\n════════════════════════════════════════', 'cyan');
  log('  📁 Testing DRIVE API Access', 'cyan');
  log('════════════════════════════════════════', 'cyan');

  const drive = google.drive({ version: 'v3', auth });

  try {
    // Test 1: Get folder metadata
    log('\n📂 Getting gallery folder info...', 'yellow');
    const folderResponse = await drive.files.get({
      fileId: GALLERY_FOLDER_ID,
      fields: 'id,name,mimeType,shared,permissions,owners'
    });

    if (folderResponse.data) {
      log('✅ Successfully accessed folder!', 'green');
      log(`  Name: ${folderResponse.data.name}`, 'cyan');
      log(`  Shared: ${folderResponse.data.shared}`, 'cyan');
      if (folderResponse.data.owners) {
        log(`  Owner: ${folderResponse.data.owners[0]?.displayName || 'Unknown'}`, 'cyan');
      }
    }

    // Test 2: List folder contents
    log('\n📸 Listing gallery contents...', 'yellow');
    const listResponse = await drive.files.list({
      q: `'${GALLERY_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,createdTime,size,thumbnailLink,webViewLink)',
      pageSize: 20,
      orderBy: 'modifiedTime desc'
    });

    if (listResponse.data.files && listResponse.data.files.length > 0) {
      log(`✅ Found ${listResponse.data.files.length} items in gallery`, 'green');

      // Group by type
      const folders = listResponse.data.files.filter(f =>
        f.mimeType === 'application/vnd.google-apps.folder'
      );
      const images = listResponse.data.files.filter(f =>
        f.mimeType?.startsWith('image/')
      );

      if (folders.length > 0) {
        log(`\n  📁 Albums (${folders.length}):`, 'magenta');
        folders.slice(0, 5).forEach((folder, i) => {
          log(`    ${i + 1}. ${folder.name}`, 'white');
        });

        // Try to access first album
        if (folders[0]) {
          await testAlbumAccess(drive, folders[0]);
        }
      }

      if (images.length > 0) {
        log(`\n  🖼️  Images (${images.length}):`, 'magenta');
        images.slice(0, 3).forEach((image, i) => {
          log(`    ${i + 1}. ${image.name}`, 'white');
          if (image.thumbnailLink) {
            log(`       ✓ Thumbnail available`, 'green');
          }
        });
      }

      return { success: true, itemCount: listResponse.data.files.length };
    } else {
      log('ℹ️  No items found in gallery folder', 'yellow');
      return { success: true, itemCount: 0 };
    }

  } catch (error) {
    log(`❌ Drive API error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Test accessing an album
 */
async function testAlbumAccess(drive, album) {
  log(`\n  📷 Testing access to album: ${album.name}`, 'cyan');

  try {
    const response = await drive.files.list({
      q: `'${album.id}' in parents and mimeType contains 'image/' and trashed=false`,
      fields: 'files(id,name,size,imageMediaMetadata)',
      pageSize: 5
    });

    if (response.data.files && response.data.files.length > 0) {
      log(`    ✅ Can access album contents (${response.data.files.length} photos)`, 'green');

      const firstPhoto = response.data.files[0];
      if (firstPhoto.imageMediaMetadata) {
        log(`    📐 First photo: ${firstPhoto.name}`, 'white');
        log(`       Dimensions: ${firstPhoto.imageMediaMetadata.width}x${firstPhoto.imageMediaMetadata.height}`, 'white');
      }
    } else {
      log(`    ℹ️  Album is empty`, 'yellow');
    }
  } catch (error) {
    log(`    ❌ Cannot access album: ${error.message}`, 'red');
  }
}

/**
 * Test Calendar API access
 */
async function testCalendarAccess(auth) {
  log('\n════════════════════════════════════════', 'cyan');
  log('  📅 Testing CALENDAR API Access', 'cyan');
  log('════════════════════════════════════════', 'cyan');

  const calendar = google.calendar({ version: 'v3', auth });

  try {
    // Set time range
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setMonth(now.getMonth() - 1);
    const timeMax = new Date(now);
    timeMax.setMonth(now.getMonth() + 6);

    log('\n📅 Fetching calendar events...', 'yellow');
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10
    });

    if (response.data.items && response.data.items.length > 0) {
      log(`✅ Found ${response.data.items.length} events`, 'green');

      log('\n  📅 Upcoming Events:', 'magenta');
      response.data.items.slice(0, 5).forEach((event, i) => {
        const eventDate = event.start?.dateTime
          ? new Date(event.start.dateTime).toLocaleString()
          : event.start?.date;
        log(`    ${i + 1}. ${event.summary || 'Unnamed Event'}`, 'white');
        log(`       📍 ${eventDate}`, 'white');
      });

      return { success: true, eventCount: response.data.items.length };
    } else {
      log('ℹ️  No events found in the specified time range', 'yellow');
      return { success: true, eventCount: 0 };
    }

  } catch (error) {
    log(`❌ Calendar API error: ${error.message}`, 'red');
    if (error.message.includes('404')) {
      log('  The calendar might not be shared with the authenticated account', 'yellow');
    }
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function runTests() {
  log('\n' + colors.bold + '🧪 GOOGLE OAUTH2 AUTHENTICATION TEST' + colors.reset);
  log('Testing Gallery and Calendar access with OAuth2 credentials\n');

  try {
    // Authorize
    log('🔐 Authenticating with Google...', 'cyan');
    const auth = await authorize();

    // Test Drive API
    const driveResult = await testDriveAccess(auth);

    // Test Calendar API
    const calendarResult = await testCalendarAccess(auth);

    // Summary
    log('\n' + '═'.repeat(60), 'cyan');
    log('📊 TEST SUMMARY', 'cyan');
    log('═'.repeat(60), 'cyan');

    if (driveResult.success && calendarResult.success) {
      log('\n🎉 SUCCESS! OAuth2 authentication works!', 'green');
      log(`✅ Gallery access: ${driveResult.itemCount} items found`, 'green');
      log(`✅ Calendar access: ${calendarResult.eventCount} events found`, 'green');

      log('\n⚠️  IMPORTANT CONSIDERATIONS:', 'yellow');
      log('════════════════════════════', 'yellow');
      log('\n📌 OAuth2 vs API Key for your use case:', 'cyan');

      log('\n  OAuth2 (what we just tested):', 'magenta');
      log('  ❌ Requires periodic token refresh', 'red');
      log('  ❌ More complex setup', 'red');
      log('  ❌ Tokens can expire', 'red');
      log('  ✅ Full access to private resources', 'green');

      log('\n  API Key (recommended for your case):', 'magenta');
      log('  ✅ Never expires once created', 'green');
      log('  ✅ Simple setup', 'green');
      log('  ✅ Perfect for public/shared resources', 'green');
      log('  ✅ No token refresh needed', 'green');

      log('\n📝 RECOMMENDATION:', 'cyan');
      log('For your use case (avoiding reauthorization), an API key is better!', 'green');
      log('OAuth2 tokens need refresh, which brings back the auth problem.', 'yellow');

    } else {
      log('\n⚠️  Partial success or failure', 'yellow');
      if (driveResult.success) {
        log(`✅ Drive access works (${driveResult.itemCount} items)`, 'green');
      } else {
        log(`❌ Drive access failed: ${driveResult.error}`, 'red');
      }
      if (calendarResult.success) {
        log(`✅ Calendar access works (${calendarResult.eventCount} events)`, 'green');
      } else {
        log(`❌ Calendar access failed: ${calendarResult.error}`, 'red');
      }
    }

    // Clean up token file option
    log('\n💡 Token file created: token.json', 'cyan');
    log('   Delete this file to re-authenticate if needed', 'yellow');

  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run tests
if (require.main === module) {
  // Check if googleapis is installed
  try {
    require('googleapis');
    runTests();
  } catch (error) {
    log('❌ googleapis package not installed', 'red');
    log('\nPlease install it first:', 'yellow');
    log('  npm install googleapis', 'green');
    process.exit(1);
  }
}