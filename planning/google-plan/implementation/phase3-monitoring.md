# Phase 3: Monitoring & Admin Features Implementation Guide

## Overview
Enhance the sync system with comprehensive monitoring, admin controls, and alerting capabilities.

## Implementation Steps

### Step 1: Create Monitoring Service

**File: `api/services/monitoring/sync-monitor.js`**
```javascript
const database = require('../database');
const emailService = require('../email');
const axios = require('axios');

class SyncMonitor {
  constructor(config) {
    this.alertEmail = config.alertEmail;
    this.failureThreshold = config.failureThreshold || 3;
    this.stalenessThresholds = {
      calendar: (config.calendarStaleMinutes || 60) * 60 * 1000,
      gallery: (config.galleryStaleMinutes || 120) * 60 * 1000,
    };
    this.s3Endpoint = config.s3Endpoint;
    this.s3Bucket = config.s3Bucket;
  }

  async checkHealth() {
    const checks = {
      calendar: await this.checkComponentHealth('calendar'),
      gallery: await this.checkComponentHealth('gallery'),
      s3: await this.checkS3Health(),
      googleApis: await this.checkGoogleApisHealth(),
    };

    const overallHealth = Object.values(checks).every(c => c.healthy);

    return {
      healthy: overallHealth,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async checkComponentHealth(component) {
    const db = database.getDb();
    const state = db.prepare('SELECT * FROM sync_state WHERE component = ?').get(component);

    if (!state) {
      return {
        healthy: false,
        status: 'never_synced',
        message: `${component} has never been synced`,
      };
    }

    const lastSyncTime = new Date(state.last_sync);
    const timeSinceSync = Date.now() - lastSyncTime;
    const isStale = timeSinceSync > this.stalenessThresholds[component];

    if (state.failure_count >= this.failureThreshold) {
      return {
        healthy: false,
        status: 'failing',
        message: `${component} has failed ${state.failure_count} times`,
        lastSync: state.last_sync,
        lastError: JSON.parse(state.state_data || '{}').lastError,
      };
    }

    if (isStale) {
      return {
        healthy: false,
        status: 'stale',
        message: `${component} data is stale (last sync: ${state.last_sync})`,
        lastSync: state.last_sync,
        minutesSinceSync: Math.floor(timeSinceSync / 60000),
      };
    }

    return {
      healthy: true,
      status: 'healthy',
      lastSync: state.last_sync,
      lastSuccess: state.last_success,
      failureCount: state.failure_count,
    };
  }

  async checkS3Health() {
    try {
      const versionUrl = `${this.s3Endpoint}/${this.s3Bucket}/metadata/version.json`;
      const response = await axios.get(versionUrl, { timeout: 5000 });

      const data = response.data;
      const lastUpdated = new Date(data.lastUpdated);
      const age = Date.now() - lastUpdated;

      return {
        healthy: true,
        status: 'accessible',
        lastUpdated: data.lastUpdated,
        ageMinutes: Math.floor(age / 60000),
        versions: {
          calendar: data.calendar,
          gallery: data.gallery,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'unreachable',
        error: error.message,
      };
    }
  }

  async checkGoogleApisHealth() {
    try {
      // Check Google APIs status
      const calendarCheck = axios.get(
        'https://www.googleapis.com/calendar/v3/calendars/primary',
        { timeout: 5000 }
      ).then(() => true).catch(() => false);

      const driveCheck = axios.get(
        'https://www.googleapis.com/drive/v3/about',
        { timeout: 5000 }
      ).then(() => true).catch(() => false);

      const [calendarOk, driveOk] = await Promise.all([calendarCheck, driveCheck]);

      return {
        healthy: calendarOk && driveOk,
        calendar: calendarOk ? 'accessible' : 'unreachable',
        drive: driveOk ? 'accessible' : 'unreachable',
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'error',
        error: error.message,
      };
    }
  }

  async getMetrics() {
    const db = database.getDb();

    // Get sync history
    const syncHistory = db.prepare(`
      SELECT component, last_sync, last_success, failure_count
      FROM sync_state
      ORDER BY updated_at DESC
    `).all();

    // Get processed photos count
    const photoCount = db.prepare('SELECT COUNT(*) as count FROM processed_photos').get();

    // Get sync durations from logs (if available)
    const recentSyncs = db.prepare(`
      SELECT *
      FROM sync_logs
      WHERE timestamp > datetime('now', '-24 hours')
      ORDER BY timestamp DESC
      LIMIT 100
    `).all().catch(() => []);

    return {
      syncHistory,
      totalPhotosProcessed: photoCount?.count || 0,
      recentSyncs,
      timestamp: new Date().toISOString(),
    };
  }

  async sendAlert(subject, message, details = {}) {
    if (!this.alertEmail) {
      console.warn('No alert email configured');
      return;
    }

    const emailBody = `
