# Exit

## Summary

This is a simple, configurable applet for displaying an Exit menu on your panel.

## Available Menu options

  * Restart Cinnamon
  * Lock Screen
  * Switch user
  * Log Out
  * Suspend
  * Hibernate
  * Restart
  * Shut Down


## Settings

Settings are accessed by selecting *Configure...* from this applet's contextual menu. (Right-click)

You can choose which options appear in this applet menu.

Please note that some options may be managed by the system, which has priority; if this is the case, you won't be able to see them.

## System lock-down

Use `dconf-editor` (install it using your package manager) and go to `/org/cinnamon/desktop/lockdown/`.

You get the list of locks.

These include `disable-lock-screen`, `disable-log-out` and `disable-switching-user`. Their default value is *false*. If their value is *true*, then the corresponding option will not appear in the menu and cannot be configured in this applet's settings.

## Wayland

For now, these menu options are not available using a **wayland** session:

* Restart Cinnamon
* Lock Screen
* Switch User

So you can't see them in this applet's settings.

## Log Out modes

There are three Log Out modes:

- With confirmation: Opens a window to confirm or cancel the disconnection.
- Without confirmation.
- Force: Lets you log out while ignoring inhibitors. Useful when several sessions are open.

Select your preferred mode in the settings (since version 1.1.0).

## Translations

[Status of translations](https://github.com/linuxmint/cinnamon-spices-applets/blob/translation-status-tables/.translation-tables/tables/Exit%40claudiux.md)

Many thanks to the translators!
