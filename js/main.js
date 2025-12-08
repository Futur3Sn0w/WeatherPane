// Main initialization for WeatherPane
// Depends on: All other modules

// Geocoding function for ZIP code lookups
async function geocodePostalCode(zip) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Geocoding request failed: ${response.status} ${response.statusText} - ${text}`);
    }
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
        return null;
    }
    const match = data.results.find(r => r.postal_code === zip) || data.results[0];
    if (!match || typeof match.latitude !== 'number' || typeof match.longitude !== 'number') {
        return null;
    }
    const parts = [];
    if (match.name) parts.push(match.name);
    if (match.admin1 && match.admin1 !== match.name) parts.push(match.admin1);
    if (match.country_code) parts.push(match.country_code);
    const placeLabel = parts.length ? parts.join(', ') : `ZIP ${zip}`;
    return {
        lat: match.latitude,
        lon: match.longitude,
        place: placeLabel,
        raw: match
    };
}

// Prompt user for postal code
async function promptForPostalLocation() {
    for (let attempt = 0; attempt < 3; attempt++) {
        const input = window.prompt('We couldn\'t detect your location. Enter a 5-digit ZIP code:', '');
        if (input == null) {
            return null;
        }
        const zip = input.trim();
        if (!/^\d{5}$/.test(zip)) {
            window.alert('Please enter a valid 5-digit ZIP code.');
            continue;
        }
        try {
            const result = await geocodePostalCode(zip);
            if (!result) {
                window.alert('Could not find that ZIP code. Please try another.');
                continue;
            }
            return { ...result, zip };
        } catch (error) {
            console.error('[Geolocation] ZIP lookup failed:', error);
            window.alert('We couldn\'t look up that ZIP code right now. Please try again.');
        }
    }
    return null;
}

// Fetch weather data from Open-Meteo API
async function fetchWeather(lat, lon) {
    const cached = readWeatherCache(lat, lon);
    if (cached) {
        return cached;
    }

    console.log(`[Weather API] Fetching weather for coordinates: ${lat}, ${lon}`);

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    const params = {
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,apparent_temperature,cloud_cover',
        daily: 'sunrise,sunset,daylight_duration,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max',
        timezone: 'auto'
    };

    url.search = new URLSearchParams(params).toString();
    console.log(`[Weather API] Request URL: ${url.toString()}`);
    console.log(`[Weather API] Parameters:`, params);

    try {
        const response = await fetch(url.toString());
        console.log(`[Weather API] Response status: ${response.status} ${response.statusText}`);
        console.log(`[Weather API] Response headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Weather API] Error response body:`, errorText);
            throw new Error(`Weather API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`[Weather API] Success! Response data:`, data);

        // Validate that we have the expected data structure
        if (!data.current) {
            console.error(`[Weather API] Missing 'current' data in response`);
            throw new Error('Weather API returned incomplete data: missing current weather');
        }
        if (!data.daily) {
            console.error(`[Weather API] Missing 'daily' data in response`);
            throw new Error('Weather API returned incomplete data: missing daily forecast');
        }

        console.log(`[Weather API] Current temperature: ${data.current.temperature_2m}°C`);
        console.log(`[Weather API] Timezone: ${data.timezone}`);

        writeWeatherCache(lat, lon, data);

        return data;
    } catch (error) {
        console.error(`[Weather API] Fetch error:`, error);
        throw error;
    }
}

