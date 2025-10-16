// Gallery Sync Routes
// Endpoints for gallery synchronization from Google Drive to S3

const express = require('express');
const router = express.Router();
const gallerySync = require('../services/gallery-sync');
const { authenticateAdmin } = require('../middleware/auth');

/**
 * POST /api/gallery/sync
 * Trigger manual gallery sync
 * Requires authentication
 */
router.post('/sync', authenticateAdmin, async (req, res) => {
  try {
    console.log('🖼️  Manual gallery sync requested');

    const result = await gallerySync.forceSync();

    res.json({
      success: true,
      message: 'Gallery sync completed successfully',
      data: result
    });
  } catch (error) {
    console.error('Gallery sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Gallery sync failed',
      error: error.message
    });
  }
});

/**
 * GET /api/gallery/status
 * Get gallery sync status
 * Public endpoint
 */
router.get('/status', async (req, res) => {
  try {
    const status = await gallerySync.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Failed to get gallery status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get gallery status',
      error: error.message
    });
  }
});

/**
 * GET /api/gallery/health
 * Gallery sync health check
 * Public endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const status = await gallerySync.getStatus();

    const isHealthy = status.status !== 'error';

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

/**
 * POST /api/gallery/reset
 * Reset gallery database and force complete re-sync
 * Requires admin authentication
 */
router.post('/reset', authenticateAdmin, async (req, res) => {
  try {
    // First reset the database
    const resetResult = gallerySync.resetGallery();

    if (!resetResult.success) {
      return res.status(500).json(resetResult);
    }

    // Then trigger a new sync
    const syncResult = await gallerySync.forceSync();

    res.json({
      success: true,
      reset: resetResult,
      sync: syncResult
    });
  } catch (error) {
    console.error('Failed to reset gallery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset gallery',
      error: error.message
    });
  }
});

module.exports = router;
