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

    if (typeof refreshBackgroundScene === 'function') {
        refreshBackgroundScene();
    }
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

        if (sceneValue && sceneValue !== 'auto') {
            // Apply the same logic from scene-manager.js
            switch (sceneValue) {
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
                    context.cloudCover = 30;
                    context.isNight = false;
                    break;
                case 'cloudy':
                    context.sceneId = 'cloudy';
                    context.variant = 'rain';
                    context.intensity = 0.8;
                    context.cloudCover = 55;
                    context.isNight = false;
                    break;
                case 'mostly-cloudy':
                    context.sceneId = 'cloudy';
                    context.variant = 'rain';
                    context.intensity = 0.85;
                    context.cloudCover = 75;
                    context.isNight = false;
                    break;
                case 'overcast':
                    context.sceneId = 'cloudy';
                    context.variant = 'rain';
                    context.intensity = 0.95;
                    context.cloudCover = 95;
                    context.isNight = false;
                    break;
                case 'rain':
                    context.sceneId = 'rain';
                    context.variant = 'rain';
                    context.intensity = 0.9;
                    context.cloudCover = 90;
                    context.isNight = false;
                    break;
                case 'storm':
                    context.sceneId = 'storm';
                    context.variant = 'rain';
                    context.intensity = 1.0;
                    context.cloudCover = 95;
                    context.isNight = false;
                    break;
                case 'snow':
                    context.sceneId = 'rain';
                    context.variant = 'snow';
                    context.intensity = 0.85;
                    context.cloudCover = 85;
                    context.isNight = false;
                    break;
                case 'night':
                    context.sceneId = 'night-clear';
                    context.variant = 'rain';
                    context.intensity = 0.6;
                    context.cloudCover = 10;
                    context.isNight = true;
                    break;
            }
            context.forcedScene = sceneValue;
        } else {
            context.forcedScene = 'auto';
        }

        previewManager.setScene(context.sceneId, context);

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
    if (typeof refreshBackgroundScene === 'function') {
        refreshBackgroundScene();
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

    if (!$settingsBtn.length || !$settingsModal.length || !$closeSettingsBtn.length ||
        !$cloudOnRadio.length || !$cloudPausedRadio.length || !$cloudOffRadio.length ||
        !$prevSceneBtn.length || !$nextSceneBtn.length ||
        !$themeModeAutoRadio.length || !$themeModeLightRadio.length || !$themeModeDarkRadio.length ||
        !$colorBlueRadio.length || !$colorPurpleRadio.length || !$colorPinkRadio.length ||
        !$colorGreenRadio.length || !$colorOrangeRadio.length || !$colorTealRadio.length ||
        !$colorGreyRadio.length) {
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

    // Open settings modal
    $settingsBtn.on('click', () => {
        $settingsModal.addClass('active');
        // Update tab indicator position after modal animation
        setTimeout(updateTabIndicator, 300);
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

    // Listen for system theme changes when in auto mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getThemeMode() === 'auto') {
            applyTheme();
        }
    });

    // Initialize tab indicator position
    function updateTabIndicator() {
        const $activeTab = $('.settings-tab.active');
        const $indicator = $('.tab-indicator');

        if ($activeTab.length && $indicator.length) {
            const tabsContainer = $('.settings-tabs');
            const containerLeft = tabsContainer.offset().left;
            const tabLeft = $activeTab.offset().left;
            const tabWidth = $activeTab.outerWidth();
            const relativeLeft = tabLeft - containerLeft;

            $indicator.css({
                'left': relativeLeft + 'px',
                'width': tabWidth + 'px'
            });
        }
    }

    // Tab switching
    $('.settings-tab').on('click', function() {
        const tabName = $(this).data('tab');

        // Update tab buttons
        $('.settings-tab').removeClass('active');
        $(this).addClass('active');

        // Animate tab indicator
        updateTabIndicator();

        // Update tab content
        $('.settings-tab-content').removeClass('active');
        if (tabName === 'appearance') {
            $('#appearanceTab').addClass('active');
        } else if (tabName === 'background') {
            $('#backgroundTab').addClass('active');
            // Initialize preview when tab is opened
            setTimeout(() => {
                initBackgroundPreview();
            }, 100);
        } else if (tabName === 'cards') {
            $('#cardsTab').addClass('active');
            populateCardList();
        }
    });

    // Initialize indicator position on load
    setTimeout(updateTabIndicator, 50);

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
