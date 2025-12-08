// Weather data fetching, caching, and display for WeatherPane
// Depends on: utils.js

// Cache configuration
const WEATHER_CACHE_KEY_PREFIX = 'weatherPane:weather:';
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function makeWeatherCacheKey(lat, lon) {
    return `${WEATHER_CACHE_KEY_PREFIX}${lat.toFixed(3)}:${lon.toFixed(3)}`;
}

function readWeatherCache(lat, lon) {
    const key = makeWeatherCacheKey(lat, lon);
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return null;
        }
        const entry = JSON.parse(raw);
        if (!entry || typeof entry.timestamp !== 'number' || !entry.data) {
            return null;
        }
        const age = Date.now() - entry.timestamp;
        if (age > WEATHER_CACHE_TTL_MS) {
            localStorage.removeItem(key);
            console.log(`[Weather API] Cache expired for ${lat}, ${lon} (age ${Math.round(age / 1000)}s)`);
            return null;
        }
        console.log(`[Weather API] Using cached data for ${lat.toFixed(3)}, ${lon.toFixed(3)} (age ${Math.round(age / 1000)}s)`);
        return entry.data;
    } catch (error) {
        console.warn('[Weather API] Failed to read cache', error);
        return null;
    }
}

function writeWeatherCache(lat, lon, data) {
    const key = makeWeatherCacheKey(lat, lon);
    const entry = {
        timestamp: Date.now(),
        data
    };
    try {
        localStorage.setItem(key, JSON.stringify(entry));
        console.log(`[Weather API] Cached response for ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
    } catch (error) {
        console.warn('[Weather API] Failed to write cache', error);
    }
}

const LOCATION_CACHE_KEY = 'weatherPane:lastLocation';
const LOCATION_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function readLocationCache() {
    try {
        const raw = localStorage.getItem(LOCATION_CACHE_KEY);
        if (!raw) {
            return null;
        }
        const entry = JSON.parse(raw);
        if (!entry || typeof entry.lat !== 'number' || typeof entry.lon !== 'number' || typeof entry.timestamp !== 'number') {
            return null;
        }
        const age = Date.now() - entry.timestamp;
        if (age > LOCATION_CACHE_TTL_MS) {
            localStorage.removeItem(LOCATION_CACHE_KEY);
            console.log(`[Geolocation] Cached location expired (age ${Math.round(age / 1000)}s)`);
            return null;
        }
        console.log(`[Geolocation] Using cached location (${entry.lat.toFixed(3)}, ${entry.lon.toFixed(3)}) (age ${Math.round(age / 1000)}s)`);
        return entry;
    } catch (error) {
        console.warn('[Geolocation] Failed to read cached location', error);
        return null;
    }
}

function writeLocationCache(lat, lon, place) {
    const entry = {
        lat,
        lon,
        place,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(entry));
        console.log(`[Geolocation] Cached location ${lat.toFixed(3)}, ${lon.toFixed(3)} (${place})`);
    } catch (error) {
        console.warn('[Geolocation] Failed to write cached location', error);
    }
}

// Temperature unit management
// Sync both localStorage keys
let temperatureUnit = localStorage.getItem('temperatureUnit') || localStorage.getItem('weatherPane:tempUnit') || 'C';
localStorage.setItem('temperatureUnit', temperatureUnit);
localStorage.setItem('weatherPane:tempUnit', temperatureUnit);

let currentTempCelsius = null; // Store the raw Celsius value
let currentFeelsLikeCelsius = null;
let currentWindSpeed = null;
let currentWindGust = null;
let currentHumidity = null;
let currentWeatherCode = null;
let currentCloudCover = null;
let expandedCardId = null;

function celsiusToFahrenheit(celsius) {
    return (celsius * 9 / 5) + 32;
}

function updateTemperatureDisplay() {
    if (currentTempCelsius === null) return;

    const tempValue = temperatureUnit === 'C' ?
        Math.round(currentTempCelsius) :
        Math.round(celsiusToFahrenheit(currentTempCelsius));

    $('#temp').text(tempValue);
    $('#tempUnitBadge').text(`°${temperatureUnit}`);
    $('#tempUnitBadgeTomorrow').text(`°${temperatureUnit}`);
}

function updateTomorrowTemperatureDisplay() {
    // Use window global variables set by main.js
    const maxC = window.tomorrowMaxCelsius;
    const minC = window.tomorrowMinCelsius;

    if (maxC === null || maxC === undefined) return;

    const tomorrowMax = temperatureUnit === 'C' ?
        Math.round(maxC) :
        Math.round(celsiusToFahrenheit(maxC));

    $('#tempTomorrow').text(tomorrowMax);

    // Update high/low if we have min temp
    if (minC !== null && minC !== undefined) {
        const tomorrowMin = temperatureUnit === 'C' ?
            Math.round(minC) :
            Math.round(celsiusToFahrenheit(minC));
        $('#tomorrowHighLow').text(`${tomorrowMax}° / ${tomorrowMin}°${temperatureUnit}`);
    } else {
        $('#tomorrowHighLow').text(`${tomorrowMax}°${temperatureUnit}`);
    }

    // Update the meta text if it's already set
    const metaText = $('#tomorrowMeta').text();
    if (metaText && metaText !== 'Forecast unavailable' && metaText !== '—') {
        // Extract precipitation percentage if present
        const precipMatch = metaText.match(/Precip\s+(\d+)%/);
        if (precipMatch) {
            $('#tomorrowMeta').text(`High ${tomorrowMax}° · Precip ${precipMatch[1]}%`);
        }
    }
}

function updateWeatherDetail() {
    setDetailText('nowConditions', describeWeatherCode(currentWeatherCode, currentCloudCover));
    setDetailText('nowWind', formatWind(currentWindSpeed, currentWindGust));
    setDetailText('nowHumidity', currentHumidity != null ? `${Math.round(currentHumidity)}%` : '—');

    if (currentTempCelsius == null) {
        setDetailText('nowFeelsLike', '—');
        return;
    }

    if (currentFeelsLikeCelsius == null) {
        setDetailText('nowFeelsLike', 'Same as air temp');
        return;
    }

    const feels = temperatureUnit === 'C'
        ? Math.round(currentFeelsLikeCelsius)
        : Math.round(celsiusToFahrenheit(currentFeelsLikeCelsius));

    setDetailText('nowFeelsLike', `${feels}°${temperatureUnit}`);
}

function toggleTemperatureUnit() {
    temperatureUnit = temperatureUnit === 'C' ? 'F' : 'C';
    localStorage.setItem('temperatureUnit', temperatureUnit);
    localStorage.setItem('weatherPane:tempUnit', temperatureUnit); // Sync with main.js key
    updateTemperatureDisplay();
    updateTomorrowTemperatureDisplay();
    updateWeatherDetail();
    console.log(`[Temperature] Toggled to ${temperatureUnit}`);
}
