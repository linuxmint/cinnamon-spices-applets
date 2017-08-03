### 4.6.2

  * Fixed icon sizing in high DPI mode.

### 4.6.1

  * Fixed a bug preventing some apps, such as Transmission, from having their app button removed from the panel after they are closed.
  * Fixed a couple warnings when windows are minimized through ITM.

### 4.6.0

  * Added support for Cinnamon's minimize animation positioning.
  * Improved timer handling.
  * Fixed orphan St.Label errors.

### 4.5.1

  * Removed extra tooling causing performance issues.
  * Unified the code so one version of the applet runs on Cinnamon 2.8-3.4.

### 4.5.0

  * Fixed thumbnail sizes becoming incorrect when windows are resized.
  * Improved thumbnail scaling when windows are added or removed.
  * Added an option that controls whether or not apps are pinned on drag.
  * Miscellaneous performance improvements.

### 4.4.1

  * Russian translation update by Faust30000.
  * Removed the auto updater functionality.

### 4.4.0

  * Polish translation update by [mariachini](https://github.com/jaszhix/icingtaskmanager/pull/104).
  * Croatian translation by [muzena](https://github.com/linuxmint/cinnamon-spices-applets/pull/160).
  * Added an option to toggle the middle mouse buttion action between opening a new app and closing the last focused app.
  * Updated translations.

### 4.3.4

  * Polish translation by [mariachini](https://github.com/jaszhix/icingtaskmanager/pull/99).
  * Fixed app buttons not appearing correctly when LibreOffice and Spotify are in use.
    * LibreOffice apps started from the Start Center will spawn from that button, even if other LibreOffice apps are pinned.
  * Fixed pinned apps disappearing when the "Group apps" option is disabled.
  * Fixed a bug causing empty spaces to stay present when disabling thumbnails, while vertical thumbnail orientation is enabled.
  * Fixed a bug that can cause the right click menu to stick and freeze the applet.
  * Simplified the locale installation process.

### 4.3.3

  * Russian translation update by [ArionWT](https://github.com/jaszhix/icingtaskmanager/pull/96).
  * Updated the Lodash dependency to 4.17.4, and modified it to prevent CJS warnings.

### 4.3.2

  * Fixed a bug causing new LibreOffice windows to not be shown.
  * German translation update by [SethosII](https://github.com/jaszhix/icingtaskmanager/pull/93).
  * Added compatibility checks for the experimental Classic Gnome project.

### 4.3.1

  * Added an option to use system tooltips for closed apps under Theme Settings.
  * Fixed a bug causing the thumbnail menu cycling hotkey option to disappear when using importPinned.py or creating a shortcut through the applet.
  * Fixed the button label padding being off when title display is enabled.
  * Fixed incorrect app button width being applied when changing the title display setting.
  * Fixed stale thumbnails persisting after their window is closed when "Sort windows for each app by last focused" is disabled.

### 4.3.0

  * Added a menu item type option dropdown controlling the style of icons, or their visibility.
  * Moved the pinning, autostart, and shortcut creation options from the Preferences sub-menu to the main menu list.
  * Re-merged the "Close"/"Close all" menu options like in the old context menu to avoid having three different close options for apps with multiple windows.

### 4.2.4

  * Fixed a regression causing thumbnail menus to close too early.

### 4.2.3

  * Re-implemented "open thumbnails on click" option functionality that was in the original version.

### 4.2.2

  * Fixed a regression causing closed pinned apps to move out of order.
  * Implemented better thumbnail scaling for vertical panels.
  * Thumbnail menu directional keys now change to up/down for selection on vertical panels, and the key for closing the menu changes depending the side of the screen the panel is on. E.g., bottom orientation is the down key.

### 4.2.1

  * Fixed a bug causing the app order to be incorrect when pinning/unpinning apps.

### 4.2.0

  * Added a configurable app thumbnail menu cycling hotkey. The default is Super + Space.
  * Added directional button controls for cycling window selections in the thumbnail menus.
    * Left/Right - select window
    * Down - close thumbnail menu
    * Enter - activate window
  * Added more theme settings to help increase compatibility among all themes.
  * Improvements in how the applet cleans up stale events and objects.
  * Added an automatic self updating mechanism that checks the Github repository for newer releases. This is disabled by default.
  * Fixed a bug causing duplicate thumbnails to appear.
  * Updated translations.

### 4.1.3

  * Window thumbnail enhancement by [zqq90](https://github.com/jaszhix/icingtaskmanager/pull/71):
    * Highlights the focused window's thumbnail.
    * Shows the thumbnail menu when switching windows using the Super+# hot keys.

### 4.1.2

  * Fixed a bug that can prevent pinned apps from being dragged.
  * Corrected the icon padding looking off-centered in some themes.
  * Updated translations.

### 4.1.1

  * Added a new option allowing you to apply the monitor move option to all windows.
  * Fixed a bug that prevents some users from using the settings dialog.

### 4.1.0

  * Fixed the wrong windows appearing active when switching to a new workspace while the group apps option is disabled.
  * Fixed window thumbnails not sorting by last active window when the sort thumbnails option is enabled.
  * The default icon padding is now more dependent on the theme's icon padding, and it will reset when changing themes
  * New feature by [zqq90](https://github.com/jaszhix/icingtaskmanager/pull/64):
    * Added a new assignable hotkey to show the order of apps with Super + ` by default.

### 4.0.9

  * Bulgarian translation added by [AdmiralAnimE](https://github.com/jaszhix/icingtaskmanager/commit/5e59cb1595c600db135cb8f841f167598708d565).

### 4.0.8

  * Simplified Chinese translation added by [zqq90](https://github.com/jaszhix/icingtaskmanager/pull/60).

### 4.0.7

  * German translation corrections by [NoXPhasma](https://github.com/jaszhix/icingtaskmanager/pull/59).

### 4.0.6

  * Fixed app pinning not working after toggling an app's pinned state several times.
  * Updated Lodash dependency.

### 4.0.5

  * App key binding (Super+#) changes by [zqq90](https://github.com/jaszhix/icingtaskmanager/pull/58).
    * Pressing an app key binding will cycle through an open app's windows.
    * Fixes app key bindings only working in the last workspace.

### 4.0.4

  * App key binding (Super+#) bug fix by [zqq90](https://github.com/jaszhix/icingtaskmanager/pull/57).
    * Fixes app key bindings becoming out of sync after dragging apps.
    * Fixes app key bindings not working after pinning apps via dragging.

### 4.0.3

  * Added a missing menu separator between Preferences and window controls on window backed apps.
  * Removed deprecated keyboard shortcuts for moving windows between monitors.

### 4.0.2

  * Moved Preferences above the window action options in the context menu.

### 4.0.1

  * Fixed stale thumbnails sometimes lingering after closing a window.
  * Fixed alerts not showing when active app indicators are enabled.
  * Removed the context menu width/number of items options due to incompatibility with the new menu.
  * Adjusted the stepping increment for the thumbnail timeout option to 5ms.

### 4.0.0

  * The left mouse button controls icon dragging again, and the middle mouse button launches new instances of apps.
  * Window thumbnails now scale instead of stacking when screen space is exceeded.
  * Replaced the context menu with a modified version of the default window list applet for Cinnamon 3.2. This stops the Clutter warnings appearing in ```.xsession-errors```, and improves the applet's performance. Autostart, pinning, and shortcut options have been moved to the "Preferences" sub-menu. Recent items, files, and Firefox history also have their own sub-menus now.
  * Added a new option to show active app indicators.
  * Fixed the thumbnail timeout option requiring a Cinnamon restart to take effect.
  * Fixed the window fade time option having no effect.
  * German translation correction by [NoXPhasma](https://github.com/NoXPhasma).

### 3.5.1

  * Fixed a bug that can prevent the applet from starting if no user-created autostart options have been set.

### 3.5.0

  * Added an autostart option to the app context menu. It can be disabled in settings.
  * The close context menu option will switch to "Close All" if more than one window is open. The option to show the close all menu item separately has been removed.
  * Updated translations.

### 3.4.3

  * Fixed a bug that can cause the panel to freeze when unpinning an app.

### 3.4.2

  * Fixed a line error.

### 3.4.1

  * Fixed a bug that can cause Cinnamon to crash when moving an app, then pinning it. You are strongly advised to upgrade if you are on version 3.4.0.
  * Added missing key to JSON importation utilities.

### 3.4.0

  * Fixed recent items not updating.
  * Fixed the applet freezing Cinnamon momentarily when a file is saved in certain situations.
  * Fixed pinning and unpinning apps causing the applet to freeze.
  * Improved the responsiveness of the applet when settings are changed.
  * Fixed a bug causing the applet to break when the "Show pinned apps" option is enabled, and the button title display option is not "None".
  * Fixed Firefox metadata not showing up in its context menu when Gda is installed.
  * Fixed an exception occuring on init.
  * Fixed the importPinned.py utility.
  * Fixed shortcut creation for window backed apps.

### 3.3.1

  * Fixed workspace switching in Cinnamon 3.2.
  * Fixed Spotify's windows not showing properly.

### 3.3.0

  * New "Include all windows" option allows you to see all of an app's windows in the thumbnail list, such as exit confirmation and file dialog windows.
  * Fixed monitor move options not appearing on applet init.
  * Improved start up time of the applet.
  * Corrected the padding of unopened pinned apps on vertical panels.
  * Added a fix by [jeweloper](https://github.com/jeweloper) for unopened pinned app titles being truncated on hover.

### 3.2.5

  * Separated spacing and padding settings controls for app buttons.
  * Fixed the width of app buttons changing when an app is closed.
  * Updated missing translations for Spanish, German, French, Russian, and Hebrew using Google Translate. If a translation for your language is off, please submit an issue, or a pull request if you are familiar with POT files.

### 3.2.4

  * Re-implemented the theming of the window thumbnail close button. You can enable this option in the settings.

### 3.2.3

  * Re-implemented the ability to un-group apps. Because a lot of code dealing with this was removed from the original version for whatever reason, I found a different solution to achieve this. For now, consider this option a beta mode, and please report issues on the [Github repo](https://github.com/jaszhix/icingtaskmanager/issues).

### 3.2.2

  * Fixed the applet orientation not updating when moving between vertical and horizontal panels.
  * Hover peek shows windows on all monitors again, but only opacifies windows on the monitor the shown window belongs to.
  * Fixed icon sizes not updating on panel height change.
  * The vertical thumbnails option will now be automatically toggled when moving the applet between vertical or horizontal panels, but if the setting is changed, it will stay until the applet is moved to a different orientation again.
  * Unlimited instances of the applet can now be enabled.
  * Partial fix for off-center CSS on vertical panels.

### 3.2.1

  * Fixed a bug causing window backed app buttons to become unresponsive on non-bottom orientation panels in Cinnamon 3.2.

### 3.2.0

  * Added the ability to create shortcuts for window backed apps with a generated icon. This means you can now pin Wine apps, and other apps Cinnamon doesn't know how to relaunch. You must have gnome-exe-thumbnailer installed for icon generation to work. Shortcuts are added to ```~/.local/share/applications```, and icons are saved to ```~/.local/share/icons/hicolor/48x48/apps```. After a shortcut is created and pinned, you must relaunch the app with the pinned launcher to not see duplicate icons.
    * Wine apps running from a non-default prefix is not tested.
  * Fixed a critical bug in importPinned.py.

### 3.1.3

  * Fixed a bug preventing the extension from seeing the last focused window.

### 3.1.2

  * Fixed the wrong window number being displayed after closing an app, when the number display option is Normal or All.
  * Specific fix for Steam in Big Picture Mode, clicking its thumbnail would make it impossible to activate the window through the hover menu while hover peek was on.
  * Removed the "Install Gda" option in the Firefox context menu as FF history feature from the old fork is not known to be working currently, and may be removed later.
  * Enabling the "Enable icon size" option now updates the icon sizes. Disabling requires a Cinnamon restart or extension reload currently.
  * App icons now do not leave the panel area when they are being dragged.

### 3.1.1

  * Fixed a regression causing double icons to appear after switching workspaces.
  * Fixed the right-click menu settings not updating persistently.

### 3.1.0

  * Apps are now draggable using the middle mouse button.
  * Added vertical panel support for Cinnamon 3.2, along with various internal changes for compatibility.
  * Limited recent items in the context menu to 10 items.

### 3.0.10

  * Rewrote parts of the window list handling.
  * Performance improvements.
  * Localization fixes by [Pandiora](https://github.com/jaszhix/icingtaskmanager/pull/27)

### 3.0.9

  * Fixed app button notification indication.
  * Fixed text not showing beside the app button icons when title display is enabled.
  * Fixed super key + 1 command opening the second pinned app.
  * Quick setting sub-menu icon no longer leaves its allocated area.
  * Changing the icon size setting now updates the applet, and no longer requires restarting Cinnamon.
  * Adjusted the icon padding so icons are more centered.
  * Transient windows that cannot be pinned do not have a pinned option anymore. This may be changed later.

### 3.0.8

  * Partial rewrite of app list and pinned app handling.
  * Added minimize and maximize menu options.
  * Moving windows to monitors through the context menu now brings them to the foreground.
  * Hover Peek now only opacifies windows on the primary monitor.
  * Added a utility to the repository allowing users to import their pinned apps automatically from the original fork.

### 3.0.7

  * Improved the behavior of app button window toggling.
  * Clicking "Move to monitor" now will move all of an app's windows to the specified monitor if more than one is open.
  * Removed option to move an app's windows to the monitor its already on.

### 3.0.6

  * Added ability to toggle an application's window by clicking on its app button.

### 3.0.5

  * German translation added by [Pandiora](https://github.com/jaszhix/icingtaskmanager/pull/4)

### 3.0.4

  * Fixed number display regression.

### 3.0.3

  * Added French translation by [ncelerier](https://github.com/jake-phy/WindowIconList/pull/165)
  * Corrected punctuation and grammatical errors in the settings dialogue.
  * Changed the default option for the number display setting to "Smart".

### 3.0.2

  * Added Russian translation by [magnetx](https://github.com/mswiszcz/WindowIconList/pull/1)

### 3.0.1

  * Disabled hover peek by default. It is a more conservative default setting, and the effect can be overwhelming on multi-monitor setups.

### 3.0.0

  * Ability to move windows between monitors is now fixed.
  * More theme-agnostic close button than the one found on the development branch.
  * Integrated a [pull request](https://github.com/jake-phy/WindowIconList/pull/155) by mswiszcz, added optional icon size control.
  * Formatting of code for readability.