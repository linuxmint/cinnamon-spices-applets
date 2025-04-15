#!/bin/bash
DIRART=${XDG_RUNTIME_DIR}/AlbumArt/song-art
[[ -d $DIRART ]] && rm -f ${DIRART}/R3SongArt*

ARTDIR=$XDG_RUNTIME_DIR/sound150/arts
[[ -d $ARTDIR ]] && rm -f ${ARTDIR}/*

exit 0
