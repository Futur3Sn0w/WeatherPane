// Canvas scene classes for WeatherPane background animations
// Depends on: Three.js, VANTA.js

function getActiveThemeMode() {
    if (typeof document === 'undefined') return 'dark';
    const bodyMode = document.body ? document.body.getAttribute('data-theme-mode') : null;
    const rootMode = document.documentElement ? document.documentElement.getAttribute('data-theme-mode') : null;
    return (bodyMode || rootMode || 'dark').toLowerCase();
}

function isLightThemeMode() {
    return getActiveThemeMode() === 'light';
}

class CanvasStarfield {
    constructor(hostCanvas) {
        this.hostCanvas = hostCanvas;
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'starCanvas';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.opacity = '0';
        hostCanvas.parentElement.insertBefore(this.canvas, hostCanvas);

        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.width = 0;
        this.height = 0;
        this.horizonRatio = 0.75;
        this.stars = [];
        this.textureCache = new Map();
        this.time = 0;
        this.lastOpacity = 0;
    }

    destroy() {
        if (this.canvas && this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }
        this.textureCache.clear();
        this.stars = [];
        this.ctx = null;
        this.canvas = null;
    }

    resize(width, height) {
        if (!this.canvas || !this.ctx) return;
        this.dpr = window.devicePixelRatio || 1;
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        this.canvas.width = Math.max(1, Math.round(this.width * this.dpr));
        this.canvas.height = Math.max(1, Math.round(this.height * this.dpr));
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
        this.generateStars();
    }

    generateStars() {
        if (!this.ctx) return;
        const area = this.width * this.height;
        const targetCount = Math.min(600, Math.max(260, Math.round(area / 2500)));
        const horizonY = this.height * this.horizonRatio;
        const skyHeight = Math.max(1, horizonY * 0.9);

        this.stars = [];
        for (let i = 0; i < targetCount; i++) {
            const depth = Math.random();
            const baseSize = 1.4 + depth * 2.6;
            const color = this.pickStarColor();
            const texture = this.getTextureForColor(color);

            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * skyHeight,
                depth,
                size: baseSize,
                baseAlpha: 0.35 + Math.random() * 0.55,
                twinkleSpeed: 0.35 + Math.random() * 0.6,
                phase: Math.random() * Math.PI * 2,
                texture
            });
        }
    }

    pickStarColor() {
        const temp = Math.random();
        let r = 255;
        let g = 255;
        let b = 255;
        if (temp > 0.9) {
            r = 200 + Math.random() * 40;
            g = 216 + Math.random() * 30;
            b = 255;
        } else if (temp > 0.7) {
            r = 255;
            g = 240 + Math.random() * 15;
            b = 200 + Math.random() * 40;
        } else if (temp < 0.2) {
            r = 255;
            g = 225 + Math.random() * 20;
            b = 180 + Math.random() * 40;
        }
        return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }

    getTextureForColor(color) {
        const key = `${color.r}-${color.g}-${color.b}`;
        if (!this.textureCache.has(key)) {
            this.textureCache.set(key, this.createStarTexture(color));
        }
        return this.textureCache.get(key);
    }

    createStarTexture({ r, g, b }) {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
        gradient.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, 0.7)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        return canvas;
    }

    update(delta, opacity) {
        if (!this.ctx) return;

        if (opacity <= 0.001) {
            if (this.lastOpacity > 0.001) {
                this.ctx.clearRect(0, 0, this.width, this.height);
            }
            this.canvas.style.opacity = '0';
            this.lastOpacity = 0;
            return;
        }

        this.canvas.style.opacity = opacity.toFixed(3);
        this.lastOpacity = opacity;
        this.time += delta;

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.globalCompositeOperation = 'lighter';

        const time = this.time;
        for (const star of this.stars) {
            const primary = Math.sin(time * star.twinkleSpeed * Math.PI * 2 + star.phase);
            const secondary = Math.sin(time * (star.twinkleSpeed * 1.7) * Math.PI * 2 + star.phase * 1.31);
            let alpha = star.baseAlpha * (0.6 + primary * 0.25 + secondary * 0.18);
            alpha = Math.max(0, Math.min(1, alpha)) * opacity;

            const scale = star.size * (0.8 + star.depth * 0.6);
            const half = scale / 2;
            this.ctx.globalAlpha = alpha;
            this.ctx.drawImage(star.texture, star.x - half, star.y - half, scale, scale);
        }

        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
    }
}


class CanvasScene {
    constructor(container, options = {}) {
        this.container = container;
        this.options = { intensity: 0.5, variant: 'default', ...options };
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'weather-background-canvas';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.width = 0;
        this.height = 0;
        this.dpr = window.devicePixelRatio || 1;
        this.running = false;
        this.frameId = null;
        this.lastTimestamp = performance.now();
        this.handleResize = this.resize.bind(this);
        window.addEventListener('resize', this.handleResize);
        this.resize();
    }

