#!/bin/bash
TITLE="$1"
RES="$2"
[[ -z $RES ]] && RES="hq"
SONG_ART_DIR=${XDG_RUNTIME_DIR}/AlbumArt/song-art
[[ -d $SONG_ART_DIR ]] || mkdir -p $SONG_ART_DIR

yt-dlp ytsearch1:"${TITLE}" --get-id > /tmp/ytid
YTID=$(cat /tmp/ytid)
SONG_ART_FILE="$SONG_ART_DIR/R3SongArt$RANDOM$RANDOM"
[[ -d $SONG_ART_DIR ]] && rm -f $SONG_ART_DIR/R3SongArt*
REQUEST="https://img.youtube.com/vi/$YTID/${RES}default.jpg -q -O $SONG_ART_FILE"
wget $REQUEST
rm -f /tmp/ytid
exit 0
