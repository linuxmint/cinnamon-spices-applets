#!/bin/bash
TITLE="$1"
#~ echo $TITLE
APPNAME="Radio3.0"
DOT_CONFIG_DIR="$HOME/.config/$APPNAME"
SONG_ART_DIR="$DOT_CONFIG_DIR/song-art";
[[ -d $SONG_ART_DIR ]] || mkdir -p $SONG_ART_DIR

yt-dlp ytsearch1:"${TITLE}" --get-id > /tmp/ytid
YTID=$(cat /tmp/ytid)
SONG_ART_FILE="$SONG_ART_DIR/R3SongArt$RANDOM$RANDOM.jpg"
[[ -d $SONG_ART_DIR ]] && rm -f $SONG_ART_DIR/R3SongArt*
#~ REQUEST="https://img.youtube.com/vi/$YTID/sddefault.jpg -q -O $SONG_ART_FILE"
REQUEST="https://img.youtube.com/vi/$YTID/hqdefault.jpg -q -O $SONG_ART_FILE"
wget $REQUEST
#~ rm -f $SONG_ART_DIR/R3SongArt
#~ ln -s $SONG_ART_FILE $SONG_ART_DIR/R3SongArt
rm -f /tmp/ytid
exit 0
