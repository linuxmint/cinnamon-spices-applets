#!/bin/bash
### Installs playerctl with password dialog:
pkexec pkcon -y install playerctl
### Pause 1 second:
sleep 1
### Restarts the sound150 applet:
dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'sound150@claudiux' string:'APPLET'
exit 0
