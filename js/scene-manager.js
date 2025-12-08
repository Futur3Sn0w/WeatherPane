// Scene management for WeatherPane background effects
// Depends on: jQuery, canvas-scenes.js, weather.js

// WeatherSceneManager - Manages switching between different canvas weather scenes
class WeatherSceneManager {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.sceneId = null;
        this.paused = false;
        this.context = {};
    }

    static registry = {
        'clear-day': ClearDayScene,
        cloudy: CloudyScene,
        rain: RainScene,
        storm: StormScene,
        'night-clear': StarryNightScene
    };

    setScene(sceneId, context = {}) {
        if (this.sceneId === sceneId && this.scene) {
            this.updateContext(context);
            return;
        }

        if (this.scene) {
            this.scene.destroy();
        }

        const SceneCtor = WeatherSceneManager.registry[sceneId] || WeatherSceneManager.registry.cloudy;
        this.scene = new SceneCtor(this.container, context);
        this.sceneId = sceneId;
        this.context = { ...context };

        if (this.paused) {
            this.scene.pause();
        } else {
            this.scene.resume();
        }
    }

    updateContext(context = {}) {
        this.context = { ...this.context, ...context };
        if (this.scene && typeof this.scene.setContext === 'function') {
            this.scene.setContext(this.context);
        }
    }

    pause() {
        this.paused = true;
        if (this.scene) {
            this.scene.pause();
        }
    }

    resume() {
        this.paused = false;
        if (this.scene) {
            this.scene.resume();
        }
    }

    destroy() {
        if (this.scene) {
            this.scene.destroy();
        }
        this.scene = null;
        this.sceneId = null;
        this.context = {};
    }
}

// Background/scene management variables and constants
let backgroundManager = null;
let latestSunTimes = {
    sunrise: null,
    sunset: null,
    times: null,
    lat: null,
    lon: null
};
let cloudAnimationPaused = false;

const CLOUD_SETTING_KEY = 'weatherPane:cloudState';
const BACKGROUND_SCENE_SETTING_KEY = 'weatherPane:backgroundScene';
const prefersReducedMotionQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

// Weather code sets
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const FOG_CODES = new Set([45, 48]);
const CLOUDY_CODES = new Set([2, 3]);

// Event listener for prefers-reduced-motion
if (prefersReducedMotionQuery) {
    const handleMotionPreferenceChange = () => {
        initCloudBackdrop();
    };

    if (typeof prefersReducedMotionQuery.addEventListener === 'function') {
        prefersReducedMotionQuery.addEventListener('change', handleMotionPreferenceChange);
    } else if (typeof prefersReducedMotionQuery.addListener === 'function') {
        prefersReducedMotionQuery.addListener(handleMotionPreferenceChange);
    }
}

// Scene management functions

function ensureBackgroundManager() {
    if (!backgroundManager) {
        const el = $('#cloudLayer')[0];
        if (!el) return null;
        backgroundManager = new WeatherSceneManager(el);
    }
    return backgroundManager;
}

function getCloudSetting() {
    const saved = localStorage.getItem(CLOUD_SETTING_KEY);
    return saved || 'on';
}

function setCloudSetting(state) {
    localStorage.setItem(CLOUD_SETTING_KEY, state);
}

function getForcedSceneSetting() {
    const saved = localStorage.getItem(BACKGROUND_SCENE_SETTING_KEY);
    return saved || 'auto';
}

function setForcedSceneSetting(value) {
    localStorage.setItem(BACKGROUND_SCENE_SETTING_KEY, value);
}

function destroyCloudAnimation() {
    if (backgroundManager) {
        backgroundManager.destroy();
        backgroundManager = null;
    }
    const $el = $('#cloudLayer');
    if ($el.length) {
        $el.removeClass('sunny');
    }
    cloudAnimationPaused = false;
}

function isNightTime(now = new Date()) {
    if (latestSunTimes.sunrise && latestSunTimes.sunset) {
        return now < latestSunTimes.sunrise || now >= latestSunTimes.sunset;
    }
    const hour = now.getHours();
    return hour < 6 || hour >= 19;
}

function computeSceneContext() {
    const now = new Date();
    const isNight = isNightTime(now);
    const cloudCover = typeof currentCloudCover === 'number' ? currentCloudCover : 0;
    const code = currentWeatherCode;

    let sceneId = isNight ? 'night-clear' : 'clear-day';
    let variant = 'rain';
    let intensity = Math.max(0.3, cloudCover / 100);

    if (code != null) {
        if (SNOW_CODES.has(code)) {
            sceneId = 'rain';
            variant = 'snow';
            intensity = 0.7;
        } else if (RAIN_CODES.has(code)) {
            // Heavy rain & thunderstorms get storm scene (rain + clouds)
            const isHeavyRain = code === 63 || code === 65 || code === 82 || code === 95 || code === 96 || code === 99;
            sceneId = isHeavyRain ? 'storm' : 'rain';
            variant = isNight ? 'night-rain' : 'rain';
            intensity = isHeavyRain ? 1.0 : 0.65;
        } else if (FOG_CODES.has(code)) {
            sceneId = 'cloudy';
            intensity = 0.9;
        } else if (CLOUDY_CODES.has(code) || cloudCover > 55) {
            sceneId = 'cloudy';
            intensity = Math.max(intensity, 0.75);
        } else if (code === 0 || code === 1) {
            sceneId = isNight ? 'night-clear' : 'clear-day';
            intensity = isNight ? 0.5 : 0.4;
        }
    } else if (cloudCover > 60) {
        sceneId = 'cloudy';
        intensity = Math.max(intensity, 0.8);
    }

    if (isNight && sceneId !== 'rain') {
        sceneId = 'night-clear';
    }

    return {
        sceneId,
        variant,
        intensity,
        cloudCover,
        isNight
    };
}

