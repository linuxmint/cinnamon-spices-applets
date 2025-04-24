#!/bin/bash
DIRART=${XDG_RUNTIME_DIR}/AlbumArt/song-art
[[ -d $DIRART ]] && rm -f ${DIRART}/R3SongArt*

ARTDIR=$XDG_RUNTIME_DIR/sound150/arts
[[ -d $ARTDIR ]] && rm -f ${ARTDIR}/R3SongArt*

ICONDIR=$XDG_RUNTIME_DIR/sound150/icons
[[ -d $ICONDIR ]] && rm -f ${ICONDIR}/R3SongArt*

exit 0
