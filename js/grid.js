// Muuri grid initialization and card interaction handlers for WeatherPane
// Depends on: jQuery, Muuri library, weather.js

// Muuri grid instances
let muuriGrid = null;
let todayGrid = null; // Alias for backward compatibility
let isDragging = false;
let justFinishedDragging = false;
let isEditMode = false;
let detailOverlayState = { placeholder: null, cardId: null };

// Moon test mode
window.lastMoonData = null;

function updateMoonIcon(phase, fraction) {
    updateMoonSVG(phase, fraction);
}

// Card visibility management
function getHiddenCards() {
    const saved = localStorage.getItem('weatherPane:hiddenCards');
    return saved ? JSON.parse(saved) : [];
}

function setHiddenCards(hiddenCards) {
    localStorage.setItem('weatherPane:hiddenCards', JSON.stringify(hiddenCards));
}

function isCardHidden(cardId) {
    return getHiddenCards().includes(cardId);
}

function hideCard(cardId) {
    const hiddenCards = getHiddenCards();
    if (!hiddenCards.includes(cardId)) {
        hiddenCards.push(cardId);
        setHiddenCards(hiddenCards);
    }
    applyCardVisibility();
}

function showCard(cardId) {
    const hiddenCards = getHiddenCards().filter(id => id !== cardId);
    setHiddenCards(hiddenCards);
    applyCardVisibility();
}

function applyCardVisibility() {
    const hiddenCards = getHiddenCards();

    if (!muuriGrid) return;

    const items = muuriGrid.getItems();
    const itemsToHide = [];
    const itemsToShow = [];

    items.forEach(item => {
        const cardId = item.getElement().id;
        if (hiddenCards.includes(cardId)) {
            itemsToHide.push(item);
        } else {
            itemsToShow.push(item);
        }
    });

    if (itemsToHide.length > 0) {
        muuriGrid.hide(itemsToHide, { instant: false });
    }
    if (itemsToShow.length > 0) {
        muuriGrid.show(itemsToShow, { instant: false });
    }
}

function restoreDetailToCard() {
    const { placeholder } = detailOverlayState || {};
    const $detail = $('#sunDetailBody .card-detail');
    if (placeholder && $detail.length) {
        $(placeholder).replaceWith($detail);
        $detail.removeAttr('style');
    }
    detailOverlayState = { placeholder: null, cardId: null };
    $('body').removeClass('sun-detail-active');
    $('#sunDetailTitle').text('Expanded view');
    $('#sunDetailSub').text('Select a card to see deeper context.');
    $('#sunDetailBody').empty();
}

function showDetailOverlay($card) {
    const $overlay = $('#sunDetailOverlay');
    if (!$overlay.length) return;

    const $detail = $card.find('.card-detail');
    if ($detail.length) {
        $detail.css({ opacity: 1, visibility: 'visible', transform: 'none' });
        const placeholder = document.createComment('card-detail-placeholder');
        $detail.after(placeholder);
        detailOverlayState = { placeholder, cardId: $card.attr('id') };
        $('#sunDetailBody').empty().append($detail);
    } else {
        $('#sunDetailBody').html('<p class="sun-detail-empty">No additional details available.</p>');
    }

    const title = $card.find('h3').first().text() || 'Details';
    const kickerText =
        $card.find('.kicker').first().text() ||
        $card.find('.pill').first().text() ||
        'Expanded view';

    $('#sunDetailTitle').text(title);
    $('#sunDetailSub').text(kickerText);
    $('body').addClass('sun-detail-active');
}

// Card expansion handling
function applyCardExpansion(newId) {
    if (detailOverlayState.cardId && detailOverlayState.cardId !== newId) {
        restoreDetailToCard();
    }

    expandedCardId = newId;
    $('body').toggleClass('card-expanded', Boolean(newId));

    // Get the expanded card's position if there is one
    let expandedCardCenter = null;
    if (newId) {
        const $expandedCard = $(`#${newId}`);
        if ($expandedCard.length) {
            const offset = $expandedCard.offset();
            const width = $expandedCard.outerWidth();
            const height = $expandedCard.outerHeight();
            expandedCardCenter = {
                x: offset.left + width / 2,
                y: offset.top + height / 2
            };
        }
    }

    const $cards = $('.card');
    const totalCards = $cards.length;

    $cards.each(function () {
        const $card = $(this);
        const isExpanded = $card.attr('id') === newId;
        $card.toggleClass('expanded', isExpanded);
        $card.attr('aria-expanded', isExpanded ? 'true' : 'false');
        // Remove dimming from other cards to keep them fully interactive
        $card.removeClass('card-dimmed');
        $card.css('filter', '');
    });

    if (newId) {
        const $expanded = $(`#${newId}`);
        if ($expanded.length) {
            showDetailOverlay($expanded);
        }
    } else {
        restoreDetailToCard();
    }

    // Refresh Muuri layout after card expansion/collapse
    if (muuriGrid) {
        setTimeout(() => {
            muuriGrid.refreshItems();
            muuriGrid.layout();
        }, 350); // Wait for CSS transition to complete
    }
}

