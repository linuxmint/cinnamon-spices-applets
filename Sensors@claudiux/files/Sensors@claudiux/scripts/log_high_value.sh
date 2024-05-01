#!/bin/bash
CATEGORY=$1
SENSOR=$2
SENSOR="${SENSOR//_/ }"
VALUE=$3
systemd-cat -t sensors -p warning echo "sensors: ${CATEGORY}: ${SENSOR}: has reached ${VALUE}"

exit 0
