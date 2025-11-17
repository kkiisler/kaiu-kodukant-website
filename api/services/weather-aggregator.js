// Weather Aggregator Service
// Combines data from Estonian Weather Service and Open-Meteo
// Uses weighted averaging: Current (80% Open-Meteo, 20% Estonian), Forecast (50/50)

const weatherService = require('./weather');
const openMeteoService = require('./open-meteo');

class WeatherAggregator {
  constructor() {
    // Weighting for current conditions
    this.CURRENT_WEIGHTS = {
      openMeteo: 0.8,
      estonian: 0.2
    };

    // Weighting for forecast periods
    this.FORECAST_WEIGHTS = {
      openMeteo: 0.5,
      estonian: 0.5
    };

    // Thresholds for disagreement alerts
    this.DISAGREEMENT_THRESHOLDS = {
      temperature: 5.0,  // °C
      precipitation: 20.0, // % or mm
      windSpeed: 5.0     // m/s
    };
  }

  /**
   * Fetch weather data from both sources in parallel
   * @returns {Object} Combined weather data from both sources
   */
  async fetchFromBothSources() {
    const startTime = Date.now();

    try {
      // Fetch from both sources in parallel
      const [estonianData, openMeteoData] = await Promise.allSettled([
        weatherService.getForecast(),
        openMeteoService.getForecast()
      ]);

      const fetchTime = Date.now() - startTime;

      const result = {
        estonian: {
          success: estonianData.status === 'fulfilled' && estonianData.value !== null,
          raw: estonianData.status === 'fulfilled' ? estonianData.value : null,
          error: estonianData.status === 'rejected' ? estonianData.reason : null
        },
        openMeteo: {
          success: openMeteoData.status === 'fulfilled' && openMeteoData.value !== null,
          raw: openMeteoData.status === 'fulfilled' ? openMeteoData.value : null,
          error: openMeteoData.status === 'rejected' ? openMeteoData.reason : null
        },
        fetchTime,
        timestamp: new Date().toISOString()
      };

      // Parse the data if fetch was successful
      if (result.estonian.success) {
        result.estonian.parsed = weatherService.parseForecast(result.estonian.raw);
      }

      if (result.openMeteo.success) {
        result.openMeteo.parsed = openMeteoService.parseForecast(result.openMeteo.raw);
      }

      return result;
    } catch (error) {
      console.error('Error fetching from weather sources:', error);
      throw error;
    }
  }

  /**
   * Get aggregated weather forecast combining both sources
   * @returns {Object} Aggregated weather data with comparison metrics
   */
  async getAggregatedForecast() {
    const sources = await this.fetchFromBothSources();

    // Check if at least one source succeeded
    if (!sources.estonian.success && !sources.openMeteo.success) {
      throw new Error('All weather sources failed');
    }

    // If only one source available, return that one
    if (!sources.estonian.success) {
      console.warn('Estonian Weather Service unavailable, using Open-Meteo only');
      return this.formatSingleSource(sources.openMeteo.parsed, 'open-meteo', sources);
    }

    if (!sources.openMeteo.success) {
      console.warn('Open-Meteo unavailable, using Estonian Weather Service only');
      return this.formatSingleSource(sources.estonian.parsed, 'estonian', sources);
    }

    // Both sources available - aggregate the data
    const aggregated = this.aggregateData(sources.estonian.parsed, sources.openMeteo.parsed);

    // Calculate comparison metrics
    const comparison = this.compareSourceData(sources.estonian.parsed, sources.openMeteo.parsed);

    // Check for significant disagreements
    const alerts = this.checkDisagreements(comparison);

    return {
      ...aggregated,
      sources: {
        estonian: {
          available: true,
          data: sources.estonian.parsed
        },
        openMeteo: {
          available: true,
          data: sources.openMeteo.parsed
        }
      },
      comparison,
      alerts,
      fetchTime: sources.fetchTime,
      aggregatedAt: new Date().toISOString()
    };
  }

