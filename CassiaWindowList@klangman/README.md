This is a Cinnamon window list and panel launcher applet based on CobiWindowList with a number of additional features designed to give you more control over how your window-list operates.

Recent new features (Aug 2023 - July 2024):

* Add "Always on top" item to the button context menu as well as "Always on top" mouse actions (Cinnamon 5.4+)
* Allow rearranging Thumbnail menu items using drag-and-drop, also allow dropping on the desktop
* Add options for hiding button labels when the windows workspace/monitor is not the current workspace/monitor
* Added an option to sort the Thumbnail menu for grouped buttons based on the Workspace & Monitor index
* Added 4 scroll-wheel actions options which applies when the scroll-wheel is used on a window-list button
* Added "Restore/Minimize 1st window in group" option to the "Left button action for grouped buttons" option list
* Support "drag-&-drop to desktop" which will move a window to the workspace & monitor it's dropped on
* "Move window here" context menu/mouse action options to move a window to the current monitor/workspace
* Thumbnail menu items will now show the windows workspace/monitor number(s) when appropriate
* Added an option to configure the "number label" contents (added workspace and monitor number options)
* Added an optional vertical ellipsis character to indicate a window-list button is grouped
* Added 4 new mouse action options that will activate windows 1-4 of a grouped button
* Added a configuration option to set the delay length before showing full size preview windows
* Mouse action options for window tiling, untiling and moving window to current workspace
* Hover peek: Option to show a full size preview when hovering buttons/thumbnails
* No Click activate: Option to automatically switch focus to the button/Thumbnail last hovered
* Adjustable spacing between window-list buttons
* Ability to disable the new window animation
* Ability to change the icon saturation from grayscale (0%) to vivid (200%)
* Ability to show windows from other workspaces
* Restores custom group/ungroup application setting after reboot/cinnamon-restart
* Hotkey option to assign a set of 1-9 hotkeys to all window-list buttons
* Hotkey hints using the (`) grave key with any registered hotkey modifiers
* Added a Left-Click option to start new application windows in Launcher mode
* Ability to show a common set of pinned buttons on all workspaces
* Smart numeric hotkeys to assign a set of 1-9 hotkeys to a specific application
* A bunch of fixes

The design goals are to:

1. Allow you to declutter your window list when running many windows without having to do without button labels
2. Keyboard hot-keys to switch to specific windows so you don't have to reach for the mouse so often
3. Allow you to make full use of your mouse buttons to interact with the window list
4. A panel launcher that will activate existing windows rather then unconditionally launching new ones

## Requirements
This applet requires at least Cinnamon 4.0 but Cinnamon 6.0 is recommended

## Installation
1. Right click on the cinnamon panel that you wish to add the CassiaWindowList to and click "Applets"
2. Click on the "Download" tab and select "Cassia Window List" and then click the install button on the right
3. Click on the "Manage Tab"
4. You most likely will want to disable the existing window-list applet you are using
5. Select the "Cassia Window List" entry and then click the "+" button at the bottom of the Applet window
6. The CassiaWindowList Basic Setup Wizard window will appear, follow the instructions to configure to your liking
7. Right click on the cinnamon panel and use "Panel edit mode" to enable moving the window-list within the panel
8. More configuration options: Right-click on any window-list button, "Applet Preferences" ->  "Configure..."

## Features
In addition to the features of the CobiWindowList...

 * Hotkeys: Assign hotkeys to windows and applications so you can switch-to/minimize/start application windows using the keyboard
 * Application pooling: Keeps all window list buttons from the same application together side by side
 * On demand application grouping: Allows for Group/Ungroup application windows on the fly
 * Label pooling: Show only one label when adjacent windows are for the same application
 * Automatic grouping/ungrouping: Group/ungroup windows for an application based on available space in the window list
 * Zoomable thumbnail windows: Thumbnail windows can be zoomed in or out using the mouse scroll wheel
 * Configurable mouse button actions for the middle, forward and back mouse buttons
 * Configurable Ctrl/Shift + mouse button actions for all 5 mouse buttons
 * One character unicode indicators characters to indicate group window count, minimized status and pinned status
 * Total control over which window-list buttons have labels, and what the label contents are
 * Automatic configuration backup so you can restore your configuration after adding the applet to a panel again
 
## Feedback
You can leave a comment here on cinnamon-spices.linuxmint.com or you can create an issue on my CassiaWindowList development GitHub repository:

https://github.com/klangman/CassiaWindowList

This is where I develop new features and test out any new ideas I have before pushing to cinnamon-spices.

If you use this applet please let me know by liking it here and on my Github repository, that way I will be encouraged to continue working on the project.