${message}

Details:
${JSON.stringify(details, null, 2)}

Timestamp: ${new Date().toISOString()}
Environment: ${process.env.NODE_ENV || 'development'}

---
This is an automated alert from the MTÜ Kaiu Kodukant sync system.
    `;

    try {
      await emailService.sendEmail({
        to: this.alertEmail,
        subject: `[Kaiu Sync] ${subject}`,
        text: emailBody,
      });
      console.log(`Alert sent: ${subject}`);
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  async runHealthCheck() {
    const health = await this.checkHealth();

    if (!health.healthy) {
      const failedChecks = Object.entries(health.checks)
        .filter(([_, check]) => !check.healthy)
        .map(([name, check]) => ({ name, ...check }));

      await this.sendAlert(
        '⚠️ Sync System Health Check Failed',
        `One or more health checks have failed.`,
        { failedChecks }
      );
    }

    return health;
  }
}

module.exports = SyncMonitor;
```

### Step 2: Create Admin Dashboard Views

**File: `api/views/sync-dashboard.html`**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sync Dashboard - MTÜ Kaiu Kodukant</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
</head>
<body class="bg-gray-50">
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-8">Sync Dashboard</h1>

        <!-- Health Status Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-gray-700">Calendar Sync</h3>
                    <span id="calendar-status" class="px-2 py-1 text-xs rounded-full">Loading...</span>
                </div>
                <p id="calendar-last-sync" class="text-sm text-gray-500 mt-2">-</p>
                <button onclick="triggerSync('calendar')"
                        class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                    Trigger Sync
                </button>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-gray-700">Gallery Sync</h3>
                    <span id="gallery-status" class="px-2 py-1 text-xs rounded-full">Loading...</span>
                </div>
                <p id="gallery-last-sync" class="text-sm text-gray-500 mt-2">-</p>
                <div id="gallery-progress" class="hidden mt-2">
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div id="gallery-progress-bar" class="bg-blue-600 h-2 rounded-full" style="width: 0%"></div>
                    </div>
                    <p id="gallery-progress-text" class="text-xs text-gray-500 mt-1"></p>
                </div>
                <button onclick="triggerSync('gallery')"
                        class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                    Trigger Sync
                </button>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-gray-700">S3 Storage</h3>
                    <span id="s3-status" class="px-2 py-1 text-xs rounded-full">Loading...</span>
                </div>
                <p id="s3-info" class="text-sm text-gray-500 mt-2">-</p>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-gray-700">Google APIs</h3>
                    <span id="google-status" class="px-2 py-1 text-xs rounded-full">Loading...</span>
                </div>
                <p id="google-info" class="text-sm text-gray-500 mt-2">-</p>
            </div>
        </div>

        <!-- Sync Logs -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">Recent Sync Activity</h2>
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th class="px-4 py-2">Component</th>
                            <th class="px-4 py-2">Last Sync</th>
                            <th class="px-4 py-2">Status</th>
                            <th class="px-4 py-2">Details</th>
                            <th class="px-4 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="sync-logs" class="divide-y divide-gray-200">
                        <!-- Logs will be populated here -->
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Controls -->
        <div class="mt-8 bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">Controls</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onclick="refreshDashboard()"
                        class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                    Refresh Dashboard
                </button>
                <button onclick="runHealthCheck()"
                        class="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">
                    Run Health Check
                </button>
                <button onclick="viewLogs()"
                        class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
                    View Detailed Logs
                </button>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = '/api';
        let refreshInterval;

        async function loadDashboard() {
            try {
                const response = await axios.get(`${API_BASE}/sync/dashboard`);
                const data = response.data;

                // Update calendar status
                updateComponentStatus('calendar', data.calendar);

                // Update gallery status
                updateComponentStatus('gallery', data.gallery);

                // Update S3 status
                updateS3Status(data.s3);

                // Update Google APIs status
                updateGoogleStatus(data.googleApis);

                // Update logs
                updateSyncLogs(data.recentLogs);

            } catch (error) {
                console.error('Failed to load dashboard:', error);
            }
        }

        function updateComponentStatus(component, data) {
            const statusEl = document.getElementById(`${component}-status`);
            const lastSyncEl = document.getElementById(`${component}-last-sync`);

            if (data.status === 'healthy') {
                statusEl.className = 'px-2 py-1 text-xs rounded-full bg-green-100 text-green-800';
                statusEl.textContent = 'Healthy';
            } else if (data.status === 'syncing') {
                statusEl.className = 'px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800';
                statusEl.textContent = 'Syncing';
            } else if (data.status === 'failing') {
                statusEl.className = 'px-2 py-1 text-xs rounded-full bg-red-100 text-red-800';
                statusEl.textContent = 'Failing';
            } else {
                statusEl.className = 'px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800';
                statusEl.textContent = 'Unknown';
            }

            if (data.lastSync) {
                const date = new Date(data.lastSync);
                lastSyncEl.textContent = `Last sync: ${date.toLocaleString()}`;
            }

            // Update gallery progress if syncing
            if (component === 'gallery' && data.progress) {
                const progressEl = document.getElementById('gallery-progress');
                const progressBar = document.getElementById('gallery-progress-bar');
                const progressText = document.getElementById('gallery-progress-text');

                progressEl.classList.remove('hidden');
                const percent = (data.progress.current / data.progress.total) * 100;
                progressBar.style.width = `${percent}%`;
                progressText.textContent = `${data.progress.current} / ${data.progress.total} albums`;
            }
        }

        function updateS3Status(data) {
            const statusEl = document.getElementById('s3-status');
            const infoEl = document.getElementById('s3-info');

            if (data?.healthy) {
                statusEl.className = 'px-2 py-1 text-xs rounded-full bg-green-100 text-green-800';
                statusEl.textContent = 'Connected';
                infoEl.textContent = `Updated: ${data.ageMinutes} min ago`;
            } else {
                statusEl.className = 'px-2 py-1 text-xs rounded-full bg-red-100 text-red-800';
                statusEl.textContent = 'Error';
                infoEl.textContent = data?.error || 'Connection failed';
            }
        }

        function updateGoogleStatus(data) {
            const statusEl = document.getElementById('google-status');
            const infoEl = document.getElementById('google-info');

            if (data?.healthy) {
                statusEl.className = 'px-2 py-1 text-xs rounded-full bg-green-100 text-green-800';
                statusEl.textContent = 'Available';
                infoEl.textContent = 'All APIs responding';
            } else {
                statusEl.className = 'px-2 py-1 text-xs rounded-full bg-red-100 text-red-800';
                statusEl.textContent = 'Issues';
                infoEl.textContent = 'Some APIs unavailable';
            }
        }

        function updateSyncLogs(logs) {
            const tbody = document.getElementById('sync-logs');
            tbody.innerHTML = '';

            if (!logs || logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No recent sync activity</td></tr>';
                return;
            }

            logs.forEach(log => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-4 py-2 font-medium">${log.component}</td>
                    <td class="px-4 py-2">${new Date(log.timestamp).toLocaleString()}</td>
                    <td class="px-4 py-2">
                        <span class="px-2 py-1 text-xs rounded-full ${
                            log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }">
                            ${log.success ? 'Success' : 'Failed'}
                        </span>
                    </td>
                    <td class="px-4 py-2 text-xs">${log.details || '-'}</td>
                    <td class="px-4 py-2">
                        <button onclick="viewLogDetails('${log.id}')"
                                class="text-blue-600 hover:text-blue-800 text-xs">
                            View
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        async function triggerSync(component) {
            try {
                const response = await axios.post(
                    `${API_BASE}/sync/${component}/trigger`,
                    {},
                    { headers: { Authorization: `Bearer ${getAuthToken()}` } }
                );
                alert(`${component} sync triggered successfully`);
                await loadDashboard();
            } catch (error) {
                alert(`Failed to trigger ${component} sync: ${error.message}`);
            }
        }

        async function runHealthCheck() {
            try {
                const response = await axios.post(
                    `${API_BASE}/sync/health-check`,
                    {},
                    { headers: { Authorization: `Bearer ${getAuthToken()}` } }
                );
                alert('Health check completed. Check your email for any alerts.');
                await loadDashboard();
            } catch (error) {
                alert(`Health check failed: ${error.message}`);
            }
        }

        function refreshDashboard() {
            loadDashboard();
        }

        function viewLogs() {
            window.location.href = '/admin/sync/logs';
        }

        function viewLogDetails(logId) {
            window.open(`/admin/sync/logs/${logId}`, '_blank');
        }

        function getAuthToken() {
            return localStorage.getItem('adminToken') || '';
        }

        // Auto-refresh every 30 seconds
        function startAutoRefresh() {
            refreshInterval = setInterval(loadDashboard, 30000);
        }

        function stopAutoRefresh() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        }

        // Load dashboard on page load
        document.addEventListener('DOMContentLoaded', () => {
            loadDashboard();
            startAutoRefresh();
        });

        // Stop auto-refresh when page is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAutoRefresh();
            } else {
                loadDashboard();
                startAutoRefresh();
            }
        });
    </script>
