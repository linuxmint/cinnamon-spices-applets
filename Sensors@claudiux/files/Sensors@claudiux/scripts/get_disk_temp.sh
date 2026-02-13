#!/usr/bin/env sh
# Author: @claudiux
# Contributor (NVMe devices): @kriegcc

DEVICE="/dev/$1"
if sudo smartctl -i "$DEVICE" | grep -q "NVMe Version"; then
    TEMP=$(sudo smartctl -A "$DEVICE" | grep 'Temperature:' | awk '{print $2}')
elif sudo smartctl -i "$DEVICE" | grep -q "SATA Version"; then
    TEMP=$(sudo smartctl -A "$DEVICE" | grep 'Temperature_Cel' | awk '{print $10}')
else
    echo "n/a"
    exit 1
fi

if [ -n "$TEMP" ]; then
    echo -n "$TEMP"
else
    echo "n/a"
    exit 1
fi

exit 0
