#!/bin/bash
LOGFILE=$HOME/.cinnamon/configs/SpicesUpdater@claudiux/SU_activity.log
ICON=$HOME/.local/share/cinnamon/applets/SpicesUpdater@claudiux/icon.png
TITLE="Spices Udater Log File"
tail --lines=+1 -f $LOGFILE | zenity --title "$TITLE" --text-info --width 800 --height 400 --window-icon="$ICON"
exit 0
