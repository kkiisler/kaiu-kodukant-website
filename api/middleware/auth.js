// Authentication Middleware
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const database = require('../services/database');
const config = require('../config');

/**
 * Verify admin password and create session
 */
const login = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    // Check if admin password is configured
    if (!config.ADMIN_PASSWORD_HASH) {
      console.error('Admin password not configured');
      return res.status(500).json({ error: 'Admin authentication not configured' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, config.ADMIN_PASSWORD_HASH);

    if (!isValid) {
      // Log failed attempt
      console.warn('Failed login attempt from IP:', req.ip);
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        role: 'admin',
        ip: req.ip,
        loginTime: Date.now()
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRY }
    );

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save session to database
    database.createAdminSession(token, expiresAt.toISOString(), req.ip);

    console.log('Admin login successful from IP:', req.ip);

    res.json({
      success: true,
      token: token,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Logout - invalidate token
 */
const logout = (req, res) => {
  const token = extractToken(req);

  if (token) {
    database.deleteAdminSession(token);
    console.log('Admin logout from IP:', req.ip);
  }

  res.json({ success: true, message: 'Logged out successfully' });
};

/**
 * Middleware to authenticate admin requests
 */
const authenticateAdmin = (req, res, next) => {
  try {
    // Skip authentication for login page
    if (req.path === '/admin/login') {
      return next();
    }

    const token = extractToken(req);

    if (!token) {
      // For HTML pages, redirect to login
      if (req.path.startsWith('/admin') && !req.path.startsWith('/api')) {
        return res.redirect('/admin/login');
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify JWT token
    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.warn('Invalid token from IP:', req.ip);

        // For HTML pages, redirect to login
        if (req.path.startsWith('/admin') && !req.path.startsWith('/api')) {
          return res.redirect('/admin/login');
        }
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Check if session exists in database
      const session = database.getAdminSession(token);
      if (!session) {
        console.warn('Token not found in database from IP:', req.ip);

        // For HTML pages, redirect to login
        if (req.path.startsWith('/admin') && !req.path.startsWith('/api')) {
          return res.redirect('/admin/login');
        }
        return res.status(401).json({ error: 'Session expired' });
      }

      // Attach user info to request
      req.admin = decoded;
      next();
    });

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Extract token from request
 */
const extractToken = (req) => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie (for HTML pages)
  if (req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies.adminToken;
  }

  return null;
};

/**
 * Simple cookie parser
 */
const parseCookies = (cookieString) => {
  const cookies = {};
  cookieString.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
};

/**
 * Generate a hashed password (utility function for setup)
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Verify admin is configured (for health checks)
 */
const isConfigured = () => {
  return !!config.ADMIN_PASSWORD_HASH;
};

module.exports = {
  login,
  logout,
  authenticateAdmin,
  hashPassword,
  isConfigured
};