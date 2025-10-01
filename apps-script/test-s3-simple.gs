/**
 * Simple standalone test for S3
 * This is a separate file to isolate the test
 */

function runSimpleS3Test() {
  Logger.log('=== SIMPLE S3 TEST ===');

  // Direct test without any dependencies
  const testKey = 'test/direct-test.txt';
  const testContent = 'Direct test content';
  const contentType = 'text/plain';

  Logger.log('Parameters:');
  Logger.log('  testKey: ' + testKey);
  Logger.log('  testContent: ' + testContent);
  Logger.log('  contentType: ' + contentType);

  // Call uploadToS3 directly with all parameters
  try {
    Logger.log('Calling uploadToS3...');
    const result = uploadToS3(testKey, testContent, contentType, true);
    Logger.log('Success! Result: ' + JSON.stringify(result));

    // Try to delete
    Logger.log('Calling deleteFromS3...');
    deleteFromS3(testKey);
    Logger.log('Delete successful!');

    return 'TEST PASSED';
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return 'TEST FAILED: ' + error.toString();
  }
}

/**
 * Test that just checks if S3_CONFIG exists
 */
function checkS3Config() {
  Logger.log('=== S3 CONFIG CHECK ===');

  if (typeof S3_CONFIG === 'undefined') {
    Logger.log('ERROR: S3_CONFIG is undefined');
    return false;
  }

  Logger.log('S3_CONFIG exists');
  Logger.log('  bucket: ' + S3_CONFIG.bucket);
  Logger.log('  endpoint: ' + S3_CONFIG.endpoint);
  Logger.log('  region: ' + S3_CONFIG.region);
  Logger.log('  accessKeyId: ' + (S3_CONFIG.accessKeyId ? 'SET' : 'NOT SET'));
  Logger.log('  secretAccessKey: ' + (S3_CONFIG.secretAccessKey ? 'SET' : 'NOT SET'));

  return true;
}