# Mirror Panel

A Cinnamon panel applet that lets you mirror your primary panel's applet layout to any connected monitor with a single click.

## Requirements

- Node.js (`sudo apt install nodejs`)
- `mirror-panel.js` placed at `~/scripts/mirror-panel.js`
  - Download from: https://github.com/mike277202/mirror-panel

## Installation

1. Install via **Cinnamon Settings → Applets → Download** and search for "Mirror Panel"
2. Enable it from the Applets list
3. Right-click your panel → **Add applets to the panel** → select **Mirror Panel**

## Usage

Click the monitor icon on your panel. A terminal will open prompting you to:
- Select which monitor(s) to mirror panel 1 onto
- Choose the panel position (top, bottom, left, right)

Cinnamon will automatically restart and apply the mirrored layout.

## Notes

- Single-instance applets (systray, network, sound) are automatically skipped during mirroring
- Panel height, autohide, and hide/show delays are also mirrored from panel 1

## Author

mike277202 — https://github.com/mike277202
