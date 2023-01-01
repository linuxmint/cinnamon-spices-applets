## Changelog

### 1.5.1
 * Improved the logic for determining the default kernel path (some systems default to BAT1 instead of BAT0)
   - Fixes "-- Warning" permanent message and removes the need for manual configuration in the single battery condition to address it

### 1.5.0
 * Switched from `upower` to the power status module provided by the kernel at /sys/class/power_supply/BAT0
   (`upower` updates on a two minute interval while the kernel module updates live and the applet supports smaller increments, increasing the overall accuracy of the applet.)
 * Added a setting for manual configuration of the system battery path
 * Consolidated changelogs into CHANGELOG.md
 * Formatted .json files to standard JSON schema
 * Cleaned up unneeded legacy files and organized into a consistent versioned structure
 * Code comments improved and other comments removed
 * Updated batterymonitor.pot and translation files
 * Renamed ua.po to uk.po (Ukrainian)
 * Fixed file modes
 * Cleaned up whitespace, semicolons, and formatting
 * Cinnamon versions up to 5.6

### 1.4.1
 * Updates README.md to stress audio file must be .oga mime type audio/x-vorbis+ogg
   - the mime type is crucial to it being recognized by the soundfilechooser widget
 * Cinnamon versions up to 5.2

### 1.4.0
 * Removes dependency on 'batteryscript.sh'.
   - This script used to write two files on every update, maybe wearing out the harddisk.
   - Now it uses asyncronous calls to execute the `upower` command directly and captures its output.
 * Checks for dependency on `upower`
 * Increases maximum refresh interval to 5 min (300 s).
 * Simplification of the logic to select the icon to display.
 * Removes (outdated) 3.2/changelog.txt.
 * Added a button to the configuration box to delete the old temporary files.
 * Updated Cinnamon version to 4.4.

### 1.3.9
 * Adds events-sounds property to soundfilechoser widget to allow any sound file to be selected under Cinnamon 4.2
 * Adds additional option to inhibit applet notifications when user selected audible alert is in use
   - closes feature request #2511

### 1.3.8
 * Change location of temporary files to home folder to avoid permissions problem when switching users
 * Fixes #2502

### 1.3.7.1
 * Change to cinnamon-version in metadata.json to add use under Cinnamon 4.2

### 1.3.7
 * Change to allow Multiversion 3.2
 * Change to allow selection of audible alert file in Applet Settings for 3.2 and higher.
   - puts up warning about high volumes and times in public spaces.

### 1.3.6
 * Translation File update only

### 1.3.5
 * Update stylesheet to better match Cinnamon 4.0 System Styles - less rounded.
 * Add an initial mechanism to provide persistence for user edits of the stylesheet.

### 1.3.4
 * Use ModalDialog.NotifyDialog or main.criticalNotify in place of internal code for Alerts
 * Provide option of users sound file called batterymonitorwarning.mp3 in home folder
  - Checks for presence and uses if found otherwises uses default
  - puts up warning about high volumes and times in public spaces.

### 1.3.3
 * Use xdg-open in place of gedit or xed to allow use on more distros

### 1.3.2.2
 * Remove instance of deprecated code giving a harmless warning in .xsession-errors.

### 1.3.2.1
 * Revert change on handling empty battery

### 1.3.2
 * Added checks that sox and zenity are installed and warn that full functionality is not available without them.
 * Improve handling of completely empty batteries.
 * Update README.md, CHANGELOG.md and metadata.json
 * Update batterymonitor.pot so translations can be updated.

### 1.3.1
Bug Fix for use with early versions of Cinnamon
 * Inhibited use of hide_applet_label() to Cinnamon version 3.2 or higher in vertical panels.
 * Corrected Icon Only display mode

