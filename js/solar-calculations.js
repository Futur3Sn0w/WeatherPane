// Solar and lunar calculations for WeatherPane
// Depends on: jQuery, utils.js, SunCalc library

function updateCardDetails({
    lat,
    lon,
    now,
    sunrise,
    sunset,
    solarNoon,
    times,
    nextTimes,
    dayLengthMs,
    dayLengthTomorrowMs,
    tomorrowSunrise,
    tomorrowSunset,
    moonTimes,
    moonIllumination,
    moonPosition,
    nightStart,
    nightEnd
}) {
    // Solar noon detail
    if (solarNoon) {
        const noonPos = SunCalc.getPosition(solarNoon, lat, lon);
        const altitudeDeg = toDegrees(noonPos.altitude);
        const azimuthDeg = (toDegrees(noonPos.azimuth) + 180 + 360) % 360;
        const clockNoon = new Date(solarNoon);
        clockNoon.setHours(12, 0, 0, 0);
        const fraction = sunrise && sunset ? ((solarNoon - sunrise) / (sunset - sunrise)) * 100 : null;

        setDetailText('solarNoonAltitude', `${altitudeDeg.toFixed(1)}°`);
        setDetailText('solarNoonAzimuth', formatAzimuth(azimuthDeg));
        setDetailText('solarNoonOffset', formatSignedMinutes(solarNoon - clockNoon));
        setDetailText('solarNoonDayFraction', fraction != null ? formatPercent(fraction, 1) : '—');
    } else {
        setDetailText('solarNoonAltitude', '—');
        setDetailText('solarNoonAzimuth', '—');
        setDetailText('solarNoonOffset', '—');
        setDetailText('solarNoonDayFraction', '—');
    }

    // Sunrise (today) detail
    setDetailText('sunriseTodayCivilDawn', formatTimeDetail(times?.dawn || sunrise));
    setDetailText('sunriseTodayNauticalDawn', formatTimeDetail(times?.nauticalDawn));
    setDetailText('sunriseTodayAstronomicalDawn', formatTimeDetail(times?.nightEnd));
    setDetailText('sunriseTodayGoldenHourStart', formatTimeDetail(times?.goldenHourEnd));

    // Sunset detail
    setDetailText('sunsetCivilDusk', formatTimeDetail(times?.dusk || sunset));
    setDetailText('sunsetNauticalDusk', formatTimeDetail(times?.nauticalDusk));
    setDetailText('sunsetAstronomicalDusk', formatTimeDetail(times?.night));
    setDetailText('sunsetGoldenHourEnd', formatTimeDetail(times?.goldenHour));

    // Sunset (tomorrow) detail
    setDetailText('sunsetTomorrowCivilDusk', formatTimeDetail(nextTimes?.dusk));
    setDetailText('sunsetTomorrowNauticalDusk', formatTimeDetail(nextTimes?.nauticalDusk));
    setDetailText('sunsetTomorrowAstronomicalDusk', formatTimeDetail(nextTimes?.night));
    setDetailText('sunsetTomorrowGoldenHourEnd', formatTimeDetail(nextTimes?.goldenHour));

    // Night detail
    const astroDusk = times?.night || times?.nauticalDusk || sunset;
    const astroDawn = nextTimes?.nightEnd || nextTimes?.nauticalDawn || nextTimes?.dawn || tomorrowSunrise;
    setDetailText('nightAstronomicalDusk', formatTimeDetail(astroDusk));
    setDetailText('nightAstronomicalDawn', formatTimeDetail(astroDawn));
    const nightLength = nightStart && nightEnd ? nightEnd - nightStart : (astroDusk && astroDawn ? (astroDawn - astroDusk) : null);
    setDetailText('nightLength', nightLength != null ? formatDurationHM(nightLength) : '—');

    let moonOverlapText = '—';
    if (moonTimes?.alwaysUp) {
        moonOverlapText = 'Moon above horizon all night';
    } else if (moonTimes?.alwaysDown) {
        moonOverlapText = 'No moonrise tonight';
    } else if (astroDusk && astroDawn) {
        const moonRise = moonTimes?.rise || astroDusk;
        const moonSet = moonTimes?.set || astroDawn;
        const overlap = computeOverlapDuration(astroDusk, astroDawn, moonRise, moonSet);
        moonOverlapText = overlap > 0 ? `${formatDurationHM(overlap)} of moonlight` : 'No moonlight window';
    }
    setDetailText('nightMoonOverlap', moonOverlapText);

    // Night (tomorrow) detail
    const dayAfterTomorrowDate = new Date(now.getTime() + 2 * 86_400_000);
    const dayAfterTomorrowTimes = SunCalc.getTimes(dayAfterTomorrowDate, lat, lon);
    const tomorrowAstroDusk = nextTimes?.night || nextTimes?.nauticalDusk;
    const tomorrowAstroDawn = dayAfterTomorrowTimes?.nightEnd || dayAfterTomorrowTimes?.nauticalDawn;
    setDetailText('nightTomorrowAstronomicalDusk', formatTimeDetail(tomorrowAstroDusk));
    setDetailText('nightTomorrowAstronomicalDawn', formatTimeDetail(tomorrowAstroDawn));
    const tomorrowNightLength = tomorrowAstroDusk && tomorrowAstroDawn ? (tomorrowAstroDawn - tomorrowAstroDusk) : null;
    setDetailText('nightTomorrowLength', tomorrowNightLength != null ? formatDurationHM(tomorrowNightLength) : '—');
    // Tomorrow's moon overlap calculation would need tomorrow's moon rise/set times
    setDetailText('nightTomorrowMoonOverlap', '—');

    // Moon detail
    const moonFraction = moonIllumination?.fraction != null ? moonIllumination.fraction * 100 : null;
    setDetailText('moonIllumination', moonFraction != null ? formatPercent(moonFraction, 1) : '—');
    const phaseAngle = moonIllumination?.angle != null ? toDegrees(moonIllumination.angle) : null;
    setDetailText('moonPhaseAngle', phaseAngle != null ? `${phaseAngle.toFixed(1)}°` : '—');
    setDetailText('moonAltitude', moonPosition?.altitude != null ? `${toDegrees(moonPosition.altitude).toFixed(1)}°` : '—');
    setDetailText('moonDistance', moonPosition?.distance != null ? formatMoonDistance(moonPosition.distance) : '—');

    // Daylight detail
    setDetailText('daylightDawn', formatTimeDetail(times?.dawn || sunrise));
    setDetailText('daylightDusk', formatTimeDetail(times?.dusk || sunset));
    const morningGoldenStart = times?.sunrise || sunrise;
    const morningGoldenEnd = times?.goldenHourEnd;
    const eveningGoldenStart = times?.goldenHour;
    const eveningGoldenEnd = sunset;
    let goldenHourText = '—';
    if (morningGoldenStart && morningGoldenEnd && eveningGoldenStart && eveningGoldenEnd) {
        goldenHourText = `AM ${formatTimeDetail(morningGoldenStart)}–${formatTimeDetail(morningGoldenEnd)} · PM ${formatTimeDetail(eveningGoldenStart)}–${formatTimeDetail(eveningGoldenEnd)}`;
    }
    setDetailText('daylightGoldenHour', goldenHourText);
    if (dayLengthMs != null) {
        const daylightPercent = (dayLengthMs / 86_400_000) * 100;
        setDetailText('daylightAboveHorizon', `${formatDurationHM(dayLengthMs, { allowZeroMinutes: true })} (${formatPercent(daylightPercent, 1)} of day)`);
    } else {
        setDetailText('daylightAboveHorizon', '—');
    }

    // Season detail
    if (dayLengthMs != null && dayLengthTomorrowMs != null) {
        const diff = dayLengthTomorrowMs - dayLengthMs;
        setDetailText('sunriseGain', diff === 0 ? 'No change' : `${formatSignedMinutes(diff)} daylight`);
    } else {
        setDetailText('sunriseGain', '—');
    }
    setDetailText('sunriseNextNoon', tomorrowSunrise && tomorrowSunset ? formatTimeDetail(new Date((tomorrowSunrise.getTime() + tomorrowSunset.getTime()) / 2)) : '—');
    setDetailText('sunriseCivilDawn', formatTimeDetail(nextTimes?.dawn));
    setDetailText('sunriseNauticalDawn', formatTimeDetail(nextTimes?.nauticalDawn));

    // Season detail fields rely on separate data; they are updated later inside init.
    setDetailText('seasonHemisphere', formatHemisphere(lat));

    // Current weather detail updated in updateWeatherDetail().
}

