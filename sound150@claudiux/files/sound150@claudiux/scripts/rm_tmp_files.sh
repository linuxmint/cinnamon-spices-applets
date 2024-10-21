#!/bin/bash
### Removes cover art files.

rm -f /tmp/*.mediaplayer-cover
#~ rm -f /tmp/audacious-temp-*

ARTDIR="$XDG_RUNTIME_DIR/sound150/arts"
[[ -d $ARTDIR ]] && rm -f $ARTDIR/*
[[ -f "$XDG_RUNTIME_DIR/sound150/Title" ]] && rm -f "$XDG_RUNTIME_DIR/sound150/Title"


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