  /**
   * Aggregate data from both sources with weighted averaging
   * @param {Object} estonianData - Parsed Estonian weather data
   * @param {Object} openMeteoData - Parsed Open-Meteo weather data
   * @returns {Object} Aggregated weather data
   */
  aggregateData(estonianData, openMeteoData) {
    // Aggregate current conditions (80% Open-Meteo, 20% Estonian)
    const current = this.aggregateCurrent(
      estonianData.current,
      openMeteoData.current,
      this.CURRENT_WEIGHTS
    );

    // Aggregate 24-hour forecast (50/50)
    const next24Hours = this.aggregateForecastPeriods(
      estonianData.next24Hours,
      openMeteoData.next24Hours,
      this.FORECAST_WEIGHTS
    );

    // Create summary from aggregated data
    const temps = next24Hours.map(h => h.temperature).filter(t => t !== null);
    const precips = next24Hours.map(h => h.precipitation).filter(p => p !== null);
    const precipProbs = next24Hours.map(h => h.precipitationProbability).filter(p => p !== null);

    const summary = {
      minTemp: temps.length > 0 ? Math.min(...temps) : null,
      maxTemp: temps.length > 0 ? Math.max(...temps) : null,
      totalPrecipitation: precips.length > 0 ? precips.reduce((a, b) => a + b, 0) : 0,
      maxPrecipProbability: precipProbs.length > 0 ? Math.max(...precipProbs) : 0,
      conditions: this.combineConditions(estonianData.summary, openMeteoData.summary)
    };

    return {
      location: 'Kaiu, Raplamaa',
      current,
      next24Hours,
      summary,
      issuedAt: new Date().toISOString(),
      source: 'aggregated'
    };
  }

  /**
   * Aggregate current weather conditions
   * @param {Object} estonian - Estonian current data
   * @param {Object} openMeteo - Open-Meteo current data
   * @param {Object} weights - Weighting factors
   * @returns {Object} Aggregated current conditions
   */
  aggregateCurrent(estonian, openMeteo, weights) {
    const weighted = (est, om) => {
      if (est === null && om === null) return null;
      if (est === null) return om;
      if (om === null) return est;
      return Math.round((est * weights.estonian + om * weights.openMeteo) * 10) / 10;
    };

    return {
      temperature: weighted(estonian.temperature, openMeteo.temperature),
      apparentTemperature: openMeteo.apparentTemperature, // Only from Open-Meteo
      phenomenon: estonian.phenomenon || estonian.conditions, // Prefer Estonian (in Estonian language)
      windSpeed: weighted(estonian.windSpeed, openMeteo.windSpeed),
      windDirection: estonian.windDirection || openMeteo.windDirection,
      precipitation: weighted(estonian.precipitation, openMeteo.precipitation),
      cloudCover: openMeteo.cloudCover, // Only from Open-Meteo
      humidity: openMeteo.humidity, // Only from Open-Meteo
      time: openMeteo.time || new Date()
    };
  }

  /**
   * Aggregate forecast periods (hourly data)
   * @param {Array} estonian - Estonian hourly data
   * @param {Array} openMeteo - Open-Meteo hourly data
   * @param {Object} weights - Weighting factors
   * @returns {Array} Aggregated hourly data
   */
  aggregateForecastPeriods(estonian, openMeteo, weights) {
    const maxLength = Math.max(estonian.length, openMeteo.length);
    const aggregated = [];

    for (let i = 0; i < maxLength; i++) {
      const est = estonian[i] || {};
      const om = openMeteo[i] || {};

      const weighted = (estVal, omVal) => {
        if (estVal === null && omVal === null) return null;
        if (estVal === null) return omVal;
        if (omVal === null) return estVal;
        return Math.round((estVal * weights.estonian + omVal * weights.openMeteo) * 10) / 10;
      };

      aggregated.push({
        time: om.time || est.time,
        temperature: weighted(est.temperature, om.temperature),
        apparentTemperature: om.apparentTemperature || null,
        phenomenon: est.phenomenon || est.conditions,
        windSpeed: weighted(est.windSpeed, om.windSpeed),
        windDirection: est.windDirection || om.windDirection,
        windDegrees: est.windDegrees || om.windDirection,
        precipitation: weighted(est.precipitation, om.precipitation),
        precipitationProbability: om.precipitationProbability || null,
        cloudCover: om.cloudCover || null,
        humidity: om.humidity || null,
        snowfall: om.snowfall || 0
      });
    }

    return aggregated.slice(0, 24); // Ensure 24 hours
  }

