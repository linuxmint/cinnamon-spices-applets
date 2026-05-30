# Adaptive Brightness

Automatically adjusts your laptop's screen brightness based on ambient light sensor readings. The applet smoothly transitions between brightness levels to match your environment - darker in dim rooms, brighter in sunlight.

## Features

- **Automatic Brightness Control** - Adjusts screen brightness based on ambient light sensor readings
- **10-Second Calibration** - Quick calibration for dark and bright environments with median filtering for accuracy
- **Multiple Response Curves** - Choose between Logarithmic (natural eye response), Linear, or Sigmoidal mapping
- **Icon-Only Mode** - Hide the percentage text for a cleaner panel appearance
- **Smooth Transitions** - Configurable smoothing factor for buttery-smooth brightness changes
- **Smart Travel Mode** - Detects your environment zone (Dark Room, Indoor, Outdoor) and dynamically adjusts brightness mapping for optimal results. Automatically expands lux bounds when readings exceed the configured range
- **Logging Toggle** - Enable or disable file logging for advanced troubleshooting
- **Multi-Section Settings** - Organized settings panel with Calibration, Travel Mode, and Logs sections

## Requirements

### Hardware
- Laptop with an ambient light sensor (ALS)
- Common sensor locations: `/sys/bus/iio/devices/iio:device*/in_illuminance_raw`

### Software
- Cinnamon desktop environment
- `brightnessctl` package installed
- Password-less sudo access for `brightnessctl` (or membership in `video` group with appropriate permissions)

## Installation

### From Cinnamon Spices
1. Open **System Settings → Applets**
2. Click the **Download** tab
3. Search for "Adaptive Brightness"
4. Click the download button
5. Add the applet to your panel

### Manual Installation
```bash
# Copy applet files to your local Cinnamon directory
cp -r files/adaptive-brightness@el-musleh ~/.local/share/cinnamon/applets/

# Install brightnessctl if not already installed
sudo apt install brightnessctl

# Configure password-less sudo for brightnessctl
echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/brightnessctl" | sudo tee /etc/sudoers.d/brightnessctl-applet
sudo chmod 440 /etc/sudoers.d/brightnessctl-applet

# Restart Cinnamon (Alt+F2, type 'r', and press Enter, or run: cinnamon --replace &)
```

## Configuration

Right-click the applet and select **Configure** to access settings:

### Calibration
- **Brightness Limits** - Set minimum and maximum brightness levels
- **Panel Appearance** - Toggle the tray label and choose brightness, ambient lux, or both
- **Response Curve** - Choose the mathematical curve for lux-to-brightness mapping (Logarithmic, Linear, or Sigmoidal)
- **10-Second Calibration** - Quickly calibrate dark and bright levels
- **Dark Reference Lux / Bright Reference Lux** - The low and high ambient-light reference points used by auto mode
- **Sensor Path** - Manually specify sensor location if auto-detection fails
- **Sensor Polling** - Adjust how often the sensor is read (default: 1000ms)
- **Smoothing Factor** - Control transition smoothness (0=instant, 1=very smooth)
- **Lux Stability Threshold** - Minimum lux change required before recalculating brightness
- Follow the on-screen instructions for best results

### Travel Mode
- **Travel Mode** - Enable zone-aware dynamic brightness. Detects Dark Room, Indoor, and Outdoor environments and tightens the effective lux range for better granularity. Also auto-expands lux bounds when readings exceed the configured range

### Logs
- **Log Level** - Enable logging and choose verbosity (Debug, Info, Error, or Off)
- **Open Log File** - Opens the log file in the default text editor

## Troubleshooting

### Applet shows "No sensor"
Your system may not have an ambient light sensor, or it may be in a non-standard location.

To check for sensors:
```bash
ls /sys/bus/iio/devices/iio:device*/in_illuminance_raw 2>/dev/null || echo "No ALS found"
```

If found at a custom path, set it under **Calibration → Sensor Path**.

