Changelog

### 6.0.3

  * Fixed a regression causing the Super + Number hotkey behavior to stop working.
  * Fixed a potential memory leak when closing thumbnails.
  * Fixed the app order number not updating correctly when pinning an app.
  * Focused thumbnails now use the outlined pseudo class, and are only indicated if more than one window from an app is open.

### 6.0.2

  * Fixed app button dragging not working correctly on Cinnamon 3.4.
  * Fixed the styling not resetting sometimes when pinned apps are closed.
  * Cinnamon 3.5 (dev): Updated window progress styling.

### 6.0.1

  * Fixed cycling thumbnail menus via the hotkey not working.
  * Fixed some apps indicating attention when they are first starting up.
  * Fixed focused title display mode showing all button labels.
  * Fixed app icon size preferences not being applied when labels are shown on buttons.
  * Fixed empty thumbnails being added to the hover menu.
  * Fixed labels not hiding when pinned apps are closed.

### 6.0.0

  * Reorganized and cleaned up a lot of code.
  * Disabled listing windows by monitor on the default configuration.
  * Fixed a couple performance bottlenecks during applet initialization, and cut down the start up time a lot.
  * Fixed an issue with window titles getting updated too frequently.
  * Fixed removing workspaces not having their corresponding objects in ITM removed.
  * Reduced a lot of redundancy in the focused window state handling logic.
  * Improved performance while switching between title display options.
  * Improved scaling for thumbnails on vertical panels.
  * Fixed the progress indicator being visible while inactive on some themes.
  * Fixed launchers being added through menu applets not being reflected in ITM.
  * Added support for pinning apps by dragging launchers from menu applets.
  * Added new thumbnail options for adjusting padding and the close button size.
  * Added an option to toggle the last active window thumbnail indicator in the thumbnail menu.
  * Known issues:
    * When repositioning the applet in panel edit mode on Cinnamon 3.2, the app buttons will become duplicated.
    * When label button modes are enabled, there isn't correct padding on pinned and inactive apps, or in focused mode, unfocused apps. Setting extra spacing in the options might help.
    * Restarting the applet through Melange or the dbus is not supported or guarunteed to be bug-free, and is only used during development. If you need to restart the applet, please restart Cinnamon.


### 5.3.3

  * Fixed a regression causing pinned unopened icons to have the wrong aspect ratio, or become off-center.
  * Fixed the number display still showing "1" after a pinned app is closed when number display is set to Normal or All.
  * Fixed the number display not showing on unopened pinned apps when it is set to All.

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