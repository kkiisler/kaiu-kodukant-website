// reCAPTCHA v3 Validation Service
const axios = require('axios');
const config = require('../config');

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * Verifies a reCAPTCHA v3 token
 * @param {string} token - The reCAPTCHA token from the client
 * @param {string} action - The action name (e.g., 'membership', 'contact')
 * @returns {Promise<{success: boolean, score?: number, action?: string, error?: string}>}
 */
const verify = async (token, action = 'submit') => {
  try {
    // If no secret key configured, skip validation (development)
    if (!config.RECAPTCHA_SECRET_KEY) {
      console.warn('⚠️ reCAPTCHA secret key not configured - skipping validation');
      return { success: true, score: 1.0, action: action };
    }

    // Verify the token with Google
    const response = await axios.post(RECAPTCHA_VERIFY_URL, null, {
      params: {
        secret: config.RECAPTCHA_SECRET_KEY,
        response: token
      }
    });

    const { success, score, action: returnedAction, 'error-codes': errorCodes } = response.data;

    // Log the verification result
    console.log('reCAPTCHA verification:', {
      success,
      score,
      action: returnedAction,
      threshold: config.RECAPTCHA_THRESHOLD
    });

    if (!success) {
      console.error('reCAPTCHA verification failed:', errorCodes);
      return {
        success: false,
        error: errorCodes ? errorCodes.join(', ') : 'Verification failed'
      };
    }

    // Check if the action matches (optional but recommended)
    if (returnedAction !== action) {
      console.warn(`reCAPTCHA action mismatch: expected ${action}, got ${returnedAction}`);
    }

    // Check if score meets threshold
    if (score < config.RECAPTCHA_THRESHOLD) {
      return {
        success: false,
        score,
        error: `Score ${score} is below threshold ${config.RECAPTCHA_THRESHOLD}`
      };
    }

    return {
      success: true,
      score,
      action: returnedAction
    };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error.message);

    // In case of network error, you might want to allow the submission
    // but flag it for manual review
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.warn('Could not reach reCAPTCHA servers - allowing submission with flag');
      return {
        success: true,
        score: 0,
        error: 'Could not verify - network error'
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Middleware to verify reCAPTCHA
 */
const verifyMiddleware = (action = 'submit') => {
  return async (req, res, next) => {
    const { recaptchaToken } = req.body;

    // If no token provided
    if (!recaptchaToken && config.RECAPTCHA_SECRET_KEY) {
      return res.status(400).json({
        error: 'reCAPTCHA token required',
        message: 'Palun värskenda lehte ja proovi uuesti'
      });
    }

    // Verify the token
    const result = await verify(recaptchaToken, action);

    if (!result.success) {
      console.warn('reCAPTCHA validation failed:', result);

      // Don't reveal too much information to potential attackers
      return res.status(400).json({
        error: 'reCAPTCHA validation failed',
        message: 'Turvakontroll ebaõnnestus. Palun proovi uuesti.'
      });
    }

    // Attach the score to the request for logging
    req.recaptchaScore = result.score;

    next();
  };
};

module.exports = {
  verify,
  verifyMiddleware
};