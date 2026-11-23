# Battery Plus

Battery icon with a two-line panel label (charge percentage on top,
remaining time below) plus an Android-style charge history graph.

Click the icon for details: status, remaining time, current charging or
discharging duration, power draw (W), voltage, battery health, charge cycles,
power-profile switching
(power-profiles-daemon, if available) and a history graph with
charging-zone shading and zone boundary times.

## Settings

- Show/hide the battery icon and the bottom (time) row
- Verbose time format
- Show/hide individual statistics and arrange them in any order
- Power and voltage precision from 0 to 3 decimal places
- Graph span: 1–168 hours (sampled every minute while logged in,
  data older than 8 days is pruned)
- Charging-zone shading on/off
- Six complete popup themes: three dark and three light
- Custom theme colors for the popup, text, highlights, borders and graph
- Low-battery notification with adjustable threshold

## Requirements

- `upower` (preinstalled on Linux Mint)
- Optional: `power-profiles-daemon` for the power-mode switcher
- Optional: `notify-send` (libnotify-bin) for the low-battery notification

## Notes

- History is stored in `~/.local/share/battery-plus/history.csv`
  (one sample per minute, shared across reinstalls).
- The activity duration is restored from history after Cinnamon or the
  applet restarts.
