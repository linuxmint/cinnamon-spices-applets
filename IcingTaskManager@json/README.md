Icing Task Manager
=============

**Icing Task Manager is deprecated for Cinnamon 4.0+. Please add the Grouped Window List applet to your panel, go to ITM's settings, and click "Migrate Pinned Apps to Grouped Window List".**

**Issues should be opened on ITM's [dedicated repository](https://github.com/jaszhix/icingtaskmanager). All PRs should be submitted to the Cinnamon Spices repository.**

This is a fork of the unfinished development branch of [Window List With App Grouping](https://github.com/jake-phy/WindowIconList/) applet, originally by jake-phy who forked the code from [GNOME Shell Window List](https://github.com/siefkenj/gnome-shell-windowlist/).

### Changes from the original version

See the [changelog](https://github.com/jaszhix/icingtaskmanager/blob/master/CHANGELOG.md).

### Usage

There are many options in the applet's Preferences that cater to many users' different needs. If you find a problem with your theme, try toggling the options under Theme Settings.

In order to use Firefox bookmarks, you need to install the ```gir1.2-gda-5.0``` package.

### Contributing

*  Use the [latest NodeJS LTS](https://github.com/nodesource/distributions).
*  Install node modules: ```npm install```
*  Install gulp globally: ```sudo npm install -g gulp```
*  From the root of this applet's directory, start transpile watch task: ```gulp spawn-watch```
  * This task will auto-reload the extension on every edit.
*  Monitor the logging output of xsession-errors:
  * ```tail -f -n100 ~/.xsession-errors.log```
* Use two spaces for indentation.
