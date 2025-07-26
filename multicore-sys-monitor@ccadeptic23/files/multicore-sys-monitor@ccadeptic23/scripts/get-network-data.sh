#!/bin/bash
data=""
for i in $(ls /sys/class/net); do {
        status=$(cat /sys/class/net/$i/operstate)
        [[ $status == "up" ]] && {
                rx=$(cat /sys/class/net/$i/statistics/rx_bytes)
                tx=$(cat /sys/class/net/$i/statistics/tx_bytes)
                data=$data"$i:$rx:$tx "
        }
}; done

echo -n $data

exit 0
