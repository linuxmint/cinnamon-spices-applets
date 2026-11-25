# aVincePulse Applet

A hardware and network monitor for the Cinnamon panel, with a large
hover display.

The panel shows a small icon. Point at it — or click, if you prefer —
and a readable panel appears in the centre of the screen with all your
readings at once. Nothing is shown in the panel itself, so it stays as
tidy as you left it.

## What it shows

Up to 15 readings, each one optional and freely orderable:

| | |
|---|---|
| **Processor** | temperature, load |
| **Memory** | usage |
| **Drive** | temperature, free space on a drive of your choice |
| **Cooling** | fan speed |
| **Power** | battery charge, mains state |
| **Network** | live download and upload on an interface of your choice |
| **Internet speed test** | download, upload, ping, jitter, time of the last test |

Sensors are detected automatically and can be chosen by hand where the
automatic choice is not what you want.

## Warning thresholds

Any reading can change colour when it passes a threshold you set — one
level for a warning, one for critical. Two colour sets are available,
one for dark backgrounds and one for light ones, because a colour that
reads well on a photograph may not read well on a bright desktop.

## Internet speed test

Started from the right-click menu or from the settings window, never on
its own. It uses a speed test program already installed on your system:

- **librespeed-cli** — preferred; measures against the free LibreSpeed
  servers and is the only one of the two that reports jitter.
- **speedtest-cli** — from the standard Mint and Ubuntu repositories.
  It is an unofficial client for the Speedtest.net servers, so Ookla's
  terms of use apply; it reports no jitter and is less accurate on fast
  connections.

**If neither is installed, the speed test simply disappears** — button,
menu entry and hint are hidden, and everything else carries on. Only
download, upload, ping and jitter are ever taken from the program's
output; no address, location or provider is stored.

Every measurement is also written as a readable report you can open
from the settings window.

## Why this one

Cinnamon has several fine hardware monitors. This one is built as a
**pair**: the applet and the [aVincePulse
Desklet](https://cinnamon-spices.linuxmint.com/desklets) share the same
measurement and sensor logic, so both show the same numbers, and each
works perfectly well on its own. Install one, or both, as you like.

## Requirements

Cinnamon 6.6 or newer on Linux Mint — developed and tested with 6.6 under X11 on two
machines. No root rights, no extra
packages, nothing installed behind your back. Readings your machine
cannot provide are simply left out.

## Settings

Update interval, display size, font size and weight, background
opacity, the panel icon, the left-click action, which readings appear
in which order, your own labels, sensor choice, network interface,
drive, warning thresholds and colours, and the speed test program.
A button restores every default.

## Where things are kept

Settings live in Cinnamon's own settings file. Speed test values and
reports go to `~/.local/share/avincepulse/`. Nothing is written
anywhere else, and nothing is ever deleted behind your back.

## Language

English and German. The `.pot` file is included — translations into
other languages are very welcome.

## Licence

GPL-3.0-only. Copyright (C) 2026 Angelo Vincenti - aVince
Industrietechnik.
