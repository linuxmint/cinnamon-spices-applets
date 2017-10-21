DESCRIPTION
========
This applet adds an icon in the cinnamon panel which toogle a list of applications when you click on the icon.
This applications list is completly customisable.
To edit the applications list, right click on the icon and select Edit.
To know how to edit the setting file, read the following instructions : 


SETTINGS
========
The applications.json file is a data representation of the Custom Applications Menu.
Each line represent an applications entry.

 * desktopFile:
    The name of a desktop file in the folder '/usr/share/applications' or '~/.local/share/applications'.
    Used to get the command, display name and icon name.
    These data won't override the command, display name or icon name if they are explicitly defined.
 * command:
    The command line to execute
 * iconName:
    The name of a themed icon or absolute path to an icon file, by default the 'image-missing' themed icon
 * displayName:
    The name displayed in the menu, by default the same as first word in command
 * active:
    true or false. Allow to deactivate an application. Useful because JSON doesn't allow comments.

Special command
========
{ "command":"S" } is used to create a separator

Special entry
========
menu may be used to create a sub-menu:
{ "displayName":"sub-menu", "iconName":"applications-internet", "menu": [
    { "desktopFile":"firefox" },
    { "desktopFile":"filezilla" }
]}
By default the iconName is 'image-missing' and displayName is 'sub-menu'


non-ASCII caracters
========
There is a problem with non-ASCII caracters in properties.
