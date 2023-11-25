#!/bin/bash
LOGFILE=$HOME/.xsession-errors
APPLET="xsession@claudiux"
ICON=$HOME/.local/share/cinnamon/applets/$APPLET/icons/face-glasses-symbolic.svg
TITLE="$HOME/.xsession-errors"
tail --lines=+1 -f $LOGFILE | zenity --title "$TITLE" --text-info --width 1400 --height 960 --window-icon="$ICON"
exit 0
