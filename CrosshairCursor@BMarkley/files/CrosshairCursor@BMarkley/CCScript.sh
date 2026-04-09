#!/bin/bash
if pgrep -x "CrosshairCursor" > /dev/null
then
    pkill -x CrosshairCursor
    sleep 0.2
else
    ~/.local/share/cinnamon/applets/CrosshairCursor@BMarkley/CrosshairCursor/CrosshairCursor -fg lightgrey -bg black &
    sleep 0.2
fi
