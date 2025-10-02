// Admin Routes
const express = require('express');
const router = express.Router();
const database = require('../services/database');
const emailService = require('../services/email');
const { login, logout, authenticateAdmin } = require('../middleware/auth');
const { loginLimiter, adminLimiter } = require('../middleware/rate-limit');

// Login endpoint
router.post('/login', loginLimiter, login);

// Logout endpoint
router.post('/logout', authenticateAdmin, logout);

// Get all submissions
router.get('/submissions', authenticateAdmin, adminLimiter, (req, res) => {
  try {
    const { type = 'all', limit = 50, offset = 0 } = req.query;

    let membership = [];
    let contact = [];

    if (type === 'all' || type === 'membership') {
      membership = database.getMembershipSubmissions(parseInt(limit), parseInt(offset));
    }

    if (type === 'all' || type === 'contact') {
      contact = database.getContactSubmissions(parseInt(limit), parseInt(offset));
    }

    // Combine and sort by date if getting all
    let submissions = [];
    if (type === 'all') {
      submissions = [...membership, ...contact]
        .map(s => ({ ...s, type: s.subject !== undefined ? 'contact' : 'membership' }))
        .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
        .slice(0, parseInt(limit));
    } else if (type === 'membership') {
      submissions = membership.map(s => ({ ...s, type: 'membership' }));
    } else {
      submissions = contact.map(s => ({ ...s, type: 'contact' }));
    }

    res.json({
      success: true,
      submissions,
      total: submissions.length
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Delete submission
router.delete('/submission/:type/:id', authenticateAdmin, adminLimiter, (req, res) => {
  try {
    const { type, id } = req.params;

    if (!['membership', 'contact'].includes(type)) {
      return res.status(400).json({ error: 'Invalid submission type' });
    }

    let result;
    if (type === 'membership') {
      result = database.deleteMembershipSubmission(parseInt(id));
    } else {
      result = database.deleteContactSubmission(parseInt(id));
    }

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    console.log(`Deleted ${type} submission ${id} by admin from IP:`, req.ip);

    res.json({
      success: true,
      message: 'Submission deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

// Get statistics
router.get('/statistics', authenticateAdmin, adminLimiter, (req, res) => {
  try {
    const stats = database.getStatistics();
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Export submissions as CSV
router.get('/export/:type', authenticateAdmin, adminLimiter, (req, res) => {
  try {
    const { type } = req.params;

    if (!['membership', 'contact'].includes(type)) {
      return res.status(400).json({ error: 'Invalid export type' });
    }

    const table = type === 'membership' ? 'membership_submissions' : 'contact_submissions';
    const data = database.exportToCSV(table);

    // Convert to CSV format
    if (data.length === 0) {
      return res.status(404).json({ error: 'No data to export' });
    }

    // Create CSV header
    const headers = Object.keys(data[0]);
    const csvHeader = headers.join(',');

    // Create CSV rows
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Escape values containing commas or quotes
        if (value && (value.toString().includes(',') || value.toString().includes('"'))) {
          return `"${value.toString().replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',');
    });

    // Combine header and rows
    const csv = [csvHeader, ...csvRows].join('\n');

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-submissions-${new Date().toISOString().split('T')[0]}.csv"`);

    res.send(csv);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Test email configuration
router.post('/test-email', authenticateAdmin, adminLimiter, async (req, res) => {
  try {
    const result = await emailService.sendTestEmail();
    res.json({
      success: true,
      message: 'Test email sent successfully',
      ...result
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      message: error.message
    });
  }
});

// Run maintenance tasks
router.post('/maintenance', authenticateAdmin, adminLimiter, (req, res) => {
  try {
    const result = database.runMaintenance();
    console.log('Maintenance completed:', result);
    res.json({
      success: true,
      message: 'Maintenance completed',
      cleaned: result
    });
  } catch (error) {
    console.error('Error running maintenance:', error);
    res.status(500).json({ error: 'Maintenance failed' });
  }
});

// Get unsynced submissions (for Google Sheets sync)
router.get('/unsynced/:type', authenticateAdmin, adminLimiter, (req, res) => {
  try {
    const { type } = req.params;

    if (!['membership', 'contact'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const table = type === 'membership' ? 'membership_submissions' : 'contact_submissions';
    const unsynced = database.getUnsyncedSubmissions(table);

    res.json({
      success: true,
      submissions: unsynced,
      count: unsynced.length
    });
  } catch (error) {
    console.error('Error fetching unsynced submissions:', error);
    res.status(500).json({ error: 'Failed to fetch unsynced submissions' });
  }
});

// Mark submission as synced
router.post('/mark-synced/:type/:id', authenticateAdmin, adminLimiter, (req, res) => {
  try {
    const { type, id } = req.params;

    if (!['membership', 'contact'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const table = type === 'membership' ? 'membership_submissions' : 'contact_submissions';
    database.markAsSynced(table, parseInt(id));

    res.json({
      success: true,
      message: 'Marked as synced'
    });
  } catch (error) {
    console.error('Error marking as synced:', error);
    res.status(500).json({ error: 'Failed to mark as synced' });
  }
});

module.exports = router;