// Daily Summary Generator for WeatherPane Banner
// Generates adaptive daily summary text based on current conditions and solar events

class DailySummaryGenerator {
    constructor() {
        this.summaryData = {
            sunrise: null,
            sunset: null,
            solarNoon: null,
            maxTemp: null,
            minTemp: null,
            weatherCode: null,
            moonPhase: null,
            moonIllumination: null,
            precipProbability: null,
            astronomicalEvents: []
        };

        this.temperatureUnit = 'C';
        this.lastUpdate = null;
    }

    // Update the summary data
    updateData(data) {
        Object.assign(this.summaryData, data);
        this.lastUpdate = new Date();
    }

    // Set temperature unit (C or F)
    setTemperatureUnit(unit) {
        this.temperatureUnit = unit;
    }

    // Format temperature based on current unit
    formatTemp(celsius) {
        if (celsius == null) return null;
        if (this.temperatureUnit === 'F') {
            return Math.round((celsius * 9/5) + 32) + '°F';
        }
        return Math.round(celsius) + '°C';
    }

    // Get relative time description for a Date object
    getRelativeTime(targetDate, now = new Date()) {
        if (!targetDate) return null;

        const diff = targetDate - now;
        const absDiff = Math.abs(diff);
        const isPast = diff < 0;

        const minutes = Math.floor(absDiff / 60000);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        // Less than 2 minutes
        if (minutes < 2) {
            return isPast ? 'just happened' : 'in moments';
        }

        // Less than 1 hour
        if (minutes < 60) {
            const text = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
            return isPast ? `${text} ago` : `in ${text}`;
        }

        // 1-24 hours
        if (hours < 24) {
            if (mins === 0) {
                const text = `${hours} hour${hours !== 1 ? 's' : ''}`;
                return isPast ? `${text} ago` : `in ${text}`;
            } else {
                const text = `${hours} hour${hours !== 1 ? 's' : ''}, ${mins} minute${mins !== 1 ? 's' : ''}`;
                return isPast ? `${text} ago` : `in ${text}`;
            }
        }

        // More than 24 hours - just show time
        return null;
    }

    // Get moon phase name
    getMoonPhaseName(illumination) {
        if (illumination == null) return 'Unknown';

        const fraction = illumination * 100;

        if (fraction < 1) return 'New Moon';
        if (fraction < 25) return 'Waxing Crescent';
        if (fraction < 35) return 'First Quarter';
        if (fraction < 50) return 'Waxing Gibbous';
        if (fraction < 65) return 'Full Moon';
        if (fraction < 75) return 'Waning Gibbous';
        if (fraction < 90) return 'Last Quarter';
        return 'Waning Crescent';
    }

    // Get weather description from code
    getWeatherDescription(code) {
        const weatherCodes = {
            0: 'clear skies',
            1: 'mostly clear',
            2: 'partly cloudy',
            3: 'overcast',
            45: 'foggy conditions',
            48: 'rime fog',
            51: 'light drizzle',
            53: 'moderate drizzle',
            55: 'dense drizzle',
            56: 'light freezing drizzle',
            57: 'freezing drizzle',
            61: 'light rain',
            63: 'moderate rain',
            65: 'heavy rain',
            66: 'light freezing rain',
            67: 'freezing rain',
            71: 'light snow',
            73: 'moderate snow',
            75: 'heavy snow',
            77: 'snow grains',
            80: 'light rain showers',
            81: 'rain showers',
            82: 'heavy rain showers',
            85: 'light snow showers',
            86: 'snow showers',
            95: 'thunderstorms',
            96: 'thunderstorms with light hail',
            99: 'thunderstorms with heavy hail'
        };

        return weatherCodes[code] || 'varied conditions';
    }

