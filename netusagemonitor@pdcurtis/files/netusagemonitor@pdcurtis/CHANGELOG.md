### Changelog covering recent changes

## 3.2.2
Support new facility on Cinnamon Spices Web Site to display a CHANGELOG.md

 * Add CHANGELOG.md to applet folder and use it instead of changelog.txt in right click menu
 * CHANGELOG.md based on recent entries to changelog.txt with last changes at the top. changelog.txt currently remains in applet folder but is not used.
 * Add symbolic links for README.md and CHANGELOG.md instead of copies from the applet folder to UUID folder for the Cinnamon Web Site to display.
 * Improve l10n translation support.
## 3.2.1
 * Harmonise with code writen by author for vnstat@cinnamon.org and revert 3.1.2 until further testing.
##3.2.0
 * Remove duplicate let declarations occurances in common coding for Cinnamon 3.4 thanks to @NikoKraus  [#604]
## 3.1.2
 * Change spawn_command_line_sync to spawn_command_line_async, the asynchronous form. 
 * Correct several spelling errors in comments and .md files.
## 3.1.1
 * Additional PopupMenu.PopupMenuSection added as per an easy and elegant suggestion from @collinss and @Odyseus so 'standard' context menu items are retained when the menu is refreshed.
## 3.1.0
 * Version numbering harmonised with other Cinnamon applets and added to metadata.json so it can show in 'About...'
 * icon.png copied back into applet folder so it can show in 'About...'
 * Add translation support to applet.js
 * Identify strings for translation and remove leading and trailing spaces and replace with separate spaces where required.
## 3.0.7
Transition to new cinnamon-spices-applets repository (January 2107)

 * Change from call to firefox to opening README.md on Context submenu to provide help.


### Earlier Versions

Information is available on github.com/pdcurtis/cinnamon-applets but some highlights are:

 * First Released on 11-07-2013 for Cinnamon 1.8
 * All major development and facilites completed in 2.4.0 (March 2014)
 * Support for Android Bluetooth connections added in 2.6.0
 * Modifications for Mint 18+ and Cinnamon 3.0+ in 3.0.0
 * Support for Gbyte and Tbyte data levels by 3.0.6