  /**
   * Combine condition descriptions from both sources
   * @param {Object} estonianSummary - Estonian summary data
   * @param {Object} openMeteoSummary - Open-Meteo summary data
   * @returns {Array} Combined conditions
   */
  combineConditions(estonianSummary, openMeteoSummary) {
    const conditions = new Set();

    if (estonianSummary.conditions) {
      estonianSummary.conditions.forEach(c => conditions.add(c));
    }

    if (openMeteoSummary.conditions) {
      openMeteoSummary.conditions.forEach(c => conditions.add(c));
    }

    return Array.from(conditions);
  }

  /**
   * Compare data from both sources
   * @param {Object} estonianData - Estonian weather data
   * @param {Object} openMeteoData - Open-Meteo weather data
   * @returns {Object} Comparison metrics
   */
  compareSourceData(estonianData, openMeteoData) {
    const current = {
      temperature: {
        estonian: estonianData.current.temperature,
        openMeteo: openMeteoData.current.temperature,
        difference: this.calculateDifference(
          estonianData.current.temperature,
          openMeteoData.current.temperature
        )
      },
      windSpeed: {
        estonian: estonianData.current.windSpeed,
        openMeteo: openMeteoData.current.windSpeed,
        difference: this.calculateDifference(
          estonianData.current.windSpeed,
          openMeteoData.current.windSpeed
        )
      },
      precipitation: {
        estonian: estonianData.current.precipitation,
        openMeteo: openMeteoData.current.precipitation,
        difference: this.calculateDifference(
          estonianData.current.precipitation,
          openMeteoData.current.precipitation
        )
      }
    };

    const summary = {
      tempRange: {
        estonian: { min: estonianData.summary.minTemp, max: estonianData.summary.maxTemp },
        openMeteo: { min: openMeteoData.summary.minTemp, max: openMeteoData.summary.maxTemp },
        minDifference: this.calculateDifference(
          estonianData.summary.minTemp,
          openMeteoData.summary.minTemp
        ),
        maxDifference: this.calculateDifference(
          estonianData.summary.maxTemp,
          openMeteoData.summary.maxTemp
        )
      },
      totalPrecipitation: {
        estonian: estonianData.summary.totalPrecipitation,
        openMeteo: openMeteoData.summary.totalPrecipitation,
        difference: this.calculateDifference(
          estonianData.summary.totalPrecipitation,
          openMeteoData.summary.totalPrecipitation
        )
      }
    };

    // Calculate overall agreement score (0-100, higher is better)
    const agreementScore = this.calculateAgreementScore(current, summary);

    return {
      current,
      summary,
      agreementScore
    };
  }

  /**
   * Calculate difference between two values
   * @param {number} val1 - First value
   * @param {number} val2 - Second value
   * @returns {number} Absolute difference
   */
  calculateDifference(val1, val2) {
    if (val1 === null || val2 === null) return null;
    return Math.round(Math.abs(val1 - val2) * 10) / 10;
  }

  /**
   * Calculate overall agreement score between sources
   * @param {Object} current - Current conditions comparison
   * @param {Object} summary - Summary comparison
   * @returns {number} Agreement score (0-100)
   */
  calculateAgreementScore(current, summary) {
    const scores = [];

    // Temperature agreement (±2°C = 100%, ±10°C = 0%)
    if (current.temperature.difference !== null) {
      const tempScore = Math.max(0, 100 - (current.temperature.difference / 10) * 100);
      scores.push(tempScore);
    }

    // Wind speed agreement (±2 m/s = 100%, ±10 m/s = 0%)
    if (current.windSpeed.difference !== null) {
      const windScore = Math.max(0, 100 - (current.windSpeed.difference / 10) * 100);
      scores.push(windScore);
    }

    // Precipitation agreement (±1mm = 100%, ±5mm = 0%)
    if (current.precipitation.difference !== null) {
      const precipScore = Math.max(0, 100 - (current.precipitation.difference / 5) * 100);
      scores.push(precipScore);
    }

    // Average the scores
    return scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  }

