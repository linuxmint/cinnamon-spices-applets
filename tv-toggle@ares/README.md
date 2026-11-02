# TV Toggle

A Cinnamon panel applet that toggles between an extended TV/monitor display and laptop-only with one click.

## What it does

- **Click once** → extends your desktop to the external display (TV/monitor over HDMI)
- **Click again** → back to laptop screen only

No more digging through Display settings or remembering xrandr commands.

## Settings

Right-click the applet → Configure to set:

| Setting | Default | Description |
|---------|---------|-------------|
| Internal output | `LVDS-1` | Your laptop screen (from `xrandr`) |
| External output | `HDMI-1` | Your TV/monitor (from `xrandr`) |
| External resolution | `1920x1080` | Resolution for the external display |
| External position | `right-of` | Where the TV sits relative to your laptop |

To find your output names, run `xrandr` in a terminal and look at the connected display names.

## Requirements

- Cinnamon desktop
- `xrandr` (installed by default on most distros)

## Install

1. Copy the `tv-toggle@ares` folder to `~/.local/share/cinnamon/applets/`
2. Right-click your panel → Applets → find "TV Toggle" → add it to the panel
3. Click the new icon to toggle your displays

## License

MIT
