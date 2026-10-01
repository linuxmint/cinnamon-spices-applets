#!/usr/bin/env bash
### Installs imagemagick with password dialog:
[ -x /usr/bin/pkcon ] && {
    pkexec pkcon -y install imagemagick
} || {
    [ -x /usr/bin/pkgcli ] && pkexec pkgcli -y install imagemagick
}
### Pause 1 second:
sleep 1
### Restarts the sound150 applet:
dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'sound150@claudiux' string:'APPLET'
exit 0
