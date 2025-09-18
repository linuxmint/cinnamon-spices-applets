#!/usr/bin/env bash
[ -x $(which xrandr) ] || exit 1
ACTIVEMONITOR=$(xrandr --listactivemonitors | awk '/0:/ { print $4; exit }')
BRIGHTNESS=$(xrandr --verbose | awk '/Brightness/ { print $2; exit }')
echo -n "$BRIGHTNESS $ACTIVEMONITOR"
exit 0