// Main initialization function
async function init() {
    console.log('[Init] Starting initialization...');

    let lat = null;
    let lon = null;
    let place = 'Current Location';
    const cachedLocation = readLocationCache();

    if (cachedLocation) {
        lat = cachedLocation.lat;
        lon = cachedLocation.lon;
        place = cachedLocation.place || 'Saved location';
    } else {
        try {
            console.log('[Geolocation] Requesting user location...');

            if (!navigator.geolocation) {
                console.warn('[Geolocation] Geolocation API not available in this browser');
                throw new Error('Geolocation not available');
            }

            const pos = await new Promise((res, rej) => {
                navigator.geolocation.getCurrentPosition(
                    res,
                    (error) => {
                        console.error(`[Geolocation] Error code ${error.code}: ${error.message}`);
                        rej(error);
                    },
                    { enableHighAccuracy: true, timeout: 8000 }
                );
            });

            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
            place = 'Current Location';
            console.log(`[Geolocation] Success! Coordinates: ${lat}, ${lon}`);
            console.log(`[Geolocation] Accuracy: ${pos.coords.accuracy}m`);
        } catch (geError) {
            console.warn('[Geolocation] Failed to get location via browser API:', geError);
            const zipResult = await promptForPostalLocation();
            if (!zipResult) {
                window.alert('WeatherPane needs a location (geolocation or ZIP code) to load weather data.');
                throw new Error('Location unavailable. Enable location services or provide a ZIP code.');
            }
            lat = zipResult.lat;
            lon = zipResult.lon;
            place = zipResult.place || `ZIP ${zipResult.zip}`;
            console.log(`[Geolocation] Using ZIP-based location ${lat.toFixed(3)}, ${lon.toFixed(3)} (${place})`);
        }
    }

    if (lat == null || lon == null) {
        throw new Error('Location unavailable. Cannot proceed without a latitude and longitude.');
    }

    writeLocationCache(lat, lon, place);
    $('#loc').text(`${place} · ${lat.toFixed(3)}, ${lon.toFixed(3)}`);

    // Fetch weather data
    console.log('[Init] Fetching weather data...');
    const data = await fetchWeather(lat, lon);
    const tz = data.timezone;
    console.log(`[Init] Weather data received, timezone: ${tz}`);

    // Daily blocks
    const sunrise = new Date(data.daily.sunrise[0]);
    const sunset = new Date(data.daily.sunset[0]);
    const daylenMs = data.daily.daylight_duration[0] * 1000; // seconds → ms
    console.log(`[Init] Sunrise: ${sunrise.toLocaleString()}, Sunset: ${sunset.toLocaleString()}`);

    // Get current time for all calculations
    const now = new Date();

    // Get detailed times for accurate color transitions
    const times = SunCalc.getTimes(now, lat, lon);

    // Update sun visualization with sunrise/sunset times
    if (window.sunViz) {
        window.sunViz.setSunTimes(sunrise, sunset, times, lat, lon);
    }

    // Solar noon: midpoint
    const solarNoon = new Date((sunrise.getTime() + sunset.getTime()) / 2);
    const sNoon = fmt(solarNoon);
    $('#solarNoon').text(sNoon.t);
    $('#solarNoonAmPm').text(sNoon.am);
    const untilNoon = solarNoon - now;
    $('#solarNoonDelta').text((untilNoon > 0 ? 'in ' : '') + hrsMin(untilNoon));
    $('#solarNoonSub').text('Midpoint between sunrise and sunset');

    // Sunset card
    const sSet = fmt(sunset);
    $('#sunset').text(sSet.t);
    $('#sunsetAmPm').text(sSet.am);
    const left = sunset - now;
    $('#dayLeft').text(left > 0 ? `Day ends in ${hrsMin(left)}` : `Sun set ${hrsMin(left)} ago`);
    $('#sunsetSub').text(`Sunrise today: ${fmt(sunrise).t} ${fmt(sunrise).am}`);

    // Night start using SunCalc
    const tomorrowTimes = SunCalc.getTimes(new Date(now.getTime() + 86_400_000), lat, lon);
    const night = times.night || times.nightEnd || times.nauticalDusk || times.dusk || sunset;
    const n = fmt(night);
    $('#nightStart').text(n.t);
    $('#nightAmPm').text(n.am);
    const nIn = night - now;
    $('#nightSub').text(nIn > 0 ? `Starts in ${hrsMin(nIn)}` : `Began ${hrsMin(nIn)} ago`);

    // Daylight progress
    const dayStart = sunrise.getTime();
    const dayEnd = sunset.getTime();
    const pct = Math.max(0, Math.min(100, ((now - dayStart) / (dayEnd - dayStart)) * 100));

    // Set the sun position CSS variable for the red dot indicator
    const sunPosition = Math.max(0, Math.min(100, pct));
    $('.bar').css('--sun-position', `${sunPosition}%`);

    // Calculate time remaining in hours and minutes
    const leftMs = Math.max(0, dayEnd - now);
    const leftH = Math.floor(leftMs / 3_600_000);
    const leftM = Math.round((leftMs % 3_600_000) / 60_000);
    const pctRemaining = Math.max(0, (100 - pct)).toFixed(0);

    // Calculate total day length
    const h = Math.floor(daylenMs / 3_600_000);
    const m = Math.round((daylenMs % 3_600_000) / 60_000);

    // Format: "5h 10m (49%) left - 10h 33m long"
    if (leftMs > 0) {
        $('#daylightInfo').text(`${leftH}h ${leftM}m (${pctRemaining}%) left - ${h}h ${m}m long`);
    } else {
        $('#daylightInfo').text(`Day ended - ${h}h ${m}m long`);
    }

    // Fill the daylight progress bar
    $('#dayFill').css('width', `${pct}%`);

    // Moon (using SunCalc since Open-Meteo doesn't provide moon_phase)
    const illum = SunCalc.getMoonIllumination(now);
    $('#moonPhaseLabel').text(moonLabel(illum.phase));
    console.log(`[Moon] Phase from SunCalc: ${illum.phase.toFixed(3)} (${moonLabel(illum.phase)}), Illumination: ${(illum.fraction * 100).toFixed(1)}%`);

    // Store moon data for test mode reset
    window.lastMoonData = {
        phase: illum.phase,
        fraction: illum.fraction
    };

    // Apply dynamic moon phase SVG (only if not in test mode)
    if (!$('#moonCard').hasClass('moon-test-active')) {
        updateMoonSVG(illum.phase, illum.fraction);
    }

    const mrset = SunCalc.getMoonTimes(now, lat, lon);
    const mr = mrset.rise ? fmt(mrset.rise) : null;
    const ms = mrset.set ? fmt(mrset.set) : null;
    $('#moonRiseSet').text(`${mr ? `Rise ${mr.t} ${mr.am}` : 'No rise'} · ${ms ? `Set ${ms.t} ${ms.am}` : 'No set'}`);
    const moonPos = SunCalc.getMoonPosition(now, lat, lon);

    // Season
    const s = seasonInfo(now);
    $('#seasonNow').text(s.currentSeason);
    $('#seasonEndsIn').text(`ends in ${s.nextIn} day${s.nextIn !== 1 ? 's' : ''}`);
    $('#seasonIcon').text(getSeasonIcon(s.currentSeason));
    $('#seasonRange').text(getSeasonDateRange(s.currentSeason));
    $('#seasonLocation').text(place);

    // Details panel
    const eventDateOptions = { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' };
    setDetailText('seasonNext', s.nextName);
    setDetailText('seasonDaysUntil', s.nextIn === 0 ? 'Today' : `${s.nextIn} day${s.nextIn !== 1 ? 's' : ''}`);
    setDetailText('seasonEventDate', s.nextDate ? s.nextDate.toLocaleString(undefined, eventDateOptions) : '—');
    setDetailText('seasonSincePrev', s.daysSincePrev != null ? `${s.daysSincePrev} day${s.daysSincePrev !== 1 ? 's' : ''}` : '—');

    // Sunrise (today)
    const sr = fmt(sunrise);
    $('#sunriseToday').text(sr.t);
    $('#sunriseTodayAmPm').text(sr.am);
    const untilSunrise = sunrise - now;
    $('#sunriseTodaySub').text(untilSunrise > 0 ? `Rises in ${hrsMin(untilSunrise)}` : `Rose ${hrsMin(untilSunrise)} ago`);

    // Sunrise (tomorrow)
    const tmr = new Date(data.daily.sunrise[1] || (new Date(sunrise.getTime() + 86_400_000)));
    const t = fmt(tmr);
    $('#sunriseTomorrow').text(t.t);
    $('#sunriseAmPm').text(t.am);
    $('#sunriseSub').text(`${dayName(tmr)} morning`);
    const tomorrowSunset = data.daily.sunset[1] ? new Date(data.daily.sunset[1]) : new Date(sunset.getTime() + 86_400_000);
    const dayLengthTomorrowMs = data.daily.daylight_duration[1] ? data.daily.daylight_duration[1] * 1000 : null;
    const nightEnd = tomorrowTimes.nightEnd || tomorrowTimes.nauticalDawn || tomorrowTimes.dawn || tmr || new Date(night.getTime() + 86_400_000);

    // Sunset (tomorrow)
    const sSetTmr = fmt(tomorrowSunset);
    $('#sunsetTomorrow').text(sSetTmr.t);
    $('#sunsetTomorrowAmPm').text(sSetTmr.am);
    const untilTomorrowSunset = tomorrowSunset - now;
    $('#sunsetTomorrowDelta').text(`in ${hrsMin(untilTomorrowSunset)}`);
    $('#sunsetTomorrowSub').text(`${dayName(tomorrowSunset)} evening`);

    // Night start (tomorrow)
    const tomorrowNight = tomorrowTimes.night || tomorrowTimes.nightEnd || tomorrowTimes.nauticalDusk || tomorrowTimes.dusk || tomorrowSunset;
    const nTmr = fmt(tomorrowNight);
    $('#nightStartTomorrow').text(nTmr.t);
    $('#nightTomorrowAmPm').text(nTmr.am);
    const untilTomorrowNight = tomorrowNight - now;
    $('#nightTomorrowSub').text(untilTomorrowNight > 0 ? `Starts in ${hrsMin(untilTomorrowNight)}` : `Started ${hrsMin(untilTomorrowNight)} ago`);

    // Tomorrow weather
    if (data.daily.temperature_2m_max && data.daily.temperature_2m_max[1] != null) {
        const tomorrowMaxC = data.daily.temperature_2m_max[1];
        const tomorrowMinC = data.daily.temperature_2m_min ? data.daily.temperature_2m_min[1] : null;

        // Store in global variables for temperature unit toggling
        window.tomorrowMaxCelsius = tomorrowMaxC;
        window.tomorrowMinCelsius = tomorrowMinC;

        const tempUnit = localStorage.getItem('weatherPane:tempUnit') || 'C';
        const tomorrowMax = tempUnit === 'F' ? celsiusToFahrenheit(tomorrowMaxC) : tomorrowMaxC;
        $('#tempTomorrow').text(Math.round(tomorrowMax));

        if (tomorrowMinC != null) {
            const tomorrowMin = tempUnit === 'F' ? celsiusToFahrenheit(tomorrowMinC) : tomorrowMinC;
            $('#tomorrowHighLow').text(`${Math.round(tomorrowMax)}° / ${Math.round(tomorrowMin)}°${tempUnit}`);
        } else {
            $('#tomorrowHighLow').text(`${Math.round(tomorrowMax)}°${tempUnit}`);
        }

        const precipSum = data.daily.precipitation_sum && data.daily.precipitation_sum[1] != null ? data.daily.precipitation_sum[1] : 0;
        const precipProb = data.daily.precipitation_probability_max && data.daily.precipitation_probability_max[1] != null ? data.daily.precipitation_probability_max[1] : 0;
        $('#tomorrowPrecip').text(precipSum > 0 ? `${precipSum.toFixed(1)}mm (${precipProb}%)` : precipProb > 0 ? `${precipProb}% chance` : 'None expected');

        const windMax = data.daily.wind_speed_10m_max && data.daily.wind_speed_10m_max[1] != null ? data.daily.wind_speed_10m_max[1] : null;
        const gustMax = data.daily.wind_gusts_10m_max && data.daily.wind_gusts_10m_max[1] != null ? data.daily.wind_gusts_10m_max[1] : null;
        if (windMax != null && gustMax != null) {
            $('#tomorrowWind').text(`${Math.round(windMax)} / ${Math.round(gustMax)} m/s`);
        } else if (windMax != null) {
            $('#tomorrowWind').text(`${Math.round(windMax)} m/s`);
        } else {
            $('#tomorrowWind').text('—');
        }

        if (dayLengthTomorrowMs != null) {
            const h = Math.floor(dayLengthTomorrowMs / 3_600_000);
            const m = Math.round((dayLengthTomorrowMs % 3_600_000) / 60_000);
            $('#tomorrowDaylight').text(`${h}h ${m}m`);
        } else {
            $('#tomorrowDaylight').text('—');
        }

        $('#tomorrowMeta').text(`High ${Math.round(tomorrowMax)}° · Precip ${precipProb}%`);
    } else {
        $('#tempTomorrow').text('—');
        $('#tomorrowMeta').text('Forecast unavailable');
        $('#tomorrowHighLow').text('—');
        $('#tomorrowPrecip').text('—');
        $('#tomorrowWind').text('—');
        $('#tomorrowDaylight').text('—');
    }

    updateCardDetails({
        lat,
        lon,
        now,
        sunrise,
        sunset,
        solarNoon,
        times,
        nextTimes: tomorrowTimes,
        dayLengthMs: daylenMs,
        dayLengthTomorrowMs,
        tomorrowSunrise: tmr,
        tomorrowSunset,
        moonTimes: mrset,
        moonIllumination: illum,
        moonPosition: moonPos,
        nightStart: night,
        nightEnd
    });

    // Now card
    const c = data.current;
    currentTempCelsius = typeof c.temperature_2m === 'number' ? c.temperature_2m : null;
    currentFeelsLikeCelsius = typeof c.apparent_temperature === 'number' ? c.apparent_temperature : null;
    currentWindSpeed = typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : null;
    currentWindGust = typeof c.wind_gusts_10m === 'number' ? c.wind_gusts_10m : null;
    currentHumidity = typeof c.relative_humidity_2m === 'number' ? c.relative_humidity_2m : null;
    currentWeatherCode = c.weather_code;
    currentCloudCover = typeof c.cloud_cover === 'number' ? c.cloud_cover : null;
    updateTemperatureDisplay();
    updateWeatherDetail();
    const windMeta = currentWindSpeed != null ? `${Math.round(currentWindSpeed)} m/s` : '—';
    const humidityMeta = currentHumidity != null ? `${Math.round(currentHumidity)}%` : '—';
    $('#nowMeta').text(`Wind ${windMeta} · Humidity ${humidityMeta}`);

    // Update astronomical events card
    updateAstronomicalEventsCard();

    console.log('[Init] All data populated successfully!');
    refreshBackgroundScene();

    // Force Muuri to recalculate layout after data is populated
    setTimeout(() => {
        if (window.muuriGrid || window.todayGrid) {
            const grid = window.muuriGrid || window.todayGrid;
            console.log('[Muuri] Refreshing layout after data load');
            grid.refreshItems();
            grid.layout();
        }
    }, 100);
}

// jQuery document ready
$(document).ready(function () {
    console.log('[Ready] jQuery and DOM ready, checking for SunCalc...');

    // Apply theme as early as possible
    applyTheme();

    initCloudBackdrop();
    initSettings();
    initCardHandlers();
    initDayViewStates();
    initMuuriGrid();

    // Wait for SunCalc to load
    const checkSunCalc = setInterval(() => {
        if (typeof SunCalc !== 'undefined') {
            clearInterval(checkSunCalc);
            console.log('[Ready] SunCalc loaded, starting init...');

            // Initialize sun visualization
            window.sunViz = new SunVisualization('sunCanvas', 'timeSlider', 'timePill', 'currentTimeDisplay', 'timeResetBtn');
            console.log('[SunViz] Sun visualization initialized');

            init().catch(err => {
                console.error('[Init] Fatal error:', err);
                console.error('[Init] Error stack:', err.stack);
                $('#panel').append(
                    $('<article class="card">')
                        .append($('<h3>').text('Error'))
                        .append($('<div class="kicker">').text(`Failed to load weather data: ${err.message}`))
                        .append($('<div class="kicker">').css('margin-top', '8px').text('Check console for details'))
                );
            });
        }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => {
        clearInterval(checkSunCalc);
        if (typeof SunCalc === 'undefined') {
            console.error('[Ready] SunCalc failed to load after 5 seconds');
        }
    }, 5000);
});
