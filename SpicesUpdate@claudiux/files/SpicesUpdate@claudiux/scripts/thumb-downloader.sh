#!/bin/bash
THUMB=$1
TYPE=$2
DEST=$HOME/.cache/cinnamon/spices/$TYPE/
FILENAME=$3
OLDDEST=$PWD

_UTC=$(date -u +%s)
_SECONDS=$((${_UTC} / 600))
_SECONDS=$((${_SECONDS} * 600))

#~ echo ${_SECONDS}

cd $DEST
[[ -f $FILENAME ]] && rm -f $FILENAME

#~ wget --wait=10 --random-wait -O $FILENAME $THUMB
wget -O $FILENAME "$THUMB?time=${_SECONDS}"

cd $OLDDEST

exit 0
