# Spices Update

## Summary

Cinnamon Spices are Applets, Desklets, Extensions and Themes.

You usually check updates for the Spices using Cinnamon Settings. But, like me, you do it too seldom.

The **Spices Update** applet, highly configurable, plays these roles:

  * It warns you when the Spices you have installed need updates.
  * Optional: It can also warn you when new Spices are available.
  * It gives you direct access to Cinnamon Settings for Applets, Desklets, Extensions and Themes.
  * Only with Cinnamon 3.8 or greater:
    * It allows you to renew the download of the latest version of a Spice.
    * It guarantees you to always download the latest version of a Spice when an update needs to be done.
    * It allows you to ignore the available updates for spices that you do not want to upgrade.
    * By a middle-click on its icon, it allows you to force refresh the data about new Spices and available updates, or open all system settings useful to perform the available updates.


## Status

Usable from Cinnamon 2.8 to Cinnamon 4.4.

Fully supported by the author, under continuing development and in continuous use on several machines, running with **Linux Mint**, **Fedora**,  **Archlinux** or **Debian 10**.

From version v3.0.0 ~ 20190808:

  * Spices Update is compatible with Cinnamon 2.8 -> 4.4 (Mint 17.3 -> 19.3).
  * From Cinnamon 3.8 to 4.4 (Mint 19 -> 19.3): **Perfectly functional, as usual.**
  * From Cinnamon 2.8 to 3.6 (Mint 17.3 -> 18.3): Some features are reduced:
    * The Spices configuration window does not open on the second tab, but on the first one. You will need to click on the second tab and select the sort by date yourself.
    * The Settings window of this applet does not contain any tabs.
    * In the settings of this applet, you can not access Spices lists to disable their monitoring. Therefore, all installed Spices are monitored.
    * The script `generate_mo.sh` (in the `scripts` folder) allows you to install all available translations. Restart Cinnamon after execution.
    * If the `Symbola_Hinted` font can not be automatically installed, then place you into the `fonts/symbola` folder and double-click on the `Symbola_Hinted.ttf` file. Install it with the just opened `gnome-font-viewer`.
    * Cinnamon 2.8: The number of changes does not appear next to the Spices Update icon.

## Requirements

The Spices Update requires the ```notify-send``` tool and the ```symbola``` TrueType font.

**This applet helps you to install these dependencies, if needed.**

To install them manually:

  * Fedora: `sudo dnf install libnotify gdouros-symbola-fonts`
  * Arch:
    * ```sudo pacman -Syu libnotify```
    * `yay -S ttf-symbola` _or_ `pamac build ttf-symbola`
  * Linux Mint, Ubuntu: ```sudo apt install libnotify-bin fonts-symbola```
  * Debian (without sudo):
    * `su`
    * ```apt install libnotify-bin fonts-symbola```


## Settings

