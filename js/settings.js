// Settings modal initialization and management for WeatherPane
// Depends on: jQuery, scene-manager.js

// Scene data for preview
const SCENE_DATA = [
    { value: 'auto', name: 'Automatic', icon: 'fa-wand-sparkles' },
    { value: 'clear', name: 'Sunny', icon: 'fa-sun' },
    { value: 'partly-cloudy', name: 'Partly Cloudy', icon: 'fa-cloud-sun' },
    { value: 'cloudy', name: 'Cloudy', icon: 'fa-cloud' },
    { value: 'mostly-cloudy', name: 'Mostly Cloudy', icon: 'fa-clouds' },
    { value: 'overcast', name: 'Overcast', icon: 'fa-smog' },
    { value: 'rain', name: 'Rainy', icon: 'fa-cloud-rain' },
    { value: 'storm', name: 'Storm', icon: 'fa-cloud-bolt' },
    { value: 'snow', name: 'Snowy', icon: 'fa-snowflake' },
    { value: 'night', name: 'Starry Night', icon: 'fa-moon' }
];

let currentSceneIndex = 0;
let previewManager = null;
let activeTabId = 'appearance';
let navIndicatorFrame = null;

// Theme management functions
function getThemeMode() {
    return localStorage.getItem('weatherPane:themeMode') || 'auto';
}

function setThemeMode(mode) {
    localStorage.setItem('weatherPane:themeMode', mode);
}

function getThemeColor() {
    return localStorage.getItem('weatherPane:themeColor') || 'blue';
}

function setThemeColor(color) {
    localStorage.setItem('weatherPane:themeColor', color);
}

function applyTheme() {
    const mode = getThemeMode();
    const color = getThemeColor();

    // Handle auto mode based on prefers-color-scheme
    let effectiveMode = mode;
    if (mode === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveMode = prefersDark ? 'dark' : 'light';
    }

    // Apply theme attributes to body
    document.body.setAttribute('data-theme-mode', effectiveMode);
    document.body.setAttribute('data-theme-color', color);

    console.log('[Theme] Applied:', { mode, color, effectiveMode });

    if (typeof scheduleBackgroundRefresh === 'function') {
        scheduleBackgroundRefresh();
    }
}

// Daily Brief settings management
function getBannerLayout() {
    return localStorage.getItem('weatherPane:bannerLayout') || 'full';
}

function setBannerLayout(layout) {
    localStorage.setItem('weatherPane:bannerLayout', layout);
}

function getRotationInterval() {
    return parseInt(localStorage.getItem('weatherPane:rotationInterval') || '10000', 10);
}

function setRotationInterval(interval) {
    localStorage.setItem('weatherPane:rotationInterval', interval.toString());
}

function getProgressIndicator() {
    return localStorage.getItem('weatherPane:progressIndicator') || 'both';
}

function setProgressIndicator(indicator) {
    localStorage.setItem('weatherPane:progressIndicator', indicator);
}

function getEnableCarouselRotation() {
    const value = localStorage.getItem('weatherPane:enableCarouselRotation');
    return value === null ? true : value === 'true';
}

function setEnableCarouselRotation(enable) {
    localStorage.setItem('weatherPane:enableCarouselRotation', enable.toString());
}

function getSummaryContentSettings() {
    return {
        showSolar: localStorage.getItem('weatherPane:summaryShowSolar') !== 'false',
        showTemp: localStorage.getItem('weatherPane:summaryShowTemp') !== 'false',
        showWeather: localStorage.getItem('weatherPane:summaryShowWeather') !== 'false',
        showMoon: localStorage.getItem('weatherPane:summaryShowMoon') !== 'false'
    };
}

function setSummaryContentSetting(key, value) {
    localStorage.setItem(`weatherPane:summary${key}`, value.toString());
}