### Brightness not changing
1. Verify `brightnessctl` works: `sudo brightnessctl set 50%`
2. Check sudo permissions: `sudo -n brightnessctl get` should return brightness without password prompt
3. Check the applet is enabled (click to toggle on/off)
4. Check sensor is providing readings (cover/uncover sensor to see lux changes in the panel label or tooltip)

### Permission denied errors
The applet needs password-less sudo access to `brightnessctl`. Add this sudoers entry:
```bash
echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/brightnessctl" | sudo tee /etc/sudoers.d/brightnessctl-applet
sudo chmod 440 /etc/sudoers.d/brightnessctl-applet
```

## Tips

- **Calibration**: For best results, calibrate in your typical usage environments (e.g., dark room at night, bright office during day)
- **Smoothing**: Higher smoothing (0.7-1.0) feels premium but responds slower; lower values (0.2-0.5) are more responsive
- **Response Curves**:
  - **Logarithmic** (default) - Matches human eye perception, more sensitive to changes in dim light. Best for varied lighting conditions and natural-feeling brightness adjustments.
  - **Linear** - Direct 1:1 proportion between lux and brightness. Use for predictable control in consistent environments where you want simple, direct mapping.
  - **Sigmoidal** - Smooth S-curve with sharp transition zone. Ideal for environments with distinct lighting states (e.g., switching between indoor and outdoor) where you want gradual changes at extremes with rapid adjustment in the middle.
- **Travel Mode**: When enabled, the applet detects your current environment zone and shows it in the tooltip:
  - **Dark Room** (≤30 lux) - Night, dark room, cinema
  - **Indoor** (30–800 lux) - Office, home, classroom
  - **Outdoor** (>800 lux) - Near window, sunlight, open areas

## Development Scripts

This repository includes helpful scripts for manual installation and debugging:

- **`SETUP.sh`** - Automated setup that installs the applet, checks for brightnessctl, configures sudo permissions, tests the sensor, and verifies brightness control works
- **`TEST_SENSOR.sh`** - Diagnostic tool to check if your ambient light sensor is detected and providing readings
- **`TEST_DEVELOPMENT.sh`** - Pre-flight check that validates JSON files and verifies file structure before submitting changes
- **`TEST_PRODUCTION.sh`** - Full release gate: lint, validate-spice, settings sync, logic tests, version consistency, required assets
- **`UNINSTALL.sh`** - Clean removal of the applet with optional sudo configuration cleanup

These scripts are not required if installing from Cinnamon Spices (System Settings → Applets), but are useful for manual installation from GitHub.

## Technical Notes

### Why No compatibility.js File?

Unlike some other Cinnamon applets, this applet does not require a `compatibility.js` file to handle differences between Cinnamon versions. Here's why:

- **No ByteArray Operations**: The `compatibility.js` file in other applets primarily handles API changes to `imports.byteArray` and `ByteArray.toString()` between Cinnamon 4.6 and earlier versions. This applet does not use subprocesses that return byte arrays requiring conversion.

- **Simple File I/O**: The applet uses `GLib.file_get_contents()` for reading sensor data and calls `.toString()` directly on the result, which works consistently across all Cinnamon versions.

- **No Version-Specific APIs**: The applet avoids version-dependent APIs and uses stable GJS/Cinnamon interfaces that have remained unchanged across supported Cinnamon versions.

## Technical Details

For detailed information about the research sources, algorithms, and methodologies used for brightness detection and adjustment, see [RESEARCH.md](RESEARCH.md). This document covers:

- Illuminance research sources (PMC study, EN 12464 standards, Engineering Toolbox)
- Response curve algorithms (Logarithmic, Linear, Sigmoidal)
- Zone detection algorithm (rolling window, median classification, hysteresis)
- Calibration methodology (10-second high-speed sampling, median filtering, 95th percentile)
- Default values justification and verification

## License

GPL-3.0
