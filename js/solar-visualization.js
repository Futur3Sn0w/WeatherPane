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

        // Re-clamp slider position to the new width
        if (typeof this.currentMinutes === 'number') {
            const percent = Math.max(0, Math.min(1, this.currentMinutes / 1439));
            this.setSliderPosition(percent);
        }

        // Recompute tick density to fit the available width
        this.recalculateTickDensity();
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

        // Track mouse position for hover-reveal time markers
        this.mouseX = -1000;
        this.mouseY = -1000;

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            // Re-render on mouse move to show/hide labels
            this.render();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouseX = -1000;
            this.mouseY = -1000;
            // Re-render to hide labels
            this.render();
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
        // Generate tick marks (96 ticks = one per 15 minutes)
        this.tickCount = 96;
        this.currentMinutes = 0;
        this.ticks = [];
        this.recalculateTickDensity();

        const updateFromSlider = (minutes) => {
            this.currentMinutes = minutes;
            this.displayTime = new Date();
            this.displayTime.setHours(Math.floor(minutes / 60));
            this.displayTime.setMinutes(minutes % 60);
            this.displayTime.setSeconds(0);

            const timeStr = fmt(this.displayTime).t + ' ' + fmt(this.displayTime).am;

            // Update pill position and text
            const percent = minutes / 1439;
            this.setSliderPosition(percent);
            this.timeText.textContent = timeStr;

            // Update time display
            this.timeDisplay.textContent = timeStr;

            // Update ARIA attributes
            this.slider.setAttribute('aria-valuenow', minutes);
            this.slider.setAttribute('aria-valuetext', timeStr);

            // Update reset button visibility
            this.updateResetButtonVisibility();

            // Update pill visibility based on current time
            this.updatePillVisibility();

            // Update solar event countdown
            this.updateSolarEventCountdown();

            // Update tick heights and states
            this.updateTickStates();

            this.render();
        };

        // Set initial value to current time
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        updateFromSlider(currentMinutes);
        // Run density calc once layout has settled (helps on initial load)
        requestAnimationFrame(() => this.recalculateTickDensity());

        // Click and drag handling
        let isDragging = false;

        const getMinutesFromEvent = (e) => {
            const rect = this.slider.getBoundingClientRect();
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const percent = Math.max(0, Math.min(1, x / rect.width));
            return Math.round(percent * 1439);
        };

        const startInteraction = (e) => {
            isDragging = true;
            this.isUserInteracting = true;
            this.isAnimating = false;
            this.pill.classList.add('no-transition');
            clearTimeout(this.userInteractionTimeout);

            const minutes = getMinutesFromEvent(e);
            updateFromSlider(minutes);
        };

        const moveInteraction = (e) => {
            if (isDragging) {
                const minutes = getMinutesFromEvent(e);
                updateFromSlider(minutes);
            }
        };

        const endInteraction = () => {
            isDragging = false;
            this.pill.classList.remove('no-transition');

            clearTimeout(this.userInteractionTimeout);
            this.userInteractionTimeout = setTimeout(() => {
                this.isUserInteracting = false;
            }, 3000);
        };

        this.slider.addEventListener('mousedown', startInteraction);
        this.slider.addEventListener('touchstart', startInteraction);

        document.addEventListener('mousemove', moveInteraction);
        document.addEventListener('touchmove', moveInteraction);

        document.addEventListener('mouseup', endInteraction);
        document.addEventListener('touchend', endInteraction);

        // Cursor proximity effect
        this.slider.addEventListener('mousemove', (e) => {
            const rect = this.slider.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            const tickIndex = Math.round(percent * (this.tickCount - 1));

            // Highlight ticks near cursor (±5 ticks)
            this.ticks.forEach((tick, i) => {
                const distance = Math.abs(i - tickIndex);
                if (distance <= 5) {
                    tick.classList.add('near-cursor');
                } else {
                    tick.classList.remove('near-cursor');
                }
            });
        });

        this.slider.addEventListener('mouseleave', () => {
            // Remove all cursor proximity highlights
            this.ticks.forEach(tick => tick.classList.remove('near-cursor'));
        });

        // Keyboard shortcuts for easier navigation
        this.slider.addEventListener('keydown', (e) => {
            const current = this.currentMinutes;

            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    updateFromSlider(Math.max(0, current - 15)); // -15 minutes
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    updateFromSlider(Math.min(1439, current + 15)); // +15 minutes
                    break;
                case 'PageUp':
                    e.preventDefault();
                    updateFromSlider(Math.min(1439, current + 60)); // +1 hour
                    break;
                case 'PageDown':
                    e.preventDefault();
                    updateFromSlider(Math.max(0, current - 60)); // -1 hour
                    break;
                case 'Home':
                    e.preventDefault();
                    if (this.sunrise) {
                        updateFromSlider(this.sunrise.getHours() * 60 + this.sunrise.getMinutes());
                    }
                    break;
                case 'End':
                    e.preventDefault();
                    if (this.sunset) {
                        updateFromSlider(this.sunset.getHours() * 60 + this.sunset.getMinutes());
                    }
                    break;
            }
        });
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
        this.animationStartMinutes = this.currentMinutes;
        this.animationTargetMinutes = currentMinutes;
        this.animationStartTime = Date.now();
        this.isAnimating = true;

        // Update to current time (the animation will be handled by updateTickStates)
        this.currentMinutes = currentMinutes;
        this.displayTime = new Date();
        this.displayTime.setHours(Math.floor(currentMinutes / 60));
        this.displayTime.setMinutes(currentMinutes % 60);
        this.displayTime.setSeconds(0);

        const timeStr = fmt(this.displayTime).t + ' ' + fmt(this.displayTime).am;

        // Update pill position and text
        const percent = currentMinutes / 1439;
        this.setSliderPosition(percent);
        this.timeText.textContent = timeStr;

        // Update time display
        this.timeDisplay.textContent = timeStr;

        // Update ARIA attributes
        this.slider.setAttribute('aria-valuenow', currentMinutes);
        this.slider.setAttribute('aria-valuetext', timeStr);

        // Update reset button visibility
        this.updateResetButtonVisibility();

        // Update pill visibility
        this.updatePillVisibility();

        // Update solar event countdown
        this.updateSolarEventCountdown();

        // Update tick states
        this.updateTickStates();

        this.render();

        console.log('[SunViz] Reset to current time:', currentMinutes);
    }

    setSliderPosition(percent) {
        if (!this.slider || !this.pill) return;
        const rect = this.slider.getBoundingClientRect();
        const pillHalf = this.pill.offsetWidth / 2;
        const rawPx = percent * rect.width;
        const clampedPx = Math.max(pillHalf, Math.min(rect.width - pillHalf, rawPx));
        const safePercent = rect.width > 0 ? (clampedPx / rect.width) * 100 : percent * 100;
        this.pill.style.left = `${safePercent}%`;
    }

    rebuildTickElements(count) {
        this.slider.innerHTML = '';
        this.ticks = [];
        for (let i = 0; i < count; i++) {
            const tick = document.createElement('div');
            tick.className = 'tick';
            tick.dataset.index = i;
            this.slider.appendChild(tick);
            this.ticks.push(tick);
        }
    }

    recalculateTickDensity() {
        if (!this.slider) return;
        const sliderRect = this.slider.getBoundingClientRect();
        const container = this.slider.parentElement;
        const containerRect = container ? container.getBoundingClientRect() : sliderRect;
        const styles = container ? window.getComputedStyle(container) : null;
        const paddingLeft = styles ? parseFloat(styles.paddingLeft || '0') : 0;
        const paddingRight = styles ? parseFloat(styles.paddingRight || '0') : 0;
        const availableWidth = Math.max(0, containerRect.width - paddingLeft - paddingRight);
        if (!availableWidth) return;

        const desiredSpacing = 10; // px per tick target (slightly denser)
        const minTicks = 64;       // denser floor to avoid visible gaps
        const maxTicks = 112;      // allow a few extra when space permits

        let count = Math.ceil(availableWidth / desiredSpacing) + 1;
        count = Math.max(minTicks, Math.min(maxTicks, count));
        count = Math.round(count / 4) * 4; // keep in 4s for even spacing

        if (count !== this.tickCount || this.ticks.length !== count) {
            this.tickCount = count;
            this.rebuildTickElements(count);
        }

        this.updateTickStates();
        // Re-clamp pill after width changes
        const percent = Math.max(0, Math.min(1, this.currentMinutes / 1439));
        this.setSliderPosition(percent);
    }

    updateResetButtonVisibility() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Show button if time differs from current by more than 1 minute
        if (Math.abs(this.currentMinutes - currentMinutes) > 1) {
            this.resetBtn.classList.add('visible');
        } else {
            this.resetBtn.classList.remove('visible');
        }
    }

    updatePillVisibility() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Hide pill if at current time (within 1 minute)
        if (Math.abs(this.currentMinutes - currentMinutes) <= 1) {
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

                // Only auto-update if slider is at current time (within 1 minute)
                if (Math.abs(this.currentMinutes - currentMinutes) <= 1) {
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

        // Pre-calculate the full day arc path
        this.arcPath = this.calculateFullDayArc();

        // Update event markers positions
        this.updateEventMarkers();

        // Update tick states with new solar times
        if (this.ticks && this.ticks.length > 0) {
            this.updateTickStates();
        }

        latestSunTimes = { sunrise, sunset, times, lat, lon };
        if (typeof scheduleBackgroundRefresh === 'function') {
            scheduleBackgroundRefresh();
        } else if (typeof refreshBackgroundScene === 'function') {
            refreshBackgroundScene();
        }
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

    mapAzimuthToX(azimuth, width) {
        // Convert azimuth (radians: 0=N, π/2=E, π=S, 3π/2=W) to canvas X coordinate
        // Map with padding on edges for a more bell-shaped curve
        const azimuthDeg = azimuth * (180 / Math.PI);
        const normalizedAzimuth = (azimuthDeg + 90) % 360;

        // Add 10% padding on each side to keep arc more centered
        const padding = width * 0.1;
        const usableWidth = width - (padding * 2);
        return padding + (normalizedAzimuth / 180) * usableWidth;
    }

    mapAltitudeToY(altitude, height, sunPathBottom) {
        // Map altitude (radians) to canvas Y coordinate
        // -20° → bottom (below horizon), 90° → top (zenith)
        const altitudeDeg = altitude * (180 / Math.PI);
        const minAltitude = -20;
        const maxAltitude = 90;
        const altitudeRange = maxAltitude - minAltitude;

        // Normalize altitude to 0-1 range
        const normalizedAltitude = (altitudeDeg - minAltitude) / altitudeRange;

        // Map to Y position (inverted because Y increases downward)
        const maxDisplayHeight = sunPathBottom - 20;
        const minDisplayY = 20;
        return sunPathBottom - (normalizedAltitude * (maxDisplayHeight - minDisplayY));
    }

    calculateFullDayArc() {
        if (!this.lat || !this.lon) return [];

        const arcPoints = [];
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);

        // Calculate UI element heights to avoid overlap (same as in render())
        const bottomUIHeight = 60;
        const sunPathBottom = this.height - bottomUIHeight;

        // Sample every 15 minutes for smooth arc (96 points per day)
        for (let minutes = 0; minutes < 1440; minutes += 15) {
            const time = new Date(dayStart);
            time.setMinutes(minutes);

            const position = SunCalc.getPosition(time, this.lat, this.lon);
            arcPoints.push({
                x: this.mapAzimuthToX(position.azimuth, this.width),
                y: this.mapAltitudeToY(position.altitude, this.height, sunPathBottom),
                time: time,
                altitude: position.altitude * (180 / Math.PI),
                azimuth: position.azimuth * (180 / Math.PI),
                minutes: minutes
            });
        }

        console.log('[SunViz] Calculated arc path with', arcPoints.length, 'points');
        return arcPoints;
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

    renderArcPath(ctx, arcPoints, currentMinutes) {
        if (!arcPoints || arcPoints.length === 0) return;

        // Split arc into: past (12am → now), current position, future (now → 11:59pm)
        const pastPoints = arcPoints.filter(p => p.minutes < currentMinutes);
        const futurePoints = arcPoints.filter(p => p.minutes > currentMinutes);

        // Draw past arc (accent color, 30% opacity)
        if (pastPoints.length > 1) {
            // Get CSS accent color
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            ctx.strokeStyle = `color-mix(in srgb, ${accentColor} 30%, transparent)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pastPoints[0].x, pastPoints[0].y);
            pastPoints.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        }

        // Draw future arc (dashed, white, 15% opacity)
        if (futurePoints.length > 1) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 10]);
            ctx.beginPath();
            ctx.moveTo(futurePoints[0].x, futurePoints[0].y);
            futurePoints.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    renderTimeMarkers(ctx, arcPoints, mouseX, mouseY) {
        if (!arcPoints || arcPoints.length === 0) return;

        const markerTimes = [6 * 60, 9 * 60, 12 * 60, 15 * 60, 18 * 60, 21 * 60]; // Minutes
        const hoverRadius = 50; // Pixels - distance to show label

        markerTimes.forEach(minutes => {
            const point = arcPoints.find(p => Math.abs(p.minutes - minutes) < 15);
            if (!point) return;

            // Always draw marker dot
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Show label if mouse is near
            const distance = Math.sqrt(Math.pow(mouseX - point.x, 2) + Math.pow(mouseY - point.y, 2));
            if (distance < hoverRadius) {
                const hours = Math.floor(minutes / 60);
                const label = hours === 0 ? '12 AM' : hours === 12 ? '12 PM' : hours > 12 ? `${hours - 12} PM` : `${hours} AM`;

                ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.font = '600 12px system-ui, -apple-system';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                // Add subtle shadow for readability
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 1;

                ctx.fillText(label, point.x, point.y - 12);

                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }
        });
    }

    renderHorizonGlow(ctx, sunX, sunY, altitude, horizonY, width) {
        // Only render when sun is near horizon
        if (altitude > 10 || altitude < -5) return;

        // Intensity based on proximity to horizon
        const glowIntensity = Math.max(0, 1 - Math.abs(altitude) / 10);

        // Red-orange atmospheric glow centered on sun X position
        const glowGradient = ctx.createRadialGradient(sunX, horizonY, 0, sunX, horizonY, 200);
        glowGradient.addColorStop(0, `rgba(255, 100, 40, ${glowIntensity * 0.35})`);
        glowGradient.addColorStop(0.4, `rgba(255, 140, 60, ${glowIntensity * 0.2})`);
        glowGradient.addColorStop(0.7, `rgba(255, 180, 80, ${glowIntensity * 0.1})`);
        glowGradient.addColorStop(1, 'rgba(255, 200, 100, 0)');

        ctx.fillStyle = glowGradient;
        ctx.fillRect(0, horizonY - 200, width, 200);
    }

    renderMoon(ctx, time, lat, lon, width, height, sunPathBottom) {
        if (!lat || !lon || typeof SunCalc === 'undefined') return;

        try {
            const moonPos = SunCalc.getMoonPosition(time, lat, lon);
            const altitudeDeg = moonPos.altitude * (180 / Math.PI);

            // Only render moon if it's above horizon
            if (altitudeDeg < -5) return;

            const moonX = this.mapAzimuthToX(moonPos.azimuth, width);
            const moonY = this.mapAltitudeToY(moonPos.altitude, height, sunPathBottom);

            // Get moon illumination for phase visualization
            const moonIllum = SunCalc.getMoonIllumination(time);
            const fraction = moonIllum.fraction;

            // Draw moon glow (subtle, bluish-white)
            const glowSize = 25;
            const glowGradient = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, glowSize);
            glowGradient.addColorStop(0, `rgba(220, 230, 255, ${fraction * 0.4})`);
            glowGradient.addColorStop(0.5, `rgba(200, 215, 245, ${fraction * 0.2})`);
            glowGradient.addColorStop(1, 'rgba(180, 200, 235, 0)');

            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(moonX, moonY, glowSize, 0, Math.PI * 2);
            ctx.fill();

            // Draw moon core
            const moonSize = 12;
            const moonGradient = ctx.createRadialGradient(moonX - 3, moonY - 3, 0, moonX, moonY, moonSize);
            moonGradient.addColorStop(0, '#ffffff');
            moonGradient.addColorStop(0.6, '#e8e8f0');
            moonGradient.addColorStop(1, '#d0d0e0');

            ctx.fillStyle = moonGradient;
            ctx.beginPath();
            ctx.arc(moonX, moonY, moonSize, 0, Math.PI * 2);
            ctx.fill();

            // Add phase shadow if not full moon
            if (fraction < 0.95) {
                const shadowPhase = moonIllum.phase;
                const shadowX = moonX + (shadowPhase < 0.5 ? -moonSize * (1 - fraction * 2) : moonSize * (1 - (1 - fraction) * 2));

                ctx.fillStyle = 'rgba(10, 15, 30, 0.7)';
                ctx.beginPath();
                ctx.arc(shadowX, moonY, moonSize, 0, Math.PI * 2);
                ctx.fill();
            }
        } catch (e) {
            // Silently fail if moon calculation errors
            console.warn('[SunViz] Failed to render moon:', e);
        }
    }


    updateEventMarkers() {
        if (!this.times) return;

        const toPercent = (time) => {
            const hours = time.getHours();
            const minutes = time.getMinutes();
            return ((hours * 60 + minutes) / 1439) * 100;
        };

        const markerSunrise = document.getElementById('markerSunrise');
        const markerNoon = document.getElementById('markerNoon');
        const markerSunset = document.getElementById('markerSunset');

        if (markerSunrise) markerSunrise.style.left = `${toPercent(this.sunrise)}%`;
        if (markerNoon) markerNoon.style.left = `${toPercent(this.times.solarNoon)}%`;
        if (markerSunset) markerSunset.style.left = `${toPercent(this.sunset)}%`;

        console.log('[SunViz] Updated event markers');
    }

    updateTickStates() {
        if (!this.ticks || this.ticks.length === 0) return;

        // Calculate which tick represents the current position
        const currentPercent = this.currentMinutes / 1439;
        const currentTickIndex = Math.round(currentPercent * (this.tickCount - 1));

        // Get solar event positions in tick indices
        const solarEvents = {};
        if (this.sunrise && this.times) {
            solarEvents.sunrise = Math.round((this.sunrise.getHours() * 60 + this.sunrise.getMinutes()) / 1439 * (this.tickCount - 1));
            solarEvents.noon = Math.round((this.times.solarNoon.getHours() * 60 + this.times.solarNoon.getMinutes()) / 1439 * (this.tickCount - 1));
            solarEvents.sunset = Math.round((this.sunset.getHours() * 60 + this.sunset.getMinutes()) / 1439 * (this.tickCount - 1));
        }

        // Update each tick
        this.ticks.forEach((tick, i) => {
            // Calculate distance from current position for bell curve
            const distance = Math.abs(i - currentTickIndex);

            // Bell curve calculation: Gaussian-like distribution
            // Peak height at current position (28px), tapers to base height (8px)
            const maxHeight = 28;
            const baseHeight = 8;
            const curveWidth = 8; // How many ticks wide the curve should be (reduced for tighter curve)

            // Gaussian-like falloff
            const heightMultiplier = Math.exp(-(distance * distance) / (2 * curveWidth * curveWidth));
            const height = baseHeight + (maxHeight - baseHeight) * heightMultiplier;

            tick.style.height = `${height}px`;

            // Reset classes
            tick.classList.remove('active', 'sunrise-event', 'noon-event', 'sunset-event', 'event-pulse');

            // Mark ticks that form the bell curve (within curve width)
            if (distance <= curveWidth) {
                tick.classList.add('active');
            }

            // Add solar event styling to ticks near events (±2 ticks)
            if (solarEvents.sunrise && Math.abs(i - solarEvents.sunrise) <= 2) {
                tick.classList.add('sunrise-event');
                if (Math.abs(i - solarEvents.sunrise) <= 1) {
                    tick.classList.add('event-pulse');
                }
            }
            if (solarEvents.noon && Math.abs(i - solarEvents.noon) <= 2) {
                tick.classList.add('noon-event');
                if (Math.abs(i - solarEvents.noon) <= 1) {
                    tick.classList.add('event-pulse');
                }
            }
            if (solarEvents.sunset && Math.abs(i - solarEvents.sunset) <= 2) {
                tick.classList.add('sunset-event');
                if (Math.abs(i - solarEvents.sunset) <= 1) {
                    tick.classList.add('event-pulse');
                }
            }
        });
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

        // Draw arc path before horizon line and sun
        const currentMinutes = this.displayTime.getHours() * 60 + this.displayTime.getMinutes();
        this.renderArcPath(ctx, this.arcPath, currentMinutes);

        // Draw time markers (hover-reveal)
        this.renderTimeMarkers(ctx, this.arcPath, this.mouseX, this.mouseY);

        // Draw horizon line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, horizonY);
        ctx.lineTo(w, horizonY);
        ctx.stroke();

        if (sunProgress !== null) {
            // Calculate sun position using actual astronomical azimuth and altitude
            let sunX, sunY, altitudeDeg;

            if (this.lat && this.lon) {
                const position = SunCalc.getPosition(this.displayTime, this.lat, this.lon);

                // Use azimuth for horizontal position (arc-based movement)
                sunX = this.mapAzimuthToX(position.azimuth, w);

                // Use altitude for vertical position
                sunY = this.mapAltitudeToY(position.altitude, h, sunPathBottom);

                // Store altitude in degrees for horizon glow
                altitudeDeg = position.altitude * (180 / Math.PI);
            } else {
                // Fallback if position unavailable
                sunX = w / 2;
                sunY = horizonY;
                altitudeDeg = 0;
            }

            // Render horizon glow when sun is near horizon
            this.renderHorizonGlow(ctx, sunX, sunY, altitudeDeg, horizonY, w);

            // Render moon if visible
            this.renderMoon(ctx, this.displayTime, this.lat, this.lon, w, h, sunPathBottom);

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