function toggleCard($card) {
    const id = $card.attr('id');
    const targetId = expandedCardId === id ? null : id;
    applyCardExpansion(targetId);
    if (targetId) {
        setTimeout(() => {
            const node = $card.get(0);
            if (node && typeof node.scrollIntoView === 'function') {
                node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
        }, 60);
    }
}

// Edit mode management
function toggleEditMode() {
    isEditMode = !isEditMode;
    const $body = $('body');
    const $editBtn = $('#editBtn');

    if (isEditMode) {
        $body.addClass('edit-mode-active');
        $editBtn.addClass('active');

        console.log('[Grid] Dragging ENABLED (edit mode active)');

        // Add blink animation to visible cards with random delays
        $('.card').each(function () {
            const $card = $(this);
            const $item = $card.closest('.muuri-item');
            if (!$item.hasClass('muuri-item-hidden')) {
                // Random delay between 0 and 1.2 seconds
                const randomDelay = Math.random() * 1.2;
                $card.css('animation-delay', `${randomDelay}s`);
                $card.addClass('blinking');
            }
        });

        // Add delete badges to all cards
        $('.card').each(function () {
            const $card = $(this);
            if (!$card.find('.card-delete-badge').length) {
                const $badge = $('<div class="card-delete-badge">−</div>');
                $badge.on('click', function (e) {
                    e.stopPropagation();
                    const cardId = $card.attr('id');
                    hideCard(cardId);
                });
                $card.append($badge);
            }
        });
    } else {
        $body.removeClass('edit-mode-active');
        $editBtn.removeClass('active');

        console.log('[Grid] Dragging DISABLED (edit mode inactive)');

        // Remove blink animation and reset delays
        $('.card').each(function () {
            $(this).removeClass('blinking').css('animation-delay', '');
        });
    }

    console.log('[Grid] Edit mode:', isEditMode ? 'ON' : 'OFF');
}

// Initialize card interaction handlers
function initCardHandlers() {
    const $panel = $('#panel');

    applyCardExpansion(null);

    // Edit button handler
    $('#editBtn').on('click', function () {
        toggleEditMode();
    });

    // Moon test badge click handler (must be before card click handler)
    $panel.on('click', '.moon-test-badge', function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Moon] Badge clicked');
        const $card = $(this).closest('.card');
        const $icon = $(this).find('i');
        $card.toggleClass('moon-test-active');

        // Toggle chevron icon
        if ($card.hasClass('moon-test-active')) {
            $icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
        } else {
            $icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
            // Reset to live moon data
            if (window.lastMoonData) {
                updateMoonIcon(window.lastMoonData.phase, window.lastMoonData.fraction);
            }
        }

        // Refresh Muuri grid to recalculate card sizes
        if (muuriGrid) {
            setTimeout(() => {
                muuriGrid.refreshItems();
                muuriGrid.layout();
            }, 350); // Wait for CSS transition to complete
        }
    });

    $panel.on('click', '.card', function (e) {
        // Check if click is on or within a badge
        if ($(e.target).hasClass('status-badge') || $(e.target).closest('.status-badge').length) {
            console.log('[Card] Click ignored - badge clicked');
            return;
        }
        if ($(e.target).closest('.card-delete-badge').length) return;

        // Don't expand cards in edit mode
        if (isEditMode) {
            return;
        }

        // Prevent click if we just finished dragging
        if (justFinishedDragging) {
            console.log('[Card] Click ignored - just finished dragging');
            return;
        }

        toggleCard($(this));
    });

    // Moon phase slider handler
    $('#moonPhaseSlider').on('input', function () {
        const sliderValue = parseInt($(this).val());
        const illumination = sliderValue / 100;

        // Map slider to phase cycle (0-100 = 0.0-1.0)
        // 0 = New Moon (waxing start)
        // 50 = Full Moon
        // 100 = New Moon (waning end)
        let phase, fraction;

        if (sliderValue <= 50) {
            // Waxing: 0-50 maps to phase 0-0.5, fraction 0-1
            phase = sliderValue / 100;
            fraction = sliderValue / 50;
        } else {
            // Waning: 50-100 maps to phase 0.5-1.0, fraction 1-0
            phase = sliderValue / 100;
            fraction = (100 - sliderValue) / 50;
        }

        updateMoonIcon(phase, fraction);

        // Update phase name and illumination percentage
        const phaseName = moonLabel(phase);
        $('#moonSliderPhaseName').text(phaseName);
        $('#moonSliderValue').text(`${Math.round(fraction * 100)}%`);

        // Calculate when this phase will next occur
        if (window.lastMoonData) {
            const currentPhase = window.lastMoonData.phase;
            const targetPhase = phase;
            const lunarCycle = 29.53059; // days in a lunar cycle

            // Calculate phase difference
            let phaseDiff = targetPhase - currentPhase;
            if (phaseDiff < 0) phaseDiff += 1; // Wrap around

            // Convert to days
            const daysUntil = phaseDiff * lunarCycle;

            // Format the next occurrence date
            const nextDate = new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000);
            const dateStr = nextDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

            if (daysUntil < 1) {
                $('#moonSliderNext').text('Next occurs: Today');
            } else if (daysUntil < 2) {
                $('#moonSliderNext').text('Next occurs: Tomorrow');
            } else {
                $('#moonSliderNext').text(`Next occurs: ${dateStr} (${Math.round(daysUntil)} days)`);
            }
        }
    });

    $panel.on('keydown', '.card', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCard($(this));
        }
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' && expandedCardId) {
            applyCardExpansion(null);
        }
    });

    $(document).on('click', function (e) {
        const clickedCard = $(e.target).closest('.card').length;
        const clickedOverlay = $(e.target).closest('#sunDetailOverlay').length;
        if (expandedCardId && !clickedCard && !clickedOverlay) {
            applyCardExpansion(null);
        }
    });

    $('#closeDetailOverlay').on('click', function () {
        applyCardExpansion(null);
    });

    // Set up temperature toggle click handler on badge (using event delegation)
    $panel.on('click', '#tempUnitBadge', function (e) {
        e.stopPropagation(); // Prevent card click events

        // Animate the card
        const $card = $('#currentWeatherCard');
        $card.addClass('animate-click');
        setTimeout(() => {
            $card.removeClass('animate-click');
        }, 150);

        // Toggle temperature unit
        toggleTemperatureUnit();
    });

    // Set up day toggle badges for Sunrise, Sunset, Night, and Weather cards (using event delegation)
    $panel.on('click', '#sunriseDayBadge', function (e) {
        e.stopPropagation();
        toggleDayView('sunrise', $('#sunriseCard'));
    });

    $panel.on('click', '#sunsetDayBadge', function (e) {
        e.stopPropagation();
        toggleDayView('sunset', $('#sunsetCard'));
    });

    $panel.on('click', '#nightDayBadge', function (e) {
        e.stopPropagation();
        toggleDayView('night', $('#nightCard'));
    });

    $panel.on('click', '#weatherDayBadge', function (e) {
        e.stopPropagation();
        toggleDayView('weather', $('#currentWeatherCard'));
    });
}

