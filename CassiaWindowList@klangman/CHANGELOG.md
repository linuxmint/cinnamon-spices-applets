# Changelog

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
