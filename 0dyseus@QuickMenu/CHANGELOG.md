## Change Log

##### 1.07
- Removed *multiversion* because it is not worth the trouble.
- Removed default main folder set to Desktop. This was done because if the Desktop contains a lot of files (by the thousands), Cinnamon will simply freeze and/or crash. This happens because Clutter menus can barely handle large amounts of menu items.
- Moved some prototypes into a separate "modules file".
- Removed *dangerous* flag. Achieved by changing all synchronous functions to their asynchronous counterparts.
- Some minor code clean up.

##### 1.06
- Fixed menu breakage after changing main folder under Cinnamon 3.2.x.

##### 1.05
- Improved support for Cinnamon 3.2.x.
- Improved hotkey handling.
- Improved application's icon recognition for use on the menu items.
- Improved support for files launching. Now, if there isn't a handler for certain file types, the **"Open with"** dialog will appear.
- Added support for symbolic links.
- Fixed the display of symbolic icons for the applet.

##### 1.04
- Added option to auto-hide opened sub-menus.
- Added option to keep the menu open after activating a menu item. This isn't a configurable option.
- Some code cleaning/corrections.

##### 1.03
- Added support for localizations. If someone wants to contribute with translations, inside the Help section of this applet (found in the applet context menu or the Help.md file inside this applet folder) you will find some pointers on how to do it.

##### 1.02
- Fixed the known issue of not displaying an icon for certain file types.

##### 1.01
- Fixed the need to restart Cinnamon after adding this applet to the panel.
- Added option to allow custom icons for each individual sub-menu.
- Added options to set a custom size for sub-menus and menu items icons.
- Removed style sheet from applet folder (overwritten by each applet update) in favor of options to set styles for menu items and sub-menus (persistent across updates).

##### 1.00
- Initial release.
