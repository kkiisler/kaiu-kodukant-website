// Weather API Routes
const express = require('express');
const router = express.Router();
const database = require('../services/database');
const weatherService = require('../services/weather');
const weatherAggregator = require('../services/weather-aggregator');
const aiBlurbGenerator = require('../services/ai-blurb');
const sunPosition = require('../services/sunPosition');
const { authenticateAdmin } = require('../middleware/auth');

/**
 * GET /api/v1/weather/current
 * Get the latest weather blurb and current conditions
 */
router.get('/current', async (req, res) => {
  try {
    // Get latest blurb from database
    const latestBlurb = database.getLatestWeatherBlurb();

    // Get current sun position data
    const now = new Date();
    const sunTimes = sunPosition.getSunTimes(now);
    const nextTransition = sunPosition.getNextTransition(now);
    const sunState = sunPosition.getSunStateDescription(now);

    if (!latestBlurb) {
      // No blurb exists yet, try to generate one
      if (aiBlurbGenerator.isConfigured()) {
        // Fetch aggregated weather data from both sources
        const aggregatedData = await weatherAggregator.getAggregatedForecast();
        if (aggregatedData) {
          const formattedData = weatherAggregator.formatForBlurbContext(aggregatedData);

          // Generate and save blurb
          const newBlurb = await aiBlurbGenerator.generateAndSaveBlurb(formattedData);

          return res.json({
            success: true,
            data: {
              blurb: newBlurb.blurb_text,
              temperature: newBlurb.temperature,
              conditions: newBlurb.conditions,
              icon: weatherService.getWeatherIcon(newBlurb.conditions, now),
              timestamp: newBlurb.created_at,
              isNew: true,
              sunPosition: {
                isDayTime: sunPosition.isDayTime(now),
                sunState: sunState,
                sunrise: sunTimes.sunrise,
                sunset: sunTimes.sunset,
                nextTransition: nextTransition
              }
            }
          });
        }
      }

      // Return empty response if no blurb and can't generate
      return res.json({
        success: true,
        data: {
          blurb: 'Ilmateade pole veel saadaval. Palun proovi hiljem uuesti.',
          temperature: null,
          conditions: null,
          icon: '❓',
          timestamp: new Date().toISOString(),
          isNew: false,
          sunPosition: {
            isDayTime: sunPosition.isDayTime(now),
            sunState: sunState,
            sunrise: sunTimes.sunrise,
            sunset: sunTimes.sunset,
            nextTransition: nextTransition
          }
        }
      });
    }

    // Return the latest blurb with sun position data
    res.json({
      success: true,
      data: {
        blurb: latestBlurb.blurb_text,
        temperature: latestBlurb.temperature,
        conditions: latestBlurb.conditions,
        icon: weatherService.getWeatherIcon(latestBlurb.conditions, now),
        timestamp: latestBlurb.created_at,
        isNew: false,
        sunPosition: {
          isDayTime: sunPosition.isDayTime(now),
          sunState: sunState,
          sunrise: sunTimes.sunrise,
          sunset: sunTimes.sunset,
          nextTransition: nextTransition
        }
      }
    });
  } catch (error) {
    console.error('Error fetching current weather:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather data'
    });
  }
});

/**
 * GET /api/v1/weather/history
 * Get the last 5 weather blurbs for popup history view
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const history = database.getWeatherBlurbHistory(limit);

    const formattedHistory = history.map(blurb => ({
      id: blurb.id,
      blurb: blurb.blurb_text,
      temperature: blurb.temperature,
      conditions: blurb.conditions,
      icon: weatherService.getWeatherIcon(blurb.conditions),
      timestamp: blurb.created_at
    }));

    res.json({
      success: true,
      data: {
        blurbs: formattedHistory
      }
    });
  } catch (error) {
    console.error('Error fetching weather history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather history'
    });
  }
});

/**
 * GET /api/v1/weather/admin
 * Get detailed weather data for admin panel (requires authentication)
 */
router.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    // Get weather statistics
    const stats = database.getWeatherStatistics();

    // Get last 20 blurbs for admin view
    const blurbs = database.getWeatherBlurbHistory(20);

    // Check cache status
    const cacheStatus = database.getWeatherCache('Kaiu, Raplamaa');

    // Check if OpenAI is configured
    const aiStatus = {
      configured: aiBlurbGenerator.isConfigured(),
      model: process.env.OPENAI_MODEL || 'not configured',
      temperature: process.env.OPENAI_TEMPERATURE || 'not configured'
    };

    res.json({
      success: true,
      data: {
        statistics: stats,
        blurbs: blurbs.map(b => ({
          ...b,
          icon: weatherService.getWeatherIcon(b.conditions)
        })),
        cacheStatus: {
          hasCache: !!cacheStatus,
          expiresAt: cacheStatus?.expires_at || null,
          cachedAt: cacheStatus?.cached_at || null
        },
        aiStatus,
        nextUpdateIn: calculateNextUpdateTime()
      }
    });
  } catch (error) {
    console.error('Error fetching admin weather data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin weather data'
    });
  }
});

/**
 * POST /api/v1/weather/generate
 * Manually trigger blurb generation (admin only)
 */
