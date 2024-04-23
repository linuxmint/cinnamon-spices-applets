#!/bin/bash
THUMB=$1
TYPE=$2
DEST=$HOME/.cache/cinnamon/spices/$TYPE/
FILENAME=$3
OLDDEST=$PWD

cd $DEST
[[ -f $FILENAME ]] && rm -f $FILENAME

#~ wget --wait=10 --random-wait -O $FILENAME $THUMB
wget -O $FILENAME $THUMB

cd $OLDDEST

exit 0
