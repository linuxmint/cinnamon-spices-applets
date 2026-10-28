#!/usr/bin/env bash
NBLINES=$1
[[ -z $NBLINES ]] && NBLINES=50
LOGFILE=$HOME/.xsession-errors
APPLET="xsession@claudiux"
ICON=$HOME/.local/share/cinnamon/applets/$APPLET/icons/face-glasses-symbolic.svg
TITLE="$HOME/.xsession-errors"
XENITY=$(echo -n $(which xenity zenity yad  2>&1 | head -n 1))
#~ PROGRAM=$0
STR_EDIT=$(gettext -d nemo Edit)
tail --lines=$NBLINES -f $LOGFILE | $XENITY --title "$TITLE" --text-info --width 1400 --height 960 --window-icon="$ICON" --ok-label="$STR_EDIT" #--extra-button "Restart Cinnamon" --ok-button "OK"

RESULT=$(echo -n "$?")
if [ "$RESULT" = "0" ]; then { # ok button pressed:
    xdg-open $LOGFILE
}; fi

exit 0
