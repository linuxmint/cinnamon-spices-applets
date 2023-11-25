#!/bin/sh
# Get all the names of the VPN connection
# Return a list of items separated by ;
ret=$(nmcli -t -f NAME,TYPE connection show | egrep "vpn|wireguard" | sed -e "s/:.*$//" | tr "\n" ";" | sed s/";$"/""/)
echo -n "$ret"
exit 0