// Rough season helpers (astronomical, approximate fixed dates)
function seasonInfo(now) {
    const y = now.getFullYear();
    const seasonDefinitions = [
        { name: 'March Equinox', month: 2, day: 20, hour: 9 },
        { name: 'June Solstice', month: 5, day: 21, hour: 14 },
        { name: 'September Equinox', month: 8, day: 22, hour: 18 },
        { name: 'December Solstice', month: 11, day: 21, hour: 15 }
    ];

    const buildEvents = (year) => seasonDefinitions.map(def => ({
        name: def.name,
        date: new Date(Date.UTC(year, def.month, def.day, def.hour, 0))
    }));

    const events = [...buildEvents(y - 1), ...buildEvents(y), ...buildEvents(y + 1)].sort((a, b) => a.date - b.date);

    const next = events.find(e => e.date > now) || events[events.length - 1];
    const nextIndex = events.indexOf(next);
    const prev = events[nextIndex > 0 ? nextIndex - 1 : events.length - 1];

    const daysUntil = Math.max(0, Math.floor((next.date - now) / 86_400_000));
    const daysSincePrev = Math.max(0, Math.floor((now - prev.date) / 86_400_000));

    const currentYearEvents = buildEvents(y);
    let currentSeason = 'Winter';
    if (now >= currentYearEvents[0].date && now < currentYearEvents[1].date) currentSeason = 'Spring';
    else if (now >= currentYearEvents[1].date && now < currentYearEvents[2].date) currentSeason = 'Summer';
    else if (now >= currentYearEvents[2].date && now < currentYearEvents[3].date) currentSeason = 'Autumn';
    else currentSeason = 'Winter';

    return {
        currentSeason,
        nextName: next.name,
        nextDate: next.date,
        nextIn: daysUntil,
        previousName: prev.name,
        previousDate: prev.date,
        daysSincePrev
    };
}

