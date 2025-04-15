#!/bin/bash
function urldecode() { : "${*//+/ }"; echo -e "${_//%/\\x}"; }

SONG_ART_DIR=${XDG_RUNTIME_DIR}/AlbumArt/song-art
ARTDIR=$XDG_RUNTIME_DIR/sound150/arts

[[ -d ${SONG_ART_DIR} ]] || mkdir -p ${SONG_ART_DIR}
[[ -d ${ARTDIR} ]] || mkdir -p ${ARTDIR}

[[ -d $ARTDIR ]] && {
        OLDPWD=$PWD
        cd $ARTDIR
        for f in $(ls -At1); do {
                size=$(wc -c <"$f")
                [[ $size -eq 0 ]] && rm -f "$f"
        }; done
        cd $OLDPWD
}

[[ -x $(which playerctl) ]] || exit 1

OLDTITLEFILE=${XDG_RUNTIME_DIR}/sound150/Title
TITLE=$(playerctl -a metadata "xesam:title")
OLDTITLE=""

[[ -f ${OLDTITLEFILE} ]] && OLDTITLE=$(cat ${OLDTITLEFILE})
rm -f ${OLDTITLEFILE}
echo -n "${TITLE}" > ${OLDTITLEFILE}

[[ -d $SONG_ART_DIR ]] && {
        [[ "${TITLE}" != "$OLDTITLE" ]] || {
                OLDPWD=$PWD
                cd $SONG_ART_DIR
                nbr=$(ls -1q | wc -l)
                [[ $nbr -gt 1 ]] && {
                        ls -t | tail -n 1 | xargs -I {} rm {}
                }
                cd $OLDPWD
        } && {
                rm -f $SONG_ART_DIR/albumArt*
                #~ rm -f $SONG_ART_DIR/*
        }
        RET=""
        for f in $(ls -At1 $SONG_ART_DIR); do {
                [[ -z $f ]] || {
                  echo -n "$SONG_ART_DIR/$f"
                  exit 0
                }
        }; done
}


#~ [[ -d $SONG_ART_DIR ]] && [[ "${TITLE}" != "$OLDTITLE" ]] && rm -f $SONG_ART_DIR/*

[[ -d $ARTDIR ]] && {
        [[ "${TITLE}" != "$OLDTITLE" ]] && rm -f $ARTDIR/*
}
ARTFILE="albumArt-$RANDOM$RANDOM.png"
PATHTOFILE="$ARTDIR/$ARTFILE"


#~ [[ -d $SONG_ART_DIR ]] && rm -f $SONG_ART_DIR/*
#~ [[ -d $ARTDIR ]] && rm -f $ARTDIR/*


XESAM_URL=$(playerctl -a metadata "xesam:url")
MPRIS_ARTURL=$(playerctl -a metadata "mpris:artUrl" > /dev/null 2>&1 || echo -n "")

[[ -z $MPRIS_ARTURL ]] || {
        echo -n "${MPRIS_ARTURL:7}" # Removes "file://" (7 first characters).
        exit 0
}

[[ -z $XESAM_URL ]] && exit 1

[[ ! -z "$OLDTITLE" && "$OLDTITLE"=="$TITLE" ]] && {
        for f in $(ls -At1 $ARTDIR); do {
                [[ -z $f ]] || {
                  echo -n "$ARTDIR/$f"
                  exit 0
                }
        }; done
}

[[ $XESAM_URL == /* ]] && {
        DECODED=$(urldecode "${XESAM_URL}")
} || {
        DECODED=$(urldecode "${XESAM_URL:7}") # Removes 7 first characters.
}
MIMETYPE=$(file -b --mime-type "$DECODED")
rm -f $HOME/mimetype.txt
[[ $MIMETYPE == *video* ]] && {
        DUREE=$(ffprobe  -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DECODED");
        duration=${DUREE%.*}
        THUMBTIME=$(date -d@$(( $duration / 10 )) -u +%H:%M:%S)
        ffmpeg -ss ${THUMBTIME}.000 -i "$DECODED" -vframes 1 $PATHTOFILE > /dev/null 2>&1
} || {
        [[ -x $(which ffmpegthumbnailer) ]] && {
                ffmpegthumbnailer -q 10 -m -s 0 -i "$DECODED" -o "$PATHTOFILE"
        }
}

cp -a $PATHTOFILE $SONG_ART_DIR/$ARTFILE
#~ sleep 0.5
echo -n $PATHTOFILE
exit 0
