#!/usr/bin/env bash
### Installs mame with password dialog:
[ -x /usr/bin/pkcon ] && {
    pkexec pkcon -y install mame
} || {
    [ -x /usr/bin/pkgcli ] && pkexec pkgcli -y install mame
}
### Paused 1 second:
sleep 1
### Restarts the CinnaMame applet:
dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'CinnaMame@claudiux' string:'APPLET'
exit 0
