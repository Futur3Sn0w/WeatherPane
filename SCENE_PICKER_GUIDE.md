# Background Scene Picker Guide

The Settings UI now includes granular cloud coverage options while maintaining full automatic weather-based functionality.

---

## Scene Options

### 🪄 Automatic (Default)
**Value**: `auto`

Uses real weather data to automatically select and configure the scene:
- Reads `cloud_cover` from weather API (0-100%)
- Analyzes weather codes (clear, cloudy, rain, snow, fog)
- Calculates optimal intensity and cloud coverage
- Updates every 10 minutes with fresh weather data

**Perfect for**: Users who want the background to match actual conditions

---

### ☀️ Sunny
**Value**: `clear`
- **Scene**: Clear day with sun rays
- **Intensity**: 0.45
- **Cloud Cover**: 5%
- **Appearance**: Bright sunny day with minimal clouds

---

### 🌤️ Partly Cloudy (NEW)
**Value**: `partly-cloudy`
- **Scene**: Cloudy
- **Intensity**: 0.5
- **Cloud Cover**: 30%
- **Appearance**: Scattered wispy clouds, lots of sky visible

---

### ☁️ Cloudy
**Value**: `cloudy`
- **Scene**: Cloudy
- **Intensity**: 0.7
- **Cloud Cover**: 55%
- **Appearance**: Moderate cloud coverage, some breaks in clouds

---

### 🌥️ Mostly Cloudy (NEW)
**Value**: `mostly-cloudy`
- **Scene**: Cloudy
- **Intensity**: 0.85
- **Cloud Cover**: 75%
- **Appearance**: Nearly full coverage with occasional breaks

---

### 🌫️ Overcast (NEW)
**Value**: `overcast`
- **Scene**: Cloudy
- **Intensity**: 0.95
- **Cloud Cover**: 95%
- **Appearance**: Complete cloud coverage, heavy and thick

---

### 🌧️ Rainy
**Value**: `rain`
- **Scene**: Rain particle animation
- **Intensity**: 0.9
- **Cloud Cover**: 90%
- **Appearance**: Rain falling with heavy cloud cover

---

### ❄️ Snowy
**Value**: `snow`
- **Scene**: Snow particle animation
- **Intensity**: 0.85
- **Cloud Cover**: 85%
- **Appearance**: Snow falling with thick clouds

---

### 🌙 Starry Night
**Value**: `night`
- **Scene**: Night sky with stars
- **Intensity**: 0.6
- **Cloud Cover**: 10%
- **Appearance**: Clear night with twinkling stars

---

## How It Works

### Automatic Mode Flow

```
Weather API
  ↓
cloud_cover (0-100%) + weather_code
  ↓
computeSceneContext()
  ├─ Analyzes weather conditions
  ├─ Calculates intensity = cloudCover / 100
  ├─ Selects appropriate scene
  └─ Returns context { sceneId, intensity, cloudCover }
      ↓
Scene renders with real weather data ✨
```

### Manual Override Flow

```
User selects scene in Settings UI
  ↓
setForcedSceneSetting(value)
  ↓
refreshBackgroundScene()
  ↓
Checks forcedScene !== 'auto'
  ↓
Uses hardcoded values for selected scene
  ├─ intensity: Fixed value
  ├─ cloudCover: Fixed percentage
  └─ sceneId: Forced scene type
      ↓
Scene renders with fixed values 🎨
```

---

## Code Implementation

### HTML ([index.html:139-165](index.html#L139-L165))

```html
<div class="segmented-control wrap scene-picker">
    <input type="radio" name="sceneOverride" id="sceneAuto" value="auto" checked>
    <label for="sceneAuto">
        <span class="scene-icon"><i class="fa-solid fa-wand-sparkles"></i></span>
        Automatic
    </label>

    <input type="radio" name="sceneOverride" id="scenePartlyCloudy" value="partly-cloudy">
    <label for="scenePartlyCloudy">
        <span class="scene-icon"><i class="fa-solid fa-cloud-sun"></i></span>
        Partly Cloudy
    </label>

    <!-- ... more options ... -->
</div>
```

### Settings JS ([settings.js:94-104](settings.js#L94-L104))

```javascript
const sceneRadios = {
    auto: $sceneAutoRadio,
    clear: $sceneClearRadio,
    'partly-cloudy': $scenePartlyCloudyRadio,
    cloudy: $sceneCloudyRadio,
    'mostly-cloudy': $sceneMostlyCloudyRadio,
    overcast: $sceneOvercastRadio,
    rain: $sceneRainRadio,
    snow: $sceneSnowRadio,
    night: $sceneNightRadio
};
```

### Scene Manager ([scene-manager.js:237-295](scene-manager.js#L237-L295))

