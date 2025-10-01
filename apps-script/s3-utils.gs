/**
 * S3 Utilities for Google Apps Script
 * Implements AWS Signature Version 4 for Pilvio S3 compatibility
 */

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
  const method = 'PUT';
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;
  const url = `https://${endpoint}/${bucket}/${key}`;

  // Convert content to blob if it's a string
  let blob;
  if (typeof content === 'string') {
    blob = Utilities.newBlob(content, contentType, key);
  } else {
    blob = content;
  }

  const payload = blob.getBytes();
  const payloadHash = sha256Hash(payload);

  // Prepare headers
  const headers = {
    'Host': endpoint,
    'Content-Type': contentType,
    'x-amz-content-sha256': payloadHash
  };

  if (isPublic) {
    headers['x-amz-acl'] = 'public-read';
  }

  // Add cache control for versioning
  headers['Cache-Control'] = 'public, max-age=86400'; // 24 hours

  // Generate AWS Signature V4
  const signedHeaders = signRequest(method, `/${bucket}/${key}`, headers, payload);

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
  const url = `https://${endpoint}/${bucket}/${key}`;

  const headers = {
    'Host': endpoint,
    'x-amz-content-sha256': sha256Hash('')
  };

  const signedHeaders = signRequest(method, `/${bucket}/${key}`, headers, '');

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

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 credentials not configured in Script Properties');
  }

  // Get current date/time
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate = Utilities.formatDate(now, 'UTC', 'yyyyMMdd\'T\'HHmmss\'Z\'');

  // Add required headers
  headers['x-amz-date'] = amzDate;

  // Create canonical request
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
    .join('\n') + '\n';

  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');

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

  // Calculate signature
  const kDate = hmacSHA256(dateStamp, 'AWS4' + secretAccessKey);
  const kRegion = hmacSHA256(region, kDate);
  const kService = hmacSHA256(service, kRegion);
  const kSigning = hmacSHA256('aws4_request', kService);
  const signature = hmacSHA256(stringToSign, kSigning, true);

  // Add authorization header
  headers['Authorization'] = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

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
 * @param {string|bytes} key - Signing key
 * @param {boolean} hexOutput - Return hex string instead of bytes
 * @returns {bytes|string} Signature
 */
function hmacSHA256(message, key, hexOutput = false) {
  const signature = Utilities.computeHmacSha256Signature(message, key);

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

  try {
    // Upload test file
    const testKey = 'test/connection-test.txt';
    const testContent = `S3 connection test at ${new Date().toISOString()}`;

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
