## CHANGELOG

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
