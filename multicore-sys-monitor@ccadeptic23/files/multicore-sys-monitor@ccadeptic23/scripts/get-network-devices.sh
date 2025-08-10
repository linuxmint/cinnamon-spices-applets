#!/usr/bin/env bash
data=""
for i in $(ls /sys/class/net); do {
        status=$(cat /sys/class/net/$i/operstate)
        data=$data"$i:$status "
}; done

echo $data

exit 0
