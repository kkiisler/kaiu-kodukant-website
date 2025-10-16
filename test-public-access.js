#!/usr/bin/env node

/**
 * Test script to verify public access to Google Calendar and Drive Gallery
 * This checks if we can access the resources without authentication
 */

const https = require('https');
const axios = require('axios').default;

// Configuration from apps-script/config.gs
const CALENDAR_ID = 'a0b18dc4b7e4b9b40858746a7edddaa51b41014085ba2f4b2f89bf038ac13f12@group.calendar.google.com';
const GALLERY_FOLDER_ID = '1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test Google Calendar public access
 */
async function testCalendarAccess() {
  log('\n════════════════════════════════════════════', 'cyan');
  log('  Testing Google Calendar Public Access', 'cyan');
  log('════════════════════════════════════════════', 'cyan');

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setMonth(now.getMonth() - 1);
  const timeMax = new Date(now);
  timeMax.setMonth(now.getMonth() + 6);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '10'
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`;

  log(`\n📅 Calendar ID: ${CALENDAR_ID}`);
  log(`🔗 Testing URL: ${url.substring(0, 100)}...`);

  try {
    log('\nAttempting to fetch calendar events WITHOUT authentication...', 'yellow');

    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: null // Don't throw on any status code
    });

    if (response.status === 200) {
      log('✅ SUCCESS! Calendar is publicly accessible', 'green');
      log(`📊 Found ${response.data.items?.length || 0} events`, 'green');

      // Show first few events as proof
      if (response.data.items && response.data.items.length > 0) {
        log('\nSample events:', 'cyan');
        response.data.items.slice(0, 3).forEach((event, i) => {
          log(`  ${i + 1}. ${event.summary || 'Unnamed Event'} - ${event.start?.dateTime || event.start?.date}`);
        });
      }

      return { accessible: true, requiresAuth: false, eventCount: response.data.items?.length || 0 };
    } else if (response.status === 403) {
      log('❌ FAILED: Calendar requires authentication (403 Forbidden)', 'red');
      log(`Error: ${response.data.error?.message || 'Access denied'}`, 'red');
      return { accessible: false, requiresAuth: true, error: 'Authentication required' };
    } else if (response.status === 404) {
      log('❌ FAILED: Calendar not found or not public (404)', 'red');
      return { accessible: false, requiresAuth: false, error: 'Calendar not found' };
    } else {
      log(`⚠️  Unexpected status: ${response.status}`, 'yellow');
      log(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return { accessible: false, status: response.status };
    }
  } catch (error) {
    log(`❌ ERROR: ${error.message}`, 'red');
    return { accessible: false, error: error.message };
  }
}

/**
 * Test Google Drive Gallery folder public access
 */
async function testGalleryAccess() {
  log('\n════════════════════════════════════════════', 'cyan');
  log('  Testing Google Drive Gallery Public Access', 'cyan');
  log('════════════════════════════════════════════', 'cyan');

  log(`\n📁 Gallery Folder ID: ${GALLERY_FOLDER_ID}`);

  // Test 1: Check if we can list folders (albums)
  const listParams = new URLSearchParams({
    q: `'${GALLERY_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name,createdTime,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '10'
  });

  const listUrl = `https://www.googleapis.com/drive/v3/files?${listParams}`;
  log(`🔗 Testing URL: ${listUrl.substring(0, 100)}...`);

  try {
    log('\nAttempting to list albums WITHOUT authentication...', 'yellow');

    const response = await axios.get(listUrl, {
      timeout: 10000,
      validateStatus: null
    });

    if (response.status === 200) {
      log('✅ SUCCESS! Gallery folder is publicly accessible', 'green');
      log(`📊 Found ${response.data.files?.length || 0} albums`, 'green');

      // Show albums as proof
      if (response.data.files && response.data.files.length > 0) {
        log('\nSample albums:', 'cyan');
        response.data.files.slice(0, 3).forEach((album, i) => {
          log(`  ${i + 1}. ${album.name} (ID: ${album.id})`);
        });

        // Test accessing photos in first album
        await testAlbumPhotos(response.data.files[0].id, response.data.files[0].name);
      }

      return { accessible: true, requiresAuth: false, albumCount: response.data.files?.length || 0 };
    } else if (response.status === 403) {
      log('❌ FAILED: Gallery folder requires authentication (403 Forbidden)', 'red');
      log(`Error: ${response.data.error?.message || 'Access denied'}`, 'red');

      // Try alternative: direct folder metadata
      await testDirectFolderAccess();

      return { accessible: false, requiresAuth: true, error: 'Authentication required' };
    } else if (response.status === 404) {
      log('❌ FAILED: Gallery folder not found (404)', 'red');
      return { accessible: false, requiresAuth: false, error: 'Folder not found' };
    } else {
      log(`⚠️  Unexpected status: ${response.status}`, 'yellow');
      log(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return { accessible: false, status: response.status };
    }
  } catch (error) {
    log(`❌ ERROR: ${error.message}`, 'red');
    return { accessible: false, error: error.message };
  }
}

/**
 * Test accessing photos in an album
 */
