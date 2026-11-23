# PocketTray

A system tray with a pocket. Tray icons you rarely need are tucked away in a
small pocket that opens on click or hover; everything else stays visible in
the panel.

PocketTray replaces both of Cinnamon's tray applets in one:

- **System Tray** (`systray@cinnamon.org`) – legacy X11 (XEmbed) icons
- **XApp Status Applet** (`xapp-status@cinnamon.org`) – modern status icons,
  including StatusNotifier icons of Electron, Qt and KDE applications, and the
  screen-recording indicator

## Usage

1. Remove *System Tray* and *XApp Status Applet* from your panel.
   If one of them is still there, PocketTray removes itself from the panel
   again and shows a notification, instead of showing icons twice.
2. Add *PocketTray* to the panel.
3. **Right-click PocketTray.** The menu lists every tray icon with its
   application icon and a switch:
   - on – the icon stays in the panel
   - off – the icon goes into the pocket
4. Click (or hover) the pocket button to open the pocket. Clicking a status
   icon in the pocket closes the pocket, so the application's menu can open.

The pocket button only appears when the pocket holds at least one icon.

## Settings

| Setting | Options |
|---|---|
| Open the pocket on | Click, Hover (with delays for opening and closing) |
| Position of the pocket button | Left or right of the icons (above/below on vertical panels) |
| Icon of the pocket button | Three triangles (default), triangles upside down, four circles, grid, three dots, pocket, drawer, arrows, or a custom icon |
| Hidden icons | The list behind the switches in the context menu; can be edited by hand |

## How icons are identified

The hidden-icons list matches names case-insensitively:

| Icon type | Name used | Example |
|---|---|---|
| XApp status icon | its name | `flameshot`, `blueman`, `vorta` |
| StatusNotifier icon without a name | process name | `teams-for-linux` |
| Legacy X11 icon | WM_CLASS | `guake` |

Note: when no status-icon host is running, modern applications fall back to
legacy X11 icons and all show up as `xapp-sn-watcher`. PocketTray is such a
host, so this only happens while it is not on the panel.

## Compatibility

Developed and tested on Linux Mint 22.3 with Cinnamon 6.6.9 on a horizontal
panel. Translations: German.

## Credits and license

Based on `systray@cinnamon.org` and `xapp-status@cinnamon.org` from
[linuxmint/cinnamon](https://github.com/linuxmint/cinnamon), licensed under
GPL-2.0-or-later. PocketTray is distributed under the same license.
