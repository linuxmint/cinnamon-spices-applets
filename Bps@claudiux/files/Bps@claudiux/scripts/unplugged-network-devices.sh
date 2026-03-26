#!/usr/bin/env bash
unplugged=""
for i in $(ls /sys/class/net); do {
        status=$(cat /sys/class/net/$i/operstate)
        [[ $status == "up" ]] || unplugged=$unplugged"$i "
}; done

echo $unplugged

exit 0