async function testAlbumPhotos(albumId, albumName) {
  log(`\n📸 Testing photo access in album: ${albumName}`, 'cyan');

  const params = new URLSearchParams({
    q: `'${albumId}' in parents and mimeType contains 'image/' and trashed=false`,
    fields: 'files(id,name,createdTime,size)',
    pageSize: '5'
  });

  const url = `https://www.googleapis.com/drive/v3/files?${params}`;

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: null
    });

    if (response.status === 200) {
      log(`  ✅ Can list photos in album (found ${response.data.files?.length || 0} photos)`, 'green');

      // Test thumbnail access
      if (response.data.files && response.data.files.length > 0) {
        const photoId = response.data.files[0].id;
        const thumbnailUrl = `https://drive.google.com/thumbnail?id=${photoId}&sz=w300`;

        // Try to access thumbnail
        try {
          const thumbResponse = await axios.head(thumbnailUrl, {
            timeout: 5000,
            validateStatus: null
          });

          if (thumbResponse.status === 200) {
            log(`  ✅ Can access photo thumbnails directly`, 'green');
          } else {
            log(`  ❌ Cannot access thumbnails (status: ${thumbResponse.status})`, 'red');
          }
        } catch (error) {
          log(`  ❌ Thumbnail access error: ${error.message}`, 'red');
        }
      }
    } else {
      log(`  ❌ Cannot list photos (status: ${response.status})`, 'red');
    }
  } catch (error) {
    log(`  ❌ Error testing album photos: ${error.message}`, 'red');
  }
}

/**
 * Test direct folder access via sharing link
 */
async function testDirectFolderAccess() {
  log('\n🔄 Testing alternative access methods...', 'yellow');

  // Test if folder has a public sharing link
  const sharingUrl = `https://drive.google.com/drive/folders/${GALLERY_FOLDER_ID}`;
  log(`Testing sharing URL: ${sharingUrl}`);

  try {
    const response = await axios.get(sharingUrl, {
      timeout: 10000,
      validateStatus: null,
      maxRedirects: 0
    });

    if (response.status === 200 || response.status === 302) {
      log('  ℹ️  Folder has a sharing link but API access requires authentication', 'yellow');
    } else {
      log(`  ℹ️  Sharing link status: ${response.status}`, 'yellow');
    }
  } catch (error) {
    log(`  ℹ️  Could not verify sharing link: ${error.message}`, 'yellow');
  }
}

/**
 * Test with optional API key
 */
async function testWithApiKey() {
  log('\n════════════════════════════════════════════', 'cyan');
  log('  Testing with API Key (if available)', 'cyan');
  log('════════════════════════════════════════════', 'cyan');

  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    log('\nℹ️  No GOOGLE_API_KEY found in environment', 'yellow');
    log('To test with API key, set: export GOOGLE_API_KEY=your_key', 'yellow');
    return;
  }

  log('\n🔑 API Key found, testing with authentication...', 'green');

  // Test calendar with API key
  const calParams = new URLSearchParams({
    key: apiKey,
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: 'true',
    maxResults: '5'
  });

  const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${calParams}`;

  try {
    const calResponse = await axios.get(calUrl, { validateStatus: null });
    if (calResponse.status === 200) {
      log('✅ Calendar accessible with API key', 'green');
    } else {
      log(`❌ Calendar not accessible with API key (status: ${calResponse.status})`, 'red');
    }
  } catch (error) {
    log(`❌ Calendar API key test error: ${error.message}`, 'red');
  }

  // Test Drive with API key
  const driveParams = new URLSearchParams({
    key: apiKey,
    q: `'${GALLERY_FOLDER_ID}' in parents`,
    pageSize: '5'
  });

  const driveUrl = `https://www.googleapis.com/drive/v3/files?${driveParams}`;

  try {
    const driveResponse = await axios.get(driveUrl, { validateStatus: null });
    if (driveResponse.status === 200) {
      log('✅ Drive accessible with API key', 'green');
    } else {
      log(`❌ Drive not accessible with API key (status: ${driveResponse.status})`, 'red');
    }
  } catch (error) {
    log(`❌ Drive API key test error: ${error.message}`, 'red');
  }
}

/**
 * Main test function
 */
async function runTests() {
  log('\n' + colors.bold + '🧪 PUBLIC ACCESS TEST FOR KAIU KODUKANT' + colors.reset);
  log('Testing Google Calendar and Drive Gallery public accessibility\n');

  const results = {
    calendar: await testCalendarAccess(),
    gallery: await testGalleryAccess()
  };

  await testWithApiKey();

  // Summary
  log('\n════════════════════════════════════════════', 'cyan');
  log('  TEST SUMMARY', 'cyan');
  log('════════════════════════════════════════════', 'cyan');

  if (results.calendar.accessible) {
    log('\n✅ Calendar: PUBLICLY ACCESSIBLE', 'green');
    log('   → Can migrate to Node.js without authentication', 'green');
  } else {
    log('\n❌ Calendar: NOT PUBLICLY ACCESSIBLE', 'red');
    log('   → Requires making calendar public or using service account', 'yellow');
  }

  if (results.gallery.accessible) {
    log('\n✅ Gallery: PUBLICLY ACCESSIBLE', 'green');
    log('   → Can migrate to Node.js without authentication', 'green');
  } else {
    log('\n❌ Gallery: NOT PUBLICLY ACCESSIBLE', 'red');
    log('   → Requires making folder public or using service account', 'yellow');
  }

  // Recommendations
  log('\n════════════════════════════════════════════', 'cyan');
  log('  RECOMMENDATIONS', 'cyan');
  log('════════════════════════════════════════════', 'cyan');

  if (!results.calendar.accessible) {
    log('\n📅 For Calendar:', 'yellow');
    log('  1. Make calendar public in Google Calendar settings', 'yellow');
    log('  2. Or create a Google Cloud API key for higher quotas', 'yellow');
    log('  3. Or use a service account with domain-wide delegation', 'yellow');
  }

  if (!results.gallery.accessible) {
    log('\n📁 For Gallery:', 'yellow');
    log('  1. Right-click folder in Google Drive → Share → Anyone with link', 'yellow');
    log('  2. Or create a Google Cloud API key', 'yellow');
    log('  3. Or use a service account with appropriate permissions', 'yellow');
  }

  log('\n' + colors.bold + 'Note: Even with API key, public access is preferred to avoid quotas' + colors.reset);
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}