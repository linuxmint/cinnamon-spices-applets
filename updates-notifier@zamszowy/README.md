# updates notifier

This applet monitors if updates are available for systems using pkcon tool
(part of packagekit package)
It also allows viewing available updates and installing them through the popup
menu.

In order to have updates count refreshed, some external way to do this is
needed (e.g. enabled automatic updates checking in `gnome-software` if such app
is present, or in debian-based systems some way to periodically run `apt
update`).

## Settings

You can:

- change refresh timeout
- change default update/upgrade `pkcon` commands  to your own.
- enable showing three (configurable) levels of icon to show how many packages
are waiting for the upgrades.
- hide applet if there are no updates available

## Dependencies

- `pkcon` (`packagekit`), gnome-terminal`

## Icons

Icons are based on [Papirus icon theme](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme).
