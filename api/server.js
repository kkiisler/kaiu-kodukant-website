// MTÜ Kaiu Kodukant API Server
// Handles form submissions, admin dashboard, and S3 monitoring

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

// Import configuration
const config = require('./config');

// Import services
const database = require('./services/database');
const emailService = require('./services/email');
const weatherService = require('./services/weather');
const aiBlurbGenerator = require('./services/ai-blurb');
const calendarSync = require('./services/calendar-sync');
const gallerySync = require('./services/gallery-sync');

// Import routes
const formsRouter = require('./routes/forms');
const adminRouter = require('./routes/admin');
const monitoringRouter = require('./routes/monitoring');
const weatherRouter = require('./routes/weather');
const calendarRouter = require('./routes/calendar');
const galleryRouter = require('./routes/gallery');

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
      config.API_DOMAIN,  // Allow API domain itself for admin panel
      'http://localhost:8080',
      'http://localhost:3000'
    ];

    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      console.error('CORS blocked origin:', origin);
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
app.use('/api/v1/weather', weatherRouter);
app.use('/api/v1/calendar', calendarRouter);
app.use('/api/v1/gallery', galleryRouter);

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

app.get('/admin/monitoring-enhanced', authenticateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/monitoring-enhanced.html'));
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
    if (config.RESEND_API_KEY) {
      emailService.testConnection()
        .then(() => console.log('✅ Email service connected'))
        .catch(err => console.warn('⚠️ Email service not configured:', err.message));
    }

    // Set up weather blurb generation cron job
    if (process.env.OPENAI_API_KEY) {
      // Run every 4 hours: 0:00, 4:00, 8:00, 12:00, 16:00, 20:00
      cron.schedule('0 */4 * * *', async () => {
        console.log('🌤️ Running scheduled weather blurb generation...');
        try {
          // Fetch weather data
          const forecastData = await weatherService.getForecast();
          if (forecastData) {
            const parsedData = weatherService.parseForecast(forecastData);
            const formattedData = weatherService.formatForBlurbContext(parsedData);

            // Cache the weather data
            database.setWeatherCache('Kaiu, Raplamaa', forecastData, 1);

            // Generate and save blurb
            const newBlurb = await aiBlurbGenerator.generateAndSaveBlurb(formattedData);
            console.log('✅ Weather blurb generated successfully:', newBlurb.id);
          } else {
            console.error('❌ Failed to fetch weather data');
          }
        } catch (error) {
          console.error('❌ Error generating weather blurb:', error);
        }
      }, {
        timezone: 'Europe/Tallinn'
      });
      console.log('✅ Weather cron job scheduled (every 4 hours)');
    } else {
      console.warn('⚠️ OpenAI API key not configured - weather blurbs disabled');
    }

    // Set up calendar sync cron job
    if (config.GOOGLE_API_KEY && config.GOOGLE_CALENDAR_ID) {
      // Run every 15 minutes to keep calendar data fresh
      cron.schedule('*/15 * * * *', async () => {
        console.log('📅 Running scheduled calendar sync...');
        try {
          const result = await calendarSync.syncCalendar();
          console.log('✅ Calendar sync completed:', result.eventCount, 'events');
        } catch (error) {
          console.error('❌ Calendar sync failed:', error.message);
        }
      }, {
        timezone: 'Europe/Tallinn'
      });
      console.log('✅ Calendar sync cron job scheduled (every 15 minutes)');

      // Run initial sync on startup
      console.log('📅 Running initial calendar sync...');
      calendarSync.syncCalendar()
        .then(result => console.log('✅ Initial calendar sync completed:', result.eventCount, 'events'))
        .catch(error => console.error('❌ Initial calendar sync failed:', error.message));
    } else {
      console.warn('⚠️ Google API not configured - calendar sync disabled');
    }

    // Set up gallery sync cron job
    if (config.GOOGLE_API_KEY && config.GOOGLE_DRIVE_FOLDER_ID) {
      // Run every hour to sync gallery photos
      cron.schedule('0 * * * *', async () => {
        console.log('🖼️  Running scheduled gallery sync...');
        try {
          const result = await gallerySync.syncGallery();
          if (result.skipped) {
            console.log('⏭️  Gallery sync skipped:', result.reason);
          } else {
            console.log('✅ Gallery sync completed:', result.photosProcessed, 'photos processed');
          }
        } catch (error) {
          console.error('❌ Gallery sync failed:', error.message);
        }
      }, {
        timezone: 'Europe/Tallinn'
      });
      console.log('✅ Gallery sync cron job scheduled (every hour)');

      // Run initial sync on startup (in background to not block server start)
      setTimeout(() => {
        console.log('🖼️  Running initial gallery sync...');
        gallerySync.syncGallery()
          .then(result => {
            if (result.skipped) {
              console.log('⏭️  Initial gallery sync skipped:', result.reason);
            } else {
              console.log('✅ Initial gallery sync completed:', result.photosProcessed, 'photos processed');
            }
          })
          .catch(error => console.error('❌ Initial gallery sync failed:', error.message));
      }, 10000); // Wait 10 seconds after server start
    } else {
      console.warn('⚠️ Google Drive not configured - gallery sync disabled');
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