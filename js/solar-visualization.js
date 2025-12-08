// Sun visualization class for WeatherPane
// Depends on: jQuery, utils.js, solar-calculations.js, canvas-scenes.js (CanvasStarfield), SunCalc library

// Sun Visualization Class
class SunVisualization {
    constructor(canvasId, sliderId, pillId, timeDisplayId, resetBtnId) {
        this.canvas = $(`#${canvasId}`)[0];
        this.ctx = this.canvas.getContext('2d');
        this.backgroundDiv = $('#sunVizBackground')[0];
        this.slider = $(`#${sliderId}`)[0];
        this.pill = $(`#${pillId}`)[0];
        this.timeText = $(this.pill).find('.time-text')[0];
        this.timeDisplay = $(`#${timeDisplayId}`)[0];
        this.resetBtn = $(`#${resetBtnId}`)[0];
        this.countdownElement = $('#solarEventCountdown')[0];
        this.eventNameElement = $('.event-name', this.countdownElement)[0];
        this.eventTimeElement = $('.event-time', this.countdownElement)[0];

        this.sunrise = null;
        this.sunset = null;
        this.times = null; // Store SunCalc times for accurate color transitions
        this.lat = null;
        this.lon = null;
        this.currentTime = new Date();
        this.displayTime = new Date();
        this.isUserInteracting = false;
        this.userInteractionTimeout = null;

        // Smooth animation state
        this.isAnimating = false;
        this.animationStartTime = null;
        this.animationStartMinutes = 0;
        this.animationTargetMinutes = 0;
        this.animationDuration = 500; // ms, matches CSS transition

        this.setupCanvas();
        this.starfield = null;
        this.lastStarFrameTime = performance.now();
        this.setupStarfield();
        this.initStars();
        this.setupSlider();
        this.setupResetButton();
        this.startAutoUpdate();

        // Animation loop
        this.animate();
    }

