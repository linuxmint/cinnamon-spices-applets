# Changelog

## 2.3.5

* Fix for the "number bubble" showing up incorrectly after changing the UI scale settings in display setting application.
* Add a 2nd layer of code to try and ensure that the "Welcome Wizard" dialog does not reappear after a restart

## 2.3.4

* Saves new default thumbnail window sizes (adjusted using the mouse scroll-wheel) across cinnamon restarts
* Now uses application specific thumbnail windows sizes across all workspaces
* Changing the "Default thumbnail window size" setting will now reset all scroll-wheel set thumbnail sizes
* Fix the icon geometry so that it is set correctly in more (all?) cases

## 2.3.3

* Improve the window icon geometry update logic for more accurate minimize/unminimize animations. It's still not perfect, but this fixes most of the issues.

## 2.3.2

* Enable Cinnamon restore/minimize animation by setting window icon geometry
* Fix (hopefully) an exception seen opening a context menu under Mint 22
* Fix blurry icons caused by not respecting the panel setting colored icon size

## 2.3.1

* Added a window-list button context menu item to toggle the "Always on top" window state
* Added a "Always on top" mouse action option so you can configure a mouse button to toggle the window state

## 2.3.0

* Allow rearranging Thumbnail menu items using drag-and-drop
* Allow drag-and-drop of Thumbnail menu items to the desktop, matching the behaviour of window-list button drag-and-drop
* Add options for hiding button labels when the windows workspace/monitor is not the current workspace/monitor
* Fixed how labels are hidden for grouped buttons so that it's solely based on the current windows state
* Added an option to sort the Thumbnail menu for grouped buttons based on the Workspace & Monitor index (pools will not be sorted!)
* Fix a cases where Thumbnail menus can contain stale window titles or even contain windows that have been closed
* Fix to show labels for application pools where some, but not all, windows in the pool don't qualify to have a label
* Added 4 scroll-wheel actions options which applies when the scroll-wheel is used on a window-list button
* Renamed "Activate # window in grouped button" mouse actions to "Restore/minimize # window in group"
* Changed "Restore/minimize # window in group" so it will minimize the window if the window already has the focus
* Added a "Restore/Minimize 1st window in group" option to the "Left button action for grouped buttons" list of options

## 2.2.0

* Added support for drag-and-drop of window-list buttons to the desktop. This will move the window to the desktop that the drop occurred on. If you drop on a monitor where the window does not current reside, it will be moved to that monitor. If the window exists on a different workspace, it will be moved to the current workspace. If the window does not have the focus it will be activated and given the focus. Requires Cinnamon 5.4 (Mint 21.x)
* Added a "Move window here" context menu item and mouse action options. Using this feature will move the window to the current monitor (the monitor of the window-list) and to the current workspace, then the window will be given the focus.
* When appropriate, the Thumbnail menu items will now show the windows workspace and monitor number to the right of the window title. This will only appear when one of the window-list options are enabled that shows windows from other monitors/workspaces and only when there are more then one monitor/workspace available. The number(s) will appear in the order "(workspace#/Monitor#)" when both numbers are needed.
* When the "number label" is set to show workspace numbers and button is grouped, I fixed the "number label" so that it is updated when the focus changes causing the current window for the grouped button to change. This is needed in case the workspace for the newly focused window is on a different workspace than the previous most recently focused window of the group.
* Fixed the number of arguments passed to the API call for moving windows to other workspaces on older OS's (pre Cinnamon 5.4).


## 2.1.0

* Added an option to configure what the "number label" content represents (Window count, Workspace index or Monitor number).
* Added an option to show a vertical ellipsis character on grouped buttons to indicate a button represents a group of windows. Useful for users that decide to use the number label for Workspace/Monitor number and needs a new way to mark grouped buttons.
* Added 4 new mouse action options that will activate windows 1-4 of a grouped button
* Change the "2 or more window" option in the "Display number" drop-down to "Smart" so that it can apply to other number label options.
* Removed the "Display number" "Never" option as now the "Number Style" option can disable the number label
* In Launcher mode the "Number Style" option now appears but it's effects do not apply. This is because the dependency setting in the json only allows a single variable dependency and it is now dependant on the "Number Style" option. You can't use "and/or" logical operators to have better control when the option appears.
* Clarified the tooltip text for the "Hover time before showing a full size window preview" option. 

## 2.0.4

* When in button pooling mode with a thumbnail menu open showing more then one window, highlight the thumbnail menu item matching the window of the windlow-list button that is currently being hovered by the mouse pointer.

## 2.0.3

* Don't close then reopen an existing thumbnail menu when the mouse hover moves between different buttons in the same application pool (as long as the menu does have an item for the currently hovered button's window). This removes the useless thumbnail menu close then open sequence when using the application pooling behaviour.
* Print hotkeys in a pretty way for the button context menus "Assign window to a kotkey" submenu list.
* Minor fixes and optimizations

## 2.0.2

* Prevent the Thumbnail menu from grabbing the focus. This prevents odd cursor key behaviour and it allow the workspace hotkeys to work when the Thumbnail menu is open.

## 2.0.1

* Added a configuration option that controls the delay before the full size preview window appears
* For Cinnamon 6+, I removed the text on the Advanced tab describing a bug that effects the list widget on that tab. I fixed this Cinnamon bug in version 6.0 so there is no need for the message, (and this gives more GUI space for new options).
* Prevent the full size preview window from appearing when the context or thumbnail menu is open

## 2.0.0

* Added 9 mouse button actions for window tiling
* Added mouse button action to move a window to the current workspace
* Fixed several cases where the icon saturation effect was not changing to reflect a change in a window state
* Changed icon saturation effect for grouped window list buttons to only consider the last-focused window rather then requiring all window to have the same qualifying state before using the effect
* Changed how the applet was deciding on code paths for features that are only possible in newer releases. This fixes some issues when running on Cinnamon 5.x releases prior to 5.4.
* Added version numbering, started with version 2.0 based on the fact that I have already far exceeded the feature set that I originally set out to implement.
* Added a CHANGELOG.md file (you're looking at it now)

## 1.0.0+

* There was no version tracking prior to version 2.0.0
