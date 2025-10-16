// S3 Upload Service
// Handles uploading calendar and gallery data to S3 with AWS Signature V4
// Replaces Google Apps Script upload functionality

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

class S3UploadService {
  constructor() {
    this.endpoint = config.S3_ENDPOINT;
    this.bucket = config.S3_BUCKET;
    this.region = config.S3_REGION || 'eu-west-1';
    this.accessKeyId = config.S3_ACCESS_KEY_ID;
    this.secretAccessKey = config.S3_SECRET_ACCESS_KEY;
  }

  /**
   * Generate AWS Signature V4
   * @param {string} method - HTTP method (PUT, POST, etc.)
   * @param {string} path - S3 object path
   * @param {Object} headers - Request headers
   * @param {string} payload - Request body
   * @returns {Object} Signed headers
   */
  generateSignature(method, path, headers, payload = '') {
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

    // Canonical request
    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
    const canonicalUri = path;
    const canonicalQueryString = '';

    // Build canonical headers
    const canonicalHeaders = {
      'host': this.endpoint.replace(/^https?:\/\//, ''),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...headers
    };

    const sortedHeaders = Object.keys(canonicalHeaders).sort();
    const canonicalHeadersStr = sortedHeaders
      .map(key => `${key.toLowerCase()}:${canonicalHeaders[key]}`)
      .join('\n') + '\n';
    const signedHeaders = sortedHeaders.map(k => k.toLowerCase()).join(';');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeadersStr,
      signedHeaders,
      payloadHash
    ].join('\n');

    // String to sign
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    // Authorization header
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      'Authorization': authorization,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'host': canonicalHeaders.host,
      ...headers
    };
  }

  /**
   * Upload data to S3
   * @param {string} key - S3 object key (path)
   * @param {string|Buffer} data - Data to upload
   * @param {string} contentType - Content type (default: application/json)
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<Object>} Upload result
   */
  async uploadToS3(key, data, contentType = 'application/json', retries = 3) {
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    const path = `/${this.bucket}/${key}`;

    // Convert data to string if it's an object
    const payload = typeof data === 'string' ? data : JSON.stringify(data);

    const headers = {
      'Content-Type': contentType,
      'Content-Length': Buffer.byteLength(payload),
      'x-amz-acl': 'public-read'
    };

    const signedHeaders = this.generateSignature('PUT', path, headers, payload);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.put(url, payload, {
          headers: signedHeaders,
          timeout: 30000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });

        console.log(`✓ Uploaded to S3: ${key} (${Buffer.byteLength(payload)} bytes)`);

        return {
          success: true,
          key,
          url: `${this.endpoint}/${this.bucket}/${key}`,
          size: Buffer.byteLength(payload),
          attempt
        };
      } catch (error) {
        console.error(`✗ Upload attempt ${attempt}/${retries} failed for ${key}:`, error.message);

        if (attempt === retries) {
          throw new Error(`Failed to upload ${key} after ${retries} attempts: ${error.message}`);
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  /**
   * Upload JSON data to S3
   * @param {string} key - S3 object key
   * @param {Object} data - JSON data
   * @returns {Promise<Object>} Upload result
   */
  async uploadJSON(key, data) {
    return this.uploadToS3(key, data, 'application/json');
  }

  /**
   * Upload binary data to S3 (for images)
   * @param {string} key - S3 object key
   * @param {Buffer} buffer - Binary data
   * @param {string} contentType - MIME type
   * @returns {Promise<Object>} Upload result
   */
  async uploadBinary(key, buffer, contentType = 'image/jpeg') {
    return this.uploadToS3(key, buffer, contentType);
  }

  /**
   * Update version metadata file
   * @param {string} type - Sync type (calendar or gallery)
   * @returns {Promise<Object>} Upload result
   */
  async updateVersionFile(type) {
    const versionData = {
      lastSync: new Date().toISOString(),
      type,
      version: '1.0.0',
      source: 'node-backend'
    };

    return this.uploadJSON(`metadata/${type}-version.json`, versionData);
  }

  /**
   * Upload sync log
   * @param {string} type - Sync type (calendar or gallery)
   * @param {Object} logData - Log data
   * @returns {Promise<Object>} Upload result
   */
  async uploadSyncLog(type, logData) {
    const logDate = new Date().toISOString().split('T')[0];
    const logKey = `logs/${type}-sync-${logDate}.json`;

    const log = {
      timestamp: new Date().toISOString(),
      type,
      ...logData
    };

    return this.uploadJSON(logKey, log);
  }

  /**
   * Health check - verify S3 upload credentials
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const testKey = 'health/backend-check.json';
      const testData = {
        timestamp: new Date().toISOString(),
        source: 'node-backend',
        test: true
      };

      await this.uploadJSON(testKey, testData);

      return {
        healthy: true,
        endpoint: this.endpoint,
        bucket: this.bucket,
        canUpload: true
      };
    } catch (error) {
      return {
        healthy: false,
        endpoint: this.endpoint,
        bucket: this.bucket,
        canUpload: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new S3UploadService();
