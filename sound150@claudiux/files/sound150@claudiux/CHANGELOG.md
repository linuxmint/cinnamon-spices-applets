## CHANGELOG

### v3.1.0~20230520
  * Fixes a deprecation.

### v3.0.0~20230310
  * Rebase and update for cinnamon 5.4 (thanks to @rcalixte).
  * Overwrite existing binding of AudioRaiseVolume and AudioLowerVolume keysym. (Fixes [issue #9919](https://github.com/linuxmint/cinnamon/issues/9919))

### v2.0.0~20200731
  * New code for Cinnamon 4.4 (Mint 19.3) and Cinnamon 4.6 (Mint 20).
  * During volume slider dragging, a tooltip containing the value of the volume percentage is shown.
  * Now use Cinnamon Settings to set amplification (ie change the value of maximum volume).
  * The @Rodrigo-Barros patch to show Spotify-Player album art is now included! Many thanks to him!

### v1.5.1
 * Fixes a typo.
### v1.5.0
 * Fixes an issue in Cinnamon 3.6.x, setting right permissions to script files

### v1.4.2
 * Change the appearance of the applet icon when colors are not in use, to better alert the user when the sound is greater than 100%.

### v1.4.1
 * The magnetic property of the 100% mark becomes optionnal.
 * Translations:
   * Available languages: English, French, Spanish, Italian, Russian and now **Danish** (thanks to @Alan01!).

### v1.4.0
 * The 100% mark in sound settings becomes magnetic.
 * The applet and sound settings sliders become synchronized.

### v1.3.4
 * This sound150@claudiux applet becomes multiversion:
   * Cinnamon **3.4** & **3.6** (Linux Mint **18.2** & **18.3**)
   * Cinnamon **2.8**, **3.0** & **3.2** (Linux Mint **17.3**, **18** & **18.1**)
 * Seems to be ready for Cinnamon **3.8** (Linux Mint **19**). Thanks to @jaszhix !

### v1.3.3
 * This sound150@claudiux applet becomes multiversion:
   * Cinnamon 3.6 (Linux Mint 18 to 18.3)
   * Cinnamon 2.8 (Linux Mint 17.3) (**NEW**)

### v1.3.2
 * Translations:
   * Available languages: English, French, Spanish, Italian, and now **Russian** (thanks to @sem5959!).

### v1.3.1
 * Fixes a bug : Now, the reloading of this applet after installing new .mo files (for translations) takes place a few seconds after it is initialized, to avoid a crash of the applet or even Cinnamon.
 * Code modified to suit the import methods of .js files in Cinnamon 3.8. Thanks to @jaszhix!

### v1.3.0
 * No more stylesheet.css; uses theme's style sheet for better look.
 * Colors become optionnal.
 * Applet is now able to increase the volume up to maximum of capabilities of the sound card. But to let a security margin, this option is not proposed to user.
 * Set scripts/generate_mo.sh executable.
 * Set default max volume to 150%.

### v1.2.0
 * Added a mark on the sliders to signal the '100%' position of the volume.

### v1.1.0
 * Possibility of choosing, in settings, the value of incrementation/decrementation of the volume (in % of nominal volume).
 * The "100%" value is magnetic.

### v1.0.0
 * Allows to set maximum volume up to 150% of the nominal volume of the sound card.
 * Displays coloured icons and slides when volume is greater than 100%.
 * Translations:
   * Automatic installation of the translation files.
   * Available languages: English, French, Spanish, Italian.
   * The sound150@claudiux.pot file is present in the /po directory.
