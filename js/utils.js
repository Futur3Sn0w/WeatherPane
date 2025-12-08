// Utility and formatting functions for WeatherPane
// Depends on: jQuery

// Simple utility functions
const pad = n => String(n).padStart(2, '0');

const fmt = (d) => {
    let h = d.getHours();
    const m = pad(d.getMinutes());
    const am = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return { t: `${h}:${m}`, am };
};

const hrsMin = ms => {
    const sign = ms < 0 ? '-' : '';
    ms = Math.abs(ms);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.round((ms % 3_600_000) / 60_000);
    return `${sign}${h} hr${h !== 1 ? 's' : ''}, ${m} min`;
}

const dayName = d => d.toLocaleDateString(undefined, { weekday: 'long' });

const RAD2DEG = 180 / Math.PI;

const toDegrees = rad => rad * RAD2DEG;

// Formatting functions
function formatTimeDetail(date) {
    if (!date || Number.isNaN(date.getTime())) return '—';
    const { t, am } = fmt(date);
    return `${t} ${am}`;
}

function formatDurationHM(ms, { allowZeroMinutes = true, includeSign = false } = {}) {
    if (ms == null || Number.isNaN(ms)) return '—';
    const sign = ms < 0 ? '-' : '';
    const abs = Math.abs(ms);
    const totalMinutes = Math.round(abs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes || (!hours && allowZeroMinutes)) parts.push(`${minutes}m`);
    return `${includeSign && sign ? sign : ''}${parts.join(' ') || '0m'}`;
}

function formatSignedMinutes(ms) {
    if (ms == null || Number.isNaN(ms)) return '—';
    const minutes = Math.round(ms / 60_000);
    if (minutes === 0) return 'Aligned';
    const sign = minutes > 0 ? '+' : '-';
    return `${sign}${Math.abs(minutes)} min`;
}

function formatPercent(value, decimals = 0) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${value.toFixed(decimals)}%`;
}

function azimuthToCardinal(deg) {
    if (deg == null || Number.isNaN(deg)) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
    return directions[Math.round(deg / 45)];
}

function formatAzimuth(deg) {
    if (deg == null || Number.isNaN(deg)) return '—';
    const wrapped = (deg + 360) % 360;
    return `${wrapped.toFixed(0)}° ${azimuthToCardinal(wrapped)}`;
}

function setDetailText(id, value) {
    const $el = $(`#${id}`);
    if ($el.length) {
        $el.text(value ?? '—');
    }
}

function formatMoonDistance(km) {
    if (km == null || Number.isNaN(km)) return '—';
    return `${Math.round(km).toLocaleString()} km`;
}

function formatHemisphere(lat) {
    if (lat == null || Number.isNaN(lat)) return '—';
    if (lat > 0.5) return 'Northern Hemisphere';
    if (lat < -0.5) return 'Southern Hemisphere';
    return 'Near Equator';
}

const weatherCodeDescriptions = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Light rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Light snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Light rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Light snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with light hail',
    99: 'Thunderstorm with heavy hail'
};

function describeWeatherCode(code, cloudCover) {
    if (code == null) return '—';
    const base = weatherCodeDescriptions[code] || 'Conditions unavailable';
    if (typeof cloudCover === 'number') {
        return `${base} · ${Math.round(cloudCover)}% cloud cover`;
    }
    return base;
}

function formatWind(speed, gust) {
    if (speed == null || Number.isNaN(speed)) return '—';
    const speedMph = speed * 2.23694;
    const primary = `${speed.toFixed(1)} m/s (${speedMph.toFixed(1)} mph)`;
    if (gust != null && !Number.isNaN(gust) && gust > speed + 0.3) {
        const gustMph = gust * 2.23694;
        return `${primary} · gusts ${gust.toFixed(1)} m/s (${gustMph.toFixed(1)} mph)`;
    }
    return primary;
}

function computeOverlapDuration(start, end, intervalStart, intervalEnd) {
    if (!start || !end || !intervalStart || !intervalEnd) return 0;
    const a = start.getTime();
    const b = end.getTime();
    const c = intervalStart.getTime();
    const d = intervalEnd.getTime();
    const overlapStart = Math.max(a, c);
    const overlapEnd = Math.min(b, d);
    return Math.max(0, overlapEnd - overlapStart);
}