function refreshBackgroundScene({ fromInit = false } = {}) {
    const $el = $('#cloudLayer');
    if (!$el.length) {
        if (fromInit) {
            console.warn('[Background] cloudLayer element not found');
        }
        return;
    }

    const state = getCloudSetting();
    const reducedMotion = prefersReducedMotionQuery && prefersReducedMotionQuery.matches;

    if (state === 'off' || reducedMotion) {
        if (reducedMotion && state === 'on') {
            console.log('[Background] prefers-reduced-motion enabled; disabling backdrop');
        } else if (fromInit) {
            console.log('[Background] Disabled via settings');
        }
        $el.removeClass('sunny').addClass('hiding');
        setTimeout(() => {
            destroyCloudAnimation();
            $el.css('display', 'none').removeClass('hiding').removeClass('paused');
        }, 600);
        return;
    }

    const manager = ensureBackgroundManager();
    if (!manager) return;

    $el.css('display', 'block').removeClass('hiding');

    const context = computeSceneContext();
    const forcedScene = getForcedSceneSetting();
    if (forcedScene && forcedScene !== 'auto') {
        switch (forcedScene) {
            case 'clear':
                context.sceneId = 'clear-day';
                context.variant = 'rain';
                context.intensity = 0.45;
                context.cloudCover = 5;
                context.isNight = false;
                break;
            case 'partly-cloudy':
                context.sceneId = 'cloudy';
                context.variant = 'rain';
                context.intensity = 0.75;
                context.cloudCover = 30; // 30% coverage - sparse clouds
                context.isNight = false;
                break;
            case 'cloudy':
                context.sceneId = 'cloudy';
                context.variant = 'rain';
                context.intensity = 0.8;
                context.cloudCover = 55; // 55% coverage - moderate clouds
                context.isNight = false;
                break;
            case 'mostly-cloudy':
                context.sceneId = 'cloudy';
                context.variant = 'rain';
                context.intensity = 0.85;
                context.cloudCover = 75; // 75% coverage - nearly full
                context.isNight = false;
                break;
            case 'overcast':
                context.sceneId = 'cloudy';
                context.variant = 'rain';
                context.intensity = 0.95;
                context.cloudCover = 95; // 95% coverage - complete coverage
                context.isNight = false;
                break;
            case 'rain':
                context.sceneId = 'rain';
                context.variant = 'rain';
                context.intensity = 0.9;
                context.cloudCover = 90; // Rainy weather usually has high cloud cover
                context.isNight = false;
                break;
            case 'storm':
                context.sceneId = 'storm';
                context.variant = 'rain';
                context.intensity = 1.0; // Maximum intensity for storms
                context.cloudCover = 95; // Nearly complete cloud coverage
                context.isNight = false;
                break;
            case 'snow':
                context.sceneId = 'rain';
                context.variant = 'snow';
                context.intensity = 0.85;
                context.cloudCover = 85; // Snowy weather typically has high cloud cover
                context.isNight = false;
                break;
            case 'night':
                context.sceneId = 'night-clear';
                context.variant = 'rain';
                context.intensity = 0.6;
                context.cloudCover = 10; // Clear night has minimal clouds
                context.isNight = true;
                break;
        }
        context.forcedScene = forcedScene;
    } else {
        context.forcedScene = 'auto';
    }

    if (context.sceneId === 'clear-day') {
        $el.addClass('sunny');
    } else {
        $el.removeClass('sunny');
    }

    manager.setScene(context.sceneId, context);
    manager.updateContext(context);

    if (state === 'paused') {
        manager.pause();
        $el.addClass('paused');
        cloudAnimationPaused = true;
    } else {
        manager.resume();
        $el.removeClass('paused');
        cloudAnimationPaused = false;
    }

    if (fromInit) {
        console.log('[Background] Scene initialised:', context.sceneId, context);
    }
}

function initCloudBackdrop() {
    refreshBackgroundScene({ fromInit: true });
}

function pauseCloudAnimation() {
    const $el = $('#cloudLayer');
    if (!$el.length) return;
    const manager = ensureBackgroundManager();
    if (!manager) return;
    manager.pause();
    $el.addClass('paused');
    cloudAnimationPaused = true;
    console.log('[Background] Animation paused');
}

function resumeCloudAnimation() {
    const $el = $('#cloudLayer');
    if (!$el.length) return;
    const reducedMotion = prefersReducedMotionQuery && prefersReducedMotionQuery.matches;
    if (reducedMotion) {
        console.log('[Background] prefers-reduced-motion active; keeping animation paused');
        cloudAnimationPaused = true;
        return;
    }
    const manager = ensureBackgroundManager();
    if (!manager) {
        initCloudBackdrop();
        return;
    }
    manager.resume();
    $el.removeClass('paused');
    cloudAnimationPaused = false;
    console.log('[Background] Animation resumed');
}

function setCloudState(state) {
    setCloudSetting(state);
    switch (state) {
        case 'on':
            resumeCloudAnimation();
            refreshBackgroundScene();
            break;
        case 'paused':
            pauseCloudAnimation();
            break;
        case 'off':
            refreshBackgroundScene();
            break;
    }
}
