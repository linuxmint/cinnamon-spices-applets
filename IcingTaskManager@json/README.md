Icing Task Manager
=============

This is a fork of the unfinished development branch of [Window List With App Grouping](https://github.com/jake-phy/WindowIconList/) applet, originally by jake-phy who forked the code from [GNOME Shell Window List](https://github.com/siefkenj/gnome-shell-windowlist/).

### Changes from the original version

See the [changelog](https://github.com/jaszhix/icingtaskmanager/blob/master/CHANGELOG.md).

### Importing pinned apps from the Window List With App Grouping applet

**Automatic**

  * Clone the repository or download ```importPinned.py```.
  * Run ```python importPinned.py```

**Manual**

  * Go to directory: ~/.cinnamon/configs/WindowListGroup@jake.phy@gmail.com
  * Open the JSON file with a text editor.
  * Go to line 55, or to a block that starts with "pinned-apps".
  * Select and copy the block beginning with "pinned-apps" and all of its contents between the brackets.
  * Go to directory: ~/.cinnamon/configs/IcingTaskManager@json
  * Open the JSON file, replace Icing configuration's "pinned-apps" block with the one you copied. Ensure only the key ("pinned-apps"), its brackets, and its contents are replaced. Make sure the ending bracket has a trailing comma. Do not change the filename.

### Usage

There are many options in the applet's Preferences that cater to many users' different needs. If you find a problem with your theme, try toggling the options under Theme Settings.

In order to use Firefox bookmarks, you need to install the ```gir1.2-gda-5.0``` package.

### Contributing

It is recommended to submit issues on ITM's [dedicated repository](https://github.com/jaszhix/icingtaskmanager). All PRs should be submitted to the Cinnamon Spices repository.

*  Use [Node 6.x LTS](https://github.com/nodesource/distributions).
```sh
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs
```
*  Install node modules: ```npm install```
*  Install gulp globally: ```sudo npm install -g gulp```
*  From the root of this applet's directory, start transpile watch task: ```gulp spawn-watch```
  * This task will auto-reload the extension on every edit.
*  Monitor the logging output of these files: 
  * ```tail -f -n100 ~/.cinnamon/glass.log```
  * ```tail -f -n100 ~/.xsession-errors.log```
* Use two spaces for indentation, and ES2015 equivalent syntax when possible. 
  * You may want to read Babel's [documentation](https://babeljs.io/learn-es2015/) if you are not familiar with ES2015.