function applyBannerSettings() {
    const layout = getBannerLayout();
    const progressIndicator = getProgressIndicator();
    const enableRotation = getEnableCarouselRotation();

    // Apply layout classes to banner
    const $splitBanner = $('.split-banner');
    $splitBanner.removeClass('layout-full layout-summary-only layout-carousel-only');

    if (layout === 'summaryOnly') {
        $splitBanner.addClass('layout-summary-only');
    } else if (layout === 'carouselOnly') {
        $splitBanner.addClass('layout-carousel-only');
    } else {
        $splitBanner.addClass('layout-full');
    }

    // Apply progress indicator visibility
    const $progressBar = $('.carousel-progress-bar');
    const $dots = $('.carousel-dots');

    if (progressIndicator === 'progress') {
        $progressBar.removeClass('hidden');
        $dots.addClass('hidden');
    } else if (progressIndicator === 'dots') {
        $progressBar.addClass('hidden');
        $dots.removeClass('hidden');
    } else if (progressIndicator === 'both') {
        $progressBar.removeClass('hidden');
        $dots.removeClass('hidden');
    } else {
        // none
        $progressBar.addClass('hidden');
        $dots.addClass('hidden');
    }

    // Update carousel rotation
    if (window.bannerCarousel && window.bannerCarousel.isInitialized) {
        const interval = getRotationInterval();
        window.bannerCarousel.rotationInterval = interval;

        // Enable or disable rotation
        if (enableRotation) {
            if (!window.bannerCarousel.intervalId) {
                window.bannerCarousel.start();
            } else {
                // Restart with new interval
                window.bannerCarousel.stop();
                window.bannerCarousel.start();
            }
        } else {
            window.bannerCarousel.stop();
        }

        // Update dots
        if (window.bannerCarousel.updateDots) {
            window.bannerCarousel.updateDots();
        }
    }

    // Update summary content
    if (window.updateBannerSummary) {
        window.updateBannerSummary();
    }

    console.log('[Settings] Applied banner settings:', { layout, progressIndicator, enableRotation, interval: getRotationInterval() });
}

// Background preview functions
function initBackgroundPreview() {
    const $preview = $('#backgroundPreview');
    if (!$preview.length) return;

    // Initialize scene index from saved setting
    const savedScene = getForcedSceneSetting();
    currentSceneIndex = SCENE_DATA.findIndex(s => s.value === savedScene);
    if (currentSceneIndex === -1) currentSceneIndex = 0;

    // Create preview manager
    const previewEl = $preview[0];
    if (!previewManager) {
        previewManager = new WeatherSceneManager(previewEl);
    }

    // Apply initial disabled state based on cloud setting
    const cloudState = getCloudSetting();
    if (cloudState === 'off') {
        $preview.addClass('disabled');
    } else {
        $preview.removeClass('disabled');
    }

    // Initialize dots
    updatePreviewDots();

    // Update preview to current scene
    updatePreviewScene();
}

function updatePreviewDots() {
    const $dotsContainer = $('#previewDots');
    if (!$dotsContainer.length) return;

    $dotsContainer.empty();
    SCENE_DATA.forEach((scene, index) => {
        const $dot = $('<div class="preview-dot"></div>');
        if (index === currentSceneIndex) {
            $dot.addClass('active');
        }
        $dot.on('click', () => {
            currentSceneIndex = index;
            updatePreviewScene();
            updatePreviewDots();
        });
        $dotsContainer.append($dot);
    });
}

function updatePreviewScene() {
    const scene = SCENE_DATA[currentSceneIndex];

    // Update scene info display
    $('#sceneInfoIcon').html(`<i class="fa-solid ${scene.icon}"></i>`);
    $('#sceneInfoName').text(scene.name);

    // Update preview manager
    if (previewManager) {
        const context = computeSceneContext();
        const sceneValue = scene.value;

        const resolvedContext = resolveForcedSceneContext(context, sceneValue);

        previewManager.setScene(resolvedContext.sceneId, resolvedContext);

        // Apply cloud state from settings
        const cloudState = getCloudSetting();
        if (cloudState === 'paused') {
            previewManager.pause();
        } else if (cloudState === 'on') {
            previewManager.resume();
        }
    }

    // Save the selected scene
    setForcedSceneSetting(scene.value);

    // Update main background
    if (typeof scheduleBackgroundRefresh === 'function') {
        scheduleBackgroundRefresh();
    }
}

