# WeatherPane Project - Complete Card Analysis

## Project Overview
WeatherPane is a weather information dashboard built with jQuery, Muuri (for grid management), and various astronomy/weather APIs. It uses Open-Meteo for weather and SunCalc for astronomical calculations.

---

## 1. CARDS INVENTORY

### Today Cards:
1. **Solar Noon** (`#solarNoonCard`) - Shows solar noon time with altitude/azimuth details
2. **Sunset** (`#sunsetCard`) - Shows sunset time with dusk progression details
3. **Night Start** (`#nightCard`) - Shows astronomical night start time
4. **Moon** (`#moonCard`) - Shows moon phase with phase slider TEST MODE
5. **Astronomical Events** (`#astronomicalEventsCard`) - Shows next astronomical events
6. **Daylight** (`#dayProgressCard`) - Shows daylight progress bar
7. **Season** (`#seasonCard`) - Shows current season and next seasonal event
8. **Sunrise** (`#sunriseCard`) - Shows today's sunrise time
9. **Weather (Current)** (`#currentWeatherCard`) - Shows current temp with **F/C toggle badge**

### Tomorrow Cards:
1. **Sunrise (Tomorrow)** (`#sunriseTomorrowCard`) - Tomorrow's sunrise
2. **Sunset (Tomorrow)** (`#sunsetTomorrowCard`) - Tomorrow's sunset
3. **Night Start (Tomorrow)** (`#nightTomorrowCard`) - Tomorrow's astronomical night
4. **Weather (Tomorrow)** (`#weatherTomorrowCard`) - Tomorrow's forecast with **F/C toggle badge**

**Total: 13 cards** (9 today + 4 tomorrow-specific)

---

## 2. CARDS WITH "TOMORROW" VERSIONS

These card pairs exist for both today and tomorrow:

| Card Type | Today Card ID | Tomorrow Card ID |
|-----------|--------------|-----------------|
| Sunrise | `#sunriseCard` | `#sunriseTomorrowCard` |
| Sunset | `#sunsetCard` | `#sunsetTomorrowCard` |
| Night Start | `#nightCard` | `#nightTomorrowCard` |
| Weather | `#currentWeatherCard` | `#weatherTomorrowCard` |

**Note:** Solar Noon, Moon, Astronomical Events, Daylight, and Season do NOT have tomorrow versions (they are repeating daily/cyclical phenomena).

---

## 3. EXISTING TOGGLE BADGES

### A. Temperature Unit Toggle (F/C Badge)

**Purpose:** Switch between Celsius and Fahrenheit temperature display

**HTML Structure:**
```html
<!-- Current Weather Card -->
<span class="status-badge" id="tempUnitBadge">°C</span>

<!-- Tomorrow Weather Card -->
<span class="status-badge" id="tempUnitBadgeTomorrow">°C</span>
```

**Click Handler (grid.js, lines 360-387):**
```javascript
// Set up temperature toggle click handler on badge
$('#tempUnitBadge').on('click', function (e) {
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
```

**Toggle Function (weather.js, lines 180-188):**
```javascript
function toggleTemperatureUnit() {
    temperatureUnit = temperatureUnit === 'C' ? 'F' : 'C';
    localStorage.setItem('temperatureUnit', temperatureUnit);
    localStorage.setItem('weatherPane:tempUnit', temperatureUnit);
    updateTemperatureDisplay();
    updateTomorrowTemperatureDisplay();
    updateWeatherDetail();
    console.log(`[Temperature] Toggled to ${temperatureUnit}`);
}
```

**Update Functions:**
- `updateTemperatureDisplay()` - Updates current temp display + badge text
- `updateTomorrowTemperatureDisplay()` - Updates tomorrow's temp display
- `updateWeatherDetail()` - Updates "feels like" temperature