    setupCanvas() {
        const resize = () => {
            // Get the full sun-viz panel dimensions
            const panel = this.backgroundDiv.parentElement;
            const rect = panel.getBoundingClientRect();

            // Canvas fills the entire panel
            this.canvas.width = rect.width * window.devicePixelRatio;
            this.canvas.height = rect.height * window.devicePixelRatio;

            // Reset scale and reapply
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

            this.width = rect.width;
            this.height = rect.height;

            // Resize starfield canvas
            if (this.starfield) {
                this.starfield.resize(rect.width, rect.height);
            }
        };
        resize();

        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                resize();
                this.render();
            }, 100);
        });
    }

    setupStarfield() {
        if (this.starfield) {
            this.starfield.destroy();
        }
        this.starfield = new CanvasStarfield(this.canvas);
        const panel = this.backgroundDiv.parentElement;
        const rect = panel.getBoundingClientRect();
        this.starfield.resize(rect.width, rect.height);
    }

    setupSlider() {
        const updateFromSlider = () => {
            const minutes = parseInt(this.slider.value);
            this.displayTime = new Date();
            this.displayTime.setHours(Math.floor(minutes / 60));
            this.displayTime.setMinutes(minutes % 60);
            this.displayTime.setSeconds(0);

            const timeStr = fmt(this.displayTime).t + ' ' + fmt(this.displayTime).am;

            // Update pill position and text
            const percent = minutes / 1439;
            this.pill.style.left = `${percent * 100}%`;
            this.timeText.textContent = timeStr;

            // Update time display
            this.timeDisplay.textContent = timeStr;

            // Update reset button visibility
            this.updateResetButtonVisibility();

            // Update pill visibility based on current time
            this.updatePillVisibility();

            // Update solar event countdown
            this.updateSolarEventCountdown();

            this.render();
        };

        // Set initial slider value to current time
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        this.slider.value = currentMinutes;
        updateFromSlider();

        // Track user interaction
        this.slider.addEventListener('mousedown', () => {
            this.isUserInteracting = true;
            this.isAnimating = false;
            this.slider.classList.remove('smooth-transition');
            this.pill.classList.add('no-transition'); // Disable pill transition while dragging
            clearTimeout(this.userInteractionTimeout);
        });

        this.slider.addEventListener('touchstart', () => {
            this.isUserInteracting = true;
            this.isAnimating = false;
            this.slider.classList.remove('smooth-transition');
            this.pill.classList.add('no-transition'); // Disable pill transition while dragging
            clearTimeout(this.userInteractionTimeout);
        });

        const endInteraction = () => {
            // Re-enable pill transition
            this.pill.classList.remove('no-transition');

            // Wait 3 seconds after user stops interacting before allowing auto-updates
            clearTimeout(this.userInteractionTimeout);
            this.userInteractionTimeout = setTimeout(() => {
                this.isUserInteracting = false;
            }, 3000);
        };

        this.slider.addEventListener('mouseup', endInteraction);
        this.slider.addEventListener('touchend', endInteraction);
        this.slider.addEventListener('input', updateFromSlider);
    }

    setupResetButton() {
        this.resetBtn.addEventListener('click', () => {
            this.resetToCurrentTime();
        });
    }

    resetToCurrentTime() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Set up smooth animation
        this.animationStartMinutes = parseInt(this.slider.value);
        this.animationTargetMinutes = currentMinutes;
        this.animationStartTime = Date.now();
        this.isAnimating = true;

        // Enable smooth transitions
        this.slider.classList.add('smooth-transition');

        // Set final value (CSS will animate the thumb)
        this.slider.value = currentMinutes;

        console.log('[SunViz] Reset to current time - animating from', this.animationStartMinutes, 'to', this.animationTargetMinutes);
    }

    updateResetButtonVisibility() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const sliderMinutes = parseInt(this.slider.value);

        // Show button if time differs from current by more than 1 minute
        if (Math.abs(sliderMinutes - currentMinutes) > 1) {
            this.resetBtn.classList.add('visible');
        } else {
            this.resetBtn.classList.remove('visible');
        }
    }

    updatePillVisibility() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const sliderMinutes = parseInt(this.slider.value);

        // Hide pill if at current time (within 1 minute)
        if (Math.abs(sliderMinutes - currentMinutes) <= 1) {
            this.pill.classList.add('hidden');
        } else {
            this.pill.classList.remove('hidden');
        }
    }

    startAutoUpdate() {
        // Update every minute
        setInterval(() => {
            if (!this.isUserInteracting) {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const sliderMinutes = parseInt(this.slider.value);

                // Only auto-update if slider is at current time (within 1 minute)
                if (Math.abs(sliderMinutes - currentMinutes) <= 1) {
                    this.resetToCurrentTime();
                    console.log('[SunViz] Auto-updated to current time');
                }
            }
        }, 60000); // Every 60 seconds
    }

    setSunTimes(sunrise, sunset, times, lat, lon) {
        this.sunrise = sunrise;
        this.sunset = sunset;
        this.times = times;
        this.lat = lat;
        this.lon = lon;
        console.log('[SunViz] Sun times set:', sunrise, sunset, times);
        latestSunTimes = { sunrise, sunset, times, lat, lon };
        refreshBackgroundScene();
        this.updateSolarEventCountdown();
        this.render();
    }

    initStars() {
        if (this.starfield) {
            this.starfield.generateStars();
        }
    }

    getSunPosition(time) {
        if (!this.sunrise || !this.sunset) return null;

        const sunriseTime = this.sunrise.getTime();
        const sunsetTime = this.sunset.getTime();
        const currentTime = time.getTime();

        // Calculate progress through the day (0 = sunrise, 1 = sunset)
        let progress;
        if (currentTime < sunriseTime) {
            // Before sunrise - sun is below horizon on the left
            const dayStart = new Date(time);
            dayStart.setHours(0, 0, 0, 0);
            progress = (currentTime - dayStart.getTime()) / (sunriseTime - dayStart.getTime()) * -0.1;
        } else if (currentTime > sunsetTime) {
            // After sunset - sun is below horizon on the right
            const dayEnd = new Date(time);
            dayEnd.setHours(23, 59, 59, 999);
            progress = 1 + (currentTime - sunsetTime) / (dayEnd.getTime() - sunsetTime) * 0.1;
        } else {
            // During the day
            progress = (currentTime - sunriseTime) / (sunsetTime - sunriseTime);
        }

        return progress;
    }

    getSunAltitude(time, lat, lon) {
        if (!lat || !lon || typeof SunCalc === 'undefined') return null;

        try {
            const position = SunCalc.getPosition(time, lat, lon);
            // Convert radians to degrees
            const altitudeDeg = position.altitude * (180 / Math.PI);
            return altitudeDeg;
        } catch (e) {
            console.warn('[SunViz] Failed to get sun position:', e);
            return null;
        }
    }

    getBackgroundColors(time) {
        if (!this.sunrise || !this.sunset || !this.times) {
            return {
                top: '#0a1929',
                middle: '#0f2744',
                bottom: '#000000'
            };
        }

        const currentTime = time.getTime();

        // Get astronomical times from SunCalc
        const nightEnd = this.times.nightEnd?.getTime() || this.times.nauticalDawn?.getTime();
        const nauticalDawn = this.times.nauticalDawn?.getTime();
        const dawn = this.times.dawn?.getTime();
        const sunriseTime = this.sunrise.getTime();
        const goldenHourEnd = this.times.goldenHourEnd?.getTime();
        const goldenHour = this.times.goldenHour?.getTime();
        const sunsetTime = this.sunset.getTime();
        const dusk = this.times.dusk?.getTime();
        const nauticalDusk = this.times.nauticalDusk?.getTime();
        const night = this.times.night?.getTime();

        // Define color stops for different times of day
        const colors = {
            night: { top: '#020510', middle: '#0a1929', bottom: 'rgba(0, 0, 0, 0.8)' },
            nauticalTwilight: { top: '#1a2840', middle: '#2d4663', bottom: '#0a1424' },
            civilTwilight: { top: '#4a6fa5', middle: '#ff9a56', bottom: '#ffd89b' },
            goldenHour: { top: '#ff6b35', middle: '#f7931e', bottom: '#ffd89b' },
            day: { top: '#1e4d8b', middle: '#4a90c8', bottom: '#87ceeb' }
        };

        // Use actual astronomical times for transitions
        if (nightEnd && currentTime < nightEnd) {
            // Deep night (before nautical twilight)
            return colors.night;
        } else if (nauticalDawn && dawn && currentTime < dawn) {
            // Nautical dawn to civil dawn transition
            const t = (currentTime - nauticalDawn) / (dawn - nauticalDawn);
            return this.interpolateColors(colors.night, colors.nauticalTwilight, t);
        } else if (dawn && sunriseTime && currentTime < sunriseTime) {
            // Civil dawn to sunrise transition
            const t = (currentTime - dawn) / (sunriseTime - dawn);
            return this.interpolateColors(colors.nauticalTwilight, colors.civilTwilight, t);
        } else if (sunriseTime && goldenHourEnd && currentTime < goldenHourEnd) {
            // Sunrise to end of morning golden hour
            const t = (currentTime - sunriseTime) / (goldenHourEnd - sunriseTime);
            return this.interpolateColors(colors.civilTwilight, colors.day, t);
        } else if (goldenHourEnd && goldenHour && currentTime < goldenHour) {
            // Full daylight
            return colors.day;
        } else if (goldenHour && sunsetTime && currentTime < sunsetTime) {
            // Evening golden hour begins
            const t = (currentTime - goldenHour) / (sunsetTime - goldenHour);
            return this.interpolateColors(colors.day, colors.goldenHour, t);
        } else if (sunsetTime && dusk && currentTime < dusk) {
            // Sunset to civil dusk
            const t = (currentTime - sunsetTime) / (dusk - sunsetTime);
            return this.interpolateColors(colors.goldenHour, colors.civilTwilight, t);
        } else if (dusk && nauticalDusk && currentTime < nauticalDusk) {
            // Civil dusk to nautical dusk
            const t = (currentTime - dusk) / (nauticalDusk - dusk);
            return this.interpolateColors(colors.civilTwilight, colors.nauticalTwilight, t);
        } else if (nauticalDusk && night && currentTime < nauticalDusk) {
            // Nautical dusk to astronomical night
            const t = (currentTime - nauticalDusk) / (night - nauticalDusk);
            return this.interpolateColors(colors.nauticalTwilight, colors.night, t);
        } else {
            // After astronomical dusk
            return colors.night;
        }
    }

    interpolateColors(color1, color2, t) {
        const lerp = (a, b, t) => a + (b - a) * t;
        const hex2rgb = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return [r, g, b];
        };
        const rgb2hex = (r, g, b) => {
            return '#' + [r, g, b].map(x => {
                const hex = Math.round(x).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
        };

        return {
            top: rgb2hex(...hex2rgb(color1.top).map((c, i) => lerp(c, hex2rgb(color2.top)[i], t))),
            middle: rgb2hex(...hex2rgb(color1.middle).map((c, i) => lerp(c, hex2rgb(color2.middle)[i], t))),
            bottom: rgb2hex(...hex2rgb(color1.bottom).map((c, i) => lerp(c, hex2rgb(color2.bottom)[i], t)))
        };
    }

    render() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        // Clear canvas
        ctx.clearRect(0, 0, w, h);

        // Update background div with gradient
        const colors = this.getBackgroundColors(this.displayTime);
        const horizonY = h * 0.75;
        const horizonStop = (horizonY / h) * 100;
        const middleStop = horizonStop * 0.65;

        // Add fade transition at top of near-black area (30px fade)
        const fadeHeight = 30;
        const fadeStop = ((horizonY + fadeHeight) / h) * 100;

        // Create CSS gradient for the background div
        // Black horizon area is 80% opaque (20% transparent) to allow sun to show beneath
        const bgGradient = `linear-gradient(180deg,
            ${colors.top} 0%,
            ${colors.middle} ${middleStop}%,
            ${colors.bottom} ${horizonStop}%,
            rgba(4, 7, 13, 0.8) ${fadeStop}%,
            rgba(4, 7, 13, 0.8) 100%)`;
        this.backgroundDiv.style.background = bgGradient;

        // Update starfield canvas
        const sunProgress = this.getSunPosition(this.displayTime);

        let nightOpacity = 0;
        if (sunProgress === null) {
            nightOpacity = 1;
        } else if (sunProgress < -0.05) {
            nightOpacity = 1;
        } else if (sunProgress < 0) {
            nightOpacity = Math.abs(sunProgress) / 0.05;
        } else if (sunProgress > 1.05) {
            nightOpacity = 1;
        } else if (sunProgress > 1) {
            nightOpacity = (sunProgress - 1) / 0.05;
        } else {
            nightOpacity = 0;
        }

        nightOpacity = Math.max(0, Math.min(1, nightOpacity));
        if (this.starfield) {
            const nowTime = performance.now();
            const delta = this.lastStarFrameTime != null ? (nowTime - this.lastStarFrameTime) / 1000 : 0;
            this.lastStarFrameTime = nowTime;
            this.starfield.update(delta, nightOpacity);
        }

        // Calculate UI element heights to avoid overlap
        // Slider and pill are at the bottom, leave ~60px gap
        const bottomUIHeight = 60;
        const sunPathBottom = h - bottomUIHeight;

        // Draw horizon line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, horizonY);
        ctx.lineTo(w, horizonY);
        ctx.stroke();

        if (sunProgress !== null) {
            // Draw vertical reference line showing sun's path
            const maxArcHeight = h * 0.45; // Max height for visibility

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 10]);

            // Draw single vertical line at center where sun travels
            // Stop before bottom UI elements
            const sunPathX = w / 2;
            ctx.beginPath();
            ctx.moveTo(sunPathX, 0);
            ctx.lineTo(sunPathX, sunPathBottom);
            ctx.stroke();

            ctx.setLineDash([]);

            // Calculate sun position using actual astronomical altitude
            let sunX, sunY;
            const realAltitude = this.getSunAltitude(this.displayTime, this.lat, this.lon);

            // Sun stays at a fixed X position (center of canvas)
            sunX = w / 2;

            if (realAltitude !== null && this.lat && this.lon) {
                // Calculate Y position directly from altitude (straight vertical movement)
                // Map altitude range (-20° to 90°) to display height
                const minAltitude = -20; // Below horizon
                const maxAltitude = 90;  // Directly overhead
                const altitudeRange = maxAltitude - minAltitude;

                // Normalize altitude to 0-1 range
                const normalizedAltitude = (realAltitude - minAltitude) / altitudeRange;

                // Map to Y position (inverted because Y increases downward)
                // When altitude is -20°, sun is at bottom (but not below UI elements)
                // When altitude is 90°, sun is at maximum height
                const maxDisplayHeight = sunPathBottom - 20; // Leave margin from top
                const minDisplayY = 20; // Top margin
                sunY = sunPathBottom - (normalizedAltitude * (maxDisplayHeight - minDisplayY));
            } else {
                // Fallback if position unavailable
                sunY = horizonY;
            }

            // Calculate dynamic glow based on proximity to horizon
            const isBelowHorizon = sunY > horizonY;
            const distanceFromHorizon = Math.abs(sunY - horizonY);
            const maxDistance = sunPathBottom - horizonY;

            // Normalize distance (0 = at horizon, 1 = far from horizon)
            const normalizedDistance = Math.min(1, distanceFromHorizon / maxDistance);

            let glowIntensity, glowSize, glowColors, coreColors;

            if (isBelowHorizon) {
                // Below horizon: moon-like placeholder (75% transparent, whiter)
                glowIntensity = 0.25; // 75% transparent
                glowSize = 50;
                glowColors = [
                    `rgba(245, 245, 255, ${glowIntensity * 0.6})`,
                    `rgba(235, 235, 250, ${glowIntensity * 0.3})`,
                    `rgba(225, 225, 245, ${glowIntensity * 0.15})`,
                    'rgba(215, 215, 240, 0)'
                ];
                coreColors = ['#f8f8ff', '#e8e8fa', '#d8d8f0'];
            } else {
                // Above horizon: dynamic based on distance
                // Closer to horizon = more diffused/transparent
                // At peak (noon) = fully visible
                glowIntensity = 0.3 + (normalizedDistance * 0.7); // Range: 0.3-1.0
                glowSize = 60 + (normalizedDistance * 20); // Larger at peak

                // Blend into horizon when close
                const horizonBlend = isBelowHorizon ? 0 : Math.max(0, 1 - (distanceFromHorizon / 50));
                const baseAlpha = glowIntensity * (1 - horizonBlend * 0.6);

                glowColors = [
                    `rgba(255, 220, 120, ${baseAlpha * 0.8})`,
                    `rgba(255, 180, 80, ${baseAlpha * 0.4})`,
                    `rgba(255, 140, 40, ${baseAlpha * 0.2})`,
                    'rgba(255, 100, 20, 0)'
                ];
                coreColors = ['#fffef0', '#ffd700', '#ffaa00'];
            }

            // Draw sun glow
            const glowGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowSize);
            glowGradient.addColorStop(0, glowColors[0]);
            glowGradient.addColorStop(0.3, glowColors[1]);
            glowGradient.addColorStop(0.6, glowColors[2]);
            glowGradient.addColorStop(1, glowColors[3]);

            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(sunX, sunY, glowSize, 0, Math.PI * 2);
            ctx.fill();

            // Draw sun core
            const coreSize = isBelowHorizon ? 15 : 20;
            const sunGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, coreSize);
            sunGradient.addColorStop(0, coreColors[0]);
            sunGradient.addColorStop(0.7, coreColors[1]);
            sunGradient.addColorStop(1, coreColors[2]);

            ctx.globalAlpha = isBelowHorizon ? 0.25 : 1.0;
            ctx.fillStyle = sunGradient;
            ctx.beginPath();
            ctx.arc(sunX, sunY, coreSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        // Draw semi-transparent black overlay AFTER sun to obscure it below horizon
        // This creates the proper z-ordering effect
        // Stop before UI elements at the bottom
        const overlayFadeHeight = 30;
        const overlayFadeStart = horizonY;
        const overlayFadeEnd = overlayFadeStart + overlayFadeHeight;

        const overlayGradient = ctx.createLinearGradient(0, overlayFadeStart, 0, sunPathBottom);
        overlayGradient.addColorStop(0, 'rgba(4, 7, 13, 0)');
        overlayGradient.addColorStop((overlayFadeEnd - overlayFadeStart) / (sunPathBottom - overlayFadeStart), 'rgba(4, 7, 13, 0.8)');
        overlayGradient.addColorStop(1, 'rgba(4, 7, 13, 0.8)');

        ctx.fillStyle = overlayGradient;
        ctx.fillRect(0, overlayFadeStart, w, sunPathBottom - overlayFadeStart);
    }

    getNextSolarEvent(currentTime) {
        if (!this.times) return null;

        // Define all solar events in chronological order with friendly names
        const events = [
            { time: this.times.nightEnd, name: 'Astronomical Dawn', key: 'nightEnd' },
            { time: this.times.nauticalDawn, name: 'Nautical Dawn', key: 'nauticalDawn' },
            { time: this.times.dawn, name: 'Civil Dawn', key: 'dawn' },
            { time: this.times.sunrise, name: 'Sunrise', key: 'sunrise' },
            { time: this.times.goldenHourEnd, name: 'Golden Hour End', key: 'goldenHourEnd' },
            { time: this.times.solarNoon, name: 'Solar Noon', key: 'solarNoon' },
            { time: this.times.goldenHour, name: 'Golden Hour', key: 'goldenHour' },
            { time: this.times.sunset, name: 'Sunset', key: 'sunset' },
            { time: this.times.dusk, name: 'Civil Dusk', key: 'dusk' },
            { time: this.times.nauticalDusk, name: 'Nautical Dusk', key: 'nauticalDusk' },
            { time: this.times.night, name: 'Astronomical Dusk', key: 'night' }
        ];

        // Filter out null/undefined events and events that have passed
        const upcomingEvents = events.filter(event =>
            event.time && event.time.getTime() > currentTime.getTime()
        );

        // Sort by time
        upcomingEvents.sort((a, b) => a.time.getTime() - b.time.getTime());

        // Return the next event
        return upcomingEvents.length > 0 ? upcomingEvents[0] : null;
    }

    formatCountdown(milliseconds) {
        const totalMinutes = Math.floor(milliseconds / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours > 0) {
            if (minutes > 0) {
                return `in ${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
            } else {
                return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
            }
        } else if (minutes > 0) {
            return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        } else {
            const seconds = Math.floor(milliseconds / 1000);
            return `in ${seconds} second${seconds !== 1 ? 's' : ''}`;
        }
    }

    updateSolarEventCountdown() {
        if (!this.countdownElement || !this.times) return;

        const nextEvent = this.getNextSolarEvent(this.displayTime);

        if (nextEvent) {
            const timeUntil = nextEvent.time.getTime() - this.displayTime.getTime();
            this.eventNameElement.textContent = nextEvent.name;
            this.eventTimeElement.textContent = this.formatCountdown(timeUntil);
        } else {
            // No more events today - could show "Day complete" or next day's first event
            this.eventNameElement.textContent = 'All Events Complete';
            this.eventTimeElement.textContent = 'for today';
        }
    }

    animate() {
        // Handle smooth animation during reset
        if (this.isAnimating) {
            const elapsed = Date.now() - this.animationStartTime;
            const progress = Math.min(1, elapsed / this.animationDuration);

            // Cubic bezier easing to match CSS: cubic-bezier(0.4, 0.0, 0.2, 1)
            const easeProgress = this.cubicBezier(progress, 0.4, 0.0, 0.2, 1);

            // Interpolate minutes
            const currentMinutes = Math.round(
                this.animationStartMinutes +
                (this.animationTargetMinutes - this.animationStartMinutes) * easeProgress
            );

            // Update display time for canvas rendering
            this.displayTime = new Date();
            this.displayTime.setHours(Math.floor(currentMinutes / 60));
            this.displayTime.setMinutes(currentMinutes % 60);
            this.displayTime.setSeconds(0);

            // Update UI elements (pill and time display)
            const timeStr = fmt(this.displayTime).t + ' ' + fmt(this.displayTime).am;
            const percent = currentMinutes / 1439;
            this.pill.style.left = `${percent * 100}%`;
            this.timeText.textContent = timeStr;
            this.timeDisplay.textContent = timeStr;

            // Update pill visibility during animation
            this.updatePillVisibility();

            // Stop animation when complete
            if (progress >= 1) {
                this.isAnimating = false;
                this.slider.classList.remove('smooth-transition');
                console.log('[SunViz] Animation complete');
            }
        }

        // Update solar event countdown
        this.updateSolarEventCountdown();

        this.render();
        requestAnimationFrame(() => this.animate());
    }

    // Cubic bezier easing function
    cubicBezier(t, _p1x, p1y, _p2x, p2y) {
        // Simplified cubic bezier for animation easing
        // This approximates the cubic-bezier(0.4, 0.0, 0.2, 1) curve
        // Only Y component is needed for easing
        const cy = 3 * p1y;
        const by = 3 * (p2y - p1y) - cy;
        const ay = 1 - cy - by;

        const tSquared = t * t;
        const tCubed = tSquared * t;

        return ay * tCubed + by * tSquared + cy * t;
    }
}
