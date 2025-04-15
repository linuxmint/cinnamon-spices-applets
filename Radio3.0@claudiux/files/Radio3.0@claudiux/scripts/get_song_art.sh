#!/bin/bash
TITLE="$1"
RES="$2"
[[ -z $RES ]] && RES="hq"
SONG_ART_DIR=${XDG_RUNTIME_DIR}/AlbumArt/song-art
[[ -d $SONG_ART_DIR ]] || mkdir -p $SONG_ART_DIR

for num in 1 2 3; do {
    yt-dlp -I ${num} ytsearch${num}:"${TITLE}" --get-id > ${XDG_RUNTIME_DIR}/ytid
    YTID=$(cat ${XDG_RUNTIME_DIR}/ytid)
    SONG_ART_FILE="$SONG_ART_DIR/R3SongArt$RANDOM$RANDOM"
    [[ -d $SONG_ART_DIR ]] && rm -f $SONG_ART_DIR/R3SongArt*
    REQUEST="https://img.youtube.com/vi/$YTID/${RES}default.jpg -q -O $SONG_ART_FILE"
    wget $REQUEST
    rm -f ${XDG_RUNTIME_DIR}/ytid
    sleep 0.5
    size=$(wc -c <"$SONG_ART_FILE")
    [[ $size -eq 0 ]] || break
}; done

exit 0

#~ yt-dlp -I 1 ytsearch1:"${TITLE}" --get-id > ${XDG_RUNTIME_DIR}/ytid
#~ # num is a random integer between 1 and 2 (num contains 1 or 2):
#~ #~ num=$((RANDOM%(2)+1))
#~ #~ yt-dlp -I ${num} ytsearch${num}:"${TITLE}" --get-id > ${XDG_RUNTIME_DIR}/ytid
#~ YTID=$(cat ${XDG_RUNTIME_DIR}/ytid)
#~ SONG_ART_FILE="$SONG_ART_DIR/R3SongArt$RANDOM$RANDOM"
#~ [[ -d $SONG_ART_DIR ]] && rm -f $SONG_ART_DIR/R3SongArt*
#~ REQUEST="https://img.youtube.com/vi/$YTID/${RES}default.jpg -q -O $SONG_ART_FILE"
#~ wget $REQUEST
#~ rm -f ${XDG_RUNTIME_DIR}/ytid
#~ exit 0
