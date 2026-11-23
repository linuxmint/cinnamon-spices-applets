<p align="center">
  <img src="icon.svg" width="96" height="96" alt="Adaptive System Monitor icon">
</p>

<h1 align="center">Adaptive System Monitor</h1>

<p align="center">
  CPU, memory, swap, temperature and AMD GPU monitoring in one compact
  Cinnamon panel applet — adaptive on horizontal and vertical panels.
</p>

<p align="center">
  <a href="https://github.com/oss-singularity/cinnamon-system-monitor/actions/workflows/check.yml"><img alt="Checks" src="https://github.com/oss-singularity/cinnamon-system-monitor/actions/workflows/check.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License GPL-3.0-or-later" src="https://img.shields.io/badge/license-GPL--3.0--or--later-6f5bd5"></a>
  <img alt="Cinnamon 5.8 or newer" src="https://img.shields.io/badge/Cinnamon-5.8%2B-75c46b">
  <img alt="AMD GPU support" src="https://img.shields.io/badge/AMD%20GPU-optional-ed1c24">
</p>

<p align="center">
  <img src=".github/social-preview.png" width="100%"
       alt="Adaptive System Monitor — live system health for Cinnamon">
</p>

<!-- markdownlint-disable MD060 -->

| Horizontal panel (icons)                                                                                        | Vertical panel (icons)                                                                                      |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| <img src="docs/horizontal-panel.png" alt="Horizontal Cinnamon panel with metric icons" width="328" height="40"> | <img src="docs/vertical-panel.png" alt="Vertical Cinnamon panel with metric icons" width="40" height="222"> |

<!-- markdownlint-enable MD060 -->

These native Cinnamon panel crops use an 8 px breathing edge and keep the
panel boundary intact. Text-label mode remains available from the display
settings.

## Why it stands out

- Horizontal panels show a compact single row.
- Vertical panels stack metrics and keep every value narrow enough for a
  40 px panel.
- Choose metric icons or short text labels with a native settings switch.
- CPU, memory, swap and temperature data come directly from Linux `/proc` and
  `/sys` interfaces.
- AMD GPU and VRAM data use `radeontop`.
- GPU and VRAM disappear automatically when `radeontop` or supported GPU data
  is unavailable, and each can also be disabled explicitly in the settings.
- Warning and critical thresholds, colors and visible metrics are configurable
  through Cinnamon's native applet settings.
- Metric refreshes and CPU-temperature discovery use cancellable asynchronous
  Gio operations so the Cinnamon UI loop stays responsive.
- Hidden system metrics are not polled; hiding both GPU metrics also prevents
  `radeontop` from running.
- The click menu includes system-monitor launchers and a `Restart Cinnamon`
  action inherited from the Combined Monitor workflow.

CPU, memory, swap and temperature are read directly from Linux interfaces.
There is no background daemon, web service or telemetry.

## Settings

All options are available through Cinnamon's native three-tab settings dialog.

### General

![General display and AMD GPU settings](docs/settings-general-compact.png)

### Metrics

![Individual metric visibility settings](docs/settings-metrics.png)

### Colors and thresholds

![Metric colors and warning or critical thresholds](docs/settings-thresholds.png)

## Requirements

Cinnamon 5.8 or newer is supported. AMD GPU metrics require `radeontop`:

```bash
sudo apt install radeontop
```

The CPU, memory, swap and CPU-temperature metrics work without `radeontop`.

## Installation

```bash
git clone https://github.com/oss-singularity/cinnamon-system-monitor.git
cd cinnamon-system-monitor
./install.sh
```

Then open **System Settings → Applets**, add **Adaptive System Monitor** to a
panel and remove the separate Combined Monitor / AMD GPU Monitor instances if
you no longer need them. Existing settings of those applets are not changed.

Run `./install.sh` again after an update. Run `./uninstall.sh` to remove the
applet files; user settings are deliberately retained.

## Cinnamon Spices

The repository includes a reproducible Spices candidate builder and a native
local-install verification path. Run `make check-package` and `make package`,
then see [`docs/spices-readiness.md`](docs/spices-readiness.md) for the
submission layout and release gates.

## Development

```bash
make check
```

The checks validate JavaScript syntax, metric parsers, JSON schemas, SVG
assets and shell scripts.

Every push and pull request runs the same validation in GitHub Actions.

## Origin and license

The project combines and reworks ideas from **Combined Monitor** by
`d-atoshi` and **AMD GPU Monitor** by `axel358`, both distributed in Linux
Mint's `cinnamon-spices-applets` repository. See `ATTRIBUTION.md` for details.

Licensed under GPL-3.0-or-later. See `LICENSE`.
