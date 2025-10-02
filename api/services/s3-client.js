// S3 Client Service for monitoring
// This is a lightweight client just for reading S3 data
// Not for uploading (that's handled by Apps Script)

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

class S3Client {
  constructor() {
    this.endpoint = config.S3_ENDPOINT;
    this.bucket = config.S3_BUCKET;
    this.region = config.S3_REGION || 'eu-west-1';
    this.accessKeyId = config.S3_ACCESS_KEY_ID;
    this.secretAccessKey = config.S3_SECRET_ACCESS_KEY;
  }

  /**
   * Get a public object (no authentication needed)
   */
  async getPublicObject(key) {
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List objects in a path (if bucket allows listing)
   */
  async listObjects(prefix = '', maxKeys = 100) {
    // This would require signed requests
    // For now, we're only using public endpoints
    throw new Error('Listing objects requires AWS SDK - use public endpoints instead');
  }

  /**
   * Get sync metadata
   */
  async getSyncMetadata() {
    try {
      const version = await this.getPublicObject('metadata/version.json');
      return version;
    } catch (error) {
      console.error('Failed to get sync metadata:', error.message);
      return null;
    }
  }

  /**
   * Get calendar events
   */
  async getCalendarEvents() {
    try {
      const events = await this.getPublicObject('calendar/events.json');
      return events;
    } catch (error) {
      console.error('Failed to get calendar events:', error.message);
      return null;
    }
  }

  /**
   * Get gallery albums
   */
  async getGalleryAlbums() {
    try {
      const albums = await this.getPublicObject('gallery/albums.json');
      return albums;
    } catch (error) {
      console.error('Failed to get gallery albums:', error.message);
      return null;
    }
  }

  /**
   * Get sync logs for a specific date
   */
  async getSyncLogs(type, date = null) {
    const logDate = date || new Date().toISOString().split('T')[0];
    const logKey = `logs/${type}-sync-${logDate}.json`;

    try {
      const logs = await this.getPublicObject(logKey);
      return logs;
    } catch (error) {
      console.debug(`No logs found for ${type} on ${logDate}`);
      return null;
    }
  }

  /**
   * Check if S3 is accessible
   */
  async healthCheck() {
    try {
      const metadata = await this.getSyncMetadata();
      return {
        healthy: true,
        hasMetadata: !!metadata,
        endpoint: this.endpoint,
        bucket: this.bucket
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        endpoint: this.endpoint,
        bucket: this.bucket
      };
    }
  }
}

// Export singleton instance
module.exports = new S3Client();