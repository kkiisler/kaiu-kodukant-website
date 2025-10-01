/**
 * Simple S3 List Bucket Test
 * Tests credentials with a basic GET request
 */

function testS3ListBucket() {
  Logger.log('=== S3 LIST BUCKET TEST ===');

  const method = 'GET';
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;
  const region = S3_CONFIG.region;
  const accessKeyId = S3_CONFIG.accessKeyId;
  const secretAccessKey = S3_CONFIG.secretAccessKey;

  // Simple GET request to list bucket
  const url = `https://${endpoint}/${bucket}/`;
  const path = `/${bucket}/`;

  // Empty payload for GET request
  const payload = '';
  const payloadHash = sha256Hash(payload);

  // Minimal headers for GET request
  const headers = {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': ''  // Will be filled by signRequest
  };

  // Sign the request
  const signedHeaders = signRequest(method, path, headers, payload);

  // Make the request
  const options = {
    method: method,
    headers: signedHeaders,
    muteHttpExceptions: true
  };

  Logger.log('Request URL: ' + url);
  Logger.log('Request Headers: ' + JSON.stringify(signedHeaders));

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log('Response Code: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('✓ SUCCESS! Bucket listing retrieved');
      Logger.log('First 500 chars of response: ' + responseText.substring(0, 500));
      return true;
    } else {
      Logger.log('✗ Failed with code ' + responseCode);
      Logger.log('Response: ' + responseText);
      return false;
    }
  } catch (error) {
    Logger.log('✗ Request failed: ' + error.toString());
    return false;
  }
}

/**
 * Test with even simpler unsigned request (if bucket allows public listing)
 */
function testS3PublicList() {
  Logger.log('=== S3 PUBLIC LIST TEST (no auth) ===');

  const endpoint = S3_CONFIG.endpoint;
  const bucket = S3_CONFIG.bucket;
  const url = `https://${endpoint}/${bucket}/`;

  const options = {
    method: 'GET',
    muteHttpExceptions: true
  };

  Logger.log('Testing public access to: ' + url);

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response Code: ' + responseCode);

    if (responseCode === 200) {
      Logger.log('✓ Bucket is publicly listable (no auth needed)');
      return true;
    } else if (responseCode === 403) {
      Logger.log('✗ Bucket requires authentication (expected)');
      return false;
    } else {
      Logger.log('Unexpected response: ' + responseCode);
      Logger.log('Response: ' + response.getContentText().substring(0, 500));
      return false;
    }
  } catch (error) {
    Logger.log('✗ Request failed: ' + error.toString());
    return false;
  }
}

/**
 * Test with Host header included in signature
 */
function testS3ListWithHost() {
  Logger.log('=== S3 LIST WITH HOST HEADER ===');

  const method = 'GET';
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;

  const url = `https://${endpoint}/${bucket}/`;
  const path = `/${bucket}/`;

  const payload = '';
  const payloadHash = sha256Hash(payload);

  // Include Host header this time
  const headers = {
    'Host': endpoint,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': ''
  };

  const signedHeaders = signRequest(method, path, headers, payload);

  // Remove Host for Apps Script
  delete signedHeaders['Host'];

  const options = {
    method: method,
    headers: signedHeaders,
    muteHttpExceptions: true
  };

  Logger.log('Request URL: ' + url);

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response Code: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('✓ SUCCESS with Host in signature!');
      return true;
    } else {
      Logger.log('✗ Failed: ' + response.getContentText().substring(0, 500));
      return false;
    }
  } catch (error) {
    Logger.log('✗ Error: ' + error.toString());
    return false;
  }
}