```javascript
const forcedScene = getForcedSceneSetting();
if (forcedScene && forcedScene !== 'auto') {
    switch (forcedScene) {
        case 'partly-cloudy':
            context.sceneId = 'cloudy';
            context.intensity = 0.5;
            context.cloudCover = 30; // 30% coverage
            break;
        // ... other cases ...
    }
} else {
    // Use automatic weather-based context
    context = computeSceneContext();
}
```

---

## Cloud Coverage Visual Guide

```
┌─────────────────────────────────────────┐
│  PARTLY CLOUDY (30%)                    │
│  ☁️    ☁️         ☁️                    │
│         ☁️    ☁️                        │
│                                         │
│  Sparse, scattered clouds               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  CLOUDY (55%)                           │
│  ☁️ ☁️   ☁️  ☁️    ☁️                  │
│   ☁️   ☁️    ☁️  ☁️   ☁️              │
│                                         │
│  Moderate coverage, some breaks         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  MOSTLY CLOUDY (75%)                    │
│  ☁️☁️☁️☁️   ☁️☁️☁️                      │
│  ☁️☁️  ☁️☁️☁️  ☁️☁️                    │
│                                         │
│  Nearly full, occasional breaks         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  OVERCAST (95%)                         │
│  ☁️☁️☁️☁️☁️☁️☁️☁️                        │
│  ☁️☁️☁️☁️☁️☁️☁️☁️                        │
│                                         │
│  Complete cloud coverage                │
└─────────────────────────────────────────┘
```

---

## Testing Scene Options

### In Browser Console:

```javascript
// Test automatic mode
setForcedSceneSetting('auto');
refreshBackgroundScene();

// Test partly cloudy
setForcedSceneSetting('partly-cloudy');
refreshBackgroundScene();

// Test overcast
setForcedSceneSetting('overcast');
refreshBackgroundScene();

// Check current scene
console.log('Current forced scene:', getForcedSceneSetting());
console.log('Cloud cover:', currentCloudCover);
```

### In Settings UI:

1. Open Settings (⚙️ icon)
2. Go to "Display" tab
3. Scroll to "Background Scene"
4. Select any scene option
5. Close settings
6. Background updates immediately

---

## Automatic Mode Behavior

When **Automatic** is selected, the system:

1. ✅ **Reads real weather** every 10 minutes
2. ✅ **Analyzes conditions**:
   - Cloud cover percentage (0-100%)
   - Weather codes (clear/cloudy/rain/snow/fog)
   - Time of day (day/night)
3. ✅ **Selects appropriate scene**:
   - Clear → Clear day with sun rays
   - Partly cloudy (25-55%) → Cloudy scene with moderate coverage
   - Mostly cloudy (55-70%) → Cloudy scene with high coverage
   - Overcast (70-100%) → Cloudy scene with full coverage
   - Rain/Snow → Particle animation
   - Night → Starry sky
4. ✅ **Updates dynamically** as weather changes

---

## Manual Override Behavior

When a **specific scene** is selected:

1. ✅ **Ignores weather data** (doesn't use API values)
2. ✅ **Uses fixed parameters** (hardcoded intensity and cloudCover)
3. ✅ **Persists across page refreshes** (saved in localStorage)
4. ✅ **Remains until changed** (won't update with weather)

Perfect for:
- 📸 Screenshots with consistent background
- 🎨 Aesthetic preference over accuracy
- 🧪 Testing specific weather conditions
- 📹 Screen recordings with predictable effects

---

## Icon Reference

| Scene | Icon | Font Awesome Class |
|-------|------|-------------------|
| Automatic | 🪄 | `fa-wand-sparkles` |
| Sunny | ☀️ | `fa-sun` |
| Partly Cloudy | 🌤️ | `fa-cloud-sun` |
| Cloudy | ☁️ | `fa-cloud` |
| Mostly Cloudy | 🌥️ | `fa-clouds` |
| Overcast | 🌫️ | `fa-smog` |
| Rainy | 🌧️ | `fa-cloud-rain` |
| Snowy | ❄️ | `fa-snowflake` |
| Starry Night | 🌙 | `fa-moon` |

---

## LocalStorage Keys

```javascript
// Scene override setting
localStorage.getItem('forcedScene')
// Values: 'auto', 'clear', 'partly-cloudy', 'cloudy',
//         'mostly-cloudy', 'overcast', 'rain', 'snow', 'night'

// Cloud animation state
localStorage.getItem('cloudSetting')
// Values: 'on', 'paused', 'off'
```

---

## Summary

✅ **Automatic mode** uses real weather data (default)
✅ **Manual options** provide granular cloud control
✅ **New options** added: Partly Cloudy, Mostly Cloudy, Overcast
✅ **Cloud coverage** accurately reflects selected option
✅ **Both modes** work seamlessly together
✅ **Settings persist** across page refreshes

The scene picker now gives users full control while maintaining intelligent automatic behavior! 🎉
