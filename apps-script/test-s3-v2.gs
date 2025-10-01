/**
 * Test with AWS Signature Version 2 (older, simpler)
 * Some Ceph installations prefer this
 */

/**
 * AWS Signature V2 PUT test
 */
function testS3V2Put() {
  Logger.log('=== S3 SIGNATURE V2 TEST ===');

  const accessKeyId = S3_CONFIG.accessKeyId;
  const secretAccessKey = S3_CONFIG.secretAccessKey;
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;
  const testKey = 'test.txt';

  const method = 'PUT';
  const contentType = 'text/plain';
  const content = 'test content';
  const date = new Date().toUTCString();

  // Signature V2 uses different string to sign
  const resource = `/${bucket}/${testKey}`;
  const stringToSign = [
    method,
    '', // Content-MD5 (optional)
    contentType,
    date,
    resource
  ].join('\n');

  Logger.log('String to Sign (V2):\n' + stringToSign);

  // Sign with HMAC-SHA1 for V2
  const signature = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1,
    stringToSign,
    secretAccessKey
  );

  // Convert to base64
  const signatureBase64 = Utilities.base64Encode(signature);

  Logger.log('Signature (Base64): ' + signatureBase64);

  // Create authorization header for V2
  const authHeader = `AWS ${accessKeyId}:${signatureBase64}`;

  const headers = {
    'Authorization': authHeader,
    'Date': date,
    'Content-Type': contentType
  };

  const url = `https://${endpoint}/${bucket}/${testKey}`;

  const options = {
    method: method,
    headers: headers,
    payload: content,
    muteHttpExceptions: true
  };

  Logger.log('URL: ' + url);
  Logger.log('Headers: ' + JSON.stringify(headers));

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response Code: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('✓ SUCCESS with Signature V2!');
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
 * Test with presigned URL approach
 */
function testPresignedUrl() {
  Logger.log('=== PRESIGNED URL TEST ===');

  const accessKeyId = S3_CONFIG.accessKeyId;
  const secretAccessKey = S3_CONFIG.secretAccessKey;
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;
  const region = S3_CONFIG.region;
  const testKey = 'test.txt';

  const method = 'PUT';
  const now = new Date();
  const amzDate = Utilities.formatDate(now, 'UTC', 'yyyyMMdd\'T\'HHmmss\'Z\'');
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const expires = 3600; // 1 hour

  // Create canonical query string for presigned URL
  const credential = `${accessKeyId}/${dateStamp}/${region}/s3/aws4_request`;
  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expires.toString(),
    'X-Amz-SignedHeaders': 'host'
  };

  // Sort and encode query parameters
  const sortedParams = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedParams
    .map(key => `${key}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  // Create canonical request for presigned URL
  const canonicalRequest = [
    method,
    `/${bucket}/${testKey}`,
    canonicalQueryString,
    `host:${endpoint}\n`,
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  Logger.log('Canonical Request:\n' + canonicalRequest);

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
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
  const kService = hmacSHA256('s3', kRegion);
  const kSigning = hmacSHA256('aws4_request', kService);
  const signature = hmacSHA256(stringToSign, kSigning, true);

  Logger.log('Signature: ' + signature);

  // Build presigned URL
  const presignedUrl = `https://${endpoint}/${bucket}/${testKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

  Logger.log('Presigned URL: ' + presignedUrl);

  // Use the presigned URL
  const options = {
    method: method,
    payload: 'test content',
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(presignedUrl, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response Code: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('✓ SUCCESS with presigned URL!');
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
 * Test basic auth if supported
 */
function testBasicAuth() {
  Logger.log('=== BASIC AUTH TEST ===');

  const accessKeyId = S3_CONFIG.accessKeyId;
  const secretAccessKey = S3_CONFIG.secretAccessKey;
  const bucket = S3_CONFIG.bucket;
  const endpoint = S3_CONFIG.endpoint;

  // Try basic auth (some S3 gateways support this)
  const auth = Utilities.base64Encode(`${accessKeyId}:${secretAccessKey}`);

  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'text/plain'
  };

  const url = `https://${endpoint}/${bucket}/test.txt`;

  const options = {
    method: 'PUT',
    headers: headers,
    payload: 'test content',
    muteHttpExceptions: true
  };

  Logger.log('URL: ' + url);

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response Code: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('✓ SUCCESS with basic auth!');
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