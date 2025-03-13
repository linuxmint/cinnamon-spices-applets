#!/bin/bash
URL=$1
NAME=$2

COVERARTDIR="$HOME/.config/Radio3.0/cover-art"
COVERARTFILE="$COVERARTDIR/$NAME"
[ -d "$COVERARTDIR" ] || mkdir -p $COVERARTDIR

wget -O "$COVERARTFILE" "$URL"

exit $?
