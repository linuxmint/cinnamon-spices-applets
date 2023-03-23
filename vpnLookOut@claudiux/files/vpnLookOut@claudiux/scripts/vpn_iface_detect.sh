#!/bin/sh

VPN_IFACE=""
ret=1
for iface in $(ls -1 /sys/class/net/); do
	# Check if interface is a VPN
	if [ -f "/sys/class/net/$iface/tun_flags" ]; then {
		VPN_IFACE=$iface
		echo -n $VPN_IFACE
		echo -n $VPN_IFACE > /tmp/.vpn_iface
		ret=0
		break
	}; elif grep -Fxqs "65534" /sys/class/net/$iface/type ; then {
		VPN_IFACE=$iface
		echo -n $VPN_IFACE
		echo -n $VPN_IFACE > /tmp/.vpn_iface
		ret=0
		break
	};
	fi
done

exit $ret