function nextScene() {
    currentSceneIndex = (currentSceneIndex + 1) % SCENE_DATA.length;
    updatePreviewScene();
    updatePreviewDots();
}

function prevScene() {
    currentSceneIndex = (currentSceneIndex - 1 + SCENE_DATA.length) % SCENE_DATA.length;
    updatePreviewScene();
    updatePreviewDots();
}

// Responsive settings navigation
function updateNavIndicator() {
    const $indicator = $('#settingsNavIndicator');
    const $active = $('.settings-nav-item.active');
    const $scroll = $('#settingsNavScroll');

    if (!$indicator.length || !$active.length || !$scroll.length) return;

    const activeRect = $active[0].getBoundingClientRect();
    const scrollRect = $scroll[0].getBoundingClientRect();

    const left = activeRect.left - scrollRect.left;
    const top = activeRect.top - scrollRect.top;

    $indicator.css({
        width: activeRect.width + 'px',
        height: activeRect.height + 'px',
        transform: `translate(${left}px, ${top}px)`
    });
}

function switchTab(tabId, options = {}) {
    activeTabId = tabId;
    const $buttons = $('.settings-nav-item');
    const $panels = $('.settings-panel');

    $buttons.removeClass('active').attr('aria-selected', 'false');
    const $activeButton = $buttons.filter(`[data-tab-target="${tabId}"]`);
    $activeButton.addClass('active').attr('aria-selected', 'true');

    $panels.removeClass('active').attr('aria-hidden', 'true');
    const $panel = $panels.filter(`[data-tab-id="${tabId}"]`);
    $panel.addClass('active').attr('aria-hidden', 'false');

    if (tabId === 'background') {
        setTimeout(initBackgroundPreview, 120);
    } else if (tabId === 'cards') {
        populateCardList();
    }

    if (!options.skipIndicator) {
        updateNavIndicator();
    }

    if ($activeButton.length) {
        $activeButton[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
}

// Build navigation dynamically from available panels so new tabs auto-register
function buildSettingsNav() {
    const $scroll = $('#settingsNavScroll');
    const $panels = $('.settings-panel');

    if (!$scroll.length || !$panels.length) return;

    $scroll.find('.settings-nav-item').remove();

    let firstTabId = null;

    $panels.each(function() {
        const $panel = $(this);
        const tabId = $panel.data('tab-id');
        const label = $panel.data('label') || 'Section';
        const icon = $panel.data('icon') || 'fa-gear';
        const badge = $panel.data('badge');

        if (!$panel.attr('id')) {
            $panel.attr('id', `${tabId}Tab`);
        }

        $panel.attr({
            role: 'tabpanel',
            'aria-hidden': !$panel.hasClass('active')
        });

        if ($panel.hasClass('active')) {
            activeTabId = tabId;
        }

        if (!firstTabId) {
            firstTabId = tabId;
        }

        const $btn = $(`
            <button class="settings-nav-item" role="tab" aria-selected="false" aria-controls="${$panel.attr('id')}" data-tab-target="${tabId}">
                <span class="nav-icon"><i class="fa-solid ${icon}"></i></span>
                <span class="nav-label">${label}</span>
                ${badge ? `<span class="nav-badge">${badge}</span>` : ''}
            </button>
        `);

        $btn.on('click', () => switchTab(tabId));
        $scroll.append($btn);
    });

    if (!activeTabId) {
        activeTabId = firstTabId;
    }

    switchTab(activeTabId, { skipIndicator: true });
    updateNavIndicator();
}

function initSettings() {
    const $settingsBtn = $('#settingsBtn');
    const $settingsModal = $('#settingsModal');
    const $closeSettingsBtn = $('#closeSettingsBtn');
    const $cloudOnRadio = $('#cloudOn');
    const $cloudPausedRadio = $('#cloudPaused');
    const $cloudOffRadio = $('#cloudOff');
    const $prevSceneBtn = $('#prevSceneBtn');
    const $nextSceneBtn = $('#nextSceneBtn');
    const $themeModeAutoRadio = $('#themeModeAuto');
    const $themeModeLightRadio = $('#themeModeLight');
    const $themeModeDarkRadio = $('#themeModeDark');
    const $colorBlueRadio = $('#colorBlue');
    const $colorPurpleRadio = $('#colorPurple');
    const $colorPinkRadio = $('#colorPink');
    const $colorGreenRadio = $('#colorGreen');
    const $colorOrangeRadio = $('#colorOrange');
    const $colorTealRadio = $('#colorTeal');
    const $colorGreyRadio = $('#colorGrey');
    const $settingsNavScroll = $('#settingsNavScroll');
    const $settingsNavIndicator = $('#settingsNavIndicator');

    // Daily Brief settings elements
    const $bannerLayoutFull = $('#bannerLayoutFull');
    const $bannerLayoutSummaryOnly = $('#bannerLayoutSummaryOnly');
    const $bannerLayoutCarouselOnly = $('#bannerLayoutCarouselOnly');
    const $enableCarouselRotation = $('#enableCarouselRotation');
    const $rotationSlow = $('#rotationSlow');
    const $rotationMedium = $('#rotationMedium');
    const $rotationFast = $('#rotationFast');
    const $indicatorProgress = $('#indicatorProgress');
    const $indicatorDots = $('#indicatorDots');
    const $indicatorBoth = $('#indicatorBoth');
    const $indicatorNone = $('#indicatorNone');
    const $summaryShowSolar = $('#summaryShowSolar');
    const $summaryShowTemp = $('#summaryShowTemp');
    const $summaryShowWeather = $('#summaryShowWeather');
    const $summaryShowMoon = $('#summaryShowMoon');

    if (!$settingsBtn.length || !$settingsModal.length || !$closeSettingsBtn.length ||
        !$cloudOnRadio.length || !$cloudPausedRadio.length || !$cloudOffRadio.length ||
        !$prevSceneBtn.length || !$nextSceneBtn.length ||
        !$themeModeAutoRadio.length || !$themeModeLightRadio.length || !$themeModeDarkRadio.length ||
        !$colorBlueRadio.length || !$colorPurpleRadio.length || !$colorPinkRadio.length ||
        !$colorGreenRadio.length || !$colorOrangeRadio.length || !$colorTealRadio.length ||
        !$colorGreyRadio.length || !$settingsNavScroll.length || !$settingsNavIndicator.length) {
        console.warn('[Settings] Settings elements not found');
        return;
    }

    // Load saved cloud state and set the appropriate radio button
    const savedState = getCloudSetting();
    if (savedState === 'on') {
        $cloudOnRadio.prop('checked', true);
    } else if (savedState === 'paused') {
        $cloudPausedRadio.prop('checked', true);
    } else if (savedState === 'off') {
        $cloudOffRadio.prop('checked', true);
    }

    // Load saved theme mode
    const themeModeRadios = {
        auto: $themeModeAutoRadio,
        light: $themeModeLightRadio,
        dark: $themeModeDarkRadio
    };
    const savedThemeMode = getThemeMode();
    if (themeModeRadios[savedThemeMode]) {
        themeModeRadios[savedThemeMode].prop('checked', true);
    } else {
        $themeModeAutoRadio.prop('checked', true);
    }

    // Load saved theme color
    const colorRadios = {
        blue: $colorBlueRadio,
        purple: $colorPurpleRadio,
        pink: $colorPinkRadio,
        green: $colorGreenRadio,
        orange: $colorOrangeRadio,
        teal: $colorTealRadio,
        grey: $colorGreyRadio
    };
    const savedColor = getThemeColor();
    if (colorRadios[savedColor]) {
        colorRadios[savedColor].prop('checked', true);
    } else {
        $colorBlueRadio.prop('checked', true);
    }

    // Load saved Daily Brief settings
    const savedBannerLayout = getBannerLayout();
    if (savedBannerLayout === 'summaryOnly') {
        $bannerLayoutSummaryOnly.prop('checked', true);
    } else if (savedBannerLayout === 'carouselOnly') {
        $bannerLayoutCarouselOnly.prop('checked', true);
    } else {
        $bannerLayoutFull.prop('checked', true);
    }

    $enableCarouselRotation.prop('checked', getEnableCarouselRotation());

    const savedRotationInterval = getRotationInterval();
    if (savedRotationInterval === 15000) {
        $rotationSlow.prop('checked', true);
    } else if (savedRotationInterval === 5000) {
        $rotationFast.prop('checked', true);
    } else {
        $rotationMedium.prop('checked', true);
    }

    const savedProgressIndicator = getProgressIndicator();
    if (savedProgressIndicator === 'progress') {
        $indicatorProgress.prop('checked', true);
    } else if (savedProgressIndicator === 'dots') {
        $indicatorDots.prop('checked', true);
    } else if (savedProgressIndicator === 'none') {
        $indicatorNone.prop('checked', true);
    } else {
        $indicatorBoth.prop('checked', true);
    }

    const summarySettings = getSummaryContentSettings();
    $summaryShowSolar.prop('checked', summarySettings.showSolar);
    $summaryShowTemp.prop('checked', summarySettings.showTemp);
    $summaryShowWeather.prop('checked', summarySettings.showWeather);
    $summaryShowMoon.prop('checked', summarySettings.showMoon);

    // Apply banner settings on page load
    applyBannerSettings();

    buildSettingsNav();

    // Open settings modal
    $settingsBtn.on('click', () => {
        $settingsModal.addClass('active');
        // Update nav indicator position after modal animation
        setTimeout(updateNavIndicator, 250);
    });

    // Close settings modal
    const closeModal = () => {
        $settingsModal.removeClass('active');
    };

    $closeSettingsBtn.on('click', closeModal);

    // Close on backdrop click
    $settingsModal.on('click', (e) => {
        if (e.target === $settingsModal[0]) {
            closeModal();
        }
    });

    // Close on Escape key
    $(document).on('keydown', (e) => {
        if (e.key === 'Escape' && $settingsModal.hasClass('active')) {
            closeModal();
        }
    });

    // Handle cloud state changes
    const handleCloudStateChange = (e) => {
        setCloudState($(e.target).val());

        // Update preview to reflect the new state
        if (previewManager) {
            const cloudState = $(e.target).val();
            const $preview = $('#backgroundPreview');

            if (cloudState === 'off') {
                previewManager.pause();
                $preview.addClass('disabled');
            } else if (cloudState === 'paused') {
                previewManager.pause();
                $preview.removeClass('disabled');
            } else {
                previewManager.resume();
                $preview.removeClass('disabled');
            }
        }
    };

    $cloudOnRadio.on('change', handleCloudStateChange);
    $cloudPausedRadio.on('change', handleCloudStateChange);
    $cloudOffRadio.on('change', handleCloudStateChange);

    // Handle scene navigation
    $prevSceneBtn.on('click', prevScene);
    $nextSceneBtn.on('click', nextScene);

    // Handle theme mode changes
    const handleThemeModeChange = (e) => {
        const value = $(e.target).val();
        setThemeMode(value);
        applyTheme();
    };

    Object.values(themeModeRadios).forEach($radio => {
        $radio.on('change', handleThemeModeChange);
    });

    // Handle theme color changes
    const handleThemeColorChange = (e) => {
        const value = $(e.target).val();
        setThemeColor(value);
        applyTheme();
    };

    Object.values(colorRadios).forEach($radio => {
        $radio.on('change', handleThemeColorChange);
    });

    // Handle Daily Brief banner layout changes
    const handleBannerLayoutChange = (e) => {
        const value = $(e.target).val();
        setBannerLayout(value);
        applyBannerSettings();
    };

    $bannerLayoutFull.on('change', handleBannerLayoutChange);
    $bannerLayoutSummaryOnly.on('change', handleBannerLayoutChange);
    $bannerLayoutCarouselOnly.on('change', handleBannerLayoutChange);

    // Handle rotation interval changes
    const handleRotationIntervalChange = (e) => {
        const value = $(e.target).val();
        setRotationInterval(value);
        applyBannerSettings();
    };

    $rotationSlow.on('change', handleRotationIntervalChange);
    $rotationMedium.on('change', handleRotationIntervalChange);
    $rotationFast.on('change', handleRotationIntervalChange);

    // Handle carousel rotation toggle
    $enableCarouselRotation.on('change', function() {
        const isChecked = $(this).is(':checked');
        setEnableCarouselRotation(isChecked);
        applyBannerSettings();
    });

    // Handle progress indicator changes
    const handleProgressIndicatorChange = (e) => {
        const value = $(e.target).val();
        setProgressIndicator(value);
        applyBannerSettings();
    };

    $indicatorProgress.on('change', handleProgressIndicatorChange);
    $indicatorDots.on('change', handleProgressIndicatorChange);
    $indicatorBoth.on('change', handleProgressIndicatorChange);
    $indicatorNone.on('change', handleProgressIndicatorChange);

    // Handle summary content checkboxes
    const handleSummaryContentChange = function() {
        const checkboxId = $(this).attr('id');
        const isChecked = $(this).is(':checked');
        const key = checkboxId.replace('summary', ''); // e.g., 'ShowSolar' from 'summaryShowSolar'
        setSummaryContentSetting(key, isChecked);
        applyBannerSettings();
    };

    $summaryShowSolar.on('change', handleSummaryContentChange);
    $summaryShowTemp.on('change', handleSummaryContentChange);
    $summaryShowWeather.on('change', handleSummaryContentChange);
    $summaryShowMoon.on('change', handleSummaryContentChange);

    // Listen for system theme changes when in auto mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getThemeMode() === 'auto') {
            applyTheme();
        }
    });

    // Keep indicator aligned on resize
    $(window).on('resize', () => {
        if (navIndicatorFrame) {
            cancelAnimationFrame(navIndicatorFrame);
        }
        navIndicatorFrame = requestAnimationFrame(updateNavIndicator);
    });

    console.log('[Settings] Initialized');
}