![screenshot](https://cinnamon-spices.linuxmint.com/git/applets/SpicesUpdate@claudiux/screenshot.png)

There are five tabs in settings.

The first, _General_, allows you to:

  * Select the _Time interval between two checks_ (in hours). Please note that the first check will take place one minute after starting this applet.
  * Select the ways to warn you : changing the appearance (by color changing) of the icon of this applet and/or displaying messages in the notification zone. You can also choose the type of notification: Minimal or With a button to open the Download tab in System Settings. If desired, the notification may contain the description of each update or new Spice.
  * Select the _Type of display_ of the icon: with or without text?
  * Hide the icon applet while nothing is to report. _Please note that Spices Update settings are only accessible when the applet icon is visible or by opening the Cinnamon Settings-> Applets._

![system_settings_applets](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/System_Settings_Applets.png)

For the content of the other tabs (_Applets_, _Desklets_, etc), please look at the screenshot bellow and note that **the list of installed Spices is automatically filled** at startup; a Refresh button allows you to refill it and refresh data about updates.

Set to _FALSE_ (or uncheck the first box of) all the Spices you _do not want_ to check updates. There are two reasons to do this:

  * A spice is OK for you, and you do not want to be notified of any changes to it.
  * You are a developer working on a Spice and you want to protect it during development.

From Cinnamon 3.8, you can request to renew the download of the latest version of a Spice checking both boxes (or setting both switches to TRUE) then clicking the Refresh button.

![SpicesUpdate-settings_applets](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/Settings_Spices_Update_Applets.png)

## Menu

In the menu of this applet:

  * a Refresh button allows you to force checking the availability of updates for your Spices;
  * a dot appears in front of each type of Spice when at least one update is available;
  * a click on a type of Spice (Applets, Desklets, etc) opens the Download tab of the corresponding page in Cinnamon Settings, with Spices sorted by date;
  * when new Spices are available:
    * an option _Forget new Spices_ appears; clicking it will clear these notifications of new spices, until others arrive;
  * when updates or new Spices are available:
    * an option _Open useful Cinnamon Settings_ (to perform updates) appears;
  * a Configure... button opens the Spices Update Settings.

## Icon

The color of the icon changes when at least one of your Spices needs an update.

From Cinnamon 3.8, the icon rotates and its color darkens while data are being refreshed.

A _Middle-Click_ on applet icon:

  * Performs a Refresh while no available updates are reported.
  * Opens all useful Cinnamon Settings, when Spices updates are available, to allow the user to perform these updates.

Its tooltip (the message displayed hovering over the icon) contains the list of Spices to update, if any.

![hovering_icon](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/hovering_icon.png)


## Notifications

There are two types of notifications: _Minimal_ or _With buttons_. Each of them may or may not contain details: the reason for an update or the description of a new spice.

### Minimal notifications

Here with the reason for update:

![notif_simple_with_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_simple_with_details.png)

### Notifications with buttons

Two buttons: firstly a button to open the System Settings page to download updates; secondly a button to refresh notifications.

![notif_with_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_with_details2.png)

## Translations

Any translation is welcome. Thank you for contributing to translate the applet's messages into new languages, or to improve or supplement existing translations.

### Available translations and their authors

  * Croatian (hr): muzena
  * Dutch (nl): Jurien (French77)
  * Finnish (fi): MahtiAnkka
  * French (fr): claudiux
  * German (de): Mintulix
  * Italian (it): Dragone2
  * Spanish (es): claudiux
  * Swedish (sv): Åke Engelbrektson (eson57)

Many thanks to them!

### How to offer a translation

  1. Create an account on [Github](https://github.com/).
  2. Fork the [cinnamon-spices-applets](https://github.com/linuxmint/cinnamon-spices-applets) repository.
  3. In your fork, create a branch (named like `SpicesUpdate-YOUR_LANGUAGE_CODE`) from the master one.
  4. On your computer, install _git_ and _poedit_.
  5. Clone your branch on your computer:

    `git clone -b SpicesUpdate-YOUR_LANGUAGE_CODE --single-branch https://github.com/YOUR_GITHUB_ACCOUNT/cinnamon-spices-applets.git SpicesUpdate-YOUR_LANGUAGE_CODE`
  6. Open the `SpicesUpdate@claudiux.pot` file (which is in the `po` directory) with poedit and create your translation. You obtain a YOUR_LANGUAGE_CODE.po file.
  7. On Github, upload this `YOUR_LANGUAGE_CODE.po` file at the right place into your branch then go to the root of your branch and make a Pull Request.

## Installation

### Automatic Installation

Use the _Applets_ menu in Cinnamon Settings, or _Add Applets to Panel_ in the context menu (right-click) of your desktop panel. Then go on the Download tab to install this Spices Update applet.

### Manual Installation:

   * Install the additional programs required.
   * Download the **[latest version of Spices Update](https://cinnamon-spices.linuxmint.com/files/applets/SpicesUpdate@claudiux.zip?04831377-cbe4-482d-b035-b8ce9349632e)** from the Spices Web Site.
   * Unzip and extract the folder ```SpicesUpdate@claudiux``` into ```~/.local/share/cinnamon/applets/```
   * Enable this applet in System Settings -> Applets.
   * You can also access the Settings Screen from System Settings -> Applets, or from the context menu of this applet (right-clicking on its icon).

## A Star to thank the author

If you like this Spices Update applet, please do not offer money or coffee, but log in and click on the Star at the top of **[this page](https://cinnamon-spices.linuxmint.com/applets/view/309)**.

Many Thanks.
