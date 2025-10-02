// SQLite Database Service
const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

let db;

const initialize = async () => {
  try {
    // Create database connection
    const dbPath = config.DATABASE_PATH;
    db = new Database(dbPath, { verbose: console.log });

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create tables
    createTables();

    // Create indexes
    createIndexes();

    console.log('Database initialized at:', dbPath);
    return db;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

const createTables = () => {
  // Membership submissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS membership_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      recaptcha_score REAL,
      ip_address TEXT,
      user_agent TEXT,
      synced_to_sheets BOOLEAN DEFAULT 0,
      synced_at DATETIME
    )
  `);

  // Contact submissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      recaptcha_score REAL,
      ip_address TEXT,
      user_agent TEXT,
      synced_to_sheets BOOLEAN DEFAULT 0,
      synced_at DATETIME
    )
  `);

  // Rate limits table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER DEFAULT 1,
      reset_at DATETIME
    )
  `);

  // Admin sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      ip_address TEXT
    )
  `);

  // Email rate limits table (separate from IP rate limits)
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_rate_limits (
      email TEXT PRIMARY KEY,
      last_submission DATETIME DEFAULT CURRENT_TIMESTAMP,
      submission_count INTEGER DEFAULT 1
    )
  `);
};

const createIndexes = () => {
  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_membership_email ON membership_submissions(email);
    CREATE INDEX IF NOT EXISTS idx_membership_submitted ON membership_submissions(submitted_at);
    CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions(email);
    CREATE INDEX IF NOT EXISTS idx_contact_submitted ON contact_submissions(submitted_at);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at);
  `);
};

// Form submission functions
const addMembershipSubmission = (data) => {
  const stmt = db.prepare(`
    INSERT INTO membership_submissions (name, email, recaptcha_score, ip_address, user_agent)
    VALUES (@name, @email, @recaptcha_score, @ip_address, @user_agent)
  `);

  const result = stmt.run(data);
  return result.lastInsertRowid;
};

const addContactSubmission = (data) => {
  const stmt = db.prepare(`
    INSERT INTO contact_submissions (name, email, subject, message, recaptcha_score, ip_address, user_agent)
    VALUES (@name, @email, @subject, @message, @recaptcha_score, @ip_address, @user_agent)
  `);

  const result = stmt.run(data);
  return result.lastInsertRowid;
};

// Get submissions with pagination
const getMembershipSubmissions = (limit = 50, offset = 0) => {
  const stmt = db.prepare(`
    SELECT * FROM membership_submissions
    ORDER BY submitted_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset);
};

const getContactSubmissions = (limit = 50, offset = 0) => {
  const stmt = db.prepare(`
    SELECT * FROM contact_submissions
    ORDER BY submitted_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset);
};

// Delete submissions
const deleteMembershipSubmission = (id) => {
  const stmt = db.prepare('DELETE FROM membership_submissions WHERE id = ?');
  return stmt.run(id);
};

const deleteContactSubmission = (id) => {
  const stmt = db.prepare('DELETE FROM contact_submissions WHERE id = ?');
  return stmt.run(id);
};

// Rate limiting functions
const checkEmailRateLimit = (email) => {
  const stmt = db.prepare(`
    SELECT * FROM email_rate_limits
    WHERE email = ?
    AND datetime(last_submission) > datetime('now', '-1 hour')
  `);

  const record = stmt.get(email.toLowerCase());

  if (record) {
    // Check if they've exceeded the limit
    return {
      allowed: false,
      nextAllowedTime: new Date(Date.parse(record.last_submission) + 60 * 60 * 1000)
    };
  }

  return { allowed: true };
};

const updateEmailRateLimit = (email) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO email_rate_limits (email, last_submission, submission_count)
    VALUES (?, datetime('now'),
      COALESCE((SELECT submission_count + 1 FROM email_rate_limits WHERE email = ?), 1))
  `);

  stmt.run(email.toLowerCase(), email.toLowerCase());
};

// Check for duplicate emails
const checkDuplicateEmail = (table, email) => {
  const validTables = ['membership_submissions', 'contact_submissions'];
  if (!validTables.includes(table)) {
    throw new Error('Invalid table name');
  }

  const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE email = ?`);
  const result = stmt.get(email.toLowerCase());
  return result.count > 0;
};

// Admin session functions
const createAdminSession = (token, expiresAt, ipAddress) => {
  const stmt = db.prepare(`
    INSERT INTO admin_sessions (token, expires_at, ip_address)
    VALUES (?, ?, ?)
  `);

  stmt.run(token, expiresAt, ipAddress);
};

