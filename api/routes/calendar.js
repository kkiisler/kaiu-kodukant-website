// Calendar Sync Routes
// Endpoints for calendar synchronization from Google Calendar to S3

const express = require('express');
const router = express.Router();
const calendarSync = require('../services/calendar-sync');
const { authenticateAdmin } = require('../middleware/auth');

/**
 * POST /api/calendar/sync
 * Trigger manual calendar sync
 * Requires authentication
 */
router.post('/sync', authenticateAdmin, async (req, res) => {
  try {
    console.log('📅 Manual calendar sync requested');

    const result = await calendarSync.forceSync();

    res.json({
      success: true,
      message: 'Calendar sync completed successfully',
      data: result
    });
  } catch (error) {
    console.error('Calendar sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Calendar sync failed',
      error: error.message
    });
  }
});

/**
 * GET /api/calendar/status
 * Get calendar sync status
 * Public endpoint
 */
router.get('/status', async (req, res) => {
  try {
    const status = await calendarSync.getSyncStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Failed to get calendar status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get calendar status',
      error: error.message
    });
  }
});

/**
 * GET /api/calendar/health
 * Calendar sync health check
 * Public endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const status = await calendarSync.getSyncStatus();

    const isHealthy = status.synced && !status.isStale;

    res.status(isHealthy ? 200 : 503).json({
      healthy: isHealthy,
      status: status
    });
  } catch (error) {
    res.status(503).json({
      healthy: false,
      error: error.message
    });
  }
});

module.exports = router;
