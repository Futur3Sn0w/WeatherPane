// Banner Carousel - Rotates through card previews in the "Today at a glance" banner

class BannerCarousel {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.warn(`[Banner Carousel] Container "${containerId}" not found`);
            return;
        }

        // Configuration
        this.rotationInterval = options.rotationInterval || 5000; // 5 seconds default
        this.cards = [];
        this.currentIndex = 0;
        this.intervalId = null;
        this.progressAnimationId = null;
        this.progressElement = null;
        this.isInitialized = false;

        console.log('[Banner Carousel] Initialized');
    }

    // Clone a full card element for the carousel
    cloneCardForCarousel(cardElement) {
        const clone = cardElement.cloneNode(true);

        // Remove unique ID to avoid conflicts
        clone.removeAttribute('id');

        // Store original card ID as data attribute
        clone.setAttribute('data-original-id', cardElement.id);

        // Add a class to identify this as a carousel card (not a grid card)
        clone.classList.add('carousel-card-content');

        // Remove all interactive elements
        const controls = clone.querySelector('.card-controls');
        if (controls) {
            controls.remove();
        }

        const badges = clone.querySelector('.badges');
        if (badges) {
            badges.remove();
        }

        const deleteBtn = clone.querySelector('.card-delete-badge');
        if (deleteBtn) {
            deleteBtn.remove();
        }

        // Remove card detail popup
        const cardDetail = clone.querySelector('.card-detail');
        if (cardDetail) {
            cardDetail.remove();
        }

        // Remove any Muuri-specific classes or attributes that might have been added
        clone.classList.remove('muuri-item', 'muuri-item-dragging', 'muuri-item-releasing', 'muuri-item-hidden');
        clone.removeAttribute('data-muuri-id');

        return clone;
    }

    // Load cards from the grid
    loadCardsFromGrid() {
        // Query for .card elements that are direct children of muuri items within the grid
        // This ensures we get the actual card elements, not any nested or cloned ones
        const gridCards = document.querySelectorAll('#todayGrid .muuri-item > .card, #todayGrid > .card');

        if (gridCards.length === 0) {
            console.warn('[Banner Carousel] No cards found in grid');
            return;
        }

        // Clone ALL cards (including hidden ones) for comprehensive rotation
        this.cards = Array.from(gridCards)
            .map(card => ({
                id: card.id,
                element: this.cloneCardForCarousel(card)
            }));

        console.log(`[Banner Carousel] Loaded ${this.cards.length} cards for rotation (all cards included)`);
        return this.cards.length > 0;
    }

    // Render a carousel card wrapper
    renderCard(cardData, index) {
        const wrapper = document.createElement('div');
        wrapper.className = `carousel-card ${index === this.currentIndex ? 'active' : ''}`;
        wrapper.setAttribute('data-index', index);
        wrapper.setAttribute('data-card-id', cardData.id);

        // Append the cloned card element
        wrapper.appendChild(cardData.element);

        return wrapper;
    }

    // Render all cards
    render() {
        if (this.cards.length === 0) {
            this.container.innerHTML = '<p style="color: var(--muted); font-size: var(--text-sm);">Loading...</p>';
            return;
        }

        // Clear container
        this.container.innerHTML = '';

        // Append each card wrapper
        this.cards.forEach((card, index) => {
            const wrapper = this.renderCard(card, index);
            this.container.appendChild(wrapper);
        });

        // Render pagination dots
        this.renderDots();
    }

    // Render pagination dots
    renderDots() {
        const dotsContainer = document.getElementById('carouselDots');
        if (!dotsContainer) return;

        dotsContainer.innerHTML = '';

        this.cards.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = `carousel-dot ${index === this.currentIndex ? 'active' : ''}`;
            dot.setAttribute('data-index', index);

            // Add click handler to jump to specific card
            dot.addEventListener('click', () => {
                this.goToCard(index);
            });

            dotsContainer.appendChild(dot);
        });
    }

    // Update dots to reflect current card
    updateDots() {
        const dotsContainer = document.getElementById('carouselDots');
        if (!dotsContainer) return;

        const dots = dotsContainer.querySelectorAll('.carousel-dot');
        dots.forEach((dot, index) => {
            if (index === this.currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    // Jump to a specific card
    goToCard(index) {
        if (index < 0 || index >= this.cards.length) return;

        const currentCard = this.container.querySelector('.carousel-card.active');
        if (currentCard) {
            currentCard.classList.remove('active');
        }

        this.currentIndex = index;

        const nextCard = this.container.querySelector(`.carousel-card[data-index="${this.currentIndex}"]`);
        if (nextCard) {
            nextCard.classList.add('active');
        }

        // Sync data with grid
        this.syncWithGrid();

        // Update dots
        this.updateDots();

        // Restart progress bar animation
        this.animateProgressBar();
    }

    // Update card by re-cloning from grid (called when weather data updates)
    updateCardFromGrid(cardId) {
        const cardIndex = this.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        // Find the original card in the grid (check both in muuri wrapper and direct child)
        let gridCard = document.querySelector(`#todayGrid .muuri-item > .card#${cardId}`);
        if (!gridCard) {
            gridCard = document.querySelector(`#todayGrid > .card#${cardId}`);
        }
        if (!gridCard) return;

        // Clone it again
        const newClone = this.cloneCardForCarousel(gridCard);

        // Replace the element in our cards array
        this.cards[cardIndex].element = newClone;

        // If this card is currently visible, update the DOM
        if (cardIndex === this.currentIndex) {
            const wrapper = this.container.querySelector(`.carousel-card[data-index="${cardIndex}"]`);
            if (wrapper) {
                // Clear and re-append
                wrapper.innerHTML = '';
                wrapper.appendChild(newClone);
            }
        }
    }

    // Sync with live card data from the grid
    syncWithGrid() {
        this.cards.forEach((carouselCard) => {
            this.updateCardFromGrid(carouselCard.id);
        });
    }

    // Animate progress bar
    animateProgressBar() {
        if (!this.progressElement) {
            this.progressElement = document.getElementById('carouselProgressFill');
        }

        if (!this.progressElement) return;

        // Cancel any existing animation
        if (this.progressAnimationId) {
            cancelAnimationFrame(this.progressAnimationId);
        }

        const startTime = performance.now();
        const duration = this.rotationInterval;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const remaining = 1 - progress;

            // Scale from 100% to 0%
            this.progressElement.style.transform = `scaleX(${remaining})`;

            if (progress < 1) {
                this.progressAnimationId = requestAnimationFrame(animate);
            }
        };

        this.progressAnimationId = requestAnimationFrame(animate);
    }

    // Show next card
    next() {
        if (this.cards.length === 0) return;

        const currentCard = this.container.querySelector('.carousel-card.active');
        if (currentCard) {
            currentCard.classList.remove('active');
        }

        this.currentIndex = (this.currentIndex + 1) % this.cards.length;

        const nextCard = this.container.querySelector(`.carousel-card[data-index="${this.currentIndex}"]`);
        if (nextCard) {
            nextCard.classList.add('active');
        }

        // Sync data with grid when rotating
        this.syncWithGrid();

        // Update dots
        this.updateDots();

        // Restart progress bar animation
        this.animateProgressBar();
    }

    // Start automatic rotation
    start() {
        if (this.intervalId) {
            this.stop();
        }

        this.intervalId = setInterval(() => {
            this.next();
        }, this.rotationInterval);

        // Start the first progress animation
        this.animateProgressBar();

        console.log('[Banner Carousel] Started automatic rotation');
    }

    // Stop automatic rotation
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.progressAnimationId) {
            cancelAnimationFrame(this.progressAnimationId);
            this.progressAnimationId = null;
        }

        console.log('[Banner Carousel] Stopped automatic rotation');
    }

    // Initialize the carousel
    async init() {
        // Wait for cards to be rendered in the grid
        await this.waitForGridCards();

        // Load cards from grid
        const success = this.loadCardsFromGrid();
        if (!success) {
            console.error('[Banner Carousel] Failed to load cards');
            return;
        }

        // Render carousel
        this.render();

        // Start rotation only if enabled in settings
        const enableRotation = typeof getEnableCarouselRotation === 'function'
            ? getEnableCarouselRotation()
            : true;

        if (enableRotation) {
            this.start();
        }

        // Sync periodically with grid data
        setInterval(() => {
            this.syncWithGrid();
        }, 10000); // Sync every 10 seconds

        this.isInitialized = true;
        console.log('[Banner Carousel] Fully initialized', { rotationEnabled: enableRotation });

        // Apply any pending settings that were set before initialization
        if (typeof applyBannerSettings === 'function') {
            applyBannerSettings();
        }
    }

    // Helper to wait for grid cards to be rendered
    async waitForGridCards() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const gridCards = document.querySelectorAll('#todayGrid .card');
                if (gridCards.length > 0) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 10000);
        });
    }
}

// Initialize when DOM is ready
let bannerCarousel = null;

document.addEventListener('DOMContentLoaded', async function () {
    console.log('[Banner Carousel] DOM ready, initializing...');

    // Wait a bit for cards to be fully rendered
    setTimeout(async () => {
        // Get rotation interval from settings, default to 10 seconds
        const rotationInterval = typeof getRotationInterval === 'function'
            ? getRotationInterval()
            : 10000;

        bannerCarousel = new BannerCarousel('bannerCarousel', {
            rotationInterval: rotationInterval
        });

        await bannerCarousel.init();
    }, 1000); // Wait 1 second for cards to render
});
