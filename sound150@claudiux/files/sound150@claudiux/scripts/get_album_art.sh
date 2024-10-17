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

[[ -x /usr/bin/playerctl ]] || exit 1

function urldecode() { : "${*//+/ }"; echo -e "${_//%/\\x}"; }

ARTDIR="$HOME/.config/sound150/arts"
[[ -d $ARTDIR ]] || mkdir -p $ARTDIR
ARTFILE="albumArt-$RANDOM$RANDOM.png"
PATHTOFILE="$ARTDIR/$ARTFILE"
MPRIS_ARTURL=$(playerctl -a metadata "mpris:artUrl")
XESAM_URL=$(playerctl -a metadata "xesam:url")
#~ echo $MPRIS_ARTURL
#~ echo $XESAM_URL
[[ -z $MPRIS_ARTURL ]] || {
        echo -n "${MPRIS_ARTURL:7}"
        exit 0
}
[[ -z $XESAM_URL ]] && exit 1
#~ OLDDECFILE="${XDG_RUNTIME_DIR}/sound150Decoded"
#~ OLDDECODED=""
#~ [[ -f $OLDDECFILE ]] && OLDDECODED=$( cat $OLDDECFILE )
DECODED=$(urldecode "${XESAM_URL:7}")
#~ echo -n $DECODED > $OLDDECFILE
#~ [[ "$OLDDECODED"="$DECODED" ]] && exit 1
[[ -d $ARTDIR ]] && rm -f $ARTDIR/*
#ffmpeg -i "$DECODED" -an -c:v copy $PATHTOFILE > /dev/null 2>&1
#duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DECODED");
DUREE=$( ffprobe  -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$DECODED" );
duration=${DUREE%.*}
THUMBTIME=$(date -d@$(( $duration / 3 )) -u +%H:%M:%S)
ffmpeg -ss ${THUMBTIME}.000 -i "$DECODED" -vframes 1 $PATHTOFILE > /dev/null 2>&1

echo -n $PATHTOFILE
exit 0
