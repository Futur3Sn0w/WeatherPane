# WeatherPane Cards Documentation

Complete analysis and implementation guides for WeatherPane cards and toggle badges.

## Quick Navigation

This documentation package contains everything you need to understand and extend WeatherPane's card system:

### 1. **CARDS_QUICK_REFERENCE.txt**
   - Visual, formatted reference of all 13 cards
   - Quick lookup for card IDs, badges, and details
   - Card DOM structure overview
   - Edit mode reference
   - **Start here for a quick overview**

### 2. **CARD_ANALYSIS.md**
   - Comprehensive card inventory
   - Cards with "tomorrow" versions (4 pairs)
   - Existing toggle badges (2 types)
   - Card structure and rendering
   - Complete file listing with line numbers
   - Toggle badge implementation patterns
   - Data flow and storage details
   - API data sources
   - **Read this for deep understanding**

### 3. **BADGE_IMPLEMENTATION_GUIDE.md**
   - Step-by-step guide to add new toggle badges
   - Detailed patterns and code examples
   - Best practices and debugging tips
   - Working code references for temperature badge
   - Common implementation patterns (toggle, cycle, reveal)
   - **Use this when implementing new features**

---

## Cards at a Glance

**13 Total Cards** (9 today + 4 tomorrow-specific)

### Cards with Badge Interactions:
1. **Weather Card** - Temperature unit badge (F/C toggle)
   - Affects: Current weather + tomorrow weather
   - Handler: `/js/grid.js` lines 360-387
   - Function: `toggleTemperatureUnit()` in `/js/weather.js`

2. **Moon Card** - Phase slider badge (chevron toggle)
   - Reveals: Interactive moon phase test slider
   - Handler: `/js/grid.js` lines 235-261
   - Classes: `.moon-test-active`, `.moon-test-slider`

---

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Card HTML markup (lines 192-637) |
| `js/grid.js` | Badge click handlers, card expansion |
| `js/weather.js` | Temperature unit toggle logic |
| `js/main.js` | Data fetching and card population |
| `js/settings.js` | Card visibility management |
| `css/style.css` | Card base styles, badges, expansion |
| `css/card_special.css` | Moon and season card styles |

---

## Understanding Toggle Badges

### What They Do
Toggle badges are interactive buttons on cards that:
- Toggle state without expanding the card
- Update displays immediately
- Persist state to localStorage
- Don't require API calls

### How They Work
1. **Click**: User clicks badge
2. **Prevent Expansion**: `e.stopPropagation()` stops card expand
3. **Toggle State**: JavaScript function updates state
4. **Update Display**: All related text/values updated
5. **Persist**: State saved to localStorage

### Examples in WeatherPane
- **F/C Toggle**: Click badge → toggle temperature unit → update all temps
- **Moon Slider**: Click chevron → reveal/hide test slider → update moon visualization

---

## Adding a New Toggle Badge

### Quick Checklist
```
1. Add HTML badge with unique ID
2. Create click handler in grid.js
3. Create toggle function (update localStorage)
4. Create display update function
5. Add CSS styling (already have base styles)
6. Call display function on page load
```

### Minimal Example
```html
<!-- Step 1: HTML -->
<span class="status-badge" id="myBadge">STATE</span>
```

```javascript
// Step 2-4: JavaScript
$panel.on('click', '#myBadge', function(e) {
    e.stopPropagation();
    toggleMyFeature();
});

function toggleMyFeature() {
    const state = localStorage.getItem('weatherPane:myFeature') || 'off';
    const newState = state === 'on' ? 'off' : 'on';
    localStorage.setItem('weatherPane:myFeature', newState);
    updateMyDisplay();
}

function updateMyDisplay() {
    const state = localStorage.getItem('weatherPane:myFeature') || 'off';
    $('#myBadge').text(state === 'on' ? 'ON' : 'OFF');
    // Update card content...
}
```

```css
/* Step 5: CSS (mostly inherited) */
.card .status-badge {
    /* Already defined in style.css */
}
```

---

## Card Structure

All cards follow this HTML pattern:

