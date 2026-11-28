# RunCat

A cat lives in your Cinnamon panel and runs faster as the CPU load goes up.

This is a Cinnamon applet port of [gnome-runcat](https://github.com/win0err/gnome-runcat)
by Sergei Kolesnikov.

## Features

- Cat animation driven by real CPU usage from `/proc/stat` (no external tools needed)
- Left click opens a popup anchored to the applet with the current CPU percentage,
  load average, thread count and animation speed
- **Open System Monitor** shortcut right from the popup
- Optional CPU percentage next to the cat
- Adjustable icon size, sampling interval, animation speed and idle threshold
- Idle sprite when the system is quiet

## Settings

Available in the applet context menu (Configure) or in Cinnamon Settings -> Applets:

- Show CPU percentage next to the cat
- Cat icon size (12-64 px)
- CPU sampling interval (500-10000 ms)
- Animation speed (Slow / Normal / Fast)
- Below this CPU load the cat idles

## How it works

CPU load is sampled every 2 seconds by reading `/proc/stat`, then smoothed.
The animation frame timer runs separately at about 50 ms and picks the sprite
for the current load, so the cat keeps running smoothly between samples.

## Credits and license

- Original GNOME Shell extension: [gnome-runcat](https://github.com/win0err/gnome-runcat)
  by Sergei Kolesnikov, licensed under GPL-3.0
- Cat sprites: taken from gnome-runcat, same license, unmodified
- Cinnamon port: Aldhiansyah

This applet is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. See `LICENSE` for the full text.

### Changes from the original extension

The GNOME Shell extension is written in TypeScript and uses `PanelMenu.Button`,
GSettings and a GTK4 preferences window. This port is a rewrite of the UI layer
for Cinnamon:

- `PanelMenu.Button` replaced with `Applet.Applet` and `AppletPopupMenu`
- GSettings replaced with the Cinnamon xlet settings API (`settings-schema.json`)
- TypeScript build step removed; plain JavaScript loaded directly by CJS
- Animation timer decoupled from CPU sampling so the animation no longer stalls
  between samples
- Popup menu and system monitor shortcut added

The CPU reading logic, the animation math and the cat sprites are reused from
the original project.
