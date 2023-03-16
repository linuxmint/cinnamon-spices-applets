# Spices Update

## Important!
In order to be sure to download the latest version of Spices Update, use
**[this link][download]** rather than the Download button at the top of this page, **or use Spices Update v4.1.0 or greater**.

## Status

Usable with all versions of Cinnamon since v2.8.

Fully supported by the author, in continuous development and in continuous use on several machines, working with ** Linux Mint **, ** Fedora **, ** Archlinux **, ** openSUSE Tumbleweed ** or ** Debian 10 **.


## Summary

Cinnamon Spices are Applets, Desklets, Extensions and Themes.

You usually check updates for the Spices using Cinnamon Settings. But, like me, you do it too seldom.

### Cinnamon 3.8 -> 4.6 (Mint 19 -> Mint 20)

The highly configurable ** Spices Update ** applet can play these roles:

| Roles | Cinnamon 4.6 and + | Cinnamon 4.2 and + | Cinnamon 3.8 and + | Cinnamon < 3.8 |
| ---:|:---:|:---:|:---:|:---:|
| Warn user when Spices need updates | ![checked][checked] | ![checked][checked] | ![checked][checked] | ![checked][checked] |
| Warn user when new Spices are available | ![checked][checked] | ![checked][checked] | ![checked][checked] | ![checked][checked] |
| Display in a badge near the applet icon <br/>the number of Spices needing update or just born <br/>(except for Cinnamon 2.8) | ![checked][checked] | ![checked][checked] | ![checked][checked] | ![checked][checked] |
| Give user direct access to Cinnamon Settings <br/>about Applets, Desklets, Extensions and Themes | ![checked][checked] | ![checked][checked] | ![checked][checked] | ![checked][checked] |
| Open directly the Download tab of Cinnamon Settings <br/>about Applets, Desklets, Extensions and Themes, <br/>with Spices ordered by 'Upgradable' | ![checked][checked] | ![checked][checked] | ![checked][checked] | ![unchecked][unchecked] |
| Make user sure to download the latest version <br/>of a Spice that has an available update | ![checked][checked] | ![checked][checked] | ![checked][checked] | ![unchecked][unchecked] |
| Allow user to renew the download of a Spice, <br/>to be sure to get its latest version | ![checked][checked] | ![checked][checked] | ![checked][checked] | ![unchecked][unchecked] |
| Allow user to ignore the updates available <br/>for spices whose update is not desired | ![checked][checked] | ![checked][checked] | ![checked][checked] | ![unchecked][unchecked] |
| Force refresh data about new Spices and available updates<br/> or open all System Settings useful to perform the available updates <br/>by a simple middle-click on its icon | ![checked][checked] | ![checked][checked] | ![checked][checked] | ![unchecked][unchecked] |
| Update all Spices from a category (Applets, Desklets...) <br/>by pressing a button in notification | ![checked][checked] | ![checked][checked] | ![unchecked][unchecked] | ![unchecked][unchecked] |
| Forget all new Spices from a category <br/>by pressing a button in notification | ![checked][checked] | ![checked][checked] | ![unchecked][unchecked] | ![unchecked][unchecked] |
| Filtered and formatted tooltip content | ![checked][checked] | ![unchecked][unchecked] | ![unchecked][unchecked] | ![unchecked][unchecked] |
| Network monitoring | ![checked][checked] | ![unchecked][unchecked] | ![unchecked][unchecked] | ![unchecked][unchecked] |

### Cinnamon 2.8 -> 3.6 (Mint 17.3 -> Mint 18.3): some features are reduced

  * The Spices configuration window does not open on the second tab, but on the first one. You will need to click on the second tab (_Download_) and choose yourself sorting the Spices by date.

  * The Settings window of this applet does not contain any tabs.

  * In the settings of this applet, you can not access Spices lists to disable their monitoring. Therefore, all installed Spices are monitored.

  * The script `generate_mo.sh` (in the `scripts` folder) allows you to install all available translations. Restart Cinnamon after execution.

  * If the `Symbola_Hinted` font can not be automatically installed, then execute the script `~/.local/share/cinnamon/applets/SpicesUpdate@claudiux/scripts/install_symbola_on_Arch.sh`; after that, eventually, open with Nemo the `~/.local/share/cinnamon/applets/SpicesUpdate@claudiux/fonts/Symbola` folder and double-click on the `Symbola.otf` file and install it with the just opened `gnome-font-viewer`.

