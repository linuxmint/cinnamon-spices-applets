# Attribution

Adaptive System Monitor was created as a unified, orientation-aware successor
to two Cinnamon applets used together:

- **Combined Monitor** (`combined-monitor@danipin`) by `d-atoshi` inspired the
  CPU, memory, swap and hwmon temperature metrics.
- **AMD GPU Monitor** (`gpumonitor@axel358`) by `axel358` inspired the
  `radeontop` invocation and GPU / VRAM output parsing.

The original applets are distributed in Linux Mint's
[`cinnamon-spices-applets`](https://github.com/linuxmint/cinnamon-spices-applets)
repository under its GPL-3.0 license. This implementation has a new shared
polling loop, parser module, settings schema and adaptive horizontal / vertical
layout.

The white CPU, RAM, swap and temperature SVG symbols in `icons/` are reused
from Combined Monitor and remain credited to `d-atoshi`. The GPU and VRAM
symbols were created specifically for Adaptive System Monitor. No original
translations are reused.
