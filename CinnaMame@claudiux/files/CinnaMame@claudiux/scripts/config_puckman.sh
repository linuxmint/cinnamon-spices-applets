#!/bin/bash
### Create ~/.mame/cfg if necessary:
mkdir -p $HOME/.mame/cfg
### Pause 1 second:
sleep 1
### Copy puckman.zip at the right place:
cp -f -a $HOME/.local/share/cinnamon/applets/CinnaMame@claudiux/files/puckman.cfg $HOME/.mame/cfg/puckman.cfg
exit 0
