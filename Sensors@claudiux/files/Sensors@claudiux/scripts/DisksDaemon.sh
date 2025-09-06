#!/usr/bin/env bash

DISKS=$(lsblk | grep disk | awk '{print $1}' | tr '\n' ' ' | sed -e "s/\ $//")

SENSORS_DIR="$XDG_RUNTIME_DIR/Sensors"
WITNESS="$SENSORS_DIR/DisksWitness"
[ -d $SENSORS_DIR ] || {
    mkdir -p $SENSORS_DIR
}

touch $WITNESS

SENSORSDAEMON_PIDS="$SENSORS_DIR/DisksPIDS"

# Removes all running DisksDaemon:
[ -f $SENSORSDAEMON_PIDS ] && {
    for p in $(cat ${SENSORSDAEMON_PIDS}); do {
        kill $p
    }; done
}

echo "$$" > ${SENSORSDAEMON_PIDS}

is_running=true

while $is_running
do
    for disk in $DISKS; do {
        DEVICE="/dev/${disk}"
        if sudo smartctl -i "$DEVICE" | grep -q "NVMe Version"; then
            TEMP=$(sudo smartctl -A "$DEVICE" | grep 'Temperature:' | awk '{print $2}')
        elif sudo smartctl -i "$DEVICE" | grep -q "SATA Version"; then
            TEMP=$(sudo smartctl -A "$DEVICE" | grep 'Temperature_Cel' | awk '{print $10}')
        else
            TEMP="n/a"
        fi
        echo -n "$TEMP" > "${SENSORS_DIR}/temp_${disk}"
    };done
    sleep 0.5
    [ -f $WITNESS ] || is_running=false
done
