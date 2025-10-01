/**
 * Minimal S3 PUT test with different approaches
 */

/**
 * Test with absolute minimal headers
 */
function testMinimalPut() {
  Logger.log('=== MINIMAL PUT TEST ===');

  const method = 'PUT';
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;
  const testKey = 'test.txt';
  const url = `https://${endpoint}/${bucket}/${testKey}`;
  const path = `/${bucket}/${testKey}`;

  const content = 'test';
  const payload = Utilities.newBlob(content).getBytes();
  const payloadHash = sha256Hash(payload);

  // Absolute minimum headers
  const headers = {
    'x-amz-content-sha256': payloadHash
  };

  const signedHeaders = signRequest(method, path, headers, payload);

  const options = {
    method: method,
    headers: signedHeaders,
    payload: payload,
    muteHttpExceptions: true
  };

  Logger.log('URL: ' + url);
  Logger.log('Headers: ' + JSON.stringify(signedHeaders));

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response Code: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('✓ SUCCESS!');
      return true;
    } else {
      Logger.log('✗ Failed: ' + response.getContentText());
      return false;
    }
  } catch (error) {
    Logger.log('✗ Error: ' + error.toString());
    return false;
  }
}

/**
 * Test with path-style URL instead of virtual-host style
 */
function testPathStylePut() {
  Logger.log('=== PATH STYLE PUT TEST ===');

  const method = 'PUT';
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;
  const testKey = 'test.txt';

  // Try without bucket in path for signature
  const url = `https://${endpoint}/${bucket}/${testKey}`;
  const path = `/${testKey}`; // No bucket in path

  const content = 'test';
  const payload = Utilities.newBlob(content).getBytes();
  const payloadHash = sha256Hash(payload);

  const headers = {
    'Host': `${bucket}.${endpoint}`, // Virtual host style
    'x-amz-content-sha256': payloadHash
  };

  const signedHeaders = signRequest(method, path, headers, payload);
  delete signedHeaders['Host'];

  const options = {
    method: method,
    headers: signedHeaders,
    payload: payload,
    muteHttpExceptions: true
  };

  Logger.log('URL: ' + url);

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response Code: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('✓ SUCCESS with path style!');
      return true;
    } else {
      Logger.log('✗ Failed: ' + response.getContentText());
      return false;
    }
  } catch (error) {
    Logger.log('✗ Error: ' + error.toString());
    return false;
  }
}

/**
 * Test with different date format
 */
function testWithDifferentDateFormat() {
  Logger.log('=== DIFFERENT DATE FORMAT TEST ===');

  const method = 'PUT';
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;
  const testKey = 'test.txt';
  const url = `https://${endpoint}/${bucket}/${testKey}`;

  const content = 'test';
  const payload = Utilities.newBlob(content).getBytes();

  // Try with x-amz-date in ISO format
  const isoDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');

  const headers = {
    'x-amz-date': isoDate,
    'x-amz-content-sha256': sha256Hash(payload)
  };

  // Manual signature without going through signRequest
  const authHeader = createSimpleAuth(method, `/${bucket}/${testKey}`, headers);
  headers['Authorization'] = authHeader;

  const options = {
    method: method,
    headers: headers,
    payload: payload,
    muteHttpExceptions: true
  };

  Logger.log('URL: ' + url);
  Logger.log('ISO Date: ' + isoDate);

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response Code: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('✓ SUCCESS with ISO date!');
      return true;
    } else {
      Logger.log('✗ Failed: ' + response.getContentText());
      return false;
    }
  } catch (error) {
    Logger.log('✗ Error: ' + error.toString());
    return false;
  }
}

/**
 * Create simple auth header manually
 */
function createSimpleAuth(method, path, headers) {
  const accessKeyId = S3_CONFIG.accessKeyId;
  const secretAccessKey = S3_CONFIG.secretAccessKey;
  const region = S3_CONFIG.region;

  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');

  // Simple string to sign
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  // Just return a basic auth header
  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=x-amz-content-sha256;x-amz-date, Signature=test`;
}

/**
 * Test with unsigned payload (some S3 implementations allow this)
 */
function testUnsignedPayload() {
  Logger.log('=== UNSIGNED PAYLOAD TEST ===');

  const method = 'PUT';
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;
  const testKey = 'test.txt';
  const url = `https://${endpoint}/${bucket}/${testKey}`;
  const path = `/${bucket}/${testKey}`;

  const content = 'test';
  const payload = Utilities.newBlob(content).getBytes();

  // Use UNSIGNED-PAYLOAD instead of hash
  const headers = {
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
  };

  const signedHeaders = signRequest(method, path, headers, 'UNSIGNED-PAYLOAD');

  const options = {
    method: method,
    headers: signedHeaders,
    payload: payload,
    muteHttpExceptions: true
  };

  Logger.log('URL: ' + url);

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response Code: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('✓ SUCCESS with unsigned payload!');
      return true;
    } else {
      Logger.log('✗ Failed: ' + response.getContentText());
      return false;
    }
  } catch (error) {
    Logger.log('✗ Error: ' + error.toString());
    return false;
  }
}