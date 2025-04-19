#!/bin/bash
DEBUG=false
#~ DEBUG=true

[[ $DEBUG == true ]] && echo "$(date) $(basename $0)" >> $HOME/sound150.log # DEBUGGING

function urldecode() { : "${*//+/ }"; echo -e "${_//%/\\x}"; }

SONG_ART_DIR=${XDG_RUNTIME_DIR}/AlbumArt/song-art
ARTDIR=$XDG_RUNTIME_DIR/sound150/arts
MPV_RADIO_PID=${XDG_RUNTIME_DIR}/mpv_radio_PID

[[ -f MPV_RADIO_PID ]] && {
        [[ -d $SONG_ART_DIR ]] && {
                RET=""
                for f in $(ls -t1 $SONG_ART_DIR); do {
                        [[ -z $f ]] && {
                                exit 1
                        } || {
                                [[ $DEBUG == true ]] && echo "$SONG_ART_DIR/$f" >> $HOME/sound150.log # DEBUGGING
                                echo -n "$SONG_ART_DIR/$f"
                                exit 0
                        }
                }; done
        }
}

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

[[ ${TITLE} == 'Netflix' ]] && {
        [[ $DEBUG == true ]] && echo "Netflix" >> $HOME/sound150.log # DEBUGGING
        echo -n $HOME/.local/share/cinnamon/applets/sound150@claudiux/6.4/icons/netflix.png
        exit 0
}

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
                        [[ $DEBUG == true ]] && echo "$SONG_ART_DIR/$f" >> $HOME/sound150.log # DEBUGGING
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
        [[ $DEBUG == true ]] && echo "${MPRIS_ARTURL:7}" >> $HOME/sound150.log # DEBUGGING
        echo -n "${MPRIS_ARTURL:7}" # Removes "file://" (7 first characters).
        exit 0
}

[[ -z $XESAM_URL ]] && exit 1

[[ ! -z "$OLDTITLE" && "$OLDTITLE"=="$TITLE" ]] && {
        for f in $(ls -At1 $ARTDIR); do {
                [[ -z $f ]] || {
                        [[ $DEBUG == true ]] && echo "$ARTDIR/$f" >> $HOME/sound150.log # DEBUGGING
                        echo -n "$ARTDIR/$f"
                        exit 0
                }
        }; done
}

[[ $DEBUG == true ]] && echo "XESAM_URL: $XESAM_URL" >> $HOME/sound150.log # DEBUGGING
[[ $XESAM_URL == /* ]] && {
        DECODED=$(urldecode "${XESAM_URL}")
} || [[ $XESAM_URL == file* ]] && {
        DECODED=$(urldecode "${XESAM_URL:7}") # Removes 7 first characters.
} || {
        #~ DECODED=$(urldecode "${XESAM_URL}")
        [[ $DEBUG == true ]] && echo "Invalid" >> $HOME/sound150.log # DEBUGGING
        exit 1
}
MIMETYPE=$(file -b --mime-type "$DECODED")
rm -f $HOME/mimetype.txt
[[ $MIMETYPE == *video* ]] && {
        DUREE=$(ffprobe  -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DECODED");
        duration=${DUREE%.*}
        THUMBTIME=$(date -d@$(( $duration / 10 )) -u +%H:%M:%S)
        [[ $DEBUG == true ]] && echo "ffmpeg $DECODED" >> $HOME/sound150.log # DEBUGGING
        ffmpeg -ss ${THUMBTIME}.000 -i "$DECODED" -vframes 1 $PATHTOFILE > /dev/null 2>&1
} || {
        [[ -x $(which ffmpegthumbnailer) ]] && {
                [[ $DEBUG == true ]] && echo "ffmpegthumbnailer $DECODED" >> $HOME/sound150.log # DEBUGGING
                ffmpegthumbnailer -q 10 -m -s 0 -i "$DECODED" -o "$PATHTOFILE"
        }
}

cp -a $PATHTOFILE $SONG_ART_DIR/$ARTFILE
[[ $DEBUG == true ]] && echo "" >> $HOME/sound150.log # DEBUGGING
#~ sleep 0.5
echo -n $PATHTOFILE
exit 0
