// S3 Monitoring Routes
const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('../config');

// Get S3 sync status
router.get('/status', async (req, res) => {
  try {
    const status = await getS3SyncStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Error fetching S3 status:', error);
    res.status(500).json({
      error: 'Failed to fetch sync status',
      message: error.message
    });
  }
});

// Get sync logs
router.get('/logs', async (req, res) => {
  try {
    const { type = 'all', limit = 10 } = req.query;
    const logs = await getS3Logs(type, parseInt(limit));
    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      error: 'Failed to fetch logs',
      message: error.message
    });
  }
});

// Helper function to get S3 sync status
async function getS3SyncStatus() {
  try {
    // Fetch version.json from S3
    const versionUrl = `${config.S3_ENDPOINT}/${config.S3_BUCKET}/metadata/version.json`;
    const versionResponse = await axios.get(versionUrl, { timeout: 5000 });
    const versionData = versionResponse.data;

    const now = new Date();
    // Handle both old structure (with objects) and new structure (with timestamps)
    const calendarLastSync = versionData.calendar
      ? (typeof versionData.calendar === 'number'
        ? new Date(versionData.calendar)
        : new Date(versionData.calendar.lastUpdated))
      : null;
    const galleryLastSync = versionData.gallery
      ? (typeof versionData.gallery === 'number'
        ? new Date(versionData.gallery)
        : new Date(versionData.gallery.lastUpdated))
      : null;

    // Calculate staleness in minutes
    const calendarStaleness = calendarLastSync
      ? Math.floor((now - calendarLastSync) / 60000)
      : null;
    const galleryStaleness = galleryLastSync
      ? Math.floor((now - galleryLastSync) / 60000)
      : null;

    // Determine status based on staleness
    const getStatus = (staleness) => {
      if (staleness === null) return 'unknown';
      if (staleness < 30) return 'ok';
      if (staleness < 60) return 'warning';
      return 'error';
    };

    // Try to fetch actual counts from S3 if available
    let eventsCount = 0;
    let albumsCount = 0;
    let photosCount = 0;

    try {
      // Try to get events count from events.json
      const eventsUrl = `${config.S3_ENDPOINT}/${config.S3_BUCKET}/calendar/events.json`;
      const eventsResponse = await axios.get(eventsUrl, { timeout: 3000 });
      if (eventsResponse.data && Array.isArray(eventsResponse.data)) {
        eventsCount = eventsResponse.data.length;
      }
    } catch (e) {
      console.log('Could not fetch events count:', e.message);
    }

    try {
      // Try to get gallery counts from albums.json
      const albumsUrl = `${config.S3_ENDPOINT}/${config.S3_BUCKET}/gallery/albums.json`;
      const albumsResponse = await axios.get(albumsUrl, { timeout: 3000 });
      if (albumsResponse.data && Array.isArray(albumsResponse.data)) {
        albumsCount = albumsResponse.data.length;
        photosCount = albumsResponse.data.reduce((total, album) =>
          total + (album.photos?.length || 0), 0);
      }
    } catch (e) {
      console.log('Could not fetch gallery counts:', e.message);
    }

    return {
      calendar: {
        lastSync: calendarLastSync ? calendarLastSync.toISOString() : null,
        status: getStatus(calendarStaleness),
        staleness: calendarStaleness,
        eventsCount: eventsCount
      },
      gallery: {
        lastSync: galleryLastSync ? galleryLastSync.toISOString() : null,
        status: getStatus(galleryStaleness),
        staleness: galleryStaleness,
        albumsCount: albumsCount,
        photosCount: photosCount
      },
      s3Storage: {
        endpoint: config.S3_ENDPOINT,
        bucket: config.S3_BUCKET
      }
    };
  } catch (error) {
    console.error('Error fetching S3 status:', error.message);

    // Return degraded status
    return {
      calendar: {
        lastSync: null,
        status: 'error',
        staleness: null,
        error: 'Could not fetch sync status'
      },
      gallery: {
        lastSync: null,
        status: 'error',
        staleness: null,
        error: 'Could not fetch sync status'
      },
      s3Storage: {
        endpoint: config.S3_ENDPOINT,
        bucket: config.S3_BUCKET,
        error: error.message
      }
    };
  }
}

// Helper function to get S3 logs
async function getS3Logs(type, limit) {
  try {
    const logs = [];
    const today = new Date().toISOString().split('T')[0];

    // Try to fetch today's logs
    if (type === 'all' || type === 'calendar') {
      try {
        const calendarLogUrl = `${config.S3_ENDPOINT}/${config.S3_BUCKET}/logs/calendar-sync-${today}.json`;
        const response = await axios.get(calendarLogUrl, { timeout: 5000 });
        if (response.data) {
          const calendarLogs = Array.isArray(response.data) ? response.data : [response.data];
          logs.push(...calendarLogs.map(log => ({ ...log, type: 'calendar' })));
        }
      } catch (err) {
        // Log file might not exist
        console.debug('Calendar log not found for today');
      }
    }

    if (type === 'all' || type === 'gallery') {
      try {
        const galleryLogUrl = `${config.S3_ENDPOINT}/${config.S3_BUCKET}/logs/gallery-sync-${today}.json`;
        const response = await axios.get(galleryLogUrl, { timeout: 5000 });
        if (response.data) {
          const galleryLogs = Array.isArray(response.data) ? response.data : [response.data];
          logs.push(...galleryLogs.map(log => ({ ...log, type: 'gallery' })));
        }
      } catch (err) {
        // Log file might not exist
        console.debug('Gallery log not found for today');
      }
    }

    // Sort by timestamp (newest first) and limit
    logs.sort((a, b) => new Date(b.timestamp || b.syncTime) - new Date(a.timestamp || a.syncTime));
    return logs.slice(0, limit);

  } catch (error) {
    console.error('Error fetching S3 logs:', error.message);
    return [];
  }
}

// Get detailed S3 storage info (optional)
router.get('/storage', async (req, res) => {
  try {
    // This would require AWS SDK to get actual storage metrics
    // For now, return basic info
    res.json({
      success: true,
      storage: {
        endpoint: config.S3_ENDPOINT,
        bucket: config.S3_BUCKET,
        region: config.S3_REGION,
        configured: !!(config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY),
        note: 'Detailed storage metrics require AWS SDK integration'
      }
    });
  } catch (error) {
    console.error('Error fetching storage info:', error);
    res.status(500).json({
      error: 'Failed to fetch storage info',
      message: error.message
    });
  }
});

module.exports = router;