    // Generate the summary text
    generateSummary() {
        const now = new Date();
        const parts = [];

        const { sunrise, sunset, maxTemp, minTemp, weatherCode, moonIllumination, precipProbability } = this.summaryData;

        // Get user's content preferences
        const contentSettings = typeof getSummaryContentSettings === 'function'
            ? getSummaryContentSettings()
            : { showSolar: true, showTemp: true, showWeather: true, showMoon: true };

        // Solar events with adaptive timing
        if (contentSettings.showSolar && sunrise && sunset) {
            const sunriseRel = this.getRelativeTime(sunrise, now);
            const sunsetRel = this.getRelativeTime(sunset, now);

            if (sunriseRel && !sunriseRel.includes('ago')) {
                // Sunrise is upcoming
                parts.push(`Sunrise ${sunriseRel}`);
            } else if (sunsetRel && !sunsetRel.includes('ago')) {
                // Sunset is upcoming (and sunrise has passed)
                parts.push(`Sunset ${sunsetRel}`);
            } else if (sunriseRel && sunriseRel.includes('ago')) {
                // Both have passed or sunrise just happened
                const time = sunrise.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                parts.push(`Sunrise was at ${time}`);
            }
        }

        // Temperature range
        if (contentSettings.showTemp) {
            if (maxTemp != null && minTemp != null) {
                const high = this.formatTemp(maxTemp);
                const low = this.formatTemp(minTemp);
                parts.push(`${high} high, ${low} low`);
            } else if (maxTemp != null) {
                parts.push(`High of ${this.formatTemp(maxTemp)}`);
            }
        }

        // Weather conditions
        if (contentSettings.showWeather && weatherCode != null) {
            const desc = this.getWeatherDescription(weatherCode);
            if (precipProbability != null && precipProbability > 30) {
                parts.push(`${desc} with ${precipProbability}% chance of precipitation`);
            } else {
                parts.push(desc);
            }
        }

        // Moon phase
        if (contentSettings.showMoon && moonIllumination != null) {
            const phaseName = this.getMoonPhaseName(moonIllumination);
            const illuminationPercent = Math.round(moonIllumination * 100);
            parts.push(`${phaseName} (${illuminationPercent}% illuminated)`);
        }

        // Combine parts into sentences
        if (parts.length === 0) {
            return 'Loading daily summary...';
        }

        // Group parts intelligently
        let summary = '';

        // First sentence: Solar event + temperature
        const firstSentenceParts = [];
        if (parts[0] && (parts[0].includes('Sunrise') || parts[0].includes('Sunset'))) {
            firstSentenceParts.push(parts.shift());
        }
        if (parts[0] && parts[0].includes('high')) {
            firstSentenceParts.push(parts.shift());
        }

        if (firstSentenceParts.length > 0) {
            summary += firstSentenceParts.join(', ') + '. ';
        }

        // Second sentence: Weather + Moon
        if (parts.length > 0) {
            summary += parts.join(', ') + '.';
        }

        return summary;
    }

    // Generate a shorter version for smaller displays
    generateShortSummary() {
        const { sunrise, sunset, maxTemp, minTemp, moonIllumination } = this.summaryData;
        const now = new Date();
        const parts = [];

        // Next solar event
        if (sunrise && sunset) {
            const sunriseRel = this.getRelativeTime(sunrise, now);
            const sunsetRel = this.getRelativeTime(sunset, now);

            if (sunriseRel && !sunriseRel.includes('ago')) {
                parts.push(`Sunrise ${sunriseRel}`);
            } else if (sunsetRel && !sunsetRel.includes('ago')) {
                parts.push(`Sunset ${sunsetRel}`);
            }
        }

        // Temperature
        if (maxTemp != null && minTemp != null) {
            parts.push(`${this.formatTemp(maxTemp)}/${this.formatTemp(minTemp)}`);
        }

        // Moon
        if (moonIllumination != null) {
            const phase = this.getMoonPhaseName(moonIllumination);
            parts.push(phase);
        }

        return parts.join(' · ') || 'Loading...';
    }
}

// Global instance
const dailySummaryGenerator = new DailySummaryGenerator();

// Function to update the banner with generated summary
function updateBannerSummary() {
    const summaryElement = document.getElementById('bannerDailySummary');
    if (!summaryElement) return;

    const summary = dailySummaryGenerator.generateSummary();
    summaryElement.textContent = summary;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.dailySummaryGenerator = dailySummaryGenerator;
    window.updateBannerSummary = updateBannerSummary;

    // Auto-update the banner every minute to keep relative times fresh
    setInterval(() => {
        if (dailySummaryGenerator.lastUpdate) {
            updateBannerSummary();
        }
    }, 60000); // Update every minute
}
