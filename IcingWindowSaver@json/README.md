Window Position Saver
=============

This applet allows you to save and restore all of your windows' positions through a menu, or using hot keys.

 * SHIFT+CTRL+S - Save windows
 * SHIFT+CTRL+R - Restore windows

Requires ```xwininfo``` and ```wmctrl``` packages. Requires Cinnamon/CJS 3.4+.

### Contributing

*  Use the [latest NodeJS LTS](https://github.com/nodesource/distributions).
*  Install node modules: ```yarn```
*  Install gulp globally: ```sudo npm install -g gulp```
*  From the root of this applet's directory, start watch task: ```gulp spawn-watch```
  * This task will auto-reload the extension on every edit.
*  Monitor the logging output of xsession-errors:
  * ```tail -f -n100 ~/.xsession-errors.log```
* Use two spaces for indentation.