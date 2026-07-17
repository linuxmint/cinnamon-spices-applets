# XApp Status Applet Reloaded

A fork of Cinnamon's built-in XApp Status Applet that adds persistent
drag-and-drop ordering for status icons.

## Features

- Drag status icons directly along the panel to reorder them.
- Remembers the chosen order across Cinnamon restarts.
- Preserves the original applet's icon themes, sizing, labels, tooltips,
  menus, click actions, scrolling, vertical-panel support, and recording
  indicator.
- Supports right-to-left and vertical panel layouts.

## Installation

Copy the applet directory into your local Cinnamon applets folder:

```sh
mkdir -p ~/.local/share/cinnamon/applets
cp -r files/xstatus-applet-reloaded@dshep79 \
  ~/.local/share/cinnamon/applets/
```

Restart Cinnamon, then add **XApp Status Applet Reloaded** through
**System Settings → Applets**. Remove or disable the built-in XApp Status
Applet if duplicate icons appear.

## Usage

Press and drag an icon to its preferred position. The order is saved
automatically for that applet instance.

## Cinnamon Spices submission

This repository uses the directory layout expected by
`linuxmint/cinnamon-spices-applets`. The repository contents can be copied
into a directory named `xstatus-applet-reloaded@dshep79` in that project.

## Origin and license

This is a modified version of Cinnamon's
`xapp-status@cinnamon.org` applet. Cinnamon and the original applet are
developed by Linux Mint and Cinnamon contributors.

Distributed under the GNU General Public License version 2. See
[LICENSE](LICENSE). The modified source contains dated modification notices
as required by GPL-2.0.
