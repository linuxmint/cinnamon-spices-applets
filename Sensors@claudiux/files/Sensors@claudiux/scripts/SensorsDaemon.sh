#!/usr/bin/env bash

SENSORS_DIR="$XDG_RUNTIME_DIR/Sensors"
WITNESS="$SENSORS_DIR/witness"
[ -d $SENSORS_DIR ] || {
    mkdir -p $SENSORS_DIR
}

touch $WITNESS

SENSORS_DATA="$SENSORS_DIR/sensors.txt"
SENSORS_DATA_TEMP="$SENSORS_DIR/_sensors.txt"
SENSORSDAEMON_PIDS="$SENSORS_DIR/PIDS"

# Removes all running SensorsDaemon:
[ -f $SENSORSDAEMON_PIDS ] && {
    for p in $(cat ${SENSORSDAEMON_PIDS}); do {
        kill $p
    }; done
}

echo "$$" > ${SENSORSDAEMON_PIDS}

is_running=true

while $is_running
do
    sensors -j | grep -v '^ERROR' > $SENSORS_DATA_TEMP
    sleep 0.5
    mv $SENSORS_DATA_TEMP $SENSORS_DATA
    [ -f $WITNESS ] || is_running=false
done
