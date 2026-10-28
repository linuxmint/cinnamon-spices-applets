#!/usr/bin/env sh
export TEXTDOMAIN="Sensors@claudiux"
export TEXTDOMAINDIR="${HOME}/.local/share/locale"
ICON=$HOME/.local/share/cinnamon/applets/Sensors@claudiux/icon.png
TITLE=$(gettext "Example of sensor values from this computer")
#~ FILE=$HOME/.local/share/cinnamon/applets/Sensors@claudiux/scripts/report.txt
FILE=${XDG_RUNTIME_DIR}/Sensors_report.txt
XENITY=$(echo -n $(which xenity zenity yad  2>&1 | head -n 1))
sleep 1
if [ -f $FILE ]; then {
  REPORT=$(cat $FILE)
  echo "$REPORT" | $XENITY --title "$TITLE" --text-info --width 600 --height 800 --window-icon="$ICON" &
}; fi

exit 0
