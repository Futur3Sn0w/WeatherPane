/**
 * Storm Scene - Hybrid rain + clouds effect
 * Combines RainScene particle animation with CloudyScene volumetric clouds
 * for realistic storm conditions
 */

class StormScene {
    constructor(container, options = {}) {
        this.container = container;
        this.options = { intensity: 0.8, cloudCover: 80, ...options };
        this.running = true;

        // Create container for layered effects
        this.rainContainer = document.createElement('div');
        this.rainContainer.style.position = 'absolute';
        this.rainContainer.style.top = '0';
        this.rainContainer.style.left = '0';
        this.rainContainer.style.width = '100%';
        this.rainContainer.style.height = '100%';
        this.rainContainer.style.pointerEvents = 'none';
        this.rainContainer.style.zIndex = '2'; // Rain on top

        this.cloudContainer = document.createElement('div');
        this.cloudContainer.style.position = 'absolute';
        this.cloudContainer.style.top = '0';
        this.cloudContainer.style.left = '0';
        this.cloudContainer.style.width = '100%';
        this.cloudContainer.style.height = '100%';
        this.cloudContainer.style.pointerEvents = 'none';
        this.cloudContainer.style.zIndex = '1'; // Clouds behind rain

        this.container.appendChild(this.cloudContainer);
        this.container.appendChild(this.rainContainer);

        // Create cloud layer (volumetric clouds)
        this.cloudLayer = new ThreeJSVolumetricClouds(this.cloudContainer, {
            intensity: this.options.intensity * 0.9, // Slightly darker for storm
            cloudCover: this.options.cloudCover
        });

        // Create rain layer (particle rain)
        this.rainLayer = new RainScene(this.rainContainer, {
            intensity: this.options.intensity,
            variant: this.options.variant || 'rain'
        });

        // Bind resize handler
        this.handleResize = this.resize.bind(this);
        window.addEventListener('resize', this.handleResize);
    }

    start() {
        this.running = true;
        if (this.cloudLayer) {
            this.cloudLayer.start();
        }
        if (this.rainLayer) {
            this.rainLayer.start();
        }
    }

    pause() {
        this.running = false;
        if (this.cloudLayer) {
            this.cloudLayer.pause();
        }
        if (this.rainLayer) {
            this.rainLayer.pause();
        }
    }

    resume() {
        this.running = true;
        if (this.cloudLayer) {
            this.cloudLayer.resume();
        }
        if (this.rainLayer) {
            this.rainLayer.resume();
        }
    }

    resize() {
        if (this.cloudLayer) {
            this.cloudLayer.resize();
        }
        if (this.rainLayer) {
            this.rainLayer.resize();
        }
    }

    updateOptions(options) {
        this.options = { ...this.options, ...options };

        if (this.cloudLayer) {
            this.cloudLayer.updateOptions({
                intensity: (options.intensity ?? this.options.intensity) * 0.9,
                cloudCover: options.cloudCover ?? this.options.cloudCover
            });
        }

        if (this.rainLayer) {
            this.rainLayer.setContext({
                intensity: options.intensity ?? this.options.intensity,
                variant: options.variant ?? this.options.variant
            });
        }
    }

    setContext(context = {}) {
        this.updateOptions(context);

        // Update theme for clouds
        if (this.cloudLayer && this.cloudLayer.updateTheme) {
            this.cloudLayer.updateTheme();
        }
    }

    destroy() {
        window.removeEventListener('resize', this.handleResize);

        if (this.cloudLayer) {
            this.cloudLayer.destroy();
            this.cloudLayer = null;
        }

        if (this.rainLayer) {
            this.rainLayer.destroy();
            this.rainLayer = null;
        }

        if (this.cloudContainer && this.cloudContainer.parentNode === this.container) {
            this.container.removeChild(this.cloudContainer);
        }

        if (this.rainContainer && this.rainContainer.parentNode === this.container) {
            this.container.removeChild(this.rainContainer);
        }
    }
}
