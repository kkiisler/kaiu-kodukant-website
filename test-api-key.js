#!/usr/bin/env node

/**
 * Test Google API Key for Calendar and Drive Access
 * Testing the provided API key functionality
 */

const axios = require('axios').default;

// Configuration
const API_KEY = 'AIzaSyA9cD4MAPNuisgKuNWfNeD64s1AW5qJHFg';  // Provided API key
const CALENDAR_ID = 'a0b18dc4b7e4b9b40858746a7edddaa51b41014085ba2f4b2f89bf038ac13f12@group.calendar.google.com';
const GALLERY_FOLDER_ID = '1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg';

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
 * Test Calendar API with the provided key
 */
async function testCalendarWithApiKey() {
  log('\n════════════════════════════════════════════', 'cyan');
  log('  📅 Testing CALENDAR API with API Key', 'cyan');
  log('════════════════════════════════════════════', 'cyan');

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setMonth(now.getMonth() - 1);
  const timeMax = new Date(now);
  timeMax.setMonth(now.getMonth() + 6);

  const url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(CALENDAR_ID) + '/events';

  const params = {
    key: API_KEY,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 10
  };

  log(`\nAPI Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`, 'yellow');
  log(`Calendar ID: ${CALENDAR_ID.substring(0, 40)}...`);
  log(`Time range: ${timeMin.toLocaleDateString()} to ${timeMax.toLocaleDateString()}`);

  try {
    log('\n🔄 Sending request to Calendar API...', 'yellow');

    const response = await axios.get(url, {
      params,
      timeout: 10000,
      validateStatus: null
    });

    if (response.status === 200) {
      log('\n✅ SUCCESS! Calendar API key works!', 'green');
      log(`📊 Found ${response.data.items?.length || 0} events`, 'green');

      if (response.data.items && response.data.items.length > 0) {
        log('\n📅 Upcoming Events:', 'cyan');
        response.data.items.slice(0, 5).forEach((event, i) => {
          const eventDate = event.start?.dateTime
            ? new Date(event.start.dateTime).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : event.start?.date;
          log(`  ${i + 1}. ${event.summary || 'Unnamed Event'}`, 'magenta');
          log(`     📍 ${eventDate}`);
          if (event.location) {
            log(`     📌 ${event.location}`);
          }
        });
      } else {
        log('\nℹ️  No events found in the specified time range', 'yellow');
      }

      return { success: true, eventCount: response.data.items?.length || 0 };

    } else if (response.status === 403) {
      log('\n❌ FAILED: API key doesn\'t have Calendar API access', 'red');
      if (response.data?.error?.message) {
        log(`Error: ${response.data.error.message}`, 'red');
      }
      if (response.data?.error?.details) {
        response.data.error.details.forEach(detail => {
          log(`  - ${detail.reason}: ${detail.message}`, 'yellow');
        });
      }
      return { success: false, error: 'Permission denied' };

    } else if (response.status === 404) {
      log('\n❌ FAILED: Calendar not found', 'red');
      log('The calendar might be private or the ID is incorrect', 'yellow');
      return { success: false, error: 'Calendar not found' };

    } else if (response.status === 400) {
      log('\n❌ FAILED: Invalid API key', 'red');
      if (response.data?.error?.message) {
        log(`Error: ${response.data.error.message}`, 'red');
      }
      return { success: false, error: 'Invalid API key' };

    } else {
      log(`\n⚠️ Unexpected status: ${response.status}`, 'yellow');
      if (response.data?.error) {
        log(`Error: ${JSON.stringify(response.data.error, null, 2)}`, 'red');
      }
      return { success: false, status: response.status };
    }

  } catch (error) {
    log(`\n❌ Network or other error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Test Drive API with the provided key
 */
async function testDriveWithApiKey() {
  log('\n════════════════════════════════════════════', 'cyan');
  log('  📁 Testing DRIVE API with API Key', 'cyan');
  log('════════════════════════════════════════════', 'cyan');

  const url = 'https://www.googleapis.com/drive/v3/files';

  const params = {
    key: API_KEY,
    q: `'${GALLERY_FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,createdTime,modifiedTime,thumbnailLink)',
    pageSize: 10,
    orderBy: 'modifiedTime desc'
  };

  log(`\nAPI Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`, 'yellow');
  log(`Gallery Folder ID: ${GALLERY_FOLDER_ID}`);

  try {
    log('\n🔄 Sending request to Drive API...', 'yellow');

    const response = await axios.get(url, {
      params,
      timeout: 10000,
      validateStatus: null
    });

    if (response.status === 200) {
      log('\n✅ SUCCESS! Drive API key works!', 'green');
      log(`📊 Found ${response.data.files?.length || 0} items in gallery folder`, 'green');

      if (response.data.files && response.data.files.length > 0) {
        log('\n📸 Gallery Contents:', 'cyan');

        // Group by type
        const folders = response.data.files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        const images = response.data.files.filter(f => f.mimeType?.startsWith('image/'));

        if (folders.length > 0) {
          log(`\n  📁 Albums (${folders.length}):`, 'magenta');
          folders.slice(0, 5).forEach((folder, i) => {
            log(`    ${i + 1}. ${folder.name}`);
          });
        }

        if (images.length > 0) {
          log(`\n  🖼️ Images (${images.length}):`, 'magenta');
          images.slice(0, 3).forEach((image, i) => {
            log(`    ${i + 1}. ${image.name}`);
            if (image.thumbnailLink) {
              log(`       Thumbnail available: ✓`, 'green');
            }
          });

          // Test thumbnail access
          if (images[0]?.id) {
            await testThumbnailAccess(images[0].id, images[0].name);
          }
        }
      } else {
        log('\nℹ️  No items found in the gallery folder', 'yellow');
      }

      return { success: true, itemCount: response.data.files?.length || 0 };

    } else if (response.status === 403) {
      log('\n❌ FAILED: API key doesn\'t have Drive API access', 'red');
      if (response.data?.error?.message) {
        log(`Error: ${response.data.error.message}`, 'red');
      }
      return { success: false, error: 'Permission denied' };

    } else if (response.status === 404) {
      log('\n❌ FAILED: Gallery folder not found', 'red');
      return { success: false, error: 'Folder not found' };

    } else if (response.status === 400) {
      log('\n❌ FAILED: Invalid API key', 'red');
      if (response.data?.error?.message) {
        log(`Error: ${response.data.error.message}`, 'red');
      }
      return { success: false, error: 'Invalid API key' };

    } else {
      log(`\n⚠️ Unexpected status: ${response.status}`, 'yellow');
      if (response.data?.error) {
        log(`Error: ${JSON.stringify(response.data.error, null, 2)}`, 'red');
      }
      return { success: false, status: response.status };
    }

  } catch (error) {
    log(`\n❌ Network or other error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Test if thumbnail URLs work without authentication
 */
async function testThumbnailAccess(fileId, fileName) {
  log(`\n  🖼️ Testing direct thumbnail access for: ${fileName}`, 'cyan');

  const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;

  try {
    const response = await axios.head(thumbnailUrl, {
      timeout: 5000,
      validateStatus: null
    });

    if (response.status === 200 || response.status === 302) {
      log(`    ✅ Thumbnail accessible without auth!`, 'green');
      log(`    URL: ${thumbnailUrl}`, 'yellow');
      return true;
    } else {
      log(`    ❌ Thumbnail requires auth (status: ${response.status})`, 'red');
      return false;
    }
  } catch (error) {
    log(`    ⚠️ Thumbnail test error: ${error.message}`, 'yellow');
    return false;
  }
}

/**
 * Test API key info/restrictions
 */
async function testApiKeyInfo() {
  log('\n════════════════════════════════════════════', 'cyan');
  log('  🔑 API Key Information', 'cyan');
  log('════════════════════════════════════════════', 'cyan');

  // Try to get some info about what APIs are enabled
  log('\nChecking which APIs this key can access...', 'yellow');

  // Test a simple Calendar API endpoint
  const calendarTest = await axios.get(
    `https://www.googleapis.com/calendar/v3/colors`,
    { params: { key: API_KEY }, validateStatus: null }
  );

  // Test a simple Drive API endpoint
  const driveTest = await axios.get(
    `https://www.googleapis.com/drive/v3/about`,
    { params: { key: API_KEY, fields: 'storageQuota' }, validateStatus: null }
  );

  log('\n📊 API Access Status:', 'magenta');
  log(`  Calendar API: ${calendarTest.status === 200 ? '✅ Enabled' : '❌ Not enabled'}`,
      calendarTest.status === 200 ? 'green' : 'red');
  log(`  Drive API: ${driveTest.status === 200 ? '✅ Enabled' : '❌ Not enabled'}`,
      driveTest.status === 200 ? 'green' : 'red');
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n' + colors.bold + '🧪 GOOGLE API KEY TEST' + colors.reset);
  log('Testing API key for MTÜ Kaiu Kodukant sync services\n');

  // Test API key info first
  await testApiKeyInfo();

  // Test Calendar API
  const calendarResult = await testCalendarWithApiKey();

  // Test Drive API
  const driveResult = await testDriveWithApiKey();

  // Summary
  log('\n' + '═'.repeat(60), 'cyan');
  log('📊 TEST SUMMARY', 'cyan');
  log('═'.repeat(60), 'cyan');

  if (calendarResult.success && driveResult.success) {
    log('\n🎉 PERFECT! API key works for both services!', 'green');
    log('\n✅ Ready to migrate from Apps Script to Node.js!', 'green');
    log('✅ No more weekly reauthorization needed!', 'green');
    log(`✅ Found ${calendarResult.eventCount} calendar events`, 'green');
    log(`✅ Found ${driveResult.itemCount} items in gallery`, 'green');

    log('\n📝 Next Steps:', 'cyan');
    log('1. Add this API key to your .env file:', 'yellow');
    log(`   GOOGLE_API_KEY=${API_KEY}`, 'magenta');
    log('2. Deploy the Node.js sync services', 'yellow');
    log('3. Disable Apps Script triggers', 'yellow');
    log('4. Enjoy automated sync without reauth! 🎉', 'yellow');

  } else if (calendarResult.success || driveResult.success) {
    log('\n⚠️ PARTIAL SUCCESS', 'yellow');
    if (calendarResult.success) {
      log('✅ Calendar API works', 'green');
    } else {
      log('❌ Calendar API failed', 'red');
    }
    if (driveResult.success) {
      log('✅ Drive API works', 'green');
    } else {
      log('❌ Drive API failed', 'red');
    }
    log('\nYou may need to enable the missing API in Google Cloud Console', 'yellow');

  } else {
    log('\n❌ API KEY NOT WORKING', 'red');
    log('\nPossible issues:', 'yellow');
    log('1. API key might be invalid or expired', 'yellow');
    log('2. Calendar and/or Drive APIs not enabled', 'yellow');
    log('3. API key restrictions might be blocking access', 'yellow');
    log('\nCheck Google Cloud Console for this API key', 'yellow');
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}