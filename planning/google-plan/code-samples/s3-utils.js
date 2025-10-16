/**
 * S3 Utilities for Node.js Backend
 * Comprehensive S3 operations wrapper with retry logic and error handling
 */

const AWS = require('aws-sdk');
const crypto = require('crypto');

class S3Utils {
  constructor(config) {
    // Initialize S3 client
    this.s3 = new AWS.S3({
      endpoint: config.endpoint || 'https://s3.pilw.io',
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region || 'eu-west-1',
      s3ForcePathStyle: true, // Required for custom endpoints like Pilvio
      signatureVersion: 'v4',
      maxRetries: 3,
      httpOptions: {
        timeout: 60000, // 60 seconds
        connectTimeout: 10000, // 10 seconds
      },
    });

    this.bucket = config.bucket;
    this.defaultACL = config.defaultACL || 'public-read';
  }

  /**
   * Upload JSON data to S3
   */
  async uploadJson(key, data, options = {}) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
      ACL: options.acl || this.defaultACL,
      CacheControl: options.cacheControl || 'public, max-age=300',
      Metadata: {
        'uploaded-at': new Date().toISOString(),
        'content-hash': this.calculateHash(JSON.stringify(data)),
      },
    };

    try {
      const result = await this.retryOperation(() => this.s3.putObject(params).promise());
      console.log(`✓ Uploaded JSON to S3: s3://${this.bucket}/${key}`);
      return {
        success: true,
        key,
        etag: result.ETag,
        url: this.getPublicUrl(key),
      };
    } catch (error) {
      console.error(`✗ Failed to upload JSON to ${key}:`, error);
      throw error;
    }
  }

  /**
   * Upload binary data (images, etc.) to S3
   */
  async uploadBinary(key, buffer, contentType, options = {}) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: options.acl || this.defaultACL,
      CacheControl: options.cacheControl || 'public, max-age=31536000', // 1 year for images
      Metadata: {
        'uploaded-at': new Date().toISOString(),
        'file-size': buffer.length.toString(),
        'content-hash': this.calculateHash(buffer),
      },
    };

    // Add content encoding if specified
    if (options.contentEncoding) {
      params.ContentEncoding = options.contentEncoding;
    }

    try {
      const result = await this.retryOperation(() => this.s3.putObject(params).promise());
      console.log(`✓ Uploaded binary to S3: s3://${this.bucket}/${key}`);
      return {
        success: true,
        key,
        etag: result.ETag,
        url: this.getPublicUrl(key),
        size: buffer.length,
      };
    } catch (error) {
      console.error(`✗ Failed to upload binary to ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get JSON data from S3
   */
  async getJson(key) {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      const result = await this.retryOperation(() => this.s3.getObject(params).promise());
      return JSON.parse(result.Body.toString());
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return null;
      }
      console.error(`✗ Failed to get JSON from ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if object exists in S3
   */
  async exists(key) {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      await this.s3.headObject(params).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get object metadata without downloading content
   */
  async getMetadata(key) {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      const result = await this.s3.headObject(params).promise();
      return {
        size: result.ContentLength,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata,
      };
    } catch (error) {
      if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete object from S3
   */
  async delete(key) {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      await this.retryOperation(() => this.s3.deleteObject(params).promise());
      console.log(`✓ Deleted from S3: s3://${this.bucket}/${key}`);
      return { success: true, key };
    } catch (error) {
      console.error(`✗ Failed to delete ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple objects from S3
   */
  async deleteMultiple(keys) {
    if (keys.length === 0) return { success: true, deleted: [] };

    const params = {
      Bucket: this.bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: false,
      },
    };

    try {
      const result = await this.retryOperation(() => this.s3.deleteObjects(params).promise());
      console.log(`✓ Deleted ${result.Deleted.length} objects from S3`);
      return {
        success: true,
        deleted: result.Deleted.map(d => d.Key),
        errors: result.Errors || [],
      };
    } catch (error) {
      console.error('✗ Failed to delete multiple objects:', error);
      throw error;
    }
  }

  /**
   * List objects with prefix
   */
  async listObjects(prefix, options = {}) {
    const params = {
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: options.maxKeys || 1000,
      Delimiter: options.delimiter,
    };

    if (options.continuationToken) {
      params.ContinuationToken = options.continuationToken;
    }

    try {
      const result = await this.retryOperation(() => this.s3.listObjectsV2(params).promise());
      return {
        objects: result.Contents || [],
        directories: result.CommonPrefixes || [],
        isTruncated: result.IsTruncated,
        continuationToken: result.NextContinuationToken,
      };
    } catch (error) {
      console.error(`✗ Failed to list objects with prefix ${prefix}:`, error);
      throw error;
    }
  }

  /**
   * Copy object within S3
   */
  async copy(sourceKey, destinationKey, options = {}) {
    const params = {
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
      ACL: options.acl || this.defaultACL,
      MetadataDirective: options.replaceMetadata ? 'REPLACE' : 'COPY',
    };

    if (options.metadata) {
      params.Metadata = options.metadata;
      params.MetadataDirective = 'REPLACE';
    }

    try {
      const result = await this.retryOperation(() => this.s3.copyObject(params).promise());
      console.log(`✓ Copied S3 object: ${sourceKey} -> ${destinationKey}`);
      return {
        success: true,
        sourceKey,
        destinationKey,
        etag: result.CopyObjectResult.ETag,
      };
    } catch (error) {
      console.error(`✗ Failed to copy ${sourceKey} to ${destinationKey}:`, error);
      throw error;
    }
  }

  /**
   * Generate presigned URL for temporary access
   */
  async getPresignedUrl(operation, key, expiresIn = 3600) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn,
    };

    try {
      const url = await this.s3.getSignedUrlPromise(operation, params);
      return url;
    } catch (error) {
      console.error(`✗ Failed to generate presigned URL for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Upload with multipart for large files
   */
  async uploadLargeFile(key, buffer, contentType, options = {}) {
    const partSize = 10 * 1024 * 1024; // 10MB parts
    const numParts = Math.ceil(buffer.length / partSize);

    if (numParts === 1) {
      // File is small enough for regular upload
      return this.uploadBinary(key, buffer, contentType, options);
    }

    console.log(`Starting multipart upload for ${key} (${numParts} parts)`);

    try {
      // Start multipart upload
      const multipartParams = {
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ACL: options.acl || this.defaultACL,
      };

      const multipart = await this.s3.createMultipartUpload(multipartParams).promise();
      const uploadId = multipart.UploadId;

      // Upload parts
      const uploadPromises = [];
      for (let i = 0; i < numParts; i++) {
        const start = i * partSize;
        const end = Math.min(start + partSize, buffer.length);
        const partBuffer = buffer.slice(start, end);

        const partParams = {
          Bucket: this.bucket,
          Key: key,
          PartNumber: i + 1,
          UploadId: uploadId,
          Body: partBuffer,
        };

        uploadPromises.push(
          this.retryOperation(() => this.s3.uploadPart(partParams).promise())
            .then(data => ({
              ETag: data.ETag,
              PartNumber: i + 1,
            }))
        );
      }

      const parts = await Promise.all(uploadPromises);

      // Complete multipart upload
      const completeParams = {
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      };

      await this.s3.completeMultipartUpload(completeParams).promise();

      console.log(`✓ Completed multipart upload for ${key}`);
      return {
        success: true,
        key,
        url: this.getPublicUrl(key),
        size: buffer.length,
      };

    } catch (error) {
      console.error(`✗ Multipart upload failed for ${key}:`, error);
      // Attempt to abort the multipart upload
      if (uploadId) {
        try {
          await this.s3.abortMultipartUpload({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
          }).promise();
        } catch (abortError) {
          console.error('Failed to abort multipart upload:', abortError);
        }
      }
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(prefix = '') {
    let totalSize = 0;
    let totalCount = 0;
    let continuationToken;

    do {
      const result = await this.listObjects(prefix, {
        continuationToken,
        maxKeys: 1000,
      });

      result.objects.forEach(obj => {
        totalSize += obj.Size || 0;
        totalCount++;
      });

      continuationToken = result.continuationToken;
    } while (continuationToken);

    return {
      totalFiles: totalCount,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2),
    };
  }

  /**
   * Sync local directory to S3 (useful for static assets)
   */
  async syncDirectory(localPath, s3Prefix, options = {}) {
    const fs = require('fs').promises;
    const path = require('path');

    async function* walkDirectory(dir) {
      const files = await fs.readdir(dir, { withFileTypes: true });

      for (const file of files) {
        const filePath = path.join(dir, file.name);

        if (file.isDirectory()) {
          if (!options.excludeDirs || !options.excludeDirs.includes(file.name)) {
            yield* walkDirectory(filePath);
          }
        } else {
          yield filePath;
        }
      }
    }

    const uploaded = [];
    const failed = [];

    for await (const filePath of walkDirectory(localPath)) {
      const relativePath = path.relative(localPath, filePath);
      const s3Key = path.join(s3Prefix, relativePath).replace(/\\/g, '/');

      try {
        const fileBuffer = await fs.readFile(filePath);
        const contentType = this.getContentType(filePath);

        await this.uploadBinary(s3Key, fileBuffer, contentType, options);
        uploaded.push(s3Key);
      } catch (error) {
        console.error(`Failed to sync ${filePath}:`, error.message);
        failed.push({ file: filePath, error: error.message });
      }
    }

    return {
      uploaded,
      failed,
      summary: {
        totalUploaded: uploaded.length,
        totalFailed: failed.length,
      },
    };
  }

  /**
   * Helper: Retry operation with exponential backoff
   */
  async retryOperation(operation, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on permanent errors
        if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
          throw error;
        }

        if (i < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, i), 10000);
          console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Helper: Calculate hash of data
   */
  calculateHash(data) {
    return crypto
      .createHash('md5')
      .update(typeof data === 'string' ? data : data.toString())
      .digest('hex');
  }

  /**
   * Helper: Get public URL for object
   */
  getPublicUrl(key) {
    return `https://${this.s3.endpoint.hostname || this.s3.endpoint}/${this.bucket}/${key}`;
  }

  /**
   * Helper: Determine content type from file extension
   */
  getContentType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();

    const contentTypes = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',

      // Documents
      json: 'application/json',
      pdf: 'application/pdf',
      xml: 'application/xml',

      // Web
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',

      // Text
      txt: 'text/plain',
      md: 'text/markdown',
      csv: 'text/csv',

      // Video
      mp4: 'video/mp4',
      webm: 'video/webm',

      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    };

    return contentTypes[ext] || 'application/octet-stream';
  }
}

// Export for use
module.exports = S3Utils;

// Example usage and testing
if (require.main === module) {
  (async () => {
    const s3Utils = new S3Utils({
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
    });

    // Test various operations
    console.log('Testing S3 utilities...\n');

    // Upload JSON
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Hello from S3Utils',
    };

    const uploadResult = await s3Utils.uploadJson('test/data.json', testData);
    console.log('Upload result:', uploadResult);

    // Check if exists
    const exists = await s3Utils.exists('test/data.json');
    console.log('File exists:', exists);

    // Get metadata
    const metadata = await s3Utils.getMetadata('test/data.json');
    console.log('Metadata:', metadata);

    // Read back JSON
    const readData = await s3Utils.getJson('test/data.json');
    console.log('Read data:', readData);

    // List objects
    const list = await s3Utils.listObjects('test/');
    console.log('Objects in test/:', list.objects.map(o => o.Key));

    // Get storage stats
    const stats = await s3Utils.getStorageStats();
    console.log('Storage stats:', stats);

    console.log('\n✓ All tests passed!');
  })().catch(console.error);
}