#!/usr/bin/env bash
#~ DEBUG=false
#~ DEBUG=true

#~ [[ $DEBUG == true ]] && echo "$(date) $(basename $0)" >> $HOME/sound150.log # DEBUGGING
#~ [[ $DEBUG == false && -f $HOME/sound150.log ]] && rm -f $HOME/sound150.log # DEBUGGING

function urldecode() { : "${*//+/ }"; echo -e "${_//%/\\x}"; }

ALBUMART_ART_DIR=${XDG_RUNTIME_DIR}/AlbumArt/song-art
SOUND150_ART_DIR=$XDG_RUNTIME_DIR/sound150/arts
SOUND150_ICON_DIR=$XDG_RUNTIME_DIR/sound150/icons
MPV_RADIO_PID=${XDG_RUNTIME_DIR}/mpv_radio_PID
MAKEICON=$HOME/.local/share/cinnamon/applets/sound150@claudiux/scripts/make_icon.sh
superRND=$((RANDOM*RANDOM))

[[ -d ${ALBUMART_ART_DIR} ]] || mkdir -p ${ALBUMART_ART_DIR}
[[ -d ${SOUND150_ART_DIR} ]] || mkdir -p ${SOUND150_ART_DIR}
[[ -d ${SOUND150_ICON_DIR} ]] || mkdir -p ${SOUND150_ICON_DIR}

[[ -d $SOUND150_ART_DIR ]] && {
        OLDPWD=$PWD
        cd $SOUND150_ART_DIR
        for f in $(ls -At1); do {
                size=$(wc -c <"$f")
                [[ $size -eq 0 ]] && rm -f "$f"
        }; done
        cd $OLDPWD
}

[[ -f MPV_RADIO_PID ]] && {
        [[ -d $ALBUMART_ART_DIR ]] && {
                #~ RET=""
                for f in $(ls -t1 $ALBUMART_ART_DIR); do {
                        [[ -z $f ]] && {
                                exit 1
                        } || {
                                #~ [[ $DEBUG == true ]] && echo "$ALBUMART_ART_DIR/$f" >> $HOME/sound150.log # DEBUGGING
                                #~ $MAKEICON "$ALBUMART_ART_DIR/$f" &
                                [[ -f $SOUND150_ART_DIR/$f ]] || cp -f "$ALBUMART_ART_DIR/$f" "$SOUND150_ART_DIR/"
                                $MAKEICON "$ALBUMART_ART_DIR/$f"
                                echo -n "$ALBUMART_ART_DIR/$f"
                                break
                                exit 0
                        }
                }; done
        }
}


[[ -x $(which playerctl) ]] || exit 1

OLDTITLEFILE=${XDG_RUNTIME_DIR}/sound150/Title
TITLE=$(playerctl -a metadata "xesam:title")
OLDTITLE=""

[[ ${TITLE} == 'Netflix' ]] && {
        #~ [[ $DEBUG == true ]] && echo "Netflix" >> $HOME/sound150.log # DEBUGGING
        echo -n $HOME/.local/share/cinnamon/applets/sound150@claudiux/6.4/icons/netflix.png
        exit 0
}
[[ ${TITLE} =~ Prime\ Video ]] && {
        echo -n $HOME/.local/share/cinnamon/applets/sound150@claudiux/6.4/icons/primevideo.png
        exit 0
}


[[ -f ${OLDTITLEFILE} ]] && OLDTITLE=$(cat ${OLDTITLEFILE})
rm -f ${OLDTITLEFILE}
echo -n "${TITLE}" > ${OLDTITLEFILE}

OLDPWD=$PWD
cd $ALBUMART_ART_DIR
nbr=$(ls -1qt | wc -l)
[[ $nbr -gt 1 ]] && {
        ls -1qt | tail -n 1 | xargs -I {} rm {}
}
cd $OLDPWD

[[ -d $ALBUMART_ART_DIR ]] && {
        [[ "${TITLE}" != "$OLDTITLE" ]] && {
                rm -f $ALBUMART_ART_DIR/albumArt*
                rm -f ${SOUND150_ICON_DIR}/R*
        }
        #~ RET=""
        for f in $(ls -At1 $ALBUMART_ART_DIR); do {
                [[ -z $f ]] || {
                        #~ [[ $DEBUG == true ]] && echo "$ALBUMART_ART_DIR/$f" >> $HOME/sound150.log # DEBUGGING
                        $MAKEICON "$ALBUMART_ART_DIR/$f"
                        [[ -f $SOUND150_ART_DIR/$f ]] || cp -f "$ALBUMART_ART_DIR/$f" "$SOUND150_ART_DIR/"
                        echo -n "$ALBUMART_ART_DIR/$f"
                        break
                        exit 0
                }
        }; done
}


