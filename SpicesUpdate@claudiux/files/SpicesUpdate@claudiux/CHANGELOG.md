### v3.2.0~20190910
  * Improves tooltip display. (All branches)
  * Bug fixes in the 2.8 branch. (Cinnamon 2.8 to 3.6)
  * Code cleanup and restructuring in the 4.2 branch. (Cinnamon 4.2 and later)

### v3.1.0~20190908
  * Multi-version: Using specific capabilities of `cinnamon-settings` in Cinnamon 4.2.
  * Code cleanup.

### v3.0.4~20190826
  * Available languages:
   * Dutch
   * English
   * Finnish
   * French
   * Italian
   * German
   * Hungarian
   * Spanish
   * Swedish.
  * Bug (#2545) fixed concerning Cinnamon 2.8 -> 3.6.

### v3.0.3~20190818
  * Improves installation.
  * Removes useless log messages.

### v3.0.2~20190813
  * Show Spices Update version in tooltip

### v3.0.1~20190812
  * Fixes notification button issue (#2360)

### v3.0.0~20190808
  * Now compatible with Cinnamon 2.8 -> 4.2 (Mint 17.3 -> 19.2)!
   * From Cinnamon 3.8 to 4.2 (Mint 19 -> 19.2): Perfectly functional, as usual.
   * From Cinnamon 2.8 to 3.6 (Mint 17.3 -> 18.3): Some features are reduced:
    * The Spices configuration window does not open on the second tab, only on the first one. You will need to click on the second tab and select the sort by date yourself.
    * The Settings window of this applet does not contain any tabs.
    * In the settings of this applet, you can not access Spices lists to disable their monitoring. Therefore, all installed Spices are monitored.
    * The script `generate_mo.sh` (in the `scripts` folder) allows you to install all available translations. Restart Cinnamon after execution.
    * If the `Symbola_Hinted` font can not be automatically installed, then place you into the `fonts/symbola` folder and double-click on the `Symbola_Hinted.ttf` file. Install it with the just opened `gnome-font-viewer`.
    * Cinnamon 2.8: The number of changes does not appear next to the Spices Update icon.
  * The Eye character signaling the new Spices is replaced by a Comet character.

### v2.3.1~20190807
  * Minor change: Replaces, in tooltip and in notifications, escaped characters \' and \" by ' and ", if any.

### v2.3.0~20190806
  * Bypass all caches to download json files containing data about Spices.

### v2.2.0~20190803
  * Adding a "Help..." button in the menu. This help (in English by default) can be translated into your language. To do it:
   * Place you into the `help` directory: `cd ~/.local/share/cinnamon/applets/SpicesUpdate@claudiux/help`
   * Copy the `en` directory into a new directory named as your language code. Example: `cp -a en de`
   * Place you into this new directory. Translate the contents of the README.md file. (Do not rename this file.)
   * Install the `grip` package, then export the README.md file into html format: `grip --title "Spices Update - Help" --export README.md README.html`. (Translate _Help_.)
   * You can propose your translation, mentionning me (@claudiux) on Github.
  * French translation of the README.md file is available.
  * When only one Spice (by category: Applets, Desklets, ...) needs an update, its icon appears into the notification messages.

### v2.1.0~20190721
  * Allows user to update even downloaded xlets from the Download button on the site.
  * Compatible with Cinnamon 3.8, 4.0 and 4.2.

### v2.0.1~20190201
  * Delete old notifications when a new one arrives.

### v2.0.0~20190131
  * Now the notifications can contain a button to open Download page for applets/desklets/extensions/themes in Date sort order. (Feature request #2231.)
  * Now the notifications can contain the description of an update or new Spice. (Feature request #2243.)
  * If the Symbola font is not already installed on Arch, then its installation is now made locally (into `~/.local/share/fonts/`) to avoid using AUR repositories, which are not used on all Arch system.

### v1.2.1~20190126
  * The icon applet can be hidden while nothing is to report.

### v1.2.0~20190122
  * Now, in the menu, a click on a type of Spice (Applets, Desklets, etc) opens the Download tab of the corresponding page in Cinnamon Settings, with Spices sorted by date.

### v1.1.3~20190118
  * Dependencies: Added presence of `symbola` ttf font.

### v1.1.2~20190117
  * New feature (requested by @sphh in #2210): Make support for new Spices Applet, Desklet, Extension and Theme specific.

### v1.1.1~20190115
  * New feature (requested by @sphh in #2213): When new Spices are available, an option _Forget new Spices_ appears in the menu of this applet. Clicking it will clear these notifications of new spices, until others arrive.
  * Available languages: English, French, Spanish, Croatian, German, Italian.

### v1.1.0~20190113
  * New feature (requested by @sphh in #2202): This applet can also warn the user when new Spices are available. (New option in general settings.)
  * Minor bug fixes.

### v1.0.4~20190110
  * New icons. Back to the original color: #eb9122.
  * The tooltip now contains the list of Spices to update.
  * Fixes undeclared variable error.

### v1.0.3~20190107
  * New icons.
  * Detects the default symbolic-icon color from the current theme.
  * Change the default color of the icon when spices need updates. This does not affect the choice made by the user.
  * Available languages: English, French, Spanish, Croatian, German.

### v1.0.2~20190104
  * Configure button added in menu, to open the settings.
  * Refresh button added in the settings, on each spice panel (applets, desklets ...) to force the refresh of the list.
  * Improved list refresh.
  * Make this applet icon resizable. (Fixes #2180)
  * Available languages: English, French, Spanish, Croatian.

### v1.0.1~20190103
  * Better management of notification messages.
  * A new option allows the user to choose whether identical messages are displayed or not.
  * SpicesUpdate@claudiux.pot updated.
  * Available languages: English, French, Spanish.

### v1.0.0~20190102
  * Fully functional.
  * Tested on Cinnamon 4.0.8 (Linux Mint 19.1 & Antergos (Arch) Linux).
  * Tested on Cinnamon 3.8.9 (Fedora 27).
  * Available languages: English, French.