router.post('/generate', authenticateAdmin, async (req, res) => {
  try {
    // Check if AI is configured
    if (!aiBlurbGenerator.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI API not configured'
      });
    }

    // Fetch aggregated weather data from both sources
    const aggregatedData = await weatherAggregator.getAggregatedForecast();
    if (!aggregatedData) {
      return res.status(502).json({
        success: false,
        error: 'Failed to fetch weather data from all sources'
      });
    }

    // Format the data for AI blurb generation
    const formattedData = weatherAggregator.formatForBlurbContext(aggregatedData);

    // Cache the aggregated weather data (store first available raw data)
    const rawDataToCache = aggregatedData.sources?.estonian?.data ||
                          aggregatedData.sources?.openMeteo?.data ||
                          aggregatedData;
    database.setWeatherCache('Kaiu, Raplamaa', rawDataToCache, 1);

    // Generate and save new blurb
    const newBlurb = await aiBlurbGenerator.generateAndSaveBlurb(formattedData);

    res.json({
      success: true,
      data: {
        blurb: newBlurb.blurb_text,
        temperature: newBlurb.temperature,
        conditions: newBlurb.conditions,
        icon: weatherService.getWeatherIcon(newBlurb.conditions),
        timestamp: newBlurb.created_at,
        tokens: newBlurb.generation_tokens,
        model: newBlurb.generation_model
      }
    });
  } catch (error) {
    console.error('Error generating weather blurb:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate weather blurb: ' + error.message
    });
  }
});

/**
 * DELETE /api/v1/weather/cache
 * Clear weather cache (admin only)
 */
router.delete('/cache', authenticateAdmin, async (req, res) => {
  try {
    // Clear expired cache entries
    const result = database.cleanupOldWeatherData(20);

    res.json({
      success: true,
      data: {
        deletedCacheEntries: result.deletedCache,
        deletedOldBlurbs: result.deletedBlurbs
      }
    });
  } catch (error) {
    console.error('Error clearing weather cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear weather cache'
    });
  }
});

/**
 * GET /api/v1/weather/raw
 * Get raw weather data from Estonian Weather Service (admin only)
 */
router.get('/raw', authenticateAdmin, async (req, res) => {
  try {
    // Check cache first
    const cached = database.getWeatherCache('Kaiu, Raplamaa');
    if (cached) {
      return res.json({
        success: true,
        source: 'cache',
        cachedAt: cached.cached_at,
        expiresAt: cached.expires_at,
        data: cached.forecast_json
      });
    }

    // Fetch fresh data
    const forecastData = await weatherService.getForecast();
    if (!forecastData) {
      return res.status(502).json({
        success: false,
        error: 'Failed to fetch weather data'
      });
    }

    // Cache it
    database.setWeatherCache('Kaiu, Raplamaa', forecastData, 1);

    res.json({
      success: true,
      source: 'api',
      data: forecastData
    });
  } catch (error) {
    console.error('Error fetching raw weather data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch raw weather data'
    });
  }
});

/**
 * GET /api/v1/weather/sources
 * Get weather data from all sources for comparison (admin only)
 * Shows data from Estonian Weather Service, Open-Meteo, and aggregated result
 */
router.get('/sources', authenticateAdmin, async (req, res) => {
  try {
    // Fetch aggregated data with all source details
    const aggregatedData = await weatherAggregator.getAggregatedForecast();

    // Get formatted versions for comparison
    const estonianFormatted = aggregatedData.sources?.estonian?.available
      ? weatherService.formatForBlurbContext(aggregatedData.sources.estonian.data)
      : null;

    const openMeteoService = require('../services/open-meteo');
    const openMeteoFormatted = aggregatedData.sources?.openMeteo?.available
      ? openMeteoService.formatForBlurbContext(aggregatedData.sources.openMeteo.data)
      : null;

    const aggregatedFormatted = weatherAggregator.formatForBlurbContext(aggregatedData);

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        sources: {
          estonian: {
            available: aggregatedData.sources?.estonian?.available || false,
            raw: aggregatedData.sources?.estonian?.data || null,
            formatted: estonianFormatted
          },
          openMeteo: {
            available: aggregatedData.sources?.openMeteo?.available || false,
            raw: aggregatedData.sources?.openMeteo?.data || null,
            formatted: openMeteoFormatted
          }
        },
        aggregated: {
          raw: aggregatedData,
          formatted: aggregatedFormatted
        },
        comparison: aggregatedData.comparison,
        alerts: aggregatedData.alerts,
        weights: {
          current: {
            openMeteo: 80,
            estonian: 20
          },
          forecast: {
            openMeteo: 50,
            estonian: 50
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching weather sources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather sources: ' + error.message
    });
  }
});

/**
 * Calculate time until next scheduled update
 * Updates happen every 4 hours: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
 */
function calculateNextUpdateTime() {
  const now = new Date();
  const hours = now.getHours();
  const nextHour = Math.ceil((hours + 1) / 4) * 4;

  const nextUpdate = new Date(now);
  if (nextHour >= 24) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
    nextUpdate.setHours(0, 0, 0, 0);
  } else {
    nextUpdate.setHours(nextHour, 0, 0, 0);
  }

  const diffMs = nextUpdate - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    nextUpdate: nextUpdate.toISOString(),
    hoursUntil: diffHours,
    minutesUntil: diffMinutes,
    displayText: `${diffHours}h ${diffMinutes}m`
  };
}

module.exports = router;