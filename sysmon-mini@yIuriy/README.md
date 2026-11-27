# Mini System Monitor

A compact Cinnamon panel applet that shows **CPU usage with a mini graph, RAM, CPU temperature, SSD temperature and battery**, each one with its own icon and color (green / yellow / red) based on thresholds you choose.

![screenshot](screenshot.png)

## Features

- **CPU** usage in % plus a small sparkline with the recent history
- **RAM** usage as used gigabytes (`4.1G`) or percentage (`53%`)
- **CPU temperature** (coretemp, k10temp, zenpower, cpu_thermal or acpitz)
- **SSD temperature** (NVMe)
- **Battery** level with an icon that follows the charge level and charging state
- Turn every item on or off individually, with or without icons
- Adjustable **opacity**, optionally becoming solid on mouse hover
- Customizable color thresholds for every item
- **Tooltip** with a summary: CPU, RAM, swap, temperatures and remaining battery time
- **Click** to open a menu with per-core usage, the top CPU processes and a shortcut to the System Monitor

All data is read asynchronously from `/proc` and `/sys`, so the applet stays light even with a 1 second update interval.

## Settings

Right-click the applet → **Configure...**

| Page | Options |
|---|---|
| Display | What to show (CPU, graph, RAM, CPU temperature, SSD temperature, battery), icons, opacity, hover behavior, graph background, RAM format, graph width, update interval |
| Color thresholds | When each value turns yellow or red (battery warns *below* the threshold, and only while discharging) |

## Translations

- English (default)
- Brazilian Portuguese (pt_BR)

Translations are welcome: copy `files/sysmon-mini@yIuriy/po/sysmon-mini@yIuriy.pot` to `<language>.po` and translate it.

## License

GPL-3.0