```html
<article class="card" id="[CARD_ID]" data-card="[TYPE]" 
         tabindex="0" role="button" aria-expanded="false">
    
    <!-- Optional badge -->
    <span class="status-badge" id="[BADGE_ID]">TEXT</span>
    
    <!-- Always visible -->
    <div class="card-summary">
        <h3>[Title]</h3>
        <div class="row">
            <div class="metric">
                <span class="value" id="[VALUE_ID]">—</span>
                <small>[UNIT]</small>
            </div>
            <span class="pill" id="[PILL_ID]">—</span>
        </div>
        <div class="kicker" id="[KICKER_ID]">—</div>
    </div>
    
    <!-- Shown on expand -->
    <div class="card-detail">
        <div class="detail-grid">
            <div>
                <span class="detail-label">Label</span>
                <span class="detail-value" id="[VALUE_ID]">—</span>
            </div>
        </div>
    </div>
    
    <!-- Optional special content -->
    <div class="special-section">...</div>
</article>
```

---

## CSS Classes

**Card states:**
- `.card` - Base styling
- `.expanded` - Detail section visible
- `.card-dimmed` - Other cards when one expanded
- `.card-expanded` - Body class when any expanded

**Badge styling:**
- `.status-badge` - Base badge styling
- `.status-badge:hover` - Hover effect
- `.status-badge:active` - Press effect
- `.moon-test-badge` - Moon-specific badge variant
- `.animate-click` - Temporary scale animation

**Moon-specific:**
- `.moon-test-active` - Slider is visible
- `.moon-test-slider` - The slider container

---

## Data Flow

### On Page Load
1. Fetch location (geolocation or ZIP code)
2. Fetch weather data (Open-Meteo API)
3. Fetch astronomy data (SunCalc library)
4. Populate card elements with jQuery
5. Initialize Muuri grid for drag-and-drop
6. Initialize card event handlers

### On Toggle Badge Click
1. Stop card expansion
2. Update state in localStorage
3. Call display update function(s)
4. Update DOM elements immediately
5. No API call needed

### On Card Expand
1. Add `.expanded` class to clicked card
2. Add `.card-dimmed` to other cards
3. Apply distance-based blur filter
4. Show `.card-detail` section below
5. Trigger Muuri layout refresh

---

## localStorage Keys

WeatherPane uses localStorage for persistence:

- `weatherPane:tempUnit` - Temperature unit (C/F)
- `weatherPane:cardOrder` - Muuri grid card order
- `weatherPane:hiddenCards` - Hidden card IDs array
- `weatherPane:themeMode` - Light/dark/auto
- `weatherPane:themeColor` - Accent color
- `weatherPane:cloudState` - Cloud effect state
- `weatherPane:sceneOverride` - Background scene
- `weatherPane:lastLocation` - Cached location
- `weatherPane:weather:LAT:LON` - Cached weather data

---

## Common Tasks

### Update All Related Cards on Badge Click
```javascript
function toggleTemperatureUnit() {
    temperatureUnit = temperatureUnit === 'C' ? 'F' : 'C';
    localStorage.setItem('weatherPane:tempUnit', temperatureUnit);
    
    // Update both weather cards
    updateTemperatureDisplay();      // Current weather
    updateTomorrowTemperatureDisplay(); // Tomorrow weather
    updateWeatherDetail();            // Feels like, etc.
}
```

### Reveal/Hide Content
```javascript
$card.toggleClass('moon-test-active');
$icon.toggleClass('fa-chevron-down fa-chevron-up');

// Refresh grid if size changes
muuriGrid.refreshItems();
muuriGrid.layout();
```

### Persist and Restore State
```javascript
// Save
localStorage.setItem('weatherPane:myFeature', state);

// Load
const saved = localStorage.getItem('weatherPane:myFeature') || 'default';
```

---

## Testing Toggle Badges

### In Browser Console
```javascript
// Check if handler is attached
$('#tempUnitBadge').trigger('click'); // Manually trigger
console.log(localStorage.getItem('weatherPane:tempUnit')); // Check state

// Reset state for testing
localStorage.removeItem('weatherPane:tempUnit');
location.reload();
```

### Common Issues
- **Badge doesn't respond**: Check `e.stopPropagation()` in handler
- **State doesn't persist**: Check localStorage key spelling
- **Display doesn't update**: Check jQuery selectors match HTML IDs
- **Grid breaks**: Might need to call `muuriGrid.layout()` if size changes

---

## Resources

- **SunCalc Library**: https://github.com/mourner/suncalc
- **Open-Meteo API**: https://open-meteo.com/
- **Muuri Grid**: https://muuri.dev/
- **Font Awesome Icons**: https://fontawesome.com/

---

## Questions?

Refer to the detailed guides:
- **CARDS_QUICK_REFERENCE.txt** - Quick lookups
- **CARD_ANALYSIS.md** - Deep dive into architecture
- **BADGE_IMPLEMENTATION_GUIDE.md** - Step-by-step implementation

Each file contains line numbers and exact code references for easy navigation.
