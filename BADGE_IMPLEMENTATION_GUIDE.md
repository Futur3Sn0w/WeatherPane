# Toggle Badge Implementation Quick Reference

## What are Toggle Badges?
Interactive elements positioned on cards that allow quick state changes without expanding the card or reloading data.

---

## Existing Implementation Examples

### 1. Temperature Unit Badge (F/C Toggle)

**Where it appears:**
- Current Weather Card (`#currentWeatherCard`)
- Tomorrow Weather Card (`#weatherTomorrowCard`)

**What it does:**
- Toggles between Celsius (°C) and Fahrenheit (°F)
- Updates all temperature displays across both cards
- Persists choice to localStorage

**Files involved:**
- HTML: `/Users/futur3sn0w/Documents/WeatherPane/index.html` (lines 480, 609)
- JavaScript: `/Users/futur3sn0w/Documents/WeatherPane/js/grid.js` (lines 360-387)
- JavaScript: `/Users/futur3sn0w/Documents/WeatherPane/js/weather.js` (lines 180-188)
- CSS: `/Users/futur3sn0w/Documents/WeatherPane/css/style.css` (lines 299-342)

**Implementation checklist:**
```
[✓] HTML <span> with class="status-badge" and unique id
[✓] Position: absolute, top-right corner (via CSS)
[✓] Click handler with e.stopPropagation()
[✓] Toggle function that updates localStorage
[✓] Display update function(s)
[✓] CSS for hover/active states
[✓] Smooth transitions
[✓] Animation class on click (optional but nice)
```

---

### 2. Moon Phase Slider Badge (Chevron Toggle)

**Where it appears:**
- Moon Card (`#moonCard`)

**What it does:**
- Reveals/hides a moon phase test slider
- Allows manual testing of moon phases
- Updates moon visualization in real-time
- Reverts to live data when closed

**Files involved:**
- HTML: `/Users/futur3sn0w/Documents/WeatherPane/index.html` (lines 292-342)
- JavaScript: `/Users/futur3sn0w/Documents/WeatherPane/js/grid.js` (lines 235-261)
- CSS: `/Users/futur3sn0w/Documents/WeatherPane/css/card_special.css` (lines 27-48)

**Implementation checklist:**
```
[✓] HTML <span> with class="status-badge moon-test-badge"
[✓] Icon inside badge (Font Awesome chevron)
[✓] Click handler with e.stopPropagation()
[✓] Toggle CSS class on card (.moon-test-active)
[✓] Toggle icon (chevron-down ↔ chevron-up)
[✓] Show/hide hidden content with CSS
[✓] Reset state when closed
[✓] Trigger Muuri layout refresh (if size changes)
```

---

## Step-by-Step: Adding a New Toggle Badge

### Step 1: Add HTML Badge
```html
<span class="status-badge" id="myToggleBadge">STATE</span>
```

Or with icon:
```html
<span class="status-badge" id="myToggleBadge" title="Toggle description">
    <i class="fa-solid fa-icon-name"></i>
</span>
```

### Step 2: Define Click Handler (in grid.js)
```javascript
$panel.on('click', '#myToggleBadge', function (e) {
    e.stopPropagation();  // Don't expand the card
    
    const $card = $(this).closest('.card');
    
    // Animate the card (optional)
    $card.addClass('animate-click');
    setTimeout(() => {
        $card.removeClass('animate-click');
    }, 150);
    
    // Toggle your state
    toggleMyFeature();
});
```

### Step 3: Create Toggle Function
```javascript
function toggleMyFeature() {
    // Get current state
    const currentState = localStorage.getItem('weatherPane:myFeature') || 'off';
    const newState = currentState === 'on' ? 'off' : 'on';
    
    // Save new state
    localStorage.setItem('weatherPane:myFeature', newState);
    
    // Update displays
    updateMyFeatureDisplay();
    
    // Log for debugging
    console.log(`[Feature] Toggled to ${newState}`);
}
```

### Step 4: Create Display Update Function
```javascript
function updateMyFeatureDisplay() {
    const state = localStorage.getItem('weatherPane:myFeature') || 'off';
    const $badge = $('#myToggleBadge');
    
    // Update badge text or class
    $badge.text(state === 'on' ? 'ON' : 'OFF');
    
    // Update card displays
    if (state === 'on') {
        // Show/update content
        $('#myCardDetail').text('Feature enabled data');
    } else {
        // Hide or reset content
        $('#myCardDetail').text('Feature disabled');
    }
}
```

### Step 5: Add CSS Styling
```css
.card .status-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--text) 8%, transparent 92%);
    border: 1px solid color-mix(in srgb, var(--text) 12%, transparent 88%);
    color: color-mix(in srgb, var(--text) 50%, transparent 50%);
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

.card .status-badge:active {
    transform: scale(0.95);
}
```

### Step 6: Initialize on Page Load
In `initCardHandlers()` function in grid.js, add:
```javascript
// Initialize your badge click handler
$panel.on('click', '#myToggleBadge', function (e) {
    // ... handler code ...
});
```

