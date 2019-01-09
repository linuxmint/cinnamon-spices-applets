## Changelog

## 2.1.2
 * Update stylesheet to better match Cinnamon 4.0 System Styles.

### 2.1.1
  * Use xdg-open in place of gedit or xed to allow use on more distros

### 2.1.0

 * CHANGELOG.md added to applet with a symblic link from UUID - CHANGELOG.md is now displayed on Cinnamon Spices web site.
 * CHANGELOG.md is a simplified version of the existing changelog.txt
 * Applet updated so CHANGELOG.md is displayed from context menu.
 * README.md in UUID is now symbolic link from UUID

### 2.0.5

Improved translation (l10n) Support:

 * UUID set from metadata.uuid so no need for explicit definition.
 * new _() function now checks for system translations if a local one not found.
 * l10n support based on ideas from @Odyseus, @lestcape and @NikoKrause

### 2.0.4

 * Bug corrected - typo of a comma, not stop.
 * Use of this.UUID = metadata.uuid removed.

### 2.0.3

 * Version numbering harmonised with other Cinnamon applets and added to metadata.json so it shows in 'About...'
 * icon.png copied back into applet folder so it shows in 'About...'


### 2.0.2

Changes resulting from cinnamon-spices-applets switch to Github and new Cinnamon Spices Web Site

 * Change helpfile to use README.md instead of help.txt in applet folder
 * Remove icon.png and help.txt from applet folder
 * Released 01-02-2017

### 2.0.0

Changes for Mint 18/Cinnamon 2.8

 * Use Cinnamon version to choose text editor (gedit -> xed) to view changelog, help etc

### 1.2.3

 * Pick up Cinnamon Version from environment variable CINNAMON_VERSION rather than settings window

### 1.2.1

Modifications for Cinnamon 2.0

 * Add cinnamonVersion to settings to allow Cinnamon Version to be specified and thus inhibit extra settings menu entry

### 1.2.0

 * Inhibit counter updates after counter removed from panel

### 1.1.1

 * Added radiused border to background colours and made them configurable via a stylesheet
      (stylesheet.css in the applet folder).
 * Changed from red background when days greater than 1 to a red border so one still knows if it is paused or counting.
 * Extra menu item added to open stylesheet.css
 * Released 04-09-2013

### 1.0.0

 * Initial version tested with cinnamon 1.8
 * Released 01-09-2013
