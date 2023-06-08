#!/bin/bash
UUID="VPN-Sentinel@claudiux"
LOGFILE=$HOME/.cinnamon/configs/$UUID/vpn_activity.log
ICON=$HOME/.local/share/cinnamon/applets/$UUID/icons/vpn-sentinel-symbolic.svg
TITLE="VPN-Sentinel Log"


#PARSER='OFS="\n" -f| {print $1, $2, $3}'
#OFS="\n"
#IFS="|"
#tail --lines=+1 -f $LOGFILE | zenity --title "$TITLE" --text-info --width 800 --height 960 --window-icon="$ICON" # --wrap # --tail
tail --lines=+1 -f $LOGFILE | awk -F"|" '{print $1 "\n" $2 "\n" $3 "\n"}' | yad \
  --title "$TITLE" --button=gtk-close \
  --width 900 --height 900 --window-icon="$ICON" \
  --list --text="$LOGFILE" \
  --separator=" " \
  --column Timestamp:TXT --column Date:TXT --column Info:TXT

exit 0