    setContext(context = {}) {
        this.options = { ...this.options, ...context };
    }

    getThemeMode() {
        return getActiveThemeMode();
    }

    isLightTheme() {
        return isLightThemeMode();
    }

    resize() {
        if (!this.container || !this.canvas) return;
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        if (width !== this.width || height !== this.height || dpr !== this.dpr) {
            this.dpr = dpr;
            this.width = width;
            this.height = height;
            this.canvas.width = width * dpr;
            this.canvas.height = height * dpr;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (typeof this.onResize === 'function') {
                this.onResize(width, height);
            }
        }
        if (!this.running && typeof this.renderFrame === 'function') {
            this.renderFrame(0);
        }
    }

    loop = (timestamp) => {
        if (!this.running) return;
        const delta = Math.min(0.12, (timestamp - this.lastTimestamp) / 1000);
        this.lastTimestamp = timestamp;
        if (typeof this.renderFrame === 'function') {
            this.renderFrame(delta);
        }
        this.frameId = requestAnimationFrame(this.loop);
    };

    resume() {
        if (this.running) return;
        this.running = true;
        this.lastTimestamp = performance.now();
        this.frameId = requestAnimationFrame(this.loop);
    }

    pause() {
        if (!this.running) return;
        this.running = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    destroy() {
        this.pause();
        window.removeEventListener('resize', this.handleResize);
        if (this.canvas && this.canvas.parentElement === this.container) {
            this.container.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
    }
}

class ClearDayScene extends CanvasScene {
    constructor(container, options) {
        super(container, options);
        this.motes = [];
        this.beams = [];
        this.setContext(options);
        // Ensure beams and motes are created after initialization
        this.onResize(this.width, this.height);
    }

    setContext(context = {}) {
        super.setContext(context);
        this.intensity = Math.max(0.25, Math.min(1, this.options.intensity ?? 0.6));
    }

    onResize(width, height) {
        this.createBeams();
        this.createMotes();
    }

    createBeams() {
        const beamCount = 3;
        this.beams = Array.from({ length: beamCount }).map((_, idx) => ({
            offset: (idx / beamCount) * this.width,
            width: this.width * (0.16 + Math.random() * 0.12),
            speed: 10 + Math.random() * 16,
            angle: (Math.PI / 180) * (10 + Math.random() * 5),
            intensity: 0.05 + this.intensity * 0.08
        }));
    }

    createMotes() {
        const density = (this.width * this.height) / 15000;
        const count = Math.max(16, Math.round(density * (0.7 + this.intensity)));
        this.motes = Array.from({ length: count }).map(() => ({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            radius: 3 + Math.random() * 4,
            speed: 14 + Math.random() * 20,
            drift: (Math.random() - 0.5) * 12,
            alpha: 0.04 + Math.random() * 0.08
        }));
    }

    renderFrame(delta) {
        const ctx = this.ctx;
        if (!ctx) return;

        ctx.clearRect(0, 0, this.width, this.height);

        const lightTheme = this.isLightTheme();
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
        const hazeTop = lightTheme ? 'rgba(64, 102, 140, 0.28)' : 'rgba(20, 36, 56, 0.42)';
        const hazeBottom = lightTheme ? 'rgba(118, 162, 210, 0.12)' : 'rgba(12, 24, 40, 0.18)';
        gradient.addColorStop(0, hazeTop);
        gradient.addColorStop(1, hazeBottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.globalCompositeOperation = 'lighter';
        this.beams.forEach((beam) => {
            beam.offset += beam.speed * delta;
            if (beam.offset - beam.width > this.width) {
                beam.offset = -beam.width;
            }
            ctx.save();
            ctx.translate(beam.offset, 0);
            ctx.rotate(-beam.angle);
            const beamGradient = ctx.createLinearGradient(0, -this.height, 0, this.height * 1.8);
            beamGradient.addColorStop(0, 'rgba(255, 255, 220, 0)');
            const beamAlphaBase = Math.min(1, Math.max(0, Number.isFinite(beam.intensity) ? beam.intensity : 0.1));
            const beamAlpha = Math.min(1, beamAlphaBase * (lightTheme ? 4.5 : 1));
            const beamMidColor = lightTheme ? 'rgba(255, 254, 250' : 'rgba(255, 245, 210';
            beamGradient.addColorStop(0.4, `${beamMidColor}, ${beamAlpha.toFixed(3)})`);
            beamGradient.addColorStop(1, 'rgba(255, 255, 220, 0)');
            ctx.fillStyle = beamGradient;
            ctx.fillRect(-beam.width / 2, -this.height, beam.width, this.height * 2.6);
            ctx.restore();
        });

        this.motes.forEach((mote) => {
            mote.y -= mote.speed * delta * 0.6;
            mote.x += mote.drift * delta * 0.2;
            if (mote.y + mote.radius < 0) {
                mote.y = this.height + mote.radius;
                mote.x = Math.random() * this.width;
            }
            if (mote.x < -20) mote.x = this.width + 20;
            if (mote.x > this.width + 20) mote.x = -20;

            const r = mote.radius * 2.4;
            const glow = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, r);
            const moteAlphaBase = Math.min(1, Math.max(0, Number.isFinite(mote.alpha) ? mote.alpha : 0.06));
            const moteAlpha = Math.min(1, moteAlphaBase * (lightTheme ? 5.0 : 1));
            const moteColor = lightTheme ? '255, 254, 252' : '255, 245, 210';
            glow.addColorStop(0, `rgba(${moteColor}, ${moteAlpha.toFixed(3)})`);
            glow.addColorStop(1, `rgba(${moteColor}, 0)`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(mote.x, mote.y, r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
    }
}

class RainScene extends CanvasScene {
    constructor(container, options) {
        super(container, options);
        this.drops = [];
        this.variant = 'rain';
        this.setContext(options);
    }

    setContext(context = {}) {
        super.setContext(context);
        this.variant = context.variant || 'rain';
        this.intensity = Math.max(0.25, Math.min(1.4, context.intensity ?? 0.7));
        this.onResize(this.width, this.height);
    }

    onResize(width, height) {
        const base = Math.round((width * height) / 2200);
        const target = Math.max(36, Math.round(base * this.intensity));
        this.drops = Array.from({ length: target }).map(() => this.spawnDrop());
    }

    spawnDrop() {
        if (this.variant === 'snow') {
            return {
                type: 'snow',
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: 1.8 + Math.random() * 2.4,
                speed: 18 + Math.random() * 24,
                sway: (Math.random() - 0.5) * 18,
                drift: (Math.random() - 0.5) * 8
            };
        }
        const heavy = this.intensity > 0.9 || this.variant === 'night-rain';
        return {
            type: 'rain',
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            length: 14 + Math.random() * 20,
            speed: (heavy ? 320 : 240) + Math.random() * 160,
            thickness: heavy ? 1.2 + Math.random() * 1.4 : 0.8 + Math.random() * 1,
            sway: (Math.random() - 0.5) * 18
        };
    }

    renderFrame(delta) {
        const ctx = this.ctx;
        if (!ctx) return;

        ctx.clearRect(0, 0, this.width, this.height);

        const lightTheme = this.isLightTheme();
        const backdrop = ctx.createLinearGradient(0, 0, 0, this.height);
        const bgTop = lightTheme ? 'rgba(116, 144, 178, 0.35)' : 'rgba(8, 16, 28, 0.6)';
        const bgBottom = lightTheme ? 'rgba(148, 174, 204, 0.18)' : 'rgba(6, 14, 26, 0.3)';
        backdrop.addColorStop(0, bgTop);
        backdrop.addColorStop(1, bgBottom);
        ctx.fillStyle = backdrop;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.globalCompositeOperation = lightTheme ? 'source-over' : 'lighter';

        this.drops.forEach((drop, index) => {
            if (drop.type === 'snow') {
                drop.y += drop.speed * delta * 0.45;
                drop.x += drop.drift * delta + Math.sin(performance.now() * 0.0006 + drop.y * 0.015) * drop.sway * delta * 0.4;
                if (drop.y - drop.radius > this.height) {
                    this.drops[index] = this.spawnDrop();
                    this.drops[index].y = -this.drops[index].radius;
                }
                if (drop.x < -20) drop.x = this.width + 20;
                if (drop.x > this.width + 20) drop.x = -20;
                const flakeAlpha = (lightTheme ? 0.45 : 0.35) + Math.random() * 0.25;
                ctx.save();
                ctx.filter = lightTheme ? 'blur(2.5px)' : 'blur(4px)';
                ctx.globalAlpha = flakeAlpha;
                ctx.fillStyle = lightTheme ? 'rgba(135, 154, 178, 0.9)' : 'rgba(235, 245, 255, 0.9)';
                ctx.beginPath();
                ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                drop.y += drop.speed * delta;
                drop.x += drop.sway * delta * 0.05;
                if (drop.y - drop.length > this.height) {
                    this.drops[index] = this.spawnDrop();
                    this.drops[index].y = -this.drops[index].length;
                }
                if (drop.x < -20) drop.x = this.width + 20;
                if (drop.x > this.width + 20) drop.x = -20;
                const rainAlpha = lightTheme ? 0.78 : (this.variant === 'night-rain' ? 0.55 : 0.45);
                ctx.globalAlpha = rainAlpha;
                ctx.lineWidth = drop.thickness;
                const rainColor = this.variant === 'night-rain'
                    ? (lightTheme ? 'rgba(58, 82, 118, 0.9)' : 'rgba(180, 210, 255, 0.55)')
                    : (lightTheme ? 'rgba(66, 98, 138, 0.85)' : 'rgba(200, 220, 255, 0.55)');
                ctx.strokeStyle = rainColor;
                ctx.beginPath();
                ctx.moveTo(drop.x, drop.y);
                ctx.lineTo(drop.x + drop.sway * 0.08, drop.y - drop.length);
                ctx.stroke();
            }
        });

        ctx.restore();
    }
}

// CloudyScene now uses Three.js volumetric clouds with custom shaders
// This is a wrapper around ThreeJSVolumetricClouds to match the expected API
class CloudyScene {
    constructor(container, options = {}) {
        this.container = container;
        this.options = { intensity: 0.8, ...options };
        this.running = true;

        // Create the Three.js volumetric cloud engine
        this.cloudEngine = new ThreeJSVolumetricClouds(container, this.options);

        // Bind resize handler
        this.handleResize = this.resize.bind(this);
        window.addEventListener('resize', this.handleResize);
    }

    start() {
        this.running = true;
        if (this.cloudEngine) {
            this.cloudEngine.start();
        }
    }

    pause() {
        this.running = false;
        if (this.cloudEngine) {
            this.cloudEngine.pause();
        }
    }

    resume() {
        this.running = true;
        if (this.cloudEngine) {
            this.cloudEngine.resume();
        }
    }

    resize() {
        if (this.cloudEngine) {
            this.cloudEngine.resize();
        }
    }

    updateOptions(options) {
        this.options = { ...this.options, ...options };
        if (this.cloudEngine) {
            this.cloudEngine.updateOptions(this.options);
        }
    }

    setContext(context = {}) {
        this.updateOptions(context);
        // Update theme if needed
        if (this.cloudEngine && this.cloudEngine.updateTheme) {
            this.cloudEngine.updateTheme();
        }
    }

    destroy() {
        window.removeEventListener('resize', this.handleResize);
        if (this.cloudEngine) {
            this.cloudEngine.destroy();
            this.cloudEngine = null;
        }
    }
}

class StarryNightScene extends CanvasScene {
    constructor(container, options) {
        super(container, options);
        this.stars = [];
        this.setContext(options);
    }

    setContext(context = {}) {
        super.setContext(context);
        this.cloudCover = Math.max(0, Math.min(100, context.cloudCover ?? 0));
        this.onResize(this.width, this.height);
    }

    onResize(width, height) {
        const area = width * height;
        const baseCount = Math.min(650, Math.max(220, Math.round(area / 3200)));
        const visibility = 1 - Math.min(0.9, (this.cloudCover / 100) * 0.9);
        const count = Math.max(60, Math.round(baseCount * visibility));
        this.stars = Array.from({ length: count }).map(() => ({
            x: Math.random() * width,
            y: Math.random() * height * 0.8,
            size: Math.random() < 0.5 ? 1 : 2,
            twinkleSpeed: 0.35 + Math.random() * 0.55,
            baseAlpha: 0.66 + Math.random() * 0.34,
            phase: Math.random() * Math.PI * 2,
            flicker: Math.random() * 0.15
        }));
    }

    renderFrame(delta) {
        const ctx = this.ctx;
        if (!ctx) return;

        ctx.clearRect(0, 0, this.width, this.height);

        const lightTheme = this.isLightTheme();
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
        const skyTop = lightTheme ? 'rgba(24, 32, 52, 0.75)' : 'rgba(5, 12, 24, 0.85)';
        const skyBottom = lightTheme ? 'rgba(38, 52, 76, 0.42)' : 'rgba(8, 18, 32, 0.4)';
        gradient.addColorStop(0, skyTop);
        gradient.addColorStop(1, skyBottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.globalCompositeOperation = lightTheme ? 'source-over' : 'lighter';
        const time = performance.now() * 0.001;
        const coverFactor = Math.max(0.25, 1 - this.cloudCover / 105);
        const starColor = lightTheme ? '#d8e4f0' : '#dceeff';
        this.stars.forEach((star) => {
            const twinkle = Math.sin(time * star.twinkleSpeed + star.phase) * (0.12 + star.flicker);
            const alpha = Math.min(1, Math.max(0.35, (star.baseAlpha + twinkle) * coverFactor));
            ctx.globalAlpha = alpha * (lightTheme ? 1.3 : 1);
            ctx.fillStyle = starColor;
            ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
}