// Populate the card management list
function populateCardList() {
    const $cardList = $('#cardList');
    if (!$cardList.length) return;

    // Get all cards with their titles
    const cards = [];
    $('.card').each(function() {
        const $card = $(this);
        const cardId = $card.attr('id');
        const cardTitle = $card.find('h3').first().text() || 'Untitled Card';
        const dataCard = $card.attr('data-card');

        cards.push({
            id: cardId,
            title: cardTitle,
            dataCard: dataCard
        });
    });

    // Sort cards by title
    cards.sort((a, b) => a.title.localeCompare(b.title));

    // Build the list
    $cardList.empty();
    cards.forEach((card) => {
        const isHidden = isCardHidden(card.id);
        const isVisible = !isHidden;

        const $item = $(`
            <div class="card-list-item">
                <span class="card-list-item-label">${card.title}</span>
                <label class="toggle-switch">
                    <input type="checkbox" ${isVisible ? 'checked' : ''} data-card-id="${card.id}">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `);

        // Handle toggle change
        $item.find('input[type="checkbox"]').on('change', function() {
            const cardId = $(this).data('card-id');
            const shouldShow = $(this).is(':checked');

            if (shouldShow) {
                showCard(cardId);
            } else {
                hideCard(cardId);
            }
        });

        $cardList.append($item);
    });

    console.log('[Settings] Card list populated with', cards.length, 'cards');
}
