// Weather Service - Estonian Weather Service API Client
// Fetches weather forecast data for Kaiu, Raplamaa

const axios = require('axios');

class WeatherService {
  constructor() {
    this.BASE_URL = 'https://www.ilmateenistus.ee';
    this.KAIU_COORDS = '59.0106;25.0597'; // Kaiu, Raplamaa coordinates
    this.LOCATION_NAME = 'Kaiu, Raplamaa';
  }

  /**
   * Get weather forecast for Kaiu
   * @param {string} lang - Language code (et, en, ru) - default: et
   * @returns {Object} Weather forecast data or null if error
   */
  async getForecast(lang = 'et') {
    const url = `${this.BASE_URL}/wp-content/themes/ilm2020/meteogram.php`;

    const params = {
      coordinates: this.KAIU_COORDS,
      lang: lang
    };

    try {
      const response = await axios.get(url, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KaiuKodukant/1.0)',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'et,en;q=0.9'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching forecast:', error.message);

      // Log more details for debugging
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }

      return null;
    }
  }

  /**
   * Parse forecast data to extract current conditions and next 24 hours
   * @param {Object} forecastData - Raw forecast data from API
   * @returns {Object} Parsed weather data
   */
  parseForecast(forecastData) {
    if (!forecastData || !forecastData.forecast) {
      return null;
    }

    const forecast = forecastData.forecast;
    const tabular = forecast.tabular || {};
    const times = tabular.time || [];

    if (times.length === 0) {
      return null;
    }

    // Get current/first hour data
    const current = this.parseTimeData(times[0]);

    // Get next 24 hours
    const next24Hours = times.slice(0, 24).map(time => this.parseTimeData(time));

    // Calculate summary stats for next 24 hours
    const temps = next24Hours.map(h => h.temperature).filter(t => t !== null);
    const precips = next24Hours.map(h => h.precipitation).filter(p => p !== null);

    const summary = {
      minTemp: temps.length > 0 ? Math.min(...temps) : null,
      maxTemp: temps.length > 0 ? Math.max(...temps) : null,
      totalPrecipitation: precips.length > 0 ? precips.reduce((a, b) => a + b, 0) : 0,
      conditions: [...new Set(next24Hours.map(h => h.phenomenon).filter(p => p))],
      dominantWindDirection: this.getMostFrequent(next24Hours.map(h => h.windDirection).filter(w => w))
    };

    return {
      location: forecastData.location || this.LOCATION_NAME,
      current,
      next24Hours,
      summary,
      issuedAt: new Date().toISOString()
    };
  }

  /**
   * Parse individual time data from forecast
   * @param {Object} timeData - Time data from forecast
   * @returns {Object} Parsed time data
   */
  parseTimeData(timeData) {
    if (!timeData || typeof timeData !== 'object') {
      return {};
    }

    const attrs = timeData['@attributes'] || {};

    // Temperature
    const tempData = timeData.temperature?.['@attributes'] || {};
    const temperature = tempData.value ? parseFloat(tempData.value) : null;

    // Wind
    const windSpeedData = timeData.windSpeed?.['@attributes'] || {};
    const windSpeed = windSpeedData.mps ? parseFloat(windSpeedData.mps) : null;

    const windDirData = timeData.windDirection?.['@attributes'] || {};
    const windDirection = windDirData.name || null;
    const windDegrees = windDirData.deg ? parseFloat(windDirData.deg) : null;

    // Precipitation
    const precipData = timeData.precipitation?.['@attributes'] || {};
    const precipitation = precipData.value ? parseFloat(precipData.value) : 0;

    // Weather phenomenon
    const phenomData = timeData.phenomen?.['@attributes'] || {};
    const phenomenon = phenomData.et || phenomData.en || null;

    return {
      time: attrs.from || null,
      temperature,
      windSpeed,
      windDirection,
      windDegrees,
      precipitation,
      phenomenon,
      conditions: phenomenon // Alias for easier access
    };
  }

  /**
   * Get the most frequent element in an array
   * @param {Array} arr - Array of elements
   * @returns {*} Most frequent element or null
   */
  getMostFrequent(arr) {
    if (!arr || arr.length === 0) return null;

    const frequency = {};
    let maxFreq = 0;
    let mostFrequent = null;

    for (const item of arr) {
      frequency[item] = (frequency[item] || 0) + 1;
      if (frequency[item] > maxFreq) {
        maxFreq = frequency[item];
        mostFrequent = item;
      }
    }

    return mostFrequent;
  }

  /**
   * Get simple weather summary for display
   * @param {Object} parsedData - Parsed forecast data
   * @returns {Object} Simple weather summary
   */
  getSimpleSummary(parsedData) {
    if (!parsedData || !parsedData.current) {
      return null;
    }

    const { current, summary } = parsedData;

    return {
      temperature: current.temperature,
      conditions: current.conditions,
      windSpeed: current.windSpeed,
      windDirection: current.windDirection,
      precipitation: current.precipitation,
      tempRange: {
        min: summary.minTemp,
        max: summary.maxTemp
      },
      totalPrecipitation24h: summary.totalPrecipitation
    };
  }

  /**
   * Determine weather icon based on conditions
   * @param {string} phenomenon - Weather phenomenon in Estonian
   * @returns {string} Weather icon emoji
   */
  getWeatherIcon(phenomenon) {
    if (!phenomenon) return '❓';

    const lowerPhenom = phenomenon.toLowerCase();

    if (lowerPhenom.includes('selge')) return '☀️';
    if (lowerPhenom.includes('päike')) return '☀️';
    if (lowerPhenom.includes('vähene pilvisus')) return '🌤️';
    if (lowerPhenom.includes('vahelduv pilvisus')) return '⛅';
    if (lowerPhenom.includes('pilves')) return '☁️';
    if (lowerPhenom.includes('vihm')) {
      if (lowerPhenom.includes('tugev')) return '🌧️';
      if (lowerPhenom.includes('hoog')) return '🌦️';
      return '🌧️';
    }
    if (lowerPhenom.includes('lumi')) return '🌨️';
    if (lowerPhenom.includes('lörtsi')) return '🌨️';
    if (lowerPhenom.includes('äike')) return '⛈️';
    if (lowerPhenom.includes('udu')) return '🌫️';
    if (lowerPhenom.includes('tuisk')) return '🌨️';

    return '☁️'; // Default to cloudy
  }

  /**
   * Format weather data for Estonian blurb context
   * @param {Object} parsedData - Parsed forecast data
   * @returns {Object} Formatted context for AI blurb generation
   */
  formatForBlurbContext(parsedData) {
    if (!parsedData) return null;

    const { current, next24Hours, summary } = parsedData;

    // Group next 24 hours into time periods
    const morning = next24Hours.slice(0, 6);   // Next 6 hours
    const afternoon = next24Hours.slice(6, 12); // 6-12 hours
    const evening = next24Hours.slice(12, 18);  // 12-18 hours
    const night = next24Hours.slice(18, 24);    // 18-24 hours

    return {
      current: {
        temperature: current.temperature,
        phenomenon: current.conditions,
        wind: `${current.windSpeed} m/s ${current.windDirection || ''}`.trim(),
        precipitation: current.precipitation
      },
      periods: {
        morning: this.summarizePeriod(morning, 'hommik'),
        afternoon: this.summarizePeriod(afternoon, 'pärastlõuna'),
        evening: this.summarizePeriod(evening, 'õhtu'),
        night: this.summarizePeriod(night, 'öö')
      },
      summary: {
        tempRange: `${summary.minTemp}–${summary.maxTemp} °C`,
        totalPrecipitation: summary.totalPrecipitation,
        dominantConditions: summary.conditions.slice(0, 3).join(', ')
      }
    };
  }

  /**
   * Summarize a time period for blurb context
   * @param {Array} hours - Array of hourly data
   * @param {string} periodName - Name of the period in Estonian
   * @returns {Object} Period summary
   */
  summarizePeriod(hours, periodName) {
    if (!hours || hours.length === 0) {
      return { period: periodName, data: null };
    }

    const temps = hours.map(h => h.temperature).filter(t => t !== null);
    const conditions = [...new Set(hours.map(h => h.phenomenon).filter(p => p))];
    const precips = hours.map(h => h.precipitation).filter(p => p !== null);
    const winds = hours.map(h => h.windSpeed).filter(w => w !== null);

    return {
      period: periodName,
      tempRange: temps.length > 0 ? `${Math.min(...temps)}–${Math.max(...temps)} °C` : null,
      conditions: conditions.join(', '),
      precipitation: precips.length > 0 ? precips.reduce((a, b) => a + b, 0) : 0,
      avgWind: winds.length > 0 ? Math.round(winds.reduce((a, b) => a + b, 0) / winds.length * 10) / 10 : null
    };
  }
}

module.exports = new WeatherService();