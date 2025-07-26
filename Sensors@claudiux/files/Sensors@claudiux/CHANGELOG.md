### v5.6.1~20250701
  * Fixes bad data in json file.

### v5.6.0~20250630
  * Ignores invalid sensors.

### v5.5.0~20250620
  * Add Devuan support.

### v5.4.2~20250401
  * Minor changes about font size.
  * Code cleanup in applet.js.

### v5.4.1~20250330
  * Minor changes about applet width.

### v5.4.0~20250329
  * Now applet width can be fixed by user (for horizontal panels).
  * Fixes #7005.

### v5.3.2~20250228
  * Fixes scenario where special characters would appear next to temperatures on the panel.

### v5.3.1~20250223
  * Removed option "Only show positive values" for fans. (Value fixed to false.)
  * Fixes #6845.

### v5.3.0~20250222
  * Users can now choose the type of separator.

### v5.2.0~20250221
  * Separator is coming back!

### v5.1.0~20250221
  * Font size can now be set from 60% to 120% of standard size (instead of 80% to 120%).
  * Fixes #6896.

### v5.0.0~20250220
  * Individual High/Critical Value Indications.
  * High/Critical Value Color can be selected.
  * Custom emoji can be added/selected.
  * Fixes #6846.

### v4.2.1~20250215
  * Fixes #6868.

### v4.2.0~20250205
  * Fixes several issues.
  * Fixes #6845.
  * Fixes #6766.
  * Fixes #6842.

### v4.1.0~20250130
  * Improves dependency installation.
  * Fixes #6809 and #6818.

### v4.0.3~20250126
  * Improved code. Greater stability.
  * Change of Fan symbol.

### v4.0.2~20250116
  * mainloopTools library: improvements.

### v4.0.1~20250114
  * As long as the icon is hovered over, the sensors are checked every second.

### v4.0.0~20250114
  * Now uses mainloopTools to improve loop management.
  * Fixes #6744.

### v3.9.0~20241109
  * Fixes #6076: Ignores 'empty' sensors (sensors not sending data).

### v3.8.3~20241029
  * Fixes #6541. Adds FAQ about Nvidia video card temperature readings. Thanks to @JEleniel!

### v3.8.2~20241011
  * Adds support for Nvidia SMI temperatures. Thanks to @JEleniel!

### v3.8.1~20240901
  * Fixes #6353. Repairs tooltip.

### v3.8.0~20240818
  * Fixes #6300. Better display on a vertical panel.

### v3.7.0~20240425
  * Added option to record values exceeding limits.
  * Fixes  #5606.

### v3.6.2~20240402
  * Displays the tooltip regardless of the refresh interval.

### v3.6.1~20240331
  * More refresh intervals.

### v3.6.0~20240215
  * Adds ability to choose the color of the text in panel.

### v3.5.3~20240213
  * Minor change in settings: A sensor's name can now be displayed in full.

### v3.5.2~20240124
  * Prevents display error.

### v3.5.1~20240120
  * Improves subprocesses (part2).

### v3.5.0~20240119
  * Improves subprocesses.

### v3.4.0~20240107
  * Fixes #5352.
  * Added an option in the General tab to display a tooltip or not.

### v3.3.0~20240102
  * Fixes #4986.
  * From now on, the monospace font style is only used when size must be preserved.

### v3.2.1~20240102
  * Toggle menu after selecting Suspend option.

### v3.2.0~20240101
  * Adds the ability to suspend this applet (menu option).

### v3.1.3~20231231
  * Adds the --icon parameter for zenity v4.
  * Allows translations for messages in bash scripts.

### v3.1.2~20231230
  * Removes the --window-icon parameter for zenity v4.

### v3.1.1~20230708
  * Fixes #4929

### v3.1.0~20230630
  * Fixes issues for Manjaro and Arch Linux.

### v3.0.3~20230615
  * Fixes #4846 (/var/log/auth.log flooding by sudo)

### v3.0.2~20230607
  * Fixes #4886 (double-separator bug)

### v3.0.1~20230429
  * lib/checkDependencies.js: fixes  #4828

### v3.0.0~20230420
  * Now users can specify certain limit values and a formula to correct the values returned by a sensor.

### v2.0.3~20230205
  * Better integration with Fedora - Fixes #4672

### v2.0.2~20230105
  * Minor bug fix: remove useless trailing separator 

### v2.0.1~20221228
  * Bugfixes (changing text color)

### v2.0.0~20221113
  * Can now read disk temperature.

### v1.4.0~20201006
  * Add script `xs.py` for compatibility with Cinnamon 3.8 and 4.0.
  * Rewritten function `versionCompare` (in `constants.js`).

### v1.3.0~20201002
  * Avoid wasted processor time and memory leaks.

### v1.2.1~20200926
  * Fixes a bug on distros that have not LANGUAGE in env.

### v1.2.0~20200925
  * Try to make it compatible for Cinnamon 3.8 -> 4.6.
  * More methods to detect the user's language.
  * Code cleanup.

### v1.1.0~20200923

  * Add two display options (feature requests from @pnsantos):
    * Remove border line.
    * Remove icons.
  * Bug fixes.

### v1.0.0~20200916

  * Initial version.
  * Tested on:
    * Mint
    * Debian
    * Arch
    * Fedora
  * Developed for Cinnamon 4.4 and 4.6, but may work with some lesser versions.

