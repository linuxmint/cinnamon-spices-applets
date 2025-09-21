#!/usr/bin/env bash
data=""
i=0

#~ for i in $(ls /sys/class/net); do {
        #~ status=$(cat /sys/class/net/$i/operstate)
        #~ [[ $status == "up" ]] && {
                #~ rx=$(cat /sys/class/net/$i/statistics/rx_bytes)
                #~ tx=$(cat /sys/class/net/$i/statistics/tx_bytes)
                #~ data=$data"$i:$rx:$tx "
        #~ }
#~ }; done

for interface in $(nmcli connection show --active | awk '{print $NF}'); do {
        [ $i -eq 0 ] || {
                [ "$interface" == "lo" ] || {
                        rx=$(cat /sys/class/net/$interface/statistics/rx_bytes)
                        tx=$(cat /sys/class/net/$interface/statistics/tx_bytes)
                        data=$data"$interface:$rx:$tx "
                }
        }
        i=$((i+1))
}; done

echo $data

exit 0
