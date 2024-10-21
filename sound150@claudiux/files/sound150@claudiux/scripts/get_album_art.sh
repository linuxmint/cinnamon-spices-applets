#!/bin/bash
RSONGART=$HOME/.config/Radio3.0/song-art
[[ -d $RSONGART ]] && {
        RET=""
        for f in $(ls -t1 $RSONGART); do {
                [[ -z $f ]] || {
                  echo -n "$RSONGART/$f"
                  exit 0
                }
        }; done
}

[[ -x $(which playerctl) ]] || exit 1

function urldecode() { : "${*//+/ }"; echo -e "${_//%/\\x}"; }

ARTDIR="$XDG_RUNTIME_DIR/sound150/arts"
[[ -d $ARTDIR ]] || mkdir -p $ARTDIR
ARTFILE="albumArt-$RANDOM$RANDOM.png"
PATHTOFILE="$ARTDIR/$ARTFILE"

OLDTITLEFILE="${XDG_RUNTIME_DIR}/sound150/Title"
TITLE=$(playerctl -a metadata "xesam:title")
OLDTITLE=""

[[ -f ${OLDTITLEFILE} ]] && OLDTITLE=$( cat ${OLDTITLEFILE} )
rm -f ${OLDTITLEFILE}
echo -n "${TITLE}" > ${OLDTITLEFILE}

#~ [[ -z ${TITLE} && -d $ARTDIR ]] && rm -f $ARTDIR/*
[[ -d $ARTDIR ]] && rm -f $ARTDIR/*

XESAM_URL=$(playerctl -a metadata "xesam:url")
MPRIS_ARTURL=$(playerctl -a metadata "mpris:artUrl" > /dev/null 2>&1 || echo -n "")

[[ -z $MPRIS_ARTURL ]] || {
        echo -n "${MPRIS_ARTURL:7}" # Removes "file://" (7 first characters).
        exit 0
}

[[ -z $XESAM_URL ]] && exit 1

#~ [[ "x$OLDTITLE"!="x"  && "$OLDTITLE"="$TITLE" ]] && exit 1
[[ ! -z "$OLDTITLE" && "$OLDTITLE"="$TITLE" ]] && {
        for f in $(ls -At1 $ARTDIR); do {
                [[ -z $f ]] || {
                  echo -n "$ARTDIR/$f"
                  exit 0
                }
        }; done
}

#~ [[ -d $ARTDIR ]] && rm -f $ARTDIR/*

DECODED=$(urldecode "${XESAM_URL:7}") # Removes 7 first characters.
MIMETYPE=$(file -b --mime-type "$DECODED")
rm -f $HOME/mimetype.txt
[[ $MIMETYPE == *video* ]] && {
        DUREE=$(ffprobe  -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DECODED");
        duration=${DUREE%.*}
        THUMBTIME=$(date -d@$(( $duration / 10 )) -u +%H:%M:%S)
        ffmpeg -ss ${THUMBTIME}.000 -i "$DECODED" -vframes 1 $PATHTOFILE > /dev/null 2>&1
} || {
        [[ -x $(which ffmpegthumbnailer) ]] && {
                #~ [[ -d $ARTDIR ]] && rm -f $ARTDIR/*
                ffmpegthumbnailer -i "$DECODED" -o "$PATHTOFILE"
        }
}

echo -n $PATHTOFILE
exit 0
