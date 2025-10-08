/**
 * Weather Popup Module for Kaiu Kodukant
 * Displays AI-generated Estonian weather blurbs in a fun popup
 */

class WeatherPopup {
    constructor() {
        // Use the API URL from config if available, otherwise use direct URL
        // This ensures consistency with other API calls and proper CORS handling
        this.apiUrl = window.API_BASE_URL ?
            `${window.API_BASE_URL}/api/v1/weather` :
            'https://api.kaiukodukant.ee/api/v1/weather';
        this.popup = null;
        this.isVisible = false;
        this.lastFetch = null;
        this.weatherData = null;
        this.updateInterval = 3600000; // Check for updates every hour
        this.init();
    }

    init() {
        // Create popup element
        this.createPopup();

        // Check local storage for preferences
        this.loadPreferences();

        // Set up periodic updates
        this.startUpdateTimer();
    }

    createPopup() {
        const popupHtml = `
            <div id="weather-popup" class="weather-popup hidden">
                <div class="weather-header">
                    <div class="weather-icon-container">
                        <span class="weather-icon" id="weather-icon">☁️</span>
                        <span class="weather-temp" id="weather-temp">--°C</span>
                    </div>
                    <button class="weather-close" id="weather-close" aria-label="Sulge">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 5L5 15M5 5l10 10"/>
                        </svg>
                    </button>
                </div>
                <div class="weather-blurb" id="weather-blurb">
                    <div class="weather-loading">
                        <div class="spinner"></div>
                        <span>Laadin ilmateateid...</span>
                    </div>
                </div>
                <div class="weather-footer">
                    <span class="weather-location">📍 Kaiu, Raplamaa</span>
                    <span class="weather-timestamp" id="weather-timestamp">--:--</span>
                </div>
            </div>
        `;

        // Add popup to body
        document.body.insertAdjacentHTML('beforeend', popupHtml);
        this.popup = document.getElementById('weather-popup');

        // Add styles
        this.injectStyles();

        // Set up event listeners
        this.setupEventListeners();
    }

