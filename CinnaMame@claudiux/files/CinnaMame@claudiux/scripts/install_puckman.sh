#!/bin/bash
### Create ~/mame/roms if necessary:
mkdir -p $HOME/mame/roms
### Pause 1 second:
sleep 1
### Copy puckman.zip at the right place:
cp -f -a $HOME/.local/share/cinnamon/applets/CinnaMame@claudiux/files/puckman.zip $HOME/mame/roms/puckman.zip
exit 0
