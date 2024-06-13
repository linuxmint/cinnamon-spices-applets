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