    injectStyles() {
        if (document.getElementById('weather-popup-styles')) return;

        const styles = `
            <style id="weather-popup-styles">
                .weather-popup {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 320px;
                    max-width: calc(100vw - 40px);
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
                    padding: 20px;
                    z-index: 9999;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: translateY(0);
                    opacity: 1;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }

                .weather-popup.hidden {
                    transform: translateY(calc(100% + 20px));
                    opacity: 0;
                    pointer-events: none;
                }

                .weather-popup.showing {
                    animation: slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }

                @keyframes slideInUp {
                    from {
                        transform: translateY(calc(100% + 20px));
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                .weather-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }

                .weather-icon-container {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .weather-icon {
                    font-size: 32px;
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }

                .weather-temp {
                    font-size: 24px;
                    font-weight: 700;
                    color: #1a1a1a;
                }

                .weather-close {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    color: #6b7280;
                    transition: all 0.2s;
                    border-radius: 6px;
                }

                .weather-close:hover {
                    background: rgba(0, 0, 0, 0.05);
                    color: #374151;
                }

                .weather-blurb {
                    min-height: 80px;
                    color: #4b5563;
                    font-size: 14px;
                    line-height: 1.6;
                    margin-bottom: 15px;
                    font-family: 'Inter', system-ui, sans-serif;
                }

                .weather-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 20px 0;
                }

                .spinner {
                    width: 24px;
                    height: 24px;
                    border: 3px solid #e5e7eb;
                    border-top-color: #EC5B29;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .weather-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                    color: #9ca3af;
                    padding-top: 12px;
                    border-top: 1px solid #f3f4f6;
                }

                .weather-location {
                    font-weight: 500;
                }

                .weather-timestamp {
                    font-style: italic;
                }

                /* Mobile adjustments */
                @media (max-width: 640px) {
                    .weather-popup {
                        width: calc(100vw - 40px);
                        bottom: 10px;
                        right: 10px;
                        left: 10px;
                    }
                }

                /* Footer weather trigger icon */
                .weather-trigger {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 6px;
                    transition: all 0.2s;
                    font-size: 14px;
                    color: #6b7280;
                }

                .weather-trigger:hover {
                    background: rgba(236, 91, 41, 0.1);
                    color: #EC5B29;
                    transform: scale(1.05);
                }

                .weather-trigger-icon {
                    font-size: 20px;
                    animation: float 3s ease-in-out infinite;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('weather-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.popup.contains(e.target) && !e.target.closest('.weather-trigger')) {
                this.hide();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    async fetchWeatherData() {
        try {
            const response = await fetch(`${this.apiUrl}/current`);
            if (!response.ok) throw new Error(`Failed to fetch weather data: ${response.status}`);

            const result = await response.json();

            // Extract data from the nested response structure
            const data = result.success && result.data ? result.data : result;

            this.weatherData = data;
            this.lastFetch = Date.now();

            // Save to local storage
            this.saveToLocalStorage('weatherData', data);
            this.saveToLocalStorage('lastFetch', this.lastFetch);

            return data;
        } catch (error) {
            console.error('Weather fetch error:', error);

            // Try to load from local storage
            const cachedData = this.loadFromLocalStorage('weatherData');
            if (cachedData) {
                this.weatherData = cachedData;
                return cachedData;
            }

            return null;
        }
    }

    updatePopupContent(data) {
        if (!data) {
            document.getElementById('weather-blurb').innerHTML =
                '<p style="color: #ef4444;">Ilmateate laadimine ebaõnnestus. Proovi hiljem uuesti.</p>';
            return;
        }

        // Update temperature
        const tempElement = document.getElementById('weather-temp');
        if (tempElement && data.temperature !== undefined) {
            tempElement.textContent = `${Math.round(data.temperature)}°C`;
        }

        // Update weather icon
        const iconElement = document.getElementById('weather-icon');
        if (iconElement) {
            // If icon is already an emoji, use it directly
            if (data.icon && (data.icon.includes('️') || data.icon.includes('☀') || data.icon.includes('☁') ||
                data.icon.includes('🌧') || data.icon.includes('❄') || data.icon.includes('⛅'))) {
                iconElement.textContent = data.icon;
            } else {
                iconElement.textContent = this.getWeatherEmoji(data.icon || data.conditions);
            }
        }

        // Update blurb text
        const blurbElement = document.getElementById('weather-blurb');
        if (blurbElement && data.blurb) {
            blurbElement.innerHTML = `<p>${data.blurb}</p>`;
        }

        // Update timestamp
        const timestampElement = document.getElementById('weather-timestamp');
        if (timestampElement && data.timestamp) {
            timestampElement.textContent = this.formatTimestamp(data.timestamp);
        }
    }

    getWeatherEmoji(condition) {
        const iconMap = {
            'clear': '☀️',
            'sunny': '☀️',
            'partly-cloudy': '⛅',
            'cloudy': '☁️',
            'overcast': '☁️',
            'rain': '🌧️',
            'drizzle': '🌦️',
            'snow': '❄️',
            'thunderstorm': '⛈️',
            'fog': '🌫️',
            'wind': '💨️',
            'selge': '☀️',
            'päikesepaisteline': '☀️',
            'pilves': '☁️',
            'vihm': '🌧️',
            'lumi': '❄️'
        };

        const conditionLower = (condition || '').toLowerCase();

        // Check for matches in the icon map
        for (const [key, emoji] of Object.entries(iconMap)) {
            if (conditionLower.includes(key)) {
                return emoji;
            }
        }

        // Default icon
        return '⛅';
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) {
            return 'Just nüüd';
        } else if (diffMins < 60) {
            return `${diffMins} min tagasi`;
        } else if (diffHours < 24) {
            return `${diffHours}h tagasi`;
        } else {
            return date.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' });
        }
    }

    async show() {
        if (this.isVisible) return;

        // Check if we need to fetch new data
        const shouldFetch = !this.lastFetch ||
                           (Date.now() - this.lastFetch > 300000) || // 5 minutes
                           !this.weatherData;

        if (shouldFetch) {
            // Show loading state
            this.popup.classList.remove('hidden');
            this.popup.classList.add('showing');
            document.getElementById('weather-blurb').innerHTML = `
                <div class="weather-loading">
                    <div class="spinner"></div>
                    <span>Laen ilmateate...</span>
                </div>
            `;

            const data = await this.fetchWeatherData();
            this.updatePopupContent(data);
        } else {
            // Use cached data
            this.updatePopupContent(this.weatherData);
            this.popup.classList.remove('hidden');
            this.popup.classList.add('showing');
        }

        this.isVisible = true;

        // Save shown timestamp
        this.saveToLocalStorage('lastShown', Date.now());
    }

    hide() {
        if (!this.isVisible) return;

        this.popup.classList.add('hidden');
        this.popup.classList.remove('showing');
        this.isVisible = false;

        // Save hidden timestamp
        this.saveToLocalStorage('lastHidden', Date.now());
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    startUpdateTimer() {
        // Update weather data periodically in the background
        setInterval(async () => {
            if (!this.isVisible) {
                // Silently update in background
                await this.fetchWeatherData();
            }
        }, this.updateInterval);
    }

    loadPreferences() {
        const prefs = this.loadFromLocalStorage('weatherPreferences') || {};

        // Check if user has dismissed popup recently
        const lastHidden = this.loadFromLocalStorage('lastHidden');
        const lastShown = this.loadFromLocalStorage('lastShown');

        if (lastHidden && lastShown) {
            const timeSinceHidden = Date.now() - lastHidden;
            // Don't auto-show if hidden less than 24 hours ago
            if (timeSinceHidden < 86400000) {
                this.autoShowDisabled = true;
            }
        }

        return prefs;
    }

    saveToLocalStorage(key, value) {
        try {
            localStorage.setItem(`weather_${key}`, JSON.stringify(value));
        } catch (e) {
            console.error('Failed to save to local storage:', e);
        }
    }

    loadFromLocalStorage(key) {
        try {
            const item = localStorage.getItem(`weather_${key}`);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('Failed to load from local storage:', e);
            return null;
        }
    }

    // Create footer trigger element
    createFooterTrigger() {
        const triggerHtml = `
            <span class="weather-trigger" id="weather-trigger" title="Vaata ilmateateid">
                <span class="weather-trigger-icon" id="weather-trigger-icon">⛅</span>
                <span class="weather-trigger-text">Ilm</span>
            </span>
        `;

        return triggerHtml;
    }

    // Update footer trigger icon based on current weather
    async updateFooterTriggerIcon() {
        const icon = document.getElementById('weather-trigger-icon');
        if (!icon) return;

        // Fetch latest weather if needed
        if (!this.weatherData || Date.now() - this.lastFetch > 300000) {
            await this.fetchWeatherData();
        }

        if (this.weatherData) {
            // If icon is already an emoji, use it directly
            if (this.weatherData.icon && (this.weatherData.icon.includes('️') || this.weatherData.icon.includes('☀') ||
                this.weatherData.icon.includes('☁') || this.weatherData.icon.includes('🌧') ||
                this.weatherData.icon.includes('❄') || this.weatherData.icon.includes('⛅'))) {
                icon.textContent = this.weatherData.icon;
            } else {
                icon.textContent = this.getWeatherEmoji(this.weatherData.icon || this.weatherData.conditions);
            }
        }
    }

    // Update all weather trigger icons (header, footer, mobile)
    async updateAllTriggerIcons() {
        const iconIds = [
            'weather-trigger-icon',
            'weather-trigger-icon-header',
            'weather-trigger-icon-mobile'
        ];

        // Fetch latest weather if needed
        if (!this.weatherData || Date.now() - this.lastFetch > 300000) {
            await this.fetchWeatherData();
        }

        if (this.weatherData) {
            iconIds.forEach(iconId => {
                const icon = document.getElementById(iconId);
                if (icon) {
                    // If icon is already an emoji, use it directly
                    if (this.weatherData.icon && (this.weatherData.icon.includes('️') ||
                        this.weatherData.icon.includes('☀') || this.weatherData.icon.includes('☁') ||
                        this.weatherData.icon.includes('🌧') || this.weatherData.icon.includes('❄') ||
                        this.weatherData.icon.includes('⛅'))) {
                        icon.textContent = this.weatherData.icon;
                    } else {
                        icon.textContent = this.getWeatherEmoji(this.weatherData.icon || this.weatherData.conditions);
                    }
                }
            });
        }
    }
}

// Export for use in other modules
window.WeatherPopup = WeatherPopup;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.weatherPopup = new WeatherPopup();
    });
} else {
    window.weatherPopup = new WeatherPopup();
}