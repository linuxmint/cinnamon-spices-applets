#!/bin/sh
export TEXTDOMAIN="Sensors@claudiux"
export TEXTDOMAINDIR="${HOME}/.local/share/locale"
ICON=$HOME/.local/share/cinnamon/applets/Sensors@claudiux/icon.png
TITLE=$(gettext "Example of sensor values from this computer")
FILE=$HOME/.local/share/cinnamon/applets/Sensors@claudiux/scripts/report.txt
# From v4.0.0, zenity does not support anymore the --window-icon parameter;
# using --icon instead:
ZVERSION=$(zenity --version | cut -d"." -f1)
sleep 1
if [ -f $FILE ]; then {
  REPORT=$(cat $FILE)
  if [ "$ZVERSION" = "3" ]; then {
    echo "$REPORT" | zenity --title "$TITLE" --text-info --width 600 --height 800 --window-icon="$ICON" &
  }; else {
    echo "$REPORT" | zenity --title "$TITLE" --text-info --width 600 --height 800 --icon="$ICON" &
  }; fi
}; fi

exit 0