</body>
</html>
```

### Step 3: Add Dashboard Routes

**File: `api/routes/sync-dashboard.js`**
```javascript
const express = require('express');
const router = express.Router();
const path = require('path');
const SyncMonitor = require('../services/monitoring/sync-monitor');
const { authenticateAdmin } = require('../middleware/auth');
const database = require('../services/database');

// Initialize monitor
const monitor = new SyncMonitor({
  alertEmail: process.env.SYNC_ALERT_EMAIL,
  failureThreshold: parseInt(process.env.SYNC_FAILURE_THRESHOLD) || 3,
  calendarStaleMinutes: 60,
  galleryStaleMinutes: 120,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Bucket: process.env.S3_BUCKET,
});

// Serve dashboard HTML
router.get('/', authenticateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/sync-dashboard.html'));
});

// Dashboard API endpoint
router.get('/api/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const health = await monitor.checkHealth();
    const metrics = await monitor.getMetrics();

    // Get recent logs
    const db = database.getDb();
    const recentLogs = db.prepare(`
      SELECT * FROM sync_logs
      WHERE timestamp > datetime('now', '-24 hours')
      ORDER BY timestamp DESC
      LIMIT 20
    `).all();

    res.json({
      ...health.checks,
      metrics,
      recentLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Health check endpoint
router.post('/api/health-check', authenticateAdmin, async (req, res) => {
  try {
    const health = await monitor.runHealthCheck();
    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Get detailed metrics
router.get('/api/metrics', authenticateAdmin, async (req, res) => {
  try {
    const metrics = await monitor.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Get sync logs
router.get('/api/logs', authenticateAdmin, async (req, res) => {
  try {
    const { component, limit = 100, offset = 0 } = req.query;

    const db = database.getDb();
    let query = 'SELECT * FROM sync_logs';
    const params = [];

    if (component) {
      query += ' WHERE component = ?';
      params.push(component);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const logs = db.prepare(query).all(...params);
    res.json({ logs, total: logs.length });
  } catch (error) {
    console.error('Logs error:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

module.exports = router;
```

### Step 4: Add Logging System

**Add to database schema:**
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT,
    details TEXT,
    duration INTEGER,
    success BOOLEAN,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_sync_logs_component ON sync_logs(component);
  CREATE INDEX IF NOT EXISTS idx_sync_logs_timestamp ON sync_logs(timestamp);
`);
```

### Step 5: Setup Monitoring Cron Jobs

**In `api/server.js`:**
```javascript
const SyncMonitor = require('./services/monitoring/sync-monitor');

// Initialize monitor
const monitor = new SyncMonitor({
  alertEmail: process.env.SYNC_ALERT_EMAIL,
  failureThreshold: parseInt(process.env.SYNC_FAILURE_THRESHOLD) || 3,
  calendarStaleMinutes: 60,
  galleryStaleMinutes: 120,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Bucket: process.env.S3_BUCKET,
});

// Health check every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('Running health check...');
  try {
    await monitor.runHealthCheck();
  } catch (error) {
    console.error('Health check failed:', error);
  }
});

// Add dashboard routes
const syncDashboardRouter = require('./routes/sync-dashboard');
app.use('/admin/sync', syncDashboardRouter);
```

### Step 6: Environment Variables

**Add to `.env`:**
```env
# Monitoring Configuration
SYNC_ALERT_EMAIL=kaur.kiisler@gmail.com
SYNC_FAILURE_THRESHOLD=3
```

## Testing

### Test Monitoring
```bash
# Check health status
curl http://localhost:3000/api/sync/health

# Run health check manually
curl -X POST http://localhost:3000/admin/sync/api/health-check \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# View metrics
curl http://localhost:3000/admin/sync/api/metrics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Test Dashboard
1. Navigate to http://localhost:3000/admin/sync
2. Login with admin credentials
3. Verify all status cards show correct information
4. Test sync trigger buttons
5. Verify auto-refresh works

## Deployment Checklist

- [ ] Add sync_logs table to database
- [ ] Deploy monitoring service
- [ ] Add dashboard routes
- [ ] Configure alert email
- [ ] Test dashboard access
- [ ] Verify health checks run
- [ ] Test email alerts
- [ ] Monitor for 24 hours

## Alert Conditions

The system will send email alerts when:
1. Any sync component fails 3+ times consecutively
2. Calendar data is older than 60 minutes
3. Gallery data is older than 120 minutes
4. S3 is unreachable
5. Google APIs are down

## Dashboard Features

- **Real-time Status**: Live health status for all components
- **Manual Controls**: Trigger syncs on-demand
- **Progress Tracking**: See gallery sync progress
- **Log Viewer**: View recent sync activity
- **Metrics**: Track sync performance over time
- **Health Checks**: Run comprehensive system checks
- **Auto-refresh**: Dashboard updates every 30 seconds

## Success Metrics

- Dashboard loads in < 2 seconds
- Health checks complete in < 10 seconds
- Alerts sent within 5 minutes of issues
- All components monitored effectively
- Clear visibility into system state

---

*Phase 3 Implementation Guide v1.0*
*Estimated Time: 2-3 hours*