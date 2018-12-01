#!/bin/sh
#

if [ "$(pidof transmission-gtk)" != "" ]; then {
	RET=1 
	} else {
	RET=0
	transmission-gtk &
} fi

exit $RET
