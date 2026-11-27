# Just Desktop

A Cinnamon panel applet to show the desktop your way: plain click for the classic view, Shift+click to toggle desktop icons along with it, and hover to peek — all fully customizable.

## Features

- **Click action** — Show Desktop (classic), Hide Icons + Show Desktop, Hide Icons + Desklets + Show Desktop, Only Toggle Icons, Desklets, Expo, Scale, or Nothing
- **Reliable restore** — unlike the stock cornerbar applet, clicking the applet always brings your windows back, even if you clicked the desktop in between (state-based, not toggle-based)
- **Shift+Click action** — same choices, independently configurable
- **Middle-click / Shift+Middle-click** — same choices, independently configurable
- **Hover peek** — temporarily fade windows away with adjustable delay, opacity, and blur
- **Cornerbar-style thin bar** — no bulky icon; adjustable width, height, and custom color (RGBA transparency supported)
- **Icon hiding** — toggles Nemo `show-desktop-icons`; optional dim indicator and startup mode (Remember / Show / Hide)
- **Full context menu** — every action plus Applet Settings

## Installation

```bash
./install.sh
```

Then right-click the panel → *Add applets* → enable **Just Desktop**.

Requires Cinnamon 6.2+ (Linux Mint 21.3 and newer, including 22.x).

## Usage

- **Click** — whatever `Click action` is set to (default: Show Desktop)
- **Shift+Click** — whatever `Shift+Click action` is set to (default: Hide Icons + Show Desktop)
- **Middle-click / Shift+Middle-click** — configurable (defaults: Desklets / Expo)
- **Hover** — peek at the desktop while hovering (if enabled)
- **Right-click** — full action menu

Open *Configure* to change every behavior, the bar size (Width 2–400px, Height 2–60px), and the bar color.

> ⚠️ **Note:** to remove the applet, right-click **the applet itself** → *Remove*. Right-clicking an empty panel area → *Remove panel* deletes the whole panel (Cinnamon does this without confirmation). If that happens, re-add the panel via *Panel Settings* — your applet settings are kept.

## Uninstallation

```bash
./uninstall.sh
```

## Contributing

Issues and pull requests are welcome. Please keep code and comments in English and human-readable (no minified JS), following the existing Cornerbar/Show-Desktop patterns.

## License

MIT
