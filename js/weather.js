// Weather data fetching, caching, and display for WeatherPane
// Depends on: utils.js

// Cache configuration
const WEATHER_CACHE_KEY_PREFIX = 'weatherPane:weather:';
const WEATHER_CACHE_VERSION = 'v3';
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (fresh)
const WEATHER_CACHE_STALE_MS = 20 * 60 * 1000; // 20 minutes (stale-but-usable)

const WEATHER_API_BASE = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_API_PARAMS = {
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,apparent_temperature,cloud_cover',
    daily: 'sunrise,sunset,daylight_duration,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max',
    hourly: 'uv_index,cloud_cover,visibility',
    timezone: 'auto'
};

function makeWeatherCacheKey(lat, lon) {
    return `${WEATHER_CACHE_KEY_PREFIX}${WEATHER_CACHE_VERSION}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
}

function readWeatherCacheEntry(lat, lon) {
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
        if (age > WEATHER_CACHE_STALE_MS) {
            localStorage.removeItem(key);
            return null;
        }
        const isStale = age > WEATHER_CACHE_TTL_MS;
        console.log(`[Weather API] Using cached data for ${lat.toFixed(3)}, ${lon.toFixed(3)} (age ${Math.round(age / 1000)}s, stale=${isStale})`);
        return { data: entry.data, isStale };
    } catch (error) {
        console.warn('[Weather API] Failed to read cache', error);
        return null;
    }
}

function readWeatherCache(lat, lon) {
    const entry = readWeatherCacheEntry(lat, lon);
    return entry ? entry.data : null;
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

function buildWeatherRequest(lat, lon) {
    const url = new URL(WEATHER_API_BASE);
    const params = {
        ...WEATHER_API_PARAMS,
        latitude: lat,
        longitude: lon
    };
    url.search = new URLSearchParams(params).toString();
    return { url: url.toString(), params };
}

function validateWeatherResponse(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Weather API returned invalid JSON');
    }
    if (!data.current) {
        throw new Error('Weather API returned incomplete data: missing current weather');
    }
    if (!data.daily) {
        throw new Error('Weather API returned incomplete data: missing daily forecast');
    }
    return data;
}

async function fetchWeather(lat, lon) {
    const cachedEntry = readWeatherCacheEntry(lat, lon);
    if (cachedEntry && !cachedEntry.isStale) {
        return cachedEntry.data;
    }

    console.log(`[Weather API] Fetching weather for coordinates: ${lat}, ${lon}`);
    const { url, params } = buildWeatherRequest(lat, lon);
    console.log(`[Weather API] Request URL: ${url}`);
    console.log(`[Weather API] Parameters:`, params);

    try {
        const response = await fetch(url);
        console.log(`[Weather API] Response status: ${response.status} ${response.statusText}`);
        console.log(`[Weather API] Response headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Weather API] Error response body:`, errorText);
            throw new Error(`Weather API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = validateWeatherResponse(await response.json());
        console.log(`[Weather API] Success! Timezone: ${data.timezone}, Current temperature: ${data.current.temperature_2m}°C`);
        writeWeatherCache(lat, lon, data);
        return data;
    } catch (error) {
        console.error(`[Weather API] Fetch error:`, error);
        if (cachedEntry && cachedEntry.isStale) {
            console.warn('[Weather API] Using stale cached data due to fetch failure');
            return cachedEntry.data;
        }
        throw error;
    }
}

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

    // Update daily summary banner with new unit
    if (window.dailySummaryGenerator && window.updateBannerSummary) {
        window.dailySummaryGenerator.setTemperatureUnit(temperatureUnit);
        window.updateBannerSummary();
    }

    console.log(`[Temperature] Toggled to ${temperatureUnit}`);
}
