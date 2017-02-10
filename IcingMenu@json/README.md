Icing Menu
=============

This is a fork of the default Cinnamon 3.2 menu applet, with more customization options, and some optimizations.

### Features

 * Set the height and width of the menu.
 * Accurate drill down of search results.
 * Move the search box and app info area to the top, bottom, or hide them.
 * Ability to hide the scrollbar.

Tested on Cinnamon 3.2+.

### Contributing

*  Use [Node 6.x LTS](https://github.com/nodesource/distributions).
```sh
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs
```
*  Install node modules: ```npm install```
*  Install gulp globally: ```sudo npm install -g gulp```
*  Start transpile watch task: ```gulp spawn-watch```
  * This task will auto-reload the extension on every edit.
*  Monitor the logging output of these files: 
  * ```tail -f -n100 ~/.cinnamon/glass.log```
  * ```tail -f -n100 ~/.xsession-errors.log```
* Use two spaces for indentation, and ES2015 equivalent syntax when possible. 
  * You may want to read Babel's [documentation](https://babeljs.io/learn-es2015/) if you are not familiar with ES2015.
* After you have finished making changes, include both the changed files in the ```src``` and ```files``` directories in your PR.