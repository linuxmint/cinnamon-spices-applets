## Change Log

**Note:** Upstream fixes/features are changes made to the original Cinnamon Menu applet that I ported to this applet.

##### 1.21
- Changed *multiversion* implementation. Created symlinks inside the version folder so I don't keep forgetting to copy the files from the root folder. The only *unique* file, and the only reason that I use *multiversion*, is the settings-schema.json file.
- Changed the way the imports are done.
- Removed *dangerous* flag. Achieved by changing all synchronous functions to their asynchronous counterparts.
- Implemented some of the upstream features and fixes.

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
- Fixed the know issue with the option **Display separator after "Recent Applications" category** breaking keyboard navigation.
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

##### 1.11
- [Upstream fix] Fixed search results highlighting.

##### 1.10
- Added option to not store into the Recent Applications category the applications set as Favorite.

##### 1.09
- Fixed fuzzy search display of exact matches. Thanks to [nooulaif](https://github.com/nooulaif).
- [Upstream fix] Fixed unescaped characters displayed on applications info box.
- [Upstream fix] Fixed gap left after hiding favorites box.

##### 1.08
- Fixed a bug that caused the search on the menu to break when the custom launchers box was set to disabled/hidden.
- Fixed a bug that caused the search on the menu would not fit to the panel width when the custom launchers box was set to disabled/hidden.
- Added support for localizations. If someone wants to contribute with translations, inside the Help section of this applet (found in the applet context menu or the Help.md file inside this applet folder) you will find some pointers on how to do it.

##### 1.07
- Reorganized this applet settings window.
- Added to this applet context menu a **Help** menu item. It will open a file containing some basic information about usage and some troubleshooting instructions.
- Added **Run from terminal** and **Run from terminal as root** to the applications context menu.
- Added three new actions when clicking applications.
    - **Shift + Left click:** Run as root
    - **Ctrl + Left click:** Run from terminal
    - **Ctrl + Shift + Left click:** Run from terminal as root

##### 1.06
- Fixed an issue with the context menu for applications listed under **Recent Apps** category (the context menu wasn't closing when switching categories.
- Added three new items to the context menu for applications (**Run as root**, **Edit .desktop file** and **Open .desktop file folder**). All three items can be hidden/shown individually.
- Added options to hide **Add to panel**, **Add to desktop** and **Uninstall** context menu items.
- Added option to enable open/close animations for the menu.
- Added a new item to the context menu of this applet to open the menu editor.

##### 1.05
- Added new option to remember recently used applications launched from the menu. These applications will be displayed on a new category and sorted by execution time.
- Added some tweaks and new features from the nightly version of the default Cinnamon menu. These additions make this applet *play nice* with the new vertical panels introduced by Cinnamon nightly.
- Some fixes to the menu keyboard navigation. There were some inconsistencies when the option **Swap categories box** was enabled. There are still some inconsistencies when the favorites box is shown. I will fix them when I figure out how to.

##### 1.04
- Added option to place the custom launchers box to the left or to the right of the searchbox.
- Added option to auto set the searchbox width to fit the entire menu width.
- Added option to align the applications info box text to the left.

##### 1.03
- Added option to invert the placement of the categories box and the applications box.
- Added option to display the **Favorites** as a category.
- Added option to remove the (totally useless) **All applications** category.
- Added option to hide the scrollbar from the applications list.
- Added option to disable recently installed applications highlighting.
- Added options to customize the padding of certain menu elements.

##### 1.02
- Added option to hide searchbox.
- Added option to set a fixed width for the searchbox.
- Added a box that can contain any custom launcher (up to 10) and can be placed at the top or the bottom of the menu.
- The **Quit buttons** can now be moved next the the custom launchers box.
- The **Quit buttons** can now have custom icons (ONLY when they are placed next to the custom launchers box).

##### 1.01
- Minor performance tweaks.

##### 1.0
- Initial release.
