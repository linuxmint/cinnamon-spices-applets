# Battery Plus

Battery icon with a two-line panel label (charge percentage on top,
remaining time below) plus an Android-style charge history graph.

Click the icon for details: status, time, power draw (W), voltage,
battery health, charge cycles, power-profile switching
(power-profiles-daemon, if available) and a history graph with
charging-zone shading and zone boundary times.

## Settings

- Show/hide the battery icon and the bottom (time) row
- Verbose time format
- Graph span: 1–168 hours (sampled every minute while logged in,
  data older than 8 days is pruned)
- Charging-zone shading on/off
- Low-battery notification with adjustable threshold

## Requirements

- `upower` (preinstalled on Linux Mint)
- Optional: `power-profiles-daemon` for the power-mode switcher
- Optional: `notify-send` (libnotify-bin) for the low-battery notification

## Notes

- History is stored in `~/.local/share/battery-plus/history.csv`
  (one sample per minute, shared across reinstalls).
- Polish translation included (`po/pl.po`); other translations welcome.
