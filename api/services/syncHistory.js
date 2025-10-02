const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const config = require('../config');

// Store sync history in a local file for persistence
const HISTORY_FILE = path.join(process.cwd(), 'data', 'sync-history.json');
const MAX_HISTORY_ENTRIES = 500; // Keep last 500 sync attempts
const HISTORY_RETENTION_DAYS = 7; // Keep 7 days of history

/**
 * Initialize sync history storage
 */
async function initSyncHistory() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(HISTORY_FILE);
    await fs.mkdir(dataDir, { recursive: true });

    // Load existing history or create new
    try {
      await fs.access(HISTORY_FILE);
    } catch {
      // File doesn't exist, create it
      await fs.writeFile(HISTORY_FILE, JSON.stringify({ calendar: [], gallery: [] }));
    }
  } catch (error) {
    console.error('Error initializing sync history:', error);
  }
}

/**
 * Record a sync event
 * @param {string} type - 'calendar' or 'gallery'
 * @param {Object} data - Sync data including status, counts, errors
 */
async function recordSyncEvent(type, data) {
  try {
    const history = await getSyncHistory();

    const event = {
      timestamp: new Date().toISOString(),
      status: data.status || 'unknown',
      eventsCount: data.eventsCount || 0,
      albumsCount: data.albumsCount || 0,
      photosCount: data.photosCount || 0,
      duration: data.duration || null,
      error: data.error || null,
      source: data.source || 'monitor' // 'monitor', 'trigger', 'manual'
    };

    // Add to appropriate history array
    if (!history[type]) {
      history[type] = [];
    }
    history[type].unshift(event);

    // Trim old entries
    history[type] = trimHistory(history[type]);

    // Save to file
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));

    return event;
  } catch (error) {
    console.error('Error recording sync event:', error);
    return null;
  }
}

/**
 * Get sync history
 * @param {string} type - Optional: 'calendar', 'gallery', or null for all
 * @param {number} limit - Maximum number of entries to return
 */
async function getSyncHistory(type = null, limit = 100) {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf8');
    const history = JSON.parse(data);

    if (type && history[type]) {
      return history[type].slice(0, limit);
    }

    // Return limited history for all types
    return {
      calendar: (history.calendar || []).slice(0, limit),
      gallery: (history.gallery || []).slice(0, limit)
    };
  } catch (error) {
    console.error('Error reading sync history:', error);
    return type ? [] : { calendar: [], gallery: [] };
  }
}

/**
 * Trim history to keep only recent entries
 */
function trimHistory(history) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - HISTORY_RETENTION_DAYS);

  return history
    .filter(entry => new Date(entry.timestamp) > cutoffDate)
    .slice(0, MAX_HISTORY_ENTRIES);
}

/**
 * Check current S3 status and record it
 */
async function checkAndRecordStatus() {
  try {
    // Check calendar status
    try {
      const versionUrl = `${config.S3_ENDPOINT}/${config.S3_BUCKET}/metadata/version.json`;
      const versionResponse = await axios.get(versionUrl, { timeout: 5000 });
      const versionData = versionResponse.data;

      // Check calendar
      if (versionData.calendar) {
        const lastSync = typeof versionData.calendar === 'number'
          ? new Date(versionData.calendar)
          : new Date(versionData.calendar.lastUpdated);

        const staleness = Math.floor((new Date() - lastSync) / 60000);

        // Fetch events count
        let eventsCount = 0;
        try {
          const eventsResponse = await axios.get(
            `${config.S3_ENDPOINT}/${config.S3_BUCKET}/calendar/events.json`,
            { timeout: 3000 }
          );
          if (eventsResponse.data && Array.isArray(eventsResponse.data)) {
            eventsCount = eventsResponse.data.length;
          }
        } catch (e) {
          // Ignore
        }

        await recordSyncEvent('calendar', {
          status: staleness < 30 ? 'success' : staleness < 60 ? 'warning' : 'error',
          eventsCount,
          source: 'monitor'
        });
      }

      // Check gallery
      if (versionData.gallery) {
        const lastSync = typeof versionData.gallery === 'number'
          ? new Date(versionData.gallery)
          : new Date(versionData.gallery.lastUpdated);

        const staleness = Math.floor((new Date() - lastSync) / 60000);

        // Fetch counts
        let albumsCount = 0;
        let photosCount = 0;
        try {
          const albumsResponse = await axios.get(
            `${config.S3_ENDPOINT}/${config.S3_BUCKET}/gallery/albums.json`,
            { timeout: 3000 }
          );
          if (albumsResponse.data && Array.isArray(albumsResponse.data)) {
            albumsCount = albumsResponse.data.length;
            photosCount = albumsResponse.data.reduce((sum, album) => sum + (album.photos?.length || 0), 0);
          }
        } catch (e) {
          // Ignore
        }

        await recordSyncEvent('gallery', {
          status: staleness < 30 ? 'success' : staleness < 60 ? 'warning' : 'error',
          albumsCount,
          photosCount,
          source: 'monitor'
        });
      }
    } catch (error) {
      console.error('Error checking S3 status:', error.message);
    }
  } catch (error) {
    console.error('Error in checkAndRecordStatus:', error);
  }
}

/**
 * Calculate statistics from history
 */
async function calculateStats(type, hours = 24) {
  const history = await getSyncHistory(type, 200);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const recentHistory = history.filter(entry => new Date(entry.timestamp) > cutoff);

  if (recentHistory.length === 0) {
    return {
      totalSyncs: 0,
      successRate: 0,
      averageInterval: null,
      lastSuccess: null,
      consecutiveFailures: 0
    };
  }

  const successful = recentHistory.filter(e => e.status === 'success').length;
  const successRate = Math.round((successful / recentHistory.length) * 100);

  // Calculate average interval between syncs
  let averageInterval = null;
  if (recentHistory.length > 1) {
    const intervals = [];
    for (let i = 1; i < recentHistory.length; i++) {
      const interval = new Date(recentHistory[i - 1].timestamp) - new Date(recentHistory[i].timestamp);
      intervals.push(interval);
    }
    averageInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length / 60000); // in minutes
  }

  // Find last success
  const lastSuccess = recentHistory.find(e => e.status === 'success');

  // Count consecutive failures
  let consecutiveFailures = 0;
  for (const entry of history) {
    if (entry.status !== 'success') {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  return {
    totalSyncs: recentHistory.length,
    successRate,
    averageInterval,
    lastSuccess: lastSuccess ? lastSuccess.timestamp : null,
    consecutiveFailures
  };
}

// Initialize on module load
initSyncHistory().catch(console.error);

// Check status every 5 minutes
setInterval(() => {
  checkAndRecordStatus().catch(console.error);
}, 5 * 60 * 1000);

module.exports = {
  recordSyncEvent,
  getSyncHistory,
  calculateStats,
  checkAndRecordStatus
};