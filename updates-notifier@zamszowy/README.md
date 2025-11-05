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
- include firmware updates (if `fwupdmgr` and `jq` are installed), although
they won't be installed with applet's default "upgrade command"
- change default upgrade `pkcon` commands  to your own.
- disable menu and open updates window when clicked on applet
- enable showing three (configurable) levels of icon to show how many packages
are waiting for the upgrades.
- hide applet if there are no updates available
- show label (with customized size/weight) with number of available updates

## Dependencies

- `pkcon`, `PackageKitGlib`,
- optional `fwupdmgr` and `jq` for showing available firmware updates

## Icons

Icons are based on [Papirus icon theme](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme).
