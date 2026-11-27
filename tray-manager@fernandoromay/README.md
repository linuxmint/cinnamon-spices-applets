# Tray Manager

A Cinnamon panel applet that hosts every kind of tray icon in one place and tucks away the ones you do not need to see.

## Features

- **A drawer for hidden icons**: the tray expands along the panel to show them.
- **All tray icon types**: XApp status icons, StatusNotifierItem / AppIndicator icons (Cinnamon's `xapp-sn-watcher` turns these into XApp icons), and legacy XEmbed icons.
- **Hides other applets too**: pick any applet on the same panel and it disappears while the tray is collapsed.
- **Several trays**: up to five tray groups on the panel, each showing its own icons, so other applets can be placed between them.

## Use

- **Left-click the arrow** to expand or collapse the drawer
- **Middle-click the arrow** to show or hide the hidden applets
- **Scroll on the arrow** to open (up or left) or close (down or right)
- **Right-click the tray** (or Ctrl + right-click an icon) for two lists:
  - *Tray icons*: switch an icon on to keep it on the panel at all times. Click on the up and down arrows to change an icon's position or move it between tray groups
  - *All applets*: switch an applet on to tuck it away with the hidden icons

Set *Tray groups* in the settings (1 to 5) to add or remove tray groups; a new tray group starts empty and receives icons you move to it from the menu.

New icons start hidden; turn off *Hide new tray icons* in the settings to keep them on the panel.

While the tray is collapsed this applet does the job of the stock **System Tray** and **XApp Status Applet** — remove both from the panel.

## License

- Original work Copyright (C) BeatLink (*Tray Drawer*).
- Modified work Copyright (C) 2026 Fernando Romay (*Tray Manager*).
- Licensed under the [GNU General Public License v3.0 or later](https://www.gnu.org/licenses/gpl-3.0.html).

Source code: [github.com/fernandoromay/tray-manager](https://github.com/fernandoromay/tray-manager)
