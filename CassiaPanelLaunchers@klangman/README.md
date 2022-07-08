This is a panel launcher applet for Cinnamon based on CinnamonPanelLaunchers with a number of additional features

## Requirements
This applet has only been tested on Cinnamon 5.0, but I suspect it works on 4.0

## Installation
1. Download the latest release
2. Decompress the zip into the cinnamon applets directory
    ```
    cd ~/.local/share/cinnamon/applets/
    unzip ~/Downloads/CassiaPanelLauncher.zip
    ```
3. Right click on the cinnamon panel that you wish to add the CassiaPanelLaunchers to and click "Applets"
4. You might want to disable the existing panel launchers applet if you are using one currently
5. Select the "Cassia Panel Launchers" entry and then click the "+" button at the bottom of the Applet window
6. Use the "gears" icon to open the Cassia Panel Launchers setting window and setup the preferred behaviour
7. Right click on the cinnamon panel and use "Panel edit mode" to enable moving the applet within the panel

## Features
Just like the default Cinnamon Panel Launchers applet, the Cassia Panel Launchers applet allows you to add application icons to a
Cinnamon panel so that you can quickly launch applications. The key difference is that Cassia Panel Launcher keeps track of
the running windows for each application added to the applet and allows you to switch to those windows rather then just launching
new windows (but you can assign another mouse button to launch a new window giving you quick access to start new windows). 
In this way it works much like a window-list only without showing icons for any windows that were not added to the applet.

 * Quickly launch applications with a single click on a panel icon
 * Switch to existing windows rather then creating new windows
 * Popup thumbnail menu list of running windows for an application
 * Highlights the the application icon of an in focus application
 * Highlights the application icons with running windows
 * Shows a number badge with the number of running windows
 * Thumbnail windows menu can be zoomed in or out using the mouse scroll wheel
 * Custom button actions for the left, middle, forward and back mouse buttons
 * Custom thumbnail actions for the middle, forward and back mouse buttons
 * Coordinates with the Cassia Window List applet allowing you to remove window list entries for applications that are also on the Cassia Panel Launchers applet

