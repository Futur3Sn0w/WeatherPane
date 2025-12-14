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

const ui = (() => {
    const cache = {};
    const get = (id) => cache[id] || (cache[id] = $(`#${id}`));
    return {
        text(id, value) {
            const $el = get(id);
            if ($el.length) $el.text(value);
        },
        width(id, value) {
            const $el = get(id);
            if ($el.length) $el.css('width', value);
        },
        setCss(selector, prop, value) {
            $(selector).css(prop, value);
        }
    };
})();

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

function setLocationDisplay(place, lat, lon) {
    ui.text('loc', `${place} · ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
}

function formatDistanceKm(value) {
    if (value == null) return '—';
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k km`;
    if (value >= 10) return `${value.toFixed(0)} km`;
    return `${value.toFixed(1)} km`;
}

function formatUVRisk(uv) {
    if (uv == null) return '—';
    if (uv < 3) return 'Low';
    if (uv < 6) return 'Moderate';
    if (uv < 8) return 'High';
    if (uv < 11) return 'Very High';
    return 'Extreme';
}

function findClosestHourlyIndex(hourlyTimes, targetDate) {
    if (!Array.isArray(hourlyTimes) || hourlyTimes.length === 0) return -1;
    const target = targetDate.getTime();
    let bestIdx = 0;
    let bestDiff = Infinity;
    hourlyTimes.forEach((t, i) => {
        const diff = Math.abs(t.getTime() - target);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
        }
    });
    return bestIdx;
}

function sliceSameDay(hourlyTimes, values, date) {
    if (!hourlyTimes || !values) return [];
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const result = [];
    hourlyTimes.forEach((t, i) => {
        if (t.getDate() === day && t.getMonth() === month && t.getFullYear() === year) {
            result.push(values[i]);
        }
    });
    return result;
}

function buildCloudMiniBars(values, hourlyTimes, startIdx) {
    if (!values || !hourlyTimes || startIdx < 0) return { bars: [], avg: null };
    const bars = [];
    let sum = 0;
    let count = 0;
    for (let i = 0; i < 6; i++) {
        const idx = startIdx + i;
        if (idx >= values.length) break;
        const v = values[idx];
        const t = hourlyTimes[idx];
        const label = t ? t.toLocaleTimeString([], { hour: 'numeric' }) : '';
        const clamped = Math.max(0, Math.min(100, v));
        bars.push({ value: clamped, label });
        sum += clamped;
        count += 1;
    }
    return { bars, avg: count ? sum / count : null };
}

