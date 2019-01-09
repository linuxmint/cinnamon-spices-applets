#!/bin/sh
# Get all the names of the VPN connection
# Return a list of items separated by ';'
#ret=`nmcli connection show | grep vpn | awk '{print$1}' | tr "\n" ";" | sed s/";$"/""/`
ret=$(nmcli -t -f NAME,TYPE connection show | grep vpn | sed -e "s/:vpn$//" | tr "\n" ";" | sed s/";$"/""/)
echo -n $ret
exit 0