const getAdminSession = (token) => {
  const stmt = db.prepare(`
    SELECT * FROM admin_sessions
    WHERE token = ?
    AND datetime(expires_at) > datetime('now')
  `);

  return stmt.get(token);
};

const deleteAdminSession = (token) => {
  const stmt = db.prepare('DELETE FROM admin_sessions WHERE token = ?');
  stmt.run(token);
};

// Cleanup expired sessions
const cleanupExpiredSessions = () => {
  const stmt = db.prepare(`
    DELETE FROM admin_sessions
    WHERE datetime(expires_at) <= datetime('now')
  `);

  const result = stmt.run();
  return result.changes;
};

// Statistics functions
const getStatistics = () => {
  const membershipCount = db.prepare('SELECT COUNT(*) as count FROM membership_submissions').get();
  const contactCount = db.prepare('SELECT COUNT(*) as count FROM contact_submissions').get();

  const recentMembership = db.prepare(`
    SELECT COUNT(*) as count FROM membership_submissions
    WHERE datetime(submitted_at) > datetime('now', '-7 days')
  `).get();

  const recentContact = db.prepare(`
    SELECT COUNT(*) as count FROM contact_submissions
    WHERE datetime(submitted_at) > datetime('now', '-7 days')
  `).get();

  return {
    total: {
      membership: membershipCount.count,
      contact: contactCount.count
    },
    recent: {
      membership: recentMembership.count,
      contact: recentContact.count
    }
  };
};

// Export to CSV
const exportToCSV = (table) => {
  const validTables = ['membership_submissions', 'contact_submissions'];
  if (!validTables.includes(table)) {
    throw new Error('Invalid table name');
  }

  const stmt = db.prepare(`SELECT * FROM ${table} ORDER BY submitted_at DESC`);
  return stmt.all();
};

// Mark as synced to Google Sheets
const markAsSynced = (table, id) => {
  const validTables = ['membership_submissions', 'contact_submissions'];
  if (!validTables.includes(table)) {
    throw new Error('Invalid table name');
  }

  const stmt = db.prepare(`
    UPDATE ${table}
    SET synced_to_sheets = 1, synced_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(id);
};

// Get unsynced submissions
const getUnsyncedSubmissions = (table) => {
  const validTables = ['membership_submissions', 'contact_submissions'];
  if (!validTables.includes(table)) {
    throw new Error('Invalid table name');
  }

  const stmt = db.prepare(`
    SELECT * FROM ${table}
    WHERE synced_to_sheets = 0
    ORDER BY submitted_at ASC
  `);

  return stmt.all();
};

// Close database connection
const close = () => {
  if (db) {
    db.close();
    console.log('Database connection closed');
  }
};

// Run periodic cleanup (call this from a scheduler)
const runMaintenance = () => {
  try {
    // Clean up expired sessions
    const deletedSessions = cleanupExpiredSessions();

    // Clean up old rate limits
    const stmt = db.prepare(`
      DELETE FROM rate_limits
      WHERE datetime(reset_at) < datetime('now', '-1 day')
    `);
    const deletedRateLimits = stmt.run().changes;

    // Optionally delete old submissions based on retention policy
    if (config.DATA_RETENTION_DAYS > 0) {
      const retentionStmt = db.prepare(`
        DELETE FROM membership_submissions
        WHERE datetime(submitted_at) < datetime('now', '-${config.DATA_RETENTION_DAYS} days')
      `);
      const deletedMembership = retentionStmt.run().changes;

      const contactStmt = db.prepare(`
        DELETE FROM contact_submissions
        WHERE datetime(submitted_at) < datetime('now', '-${config.DATA_RETENTION_DAYS} days')
      `);
      const deletedContact = contactStmt.run().changes;

      return {
        sessions: deletedSessions,
        rateLimits: deletedRateLimits,
        membership: deletedMembership,
        contact: deletedContact
      };
    }

    return {
      sessions: deletedSessions,
      rateLimits: deletedRateLimits
    };
  } catch (error) {
    console.error('Maintenance error:', error);
    throw error;
  }
};

module.exports = {
  initialize,
  addMembershipSubmission,
  addContactSubmission,
  getMembershipSubmissions,
  getContactSubmissions,
  deleteMembershipSubmission,
  deleteContactSubmission,
  checkEmailRateLimit,
  updateEmailRateLimit,
  checkDuplicateEmail,
  createAdminSession,
  getAdminSession,
  deleteAdminSession,
  cleanupExpiredSessions,
  getStatistics,
  exportToCSV,
  markAsSynced,
  getUnsyncedSubmissions,
  runMaintenance,
  close
};