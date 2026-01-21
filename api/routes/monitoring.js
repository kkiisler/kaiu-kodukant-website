// S3 Monitoring Routes
const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('../config');
const syncHistory = require('../services/syncHistory');
const database = require('../services/database');
const weatherService = require('../services/weather');

// Get S3 sync status with history
router.get('/status', async (req, res) => {
  try {
    const status = await getS3SyncStatus();

    // Get recent history and stats
    const calendarHistory = await syncHistory.getSyncHistory('calendar', 50);
    const galleryHistory = await syncHistory.getSyncHistory('gallery', 50);
    const calendarStats = await syncHistory.calculateStats('calendar', 24);
    const galleryStats = await syncHistory.calculateStats('gallery', 24);

    // Don't record status here - let the actual syncs record their own status
    // This prevents duplicate/incorrect entries in the history
    // await syncHistory.checkAndRecordStatus();

    res.json({
      success: true,
      ...status,
      history: {
        calendar: calendarHistory.slice(0, 10), // Send last 10 for status endpoint
        gallery: galleryHistory.slice(0, 10)
      },
      stats: {
        calendar: calendarStats,
        gallery: galleryStats
      }
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
      const data = albumsResponse.data;
      // Handle both old format (array) and new format ({ albums: [], metadata: {} })
      if (data) {
        if (Array.isArray(data)) {
          albumsCount = data.length;
          photosCount = data.reduce((total, album) =>
            total + (album.photos?.length || 0), 0);
        } else if (data.albums && Array.isArray(data.albums)) {
          albumsCount = data.albums.length;
          photosCount = data.metadata?.totalPhotos || data.albums.reduce((total, album) =>
            total + (album.photoCount || album.photos?.length || 0), 0);
        }
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

// Get detailed sync history
router.get('/history', async (req, res) => {
  try {
    const { type = 'all', limit = 100 } = req.query;

    if (type === 'all') {
      const history = await syncHistory.getSyncHistory(null, parseInt(limit));
      res.json({
        success: true,
        history
      });
    } else {
      const history = await syncHistory.getSyncHistory(type, parseInt(limit));
      res.json({
        success: true,
        history: {
          [type]: history
        }
      });
    }
  } catch (error) {
    console.error('Error fetching sync history:', error);
    res.status(500).json({
      error: 'Failed to fetch sync history',
      message: error.message
    });
  }
});

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

// Weather monitoring endpoints
router.get('/weather', async (req, res) => {
  try {
    // Get weather statistics
    const stats = database.getWeatherStatistics();

    // Get latest blurb
    const latestBlurb = database.getLatestWeatherBlurb();

    // Get last 20 blurbs for history
    const blurbs = database.getWeatherBlurbHistory(20);

    // Check cache status
    const cacheStatus = database.getWeatherCache('Kaiu, Raplamaa');

    // Calculate next update time
    const now = new Date();
    const hours = now.getHours();
    const nextHour = Math.ceil((hours + 1) / 4) * 4;
    const nextUpdate = new Date(now);

    if (nextHour >= 24) {
      nextUpdate.setDate(nextUpdate.getDate() + 1);
      nextUpdate.setHours(0, 0, 0, 0);
    } else {
      nextUpdate.setHours(nextHour, 0, 0, 0);
    }

    const timeUntilUpdate = nextUpdate - now;
    const hoursUntil = Math.floor(timeUntilUpdate / (1000 * 60 * 60));
    const minutesUntil = Math.floor((timeUntilUpdate % (1000 * 60 * 60)) / (1000 * 60));

    res.json({
      success: true,
      data: {
        statistics: {
          ...stats,
          lastGenerated: latestBlurb ? latestBlurb.created_at : null
        },
        latestBlurb: latestBlurb ? {
          id: latestBlurb.id,
          text: latestBlurb.blurb_text,
          temperature: latestBlurb.temperature,
          conditions: latestBlurb.conditions,
          icon: weatherService.getWeatherIcon(latestBlurb.conditions),
          windSpeed: latestBlurb.wind_speed,
          windDirection: latestBlurb.wind_direction,
          precipitation: latestBlurb.precipitation,
          createdAt: latestBlurb.created_at,
          model: latestBlurb.generation_model,
          tokens: latestBlurb.generation_tokens
        } : null,
        blurbHistory: blurbs.map(b => ({
          id: b.id,
          text: b.blurb_text,
          temperature: b.temperature,
          conditions: b.conditions,
          icon: weatherService.getWeatherIcon(b.conditions),
          createdAt: b.created_at
        })),
        cache: {
          hasValidCache: !!cacheStatus,
          expiresAt: cacheStatus?.expires_at || null,
          cachedAt: cacheStatus?.cached_at || null
        },
        nextUpdate: {
          time: nextUpdate.toISOString(),
          hoursUntil,
          minutesUntil,
          display: `${hoursUntil}h ${minutesUntil}m`
        },
        config: {
          openAiConfigured: !!process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'not configured',
          location: process.env.WEATHER_LOCATION_NAME || 'Kaiu, Raplamaa',
          updateInterval: process.env.WEATHER_UPDATE_INTERVAL || '14400'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching weather monitoring data:', error);
    res.status(500).json({
      error: 'Failed to fetch weather data',
      message: error.message
    });
  }
});

// Get weather API health check
router.get('/weather/health', async (req, res) => {
  try {
    const checks = {
      database: false,
      weatherApi: false,
      openAi: false,
      cache: false
    };

    // Check database
    try {
      const stats = database.getWeatherStatistics();
      checks.database = stats !== null;
    } catch (e) {
      console.error('Database check failed:', e);
    }

    // Check weather API
    try {
      const forecast = await weatherService.getForecast();
      checks.weatherApi = forecast !== null;
    } catch (e) {
      console.error('Weather API check failed:', e);
    }

    // Check OpenAI configuration
    checks.openAi = !!process.env.OPENAI_API_KEY;

    // Check cache
    try {
      const cache = database.getWeatherCache('Kaiu, Raplamaa');
      checks.cache = true; // Cache check successful even if empty
    } catch (e) {
      console.error('Cache check failed:', e);
    }

    const allHealthy = Object.values(checks).every(v => v === true);

    res.json({
      success: true,
      healthy: allHealthy,
      checks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking weather health:', error);
    res.status(500).json({
      error: 'Failed to check weather health',
      message: error.message
    });
  }
});

module.exports = router;