## Requirements

**Please note that this applet helps you to install all the required dependencies, if necessary.**

So you should not have to run any of the commands listed below.

| Distro | Symbola font | notify-send (*) |
|:---:|:---:|:---:|
|Fedora|`sudo dnf install gdouros-symbola-fonts`|`sudo dnf install libnotify`|
| Arch |`yay -S ttf-symbola` _or_ `pamac build ttf-symbola`| `sudo pacman -Syu libnotify`|
|Linux Mint, Ubuntu|`sudo apt install fonts-symbola`|`sudo apt install libnotify-bin`|
|Debian (with root rights)|`apt install fonts-symbola`|`apt install libnotify-bin`|
|openSUSE|`sudo yast2 --install gdouros-symbola-fonts`|`sudo yast2 --install libnotify-tools`|

**(*) Useless for Spices Update version 6.0.0 and more.**

## Settings

There are five tabs in settings.

### General

![screenshot_general](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/screenshot-general.png)

The first tab, _General_, allows you to:

  * Select the _Time interval between two checks_ (in hours). The first check can optionally take place one minute after starting this applet.

  * Select the way to warn you:
    * by changing the icon color and/or

    * by displaying messages in the notification zone.

    * You can also choose the type of notification: _Minimal_ or _With buttons_ to:

         * Open the Download tab in System Settings,

         * Open the Download tab in System Settings, then Update All Spices (by checking the appropriate box),

         * Refresh all data.

      * If desired, the notification may contain the description of each update or new Spice.

  * Select the _Type of display_ of the icon: with or without text? _Removed since v6.3.0. It is definitively Without!_

  * Hide the icon applet while nothing is to report. _Please note that Spices Update settings are only accessible when the applet icon is visible or by opening the **System Settings-> Applets**._ (See screenshot below.)

  * Set the maximum width of the tooltip (in percentage of the screen width). _New in v6.3.0._ If a line takes up more space in width, then it is displayed on multiple lines instead of being truncated.

![system_settings_applets](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/System_Settings_Applets.png)

### Applets, Desklets, Extensions, Themes

![SpicesUpdate-settings_applets](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/screenshot-applets.png)

About the contents of the other tabs (_Applets_, _Desklets_, etc), please look at the screenshot above and note that **the list of installed Spices is automatically filled** at startup; a _Refresh_ button allows you to refill it and refresh data about updates.

**Warning**: _Trying to change the name of a Spice or delete a row is useless; it will have no effect. This row will reappear during the next refresh._

If you do not want to install future updates for one or some Spices, simply uncheck each first box of these Spices (or set them to _FALSE_). There are at least two reasons for that:

  * A Spice is fine for you, and you do not want to be notified of any changes.

  * You are a developer working on a Spice and you want to protect it during its development.

From Cinnamon 3.8, you can **renew the download of a Spice to be sure to get its latest version** checking both boxes (or setting both switches to TRUE) then clicking the Refresh button.

## Menu

In the menu of this applet:

  * A Refresh button allows you to force checking the availability of updates for your Spices;

  * A dot appears in front of each type of Spice when at least one update is available;

  * A click on a type of Spice (Applets, Desklets, etc) opens the Download tab of the corresponding page in Cinnamon Settings, with Spices sorted by date or "upgradable" (last available update first);

  * When new Spices are available an option _Forget New Spices_ appears; clicking it will clear these notifications of new spices, until others arrive;

  * When updates or new Spices are available an option _Open useful Cinnamon Settings_ (to perform updates) appears;

  * A _Configure..._ button opens a submenu to directly access the different tabs of the Spices Update Settings.

![menu](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/screenshot_menu.png)

## Icon & tooltip

The color of the icon changes when at least one of your Spices needs an update. (You can select which color.)

From Cinnamon 3.8, the icon rotates and its color darkens while data are being refreshed.

A _Middle-Click_ on applet icon:

  * Performs a Refresh when no available updates are reported.

  * Opens all useful Cinnamon Settings, when Spices updates are available, to allow the user to perform these updates.

