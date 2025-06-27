#!/bin/bash
### Installs mame with password dialog:
pkexec pkcon -y install mame
### Pause 1 second:
sleep 1
### Restarts the CinnaMame applet:
dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'CinnaMame@claudiux' string:'APPLET'
exit 0
