# Changelog

## 1.2.1

* Fix for a 1.2.0 regression when running under older Cinnamon releases where the PopupResizeHandler class does not exist. The popup window can only be resized in versions of Cinnamon where that class exists (5.8+), but the Applet will now work with or without that class.

## 1.2.0

* Fixed the output for right-to-left language output by using the -no-bidi translation-shell parameter when translating text
* Removed the Hotkey1/2 options and replaced them with 8 unique hotkey options on a new Hotkeys configuration dialog page. This makes the hotkey support more versatile and allows the Cinnamon Keyboard->Shortcuts setting page to properly show Panel Translator Hotkeys in it's user interface
* Added support for allowing the popup dialog window to be resized
* Save and restore popup window size on window resize events and applet startup
* Fix handling of display scaling factors

## 1.1.0

* Added two hotkey options that can perform any of the 8 translation options
* Fixed the swap-languages button so that it will save the new to/from languages to the configuration

## 1.0.2

* Pixelate disabled buttons so it more clear that they can't be clicked
* Added this CHANGELOG.md file

## 1.0.1

* Show any text-to-speech errors by placing the stderr text at the bottom of the GUI
