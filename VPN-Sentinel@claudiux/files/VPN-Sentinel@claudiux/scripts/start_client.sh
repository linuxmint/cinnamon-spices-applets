#!/bin/sh
#
CLIENT=$1
if [ "$CLIENT" = "" ]; then {
    # CLIENT is empty
    exit 2
} fi

if [ "$(pidof $CLIENT)" != "" ]; then {
    RET=1
} else {
    RET=0
    sleep 5
    $($CLIENT) &
} fi

exit $RET
