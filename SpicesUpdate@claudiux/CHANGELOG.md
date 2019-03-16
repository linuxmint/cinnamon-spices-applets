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