// Toggle between today and tomorrow view for a card
function toggleDayView(cardType, $card) {
    // Animate the card
    $card.addClass('animate-click');
    setTimeout(() => {
        $card.removeClass('animate-click');
    }, 150);

    // Get current state from localStorage (default is 'today')
    const currentState = localStorage.getItem(`weatherPane:${cardType}DayView`) || 'today';
    const newState = currentState === 'today' ? 'tomorrow' : 'today';

    // Save new state
    localStorage.setItem(`weatherPane:${cardType}DayView`, newState);

    // Update badge text
    const badgeId = `${cardType}DayBadge`;
    $(`#${badgeId}`).text(newState === 'today' ? 'TOD' : 'TMR');

    // Update header text
    const headerText = {
        'sunrise': 'Sunrise',
        'sunset': 'Sunset',
        'night': 'Night Start',
        'weather': 'Weather'
    };
    const baseHeader = headerText[cardType];
    $card.find('h3').text(newState === 'today' ? baseHeader : `${baseHeader} (Tomorrow)`);

    // Toggle visibility of today/tomorrow data
    const todaySelector = `.${cardType}-today-data`;
    const tomorrowSelector = `.${cardType}-tomorrow-data`;

    if (newState === 'today') {
        $card.find(todaySelector).show();
        $card.find(tomorrowSelector).hide();
    } else {
        $card.find(todaySelector).hide();
        $card.find(tomorrowSelector).show();
    }

    // Refresh Muuri grid to recalculate card sizes
    if (muuriGrid) {
        setTimeout(() => {
            muuriGrid.refreshItems();
            muuriGrid.layout();
        }, 350);
    }
}

