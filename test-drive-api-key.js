#!/usr/bin/env node

/**
 * Test Google Drive API Key
 */

const axios = require('axios').default;

const API_KEY = 'AIzaSyCNpCJ0tk2CPh5JKfn2l6qZM9lp5e08JBQ';
const GALLERY_FOLDER_ID = '1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg';
const CALENDAR_ID = 'a0b18dc4b7e4b9b40858746a7edddaa51b41014085ba2f4b2f89bf038ac13f12@group.calendar.google.com';

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

async function testDriveAPI() {
  log('\n════════════════════════════════════════════', 'cyan');
  log('  📁 Testing DRIVE API with API Key', 'cyan');
  log('════════════════════════════════════════════', 'cyan');

  log(`\nAPI Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`, 'yellow');
  log(`Gallery Folder ID: ${GALLERY_FOLDER_ID}`);

  try {
    // Test 1: Check if Drive API is enabled
    log('\n🔍 Step 1: Checking Drive API access...', 'cyan');
    const aboutResponse = await axios.get('https://www.googleapis.com/drive/v3/about', {
      params: {
        key: API_KEY,
        fields: 'user,storageQuota'
      },
      validateStatus: null,
      timeout: 10000
    });

    if (aboutResponse.status === 200) {
      log('✅ Drive API is enabled and accessible!', 'green');
    } else if (aboutResponse.status === 403) {
      log('❌ Drive API not enabled for this key', 'red');
      if (aboutResponse.data?.error?.message) {
        log(`Error: ${aboutResponse.data.error.message}`, 'red');
      }
      return { success: false, error: 'Drive API not enabled' };
    }

    // Test 2: List gallery folder contents
    log('\n🔍 Step 2: Listing gallery folder contents...', 'cyan');
    const listResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
      params: {
        key: API_KEY,
        q: `'${GALLERY_FOLDER_ID}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,createdTime,modifiedTime,size,thumbnailLink,webViewLink)',
        pageSize: 20,
        orderBy: 'modifiedTime desc'
      },
      validateStatus: null,
      timeout: 10000
    });

    if (listResponse.status === 200) {
      const files = listResponse.data.files || [];
      log(`✅ SUCCESS! Found ${files.length} items in gallery`, 'green');

      if (files.length > 0) {
        // Group by type
        const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        const images = files.filter(f => f.mimeType?.startsWith('image/'));

        if (folders.length > 0) {
          log(`\n📁 Albums (${folders.length}):`, 'magenta');
          folders.slice(0, 5).forEach((folder, i) => {
            log(`  ${i + 1}. ${folder.name} (ID: ${folder.id})`, 'white');
          });

          // Test accessing first album
          if (folders[0]) {
            await testAlbumAccess(folders[0].id, folders[0].name);
          }
        }

        if (images.length > 0) {
          log(`\n🖼️  Images in root (${images.length}):`, 'magenta');
          images.slice(0, 3).forEach((image, i) => {
            log(`  ${i + 1}. ${image.name}`, 'white');
          });
        }
      } else {
        log('\nℹ️  Gallery folder is empty', 'yellow');
      }

      return { success: true, itemCount: files.length };

    } else if (listResponse.status === 404) {
      log('❌ Gallery folder not found', 'red');
      log('The folder might be private or the ID is incorrect', 'yellow');
      return { success: false, error: 'Folder not found' };
    } else if (listResponse.status === 403) {
      log('❌ Access denied to gallery folder', 'red');
      if (listResponse.data?.error?.message) {
        log(`Error: ${listResponse.data.error.message}`, 'red');
      }
      return { success: false, error: 'Access denied' };
    } else {
      log(`❌ Unexpected status: ${listResponse.status}`, 'red');
      return { success: false, status: listResponse.status };
    }

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testAlbumAccess(albumId, albumName) {
  log(`\n📸 Testing album: ${albumName}`, 'cyan');

  try {
    const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
      params: {
        key: API_KEY,
        q: `'${albumId}' in parents and mimeType contains 'image/' and trashed=false`,
        fields: 'files(id,name,size,mimeType,imageMediaMetadata)',
        pageSize: 10
      },
      validateStatus: null,
      timeout: 10000
    });

    if (response.status === 200) {
      const photos = response.data.files || [];
      log(`  ✅ Album accessible - ${photos.length} photos`, 'green');

      if (photos.length > 0) {
        log(`  📷 Sample photos:`, 'white');
        photos.slice(0, 3).forEach((photo, i) => {
          log(`    ${i + 1}. ${photo.name}`, 'white');
          if (photo.imageMediaMetadata) {
            log(`       ${photo.imageMediaMetadata.width}x${photo.imageMediaMetadata.height}px`, 'white');
          }
        });

        // Test thumbnail access
        await testThumbnailAccess(photos[0].id, photos[0].name);
      }
    } else {
      log(`  ❌ Cannot access album (status: ${response.status})`, 'red');
    }
  } catch (error) {
    log(`  ❌ Album test error: ${error.message}`, 'red');
  }
}

async function testThumbnailAccess(fileId, fileName) {
  log(`\n  🖼️  Testing thumbnail for: ${fileName}`, 'cyan');

  const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;

  try {
    const response = await axios.head(thumbnailUrl, {
      validateStatus: null,
      timeout: 5000
    });

    if (response.status === 200 || response.status === 302) {
      log(`    ✅ Thumbnail accessible without auth!`, 'green');
      log(`    URL: ${thumbnailUrl}`, 'yellow');
    } else {
      log(`    ⚠️  Thumbnail status: ${response.status}`, 'yellow');
    }
  } catch (error) {
    log(`    ⚠️  Thumbnail test: ${error.message}`, 'yellow');
  }
}

async function testCalendarAPI() {
  log('\n════════════════════════════════════════════', 'cyan');
  log('  📅 Testing CALENDAR API with Same Key', 'cyan');
  log('════════════════════════════════════════════', 'cyan');

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setMonth(now.getMonth() - 1);
  const timeMax = new Date(now);
  timeMax.setMonth(now.getMonth() + 6);

  try {
    log('\n🔍 Testing calendar access...', 'cyan');
    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
      {
        params: {
          key: API_KEY,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 10
        },
        validateStatus: null,
        timeout: 10000
      }
    );

    if (response.status === 200) {
      const events = response.data.items || [];
      log(`✅ SUCCESS! Found ${events.length} calendar events`, 'green');

      if (events.length > 0) {
        log(`\n📅 Upcoming events:`, 'magenta');
        events.slice(0, 5).forEach((event, i) => {
          const date = event.start?.dateTime || event.start?.date;
          log(`  ${i + 1}. ${event.summary || 'Unnamed Event'}`, 'white');
          log(`     📍 ${new Date(date).toLocaleString('et-EE')}`, 'white');
        });
      }

      return { success: true, eventCount: events.length };
    } else if (response.status === 403) {
      log('❌ Calendar API not enabled for this key', 'red');
      if (response.data?.error?.message) {
        log(`Error: ${response.data.error.message}`, 'red');
      }
      return { success: false, error: 'Calendar API not enabled' };
    } else {
      log(`❌ Calendar access failed (status: ${response.status})`, 'red');
      return { success: false, status: response.status };
    }
  } catch (error) {
    log(`❌ Calendar test error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n' + colors.bold + '🧪 GOOGLE API KEY TEST' + colors.reset);
  log('Testing Drive and Calendar API access\n');

  const driveResult = await testDriveAPI();
  const calendarResult = await testCalendarAPI();

  // Summary
  log('\n' + '═'.repeat(60), 'cyan');
  log('📊 TEST SUMMARY', 'cyan');
  log('═'.repeat(60), 'cyan');

  const driveSuccess = driveResult.success;
  const calendarSuccess = calendarResult.success;

  if (driveSuccess && calendarSuccess) {
    log('\n🎉 PERFECT! API key works for BOTH services!', 'green');
    log('═'.repeat(60), 'green');
    log(`\n✅ Drive API: ${driveResult.itemCount} items found`, 'green');
    log(`✅ Calendar API: ${calendarResult.eventCount} events found`, 'green');

    log('\n🚀 YOU\'RE READY TO MIGRATE!', 'cyan');
    log('═'.repeat(40), 'cyan');

    log('\n📝 Next Steps:', 'yellow');
    log('1. Add this API key to your backend .env file:', 'white');
    log(`   GOOGLE_API_KEY=${API_KEY}`, 'magenta');
    log('2. Follow the migration plan in planning/google-plan/', 'white');
    log('3. Deploy Node.js sync services', 'white');
    log('4. Disable Apps Script triggers', 'white');
    log('5. ✨ Never reauthorize again! ✨', 'green');

  } else if (driveSuccess || calendarSuccess) {
    log('\n⚠️  PARTIAL SUCCESS', 'yellow');
    log('═'.repeat(60), 'yellow');

    if (driveSuccess) {
      log(`\n✅ Drive API works (${driveResult.itemCount} items)`, 'green');
    } else {
      log(`\n❌ Drive API failed: ${driveResult.error}`, 'red');
      log('   → Enable Drive API in Google Cloud Console', 'yellow');
    }

    if (calendarSuccess) {
      log(`\n✅ Calendar API works (${calendarResult.eventCount} events)`, 'green');
    } else {
      log(`\n❌ Calendar API failed: ${calendarResult.error}`, 'red');
      log('   → Enable Calendar API in Google Cloud Console', 'yellow');
    }

    log('\n📝 To fix:', 'cyan');
    log('1. Go to https://console.cloud.google.com/', 'white');
    log('2. Select your project', 'white');
    log('3. Go to APIs & Services → Library', 'white');
    log('4. Enable missing APIs', 'white');

  } else {
    log('\n❌ API KEY NOT WORKING', 'red');
    log('═'.repeat(60), 'red');

    log('\n❌ Drive API: ' + driveResult.error, 'red');
    log('❌ Calendar API: ' + calendarResult.error, 'red');

    log('\n📝 Possible issues:', 'yellow');
    log('1. APIs not enabled in Google Cloud Console', 'white');
    log('2. API key might be restricted incorrectly', 'white');
    log('3. API key might be from wrong project', 'white');

    log('\n🔧 How to fix:', 'cyan');
    log('See: planning/google-plan/HOW-TO-CREATE-API-KEY.md', 'white');
  }

  log('\n' + '═'.repeat(60), 'cyan');
}

if (require.main === module) {
  runTests().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}