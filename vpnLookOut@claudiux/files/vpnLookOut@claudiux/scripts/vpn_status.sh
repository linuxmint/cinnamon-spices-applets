#!/bin/sh
#
# This script verifies if vpn interface is connected and writes state ("on" or "off") to temporary files
# which can be read by the VPNstatus applet
VPNINTERFACE=$1
## [[ "x$VPNINTERFACE" == "x" ]] && VPNINTERFACE="tun0"
cat /proc/net/dev | grep $VPNINTERFACE && (echo -n "on" > /tmp/.vpn_status ; echo -n `nmcli connection show --active | grep vpn | awk '{print$1}'` > /tmp/.vpn_name) || echo -n "off" > /tmp/.vpn_status

exit 0
