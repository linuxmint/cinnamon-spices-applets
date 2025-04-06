#!/bin/bash
NBLINES=$1
[[ -z $NBLINES ]] && NBLINES=50
LOGFILE=$HOME/.xsession-errors
APPLET="xsession@claudiux"
ICON=$HOME/.local/share/cinnamon/applets/$APPLET/icons/face-glasses-symbolic.svg
TITLE="$HOME/.xsession-errors"
#~ PROGRAM=$0
# From v4.0.0, zenity does not support anymore the --window-icon parameter:
STR_EDIT=$(gettext -d nemo Edit)
ZVERSION=$(zenity --version | cut -d"." -f1)
if [ "v$ZVERSION" = "v3" ]; then {
    tail --lines=$NBLINES -f $LOGFILE | zenity --title "$TITLE" --text-info --width 1400 --height 960 --window-icon="$ICON" --ok-label="$STR_EDIT" #--extra-button "Restart Cinnamon" --ok-button "OK"
}; else {
    tail --lines=$NBLINES -f $LOGFILE | zenity --title "$TITLE" --text-info --width 1400 --height 960 --icon="$ICON" --ok-label="$STR_EDIT"
}; fi

RESULT=$(echo -n "$?")
if [ "$RESULT" = "0" ]; then { # ok button pressed:
    xdg-open $LOGFILE
}; fi

exit 0
