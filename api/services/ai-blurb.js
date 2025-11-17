// AI Blurb Generator Service
// Generates Estonian weather blurbs using OpenAI GPT-4o-mini

const OpenAI = require('openai');
const database = require('./database');

class AIBlurbGenerator {
  constructor() {
    // Initialize OpenAI client if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey
      });
      this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');
      this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '200');
    } else {
      console.warn('OpenAI API key not configured - weather blurbs will not be generated');
      this.openai = null;
    }
  }

  /**
   * Generate a weather blurb based on forecast data
   * @param {Object} weatherData - Parsed weather data from weather service
   * @returns {Object} Generated blurb with metadata
   */
  async generateBlurb(weatherData) {
    if (!this.openai) {
      throw new Error('OpenAI API not configured');
    }

    try {
      // Get previous blurbs for context
      const previousBlurbs = await this.getPreviousBlurbs();

      // Prepare the prompt
      const userPrompt = this.buildUserPrompt(weatherData, previousBlurbs);

      // Call OpenAI API with retry logic
      let lastError = null;
      const maxRetries = 3;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const completion = await this.openai.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: this.getSystemPrompt()
              },
              {
                role: 'user',
                content: userPrompt
              }
            ],
            temperature: this.temperature,
            max_tokens: this.maxTokens
          });

          const blurbText = completion.choices[0].message.content.trim();
          const usage = completion.usage;

          return {
            blurb_text: blurbText,
            generation_model: this.model,
            generation_tokens: usage ? usage.total_tokens : null,
            weather_data: weatherData,
            temperature: weatherData.current?.temperature || null,
            conditions: weatherData.current?.phenomenon || null,
            wind_speed: weatherData.current?.windSpeed || null,
            wind_direction: weatherData.current?.windDirection || null,
            precipitation: weatherData.current?.precipitation || null
          };
        } catch (error) {
          lastError = error;

          // Check for rate limit error (429)
          if (error.status === 429 || error.response?.status === 429) {
            const delay = (attempt + 1) * 10000; // 10s, 20s, 30s
            console.warn(`OpenAI rate limited, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // Check if error is retryable
          const isRetryable = error.status >= 500 || // Server error
                            error.code === 'ECONNABORTED' || // Timeout
                            error.code === 'ENOTFOUND' || // DNS error
                            error.code === 'ECONNREFUSED'; // Connection refused

          if (isRetryable && attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            console.warn(`OpenAI API attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // Non-retryable error or last attempt
            console.error(`OpenAI API error on attempt ${attempt + 1}:`, error.message || error);
          }
        }
      }

      // All retries failed
      console.error('Failed to generate blurb after all retries:', lastError);
      throw lastError;
    } catch (error) {
      console.error('Error in generateBlurb:', error);
      throw error;
    }
  }

  /**
   * Get system prompt for Estonian weather blurb generation
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `Sa oled Kaiu Ilmajutu Kirjutaja—assistent, kes kirjutab lühikesi, sõbralikke ilmateateid Kaiu kogukonna veebilehele.

PUBLIK: Kaiu elanikud
VÄRSKENDUSE SAGEDUS: iga 4 tunni tagant
STIIL: lõbus, soe, vestlev; mitte ametlik/tehniline; mitte kaootilline
KEEL: AINULT eesti keel
PIKKUS: ~60–120 sõna, 1–3 lühikest lõiku, MITTE täppnimekirju

EMOJID: valikulised, max 1–2 kui sobivad loomulikult (☀️🌧️💨)

KAASA LOOMULIKULT: temperatuurivahemik, sademete võimalus/maht, tuule suund ja kiirus, taeva iseloom (päike/pilved/vihm/udu), sobiv ajaviide või väike tähelepanek

KOHALIK VIBE: väljendid nagu "kampsuniilm", "vihmapaus", "päike piilub" on head aga ära neid üle kasuta. Ole väljendite osas loov.

AJAVÖÖND: tõlgenda ajatempleid kui Europe/Tallinn

MITTE HALLUTSINEERIDA: kasuta ainult antud andmeid; kui midagi puudub, jäta mainimata

KORDUSTE KONTROLL: varieerida sõnastust; vältida fraaside kopeerimist hiljutistest kirjutistest

VÄLJUND: tagasta ÜKS AINUKE ilmakirjutis (lihttekst), valmis kuvamiseks; MITTE pealkirju, mitte metaandmeid`;
  }

  /**
   * Build user prompt with weather data and previous blurbs
   * @param {Object} weatherData - Current weather data
   * @param {Array} previousBlurbs - Previous blurb texts
   * @returns {string} User prompt
   */
  buildUserPrompt(weatherData, previousBlurbs) {
    // Get current time in Estonian timezone
    const now = new Date();
    const estonianTime = now.toLocaleString('et-EE', {
      timeZone: 'Europe/Tallinn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const context = {
      location: 'Kaiu, Raplamaa',
      forecast_json: weatherData,
      previous_blurbs: previousBlurbs,
      now_estonian: estonianTime
    };

    let prompt = `Kirjuta ilmateade järgmiste andmete põhjal:\n\n`;
    prompt += `ASUKOHT: ${context.location}\n`;
    prompt += `PRAEGUNE AEG (Eesti aeg): ${context.now_estonian}\n\n`;

    if (weatherData.current) {
      prompt += `HETKE ILM:\n`;
      prompt += `- Temperatuur: ${weatherData.current.temperature}°C\n`;

      // Add apparent temperature if available (from Open-Meteo)
      if (weatherData.current.apparentTemperature !== undefined &&
          weatherData.current.apparentTemperature !== null &&
          weatherData.current.apparentTemperature !== weatherData.current.temperature) {
        prompt += `- Tundub nagu: ${weatherData.current.apparentTemperature}°C\n`;
      }

      prompt += `- Tingimused: ${weatherData.current.phenomenon}\n`;

      // Add cloud cover if available
      if (weatherData.current.cloudCover !== undefined && weatherData.current.cloudCover !== null) {
        prompt += `- Pilvisus: ${weatherData.current.cloudCover}%\n`;
      }

      // Add humidity if available
      if (weatherData.current.humidity !== undefined && weatherData.current.humidity !== null) {
        prompt += `- Õhuniiskus: ${weatherData.current.humidity}%\n`;
      }

      prompt += `- Tuul: ${weatherData.current.windSpeed} m/s ${weatherData.current.windDirection || ''}\n`;
      prompt += `- Sademed: ${weatherData.current.precipitation} mm\n\n`;
    }

    if (weatherData.periods) {
      prompt += `JÄRGMISED 24 TUNDI:\n`;
      Object.values(weatherData.periods).forEach(period => {
        if (period.data !== null || period.tempRange) {
          let periodInfo = `- ${period.period}: ${period.tempRange}`;

          // Add apparent temperature range if significantly different
          if (period.apparentTempRange && period.apparentTempRange !== period.tempRange) {
            periodInfo += ` (tundub nagu ${period.apparentTempRange})`;
          }

          periodInfo += `, ${period.conditions}`;

          // Add precipitation probability if available
          if (period.precipProbability !== undefined && period.precipProbability !== null && period.precipProbability > 0) {
            periodInfo += `, sademete tõenäosus ${period.precipProbability}%`;
          }

          periodInfo += `, sademed ${period.precipitation} mm`;

          // Add cloud cover info if available
          if (period.avgCloudCover !== undefined && period.avgCloudCover !== null) {
            periodInfo += `, pilvisus ${period.avgCloudCover}%`;
          }

          prompt += periodInfo + '\n';
        }
      });
      prompt += '\n';
    }

    if (weatherData.summary) {
      prompt += `KOKKUVÕTE:\n`;
      prompt += `- Temperatuurivahemik: ${weatherData.summary.tempRange}\n`;

      // Add max precipitation probability if available
      if (weatherData.summary.maxPrecipProbability !== undefined &&
          weatherData.summary.maxPrecipProbability !== null &&
          weatherData.summary.maxPrecipProbability > 0) {
        prompt += `- Maksimaalne sademete tõenäosus: ${weatherData.summary.maxPrecipProbability}%\n`;
      }

      prompt += `- Sademeid kokku 24h: ${weatherData.summary.totalPrecipitation} mm\n`;
      prompt += `- Üldised tingimused: ${weatherData.summary.dominantConditions}\n`;

      // Add data source quality indicator if available
      if (weatherData.metadata?.agreementScore !== undefined && weatherData.metadata?.agreementScore !== null) {
        prompt += `- Andmete usaldusväärsus: ${weatherData.metadata.agreementScore}% (mitu allikat kinnitavad)\n`;
      }

      prompt += '\n';
    }

    if (previousBlurbs.length > 0) {
      prompt += `EELMISED KIRJUTISED (väldi kordamist):\n`;
      previousBlurbs.slice(0, 4).forEach((blurb, i) => {
        prompt += `${i + 1}. "${blurb}"\n`;
      });
      prompt += '\n';
    }

    prompt += `Palun kirjuta soe ja sõbralik ilmateade Kaiu elanikele, mis lõpeb lühikese tervitusega (nt "Naudi ilma, Kaiu!" või "Ilusat päeva, Kaiu rahvas!").`;

    return prompt;
  }

  /**
   * Get previous blurbs from database for context
   * @returns {Array} Array of previous blurb texts
   */
  async getPreviousBlurbs() {
    try {
      const history = database.getWeatherBlurbHistory(20);
      return history.map(b => b.blurb_text);
    } catch (error) {
      console.error('Error fetching previous blurbs:', error);
      return [];
    }
  }

  /**
   * Generate and save a new weather blurb
   * @param {Object} weatherData - Weather data from weather service
   * @returns {Object} Saved blurb data
   */
  async generateAndSaveBlurb(weatherData) {
    try {
      // Generate the blurb
      const blurbData = await this.generateBlurb(weatherData);

      // Save to database
      const id = database.addWeatherBlurb(blurbData);

      // Clean up old data (keep only 20 latest blurbs)
      database.cleanupOldWeatherData(20);

      return {
        id,
        ...blurbData,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating and saving blurb:', error);
      throw error;
    }
  }

  /**
   * Generate a fallback blurb when API is unavailable
   * @param {Object} weatherData - Weather data
   * @returns {Object} Fallback blurb
   */
  generateFallbackBlurb(weatherData) {
    const temp = weatherData.current?.temperature || 'N/A';
    const conditions = weatherData.current?.phenomenon || 'N/A';
    const wind = weatherData.current?.windSpeed || 'N/A';

    const blurbText = `Tänane ilm Kaius: ${temp}°C, ${conditions}. Tuul ${wind} m/s. Naudi päeva, Kaiu!`;

    return {
      blurb_text: blurbText,
      generation_model: 'fallback',
      generation_tokens: 0,
      weather_data: weatherData,
      temperature: weatherData.current?.temperature || null,
      conditions: weatherData.current?.phenomenon || null,
      wind_speed: weatherData.current?.windSpeed || null,
      wind_direction: weatherData.current?.windDirection || null,
      precipitation: weatherData.current?.precipitation || null
    };
  }

  /**
   * Check if OpenAI API is configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return this.openai !== null;
  }
}

module.exports = new AIBlurbGenerator();