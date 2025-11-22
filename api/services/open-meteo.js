// Open-Meteo Weather Service
// Fetches weather forecast data from Open-Meteo API for Kaiu, Raplamaa
// Note: Open-Meteo returns times in GMT, we convert to Europe/Tallinn

const axios = require('axios');

class OpenMeteoService {
  constructor() {
    this.BASE_URL = 'https://api.open-meteo.com/v1/forecast';
    this.KAIU_COORDS = {
      latitude: 59.0106,
      longitude: 25.0597
    };
    this.LOCATION_NAME = 'Kaiu, Raplamaa';
    this.TIMEZONE = 'Europe/Tallinn';
  }

  /**
   * Get weather forecast for Kaiu with retry logic
   * @param {number} retries - Number of retries (default: 3)
   * @returns {Object} Weather forecast data or null if error
   */
  async getForecast(retries = 3) {
    const params = {
      latitude: this.KAIU_COORDS.latitude,
      longitude: this.KAIU_COORDS.longitude,
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'rain',
        'showers',
        'snowfall',
        'snow_depth',
        'wind_speed_10m',
        'wind_direction_10m',
        'cloud_cover'
      ].join(','),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'wind_speed_10m',
        'precipitation',
        'rain',
        'showers',
        'snowfall',
        'cloud_cover',
        'pressure_msl'
      ].join(','),
      timezone: 'GMT', // We'll convert to Estonian time ourselves
      wind_speed_unit: 'ms' // Request wind speed in m/s to match Estonian Weather Service
    };

    let lastError = null;

    // Retry with exponential backoff
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await axios.get(this.BASE_URL, {
          params,
          timeout: 10000 + (attempt * 5000), // Increase timeout on retries
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; KaiuKodukant/1.0)',
            'Accept': 'application/json'
          }
        });

        // Success - return data
        return response.data;
      } catch (error) {
        lastError = error;

        // Check if it's a rate limit error (429)
        if (error.response && error.response.status === 429) {
          console.warn(`Open-Meteo rate limited on attempt ${attempt + 1}, waiting longer...`);
          await this.sleep((attempt + 1) * 10000); // Wait 10, 20, 30 seconds
          continue;
        }

        // Check if it's a temporary error worth retrying
        const isRetryable = !error.response || // Network error
                          error.response.status >= 500 || // Server error
                          error.code === 'ECONNABORTED' || // Timeout
                          error.code === 'ENOTFOUND' || // DNS error
                          error.code === 'ECONNREFUSED'; // Connection refused

        if (isRetryable && attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`Open-Meteo API attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          // Non-retryable error or last attempt
          console.error(`Open-Meteo API error on attempt ${attempt + 1}:`, error.message);
          if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
          }
        }
      }
    }

    // All retries failed
    console.error(`Failed to fetch Open-Meteo weather after ${retries} attempts`);
    return null;
  }

  /**
   * Sleep helper for retry delays
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert GMT time string to Estonian time
   * @param {string} gmtTimeStr - ISO timestamp in GMT
   * @returns {Date} Date object in local time
   */
  convertGMTtoEstonian(gmtTimeStr) {
    // Parse as UTC/GMT
    const date = new Date(gmtTimeStr);
    return date;
  }

  /**
   * Format date for Estonian timezone display
   * @param {Date} date - Date object
   * @returns {string} Formatted time string
   */
  formatEstonianTime(date) {
    return date.toLocaleString('et-EE', {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  /**
   * Parse forecast data to extract current conditions and next 24 hours
   * @param {Object} forecastData - Raw forecast data from Open-Meteo API
   * @returns {Object} Parsed weather data
   */
  parseForecast(forecastData) {
    if (!forecastData || !forecastData.current || !forecastData.hourly) {
      return null;
    }

    const current = this.parseCurrentData(forecastData.current);
    const hourly = this.parseHourlyData(forecastData.hourly);

    // Get next 24 hours
    const next24Hours = hourly.slice(0, 24);

    // Calculate summary stats for next 24 hours
    const temps = next24Hours.map(h => h.temperature).filter(t => t !== null);
    const apparentTemps = next24Hours.map(h => h.apparentTemperature).filter(t => t !== null);
    const precips = next24Hours.map(h => h.precipitation).filter(p => p !== null);
    const precipProbs = next24Hours.map(h => h.precipitationProbability).filter(p => p !== null);
    const cloudCovers = next24Hours.map(h => h.cloudCover).filter(c => c !== null);

    const summary = {
      minTemp: temps.length > 0 ? Math.min(...temps) : null,
      maxTemp: temps.length > 0 ? Math.max(...temps) : null,
      minApparentTemp: apparentTemps.length > 0 ? Math.min(...apparentTemps) : null,
      maxApparentTemp: apparentTemps.length > 0 ? Math.max(...apparentTemps) : null,
      totalPrecipitation: precips.length > 0 ? precips.reduce((a, b) => a + b, 0) : 0,
      maxPrecipProbability: precipProbs.length > 0 ? Math.max(...precipProbs) : 0,
      avgCloudCover: cloudCovers.length > 0 ? Math.round(cloudCovers.reduce((a, b) => a + b, 0) / cloudCovers.length) : null,
      conditions: this.summarizeConditions(next24Hours)
    };

    return {
      location: this.LOCATION_NAME,
      current,
      next24Hours,
      summary,
      issuedAt: new Date().toISOString(),
      source: 'open-meteo'
    };
  }

  /**
   * Parse current weather data
   * @param {Object} currentData - Current weather from API
   * @returns {Object} Parsed current data
   */
  parseCurrentData(currentData) {
    return {
      time: currentData.time ? this.convertGMTtoEstonian(currentData.time) : new Date(),
      temperature: currentData.temperature_2m !== undefined ? parseFloat(currentData.temperature_2m) : null,
      apparentTemperature: currentData.apparent_temperature !== undefined ? parseFloat(currentData.apparent_temperature) : null,
      humidity: currentData.relative_humidity_2m !== undefined ? parseFloat(currentData.relative_humidity_2m) : null,
      windSpeed: currentData.wind_speed_10m !== undefined ? parseFloat(currentData.wind_speed_10m) : null,
      precipitation: currentData.precipitation !== undefined ? parseFloat(currentData.precipitation) : 0,
      rain: currentData.rain !== undefined ? parseFloat(currentData.rain) : 0,
      showers: currentData.showers !== undefined ? parseFloat(currentData.showers) : 0,
      snowfall: currentData.snowfall !== undefined ? parseFloat(currentData.snowfall) : 0,
      cloudCover: currentData.cloud_cover !== undefined ? parseFloat(currentData.cloud_cover) : null,
      pressure: currentData.pressure_msl !== undefined ? parseFloat(currentData.pressure_msl) : null
    };
  }

  /**
   * Parse hourly forecast data
   * @param {Object} hourlyData - Hourly data from API
   * @returns {Array} Array of parsed hourly data
   */
  parseHourlyData(hourlyData) {
    if (!hourlyData.time || hourlyData.time.length === 0) {
      return [];
    }

    const parsed = [];
    for (let i = 0; i < hourlyData.time.length; i++) {
      parsed.push({
        time: this.convertGMTtoEstonian(hourlyData.time[i]),
        timeStr: hourlyData.time[i],
        temperature: hourlyData.temperature_2m?.[i] !== undefined ? parseFloat(hourlyData.temperature_2m[i]) : null,
        apparentTemperature: hourlyData.apparent_temperature?.[i] !== undefined ? parseFloat(hourlyData.apparent_temperature[i]) : null,
        humidity: hourlyData.relative_humidity_2m?.[i] !== undefined ? parseFloat(hourlyData.relative_humidity_2m[i]) : null,
        precipitationProbability: hourlyData.precipitation_probability?.[i] !== undefined ? parseFloat(hourlyData.precipitation_probability[i]) : null,
        precipitation: hourlyData.precipitation?.[i] !== undefined ? parseFloat(hourlyData.precipitation[i]) : 0,
        rain: hourlyData.rain?.[i] !== undefined ? parseFloat(hourlyData.rain[i]) : 0,
        showers: hourlyData.showers?.[i] !== undefined ? parseFloat(hourlyData.showers[i]) : 0,
        snowfall: hourlyData.snowfall?.[i] !== undefined ? parseFloat(hourlyData.snowfall[i]) : 0,
        snowDepth: hourlyData.snow_depth?.[i] !== undefined ? parseFloat(hourlyData.snow_depth[i]) : 0,
        windSpeed: hourlyData.wind_speed_10m?.[i] !== undefined ? parseFloat(hourlyData.wind_speed_10m[i]) : null,
        windDirection: hourlyData.wind_direction_10m?.[i] !== undefined ? parseFloat(hourlyData.wind_direction_10m[i]) : null,
        cloudCover: hourlyData.cloud_cover?.[i] !== undefined ? parseFloat(hourlyData.cloud_cover[i]) : null
      });
    }

    return parsed;
  }

  /**
   * Summarize weather conditions for a period
   * @param {Array} hours - Array of hourly data
   * @returns {Array} Array of condition descriptions
   */
  summarizeConditions(hours) {
    const conditions = [];

    // Check for precipitation
    const hasRain = hours.some(h => (h.rain || 0) > 0.1);
    const hasShowers = hours.some(h => (h.showers || 0) > 0.1);
    const hasSnow = hours.some(h => (h.snowfall || 0) > 0.1);

    if (hasSnow) conditions.push('lumi');
    if (hasRain) conditions.push('vihm');
    if (hasShowers) conditions.push('hoovihm');

    // Check cloud cover
    const avgCloudCover = hours.reduce((sum, h) => sum + (h.cloudCover || 0), 0) / hours.length;
    if (avgCloudCover < 25) {
      conditions.push('selge');
    } else if (avgCloudCover < 75) {
      conditions.push('poolpilves');
    } else {
      conditions.push('pilves');
    }

    return conditions;
  }

  /**
   * Convert wind direction from degrees to Estonian compass direction
   * @param {number} degrees - Wind direction in degrees
   * @returns {string} Estonian compass direction
   */
  getWindDirectionEstonian(degrees) {
    if (degrees === null || degrees === undefined) return null;

    const directions = ['põhjatuul', 'kirdetuul', 'idatuul', 'kagutuul', 'lõunatuul', 'edelatuul', 'läänetuul', 'loodetuul'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
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

    const windDir = current.windSpeed ? this.getWindDirectionEstonian(current.windDirection) : null;

    return {
      current: {
        temperature: current.temperature,
        apparentTemperature: current.apparentTemperature,
        phenomenon: this.summarizeConditions([current]).join(', '),
        windSpeed: current.windSpeed,
        windDirection: windDir,
        precipitation: current.precipitation,
        cloudCover: current.cloudCover,
        humidity: current.humidity
      },
      periods: {
        morning: this.summarizePeriod(morning, 'hommik'),
        afternoon: this.summarizePeriod(afternoon, 'pärastlõuna'),
        evening: this.summarizePeriod(evening, 'õhtu'),
        night: this.summarizePeriod(night, 'öö')
      },
      summary: {
        tempRange: `${summary.minTemp}–${summary.maxTemp} °C`,
        apparentTempRange: `${summary.minApparentTemp}–${summary.maxApparentTemp} °C`,
        totalPrecipitation: summary.totalPrecipitation,
        maxPrecipProbability: summary.maxPrecipProbability,
        avgCloudCover: summary.avgCloudCover,
        dominantConditions: summary.conditions.join(', ')
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
    const apparentTemps = hours.map(h => h.apparentTemperature).filter(t => t !== null);
    const conditions = this.summarizeConditions(hours);
    const precips = hours.map(h => h.precipitation).filter(p => p !== null);
    const precipProbs = hours.map(h => h.precipitationProbability).filter(p => p !== null);
    const winds = hours.map(h => h.windSpeed).filter(w => w !== null);
    const clouds = hours.map(h => h.cloudCover).filter(c => c !== null);

    return {
      period: periodName,
      tempRange: temps.length > 0 ? `${Math.min(...temps)}–${Math.max(...temps)} °C` : null,
      apparentTempRange: apparentTemps.length > 0 ? `${Math.min(...apparentTemps)}–${Math.max(...apparentTemps)} °C` : null,
      conditions: conditions.join(', '),
      precipitation: precips.length > 0 ? precips.reduce((a, b) => a + b, 0) : 0,
      precipProbability: precipProbs.length > 0 ? Math.max(...precipProbs) : 0,
      avgWind: winds.length > 0 ? Math.round(winds.reduce((a, b) => a + b, 0) / winds.length * 10) / 10 : null,
      avgCloudCover: clouds.length > 0 ? Math.round(clouds.reduce((a, b) => a + b, 0) / clouds.length) : null
    };
  }
}

module.exports = new OpenMeteoService();
