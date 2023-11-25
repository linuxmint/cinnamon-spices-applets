#!/bin/sh
# Check dependencies for proper VPN-Sentinel@claudiux applet operation.

i=0
dpkg --get-selections | egrep "^sox" | egrep -v "deinstall" > /dev/null || let i++
dpkg --get-selections | egrep "^libsox-fmt-mp3" | egrep -v "deinstall" > /dev/null || let i=$((i+2))
dpkg --get-selections | egrep "^zenity[^-]" | egrep -v "deinstall" > /dev/null || let i=$((i+4))
#echo $i
exit $i
