## Quick Menu applet description

The function of this applet is very simple, create a menu based on the files/folders found inside a main folder (specified on this applet settings window). The files will be used to create menu items and the sub folders will be used to create sub-menus.

I mainly created this applet to replicate the functionality of the XFCE plugin called **Directory Menu** and the KDE widget called **Quick access**.

<h2 style="color:red;"> Warning</h2>
<span style="font-weight:bold; color:red;">
This applet has to read every single file/folder inside a main folder to create its menu. So, do not try to use this applet to create a menu based on a folder that contains thousands of files!!! Your system may slow down, freeze or even crash!!!
</span>

## Compatibility

- ![Cinnamon 2.8](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Cinnamon-2.8.svg) ![Linux Mint 17.3](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Linux_Mint-17.3.svg)
- ![Cinnamon 3.0](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Cinnamon-3.0.svg) ![Linux Mint 18](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Linux_Mint-18.svg)
- ![Cinnamon 3.2](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Cinnamon-3.2.svg) ![Linux Mint 18.1](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Linux_Mint-18.1.svg)

## Features

- More than one instance of this applet can be installed at the same time.
- A hotkey can be assigned to open/close the menu.
- Menu items to .desktop files will be displayed with the icon and name declared inside the .desktop files themselves.
- The menu can be kept open while activating menu items by pressing **Ctrl** + left click or with middle click.
- This applet can create menu and sub-menu items even from symbolic links found inside the main folder.

## Options

![Settings window](https://raw.githubusercontent.com/Odyseus/CinnamonTools/master/Applets/0dyseus%40QuickMenu/screenshot2.png "Settings window")

#### Applet settings

- **Choose main directory:** Choose a directory with files and/or folders in it. The files will be used to create the menu items. The folders will be used to create sub-menus.
- **Custom Tooltip:** Set a custom tooltip for the applet.
- **Show Applet icon.:** Display this applet icon.
- **Icon for Applet:** Set a custom icon for the applet.
- **Show Applet title.:** Display this applet title.
- **Title for Applet:** Set a custom title for the applet.

#### Menu settings

- **Keyboard shortcut to open and close the menu:** Sets a hotkey to open/close the menu.
- **Icon for sub-menus:** Set a custom icon for the sub-menus.
- **Style for sub-menus:** Set a custom style for the sub-menus. After changing this setting, the menu has to be updated manually (**Update menu** item from the applet context menu).
- **Style for menu items:** Set a custom style for the menu items. After changing this setting, the menu has to be updated manually (**Update menu** item from the applet context menu).
- **Auto-update menu.:** If enabled, every time the menu is opened, the applet will scan the main folder for added/deleted/modified files/folders and rebuild the menu. If disabled, the menu has to be updated manually from its context menu.
- **Show only .desktop files:** If enabled, only .desktop files will be used to create the menu. If disabled, all file types will be used to create the menu.
- **Show hidden files:** If enabled, hidden files will be used to create menu items.
- **Show hidden folders:** If enabled, hidden sub folders will also be used to create sub-menus.
- **Show sub-menu icons:** If disabled, all sub-menu items will be created without icons.
- **Show menu items icon:** If disabled, all menu items will be created without icons.
- **Allow sub-menus to each have their own icon:** Read the section called *How to set a different icon for each sub-menu* for details about the usage of this option.
- **Name for the file containing the icons for sub-menus:** Read the section called *How to set a different icon for each sub-menu* for details about the usage of this option.
- **Ignore sub folders:** If enabled, the sub folders found inside the main folder will be ignored and sub-menus will not be created.
- **Auto-hide opened sub-menus:** If enabled, the previously opened sub-menu will be automatically closed. It will only work with sub-menus created at the first level. Sub-menus inside other sub-menus are not affected.

#### Image featuring different icons for each sub-menu and different icon sizes

![Image featuring different icons for each sub-menu and different icon sizes](https://raw.githubusercontent.com/Odyseus/CinnamonTools/master/Applets/0dyseus%40QuickMenu/screenshot3.png "Image featuring different icons for each sub-menu and different icon sizes")

<h2 style="color:red;"> Bug report and feature request</h2>
<span style="color:red;">
Spices comments system is absolutely useless to report bugs with any king of legibility. In addition, there is no notifications system for new comments. So, if anyone has bugs to report or a feature request, do so on this xlet GitHub page. Just click the **Website** button next to the **Download** button.
</span>

## Change Log

##### 1.06
- Fixed menu breakage after changing main folder under Cinnamon 3.2.x.

##### 1.05
- Improved support for Cinnamon 3.2.x.
- Improved hotkey handling.
- Improved application's icon recognition for use on the menu items.
- Improved support for files launching. Now, if there isn't a handler for certain file types, the **"Open with"** dialog will appear.
- Added support for symbolic links.
- Fixed the display of symbolic icons for the applet.

##### 1.04
- Added option to auto-hide opened sub-menus.
- Added option to keep the menu open after activating a menu item. This isn't a configurable option.
- Some code cleaning/corrections.

##### 1.03
- Added support for localizations. If someone wants to contribute with translations, inside the Help section of this applet (found in the applet context menu or the Help.md file inside this applet folder) you will find some pointers on how to do it.

##### 1.02
- Fixed the known issue of not displaying an icon for certain file types.

##### 1.01
- Fixed the need to restart Cinnamon after adding this applet to the panel.
- Added option to allow custom icons for each individual sub-menu.
- Added options to set a custom size for sub-menus and menu items icons.
- Removed style sheet from applet folder (overwritten by each applet update) in favor of options to set styles for menu items and sub-menus (persistent across updates).

##### 1.00
- Initial release.

