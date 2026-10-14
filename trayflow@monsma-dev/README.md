# TrayFlow

TrayFlow is a compact system tray for Cinnamon. Pinned icons stay on the panel.
Everything else opens in a drop-up overflow popup, like Windows 11.

- pin, overflow, or hide each application icon
- XApp status icons and legacy XEmbed tray icons
- configurable icon size, grid columns, spacing, padding, and close delay
- no in-panel expand animation

Cinnamon can only host one tray applet at a time. Disable the default system
tray or Collapsible Systray before enabling TrayFlow.

## Use

- Click the chevron to open the overflow popup.
- Right-click the applet and open **Tray icons** to choose **Pinned**,
  **Overflow**, or **Hidden** for each detected icon.
- Ctrl+right-click an icon to switch it between pinned and overflow.
- Right-click the applet and choose **Configure** for appearance and behavior.

Some XApp services expose dormant status objects with no icon. TrayFlow keeps
those out of the UI until the application marks them visible.

## Settings

- **Icons per row** — overflow icons wrap onto a new row after this many columns
- **Popup icon size / padding / spacing** — size of the overflow grid
- **Keep open after the pointer leaves** — delay before the popup closes
- **Open overflow on hover** — optional, off by default

## Compatibility

Developed and tested on Linux Mint 22.3, Cinnamon 6.6, X11. The applet uses
Cinnamon's XApp and legacy status icon APIs and declares compatibility with
Cinnamon 5.0 through 6.6.

## License

GPL-3.0-or-later.
