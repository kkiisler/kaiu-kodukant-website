/**
 * Quick S3 Connection Test Script
 * Run this to verify S3 authentication is working with URI encoding fix
 */

/**
 * Simple test to verify S3 connection and URI encoding
 */
function quickS3Test() {
  Logger.log('=== Quick S3 Connection Test ===');
  Logger.log('Testing with URI encoding fix...');

  try {
    // Test 1: Simple key without special characters
    const simpleKey = 'test/simple-test.txt';
    const simpleContent = 'Simple test at ' + new Date().toISOString();

    Logger.log('\n1. Testing simple key: ' + simpleKey);
    const result1 = uploadToS3(simpleKey, simpleContent, 'text/plain', true);
    Logger.log('✓ Simple upload successful');

    // Test 2: Key with spaces and special characters (will be encoded)
    const complexKey = 'test/file with spaces & special.txt';
    const complexContent = 'Complex key test at ' + new Date().toISOString();

    Logger.log('\n2. Testing complex key (with spaces & special chars): ' + complexKey);
    const result2 = uploadToS3(complexKey, complexContent, 'text/plain', true);
    Logger.log('✓ Complex upload successful (key was URI encoded)');

    // Test 3: Delete the test files
    Logger.log('\n3. Cleaning up test files...');
    deleteFromS3(simpleKey);
    Logger.log('✓ Deleted: ' + simpleKey);

    deleteFromS3(complexKey);
    Logger.log('✓ Deleted: ' + complexKey);

    Logger.log('\n=== ALL TESTS PASSED ===');
    Logger.log('S3 connection is working correctly with URI encoding!');

    return true;

  } catch (error) {
    Logger.log('\n✗ TEST FAILED: ' + error.message);
    Logger.log('Stack trace: ' + error.stack);
    throw error;
  }
}

/**
 * Test calendar sync without triggers
 */
function testCalendarSyncManually() {
  Logger.log('=== Manual Calendar Sync Test ===');

  try {
    // First verify S3 connection
    Logger.log('1. Verifying S3 connection...');
    testS3Connection();
    Logger.log('✓ S3 connection verified');

    // Then sync calendar
    Logger.log('\n2. Running calendar sync...');
    const result = syncCalendar();

    if (result.success) {
      Logger.log('✓ Calendar sync successful!');
      Logger.log('  - Events synced: ' + result.eventCount);
      Logger.log('  - S3 location: ' + result.s3Key);
      Logger.log('  - Last updated: ' + result.lastUpdated);

      // Verify the file exists
      Logger.log('\n3. Verifying file in S3...');
      Logger.log('URL: https://s3.pilw.io/kaiugalerii/calendar/events.json');
      Logger.log('You can test in browser console:');
      Logger.log("fetch('https://s3.pilw.io/kaiugalerii/calendar/events.json').then(r => r.json()).then(console.log)");

      return result;
    } else {
      throw new Error('Calendar sync failed: ' + result.error);
    }

  } catch (error) {
    Logger.log('\n✗ Calendar sync test failed: ' + error.message);
    throw error;
  }
}

/**
 * Comprehensive test suite - run all tests
 */
function runAllTests() {
  Logger.log('========================================');
  Logger.log('     COMPREHENSIVE S3 TEST SUITE');
  Logger.log('========================================');

  const tests = [];

  // Test 1: Configuration
  Logger.log('\nTest 1: Configuration Check');
  try {
    verifyConfiguration();
    tests.push({ name: 'Configuration', status: 'PASS' });
    Logger.log('✓ PASS');
  } catch (error) {
    tests.push({ name: 'Configuration', status: 'FAIL', error: error.message });
    Logger.log('✗ FAIL: ' + error.message);
  }

  // Test 2: S3 Connection
  Logger.log('\nTest 2: S3 Connection (with URI encoding)');
  try {
    quickS3Test();
    tests.push({ name: 'S3 Connection', status: 'PASS' });
    Logger.log('✓ PASS');
  } catch (error) {
    tests.push({ name: 'S3 Connection', status: 'FAIL', error: error.message });
    Logger.log('✗ FAIL: ' + error.message);
  }

  // Test 3: Calendar Sync
  Logger.log('\nTest 3: Calendar Sync');
  try {
    const result = syncCalendar();
    if (result.success) {
      tests.push({ name: 'Calendar Sync', status: 'PASS', details: `${result.eventCount} events` });
      Logger.log('✓ PASS - ' + result.eventCount + ' events synced');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    tests.push({ name: 'Calendar Sync', status: 'FAIL', error: error.message });
    Logger.log('✗ FAIL: ' + error.message);
  }

  // Summary
  Logger.log('\n========================================');
  Logger.log('              TEST SUMMARY');
  Logger.log('========================================');

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    if (test.status === 'PASS') {
      passed++;
      Logger.log('✓ ' + test.name + ': PASS' + (test.details ? ' (' + test.details + ')' : ''));
    } else {
      failed++;
      Logger.log('✗ ' + test.name + ': FAIL - ' + test.error);
    }
  });

  Logger.log('\nTotal: ' + tests.length + ' tests');
  Logger.log('Passed: ' + passed);
  Logger.log('Failed: ' + failed);

  if (failed === 0) {
    Logger.log('\n🎉 ALL TESTS PASSED! Ready for production.');
  } else {
    Logger.log('\n⚠️ Some tests failed. Please fix issues before proceeding.');
  }

  return tests;
}

/**
 * View current sync status
 */
function checkSyncStatus() {
  Logger.log('=== Current Sync Status ===');

  try {
    // Check last calendar sync
    const calendarVersion = PropertiesService.getScriptProperties().getProperty('calendar_version');
    const calendarLastSync = PropertiesService.getScriptProperties().getProperty('calendar_last_sync');

    Logger.log('\nCalendar Sync:');
    if (calendarLastSync) {
      const lastSync = new Date(calendarLastSync);
      const ageMinutes = Math.round((new Date() - lastSync) / (1000 * 60));
      Logger.log('  Last sync: ' + lastSync.toISOString());
      Logger.log('  Age: ' + ageMinutes + ' minutes');
      Logger.log('  Version: ' + (calendarVersion || 'unknown'));

      if (ageMinutes > 10) {
        Logger.log('  ⚠️ Warning: Last sync was more than 10 minutes ago');
      } else {
        Logger.log('  ✓ Status: Up to date');
      }
    } else {
      Logger.log('  ⚠️ Never synced');
    }

    // Check S3 files
    Logger.log('\nS3 Files:');
    Logger.log('  Calendar: https://s3.pilw.io/kaiugalerii/calendar/events.json');
    Logger.log('  Version: https://s3.pilw.io/kaiugalerii/metadata/version.json');

    Logger.log('\nTo verify in browser, run:');
    Logger.log("fetch('https://s3.pilw.io/kaiugalerii/calendar/events.json').then(r => r.json()).then(d => console.log('Events:', d.events.length, 'Last updated:', d.lastUpdated))");

  } catch (error) {
    Logger.log('Error checking status: ' + error.message);
  }
}