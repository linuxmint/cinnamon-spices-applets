#!/bin/sh
# Reload an applet.
# Many thanks to hyOzd for this tip !
# replace the EXTENSION_UUID with your extension/applet/desklet name
# replace the APPLET word in XLET with other types if you are not working with an applet
EXTENSION_UUID='VPN-Sentinel@claudiux'
XLET='APPLET'
dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:"$EXTENSION_UUID" string:"$XLET"
exit 0
