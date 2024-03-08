# Changelog

## 2.0.3

* Added an option to allow Ctrl-Click to bypass the count down timer and suspend immediately
* Fixed a minor typo in the tooltip text for the icon config option

## 2.0.2

* Limit count down timer to a minimum of 1 rather than 0
* Added a config button to open Power Management (convenient access to other suspend related options)
* Added CHANGELOG.md

## 2.0.1

* Set the icon size to the symbolic icon size defined in panel settings when the "Use full color icon" option is disabled
* Recenter the icon when changing the "Use full color icon" setting
* Remove a debugging message accidentally left in the code
* Fix a typo in a tooltip
* Move the README.md to the correct location

## 2.0

* Rewritten in Javascript EC6
* Added an option to require a double-click to suspend (reducing accidental suspends)
* Added a count-down option to allow the user some time to abort the suspend by clicking on the applet icon a second time. The count-down is displayed using a icon-overlay badge like the one used by the grouped-windowlist applet for showing the window count
* Added an option to configure the count-down duration
* Added a README.md.
* Made the applet allow multiple instances (mainly for people with multiple monitors)
* Added an option to use a symbolic or full color icon on the panel
* Update author to klangman
* Add version to metadata
* Update translation files
