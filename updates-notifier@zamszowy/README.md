# updates notifier

This applet monitors and refreshes (via configurable timeout) available updates
using pkcon tool and PackageKitGlib package.  
It also allows refreshing updates, viewing available ones and installing them
through the popup menu.  
When viewing updates, all entries are clickable and will open the update
details (on supported systems) if available. They are also searchable with
'Ctrl+f'.

## Settings

You can:

- change refresh timeout
- change default upgrade `pkcon` commands  to your own.
- disable menu and open updates window when clicked on applet
- enable showing three (configurable) levels of icon to show how many packages
are waiting for the upgrades.
- hide applet if there are no updates available

## Dependencies

- `pkcon`, `PackageKitGlib`,
- optional `gnome-terminal` for installing updates through the applet menu

## Icons

Icons are based on [Papirus icon theme](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme).
