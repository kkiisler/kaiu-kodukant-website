const SunCalc = require('suncalc');

/**
 * Service for calculating sun position and sunrise/sunset times
 * Specifically configured for Kaiu, Raplamaa, Estonia
 */
class SunPositionService {
  constructor() {
    // Kaiu, Raplamaa coordinates
    this.latitude = 59.0106;
    this.longitude = 25.0597;

    // Day/night weather icon mappings
    this.dayIcons = {
      'selge': '☀️',           // Clear/sunny
      'päike': '☀️',           // Sunny
      'päikesepaiste': '☀️',   // Sunshine
      'vähene pilvisus': '🌤️', // Few clouds with sun
      'vähese pilvisusega': '🌤️', // Few clouds with sun
      'vahelduv pilvisus': '⛅', // Partly cloudy with sun
      'vahelduvalt pilves': '⛅', // Partly cloudy with sun
      'pilves': '☁️',          // Cloudy
      'pilvine': '☁️',         // Cloudy
      'vihm': '🌧️',           // Rain (same day/night)
      'hoovihm': '🌦️',        // Rain showers
      'vihmasadu': '🌧️',      // Rain
      'tugev vihm': '🌧️',     // Heavy rain
      'lumi': '🌨️',           // Snow (same day/night)
      'lumesadu': '🌨️',       // Snowfall
      'lörtsi': '🌨️',         // Sleet
      'äike': '⛈️',           // Thunderstorm (same day/night)
      'äikesetorm': '⛈️',     // Thunderstorm
      'udu': '🌫️',            // Fog (same day/night)
      'tuisk': '🌨️',          // Blizzard
      'hall': '🌫️',           // Mist
      'vine': '🌦️',           // Drizzle
    };

    this.nightIcons = {
      'selge': '🌙',           // Clear night with moon
      'päike': '⭐',           // Stars (shouldn't happen but fallback)
      'päikesepaiste': '⭐',   // Stars (shouldn't happen but fallback)
      'vähene pilvisus': '☁️', // Few clouds at night
      'vähese pilvisusega': '☁️', // Few clouds at night
      'vahelduv pilvisus': '☁️', // Partly cloudy at night
      'vahelduvalt pilves': '☁️', // Partly cloudy at night
      'pilves': '☁️',          // Cloudy (same)
      'pilvine': '☁️',         // Cloudy (same)
      'vihm': '🌧️',           // Rain (same day/night)
      'hoovihm': '🌦️',        // Rain showers (same)
      'vihmasadu': '🌧️',      // Rain (same)
      'tugev vihm': '🌧️',     // Heavy rain (same)
      'lumi': '🌨️',           // Snow (same day/night)
      'lumesadu': '🌨️',       // Snowfall (same)
      'lörtsi': '🌨️',         // Sleet (same)
      'äike': '⛈️',           // Thunderstorm (same day/night)
      'äikesetorm': '⛈️',     // Thunderstorm (same)
      'udu': '🌫️',            // Fog (same day/night)
      'tuisk': '🌨️',          // Blizzard (same)
      'hall': '🌫️',           // Mist (same)
      'vine': '🌦️',           // Drizzle (same)
    };
  }

  /**
   * Get sun times for a specific date
   * @param {Date} date - The date to calculate sun times for
   * @returns {Object} Object containing various sun times
   */
  getSunTimes(date = new Date()) {
    return SunCalc.getTimes(date, this.latitude, this.longitude);
  }

  /**
   * Check if it's currently daytime
   * Uses civil twilight (sun 6° below horizon) for better accuracy
   * @param {Date} date - The date/time to check
   * @returns {boolean} True if it's daytime, false if night
   */
  isDayTime(date = new Date()) {
    const times = this.getSunTimes(date);

    // Use civil twilight for more accurate day/night determination
    // Dawn = morning civil twilight begins
    // Dusk = evening civil twilight ends
    const dawn = times.dawn || times.sunrise;  // Fallback to sunrise if dawn not available
    const dusk = times.dusk || times.sunset;    // Fallback to sunset if dusk not available

    return date >= dawn && date <= dusk;
  }

  /**
   * Check if it's currently nighttime
   * @param {Date} date - The date/time to check
   * @returns {boolean} True if it's nighttime, false if day
   */
  isNightTime(date = new Date()) {
    return !this.isDayTime(date);
  }

  /**
   * Get the next sunrise or sunset time
   * @param {Date} date - The current date/time
   * @returns {Object} Object with nextTransition time and type
   */
  getNextTransition(date = new Date()) {
    const times = this.getSunTimes(date);
    const now = date.getTime();

    // Check today's transitions
    if (times.sunrise && times.sunrise.getTime() > now) {
      return {
        time: times.sunrise,
        type: 'sunrise',
        minutesUntil: Math.round((times.sunrise.getTime() - now) / 60000)
      };
    }

    if (times.sunset && times.sunset.getTime() > now) {
      return {
        time: times.sunset,
        type: 'sunset',
        minutesUntil: Math.round((times.sunset.getTime() - now) / 60000)
      };
    }

    // If both have passed, get tomorrow's sunrise
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimes = this.getSunTimes(tomorrow);

    return {
      time: tomorrowTimes.sunrise,
      type: 'sunrise',
      minutesUntil: Math.round((tomorrowTimes.sunrise.getTime() - now) / 60000)
    };
  }

