#!/bin/bash
### Removes cover art files.

rm -f /tmp/*.mediaplayer-cover
#~ rm -f /tmp/audacious-temp-*

ARTDIR="$HOME/.config/sound150/arts"
[[ -d $ARTDIR ]] && rm -f $ARTDIR/*

SCRIPTSPWD=$(pwd)
VLCARTDIR="$HOME/.cache/vlc/art/arturl"
[[ -d $VLCARTDIR ]] && {
        cd $VLCARTDIR
        rm -rf *
}
cd $SCRIPTSPWD

RHYTHMBOXART="$HOME/.cache/rhythmbox/album-art"
[[ -d $RHYTHMBOXART ]] && rm -f $RHYTHMBOXART/*
exit 0
