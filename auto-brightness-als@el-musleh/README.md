# Auto Brightness (ALS) - Cinnamon Applet

Automatically adjusts your laptop's screen brightness based on the ambient light sensor (ALS). Never manually adjust brightness again!

## Features

✨ **Smart Auto-Adjust** - Real-time brightness control based on ambient light readings  
🎚️ **Smooth Transitions** - Logarithmic scaling with smoothing algorithm for natural adjustments  
🌙 **Easy Toggle** - Click the applet to pause/resume auto-brightness control  
⚡ **Lightweight** - Minimal CPU/battery usage with 1-second polling interval  
🔒 **Secure** - Uses `sudo` with `brightnessctl` (sudo password required on first use)  

## Requirements

- Cinnamon desktop environment
- Ambient Light Sensor (ALS) device (`/sys/bus/iio/devices/iio:device0/`)
- `brightnessctl` package installed
- Linux-based system

## Installation

### From Cinnamon Spices

1. Open **Cinnamon Settings → Applets**
2. Search for **"Auto Brightness (ALS)"**
3. Click **Install** and follow the prompts
4. Enable the applet from the list
5. Add it to your panel

### Manual Installation

```bash
git clone https://github.com/el-musleh/auto-brightness-als
cp -r auto-brightness-als ~/.local/share/cinnamon/applets/auto-brightness-als@el-musleh/
```

Then restart Cinnamon: `Alt + F2 → r → Enter`

## Usage

- **Enable/Disable**: Click the applet in the panel
  - 🌤 **Auto** = Auto-brightness is active
  - 🌙 **Off** = Auto-brightness is disabled (manual control)
  
- **Hover** over the applet to see current ambient light level and brightness percentage

## Configuration

Edit the constants in `applet.js` to customize:

```javascript
const MIN_BRIGHTNESS = 10;    // Minimum brightness (%)
const MAX_BRIGHTNESS = 90;    // Maximum brightness (%)
const SMOOTHING = 0.2;        // Smoothing factor (0.0-1.0)
const POLL_MS = 1000;         // Update interval (milliseconds)
```

## Troubleshooting

### Applet doesn't appear after installation
- Restart Cinnamon: `Alt + F2 → r → Enter`
- Check if ALS sensor exists: `cat /sys/bus/iio/devices/iio:device0/in_illuminance_raw`
- If file doesn't exist, your laptop may not have an ALS device

### Brightness doesn't change
- Verify `brightnessctl` is installed: `which brightnessctl`
- Check permissions: First click may ask for sudo password
- Review logs: `journalctl -f | grep cinnamon`

### Sensor not found
Your device may use a different path. Check:
```bash
find /sys -name "in_illuminance*" 2>/dev/null
```

And update the paths in `applet.js`:
```javascript
const ALS_RAW = "/path/to/your/in_illuminance_raw";
const ALS_SCALE = "/path/to/your/in_illuminance_scale";
```