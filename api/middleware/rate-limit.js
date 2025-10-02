// Rate Limiting Middleware
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiter for form submissions (IP-based)
const formLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS, // 1 hour
  max: config.RATE_LIMIT_MAX_REQUESTS, // 5 requests per window
  message: {
    error: 'Too many submissions',
    message: 'Liiga palju päringuid. Palun proovi hiljem uuesti.'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  // Store in memory (for single instance)
  // For production with multiple instances, use Redis store
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Use IP address as key
    return req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Oled teinud liiga palju päringuid. Palun oota natuke ja proovi uuesti.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Rate limiter for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: {
    error: 'Too many login attempts',
    message: 'Too many login attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful logins
});

// Rate limiter for API endpoints (general)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  message: {
    error: 'Too many requests',
    message: 'API rate limit exceeded.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Custom email-based rate limiting (handled in database)
// This is additional to IP-based limiting
const emailRateLimiter = (req, res, next) => {
  // This is handled in the form submission endpoints
  // using database.checkEmailRateLimit()
  next();
};

module.exports = {
  formLimiter,
  adminLimiter,
  loginLimiter,
  apiLimiter,
  emailRateLimiter
};