#!/bin/sh
#
# Example of return:
#vpn:enp2s0:30c15256-2838-4aa0-888e-4544f4d7cbff:yes:1658929072:Czech_Republic-Prague (IPv6);wireguard:Es-Madrid(W):6711baa7-4137-477d-856c-a2cd5736812d:no:1658929090:Es-Madrid(W)

ret=$(nmcli -t -f TYPE,DEVICE,UUID,AUTOCONNECT,TIMESTAMP,NAME connection show --active | egrep "vpn|wireguard" | tr "\n" ";" | sed s/";$"/""/)

if [ "$ret" = "" ]; then
    ret="::::0:";
fi

echo -n "$ret"

exit 0
