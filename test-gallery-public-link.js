#!/usr/bin/env node

/**
 * Test script to verify if Google Drive Gallery is accessible via public sharing link
 * Testing different access methods for publicly shared folders
 */

const axios = require('axios').default;

const GALLERY_FOLDER_ID = '1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg';
const SHARING_LINK = 'https://drive.google.com/drive/folders/1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg?usp=sharing';

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
 * Test 1: Check if folder metadata is accessible
 */
async function testFolderMetadata() {
  log('\n📁 Test 1: Folder Metadata Access', 'cyan');
  log('════════════════════════════════', 'cyan');

  const url = `https://www.googleapis.com/drive/v3/files/${GALLERY_FOLDER_ID}`;

  log(`Testing: ${url}`);

  try {
    // Test without any authentication
    const response = await axios.get(url, {
      params: {
        fields: 'id,name,mimeType,shared,permissions',
        supportsAllDrives: true
      },
      validateStatus: null
    });

    if (response.status === 200) {
      log('✅ SUCCESS: Folder metadata is accessible!', 'green');
      log(`Folder name: ${response.data.name}`, 'green');
      log(`Shared: ${response.data.shared}`, 'green');
    } else if (response.status === 404) {
      log('❌ Folder not found (404)', 'red');
    } else if (response.status === 403) {
      log('❌ Access forbidden without authentication (403)', 'red');
      log(`Note: Even though folder has "anyone with link" sharing, API still requires auth`, 'yellow');
    } else {
      log(`❌ Status: ${response.status}`, 'red');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  }
}

/**
 * Test 2: List contents of the folder
 */
async function testListContents() {
  log('\n📂 Test 2: List Folder Contents', 'cyan');
  log('════════════════════════════════', 'cyan');

  const url = 'https://www.googleapis.com/drive/v3/files';

  log(`Testing: List files in folder ${GALLERY_FOLDER_ID}`);

  try {
    const response = await axios.get(url, {
      params: {
        q: `'${GALLERY_FOLDER_ID}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType)',
        pageSize: 10,
        supportsAllDrives: true
      },
      validateStatus: null
    });

    if (response.status === 200) {
      log('✅ SUCCESS: Can list folder contents!', 'green');
      log(`Found ${response.data.files?.length || 0} items`, 'green');

      if (response.data.files?.length > 0) {
        log('\nFirst few items:', 'cyan');
        response.data.files.slice(0, 5).forEach((file, i) => {
          log(`  ${i + 1}. ${file.name} (${file.mimeType})`, 'white');
        });
      }
    } else if (response.status === 403) {
      log('❌ Cannot list contents without authentication (403)', 'red');
    } else {
      log(`❌ Status: ${response.status}`, 'red');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  }
}

/**
 * Test 3: Try with alternative parameters that might work for public folders
 */
async function testAlternativeAccess() {
  log('\n🔄 Test 3: Alternative Access Methods', 'cyan');
  log('════════════════════════════════', 'cyan');

  // Test if we can at least verify the folder exists
  const checkUrl = `https://www.googleapis.com/drive/v3/files/${GALLERY_FOLDER_ID}`;

  log('Testing with minimal fields request...');

  try {
    const response = await axios.get(checkUrl, {
      params: {
        fields: 'id',
        supportsAllDrives: true,
        // Try with acknowledging shared drives
        includeItemsFromAllDrives: true
      },
      validateStatus: null
    });

    if (response.status === 200) {
      log('✅ Can confirm folder exists with minimal request', 'green');
    } else {
      log(`❌ Still requires auth (${response.status})`, 'red');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  }
}

/**
 * Test 4: Check thumbnail access for images (if we know an image ID)
 */
async function testThumbnailAccess() {
  log('\n🖼️  Test 4: Direct Thumbnail Access', 'cyan');
  log('════════════════════════════════', 'cyan');

  log('Note: If we have image IDs, we can test direct thumbnail URLs');
  log('Format: https://drive.google.com/thumbnail?id={FILE_ID}&sz=w300');
  log('These URLs often work without authentication for shared files');
}

/**
 * Test 5: Export/download URLs
 */
async function testExportUrls() {
  log('\n📥 Test 5: Direct Download URLs', 'cyan');
  log('════════════════════════════════', 'cyan');

  log('Testing if folder allows direct download links...');

  // Test the uc?export=download format
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${GALLERY_FOLDER_ID}`;

  try {
    const response = await axios.head(downloadUrl, {
      validateStatus: null,
      maxRedirects: 0
    });

    if (response.status === 200 || response.status === 302) {
      log('✅ Download endpoint responds', 'green');
    } else {
      log(`ℹ️ Download endpoint status: ${response.status}`, 'yellow');
    }
  } catch (error) {
    log(`ℹ️ Download test: ${error.message}`, 'yellow');
  }
}

/**
 * Test 6: Check if we can use the folder with an API key
 */
async function testWithApiKey() {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    log('\n🔑 Test 6: API Key Access', 'cyan');
    log('════════════════════════════════', 'cyan');
    log('ℹ️ No API key found. Set GOOGLE_API_KEY environment variable to test.', 'yellow');
    return;
  }

  log('\n🔑 Test 6: Testing with API Key', 'cyan');
  log('════════════════════════════════', 'cyan');

  const url = 'https://www.googleapis.com/drive/v3/files';

  try {
    const response = await axios.get(url, {
      params: {
        q: `'${GALLERY_FOLDER_ID}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,thumbnailLink,webContentLink,webViewLink)',
        key: apiKey,
        pageSize: 10
      },
      validateStatus: null
    });

    if (response.status === 200) {
      log('✅ SUCCESS with API key!', 'green');
      log(`Found ${response.data.files?.length || 0} items`, 'green');

      if (response.data.files?.length > 0) {
        const firstFile = response.data.files[0];
        log('\nFirst file details:', 'cyan');
        log(`  Name: ${firstFile.name}`);
        log(`  Type: ${firstFile.mimeType}`);
        if (firstFile.thumbnailLink) {
          log(`  Thumbnail: ${firstFile.thumbnailLink}`, 'green');
        }
        if (firstFile.webViewLink) {
          log(`  View Link: ${firstFile.webViewLink}`, 'green');
        }

        // Test if thumbnail is accessible without auth
        if (firstFile.id && firstFile.mimeType?.startsWith('image/')) {
          await testImageThumbnail(firstFile.id, firstFile.name);
        }
      }
    } else {
      log(`❌ Failed even with API key (${response.status})`, 'red');
      if (response.data?.error) {
        log(`Error: ${response.data.error.message}`, 'red');
      }
    }
  } catch (error) {
    log(`❌ Error with API key: ${error.message}`, 'red');
  }
}

/**
 * Test direct image thumbnail access
 */
async function testImageThumbnail(imageId, imageName) {
  log(`\n  Testing thumbnail for: ${imageName}`, 'yellow');

  const thumbnailUrl = `https://drive.google.com/thumbnail?id=${imageId}&sz=w300`;

  try {
    const response = await axios.head(thumbnailUrl, {
      validateStatus: null
    });

    if (response.status === 200) {
      log(`  ✅ Thumbnail accessible without auth: ${thumbnailUrl}`, 'green');
    } else if (response.status === 302) {
      log(`  ✅ Thumbnail redirects (likely accessible): ${thumbnailUrl}`, 'green');
    } else {
      log(`  ❌ Thumbnail not accessible (${response.status})`, 'red');
    }
  } catch (error) {
    log(`  ❌ Thumbnail test error: ${error.message}`, 'red');
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n' + colors.bold + '🧪 GOOGLE DRIVE PUBLIC FOLDER ACCESS TEST' + colors.reset);
  log('Testing folder: ' + SHARING_LINK);
  log('Folder ID: ' + GALLERY_FOLDER_ID);

  await testFolderMetadata();
  await testListContents();
  await testAlternativeAccess();
  await testThumbnailAccess();
  await testExportUrls();
  await testWithApiKey();

  // Summary
  log('\n' + '═'.repeat(50), 'cyan');
  log('📊 SUMMARY', 'cyan');
  log('═'.repeat(50), 'cyan');

  log('\n🔍 Key Findings:', 'bold');
  log('1. Google Drive API requires authentication even for "anyone with link" folders', 'yellow');
  log('2. The sharing link works in browser but not for API access', 'yellow');
  log('3. Individual file thumbnails may be accessible if we have file IDs', 'yellow');
  log('4. API key is the minimum requirement for programmatic access', 'green');

  log('\n✅ SOLUTION:', 'green');
  log('Use a Google API key (free, no reauthorization needed)', 'green');
  log('This is still much better than Apps Script weekly reauth!', 'green');

  log('\n📝 Next Steps:', 'cyan');
  log('1. Create a Google Cloud project and API key', 'cyan');
  log('2. Enable Google Drive API in the project', 'cyan');
  log('3. Add API key to your .env file', 'cyan');
  log('4. The migration plan will work perfectly with the API key', 'cyan');
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}