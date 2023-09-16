#!/bin/bash
URL=$1
NAME=$2

COVERARTDIR="$HOME/.config/Radio3.0/cover-art"
COVERARTFILE="$COVERARTDIR/$NAME"
[ -d "$COVERARTDIR" ] || mkdir -p $COVERARTDIR
#[ -f "$COVERARTDIR/cover.png" ] && rm -f "$COVERARTDIR/cover.png"

wget -O "$COVERARTFILE" "$URL"

#~ cd $COVERARTDIR
#~ magick -size 100x100 -depth 8 rgb:${NAME%.*} $NAME

exit $?
