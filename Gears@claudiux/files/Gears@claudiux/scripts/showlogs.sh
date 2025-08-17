#!/usr/bin/env bash
LOGFILE=$1
UUID="Gears@claudiux"
ICON="$HOME/.local/share/cinnamon/applets/$UUID/icon.png"
tail --lines=+1 -f $LOGFILE | zenity --title "glxgears.log" --text-info --width 550 --height 600 --window-icon="$ICON"
exit 0
