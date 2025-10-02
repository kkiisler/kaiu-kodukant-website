// Form Submission Routes
const express = require('express');
const router = express.Router();
const database = require('../services/database');
const emailService = require('../services/email');
const recaptcha = require('../services/recaptcha');
const config = require('../config');

// Membership form submission
router.post('/membership', recaptcha.verifyMiddleware('membership'), async (req, res) => {
  try {
    const { name, email } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Nimi ja e-post on kohustuslikud'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Palun sisesta kehtiv e-posti aadress'
      });
    }

    // Check email rate limit
    const rateLimit = database.checkEmailRateLimit(email);
    if (!rateLimit.allowed) {
      const nextTime = rateLimit.nextAllowedTime.toLocaleTimeString('et-EE');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Oled juba esitanud taotluse. Proovi uuesti pärast ${nextTime}`
      });
    }

    // Check for duplicate (optional - you might want to allow re-submissions)
    const isDuplicate = database.checkDuplicateEmail('membership_submissions', email);
    if (isDuplicate) {
      return res.status(409).json({
        error: 'Duplicate submission',
        message: 'See e-posti aadress on juba registreeritud'
      });
    }

    // Prepare submission data
    const submissionData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      recaptcha_score: req.recaptchaScore || 0,
      ip_address: req.ip,
      user_agent: req.get('user-agent') || 'Unknown'
    };

    // Save to database
    const submissionId = database.addMembershipSubmission(submissionData);
    console.log('Membership submission saved:', submissionId);

    // Update rate limit
    database.updateEmailRateLimit(email);

    // Send email notification (async - don't wait)
    emailService.sendMembershipNotification({
      ...submissionData,
      submitted_at: new Date().toISOString()
    }).catch(err => {
      console.error('Failed to send email notification:', err);
    });

    // Success response
    res.json({
      success: true,
      message: 'Liikmestaotlus on edukalt esitatud! Võtame sinuga peagi ühendust.',
      submissionId: submissionId
    });

  } catch (error) {
    console.error('Membership submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Midagi läks valesti. Palun proovi hiljem uuesti.'
    });
  }
});

// Contact form submission
router.post('/contact', recaptcha.verifyMiddleware('contact'), async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Nimi, e-post ja sõnum on kohustuslikud'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Palun sisesta kehtiv e-posti aadress'
      });
    }

    // Validate message length
    if (message.length > 5000) {
      return res.status(400).json({
        error: 'Message too long',
        message: 'Sõnum on liiga pikk (maksimaalselt 5000 tähemärki)'
      });
    }

    // Check email rate limit
    const rateLimit = database.checkEmailRateLimit(email);
    if (!rateLimit.allowed) {
      const nextTime = rateLimit.nextAllowedTime.toLocaleTimeString('et-EE');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Oled juba saatnud sõnumi. Proovi uuesti pärast ${nextTime}`
      });
    }

    // Prepare submission data
    const submissionData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      subject: subject ? subject.trim() : null,
      message: message.trim(),
      recaptcha_score: req.recaptchaScore || 0,
      ip_address: req.ip,
      user_agent: req.get('user-agent') || 'Unknown'
    };

    // Save to database
    const submissionId = database.addContactSubmission(submissionData);
    console.log('Contact submission saved:', submissionId);

    // Update rate limit
    database.updateEmailRateLimit(email);

    // Send email notification (async - don't wait)
    emailService.sendContactNotification({
      ...submissionData,
      submitted_at: new Date().toISOString()
    }).catch(err => {
      console.error('Failed to send email notification:', err);
    });

    // Success response
    res.json({
      success: true,
      message: 'Sõnum on edukalt saadetud! Vastame esimesel võimalusel.',
      submissionId: submissionId
    });

  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Midagi läks valesti. Palun proovi hiljem uuesti.'
    });
  }
});

// Test endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  router.get('/test', (req, res) => {
    res.json({
      message: 'Form submission endpoints are working',
      endpoints: [
        'POST /api/v1/submit/membership',
        'POST /api/v1/submit/contact'
      ],
      recaptcha: config.RECAPTCHA_SECRET_KEY ? 'Configured' : 'Not configured',
      email: config.SMTP_HOST ? 'Configured' : 'Not configured'
    });
  });
}

module.exports = router;