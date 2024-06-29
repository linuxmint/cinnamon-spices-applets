#!/bin/bash

set -eu

if pactl info | grep -q "Default Source: bluez_source.*.handsfree_head_unit"; then
    echo "present"
else
    echo "absent"
fi