  /**
   * Check for significant disagreements between sources
   * @param {Object} comparison - Comparison metrics
   * @returns {Array} Array of alert objects
   */
  checkDisagreements(comparison) {
    const alerts = [];

    // Check current temperature
    if (comparison.current.temperature.difference !== null &&
        comparison.current.temperature.difference > this.DISAGREEMENT_THRESHOLDS.temperature) {
      alerts.push({
        type: 'temperature',
        severity: 'warning',
        message: `Sources disagree on current temperature by ${comparison.current.temperature.difference}°C`,
        estonian: comparison.current.temperature.estonian,
        openMeteo: comparison.current.temperature.openMeteo
      });
    }

    // Check precipitation
    if (comparison.summary.totalPrecipitation.difference !== null &&
        comparison.summary.totalPrecipitation.difference > this.DISAGREEMENT_THRESHOLDS.precipitation) {
      alerts.push({
        type: 'precipitation',
        severity: 'warning',
        message: `Sources disagree on 24h precipitation by ${comparison.summary.totalPrecipitation.difference}mm`,
        estonian: comparison.summary.totalPrecipitation.estonian,
        openMeteo: comparison.summary.totalPrecipitation.openMeteo
      });
    }

    // Check wind speed
    if (comparison.current.windSpeed.difference !== null &&
        comparison.current.windSpeed.difference > this.DISAGREEMENT_THRESHOLDS.windSpeed) {
      alerts.push({
        type: 'wind_speed',
        severity: 'info',
        message: `Sources disagree on wind speed by ${comparison.current.windSpeed.difference} m/s`,
        estonian: comparison.current.windSpeed.estonian,
        openMeteo: comparison.current.windSpeed.openMeteo
      });
    }

    return alerts;
  }

  /**
   * Format single source data when only one is available
   * @param {Object} data - Parsed weather data
   * @param {string} sourceName - Name of the source
   * @param {Object} sources - Original source fetch results
   * @returns {Object} Formatted data
   */
  formatSingleSource(data, sourceName, sources) {
    return {
      ...data,
      source: sourceName,
      sources: {
        estonian: {
          available: sources.estonian.success,
          data: sources.estonian.parsed || null
        },
        openMeteo: {
          available: sources.openMeteo.success,
          data: sources.openMeteo.parsed || null
        }
      },
      comparison: null,
      alerts: [{
        type: 'single_source',
        severity: 'warning',
        message: `Only ${sourceName} data available`,
        details: sourceName === 'open-meteo'
          ? 'Estonian Weather Service unavailable'
          : 'Open-Meteo unavailable'
      }],
      fetchTime: sources.fetchTime,
      aggregatedAt: new Date().toISOString()
    };
  }

  /**
   * Format aggregated data for AI blurb context
   * @param {Object} aggregatedData - Aggregated forecast data
   * @returns {Object} Formatted context for AI blurb generation
   */
  formatForBlurbContext(aggregatedData) {
    const { current, next24Hours, summary } = aggregatedData;

    // Group next 24 hours into time periods
    const morning = next24Hours.slice(0, 6);
    const afternoon = next24Hours.slice(6, 12);
    const evening = next24Hours.slice(12, 18);
    const night = next24Hours.slice(18, 24);

    return {
      current: {
        temperature: current.temperature,
        apparentTemperature: current.apparentTemperature,
        phenomenon: current.phenomenon,
        windSpeed: current.windSpeed,
        windDirection: current.windDirection,
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
        totalPrecipitation: summary.totalPrecipitation,
        maxPrecipProbability: summary.maxPrecipProbability,
        dominantConditions: summary.conditions.slice(0, 3).join(', ')
      },
      metadata: {
        source: aggregatedData.source,
        agreementScore: aggregatedData.comparison?.agreementScore,
        alerts: aggregatedData.alerts
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
    const conditions = [...new Set(hours.map(h => h.phenomenon).filter(p => p))];
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
      precipProbability: precipProbs.length > 0 ? Math.max(...precipProbs) : null,
      avgWind: winds.length > 0 ? Math.round(winds.reduce((a, b) => a + b, 0) / winds.length * 10) / 10 : null,
      avgCloudCover: clouds.length > 0 ? Math.round(clouds.reduce((a, b) => a + b, 0) / clouds.length) : null
    };
  }
}

module.exports = new WeatherAggregator();
