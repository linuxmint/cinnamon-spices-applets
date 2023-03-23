#!/bin/sh
ICON=$HOME/.local/share/cinnamon/applets/Sensors@claudiux/icon.png
TITLE="Sensors@claudiux"
FILE=$HOME/.local/share/cinnamon/applets/Sensors@claudiux/scripts/report.txt

sleep 1
if [ -f $FILE ]; then {
  REPORT=$(cat $FILE)
  echo "$REPORT" | zenity --title "$TITLE" --text-info --width 600 --height 800 --window-icon="$ICON" &
}; fi

exit 0
