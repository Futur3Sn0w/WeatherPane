# Weather-Based Cloud System

The cloud implementation now dynamically responds to actual weather conditions!

---

## How It Works

### 1. Weather Data Collection

**File**: [js/main.js:73](js/main.js#L73)
```javascript
current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,apparent_temperature,cloud_cover'
```

The API fetches `cloud_cover` (0-100%) from Open-Meteo weather service.

**File**: [js/main.js:405](js/main.js#L405)
```javascript
currentCloudCover = typeof c.cloud_cover === 'number' ? c.cloud_cover : null;
```

### 2. Scene Context Calculation

**File**: [js/scene-manager.js:157-202](js/scene-manager.js#L157-L202)

The `computeSceneContext()` function determines which scene to show and calculates intensity:

```javascript
const cloudCover = typeof currentCloudCover === 'number' ? currentCloudCover : 0;
let intensity = Math.max(0.3, cloudCover / 100);
```

**Scene Selection Logic:**

| Condition | Scene | Intensity | Example |
|-----------|-------|-----------|---------|
| `cloudCover > 60%` | Cloudy | Based on cloudCover | Overcast day |
| `CLOUDY_CODES` or `cloudCover > 55%` | Cloudy | max(intensity, 0.75) | Partly cloudy |
| `FOG_CODES` | Cloudy | 0.9 | Foggy conditions |
| `RAIN_CODES` | Rain | 0.65 or 1.0 | Rainy weather |
| `SNOW_CODES` | Rain (snow variant) | 0.7 | Snowy weather |
| Otherwise | Clear | 0.4 (day) / 0.5 (night) | Clear skies |

**Weather Codes:**
- `RAIN_CODES`: {51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99}
- `SNOW_CODES`: {71,73,75,77,85,86}
- `FOG_CODES`: {45,48}
- `CLOUDY_CODES`: {2,3}

### 3. Cloud Rendering

**File**: [js/threejs-volumetric-clouds.js](js/threejs-volumetric-clouds.js)

The shader now uses **two parameters**:

#### `cloudDensity` (from intensity)
Controls the overall opacity and thickness of clouds.
- Low (0.3-0.5): Thin, wispy clouds
- Medium (0.5-0.8): Normal cloud density
- High (0.8-1.4): Thick, heavy clouds

#### `cloudCoverage` (from cloudCover %)
Controls how much of the sky is covered with clouds.
- **0-30% coverage**: High threshold (0.65) = Only dense noise becomes visible = **Sparse, scattered clouds**
- **30-70% coverage**: Medium threshold (0.4-0.5) = **Partial coverage**
- **70-100% coverage**: Low threshold (0.15) = Even light noise is visible = **Full cloud coverage**

**Shader Logic** ([lines 184-188](js/threejs-volumetric-clouds.js#L184-L188)):
```glsl
// Dynamic threshold based on cloud coverage
float coverageThreshold = 0.65 - (cloudCoverage * 0.5); // 0.65 (sparse) to 0.15 (full)
density = smoothstep(coverageThreshold, coverageThreshold + 0.3, density);
```

---

## Visual Examples

### Partly Cloudy (30% cloud cover)
```
cloudCover: 30%
intensity: 0.3
cloudCoverage: 0.3 (30/100)
threshold: 0.65 - (0.3 * 0.5) = 0.5

Result: Scattered wispy clouds across the sky
```

### Mostly Cloudy (75% cloud cover)
```
cloudCover: 75%
intensity: 0.75
cloudCoverage: 0.75 (75/100)
threshold: 0.65 - (0.75 * 0.5) = 0.275

Result: Nearly full coverage with some breaks
```

### Overcast (95% cloud cover)
```
cloudCover: 95%
intensity: 0.95
cloudCoverage: 0.95 (95/100)
threshold: 0.65 - (0.95 * 0.5) = 0.175

Result: Complete cloud coverage, heavy and thick
```

### Clear Day (5% cloud cover)
```
cloudCover: 5%
intensity: 0.4 (default for clear)
cloudCoverage: 0.05 (5/100)
threshold: 0.65 - (0.05 * 0.5) = 0.625

Result: Maybe 1-2 small clouds, mostly clear sky
```

---

## Data Flow Diagram

```
Weather API (Open-Meteo)
    ↓
cloud_cover (0-100%)
    ↓
main.js → currentCloudCover
    ↓
scene-manager.js → computeSceneContext()
    ├─ intensity = max(0.3, cloudCover / 100)
    ├─ sceneId = 'cloudy' (if applicable)
    └─ context = { intensity, cloudCover, sceneId, ... }
        ↓
CloudyScene.setContext(context)
    ↓
cloudEngine.updateOptions(context)
    ↓
ThreeJSVolumetricClouds
    ├─ cloudDensity uniform = intensity
    └─ cloudCoverage uniform = cloudCover / 100
        ↓
Fragment Shader
    ├─ Generates noise-based cloud patterns
    ├─ Applies dynamic threshold based on cloudCoverage
    └─ Renders realistic clouds matching weather conditions
```

---

## Testing Cloud Coverage

You can manually test different cloud coverage values in the browser console:

```javascript
// Simulate partly cloudy (30%)
currentCloudCover = 30;
refreshBackgroundScene();

// Simulate overcast (90%)
currentCloudCover = 90;
refreshBackgroundScene();

// Simulate clear (5%)
currentCloudCover = 5;
refreshBackgroundScene();
```

**Monitor the effect:**
```javascript
// Check current values
console.log('Cloud Cover:', currentCloudCover);
console.log('Scene ID:', document.querySelector('#cloudLayer')?.__sceneId);
```

---

## Color Variations by Mode

**Light Mode** ([lines 233-236](js/threejs-volumetric-clouds.js#L233-L236)):
```javascript
cloudColor: 0xb8b8b8,      // Light grey for better contrast
cloudShadowColor: 0x788898, // Darker bluish grey
```

**Dark Mode** ([lines 241-244](js/threejs-volumetric-clouds.js#L241-L244)):
```javascript
cloudColor: 0x3c506e,       // Muted blue
cloudShadowColor: 0x192332, // Very dark blue
```

---

## Advanced: Custom Weather Scenes

The system is designed to support different scenes based on weather conditions. Currently active scenes:

| Scene ID | Description | Trigger |
|----------|-------------|---------|
| `clear-day` | Sun rays and light effects | Weather code 0-1, low cloud cover, daytime |
| `cloudy` | Volumetric cloud rendering | Weather code 2-3, cloud cover > 55%, fog |
| `rain` | Rain particle animation | Rain weather codes (61-67, etc.) |
| `rain` (snow variant) | Snow particle animation | Snow weather codes (71-77, etc.) |
| `night-clear` | Starry sky | Clear conditions at night |

### Adding New Scenes

To add more granular weather scenes, edit [js/scene-manager.js:157-202](js/scene-manager.js#L157-L202):

```javascript
// Example: Separate scene for partly cloudy
if (cloudCover >= 25 && cloudCover < 55) {
    sceneId = 'partly-cloudy';  // New scene type
    intensity = cloudCover / 100;
}
```

Then register the new scene in [js/scene-manager.js:12-15](js/scene-manager.js#L12-L15):

```javascript
this.scenes = {
    'clear-day': ClearDayScene,
    'cloudy': CloudyScene,
    'partly-cloudy': PartlyCloudyScene,  // New scene class
    'rain': RainScene,
    'night-clear': StarryNightScene
};
```

---

## Performance Considerations

The weather-based cloud system has minimal performance impact:

- ✅ Cloud coverage changes are **uniform updates only** (no geometry changes)
- ✅ Shader calculations remain constant regardless of coverage
- ✅ No additional texture loading or mesh creation
- ✅ Real-time updates when weather data refreshes

**Update Frequency:**
Weather data (including `cloud_cover`) refreshes every **10 minutes** by default ([main.js:443](js/main.js#L443)).

---

## Summary

Your cloud system now:

✅ **Reads real cloud cover data** from weather API (0-100%)
✅ **Adjusts cloud density** based on weather intensity
✅ **Controls sky coverage** dynamically (sparse to full coverage)
✅ **Matches visual appearance** to actual weather conditions
✅ **Supports all weather codes** (clear, cloudy, rain, snow, fog)
✅ **Updates automatically** when weather data refreshes

The clouds you see now accurately reflect the actual cloud coverage in your location! 🌤️☁️🌧️
