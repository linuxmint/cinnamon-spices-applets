#!/bin/sh
#
RET=1
if [ `pidof transmission-gtk` != "" ]; then { 
	RET=0
	kill -15 `pidof transmission-gtk` & 
} fi

exit $RET
