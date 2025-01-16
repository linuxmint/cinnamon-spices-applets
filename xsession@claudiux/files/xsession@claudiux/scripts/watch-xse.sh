#!/bin/bash
LOGFILE=$HOME/.xsession-errors
APPLET="xsession@claudiux"
ICON=$HOME/.local/share/cinnamon/applets/$APPLET/icons/face-glasses-symbolic.svg
TITLE="$HOME/.xsession-errors"
#~ PROGRAM=$0
# From v4.0.0, zenity does not support anymore the --window-icon parameter:
ZVERSION=$(zenity --version | cut -d"." -f1)
if [ "$ZVERSION" = "3" ]; then {
    tail --lines=+1 -f $LOGFILE | zenity --title "$TITLE" --text-info --width 1400 --height 960 --window-icon="$ICON" #--extra-button "Restart Cinnamon" --ok-button "OK"
}; else {
    tail --lines=+1 -f $LOGFILE | zenity --title "$TITLE" --text-info --width 1400 --height 960 --icon="$ICON" #--extra-button "Restart Cinnamon" --ok-button "OK"
}; fi

#~ RESULT=$(echo -n "$1")
#~ if [[ $RESULT=Restart* ]]; then {
    #~ cinnamon -r &
    #~ $($PROGRAM)
#~ }; fi
exit 0
