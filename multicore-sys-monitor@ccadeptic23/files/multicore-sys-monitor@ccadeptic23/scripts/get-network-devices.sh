#!/usr/bin/env bash
data=()
interfaces=()

for interface in $(ls /sys/class/net); do {
        [ "$interface" = "lo" ] || {
                interfaces+=("${interface}")
                status=$(cat /sys/class/net/${interface}/operstate)
                data+=("${interface}:$status")
        }
}; done

i=0
ind=0
for interface in $(nmcli connection show --active | awk '{print $NF}'); do {
        [ $i -eq 0 ] || {
                [ "$interface" = "lo" ] || {
                        found="false"
                        len=${#interfaces[@]}
                        for ((j=0; j<len; j++)); do {
                                [ "${interfaces[$j]}" == "$interface" ] && {
                                        found="true"
                                        ind=$j
                                }
                        }; done
                        #~ rx=$(cat /sys/class/net/$interface/statistics/rx_bytes)
                        #~ tx=$(cat /sys/class/net/$interface/statistics/tx_bytes)
                        [ "$found" =  "true" ] && {
                                data[$ind]="$interface:up"
                        } || {
                                interfaces+=("${interface}")
                                data+=("$interface:up")
                        }
                }
        }
        i=$((i+1))
}; done


echo -n "${data[@]}" > "$XDG_RUNTIME_DIR/network_devices"

exit 0
