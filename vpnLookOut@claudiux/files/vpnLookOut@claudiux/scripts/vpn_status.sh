#!/bin/sh
#
# This script verifies if vpn interface is connected and writes state ("on" or "off") to temporary files
# which can be read by the VPNstatus applet
if [ -z $1 ]
then
    VPNINTERFACE="tun0"
else
    VPNINTERFACE=$1
fi
cat /proc/net/dev | grep $VPNINTERFACE && (echo -n "on" > /tmp/.vpn_status ; echo -n $(nmcli -t -f NAME,TYPE connection show --active | grep vpn | sed -e "s/:vpn$//" | tr "\n" ";" | sed s/";$"/""/) > /tmp/.vpn_name) || echo -n "off" > /tmp/.vpn_status

exit 0
