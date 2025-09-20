#!/usr/bin/env bash

[ -x $(which xrandr) ] || exit 1

#~ ACTIVEMONITORS=$(cat test.txt | awk '/[0-9]+:/ { print $4 }')
#~ BRIGHTNESSES=($(cat test2.txt | awk '/Brightness/ { print $2 }'))
ACTIVEMONITORS=$(xrandr --listactivemonitors | awk '/[0-9]+:/ { print $4 }')
BRIGHTNESSES=($(xrandr --verbose | awk '/Brightness/ { print $2 }'))

DEFAULTBRIGHTNESS=($(xrandr --verbose | awk '/Brightness/ { print $2 ; exit }'))
ret=""
i=0
for monitor in $ACTIVEMONITORS; do {
    brightness="${BRIGHTNESSES[$i]}"
    [ "$brightness" == "" ] && brightness=$DEFAULTBRIGHTNESS
    [ $i == 0 ] && ret="$monitor,$brightness" || ret="$ret $monitor,$brightness"
    i=$((i+1))
}; done
echo -n $ret
exit 0