[[ -d $SOUND150_ART_DIR ]] && {
        [[ "${TITLE}" != "$OLDTITLE" ]] && rm -f $SOUND150_ART_DIR/*
}

ARTFILE="R3SongArt$superRND.png"
PATHTOFILE="$SOUND150_ART_DIR/$ARTFILE"


XESAM_URL=$(playerctl -a metadata "xesam:url")
MPRIS_ARTURL=$(playerctl -a metadata "mpris:artUrl" > /dev/null 2>&1 || echo -n "")

[[ -z $MPRIS_ARTURL ]] || {
        #~ [[ $DEBUG == true ]] && echo "${MPRIS_ARTURL:7}" >> $HOME/sound150.log # DEBUGGING
        echo -n "${MPRIS_ARTURL:7}" # Removes "file://" (7 first characters).
        exit 0
}

[[ -z $XESAM_URL ]] && exit 1

OLDXESAMURLFILE=$XDG_RUNTIME_DIR/sound150/oldxesamurl
[[ -f $OLDXESAMURLFILE ]] || {
        touch $OLDXESAMURLFILE
} && {
        OLDXESAMURLDATE=$(date -r $OLDXESAMURLFILE +%s)
        now=$(date +%s)
        diff=$((now - OLDXESAMURLDATE))
        [[ $diff -gt 5 ]] && echo -n "" > $OLDXESAMURLFILE
}
oldxesamurl=$(cat $OLDXESAMURLFILE)
[[ "$XESAM_URL" == "$oldxesamurl" ]] && {
        for f in $(ls -1Aq $ALBUMART_ART_DIR); do {
                #~ [[ $DEBUG == true ]] && echo "$ALBUMART_ART_DIR/$f" >> $HOME/sound150.log # DEBUGGING
                cp -af "$ALBUMART_ART_DIR/$f" $SOUND150_ART_DIR/
                echo -n "$ALBUMART_ART_DIR/$f"
                break
        }; done
        exit 0
}
echo -n $XESAM_URL > $OLDXESAMURLFILE

[[ ! -z "$OLDTITLE" && "$OLDTITLE"=="$TITLE" ]] && {
        for f in $(ls -At1 $SOUND150_ART_DIR); do {
                [[ -z $f ]] || {
                        #~ [[ $DEBUG == true ]] && echo "$SOUND150_ART_DIR/$f" >> $HOME/sound150.log # DEBUGGING
                        echo -n "$SOUND150_ART_DIR/$f"
                        exit 0
                }
        }; done
}

#~ [[ $DEBUG == true ]] && echo "XESAM_URL: $XESAM_URL" >> $HOME/sound150.log # DEBUGGING
[[ $XESAM_URL == /* ]] && {
        DECODED=$(urldecode "${XESAM_URL}")
} || [[ $XESAM_URL == file* ]] && {
        DECODED=$(urldecode "${XESAM_URL:7}") # Removes 7 first characters.
} || {
        #~ [[ $DEBUG == true ]] && echo "Invalid" >> $HOME/sound150.log # DEBUGGING
        exit 1
}
MIMETYPE=$(file -b --mime-type "$DECODED")
rm -f $HOME/mimetype.txt
[[ $MIMETYPE == *video* ]] && {
        DUREE=$(ffprobe  -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DECODED");
        duration=${DUREE%.*}
        THUMBTIME=$(date -d@$(( $duration / 10 )) -u +%H:%M:%S)
        #~ [[ $DEBUG == true ]] && echo "ffmpeg $DECODED" >> $HOME/sound150.log # DEBUGGING
        ffmpeg -ss ${THUMBTIME}.000 -i "$DECODED" -vframes 1 $PATHTOFILE > /dev/null 2>&1
} || {
        [[ -x $(which ffmpegthumbnailer) ]] && {
                #~ [[ $DEBUG == true ]] && echo "ffmpegthumbnailer $DECODED" >> $HOME/sound150.log # DEBUGGING
                ffmpegthumbnailer -q 10 -m -s 0 -i "$DECODED" -o "$PATHTOFILE"
        }
}

cp -a "$PATHTOFILE" $ALBUMART_ART_DIR/$ARTFILE
#~ [[ $DEBUG == true ]] && echo "" >> $HOME/sound150.log # DEBUGGING
$MAKEICON "$ALBUMART_ART_DIR/$ARTFILE"
[[ -f $SOUND150_ART_DIR/$ARTFILE ]] || cp -a "$PATHTOFILE" $SOUND150_ART_DIR/$ARTFILE
echo -n "$ALBUMART_ART_DIR/$ARTFILE"
exit 0
