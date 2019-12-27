# gnote-cinnamon-applet
Uses GNote's DBUS API to provide an applet for the Cinnamon Desktop. 

As of Mint 19.3, GNote is now the default note taking application (replacing Tomboy). 
However, this meant the loss of the tray icon for quick access to notes, something I
find too useful to lose. 

This applet replaces that lost functionality.

Prerequisites
=============
If not already installed by your distribution, install the gnote itself. 

```
sudo apt install gnote
```

## Changelog

### v1577449518

 * Different icon.
 * Symbolic icon.
 * Got rid of debug output and other error messages.
 * Changed how menu is rebuilt on changes.

### v1577357545

 * Initial release
 
  