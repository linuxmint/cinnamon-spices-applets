#!/bin/bash

# Source : https://sourceforge.net/p/yad-dialog/wiki/LogViewer/

if [ "$#" = "1" ]; then {
    pkill -P $1;
} fi

APPLETNAME="VPN-Sentinel"
UUID="VPN-Sentinel@claudiux"
OLDLOGFILE=$HOME/.cinnamon/configs/$UUID/vpn_activity.log
LOGDIR=$HOME/.config/$APPLETNAME
mkdir -p $LOGDIR
LOGFILE=$LOGDIR/vpn_activity.log

[ -f $OLDLOGFILE ] && mv -u $OLDLOGFILE $LOGFILE

ICON=$HOME/.local/share/cinnamon/applets/$UUID/icons/vpn-sentinel-symbolic.svg
TITLE="VPN-Sentinel Log"
THISPID="$$"

PARSER='{font="bold"; color="#000000"}; \
/kernel/ {font="italic"}; \
/warn/ {color="#FFF4B8"}; \
/error/ {color="#FFD0D8"}; \
OFS="\n" {print $1, $2, $3, font, color; fflush()}'

tail --lines=+1 -f $LOGFILE | awk -F"|" "$PARSER" | \
yad --title="$TITLE" --window-icon="$ICON" \
    --button=gtk-delete:"/bin/bash -c 'rm -f $LOGFILE; touch $LOGFILE; $0 $THISPID &'" \
    --button=gtk-refresh:"/bin/bash -c '$0 $THISPID &'" --button=gtk-close:"/usr/bin/pkill -P $THISPID" --kill-parent=15 --width 900 --height 900 \
    --list --text="$LOGFILE" --grid-lines=hor \
    --column "$(gettext -d timeshift 'Timestamp')":HD --column "$(gettext -d cinnamon 'Date and Time')" --column "$(gettext -d cinnamon 'Message')" \
    --column @font@ --column @back@ \
    --no-selection --add-on-top --tail

exit $?
