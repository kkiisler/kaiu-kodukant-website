/**
 * S3 Utilities for Google Apps Script
 * Implements AWS Signature Version 4 for Pilvio S3 compatibility
 */

/**
 * URI-encodes an S3 object key's path segments.
 * Encodes each segment but preserves the '/' separators.
 *
 * @param {string} key - The S3 object key
 * @returns {string} The URI-encoded key
 */
function encodeS3Key(key) {
  return key.split('/').map(encodeURIComponent).join('/');
}

/**
 * Upload content to S3 bucket
 *
 * @param {string} key - S3 object key (path)
 * @param {string|Blob} content - Content to upload
 * @param {string} contentType - MIME type
 * @param {boolean} isPublic - Make object publicly readable
 * @returns {object} Response object
 */
function uploadToS3(key, content, contentType, isPublic = true) {
  // Debug logging can be removed later
  // Logger.log(`uploadToS3 called with: key=${key}, content=${content}, contentType=${contentType}`);

  if (content === undefined || content === null) {
    throw new Error('Content parameter is undefined or null');
  }

  const method = 'PUT';
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;
  const encodedKey = encodeS3Key(key);  // Encode the key for URL and signature
  const url = `https://${endpoint}/${bucket}/${encodedKey}`;

  // Convert content to bytes
  let payload;
  if (typeof content === 'string') {
    // Convert string to bytes using UTF-8 encoding
    payload = Utilities.newBlob(content).getBytes();
  } else if (content && typeof content.getBytes === 'function') {
    // Content is already a Blob
    payload = content.getBytes();
  } else if (content && Array.isArray(content)) {
    // Content is already bytes array
    payload = content;
  } else {
    throw new Error(`Invalid content type: ${typeof content}. Content value: ${content}`);
  }
  const payloadHash = sha256Hash(payload);

  // Prepare headers for signing - Host MUST be included for valid AWS signature
  const headersForSigning = {
    'Host': endpoint,  // Required by AWS Signature V4 spec
    'Content-Type': contentType,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': ''  // Will be filled by signRequest
  };

  if (isPublic) {
    headersForSigning['x-amz-acl'] = 'public-read';
  }

  // Generate AWS Signature V4
  const signedHeaders = signRequest(method, `/${bucket}/${encodedKey}`, headersForSigning, payload);

  // Remove Host header from the request headers (Apps Script sets it automatically)
  // But it was included in the signature calculation
  delete signedHeaders['Host'];

  // Make the request
  const options = {
    method: method,
    headers: signedHeaders,
    payload: payload,
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log(`✓ Uploaded to S3: ${key}`);
      return { success: true, key: key, url: url };
    } else {
      throw new Error(`S3 upload failed (${responseCode}): ${response.getContentText()}`);
    }
  } catch (error) {
    Logger.log(`✗ S3 upload error: ${error.message}`);
    throw error;
  }
}

/**
 * Delete object from S3
 *
 * @param {string} key - S3 object key to delete
 * @returns {object} Response object
 */
function deleteFromS3(key) {
  const method = 'DELETE';
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;
  const encodedKey = encodeS3Key(key);  // Encode the key for URL and signature
  const url = `https://${endpoint}/${bucket}/${encodedKey}`;

  const headersForSigning = {
    'Host': endpoint,  // Required by AWS Signature V4 spec
    'x-amz-content-sha256': sha256Hash(''),
    'x-amz-date': ''  // Will be filled by signRequest
  };

  const signedHeaders = signRequest(method, `/${bucket}/${encodedKey}`, headersForSigning, '');

  // Remove Host header from the request
  delete signedHeaders['Host'];

  const options = {
    method: method,
    headers: signedHeaders,
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log(`✓ Deleted from S3: ${key}`);
      return { success: true, key: key };
    } else {
      throw new Error(`S3 delete failed (${responseCode}): ${response.getContentText()}`);
    }
  } catch (error) {
    Logger.log(`✗ S3 delete error: ${error.message}`);
    throw error;
  }
}

/**
 * Sign AWS Signature Version 4 request
 *
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {object} headers - Request headers
 * @param {string|bytes} payload - Request payload
 * @returns {object} Signed headers
 */
