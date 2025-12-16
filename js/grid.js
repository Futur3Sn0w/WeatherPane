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
window.initialMoonSliderValue = 50; // Track the initial slider position

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

    // Recalculate container sizing after visibility changes
    setTimeout(() => {
        adjustGridContainerWidth();
    }, 350); // wait for animations to finish
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

    const $cards = $('#todayGrid .card');
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
        $('#todayGrid .card').each(function () {
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
        $('#todayGrid .card').each(function () {
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
        $('#todayGrid .card').each(function () {
            $(this).removeClass('blinking').css('animation-delay', '');
        });
    }

    console.log('[Grid] Edit mode:', isEditMode ? 'ON' : 'OFF');
}

// Initialize card interaction handlers
function initCardHandlers() {
    const $panel = $('#panel');
    const $todayGrid = $('#todayGrid');

    applyCardExpansion(null);

    // Edit button handler
    $('#editBtn').on('click', function () {
        toggleEditMode();
    });

    // Moon test button click handler (must be before card click handler)
    $todayGrid.on('click', '#moonTestBtn', function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Moon] Test button clicked');
        const $card = $(this).closest('.card');
        const $btn = $(this);
        const $icon = $btn.find('i');

        $card.toggleClass('moon-test-active');

        // Toggle active state and icon
        $btn.toggleClass('active');

        if ($card.hasClass('moon-test-active')) {
            $icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            // Store initial slider value when opening
            if (window.lastMoonData) {
                const phase = window.lastMoonData.phase;
                window.initialMoonSliderValue = Math.round(phase * 100);
                $('#moonPhaseSlider').val(window.initialMoonSliderValue);
            }
            // Hide reset button initially
            $('#moonResetBtn').hide();
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

    $todayGrid.on('click', '.card', function (e) {
        // Check if click is on or within a badge or control button
        if ($(e.target).hasClass('status-badge') || $(e.target).closest('.status-badge').length) {
            console.log('[Card] Click ignored - badge clicked');
            return;
        }
        if ($(e.target).hasClass('control-btn') || $(e.target).closest('.control-btn').length) {
            console.log('[Card] Click ignored - control button clicked');
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
    $panel.on('input', '#moonPhaseSlider', function () {
        const sliderValue = parseInt($(this).val());
        const illumination = sliderValue / 100;

        // Show/hide reset button based on whether slider has moved from initial value
        const hasMoved = sliderValue !== window.initialMoonSliderValue;
        if (hasMoved) {
            $('#moonResetBtn').fadeIn(200);
        } else {
            $('#moonResetBtn').fadeOut(200);
        }

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

    // Moon reset button handler
    $panel.on('click', '#moonResetBtn', function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Moon] Reset button clicked');

        // Reset slider to initial value
        $('#moonPhaseSlider').val(window.initialMoonSliderValue);

        // Hide reset button
        $(this).fadeOut(200);

        // Restore live moon data
        if (window.lastMoonData) {
            updateMoonIcon(window.lastMoonData.phase, window.lastMoonData.fraction);

            // Update labels
            const phaseName = moonLabel(window.lastMoonData.phase);
            $('#moonSliderPhaseName').text(phaseName);
            $('#moonSliderValue').text(`${Math.round(window.lastMoonData.fraction * 100)}%`);
            $('#moonSliderNext').text('Next occurs: Now (current phase)');
        }

        // Refresh Muuri grid to recalculate card sizes
        if (muuriGrid) {
            setTimeout(() => {
                muuriGrid.refreshItems();
                muuriGrid.layout();
            }, 350);
        }
    });

    $todayGrid.on('keydown', '.card', function (e) {
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
        const clickedCard = $(e.target).closest('#todayGrid .card').length;
        const clickedOverlay = $(e.target).closest('#sunDetailOverlay').length;
        if (expandedCardId && !clickedCard && !clickedOverlay) {
            applyCardExpansion(null);
        }
    });

    $('#closeDetailOverlay').on('click', function () {
        applyCardExpansion(null);
    });

    // Set up temperature toggle control buttons (using event delegation)
    $panel.on('click', '#tempCelsiusBtn, #tempFahrenheitBtn', function (e) {
        e.stopPropagation(); // Prevent card click events

        const $btn = $(this);
        const value = $btn.data('value');
        const $group = $btn.closest('.control-group');

        // Don't do anything if already active
        if ($btn.hasClass('active')) return;

        // Toggle active state
        $group.find('.control-btn').removeClass('active');
        $btn.addClass('active');

        // Animate the card
        const $card = $('#currentWeatherCard');
        $card.addClass('animate-click');
        setTimeout(() => {
            $card.removeClass('animate-click');
        }, 150);

        // Toggle temperature unit
        if (value === 'celsius' || value === 'fahrenheit') {
            toggleTemperatureUnit();
        }

        // Refresh Muuri grid to recalculate card sizes
        if (muuriGrid) {
            setTimeout(() => {
                muuriGrid.refreshItems();
                muuriGrid.layout();
            }, 350);
        }
    });

    // Set up day toggle control buttons for Sunrise, Sunset, Night, and Weather cards (using event delegation)
    $panel.on('click', '.control-btn[data-value="today"], .control-btn[data-value="tomorrow"]', function (e) {
        e.stopPropagation();

        const $btn = $(this);
        const value = $btn.data('value');
        const cardType = $btn.data('card');
        const $group = $btn.closest('.control-group');
        const $card = $btn.closest('.card');

        // Don't do anything if already active
        if ($btn.hasClass('active')) return;

        // Toggle active state
        $group.find('.control-btn').removeClass('active');
        $btn.addClass('active');

        // Call the toggle function
        toggleDayView(cardType, $card, value);
    });
}

// Toggle between today and tomorrow view for a card
function toggleDayView(cardType, $card, newState) {
    // If newState is not provided, toggle based on current state
    if (!newState) {
        const currentState = localStorage.getItem(`weatherPane:${cardType}DayView`) || 'today';
        newState = currentState === 'today' ? 'tomorrow' : 'today';
    }

    // Animate the card
    $card.addClass('animate-click');
    setTimeout(() => {
        $card.removeClass('animate-click');
    }, 150);

    // Save new state
    localStorage.setItem(`weatherPane:${cardType}DayView`, newState);

    // Update header text
    const headerText = {
        'sunrise': 'Sunrise',
        'sunset': 'Sunset',
        'night': 'Night Start',
        'currentWeather': 'Weather'
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
    const cards = [
        { type: 'sunrise', id: 'sunriseCard', todayBtnId: 'sunriseTodayBtn', tomorrowBtnId: 'sunriseTomorrowBtn' },
        { type: 'sunset', id: 'sunsetCard', todayBtnId: 'sunsetTodayBtn', tomorrowBtnId: 'sunsetTomorrowBtn' },
        { type: 'night', id: 'nightCard', todayBtnId: 'nightTodayBtn', tomorrowBtnId: 'nightTomorrowBtn' },
        { type: 'currentWeather', id: 'currentWeatherCard', todayBtnId: 'weatherTodayBtn', tomorrowBtnId: 'weatherTomorrowBtn' }
    ];
    const headerText = {
        'sunrise': 'Sunrise',
        'sunset': 'Sunset',
        'night': 'Night Start',
        'currentWeather': 'Weather'
    };

    cards.forEach(cardInfo => {
        const savedState = localStorage.getItem(`weatherPane:${cardInfo.type}DayView`) || 'today';
        const $card = $(`#${cardInfo.id}`);

        // Set button active states
        const $todayBtn = $(`#${cardInfo.todayBtnId}`);
        const $tomorrowBtn = $(`#${cardInfo.tomorrowBtnId}`);

        if (savedState === 'today') {
            $todayBtn.addClass('active');
            $tomorrowBtn.removeClass('active');
        } else {
            $todayBtn.removeClass('active');
            $tomorrowBtn.addClass('active');
        }

        // Set header text
        const baseHeader = headerText[cardInfo.type];
        $card.find('h3').text(savedState === 'today' ? baseHeader : `${baseHeader} (Tomorrow)`);

        // Set visibility
        const todaySelector = `.${cardInfo.type}-today-data`;
        const tomorrowSelector = `.${cardInfo.type}-tomorrow-data`;

        if (savedState === 'today') {
            $card.find(todaySelector).show();
            $card.find(tomorrowSelector).hide();
        } else {
            $card.find(todaySelector).hide();
            $card.find(tomorrowSelector).show();
        }
    });

    // Initialize temperature unit buttons
    const savedTempUnit = localStorage.getItem('weatherPane:tempUnit') || 'celsius';
    if (savedTempUnit === 'celsius') {
        $('#tempCelsiusBtn').addClass('active');
        $('#tempFahrenheitBtn').removeClass('active');
    } else {
        $('#tempCelsiusBtn').removeClass('active');
        $('#tempFahrenheitBtn').addClass('active');
    }
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
                items: '.card:not(.carousel-card-content)',
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

                // Recalculate container width in case layout has changed
                setTimeout(() => {
                    adjustGridContainerWidth();
                }, 300);

                // Clear the flag after a short delay to allow normal clicks again
                setTimeout(() => {
                    justFinishedDragging = false;
                    console.log('[Muuri] Ready for clicks again');
                }, 200);
            });

            console.log('[Muuri] Grid initialized with drag-and-drop');

            // Ensure grid container width is adjusted (center columns)
            adjustGridContainerWidth();
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

// Adjust grid container width so cards are horizontally centered and fit the optimal column count
function adjustGridContainerWidth() {
    const grid = document.getElementById('todayGrid');
    const panel = document.getElementById('panel');
    if (!grid || !panel) return;

    const styles = getComputedStyle(document.documentElement);
    const margin = parseInt(styles.getPropertyValue('--space-2')) || 8; // left+right margin per card
    const cardWidth = 375; // desired card width (px)
    const minColumns = 1;
    const maxColumns = 5;

    const viewportWidth = window.innerWidth;

    // Calculate space needed for sun viz and layout spacing
    // Sun viz takes fixed width on left side (max 400px from grid-template-columns)
    const sunVizWidth = 400;
    const contentRailGap = parseInt(styles.getPropertyValue('--space-7')) || 48; // gap between columns
    const mainPadding = parseInt(styles.getPropertyValue('--space-4')) || 16; // main padding
    const panelPaddingLeft = 20;
    const panelPaddingRight = parseInt(styles.getPropertyValue('--space-4')) || 16;
    const scrollbarWidth = 15; // Reserve space for scrollbar

    // Calculate space available for cards after accounting for all layout elements
    const layoutOverhead = sunVizWidth + contentRailGap + (mainPadding * 2) + panelPaddingLeft + panelPaddingRight + scrollbarWidth;
    const availableWidth = viewportWidth - layoutOverhead;

    const cardOuter = cardWidth + margin * 2; // card width + margins

    // Calculate how many columns can fit based on available width
    let columns = Math.floor(availableWidth / cardOuter);

    // Clamp to min/max constraints
    columns = Math.max(minColumns, Math.min(maxColumns, columns));

    // Compute container width based on chosen columns
    let containerWidth = cardOuter * columns;

    // Apply width and center
    grid.style.width = containerWidth + 'px';
    grid.style.marginLeft = 'auto';
    grid.style.marginRight = 'auto';
    grid.setAttribute('data-columns', String(columns));

    // Update global `--maxw` to allow main/header to expand for more columns
    (function updateMaxWidth() {
        const docEl = document.documentElement;
        const minMax = 800; // minimum max width to avoid too narrow layout
        const maxCap = 2400; // generous cap for very wide screens

        // Calculate desired max width to fit all columns
        // This is the full width needed: sun viz + gap + cards + padding
        const desiredMaxWidth = layoutOverhead + containerWidth;

        // Clamp to reasonable bounds, but prefer viewport width if it fits
        const finalMaxWidth = Math.min(maxCap, Math.max(minMax, Math.min(desiredMaxWidth, viewportWidth - 32)));
        docEl.style.setProperty('--maxw', finalMaxWidth + 'px');
    })();

    // If muuri is present, refresh layout so positions are recalculated
    if (window.muuriGrid) {
        window.muuriGrid.refreshItems();
        window.muuriGrid.layout();
    }
}

// Debounced resize handler: refresh Muuri layout when viewport changes
(function () {
    let resizeTimeout = null;
    window.addEventListener('resize', function () {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (muuriGrid) {
                muuriGrid.refreshItems();
                muuriGrid.layout();
                adjustGridContainerWidth();
                console.log('[Muuri] Refreshed layout after resize');
            }
        }, 150);
    });
})();
