# Auto Tray Icons (Collapsible XApp Status Applet)

Windows-style hidden tray icons for Linux Mint Cinnamon.

Application tray icons are hidden by default behind an expand arrow, exactly like
the Windows taskbar overflow. Clicking the arrow opens a popup with the hidden
icons arranged in a centered grid. System applets (network, sound, clock, …) stay
on the panel as usual.

## Features

- **Auto-hide**: every application tray icon is hidden by default, including icons
  of apps you install later (like Windows). Promote your favorites to the panel
  via the right-click toggle menu.
- **Overflow popup**: hidden icons show in a grid above the arrow — fixed square
  cells with separator lines, each icon centered. The grid grows automatically as
  more icons appear.
- **Handles BOTH icon systems**: XApp/StatusNotifier icons *and* legacy XEmbed
  tray icons (e.g. `evolution-alarm-notify`) follow the same rules — something no
  other applet does.
- **Working app menus from the popup**: clicks are forwarded after the popup
  releases its input grab, so even Qt tray menus (FortiClient etc.) open properly.
- **Tooltips everywhere**: icons show their app name on hover when the app
  provides no tooltip of its own.
- **Uniform icon sizes**: oversized full-color icons are clamped (configurable).
- **Auto-collapse**: the popup closes after a configurable delay, after clicking
  an icon, or when clicking elsewhere.

## Usage

- Left-click the arrow (▲) to show/hide the hidden icons.
- Right-click the applet for the "Visible tray icons" toggle list — switch an
  icon on to keep it permanently on the panel.
- Right-click → Configure… for: expand mode (popup / inline), auto-hide of new
  icons, max icon size, auto-collapse delay, collapse-on-click.

## Important

This applet **replaces** both the stock *System Tray* and *XApp Status Applet*.
Remove those two from your panel when adding this one — running them side by side
will duplicate icons and can destabilize the legacy tray.

Tested on Cinnamon 6.6 (Linux Mint 22.x), X11.

## License

GPL-2.0-or-later. Portions derived from the stock Cinnamon applets
`xapp-status@cinnamon.org` and `systray@cinnamon.org` (GPL-2.0+).
