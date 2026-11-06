# Darker

Darken your screen beyond the lowest backlight brightness, for night work on displays that are
still too bright at their minimum.

Darker draws a semi-transparent, click-through black layer over everything on screen, inside
Cinnamon's compositor. It doesn't touch the backlight or the display's gamma, so it works
together with **Night Light** instead of fighting it.

## Features

- Slider in the panel popup, from 100% (off) down to 10% brightness (capped so the screen can
  never go fully black)
- Scroll over the panel icon to adjust in 5% steps (up = brighter, down = darker)
- The panel shows just an icon while off, and the current brightness (e.g. `60%`) while active
- Covers all monitors, panels, menus, and fullscreen video
- No external tools, no background processes
- Always starts at 100% (off) after login or a Cinnamon restart

## Usage

Click the panel icon and drag the slider, or scroll over the icon. **Reset to 100%** turns
darkening off.

If the screen ever gets too dark to see: restarting Cinnamon (`Ctrl+Alt+Esc`) or removing the
applet always brings it back to normal.

## Known limitations

- **The mouse cursor isn't darkened.** It's drawn separately by the hardware.
- **Screenshots are darkened.** Screenshot tools capture the composited image, overlay included.
- **Fullscreen apps aren't darkened if "Disable compositing for full-screen windows" is on** (System
  Settings → General; off by default), because those windows then bypass the compositor.
- Darkening applies to all monitors equally.

## Requirements

Cinnamon 6.6 or newer (Linux Mint 22.3 or newer).

## Development

Source code, changelog and tests: https://github.com/chris-lep/darker
