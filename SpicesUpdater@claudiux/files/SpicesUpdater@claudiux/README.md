# Spices Updater

## Summary

Cinnamon Spices are Applets, Desklets, Extensions and Themes. You usually manage the Spices using Cinnamon Settings.

The **Spices Updater** applet plays these roles:

  * It warns you when the Spices you have installed need updates.
  * It can also automatically install these updates. _You can specify which types of Spices or precisely which Spices can be updated automatically._
  * It gives you direct access to Cinnamon Settings for Applets, Desklets, Extensions and Themes.

## Status

Fully supported by the author, under continuing development and in continuous use on several machines, running with **Linux Mint**, **Fedora** or **Archlinux**.

## Requirements

The Spices Updater requires some tools: ```unzip```, ```notify-send``` and ```dconf```.

To install them:

  * Fedora: ```sudo dnf install unzip dconf libnotify```
  * Arch: ```sudo pacman -Syu unzip dconf libnotify```
  * Linux Mint: ```sudo apt install unzip dconf-tools libnotify-bin```

**This applet helps you to install these dependencies, if any.**

## Settings

There are five tabs in settings.

The first, _General_, allows you to:

  * Select the _Time interval between two checks_ (in hours). Please note that the first check will take place 2 minutes after starting this applet.
  * Select the way to warn you : changing the appearance (by color changing) of the icon of this applet and/or displaying messages in the notification zone.
  * Select the options for events logging.
  * Select the _Type of display_ of the icon: with or without text?

For the content of the other tabs (_Applets_, _Desklets_, etc), please look  at the screenshot above and note that **the list of installed Spices is automatically filled**.

Set to _FALSE_ all the Spices you _do not want_ to automatically update **before** checking the _Update Applets_ box (or the _Update Desklets_ box, etc).

## Menu

In the menu of this applet:

  * a dot before any type of the Spices to update warns the user;
  * a click on a Spices type (Applets, Desklets, etc) opens the corresponding page in Cinnamon Settings;
  * three buttons allows you to:
    * refresh the caches and update the status, or the Spices;
    * view the log file content;
    * restart Cinnamon.

## Icon

The color of the icon changes when at least one of your Spices needs an update.

## Translations

Any translation is welcome. Thank you for contributing to translate the applet's messages into new languages, or to improve or supplement existing translations.

## Automatic Installation

Use the _Applets_ menu in Cinnamon Settings, or _Add Applets to Panel_ in the context menu (right-click) of your desktop panel. Then go on the Download tab to install this Spices Updater.

## Manual Installation:

   * Install the additional programs required.
   * Download the Spices Updater from the Spices Web Site.
   * Unzip and extract the folder ```SpicesUpdater@claudiux``` into ```~/.local/share/cinnamon/applets/```
   * Enable this applet in System Settings -> Applets.
   * You can also access the Settings Screen from System Settings -> Applets, or from the context menu of this applet (right-clicking on its icon).

## A Star to thank the author

If you like this Spices Updater, please do not offer money or coffee, but log in and click on the Star at the top of this page.

Many Thanks.