function getSeasonIcon(season) {
    const icons = {
        'Spring': '🌸',
        'Summer': '☀️',
        'Autumn': '🍁',
        'Winter': '❄️'
    };
    return icons[season] || '🌿';
}

function getSeasonDateRange(season) {
    const ranges = {
        'Spring': 'March – May',
        'Summer': 'June – August',
        'Autumn': 'September – November',
        'Winter': 'December – February'
    };
    return ranges[season] || '—';
}

function moonLabel(phase) {
    // phase: 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter
    const p = phase;
    if (p < 0.03 || p > 0.97) return 'New Moon';
    if (p < 0.22) return 'Waxing Crescent';
    if (p < 0.28) return 'First Quarter';
    if (p < 0.47) return 'Waxing Gibbous';
    if (p < 0.53) return 'Full Moon';
    if (p < 0.72) return 'Waning Gibbous';
    if (p < 0.78) return 'Last Quarter';
    return 'Waning Crescent';
}

function updateMoonSVG(phase, fraction) {
    // Generate SVG path for moon phase using accurate ellipse formula
    // phase: 0-1 (0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter, 1=new)
    // fraction: 0-1 (portion of moon illuminated)

    const isWaxing = phase < 0.5;
    const n = fraction; // illumination fraction

    // SVG dimensions (matching viewBox="0 0 100 100")
    const centerX = 50;
    const centerY = 50;
    const R = 44; // radius of moon circle

    // Calculate semi-minor axis of terminator ellipse using formula: b = (2n - 1) × R
    // n = 0 (new): b = -R (full shadow)
    // n = 0.5 (half): b = 0 (straight line)
    // n = 1 (full): b = R (no shadow)
    const b = (2 * n - 1) * R;

    // Generate SVG path for shadow
    let shadowPath = '';

    if (n <= 0.01) {
        // New moon - full shadow (full circle)
        shadowPath = `M ${centerX} ${centerY - R} A ${R} ${R} 0 1 1 ${centerX} ${centerY + R} A ${R} ${R} 0 1 1 ${centerX} ${centerY - R} Z`;
    } else if (n >= 0.99) {
        // Full moon - no shadow
        shadowPath = '';
    } else {
        // Partial phase - draw shadow using ellipse terminator

        // The shadow consists of:
        // 1. The outer arc of the moon circle (on the shadow side)
        // 2. The elliptical terminator curve

        if (isWaxing) {
            // Waxing: shadow on left, light on right
            // Shadow path: left arc + ellipse
            if (b >= 0) {
                // Past half moon - shadow is a crescent on the left
                shadowPath = `M ${centerX} ${centerY - R} A ${R} ${R} 0 0 0 ${centerX} ${centerY + R} A ${Math.abs(b)} ${R} 0 0 1 ${centerX} ${centerY - R} Z`;
            } else {
                // Before half moon - shadow covers most of the moon
                shadowPath = `M ${centerX} ${centerY - R} A ${R} ${R} 0 0 0 ${centerX} ${centerY + R} A ${Math.abs(b)} ${R} 0 0 0 ${centerX} ${centerY - R} Z`;
            }
        } else {
            // Waning: shadow on right, light on left
            // Shadow path: right arc + ellipse
            if (b >= 0) {
                // Before last quarter - shadow is a crescent on the right
                shadowPath = `M ${centerX} ${centerY - R} A ${R} ${R} 0 0 1 ${centerX} ${centerY + R} A ${Math.abs(b)} ${R} 0 0 0 ${centerX} ${centerY - R} Z`;
            } else {
                // After last quarter - shadow covers most of the moon
                shadowPath = `M ${centerX} ${centerY - R} A ${R} ${R} 0 0 1 ${centerX} ${centerY + R} A ${Math.abs(b)} ${R} 0 0 1 ${centerX} ${centerY - R} Z`;
            }
        }
    }

    // Update the SVG shadow path
    const shadowElement = document.getElementById('moonShadow');
    if (shadowElement) {
        shadowElement.setAttribute('d', shadowPath);
    }
}
