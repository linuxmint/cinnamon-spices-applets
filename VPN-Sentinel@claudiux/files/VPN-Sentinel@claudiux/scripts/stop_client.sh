#!/bin/bash
#
CLIENT=$1
if [ "$CLIENT" = "" ]; then {
    # CLIENT is empty
    exit 2
} fi

if [ "$(pidof $CLIENT)" = "" ]; then {
    i=0
    PGREP=$(pgrep -f "$CLIENT")
    while [ "$PGREP" != "" ] && [ "$i" -lt "3" ]; do {
        i=$((i+1))
        for PID in $PGREP; do {
            #pkill -9 -f "$CLIENT" &
            kill $PID &
            sleep 1
        } done
        PGREP=$(pgrep -f "$CLIENT")
    } done

    if [ "$PGREP" != "" ]; then {

        # Error
        exit 1
    } fi

    exit 0
}; fi

PID=$(pidof $CLIENT)
RET=0
i=0

# Trying three times max to gently stop CLIENT :
while [ "$(pidof $CLIENT)" != "" ] && [ "$(pidof $CLIENT)" -eq "$PID" ] && [ "$i" -lt "3" ]; do {
    i=$((i+1))
    #echo $i
    kill -15 $(pidof $CLIENT) &
    sleep 3
} done

if [ "$i" -eq "3" ]; then {
    if [ "$(pidof $CLIENT)" != "" ] && [ "$(pidof $CLIENT)" -eq "$PID" ]; then {
        # Trying to hardly stop it:
        kill -9 $(pidof $CLIENT) &
        sleep 3
    } fi

    if [ "$(pidof $CLIENT)" != "" ] && [ "$(pidof $CLIENT)" -eq "$PID" ]; then {
        # Error
        RET=1
    } fi
} fi

exit $RET
