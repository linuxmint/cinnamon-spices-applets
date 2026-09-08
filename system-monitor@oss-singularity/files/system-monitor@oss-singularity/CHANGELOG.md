# Changelog

## 2.0.0 — 2026-09-08

First public OSS Singularity release under the canonical
`system-monitor@oss-singularity` identity.

- Publish the applet under the canonical `system-monitor@oss-singularity`
  identity with OSS Singularity attribution.
- Support compact metric icons or short text labels in adaptive horizontal and
  vertical panel layouts.
- Include reproducible Spices packaging, the official submission shape and a
  native square manager icon.
- Show the detected AMD GPU bus as a soft-grey settings placeholder while
  keeping manual overrides separate; clicking away from the field leaves it
  cleanly.
- Include verified native Cinnamon screenshots for the menu and both panel
  orientations, including the final 8 px panel-edge crop treatment.
- Present the font-size default as `100%` while preserving the approved `90%`
  visual baseline at that default.

## Pre-public development

### 1.4.0 — 2026-08-22

- Stop polling hidden CPU, memory / swap and temperature metrics.
- Continue sharing one `/proc/meminfo` read when either memory metric is shown.
- Refresh metrics immediately when their visibility setting changes.

### 1.3.1 — 2026-08-22

- Add the Combined Monitor-style `Restart Cinnamon` action to the applet menu.

### 1.3.0 — 2026-08-22

- Hide GPU and VRAM metrics automatically when `radeontop` is missing or no
  supported GPU data is available.
- Restore available GPU metrics automatically while respecting their
  individual visibility settings.

### 1.2.1 — 2026-08-22

- Give VRAM separate warning and critical thresholds.
- Set the default VRAM warning threshold to 90%.
- Refresh both README screenshots with normal-color VRAM values.

### 1.2.0 — 2026-08-22

- Add a settings switch for choosing metric icons or text labels.
- Add vertical-panel screenshots of both display modes to the README.

### 1.1.0 — 2026-08-22

- Replace metric text abbreviations with compact SVG symbols.
- Reuse the CPU, RAM, swap and temperature symbols from Combined Monitor.
- Add matching original GPU and VRAM symbols.
- Add a real vertical-panel screenshot to the README.

### Initial development baseline — 2026-08-22

- Combine CPU, RAM, swap, CPU temperature, AMD GPU and VRAM metrics.
- Add automatic horizontal and vertical panel layouts.
- Fit the vertical layout into a 40 px Cinnamon panel.
- Add configurable visibility, refresh rate, colors and thresholds.
- Add a detail menu with launchers for System Monitor and `radeontop`.
- Add parser tests, source checks and install / uninstall scripts.