The tooltip (the message displayed hovering over the icon) contains the list of Spices to update, if any.

![hovering_icon](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/screenshot_tooltip.png)

## Notifications

There are two types of notifications: _Minimal_ or _With action buttons_. Each of them may or may not contain details: the reason for an update or the description of a new spice.

### Minimal notifications

Here with the reason for update:

![notif_simple_with_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_simple_with_details.png)

### Notifications with action buttons

They have at least two buttons: firstly a button to open the System Settings page to download updates; secondly a button to refresh notifications.

![notif_with_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_with_details2.png)

Optionally a third button can appear between them, in notifications about updates:

  * _Update it_ or _Update them all_, to open the System Settings page to download updates then automatically install these updates.

This third button is always present in notifications about new Spices:

  * _Forget it_ or _Forget them all_, to ignore these new Spices.

New in Spices Update v6.0.0: these buttons can be displayed as icons.

![notif_with_icons](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notifications_with_icons_SU630.png)

## Translations

Any translation is welcome. Please help many users by translating messages into new languages or improving / supplementing existing translations.

### Available translations and their authors

| Translation | Code | Author (Github account) |
| ---:|:---:|  --- |
| Croatian | hr | gogogogi ([muzena](https://github.com/muzena)) |
| Danish | da | Alan Mortensen ([mortea](https://github.com/mortea)) |
| Dutch | nl | Jurien ([French77](https://github.com/French77)) |
| Finnish | fi | MahtiAnkka ([mahtiankka](https://github.com/mahtiankka)) |
| French | fr | claudiux ([claudiux](https://github.com/claudiux)) |
| German | de | Mintulix ([Mintulix](https://github.com/Mintulix)), Tobias Bannert ([to-ba](https://github.com/to-ba)) |
| Italian | it | Dragone2 ([Dragone2](https://github.com/Dragone2)) |
| Romanian | ro | Andrei Miculita ([AndreiMiculita](https://github.com/AndreiMiculita)) |
| Spanish | es | claudiux ([claudiux](https://github.com/claudiux)) |
| Swedish | sv | Åke Engelbrektson ([eson57](https://github.com/eson57)) |
| Turkish | tr | Serkan Önder ([serkan-maker](https://github.com/serkan-maker))|

_Thank you very much to all of these authors!_

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

  1. Use the _Applets_ menu in Cinnamon Settings, or _Add Applets to Panel_ in the context menu (right-click) of your desktop panel.
  2. Go on the Download tab to... download this Spices Update applet.
  3. Go on the Manage tab to install this Spices Update applet on a panel of your desktop.

### Manual Installation:

   1. Install the additional programs required.
   2. Download the **[latest version of Spices Update][download]** from the Spices Web Site.
   3. Unzip and extract the folder `SpicesUpdate@claudiux` into `~/.local/share/cinnamon/applets/`
   4. Enable this applet in System Settings -> Applets.
   5. You can also access the Settings Screen from System Settings -> Applets, or from the context menu of this applet (right-clicking on its icon).

## Tips to solve some problems

Sometimes, you experienced this problem: After updating your Spices, the Spices Update icon is not refreshed and still shows the same number of Spices to update. Another symptom of this problem: when you unzip a zip file with nemo, you have to refresh (F5) the contents of the folder to see the subfolder created by this action.

_NB: This problem is not due to this applet!_

The solution exists!

  1. Edit the file `/etc/sysctl.conf`:
  `sudo nano /etc/sysctl.conf`
  2. Add this line:
  `fs.inotify.max_user_watches=1000000`
  3. Save this file (Ctrl-X, then confirm by Y)
  4. Reload the changes:
  `sudo sysctl -p`
  (or reboot).
  5. Use the Refresh button in this applet menu.
  6. Enjoy! This problem will no longer exist.


[checked]: https://github.com/linuxmint/mint-themes/raw/master/src/Mint-Y/gtk-3.0/assets/radio-checked%402.png
[unchecked]: https://github.com/linuxmint/mint-themes/raw/master/src/Mint-Y/gtk-3.0/assets/radio-unchecked.png
[download]: https://cinnamon-spices.linuxmint.com/files/applets/SpicesUpdate@claudiux.zip?a509d76e-7bb1-4de3-8063-f4615f8accbf