function updateUVCard(data, hourlyTimes) {
    const uvArray = data.hourly?.uv_index;
    if (!uvArray || !hourlyTimes || hourlyTimes.length === 0) return;
    const now = new Date();
    const nowIdx = findClosestHourlyIndex(hourlyTimes, now);
    const uvNow = uvArray[nowIdx];
    const todayValues = sliceSameDay(hourlyTimes, uvArray, now).filter(v => v != null);
    const uvMax = todayValues.length ? Math.max(...todayValues) : null;

    ui.text('uvNow', uvNow != null ? uvNow.toFixed(1) : '—');
    ui.text('uvNowLabel', uvNow != null ? formatUVRisk(uvNow) : '');
    ui.text('uvMaxPill', uvMax != null ? `Peak ${uvMax.toFixed(1)}` : 'Peak —');
    ui.text('uvAdvice', uvNow != null ? `${formatUVRisk(uvNow)} risk · ${uvNow < 3 ? 'Minimal protection needed' : 'Use SPF & shade'}` : '—');

    setDetailText('uvDetailNow', uvNow != null ? `${uvNow.toFixed(1)} (${formatUVRisk(uvNow)})` : '—');
    setDetailText('uvDetailMax', uvMax != null ? `${uvMax.toFixed(1)}` : '—');

    // Find next meaningful change (≥1 UV difference)
    let nextChange = null;
    for (let i = nowIdx + 1; i < uvArray.length; i++) {
        const v = uvArray[i];
        if (v == null) continue;
        if (Math.abs(v - uvNow) >= 1) {
            nextChange = hourlyTimes[i];
            break;
        }
    }
    setDetailText('uvNextChange', nextChange ? nextChange.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—');

    const cloudNow = data.current?.cloud_cover;
    setDetailText('uvCloudFactor', cloudNow != null ? `${cloudNow}% cover` : '—');
}

function updateVisibilityCard(data, hourlyTimes) {
    const visArray = data.hourly?.visibility;
    if (!visArray || !hourlyTimes || hourlyTimes.length === 0) return;
    const now = new Date();
    const nowIdx = findClosestHourlyIndex(hourlyTimes, now);
    const visNow = visArray[nowIdx] != null ? visArray[nowIdx] / 1000 : null; // to km
    const quality = visNow != null ? (visNow > 16 ? 'Excellent' : visNow > 8 ? 'Good' : visNow > 4 ? 'Fair' : 'Poor') : '—';
    ui.text('visibilityNow', visNow != null ? visNow.toFixed(1) : '—');
    ui.text('visibilityUnit', 'km');
    ui.text('visibilityQuality', quality);
    ui.text('visibilityNext', 'Watching for changes…');

    setDetailText('visibilityDetailNow', visNow != null ? `${visNow.toFixed(1)} km (${quality})` : '—');
    setDetailText('visibilityStars', visNow != null ? (visNow > 10 ? 'Great sky clarity' : visNow > 6 ? 'Decent' : 'Low clarity') : '—');
    setDetailText('visibilityPhoto', visNow != null ? (visNow > 8 ? 'Crisp vistas' : 'Hazy scenes') : '—');

    // Next improvement/degradation
    let nextChange = null;
    for (let i = nowIdx + 1; i < visArray.length; i++) {
        const v = visArray[i];
        if (v == null) continue;
        const vKm = v / 1000;
        if ((visNow != null && Math.abs(vKm - visNow) >= 2) || (visNow == null)) {
            nextChange = { value: vKm, time: hourlyTimes[i] };
            break;
        }
    }
    if (nextChange) {
        ui.text('visibilityNext', `${nextChange.time.toLocaleTimeString([], { hour: 'numeric' })}: ${nextChange.value.toFixed(1)} km`);
        setDetailText('visibilityImproves', `${nextChange.value.toFixed(1)} km at ${nextChange.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    } else {
        setDetailText('visibilityImproves', 'No major change soon');
    }
}

function updateCloudTimelineCard(data, hourlyTimes) {
    const clouds = data.hourly?.cloud_cover;
    if (!clouds || !hourlyTimes || hourlyTimes.length === 0) return;
    const now = new Date();
    const nowIdx = findClosestHourlyIndex(hourlyTimes, now);
    const { bars, avg } = buildCloudMiniBars(clouds, hourlyTimes, nowIdx);
    const container = document.getElementById('cloudMiniBars');
    if (container) {
        container.innerHTML = '';
        bars.forEach(b => {
            const div = document.createElement('div');
            div.className = 'bar' + (b.value < 30 ? ' low' : '');
            div.dataset.label = b.label;
            const fill = document.createElement('div');
            fill.className = 'fill';
            fill.style.setProperty('--h', `${Math.max(4, b.value * 0.8)}px`);
            div.appendChild(fill);
            container.appendChild(div);
        });
    }
    ui.text('cloudMiniLabel', bars.length ? `Next ${bars.length}h: ${avg != null ? `${avg.toFixed(0)}% avg` : '—'}` : '—');

    const nowCloud = clouds[nowIdx];
    setDetailText('cloudDetailNow', nowCloud != null ? `${Math.round(nowCloud)}%` : '—');
    setDetailText('cloudDetailAvg', avg != null ? `${Math.round(avg)}%` : '—');

    let nextClear = null;
    let nextOvercast = null;
    for (let i = nowIdx + 1; i < clouds.length; i++) {
        const v = clouds[i];
        if (v == null) continue;
        if (!nextClear && v <= 25) nextClear = hourlyTimes[i];
        if (!nextOvercast && v >= 90) nextOvercast = hourlyTimes[i];
        if (nextClear && nextOvercast) break;
    }
    setDetailText('cloudNextClear', nextClear ? nextClear.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—');
    setDetailText('cloudNextOvercast', nextOvercast ? nextOvercast.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—');
}

function describeWindow(label, start, end) {
    if (!start || !end) return `${label}: —`;
    return `${label}: ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function updateTwilightCard(times, nextTimes, now) {
    if (!times || !nextTimes) return;
    const morningGoldenStart = times.sunrise;
    const morningGoldenEnd = times.goldenHourEnd;
    const eveningGoldenStart = times.goldenHour;
    const eveningGoldenEnd = times.sunset;

    const blueMorningStart = times.nauticalDawn;
    const blueMorningEnd = times.dawn;
    const blueEveningStart = times.dusk;
    const blueEveningEnd = times.nauticalDusk;

    setDetailText('twilightGoldenAm', describeWindow('AM', morningGoldenStart, morningGoldenEnd));
    setDetailText('twilightGoldenPm', describeWindow('PM', eveningGoldenStart, eveningGoldenEnd));
    setDetailText('twilightBlueAm', describeWindow('AM', blueMorningStart, blueMorningEnd));
    setDetailText('twilightBluePm', describeWindow('PM', blueEveningStart, blueEveningEnd));

    const windows = [
        { label: 'Golden AM', start: morningGoldenStart, end: morningGoldenEnd },
        { label: 'Golden PM', start: eveningGoldenStart, end: eveningGoldenEnd },
        { label: 'Blue AM', start: blueMorningStart, end: blueMorningEnd },
        { label: 'Blue PM', start: blueEveningStart, end: blueEveningEnd },
        { label: 'Golden AM (tmr)', start: nextTimes.sunrise, end: nextTimes.goldenHourEnd },
        { label: 'Golden PM (tmr)', start: nextTimes.goldenHour, end: nextTimes.sunset }
    ].filter(w => w.start && w.end);

    const upcoming = windows
        .map(w => ({ ...w, startMs: w.start.getTime() }))
        .filter(w => w.startMs > now.getTime())
        .sort((a, b) => a.startMs - b.startMs)[0];

    if (upcoming) {
        ui.text('twilightNextLabel', upcoming.label);
        ui.text('twilightNextTime', `${upcoming.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
        ui.text('twilightKicker', describeWindow('Window', upcoming.start, upcoming.end).replace('Window: ', ''));
        setDetailText('twilightNextWindow', describeWindow(upcoming.label, upcoming.start, upcoming.end));
    } else {
        ui.text('twilightNextLabel', 'No upcoming');
        ui.text('twilightNextTime', '—');
        ui.text('twilightKicker', 'All twilight windows passed');
        setDetailText('twilightNextWindow', '—');
    }
}
async function resolveLocation() {
    const cachedLocation = readLocationCache();
    if (cachedLocation) {
        return {
            lat: cachedLocation.lat,
            lon: cachedLocation.lon,
            place: cachedLocation.place || 'Saved location',
            source: 'cache'
        };
    }

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

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        console.log(`[Geolocation] Success! Coordinates: ${lat}, ${lon}`);
        console.log(`[Geolocation] Accuracy: ${pos.coords.accuracy}m`);
        return { lat, lon, place: 'Current Location', source: 'geolocation' };
    } catch (geError) {
        console.warn('[Geolocation] Failed to get location via browser API:', geError);
        const zipResult = await promptForPostalLocation();
        if (!zipResult) {
            window.alert('WeatherPane needs a location (geolocation or ZIP code) to load weather data.');
            throw new Error('Location unavailable. Enable location services or provide a ZIP code.');
        }
        console.log(`[Geolocation] Using ZIP-based location ${zipResult.lat.toFixed(3)}, ${zipResult.lon.toFixed(3)} (${zipResult.place})`);
        return {
            lat: zipResult.lat,
            lon: zipResult.lon,
            place: zipResult.place || `ZIP ${zipResult.zip}`,
            source: 'zip'
        };
    }
}

// Main initialization function
async function init() {
    console.log('[Init] Starting initialization...');

    const location = await resolveLocation();
    const { lat, lon, place } = location;

    if (lat == null || lon == null) {
        throw new Error('Location unavailable. Cannot proceed without a latitude and longitude.');
    }

    writeLocationCache(lat, lon, place);
    setLocationDisplay(place, lat, lon);

    // Fetch weather data
    console.log('[Init] Fetching weather data...');
    const data = await fetchWeather(lat, lon);
    const tz = data.timezone;
    console.log(`[Init] Weather data received, timezone: ${tz}`);
    const hourlyTimes = Array.isArray(data.hourly?.time) ? data.hourly.time.map(t => new Date(t)) : [];

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
    ui.text('solarNoon', sNoon.t);
    ui.text('solarNoonAmPm', sNoon.am);
    const untilNoon = solarNoon - now;
    ui.text('solarNoonDelta', (untilNoon > 0 ? 'in ' : '') + hrsMin(untilNoon));
    ui.text('solarNoonSub', 'Midpoint between sunrise and sunset');

    // Sunset card
    const sSet = fmt(sunset);
    ui.text('sunset', sSet.t);
    ui.text('sunsetAmPm', sSet.am);
    const left = sunset - now;
    ui.text('dayLeft', left > 0 ? `Day ends in ${hrsMin(left)}` : `Sun set ${hrsMin(left)} ago`);
    ui.text('sunsetSub', `Sunrise today: ${fmt(sunrise).t} ${fmt(sunrise).am}`);

    // Night start using SunCalc
    const tomorrowTimes = SunCalc.getTimes(new Date(now.getTime() + 86_400_000), lat, lon);
    const night = times.night || times.nightEnd || times.nauticalDusk || times.dusk || sunset;
    const n = fmt(night);
    ui.text('nightStart', n.t);
    ui.text('nightAmPm', n.am);
    const nIn = night - now;
    ui.text('nightSub', nIn > 0 ? `Starts in ${hrsMin(nIn)}` : `Began ${hrsMin(nIn)} ago`);

    // Daylight progress
    const dayStart = sunrise.getTime();
    const dayEnd = sunset.getTime();
    const pct = Math.max(0, Math.min(100, ((now - dayStart) / (dayEnd - dayStart)) * 100));

    // Set the sun position CSS variable for the red dot indicator
    const sunPosition = Math.max(0, Math.min(100, pct));
    ui.setCss('.bar', '--sun-position', `${sunPosition}%`);

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
        ui.text('daylightInfo', `${leftH}h ${leftM}m (${pctRemaining}%) left - ${h}h ${m}m long`);
    } else {
        ui.text('daylightInfo', `Day ended - ${h}h ${m}m long`);
    }

    // Fill the daylight progress bar
    ui.width('dayFill', `${pct}%`);

    // Moon (using SunCalc since Open-Meteo doesn't provide moon_phase)
    const illum = SunCalc.getMoonIllumination(now);
    ui.text('moonPhaseLabel', moonLabel(illum.phase));
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
    ui.text('moonRiseSet', `${mr ? `Rise ${mr.t} ${mr.am}` : 'No rise'} · ${ms ? `Set ${ms.t} ${ms.am}` : 'No set'}`);
    const moonPos = SunCalc.getMoonPosition(now, lat, lon);

    // Season
    const s = seasonInfo(now);
    ui.text('seasonNow', s.currentSeason);
    ui.text('seasonEndsIn', `ends in ${s.nextIn} day${s.nextIn !== 1 ? 's' : ''}`);
    ui.text('seasonIcon', getSeasonIcon(s.currentSeason));
    ui.text('seasonRange', getSeasonDateRange(s.currentSeason));
    ui.text('seasonLocation', place);

    // Details panel
    const eventDateOptions = { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' };
    setDetailText('seasonNext', s.nextName);
    setDetailText('seasonDaysUntil', s.nextIn === 0 ? 'Today' : `${s.nextIn} day${s.nextIn !== 1 ? 's' : ''}`);
    setDetailText('seasonEventDate', s.nextDate ? s.nextDate.toLocaleString(undefined, eventDateOptions) : '—');
    setDetailText('seasonSincePrev', s.daysSincePrev != null ? `${s.daysSincePrev} day${s.daysSincePrev !== 1 ? 's' : ''}` : '—');

    // Sunrise (today)
    const sr = fmt(sunrise);
    ui.text('sunriseToday', sr.t);
    ui.text('sunriseTodayAmPm', sr.am);
    const untilSunrise = sunrise - now;
    ui.text('sunriseTodaySub', untilSunrise > 0 ? `Rises in ${hrsMin(untilSunrise)}` : `Rose ${hrsMin(untilSunrise)} ago`);

    // Sunrise (tomorrow)
    const tmr = new Date(data.daily.sunrise[1] || (new Date(sunrise.getTime() + 86_400_000)));
    const t = fmt(tmr);
    ui.text('sunriseTomorrow', t.t);
    ui.text('sunriseAmPm', t.am);
    ui.text('sunriseSub', `${dayName(tmr)} morning`);
    const tomorrowSunset = data.daily.sunset[1] ? new Date(data.daily.sunset[1]) : new Date(sunset.getTime() + 86_400_000);
    const dayLengthTomorrowMs = data.daily.daylight_duration[1] ? data.daily.daylight_duration[1] * 1000 : null;
    const nightEnd = tomorrowTimes.nightEnd || tomorrowTimes.nauticalDawn || tomorrowTimes.dawn || tmr || new Date(night.getTime() + 86_400_000);

    // Sunset (tomorrow)
    const sSetTmr = fmt(tomorrowSunset);
    ui.text('sunsetTomorrow', sSetTmr.t);
    ui.text('sunsetTomorrowAmPm', sSetTmr.am);
    const untilTomorrowSunset = tomorrowSunset - now;
    ui.text('sunsetTomorrowDelta', `in ${hrsMin(untilTomorrowSunset)}`);
    ui.text('sunsetTomorrowSub', `${dayName(tomorrowSunset)} evening`);

    // Night start (tomorrow)
    const tomorrowNight = tomorrowTimes.night || tomorrowTimes.nightEnd || tomorrowTimes.nauticalDusk || tomorrowTimes.dusk || tomorrowSunset;
    const nTmr = fmt(tomorrowNight);
    ui.text('nightStartTomorrow', nTmr.t);
    ui.text('nightTomorrowAmPm', nTmr.am);
    const untilTomorrowNight = tomorrowNight - now;
    ui.text('nightTomorrowSub', untilTomorrowNight > 0 ? `Starts in ${hrsMin(untilTomorrowNight)}` : `Started ${hrsMin(untilTomorrowNight)} ago`);

    // Tomorrow weather
    if (data.daily.temperature_2m_max && data.daily.temperature_2m_max[1] != null) {
        const tomorrowMaxC = data.daily.temperature_2m_max[1];
        const tomorrowMinC = data.daily.temperature_2m_min ? data.daily.temperature_2m_min[1] : null;

        // Store in global variables for temperature unit toggling
        window.tomorrowMaxCelsius = tomorrowMaxC;
        window.tomorrowMinCelsius = tomorrowMinC;

        const tempUnit = localStorage.getItem('weatherPane:tempUnit') || 'C';
        const tomorrowMax = tempUnit === 'F' ? celsiusToFahrenheit(tomorrowMaxC) : tomorrowMaxC;
        ui.text('tempTomorrow', Math.round(tomorrowMax));

        if (tomorrowMinC != null) {
            const tomorrowMin = tempUnit === 'F' ? celsiusToFahrenheit(tomorrowMinC) : tomorrowMinC;
            ui.text('tomorrowHighLow', `${Math.round(tomorrowMax)}° / ${Math.round(tomorrowMin)}°${tempUnit}`);
        } else {
            ui.text('tomorrowHighLow', `${Math.round(tomorrowMax)}°${tempUnit}`);
        }

        const precipSum = data.daily.precipitation_sum && data.daily.precipitation_sum[1] != null ? data.daily.precipitation_sum[1] : 0;
        const precipProb = data.daily.precipitation_probability_max && data.daily.precipitation_probability_max[1] != null ? data.daily.precipitation_probability_max[1] : 0;
        ui.text('tomorrowPrecip', precipSum > 0 ? `${precipSum.toFixed(1)}mm (${precipProb}%)` : precipProb > 0 ? `${precipProb}% chance` : 'None expected');

        const windMax = data.daily.wind_speed_10m_max && data.daily.wind_speed_10m_max[1] != null ? data.daily.wind_speed_10m_max[1] : null;
        const gustMax = data.daily.wind_gusts_10m_max && data.daily.wind_gusts_10m_max[1] != null ? data.daily.wind_gusts_10m_max[1] : null;
        if (windMax != null && gustMax != null) {
            ui.text('tomorrowWind', `${Math.round(windMax)} / ${Math.round(gustMax)} m/s`);
        } else if (windMax != null) {
            ui.text('tomorrowWind', `${Math.round(windMax)} m/s`);
        } else {
            ui.text('tomorrowWind', '—');
        }

        if (dayLengthTomorrowMs != null) {
            const h = Math.floor(dayLengthTomorrowMs / 3_600_000);
            const m = Math.round((dayLengthTomorrowMs % 3_600_000) / 60_000);
            ui.text('tomorrowDaylight', `${h}h ${m}m`);
        } else {
            ui.text('tomorrowDaylight', '—');
        }

        ui.text('tomorrowMeta', `High ${Math.round(tomorrowMax)}° · Precip ${precipProb}%`);
    } else {
        ui.text('tempTomorrow', '—');
        ui.text('tomorrowMeta', 'Forecast unavailable');
        ui.text('tomorrowHighLow', '—');
        ui.text('tomorrowPrecip', '—');
        ui.text('tomorrowWind', '—');
        ui.text('tomorrowDaylight', '—');
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

    // Populate new cards from hourly data
    updateUVCard(data, hourlyTimes);
    updateVisibilityCard(data, hourlyTimes);
    updateCloudTimelineCard(data, hourlyTimes);
    updateTwilightCard(times, tomorrowTimes, now);

    console.log('[Init] All data populated successfully!');
    if (typeof scheduleBackgroundRefresh === 'function') {
        scheduleBackgroundRefresh();
    } else {
        refreshBackgroundScene();
    }

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
