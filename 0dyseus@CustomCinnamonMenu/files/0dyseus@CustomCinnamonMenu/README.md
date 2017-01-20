## Custom Cinnamon Menu applet description

This applet is a custom version of the default Cinnamon Menu applet, but infinitely more customizable.

## Compatibility

- ![Cinnamon 3.0](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Cinnamon-3.0.svg) ![Linux Mint 18](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Linux_Mint-18.svg)
- ![Cinnamon 3.2](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Cinnamon-3.2.svg) ![Linux Mint 18.1](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Linux_Mint-18.1.svg)

<span style="color:red;">
**Do not install on older versions of Cinnamon.**
</span>


## Added options/features

**Note:** Read the help file for this applet (Help item on this applet context menu) for detailed information about this applet keyboard navigation and other features.

- All mayor elements of the menu can be hidden or placed anywhere on the menu.
- Added Fuzzy search. Based on [Sane Menu](https://cinnamon-spices.linuxmint.com/applets/view/258s) applet by **nooulaif**.
- Added a custom launchers box that can run any command/script/file and can be placed at the top/bottom of the menu or to the left/right of the searchbox.
- Custom launchers icons can have a custom size and can be symbolic or full color.
- Custom launchers can execute any command (as entered in a terminal) or a path to a file. If the file is an executable script, an attempt to execute it will be made. Otherwise, the file will be opened with the systems handler for that file type.
- The **Quit buttons** can now be moved next the the custom launchers box and can have custom icons (ONLY when they are placed next to the custom launchers box). They also can be hidden all at once or individually.
- The searchbox can have a fixed width or an automatic width to fit the menu width.
- The applications info box can be hidden or replaced by traditional tooltips. Its text can also be aligned to the left.
- The size of the Favorites/Categories/Applications icons can be customized.
- The amount of recent files can be customized.
- The **Recent Files** category can be hidden. This is for people who want the **Recent Files** category hidden without disabling recent files globally.
- The **All Applications** category can be removed from the menu.
- The **Favorites** can now be displayed as one more category. The **All Applications** category has to be hidden.
- The placement of the categories box and the applications box can be swapped.
- Scrollbars in the applications box can be hidden.
- The padding of certain menu elements can be customized to override the current theme stylesheets.
- Recently installed applications highlighting can be disabled.
- Recently used applications can be remembered and will be displayed on a category called **Recent Apps**. The applications will be sorted by execution time and the name and icon of the category can be customized.
- Categories can be selected on hover (system default) or by clicking on them.
- The default **Add to panel**, **Add to desktop** and **Uninstall** context menu items can be hidden.
- The menu editor can be directly opened from this applet context menu without the need to open it from the settings windows of this applet.
- The context menu for applications has 5 new items:
    - **Run as root:** Executes application as root.
    - **Edit .desktop file:** Open the application's .desktop file with a text editor.
    - **Open .desktop file folder:** Open the folder where the application's .desktop file is stored.
    - **Run from terminal:** Open a terminal and run application from there.
    - **Run from terminal as root:** Same as above but the application is executed as root.

### Menu *emulating* the Whisker menu (XFCE)

![Whisker menu](https://raw.githubusercontent.com/Odyseus/CinnamonTools/master/Applets/0dyseus%40CustomCinnamonMenu/screenshot2.png "Whisker menu")

<h2 style="color:red;"> Bug report and feature request</h2>
<span style="color:red;">
Spices comments system is absolutely useless to report bugs with any king of legibility. In addition, there is no notifications system for new comments. So, if anyone has bugs to report or a feature request, do so on this xlet GitHub page. Just click the **Website** button next to the **Download** button.
</span>

## Known issues
- No known issues.

## Contributors/Mentions
- [NikoKrause](https://github.com/NikoKrause): Bug fixes and German localization.
- [Radek71](https://github.com/Radek71): Czech localization.
- Some advanced features on this applet are based on [lestcape](https://github.com/lestcape)'s [Configurable Menu applet](https://github.com/lestcape/Configurable-Menu)
- Fuzzy search feature based on [Sane Menu](https://cinnamon-spices.linuxmint.com/applets/view/258s) applet by [nooulaif](https://github.com/nooulaif).
- Some icons used by this menu are from [Entypo pictograms](www.entypo.com) by Daniel Bruce.

## Change Log

**Note:** Upstream fixes/features are changes made to the original Cinnamon Menu applet that I ported to this applet.

##### 1.20
- Added Czech localization. Thanks to [Radek71](https://github.com/Radek71).
- Several upstream fixes.

##### 1.19
- Added German localization. Thanks to [NikoKrause](https://github.com/NikoKrause).
- [Upstream fix] Fixed a crash produced by certain recent files URIs.

##### 1.18
- Some fixes/improvements for Cinnamon 3.2.x.
- Fixed keyboard navigation in the Favorites box caused by a custom separator element.
- Added option to change the font size for the text on the applications info box.
- Added option to display the user's picture on the menu.
- Added option to display hover feedback. If the user picture is displayed and the option "hover feedback" is enabled, every time an element on the menu is hovered or selected with keyboard navigation, the image/icon of said element will be displayed in the place where the user picture is placed.

##### 1.17
- Fixed the known issue with the option **Display separator after "Recent Applications" category** breaking keyboard navigation.
- Added keyboard navigation to the **Custom Launchers** box.

##### 1.16
- Added the possibility to customize the placement of each mayor elements of the menu (**Search box**, **Applications/Categories boxes**, **Info box** and **Custom Launchers box**). There is a new section on the settings window called **Menu layout** that groups all options that modify the menu layout.
- Some minor performance improvements.
- [Upstream fix] Fixed removal of key bindings.

##### 1.15
- Added option to choose an alternate method for selecting categories. This method is based on **lestcape**'s [Configurable Menu applet](https://github.com/lestcape/Configurable-Menu) and it might improve the menu performance while selecting categories.
- Updated some context menu icons to be less generic. Thanks to [NikoKrause](https://github.com/NikoKrause).
- [Upstream fix] Various keyboard navigation fixes.

##### 1.14
- Added option to toggle category selection on hover.
- Fixed error when trying to set the **run_from_terminal.sh** file as executable.
- Removed unnecessary folder.

##### 1.13
- Enabled multi version support to take advantage of the new settings system for xlets on Cinnamon 3.2.
- Fixed favorites box scaling.
- Added possibility to display tooltips for all items in the menu (applications, favorites, recent files and places).
- Added option to cap the maximum width of menu items inside the applications box.
- [Upstream fix] Added keyboard navigation for context menu.
- [Upstream fix] Greatly improved keyboard navigation.
- [Upstream fix] Recent files that are no longer available will be hidden or will display a warning.
- General improvements.

##### 1.12
- Fixed the non localization of the applet label ([#7](https://github.com/Odyseus/CinnamonTools/issues/7)). Thanks to [NikoKrause](https://github.com/NikoKrause).
- [Upstream fix] Fixed impossibility to clear the list of **Recent Files** by pressing the **Enter** key.
- [Upstream fix] Fixed various visual glitches on the applications info box.

[Full change log](https://github.com/Odyseus/CinnamonTools/blob/master/Applets/0dyseus%40CustomCinnamonMenu/CHANGELOG.md)
