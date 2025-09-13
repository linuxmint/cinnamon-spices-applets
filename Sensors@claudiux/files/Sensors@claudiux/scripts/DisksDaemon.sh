#!/usr/bin/env bash

DELAY=1
[ -n $1 ] && DELAY=$(($1))

PARAM2=$2

SENSORS_DIR="$XDG_RUNTIME_DIR/Sensors"
WITNESS="$SENSORS_DIR/DisksWitness"
[ -d $SENSORS_DIR ] || {
    mkdir -p $SENSORS_DIR
}

[ "$PARAM2" != "all" ] && {
    DISKS=$(echo -n $2 | tr "," " ")
} || {
    DISKS=$(lsblk | grep disk | awk '{print $1}' | tr '\n' ' ' | sed -e "s/\ $//")
}

touch $WITNESS

SENSORSDAEMON_PIDS="$SENSORS_DIR/DisksPIDS"
SENSORS_DISKS_DATA="$SENSORS_DIR/disks.txt"
SENSORS_DISKS_DATA_TEMPORARY="$SENSORS_DIR/_disks.txt"

# Removes all running DisksDaemon:
[ -f $SENSORSDAEMON_PIDS ] && {
    for p in $(cat ${SENSORSDAEMON_PIDS}); do {
        kill $p > /dev/null
    }; done
}

# Writes PID of this DisksDaemon:
echo "$$" > ${SENSORSDAEMON_PIDS}

is_running=true

while $is_running
do
    echo -n "" > $SENSORS_DISKS_DATA_TEMPORARY
    for disk in $DISKS; do {
        DEVICE="/dev/${disk}"
        TEMP=$(sudo smartctl -A "$DEVICE" | grep 'Temperature:' | awk '{print $2}')
        [ -n "$TEMP" ] || {
            TEMP=$(sudo smartctl -A "$DEVICE" | grep 'Temperature_Cel' | awk '{print $10}')
            [ -n "$TEMP" ] || TEMP="n/a"
        }
        echo "${disk} $TEMP" >> ${SENSORS_DISKS_DATA_TEMPORARY}
    };done
    sleep $DELAY
    # This prevents incomplete files from being read:
    mv ${SENSORS_DISKS_DATA_TEMPORARY} ${SENSORS_DISKS_DATA}
    [ -f $WITNESS ] || is_running=false
done

rm -f ${SENSORS_DISKS_DATA_TEMPORARY} ${SENSORS_DISKS_DATA} ${SENSORSDAEMON_PIDS}

exit 0
