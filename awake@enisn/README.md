# Awake Timer

## Introduction

**Awake Timer** is a minimalist Cinnamon panel applet that keeps your computer awake for a chosen number of hours — no screen blanking, no lock screen, no display sleep, no automatic suspend — and then automatically restores your normal power settings.

It is made for the times you need the machine to stay on for a download, a build, a remote session or a presentation without digging into the power and screensaver settings and remembering to switch everything back afterwards.

The panel shows ☕ when idle, and a live countdown like ☕ 4:32 while awake mode is active.

## Features

- **One-click presets:** 1 / 2 / 3 / 5 / 8 hours
- **Custom duration:** type any duration in hours (e.g. 1.5) and press Enter
- **Live countdown** in the panel
- **Turn off now** to restore your settings immediately
- Choosing a new duration while active simply restarts the countdown
- **Crash-proof auto-restore:** your original settings are snapshotted, and a systemd user timer restores them even if Cinnamon is restarted; if the machine was powered off when the deadline passed, the applet restores on the next login
- Only idle actions are touched — manual suspend and the laptop lid switch behave exactly as before
- No root, no daemon, no dependencies beyond Cinnamon itself

## How it works

While active, screen blanking (`idle-delay`), screen lock (`lock-enabled`), display sleep (`sleep-display-ac/battery`) and idle suspend (`sleep-inactive-ac/battery-type`) are temporarily disabled. Your original values are stored in `~/.cache/awake-override/state.json` and restored when the timer expires or when you turn awake mode off.

## Compatibility

Developed and tested on Linux Mint 22.3 (Cinnamon 6.x); should work on any Cinnamon ≥ 5.4.

Source repository: https://github.com/enisn/cinnamon-awake-applet