Or call your display function in `main.js` after page load:
```javascript
// After all data is loaded
updateMyFeatureDisplay();
```

---

## Common Patterns

### Pattern 1: Simple Toggle (On/Off)
```javascript
let featureEnabled = localStorage.getItem('weatherPane:feature') === 'true';

function toggleFeature() {
    featureEnabled = !featureEnabled;
    localStorage.setItem('weatherPane:feature', featureEnabled);
    updateFeatureDisplay();
}
```

### Pattern 2: Cycle Through States (A → B → C → A)
```javascript
const states = ['state-a', 'state-b', 'state-c'];
let currentIndex = states.indexOf(
    localStorage.getItem('weatherPane:state') || 'state-a'
);

function cycleState() {
    currentIndex = (currentIndex + 1) % states.length;
    localStorage.setItem('weatherPane:state', states[currentIndex]);
    updateStateDisplay();
}
```

### Pattern 3: Reveal/Hide Content (like Moon Slider)
```html
<span class="status-badge" id="myToggle">
    <i class="fa-solid fa-chevron-down"></i>
</span>
<div id="myContent" class="hidden-content">
    <!-- Content to reveal -->
</div>
```

```javascript
$panel.on('click', '#myToggle', function (e) {
    e.stopPropagation();
    const $card = $(this).closest('.card');
    const $icon = $(this).find('i');
    
    $card.toggleClass('content-active');
    
    if ($card.hasClass('content-active')) {
        $icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
    } else {
        $icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
    }
    
    // Refresh Muuri if content size changed
    if (muuriGrid) {
        setTimeout(() => {
            muuriGrid.refreshItems();
            muuriGrid.layout();
        }, 350);
    }
});
```

```css
.hidden-content {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    transition: max-height 0.3s ease, opacity 0.3s ease;
}

.card.content-active .hidden-content {
    max-height: 200px;
    opacity: 1;
}
```

---

## Best Practices

1. **Always stop propagation**: `e.stopPropagation()` prevents card expansion
2. **Use localStorage for persistence**: Survives page refresh
3. **Provide visual feedback**: Hover states, animations, icon changes
4. **Update all related displays**: Don't forget related cards or details
5. **Log state changes**: Helps with debugging
6. **Handle Muuri refresh**: If card size changes, call grid refresh
7. **Use consistent naming**: `status-badge` class should be universal
8. **Theme-aware colors**: Use CSS `color-mix()` for theme compatibility
9. **Keyboard accessible**: Consider adding keyboard handlers if needed
10. **Document the feature**: Clear comments in code

---

## Debugging Tips

```javascript
// Check localStorage value
console.log('State:', localStorage.getItem('weatherPane:myFeature'));

// Check if handler is attached
$(document).off('click', '#myBadge'); // Clear old handlers first
$panel.on('click', '#myBadge', function() {
    console.log('Badge clicked!');
});

// Check if icon class toggle worked
console.log('Icon classes:', $('#myBadge i').attr('class'));

// Check Muuri state
console.log('Muuri grid:', window.muuriGrid);
```

---

## Temperature Badge Code Reference

Quick copy-paste reference for the working temperature badge:

**HTML:**
```html
<span class="status-badge" id="tempUnitBadge">°C</span>
```

**JavaScript (grid.js):**
```javascript
$('#tempUnitBadge').on('click', function (e) {
    e.stopPropagation();
    const $card = $('#currentWeatherCard');
    $card.addClass('animate-click');
    setTimeout(() => { $card.removeClass('animate-click'); }, 150);
    toggleTemperatureUnit();
});
```

**JavaScript (weather.js):**
```javascript
function toggleTemperatureUnit() {
    temperatureUnit = temperatureUnit === 'C' ? 'F' : 'C';
    localStorage.setItem('temperatureUnit', temperatureUnit);
    localStorage.setItem('weatherPane:tempUnit', temperatureUnit);
    updateTemperatureDisplay();
    updateTomorrowTemperatureDisplay();
    updateWeatherDetail();
}

function updateTemperatureDisplay() {
    const tempValue = temperatureUnit === 'C'
        ? Math.round(currentTempCelsius)
        : Math.round(celsiusToFahrenheit(currentTempCelsius));
    $('#temp').text(tempValue);
    $('#tempUnitBadge').text(`°${temperatureUnit}`);
}
```

---

## File Locations Summary

- Badge HTML: `/Users/futur3sn0w/Documents/WeatherPane/index.html`
- Card JavaScript handlers: `/Users/futur3sn0w/Documents/WeatherPane/js/grid.js`
- Feature toggle logic: `/Users/futur3sn0w/Documents/WeatherPane/js/weather.js` (or similar)
- Styling: `/Users/futur3sn0w/Documents/WeatherPane/css/style.css`
- Card-specific CSS: `/Users/futur3sn0w/Documents/WeatherPane/css/card_special.css`

