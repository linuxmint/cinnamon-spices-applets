Changelog

### 5.3.2

  * Fixed an undefined reference error when opening LibreOffice documents from Nemo.
  * Windows now activate when app buttons are dragged over to assist dragging files into apps.

### 5.3.1

  * Fixed a bug preventing the applet from starting on Cinnamon 3.2 when no autostart entries have been created.

### 5.3.0

  * Rewrote the hover peek functionality. It now only overlays a single window object on the screen!
  * Improved the styling of closed pinned app buttons.

### 5.2.1

  * Fixed disabling the window listing by monitor option not working.
  * Fixed shortcut creation for Wine and window backed applications.
  * Fixed the Close All menu option leaving empty thumbnails when opening the thumbnail menu right after.
  * Fixed the focus pseudo class not persisting when clicking an app button.
  * Fixed the close button spacing on thumbnails in high DPI mode.
  * Performance optimizations.

### 5.2.0

  * Made the new window listing by monitor behavior optional.
  * Fixed the app hot key only launching new windows.
  * Fixed titles not hiding when pinned apps are closed.
  * Fixed issues with how the translation files are processed.
  * Renamed the "Arrange pinned apps" option to "Enable app button dragging" for clarity.
  * Removed the panel launcher class option as it was a bad workaround that caused bugs.

### 5.1.1

  * Fixed a bug that could freeze Cinnamon.

### 5.1.0

  * Multiple ITM instances now only display windows from the monitor the instance is displayed on, like the default Cinnamon window list.
  * Added a new option that controls whether or not pinned apps should use system favorites, or the pinned list in the applet configuration.
  * Improved thumbnail sorting.
  * Fixed thumbnail menu key controls for all panel orientations.
  * Fixed pinning favorites not appending to the end of the pinned app group, and unpinning apps not moving the app to the end of the app list.

### 5.0.0

  * Fixed off-center app button icons.
  * Fixed the extra menu theming on the thumbnail menu.
  * Fixed active window markers disappearing.
  * Fixed app buttons not using the full width of vertical panels.
  * Fixed the app order display numbering.
  * Fixed LibreOffice apps not being grouped correctly.
  * Added a layout to the settings schema.
  * Hover peek and thumbnail close button theming enabled by default.
  * The non-system tooltip option was removed to help speed up code improvements in the thumbnail menu, and improve performance.
  * Changed the default icon size from 16 to 24.
  * Added an app button width option, which now makes the icon padding options obsolete.
  * Overhauled ungrouped window mode.
  * Vertical thumbnails are now enabled automatically on vertical panels.
  * A lot of optimizations and code improvement.

[See changes for older versions](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/IcingTaskManager%40json/CHANGELOG_OLD.md).