**CSS Styling (style.css, lines 299-342):**
```css
.card .status-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 11px;
    font-weight: 700;
    color: color-mix(in srgb, var(--text) 50%, transparent 50%);
    background: color-mix(in srgb, var(--text) 8%, transparent 92%);
    border: 1px solid color-mix(in srgb, var(--text) 12%, transparent 88%);
    padding: 3px 7px;
    border-radius: 6px;
    cursor: pointer;
    pointer-events: auto;
    transition: all 0.15s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.card .status-badge:hover {
    background: color-mix(in srgb, var(--text) 12%, transparent 88%);
    border-color: color-mix(in srgb, var(--text) 20%, transparent 80%);
    color: color-mix(in srgb, var(--text) 70%, transparent 30%);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent 70%);
}
```

### B. Moon Phase Slider Toggle (Chevron Badge)

**Purpose:** Reveal/hide moon phase test slider for testing lunar cycles

**HTML Structure:**
```html
<span class="status-badge moon-test-badge" id="moonTestBadge" title="Test moon phases">
    <i class="fa-solid fa-chevron-down"></i>
</span>
```

**Click Handler (grid.js, lines 235-261):**
```javascript
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
        }, 350);
    }
});
```

**Expanded Content (card_special.css, lines 27-48):**
```css
/* Moon slider - hidden by default, revealed when badge clicked */
.moon-test-slider {
    background: rgba(255, 255, 255, 0.05);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    padding: 0 16px;
    transition: max-height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1),
        opacity 0.3s cubic-bezier(0.4, 0.0, 0.2, 1),
        padding 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.card.moon-test-active .moon-test-slider {
    max-height: 80px;
    opacity: 1;
    padding: 12px 16px;
}
```

---

## 4. CARD STRUCTURE & RENDERING

### Basic Card DOM Structure:
```html
<article class="card" id="[CARD_ID]" data-card="[CARD_TYPE]" tabindex="0" role="button" aria-expanded="false">
    <!-- Optional status badge (F/C toggle or test mode) -->
    <span class="status-badge" id="[BADGE_ID]">°C</span>
    
    <!-- Summary section (always visible) -->
    <div class="card-summary">
        <h3>[Card Title]</h3>
        <div class="row">
            <div class="metric"><span class="value" id="[VALUE_ID]">—</span><small>[UNIT]</small></div>
            <span class="pill" id="[PILL_ID]">—</span>
        </div>
        <div class="kicker" id="[KICKER_ID]">—</div>
    </div>
    
    <!-- Detail section (shown on expand) -->
    <div class="card-detail">
        <div class="detail-grid">
            <div>
                <span class="detail-label">Label</span>
                <span class="detail-value" id="[DETAIL_ID]">—</span>
            </div>
            <!-- More detail rows... -->
        </div>
    </div>
    
    <!-- Card-specific features (e.g., moon slider) -->
    <div class="moon-test-slider" id="moonTestSlider">...</div>
</article>
```

### Card CSS Classes:
- `.card` - Base card styling
- `.expanded` - Applied when card is expanded (detail visible)
- `.card-dimmed` - Applied to non-expanded cards when another is expanded
- `.moon-test-active` - Moon card specific, shows slider
- `.animate-click` - Temporary scale animation on badge click
- `.blinking` - Applied in edit mode to visible cards

### Card Expansion Logic (grid.js, lines 73-155):
```javascript
function applyCardExpansion(newId) {
    expandedCardId = newId;
    $('body').toggleClass('card-expanded', Boolean(newId));
    
    // Apply 'expanded' class to the clicked card
    // Apply 'card-dimmed' to others with distance-based blur
    // Triggers Muuri layout refresh
}
```

### Grid Layout (Muuri):
- Uses **2-column responsive grid** on desktop
- Single column on mobile
- Drag-and-drop reordering in **edit mode**
- Card order persisted to localStorage
- Card visibility managed via localStorage

---

## 5. KEY FILES FOR CARD COMPONENTS

