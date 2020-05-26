DESCRIPTION
========
This applet adds an icon in the cinnamon panel which toggle options to:
 * shutdown
 * suspend
 * hibernate
 * hybrid sleep
 * reboot
 * switch users
 * log out
 * screen lock 
There is no confirmation messages on click!

SETTINGS
========
To add, remove or modify the menu items, do a right-click on the applet and choose 'Settings'
This will open the Cinnamon applet settings window for "Shutdown Menu With Icons":
Check the corresponding box to add an item and uncheck it to remove an item.
Change the icons by replacing the icon name by another one or browse to an icon file.
Change the commands by replacing the command by another one.
Changes are immoderately taken into account.

To change the order of the menu items or to change the command binded to an item, 
edit the "applet.js" file and go into the "createMenu" function.
This way, you need to restart Cinnamon to apply changes (Alt+F2 -> r), or to remove and add again the applet.
