# Overflow Tray

A Windows-style system tray. Pick which tray icons stay on the panel; the rest go
behind an arrow, in a popup you open with a click.

## Setup

1. Add **Overflow Tray** to your panel (System Settings → Applets).
2. Remove the **XApp Status Applet** from the panel. Both host the same tray icons,
   so with both on the panel every icon shows up twice.

## Use

- **Left-click the arrow** to show hidden icons. Clicking an icon there works the same as
  clicking it on the panel; its menu opens next to the arrow.
- **Right-click the arrow** for a "Show on panel" switch for each icon. Your choices are
  remembered, including across app and desktop restarts.
- **Configure…** in the same menu: whether new icons start on the panel or hidden (hidden by
  default, like Windows), and how many icons per row the popup shows.

Ctrl+right-click on an icon on the panel opens the applet's own menu, as with the XApp Status Applet.

## Notes

- Works on horizontal and vertical panels.
- Old-style (XEmbed) tray icons are still shown by Cinnamon's System Tray applet; this applet
  handles the XApp/AppIndicator icons most current apps use.
- Some apps give their tray icon a name that changes every session (a process ID, a bus name,
  an unread count). For those, the applet remembers the icon by its tooltip or the app's
  install location instead.

## Credits

Based on Cinnamon's XApp Status Applet by the Linux Mint team, licensed under the GNU GPL v2
or later. This applet is under the same license.
