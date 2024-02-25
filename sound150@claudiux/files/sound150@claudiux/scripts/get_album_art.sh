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
DECODED=$(urldecode "${XESAM_URL:7}")
#~ echo $DECODED
ffmpeg -i "$DECODED" -an -c:v copy $PATHTOFILE > /dev/null 2>&1
echo -n $PATHTOFILE
exit 0