  /**
   * Get weather icon based on phenomenon and time of day
   * @param {string} phenomenon - Weather phenomenon in Estonian
   * @param {Date} date - The date/time to check
   * @returns {string} Appropriate weather icon emoji
   */
  getWeatherIcon(phenomenon, date = new Date()) {
    if (!phenomenon) return '❓';

    const lowerPhenom = phenomenon.toLowerCase();
    const isDay = this.isDayTime(date);
    const iconMap = isDay ? this.dayIcons : this.nightIcons;

    // First try exact match
    if (iconMap[lowerPhenom]) {
      return iconMap[lowerPhenom];
    }

    // Then try partial matches
    for (const [key, icon] of Object.entries(iconMap)) {
      if (lowerPhenom.includes(key) || key.includes(lowerPhenom)) {
        return icon;
      }
    }

    // Default fallback
    return isDay ? '⛅' : '☁️';
  }

  /**
   * Get detailed sun position information
   * @param {Date} date - The date/time to check
   * @returns {Object} Detailed sun position data
   */
  getSunPosition(date = new Date()) {
    const position = SunCalc.getPosition(date, this.latitude, this.longitude);
    const times = this.getSunTimes(date);

    return {
      altitude: position.altitude * 180 / Math.PI,  // Convert to degrees
      azimuth: position.azimuth * 180 / Math.PI,    // Convert to degrees
      sunrise: times.sunrise,
      sunset: times.sunset,
      solarNoon: times.solarNoon,
      dawn: times.dawn,
      dusk: times.dusk,
      isDayTime: this.isDayTime(date),
      nextTransition: this.getNextTransition(date)
    };
  }

  /**
   * Get a culturally accurate Estonian time-of-day description
   * Based on variable sunrise/sunset times and fixed cultural markers
   * @param {Date} date - The date/time to check
   * @returns {string} Estonian time-of-day description
   */
  getSunStateDescription(date = new Date()) {
    const times = this.getSunTimes(date);

    // Get times in milliseconds for comparison
    const now = date.getTime();
    const sunrise = times.sunrise ? times.sunrise.getTime() : null;
    const sunset = times.sunset ? times.sunset.getTime() : null;

    if (!sunrise || !sunset) {
      // Fallback if sun times not available (shouldn't happen at this latitude)
      return this.isDayTime(date) ? 'päev' : 'öö';
    }

    // --- Algorithm Parameters ---
    const DAWN_DURATION = 60 * 60 * 1000;  // 1 hour in milliseconds
    const DUSK_DURATION = 60 * 60 * 1000;  // 1 hour in milliseconds

    // --- 1. Define Variable Boundaries ---
    // Koidik (dawn) starts 1 hour before sunrise
    const koidikStart = sunrise - DAWN_DURATION;

    // Night starts 1 hour after sunset (after videvik/dusk ends)
    const nightStart = sunset + DUSK_DURATION;

    // --- 2. Define Fixed Cultural Boundaries ---
    // Create dates for fixed times today (in local Estonian time)
    const dateLocal = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Tallinn' }));

    // Lõuna (Noon) - 12:00
    const louna = new Date(dateLocal);
    louna.setHours(12, 0, 0, 0);
    const lounaTime = louna.getTime();

    // Pärastlõuna split - 15:00
    const pealelounaSplit = new Date(dateLocal);
    pealelounaSplit.setHours(15, 0, 0, 0);
    const pealelounaSplitTime = pealelounaSplit.getTime();

    // Õhtu (Evening) start - 18:00
    const ohtuStart = new Date(dateLocal);
    ohtuStart.setHours(18, 0, 0, 0);
    const ohtuStartTime = ohtuStart.getTime();

    // --- 3. Execute Time-Check Logic (in order) ---

    // A: ÖÖ (Night) - from end of dusk until start of dawn
    // BUT: Only if it's before cultural evening time (18:00)
    // This prevents "night" at 18:00-22:00 in winter when sun sets early
    if ((now >= nightStart && now < ohtuStartTime) || now < koidikStart) {
      return 'öö';
    }

    // B: KOIDIK (Dawn) - period just before sunrise
    if (now >= koidikStart && now < sunrise) {
      return 'koidik';
    }

    // C: VIDEVIK (Dusk) - period just after sunset
    // Only if before cultural evening time
    if (now >= sunset && now < nightStart && now < ohtuStartTime) {
      return 'videvik';
    }

    // D: HOMMIK (Morning) - from sunrise until noon
    if (now >= sunrise && now < lounaTime) {
      return 'hommik';
    }

    // E: PÄEV (Day/Midday) - from noon until mid-afternoon
    if (now >= lounaTime && now < pealelounaSplitTime) {
      return 'päev';
    }

    // F: PÄRASTLÕUNA (Afternoon) - from mid-afternoon until cultural evening
    if (now >= pealelounaSplitTime && now < ohtuStartTime) {
      return 'pärastlõuna';
    }

    // G: ÕHTU (Evening) - from 18:00 until late evening (22:00)
    // This is a cultural period that overrides solar "night" in winter
    const lateEveningEnd = new Date(dateLocal);
    lateEveningEnd.setHours(22, 0, 0, 0);
    const lateEveningEndTime = lateEveningEnd.getTime();

    if (now >= ohtuStartTime && now < lateEveningEndTime) {
      return 'õhtu';
    }

    // H: ÖÖ (Night) - after late evening (22:00) regardless of sun position
    return 'öö';
  }
}

module.exports = new SunPositionService();