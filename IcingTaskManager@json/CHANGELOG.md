Changelog

### 6.3.14

  * Added a deprecation notice notification for Cinnamon 4.0 users.
  * Added migration functionality for moving local pinned apps from ITM to Grouped Window List in Cinnamon 4.0. This can be accessed by clicking "Migrate Pinned Apps to Grouped Window List" from ITM's settings.

### 6.3.11

  * Fixed an issue with the applet not initializing when an open app can't be resolved by wm_class.

### 6.3.10

  * Fixed an issue with pinned applications becoming ordered incorrectly when uninstalled applications are present.
  * Corrected a warning occurring during context menu initialization.

### 6.3.9

  * Fixed scaling of thumbnails when removing windows.
  * Updated readme.

### 6.3.8

  * Fixed inability to see hover previews when thumbnails are disabled.
  * Addressed an issue affecting apps that defer passing window metadata to Muffin, such as Spotify.

### 6.3.7

  * Addressed an issue with the focus pseudo class styling reverting on hover.
  * Made the Mint X theme preset the default.

### 6.3.4

  * Fixed the window title label not switching to a window when it sets the urgent hint. Windows that set themselves as urgent will be the next window to be focused when their app button is clicked.
  * Made the default launcher animation none, since apps seems to launch a bit faster with the effect disabled.
  * Fixed shortcut creation.
  * Forked the current tree into a version compatible with only Cinnamon 3.8. Bug fixes will continue for Cinnamon 3.4-3.6 users until Mint 19 is released.

### 6.3.3

  * Fixed thumbnail key navigation.
  * Fixed LibreOffice apps being grouped incorrectly.

### 6.3.2

  * Fixed a DND regression from 6.1.0.

### 6.3.1

  * Fixed an issue that could impact users of Cinnamon on CJS 3.2.

### 6.3.0

  * Fixed an issue with hovering over the thumbnail close button causing the window preview to flicker.
  * Addressed an issue with JavaEmbeddedFrame appearing in the window list.
  * Added launcher animation effect options.

### 6.2.2

  * Fixed focused window indication not being preserved when hovering over a button, and focused window indication being added when no windows are focused in some theme cofigurations.
  * Fixed button labels not being preserved.

### 6.2.1

  * Fixed regressions occurring in some situations:
    * Context menus not opening
    * Thumbnails not displaying correctly
  * Fixed ITM not completing its initial load while system favorites are enabled during a Cinnamon restart.

### 6.2.0

  * Fixed windows from all workspaces showing, and added an option to show all workspaces.
    - Also properly handles sticky windows that are marked as visible on all workspaces.
  * Fixed per-monitor window mode not working correctly on the primary monitor.
    - When toggling this setting, it will now take effect on all ITM instances.
  * Fixed  pinning/unpinning apps in ungrouped app mode.
  * Added an option to disable icons in the thumbnail menu.
  * Added an option to scroll windows while hovering over an app's thumbnail menu.
  * Added a transition duration override option for app buttons, and the option to a assign the checked pseudo class as an override.
  * Added an option to show a "New Window" context menu item.
  * Improved theme compatibility for the closed pinned app styling.
  * Fixed multiple app buttons receiving focus styling in some scenarios (6.1 regression).

### 6.1.0

  * Fixed dragging pinned apps not working correctly when uninstalled apps are in the list.
  * Fixed the focused styling on app buttons getting reset when hovered over.
  * Fixed being unable to distinguish between open and closed apps in some themes.
  * Added options to scroll apps or windows with the mouse wheel, and cycle windows with left click.
    - The middle click action option was converted to a drop down list. As a result you will need to re-set your preference for that option. New installs should receive the proper default.
  * Added a recommended preset for Mint X based themes.
  * The legacy version of ITM is now being loaded for Cinnamon 3.2 users due to a compatibility issue. Please update Cinnamon to version 3.4+ to continue using the newest version of ITM.
  * Minor optimizations.

### 6.0.4

  * Added info to the Firefox context menu when gir1.2-gda-5.0 isn't installed.
  * Fixed switching between title display settings not working properly.
  * Fixed text flicker occurring in the "Focused" title display mode.
  * Fixed window titles not updating when windows from a group are closed while button labels are enabled.

### 6.0.3

  * Fixed a regression causing the Super + Number hotkey behavior to stop working.
  * Fixed a regression breaking the enable icon size toggle.
  * Fixed a potential memory leak when closing thumbnails.
  * Fixed the app order number not updating correctly when pinning an app.
  * Improved the app icon appearance in high DPI mode.
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