function signRequest(method, path, headers, payload) {
  const accessKeyId = S3_CONFIG.accessKeyId;
  const secretAccessKey = S3_CONFIG.secretAccessKey;
  const region = S3_CONFIG.region;
  const service = 's3';
  const endpointHost = S3_CONFIG.endpoint;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 credentials not configured in Script Properties');
  }

  // Ensure host header is always present for canonical request
  const hasHostHeader = Object.keys(headers).some(key => key.toLowerCase() === 'host');
  if (!hasHostHeader) {
    headers['Host'] = endpointHost;
  }

  // Get current date/time
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate = Utilities.formatDate(now, 'UTC', 'yyyyMMdd\'T\'HHmmss\'Z\'');

  // Add required headers
  headers['x-amz-date'] = amzDate;

  // Normalize header keys for canonical string
  const normalizedHeaders = {};
  Object.keys(headers).forEach(key => {
    const lowerKey = key.toLowerCase();
    const value = headers[key];
    if (value === undefined || value === null) {
      return;
    }
    normalizedHeaders[lowerKey] = String(value).trim();
  });

  // Ensure host is present after normalization (just in case)
  if (!normalizedHeaders['host']) {
    normalizedHeaders['host'] = endpointHost;
  }

  const sortedHeaderKeys = Object.keys(normalizedHeaders).sort();

  const canonicalHeaders = sortedHeaderKeys
    .map(key => `${key}:${normalizedHeaders[key]}`)
    .join('\n') + '\n';

  const signedHeaders = sortedHeaderKeys.join(';');

  const payloadHash = typeof payload === 'string'
    ? sha256Hash(payload)
    : sha256Hash(payload);

  const canonicalRequest = [
    method,
    path,
    '', // Query string (empty for our use case)
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // Debug logging (remove after testing)
  Logger.log('=== AWS Signature V4 Debug ===');
  Logger.log('AccessKeyId: ' + accessKeyId);
  Logger.log('Region: ' + region);
  Logger.log('Service: ' + service);
  Logger.log('Date: ' + amzDate);
  Logger.log('Method: ' + method);
  Logger.log('Path: ' + path);
  Logger.log('Canonical Headers:\n' + canonicalHeaders);
  Logger.log('Signed Headers: ' + signedHeaders);
  Logger.log('Payload Hash: ' + payloadHash);
  Logger.log('Canonical Request:\n' + canonicalRequest);

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = sha256Hash(canonicalRequest);

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n');

  Logger.log('String to Sign:\n' + stringToSign);

  // Calculate signature
  const kDate = hmacSHA256(dateStamp, 'AWS4' + secretAccessKey);
  const kRegion = hmacSHA256(region, kDate);
  const kService = hmacSHA256(service, kRegion);
  const kSigning = hmacSHA256('aws4_request', kService);
  const signature = hmacSHA256(stringToSign, kSigning, true);

  Logger.log('Signature: ' + signature);

  // Add authorization header
  headers['Authorization'] = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  Logger.log('Authorization Header: ' + headers['Authorization']);

  return headers;
}

/**
 * Compute SHA256 hash (hex encoded)
 *
 * @param {string|bytes} data - Data to hash
 * @returns {string} Hex-encoded hash
 */
function sha256Hash(data) {
  const signature = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    data
  );
  return signature.map(byte => {
    const v = (byte < 0) ? 256 + byte : byte;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

/**
 * Compute HMAC-SHA256
 *
 * @param {string} message - Message to sign
 * @param {string|bytes} key - Signing key (string or byte array)
 * @param {boolean} hexOutput - Return hex string instead of bytes
 * @returns {bytes|string} Signature
 */
function hmacSHA256(message, key, hexOutput = false) {
  // Handle different key types for Apps Script compatibility
  let keyToUse;

  if (typeof key === 'string') {
    // Key is already a string, use as is
    keyToUse = key;
  } else if (Array.isArray(key)) {
    // Key is a byte array from previous HMAC operation
    keyToUse = key;
  } else {
    keyToUse = key;
  }

  const signature = Utilities.computeHmacSha256Signature(message, keyToUse);

  if (hexOutput) {
    return signature.map(byte => {
      const v = (byte < 0) ? 256 + byte : byte;
      return ('0' + v.toString(16)).slice(-2);
    }).join('');
  }

  return signature;
}

/**
 * Test S3 connection
 * Creates a test file and deletes it
 */
function testS3Connection() {
  Logger.log('Testing S3 connection...');

  // Check S3 config first
  if (!S3_CONFIG) {
    throw new Error('S3_CONFIG is not defined. Make sure config.gs is loaded.');
  }
  if (!S3_CONFIG.bucket || !S3_CONFIG.endpoint) {
    throw new Error('S3_CONFIG is incomplete. Check bucket and endpoint settings.');
  }
  if (!S3_CONFIG.accessKeyId || !S3_CONFIG.secretAccessKey) {
    throw new Error('S3 credentials not configured. Check Script Properties.');
  }

  try {
    // Upload test file
    const testKey = 'test/connection-test.txt';
    const testContent = `S3 connection test at ${new Date().toISOString()}`;

    Logger.log(`About to call uploadToS3 with testContent: "${testContent}"`);

    uploadToS3(testKey, testContent, 'text/plain', true);
    Logger.log('✓ Upload successful');

    // Delete test file
    deleteFromS3(testKey);
    Logger.log('✓ Delete successful');

    Logger.log('✓ S3 connection test PASSED');
    return true;
  } catch (error) {
    Logger.log(`✗ S3 connection test FAILED: ${error.message}`);
    throw error;
  }
}