// Initialize day view states on page load
function initDayViewStates() {
    const cards = ['sunrise', 'sunset', 'night', 'weather'];
    const headerText = {
        'sunrise': 'Sunrise',
        'sunset': 'Sunset',
        'night': 'Night Start',
        'weather': 'Weather'
    };

    cards.forEach(cardType => {
        const savedState = localStorage.getItem(`weatherPane:${cardType}DayView`) || 'today';
        const $card = $(`#${cardType === 'weather' ? 'currentWeather' : cardType}Card`);
        const badgeId = `${cardType}DayBadge`;

        // Set badge text
        $(`#${badgeId}`).text(savedState === 'today' ? 'TOD' : 'TMR');

        // Set header text
        const baseHeader = headerText[cardType];
        $card.find('h3').text(savedState === 'today' ? baseHeader : `${baseHeader} (Tomorrow)`);

        // Set visibility
        const todaySelector = `.${cardType}-today-data`;
        const tomorrowSelector = `.${cardType}-tomorrow-data`;

        if (savedState === 'today') {
            $card.find(todaySelector).show();
            $card.find(tomorrowSelector).hide();
        } else {
            $card.find(todaySelector).hide();
            $card.find(tomorrowSelector).show();
        }
    });
}

// Initialize Muuri grid for drag-and-drop
function initMuuriGrid() {
    const checkMuuri = setInterval(() => {
        if (typeof Muuri !== 'undefined') {
            clearInterval(checkMuuri);
            console.log('[Muuri] Muuri loaded, initializing grid...');

            const $grid = $('#todayGrid');

            // Restore saved card order from localStorage
            const savedOrder = localStorage.getItem('weatherPane:cardOrder');

            if (savedOrder) {
                try {
                    const orderArray = JSON.parse(savedOrder);
                    console.log('[Muuri] Restoring saved card order:', orderArray);

                    // Reorder cards in DOM based on saved order
                    orderArray.forEach(cardId => {
                        const $card = $(`#${cardId}`);
                        if ($card.length) {
                            $grid.append($card);
                        }
                    });
                } catch (e) {
                    console.warn('[Muuri] Failed to restore card order:', e);
                }
            }

            const muuriOptions = {
                items: '.card',
                dragEnabled: true,
                dragSortHeuristics: {
                    sortInterval: 50,
                    minDragDistance: 10,
                    minBounceBackAngle: 1
                },
                dragStartPredicate: function (item, event) {
                    // Only allow dragging when in edit mode
                    if (!isEditMode) {
                        return false;
                    }
                    // In edit mode, allow immediate dragging
                    return true;
                },
                dragRelease: {
                    duration: 400,
                    easing: 'cubic-bezier(0.2, 0, 0.2, 1)'
                },
                layoutOnInit: true,
                layout: {
                    fillGaps: true,
                    horizontal: false,
                    alignRight: false,
                    alignBottom: false,
                    rounding: false
                },
                layoutDuration: 400,
                layoutEasing: 'cubic-bezier(0.4, 0.0, 0.2, 1)'
            };

            // Create grid
            muuriGrid = new Muuri('#todayGrid', muuriOptions);
            todayGrid = muuriGrid; // Alias for backward compatibility

            // Expose grid globally for access from main.js
            window.todayGrid = muuriGrid;
            window.muuriGrid = muuriGrid;

            // Apply saved card visibility
            applyCardVisibility();

            // Track drag start
            muuriGrid.on('dragStart', function () {
                isDragging = true;
                console.log('[Muuri] Drag started');
            });

            // Save card order when drag ends
            muuriGrid.on('dragEnd', function () {
                isDragging = false;
                justFinishedDragging = true;

                const items = muuriGrid.getItems();
                const order = items.map(item => item.getElement().id);
                localStorage.setItem('weatherPane:cardOrder', JSON.stringify(order));
                console.log('[Muuri] Card order saved:', order);

                // Clear the flag after a short delay to allow normal clicks again
                setTimeout(() => {
                    justFinishedDragging = false;
                    console.log('[Muuri] Ready for clicks again');
                }, 200);
            });

            console.log('[Muuri] Grid initialized with drag-and-drop');
        }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => {
        clearInterval(checkMuuri);
        if (typeof Muuri === 'undefined') {
            console.error('[Muuri] Muuri failed to load after 5 seconds');
        }
    }, 5000);
}
