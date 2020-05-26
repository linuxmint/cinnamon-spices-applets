#!/bin/bash
#
RET=0
i=0
# Trying three times max to gently stop transmission-gtk :
while [ "$(pidof transmission-gtk)" != "" ] && [ "$i" -lt "3" ]; do { 
	i=$((i+1))
    #echo $i
	kill -15 $(pidof transmission-gtk) &
    sleep 3
} done

if [ "$i" -eq "3" ]; then {
    if [ "$(pidof transmission-gtk)" != "" ]; then {
        # Trying to hardly stop it:
        kill -9 $(pidof transmission-gtk) &
        sleep 3
    } fi

    if [ "$(pidof transmission-gtk)" != "" ]; then {
        # Error
        RET=1
    } fi
} fi

exit $RET
