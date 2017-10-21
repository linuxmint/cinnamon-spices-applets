Workspace grid (2D) and switcher  v0.8
========================================
2D workspace grid and switcher for Cinnamon Desktop Environment

Author:   Jason J. Herne  (hernejj@gmail.com)
Homepage: http://github.com/hernejj/workspace-grid-cinnamon-applet

Description
-------------
This is a Cinnamon applet that implements a 2D workspace grid and provides a
workspace switcher that understands multiple rows.  In addition, the standard
keyboard shortcuts for workspace up/down navigation are modified to actually
switch workspaces instead of bringing up the Cinnamon Workspace Expo and
Overview.

Portions of this code were adapted from the workspace-switcher@cinnamon.org
applet created by the Cinnamon Team: http://cinnamon.linuxmint.com/

Portions of this code were adapted from the Gnome Shell Frippery Bottom Panel
extension created by rmyorston: 
https://extensions.gnome.org/extension/3/bottom-panel/

Compatibility
--------------
This applet has been tested to be compatible with the following versions of
Cinnamon and Linux distributions:
    Linux Mint 17 - Cinnamon 2.2
    Linux Mint 16 - Cinnamon 2.0

Installing
-----------
1. Place the "workspace-grid@hernejj" folder in the 
   ".local/share/cinnamon/applets" folder in your home directory.

2. Restart Cinnamon either by using Alt+F2, then hit 'r' then the enter key. Or
   simply log out and log back in.

3. Start the "Cinnamon Settings" program, go to the Applets section and look
   for the entry named "Workspace grid (2D) and switcher".  Check the checkbox
   to the left of this entry to enable this applet.

Setting the Number of Workspaces
--------------------------------
This applet allows you to configure the number or rows and columns in your
workspace grid.  Just right click on the applet and choose "Configure..."
and a dialog will appear. Enter the number of columns and rows you want and
click the close button. The maximum number of workspaces supported by this
applet is 12 columns by 6 rows.

Choosing the Style
-------------------
There are currently two visual styles to choose from.

Single Row: Workspaces are shown to you a single row at a time. A Row indicator
is present to let you know what row you are in.

Grid: A grid view of all existing workspaces. The workspaces in this style can
get quite small if you have more than a few rows.

Navigating
-----------
You can navigate between your workspaces using the standard system keyboard
shortcuts.  By default they are as listed:

    switch-to-workspace-up      Ctrl+Alt+Up_Arrow
    switch-to-workspace-down    Ctrl+Alt+Down_Arrow
    switch-to-workspace-left    Ctrl+Alt+Left_Arrow
    switch-to-workspace-right   Ctrl+Alt+Right_Arrow
    
You can also click on the workspace or the row indicator lines within the
switcher to navigate directly to a specific workspace or row.

You can also place your mouse over the switcher and use the scroll wheel to
navigate forward and backward in the workspace grid.

By default, this applet conflicts with and disables the Expo and Scale keyboard
shortcuts. There is a setting in the settings dialog to disable this behavior.

WARNING: Using Expo (or anything other than this applet) for adding/removing
workspaces will cause Cinnamon to crash! While using this applet ONLY add/remove
desktops via the applet's settings window.

License
-----------
This application is released under the GNU General Public License v2. A full
copy of the license can be found here: http://www.gnu.org/licenses/gpl.txt  
Thank you for using free software!

Change Log
-----------
v0.8:
    - Bugfix: Fixed mouse scrolling when scrolling by column.
v0.7:
    - Added setting to choose direction to move when using mouse wheel
    - Bugfix: Stop trying to handle externally +/- desktops. Was broken!
    - Bugfix: Deregister event handlers when switching ui styles
v0.6:
    - Multiple visual styles to choose from: single row and grid
    - Maximum number of columns increased from 6 to 12.
    - Remove reliance on external stylesheet and performance limiting hack
    - Applet colors now based on Cinnamon theme
    - Bugfix: Watch for and correct any externally added/removed desktops
v0.5:
    - Added support for Cinnamon Settings API.
    - Added option to keep original scale/expo keyboard shortcuts
    - Removed hackish "configuration icon".
    - Removed old style key binding registration. Breaks on very old distros.
v0.4:
    - compat: Remove right-click to configure for Cinnamon 2.2 compatibility
    - Compat: Add configuration via left-click on new icon.
    - Don't override theme style for better theme integration.
    - Workaround for "theme change makes row indicator disappear" bug.
v0.3:
    - Bugfix: Removed css junk that was messing up bottom panel style.
    - Bugfix: Allow applet to properly resize with bottom panel.
v0.2:
    - Added key binding support for Linux Mint 13 & Cinnamon 1.4.0.
    - Added some debug logging to assist with future incompatibility problems.
v0.1:
    - Initial release.

