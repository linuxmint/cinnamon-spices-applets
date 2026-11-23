# Collapsible Status Area

A status icon applet where the applications you choose are tucked behind an arrow, like the notification area overflow on Windows.

It is a fork of the stock **XApp Status** applet (Cinnamon 6.6) that also hosts **legacy tray icons** (XEmbed, e.g. AnyDesk), using the same logic as the stock **System Tray** applet. One applet therefore handles every status icon.

## Features

- Click the arrow to show or hide the collapsed icons.
- Choose which applications go behind the arrow, either from the applet settings (an "Add" checkbox per application) or from the right-click menu of the arrow.
- Applications are listed with the name shown in the main menu. Double-click a row in the settings to rename it.
- Optional automatic collapse after a delay (0 = never). It waits while the pointer is over the area.
- Everything is shown in panel edit mode.
- Icons are only shown or hidden, never moved between containers, so Cinnamon does not crash when the applet is removed or the panel is edited.

## Installation

1. Add **Collapsible Status Area** to your panel.
2. Remove the stock **XApp Status Applet** and **System Tray** applets, otherwise icons are shown twice. While the System Tray applet is on a panel, this applet leaves legacy tray icons alone.
3. Restart Cinnamon (Ctrl+Alt+Esc).

## Notes

- Legacy tray icons are bitmaps drawn by the application itself, so they do not follow the icon theme.
- Some Flatpak Electron apps fall back to legacy tray icons because the sandbox cannot reach the StatusNotifier watcher. For example, for Bitwarden:
  `flatpak override --user --talk-name=org.kde.StatusNotifierWatcher com.bitwarden.desktop`
- X11 only for legacy tray icons, like the stock System Tray applet.