### 1.3.0
Major update - now includes support for Vertical Panels, Battery icons and 5 Display Modes
 * Renamed batterytempscript to batteryscript - cosmetic
 * Change to improved form of l10n support function
 * Code added to allow display on vertical panels and added on_orientation_changed function with call to initialise.
 * Options of display of icon and shortening message text with prime aim of support of vertical panels
 * Display Modes added to Configuration as Dropdown with 5 types (modes) and implemented. Includes a Classic mode which is the same as version 1.2.3 of applet.
 * Removed some redundant code still present from earlier versions which affected vertical display
 * Code comments improved and some commented out code removed.
 * Update README.md, CHANGELOG.md and metadata.json
 * Recreate batterymonitor.pot to allow translation support to be updated.

### 1.2.3
 * Added CHANGELOG.md to applet folder with symbolic link to it in UUID so it shows on latest Cinnamon spices web site.
 * CHANGELOG.md is a simplified and reformatted version of changelog.txt which currently remains in applet folder.
 * Changed 'view changelog' in context menu to use CHANGELOG.md
 * Changed to use a symbolic link for README.md

### 1.2.2
 * Changes to text strings to remove spaces from start and end of strings for translation
 * Some extra strings marked for translation
 * Updated batterymonitor.pot
 * Version numbering harmonised with other Cinnamon applets and added to metadata.json so it shows in 'About...'
 * icon.png copied back into applet folder so it shows in 'About...'
 * Version information updated in applet.js, changelog.txt and README.md

### 1.2.1
 * First major update following transition to cinnamon-spices-applets repository under Cinnamon 3.2
 * Added fixed audible warning at alert stage (requested)
 * Added 'discharging' indication via border colour (requested)
 * Move audible alert from suspendScript to applet
 * Added translation support to applet.js and identified strings
 * Added `po` folder to applet
 * Created batterymonitor.pot using cinnamon-json-makepot --js po/batterymonitor.pot
 * Updated documentation and tidied comments in applet

### 1.2.0
 * Initial transition to new cinnamon-spices-applets repository from github.com/pdcurtis/cinnamon-applets
 * Changed help file from help.txt to README.md, updated and put copy in UUID.

### 1.1.9
 * Released 17-09-2016
 * Added ability to edit stylesheet.css to context menu.
 * Added warnings about editing to stylesheet.css

### 1.1.8
 * Released 01-08-2016
 * Corrected icon.png in applet folder which is used by Add Applets

### 1.1.7
 * No code change, just re-packaging and re-uploading to fix 1.1.5 deployment

### 1.1.6
 * No code change, just re-packaging and re-uploading to fix 1.1.5 deployment

### 1.1.5
 * Initial Release 16-07-2016
 * Minor text changes to improve consistency.

### 1.1.4
 * Old call removed from batterytempscript.sh which was filling error log
 * Error checks on status to ensure valid
 * Spelling corrections
 * Help File extended

### 1.1.3
 * Added Modal Dialog tripped once at Alert Level and reset by going back above alert level
 * Shutdown (Suspend) now at 2/3 of Alert Level
 * Suspend level added to tooltip and left click menu
 * TEST CODE REMOVED

### 1.1.2
 * Some changes in how test are applied to make it easier to take them out
 * Extra flag added for flashing
 * Range changed to 10 -> 40 for Alert Percentage
 * Tests look good and suspendscript works
 * TEST CODE STILL IN PLACE
 * Should I add a forced shutdown if level drops to say 5% because taken out of suspend with level dropped too far or suspend cancelled too many times?

### 1.0.1
 * Code added to ensure valid readings of batteryPercentage
 * Code added to 'flash' messages  and extend width with messages but only when discharging.
 * Code added to call Suspend script but only when percentage has fallen (i.e. it will be called every 1% fall so it is re-enabled after returning from suspend)
 * Suspendscript active
 * TEST CODE STILL IN PLACE so levels incorrect

### 1.0.0
 * Developed using code from NUMA, Bumblebee and Timer Applets
 * Includes changes to work with Mint 18 and Cinnamon 3.0 (gedit -> xed)
 * Tested with Cinnamon 3.0 in Mint 18 and Cinnamon 2.4 in Mint 17.1
 * TEST CODE IN PLACE namely batteryPercentage divided by 4 to allow testing
 * Test Version without call to suspendScript
 * Beautified
