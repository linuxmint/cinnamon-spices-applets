#!/usr/bin/env bash
LOGFILE=$1
UUID="Gears@claudiux"
ICON="$HOME/.local/share/cinnamon/applets/$UUID/icon.png"
XENITY=$(echo -n $(which xenity zenity yad  2>&1 | head -n 1))
tail --lines=+1 -f $LOGFILE | $XENITY --title "glxgears.log" --text-info --width 550 --height 600 --window-icon="$ICON"
exit 0
