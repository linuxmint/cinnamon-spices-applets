= DESCRIPTION =
This applet adds an icon in the cinnamon panel which toogle a list of your favorite folders places when you click on the icon.
This folders list is completly customisable.
To edit the folders list, right click on the icon and select Edit.
To know how to edit the setting file, read the following instructions : 


= SETTINGS =
The places.json file is a data representation of the Custom Places Menu.
Each line represent a place entry.

 * path: folder path
 * iconName: name of the displayed icon, "folder" by default
 * displayName: name displayed in the menu, the folder name by default

== Special path ==
{ "path":"S" } is used to create a separator

$HOME will be replaced by the user home directory
$DOWNLOAD will be replaced by the user download directory
$VIDEOS will be replaced by the user videos directory
$PICTURES will be replaced by the user pictures directory
$MUSIC will be replaced by the user music directory

== non-ASCII caracters ==
There is a problem with non-ASCII caracters in path. Ex: é in ~/Téléchargements will be converted to ~/TÃ©lÃ©chargements
as the path is not correct, it won't be able to open it
