# Spices Update

## Summary

Cinnamon Spices are Applets, Desklets, Extensions and Themes.

You usually check updates for the Spices using Cinnamon Settings. But, like me, you do it too seldom.

The **Spices Update** applet plays these roles:

  * It warns you when the Spices you have installed need updates.
  * Optional: It can also warn you when new Spices are available.
  * It gives you direct access to Cinnamon Settings for Applets, Desklets, Extensions and Themes.

## Status

Fully supported by the author, under continuing development and in continuous use on several machines, running with **Linux Mint**, **Fedora** or **Archlinux**.

## Requirements

The Spices Update requires the ```notify-send``` tool and the ```symbola``` TrueType font.

To install it:

  * Fedora: `sudo dnf install libnotify gdouros-symbola-fonts`
  * Arch:
    * ```sudo pacman -Syu libnotify```
    * `yay -S ttf-symbola` _or_ `pamac build ttf-symbola`
  * Linux Mint: ```sudo apt install libnotify-bin fonts-symbola```

**This applet helps you to install these dependencies, if needed.**

## Settings

There are five tabs in settings.

The first, _General_, allows you to:

  * Select the _Time interval between two checks_ (in hours). Please note that the first check will take place one minute after starting this applet.
  * Select the ways to warn you : changing the appearance (by color changing) of the icon of this applet and/or displaying messages in the notification zone. You can also choose the type of notification: Minimal or With a button to open the Download tab in System Settings. If desired, the notification may contain the description of each update or new Spice.
  * Select the _Type of display_ of the icon: with or without text?
  * Hide the icon applet while nothing is to report. _Please note that Spices Update settings are only accessible when the applet icon is visible or by opening the Cinnamon Settings-> Applets._

![system_settings_applet](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/System_Settings_Applets.png)

For the content of the other tabs (_Applets_, _Desklets_, etc), please look at the screenshot above and note that **the list of installed Spices is automatically filled** at startup, but a button allows you to reload it.

Set to _FALSE_ all the Spices you _do not want_ to check updates. There are two reasons to do this:

  * A spice is OK for you, and you do not want to be notified of any changes to it.
  * You are a developer working on a spice and you do not want to be informed about changes during development.

## Menu

In the menu of this applet:

  * a Refresh button allows you to force checking the availability of updates for your Spices;
  * a dot appears in front of each type of Spice when at least one update is available;
  * a click on a type of Spice (Applets, Desklets, etc) opens the Download tab of the corresponding page in Cinnamon Settings, with Spices sorted by date;
  * when new Spices are available, an option _Forget new Spices_ appears; clicking it will clear these notifications of new spices, until others arrive;
  * a Configure... button opens the Settings.

## Icon

The color of the icon changes when at least one of your Spices needs an update.

Its tooltip (the message displayed when the icon is hovered) contains the list of spices to update, if any.

![hovering_icon](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/hovering_icon.png)

## Notifications
There are two types of notifications: _Minimal_ or _With buttons_. Each of them may or may not contain details: the reason for an update or the description of a new spice.
### Minimal notifications
Here with the reason for update:

![notif_simple_with_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_simple_with_details.png)

### Notifications with buttons
Two buttons: firstly a button to open the System Settings page to download updates; secondly a button to refresh the notification to obtain details, if any.

Here without details:

![notif_without_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_without_details.png)

After refreshing, the reason for the update appears:

![notif_with_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_with_details2.png)

## Translations

Any translation is welcome. Thank you for contributing to translate the applet's messages into new languages, or to improve or supplement existing translations.

## Installation

### Automatic Installation

Use the _Applets_ menu in Cinnamon Settings, or _Add Applets to Panel_ in the context menu (right-click) of your desktop panel. Then go on the Download tab to install this Spices Update applet.

### Manual Installation:

   * Install the additional programs required.
   * Download the Spices Update from the Spices Web Site.
   * Unzip and extract the folder ```SpicesUpdate@claudiux``` into ```~/.local/share/cinnamon/applets/```
   * Enable this applet in System Settings -> Applets.
   * You can also access the Settings Screen from System Settings -> Applets, or from the context menu of this applet (right-clicking on its icon).

## A Star to thank the author

If you like this Spices Update applet, please do not offer money or coffee, but log in and click on the Star at the top of this page.

Many Thanks.
