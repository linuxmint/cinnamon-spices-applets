# Pantalla — Cinnamon applet

Control the **brightness** and **color temperature** of your monitors from the Cinnamon panel, with customizable **modes** (Day, Night, or your own) and **automatic** day/night switching.

It works in software: it applies brightness and temperature to the GPU color table via `xrandr`, without touching the physical backlight. So it works on any monitor —including those that don't support DDC/CI— and on several monitors at once.

## Requirements

- Cinnamon on **X11** (the default Linux Mint session).
- `xrandr` (preinstalled). No other dependencies.

## Usage

- **Left-click** the icon: brightness and temperature sliders, buttons to apply a mode (a dot marks the active one), "Save current values to…", and "Settings…".
- **Settings** (menu → "Settings…", or right-click → Configure): create, edit and delete modes (a list), minimum brightness, and the automatic day/night switching.

### Automatic day/night

Follows Cinnamon's **Night Light** (sunrise/sunset based on your location). Enable it in System Settings —at neutral intensity, so it doesn't double the tint— and turn on the applet's switches. You can enable night only, day only, or both.

## Author and license

- Author: Jorge Senosiain — apps.culturoscope.es
- License: GPL-3.0
