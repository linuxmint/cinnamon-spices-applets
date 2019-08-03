#!/bin/sh
#
#Script calls upower and writes values of battery percentage and state to temporary files which can be read by the BAMS applet
#
upower -i $(upower -e | grep BAT) | grep -E percentage | xargs | cut -d' ' -f2|sed s/%// > .batteryPercentage
upower -i $(upower -e | grep BAT) | grep -E state | xargs | cut -d' ' -f2|sed s/%// > .batteryState
exit 0
