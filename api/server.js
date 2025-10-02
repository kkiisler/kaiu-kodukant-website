// MTÜ Kaiu Kodukant API Server
// Handles form submissions, admin dashboard, and S3 monitoring

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import configuration
const config = require('./config');

// Import services
const database = require('./services/database');
const emailService = require('./services/email');

// Import routes
const formsRouter = require('./routes/forms');
const adminRouter = require('./routes/admin');
const monitoringRouter = require('./routes/monitoring');

// Import middleware
const { authenticateAdmin } = require('./middleware/auth');
const rateLimiter = require('./middleware/rate-limit');

// Initialize Express app
const app = express();

// Trust proxy (for Caddy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from the main domain and localhost for testing
    const allowedOrigins = [
      config.ALLOWED_DOMAIN,
      'http://localhost:8080',
      'http://localhost:3000'
    ];

    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for admin dashboard
app.use('/admin/assets', express.static(path.join(__dirname, 'views/assets')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/v1/submit', rateLimiter.formLimiter, formsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/monitoring', authenticateAdmin, monitoringRouter);

// Admin dashboard HTML pages (protected)
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.get('/admin', authenticateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

app.get('/admin/monitoring', authenticateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/monitoring.html'));
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/admin/login');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }

  // Rate limit error
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize database
database.initialize()
  .then(() => {
    console.log('✅ Database initialized');

    // Test email configuration
    if (config.SMTP_HOST && config.SMTP_HOST !== 'smtp.gmail.com') {
      emailService.testConnection()
        .then(() => console.log('✅ Email service connected'))
        .catch(err => console.warn('⚠️ Email service not configured:', err.message));
    }

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  database.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  database.close();
  process.exit(0);
});