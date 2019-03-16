### Changelog covering recent significant changes

## 3.2.8
  * Change Multiversion to start with 3.2 folder to allow use of pages and sections in the settings file
  * Change Settings to use pages and sections to give a tabbed layout (3.2 and higher).
  * Provide options to choose different vnstati formats including a user specified format (3.2 and higher).
  * Revert to internal function instead of Use ModalDialog.NotifyDialog (3.0 and lower).
  * Update CHANGELOG.md and README.md

## 3.2.7
  * Add multiversion folder
  * Use ModalDialog.NotifyDialog instead of internal function in newer version of cinnamon.
  * Change location of vnstatImage to home folder rather than applet folder.
  * Tidy us some of text in Notifications and trailing spaces

## 3.2.6

  * Changes for Cinnamon 4.0 and higher to avoid segfaults when old Network Manager Library is no longer available by using multiversion with folder 4.0
  * Remove Try-Catch as no longer required in 4.0 and associated changes.
  * It is believed that all Distributions packaging Cinnamon 4.0 have changed to the new Network Manager Libraries
  * Add cinnamon-version to metadata.json (Provides information on which Cinnamon versions can load it)

## 3.2.5

  * Changes to check which network manager libraries are in use and choose which to use - addresses/solves issue #1647 with Fedora versions 27 and higher.
  * Note that there may be problems with option of disconnecting the network manager when data usage limit is exceeded so checks are needed under NM before the issue can be marked as closed.
  * Use xdg-open in place of gedit or xed to allow use on more distros
  * Update README.md

## 3.2.4

 * Change method of inhibiting display of vnstati image when vnstati not installed or enabled in settings by substituting a tiny image instead of use of an extra mainBox.
 * Improved notification when vnstat and vnstati not installed
 * Better formatting of CHANGELOG.md

## 3.2.3

 * Add check that GTop library is installed using a try and catch(e) technique
 * Remove duplicate let declarations occurances missed in 3.2.0 which could give difficulties in Cinnamon 3.4
 * Some changes in intialisation to remove CJS warnings

## 3.2.2

Support new facility on Cinnamon Spices Web Site to display a CHANGELOG.md

 * Add CHANGELOG.md to applet folder and use it instead of changelog.txt in right click menu
 * CHANGELOG.md based on recent entries to changelog.txt with last changes at the top. changelog.txt currently remains in applet folder but is not used.
 * Add symbolic links for README.md and CHANGELOG.md instead of copies from the applet folder to UUID folder for the Cinnamon Web Site to display.
 * Improve l10n translation support.

## 3.2.1

 * Harmonise with code writen by author for vnstat@cinnamon.org

## 3.2.0

 * Remove duplicate let declarations occurances in common coding for Cinnamon 3.4 thanks to @NikoKraus  [#604]

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

