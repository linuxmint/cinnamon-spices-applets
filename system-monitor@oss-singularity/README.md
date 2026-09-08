# Adaptive System Monitor

![Adaptive System Monitor in a Cinnamon panel](screenshot.png)

A compact Cinnamon applet for live CPU, memory, swap, temperature and optional
AMD GPU/VRAM monitoring. It adapts automatically to horizontal and vertical
panels.

This is the `2.0.0` public-release payload for the OSS Singularity applet
catalog.

## Features

- Horizontal single-row and vertical stacked layouts.
- Metric icons or short text labels.
- Configurable refresh interval, visibility, colors and warning thresholds.
- CPU, memory, swap and temperature readings from Linux `/proc` and `/sys`.
- Optional AMD GPU and VRAM readings through `radeontop`.
- No daemon, web service or telemetry.
- Native menu actions for System Monitor, `radeontop` and restarting Cinnamon.

## Requirements

Cinnamon 5.8 or newer is declared in `metadata.json`. CPU, memory, swap and
temperature work without extra software. AMD GPU metrics additionally require
the `radeontop` package from the distribution.

## Configuration

Open the applet settings from Cinnamon's Applets panel. The three settings
pages cover display/layout, visible metrics, and colors/thresholds.

## Source and license

Source: [oss-singularity/cinnamon-system-monitor](https://github.com/oss-singularity/cinnamon-system-monitor)

Licensed under GPL-3.0-or-later. Attribution for the predecessor applets is
included in `ATTRIBUTION.md`.