| File | Purpose | Lines |
|------|---------|-------|
| `/Users/futur3sn0w/Documents/WeatherPane/index.html` | Card HTML markup | 192-637 |
| `/Users/futur3sn0w/Documents/WeatherPane/js/grid.js` | Card interaction handlers, badge clicks | Entire file |
| `/Users/futur3sn0w/Documents/WeatherPane/js/weather.js` | Temperature toggle logic & display | Lines 93-188 |
| `/Users/futur3sn0w/Documents/WeatherPane/js/main.js` | Card data population from APIs | Entire file |
| `/Users/futur3sn0w/Documents/WeatherPane/js/settings.js` | Card visibility management | Lines 259-314 |
| `/Users/futur3sn0w/Documents/WeatherPane/css/style.css` | Card styling, badges, expansion | Lines 199-379+ |
| `/Users/futur3sn0w/Documents/WeatherPane/css/card_special.css` | Moon & season card styles | Entire file |

---

## 6. HOW TOGGLE BADGES WORK - IMPLEMENTATION PATTERN

### Pattern Summary:
1. **Badge HTML**: Positioned absolutely (`top: 12px; right: 12px;`) within card
2. **Click Handler**: 
   - Stop propagation to prevent card expansion
   - Apply temporary animation class
   - Call toggle/update functions
   - Update DOM with new values
3. **State Management**:
   - Temperature unit stored in `localStorage`
   - Moon test mode stored in card's CSS class
4. **Display Update**:
   - Immediately update visible text/values
   - Re-render card details if needed
   - Trigger Muuri layout refresh if card size changes

### Design Principles:
- Badges use `pointer-events: auto` to capture clicks over card
- CSS transitions for smooth hover/active states
- `color-mix()` function for theme-aware colors
- No page reload needed; all changes are client-side

---

## 7. TEMPERATURE UNIT TOGGLE FLOW

```
Badge Click
    ↓
grid.js: stopPropagation()
    ↓
Add animate-click class (brief scale animation)
    ↓
weather.js: toggleTemperatureUnit()
    ├─ Toggle temperatureUnit variable (C ↔ F)
    ├─ Save to localStorage
    └─ Call update functions:
       ├─ updateTemperatureDisplay() → updates #temp and badge text
       ├─ updateTomorrowTemperatureDisplay() → updates #tempTomorrow
       └─ updateWeatherDetail() → updates feels-like temperature
    ↓
DOM Updated Immediately (no API call needed)
```

---

## 8. MOON SLIDER TOGGLE FLOW

```
Chevron Badge Click
    ↓
grid.js: stopPropagation()
    ↓
Toggle .moon-test-active class on card
    ↓
Update chevron icon (down ↔ up)
    ↓
If closing slider:
    └─ Reset moon icon to live data
    ↓
Refresh Muuri layout (card height changed)
```

---

## 9. CARD DATA FLOW

### Initialization:
1. **index.html** defines card HTML structure
2. **main.js**: Fetches weather/astronomy data via APIs
3. **Populates card elements** with jQuery (e.g., `$('#temp').text(...)`)
4. **grid.js**: Initializes Muuri grid, card handlers

### Updates:
- Temperature toggle: Recalculates/redisplays without API call
- Time slider: Updates sun position and card details
- Card expand/collapse: CSS + Muuri layout refresh
- Edit mode: Toggle drag-and-drop, show delete badges

---

## 10. DATA STORAGE

### localStorage Keys Used:
- `weatherPane:tempUnit` - Temperature unit (C/F)
- `temperatureUnit` - Alias for above
- `weatherPane:cardOrder` - Muuri card order
- `weatherPane:hiddenCards` - Array of hidden card IDs
- `weatherPane:themeMode` - Theme mode (auto/light/dark)
- `weatherPane:themeColor` - Accent color
- `weatherPane:cloudState` - Cloud effect state
- `weatherPane:sceneOverride` - Background scene
- `weatherPane:lastLocation` - Cached geolocation
- `weatherPane:weather:LAT:LON` - Cached weather data

---

## 11. API DATA SOURCES

- **Open-Meteo** (https://open-meteo.com/) - Weather forecasts, daily data
- **SunCalc** (https://github.com/mourner/suncalc) - Moon phases, sun times, astronomy
- **Geocoding API** (open-meteo.com) - ZIP code to coordinates

All data is fetched on initialization and cached locally. No real-time updates.

