# Display Switcher — Cinnamon Applet

A Win+P-style display mode switcher for Linux Mint (Cinnamon). Switches between laptop, external display, mirror and extend modes using `xrandr`.

## Features

- **Band overlay** in the centre of the screen (Win+P style) — keyboard-navigable with ← → arrow keys and Enter
- **4 display modes**: laptop only, external only, mirror, extend
- **Configurable keyboard shortcuts** (default: Super+P)
- **Dynamic panel icon** reflecting the active mode
- **Auto-apply on reconnect**: remembers last mode and applies it when an external display is plugged in
- **Revert on disconnect**: switches back to laptop-only when the display is unplugged
- **Hotplug detection** via `Meta.MonitorManager` `monitors-changed` signal
- **Wayland-ready**: backend abstraction layer; v1 fully functional under X11
- **Panel icon can be hidden** for shortcut-only use
- **Desktop notifications** on mode change

## Requirements

- Linux Mint 22.x with Cinnamon 6.x (tested: Mint 22.3 / Cinnamon 6.6.7)
- `xrandr` (package `x11-xserver-utils`, pre-installed on Mint)
- X11 session for full switching functionality

## Installation

```bash
cp -r MintDisplaySwitcher@3ddruck12 ~/.local/share/cinnamon/applets/
```

Reload Cinnamon: **Alt+F2** → type `r` → Enter

Add applet: **System Settings → Applets → Display Switcher** → drag to panel

## Usage

| Action | Result |
|---|---|
| Click panel icon | Open overlay with four modes |
| **Super+P** | Open overlay (Win+P equivalent) |
| Select a mode | xrandr switch + notification |
| Plug in external display | Saved mode is applied automatically |
| Unplug display | Optionally reverts to laptop-only |

### Applet Settings

**Three ways to open settings:**

1. In the overlay: click the **Settings** tile (gear icon)
2. Right-click on the applet → **"Configure…"**
3. System Settings → Applets → Display Switcher → gear icon

**Configurable options:**

| Setting | Description |
|---|---|
| Open menu shortcut | Default: Super+P |
| Per-mode shortcuts | Laptop / external / mirror / extend (optional) |
| Auto-apply on connect | Apply saved mode automatically |
| Revert on disconnect | Switch to laptop-only when display is unplugged |
| Extend position | right / left / above / below |
| Preferred external output | e.g. `HDMI-1` if auto-detection picks the wrong port |
| Hide panel icon | Use shortcut-only mode |

Empty shortcut fields = shortcut disabled.

## Project structure

```
MintDisplaySwitcher@3ddruck12/
├── metadata.json
├── applet.js              # UI, settings, hotplug
├── displayBackend.js      # Factory X11/Wayland
├── displayInfo.js         # Data model + mode detection
├── x11Backend.js          # xrandr (full)
├── waylandBackend.js      # Stub (reads status)
├── settings-schema.json
├── stylesheet.css
├── icon.png
└── po/
    └── de.po              # German translation
```

## Known limitations

- **v1 fully under X11** — default session on Mint 22.3
- **Wayland experimental** — applet loads and shows status; switching opens Display Settings
- **One external display** — with multiple ports the first connected one is used
- **Super+P** may conflict with other shortcuts — change it in applet settings if needed

## Wayland roadmap

1. **Phase 1 (v1):** Backend abstraction + Wayland stub
2. **Phase 2:** `monitors.xml` generation + Settings Daemon
3. **Phase 3:** Native Muffin API in Cinnamon GJS

## Testing

1. Install applet and add it to the panel
2. Laptop only: icon = laptop, external modes disabled
3. Plug in display: auto-apply of saved mode
4. Select "Mirror": icon changes, notification appears
5. Press **Super+P**: overlay opens
6. Unplug display: optional revert to laptop-only

## License

MIT License — see [LICENSE](LICENSE)
