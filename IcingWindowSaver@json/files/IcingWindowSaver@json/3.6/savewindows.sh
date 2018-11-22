#!/bin/bash

wmctrl -p -G -l | awk '($2 != -1)&&($3 != 0)&&($NF != "Desktop")' | awk '{print $1}' | while read mywinid
do
    xwininfo -id "$mywinid" >> $HOME/.local/share/cinnamon/applets/IcingWindowSaver@json/4.0/.windows.txt
done