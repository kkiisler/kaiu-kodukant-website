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
   * Get a formatted description of current sun state
   * @param {Date} date - The date/time to check
   * @returns {string} Human-readable sun state
   */
  getSunStateDescription(date = new Date()) {
    const times = this.getSunTimes(date);
    const now = date.getTime();

    // SunCalc times explanation:
    // - nightEnd: End of night (morning astronomical twilight begins)
    // - nauticalDawn: Morning nautical twilight begins
    // - dawn: Morning civil twilight begins
    // - sunrise: Sunrise
    // - sunriseEnd: Sunrise ends
    // - goldenHourEnd: Morning golden hour ends
    // - solarNoon: Solar noon
    // - goldenHour: Evening golden hour begins
    // - sunsetStart: Sunset begins
    // - sunset: Sunset
    // - dusk: Evening civil twilight ends
    // - nauticalDusk: Evening nautical twilight ends
    // - night: Night begins (astronomical twilight ends)

    // Night (before nightEnd or after night)
    if (times.nightEnd && now < times.nightEnd.getTime()) {
      return 'öö'; // Night
    }

    // Astronomical twilight (morning: between nightEnd and nauticalDawn)
    if (times.nauticalDawn && now < times.nauticalDawn.getTime()) {
      return 'öö'; // Still dark enough to be considered night
    }

    // Nautical twilight (morning: between nauticalDawn and dawn)
    if (times.dawn && now < times.dawn.getTime()) {
      return 'koidik'; // Nautical twilight / early dawn
    }

    // Civil twilight / Dawn (between dawn and sunrise)
    if (times.sunrise && now < times.sunrise.getTime()) {
      return 'koit'; // Dawn / civil twilight
    }

    // Morning golden hour (between sunrise and goldenHourEnd)
    if (times.goldenHourEnd && now < times.goldenHourEnd.getTime()) {
      return 'päikesetõus'; // Sunrise / golden hour
    }

    // Solar noon (within 30 minutes of solar noon)
    if (times.solarNoon && Math.abs(now - times.solarNoon.getTime()) < 1800000) {
      return 'keskpäev'; // Midday
    }

    // Evening golden hour (between goldenHour and sunset)
    if (times.goldenHour && now >= times.goldenHour.getTime() && times.sunset && now < times.sunset.getTime()) {
      return 'kuldne tund'; // Golden hour
    }

    // Sunset (between sunset and dusk)
    if (times.sunset && now >= times.sunset.getTime() && times.dusk && now < times.dusk.getTime()) {
      return 'loojang'; // Sunset
    }

    // Civil twilight (evening: between dusk and nauticalDusk)
    if (times.dusk && now >= times.dusk.getTime() && times.nauticalDusk && now < times.nauticalDusk.getTime()) {
      return 'videvik'; // Dusk / civil twilight
    }

    // Nautical twilight (evening: between nauticalDusk and night)
    if (times.nauticalDusk && now >= times.nauticalDusk.getTime() && times.night && now < times.night.getTime()) {
      return 'hämarik'; // Nautical twilight
    }

    // Night (after night begins)
    if (times.night && now >= times.night.getTime()) {
      return 'öö'; // Night
    }

    // Fallback: use day/night determination based on civil twilight
    if (this.isDayTime(date)) {
      return 'päev'; // Day
    } else {
      return 'öö'; // Night
    }
  }
}

module.exports = new SunPositionService();