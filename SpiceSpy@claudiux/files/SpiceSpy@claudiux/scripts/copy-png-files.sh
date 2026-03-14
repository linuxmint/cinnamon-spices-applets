#!/usr/bin/env bash

SPICES_DIR="$HOME/.cache/cinnamon/spices"
[ -d $SPICES_DIR ] || exit 0
APPLET_CONFIG_DIR="$HOME/.config/cinnamon/spices/SpiceSpy@claudiux"
PNG_TARGET_DIR="$APPLET_CONFIG_DIR/icons/"
[ -d $PNG_TARGET_DIR ] || mkdir -p $PNG_TARGET_DIR

subdirs=$(ls -1A $SPICES_DIR)
for sd in $subdirs; do {
    cd $SPICES_DIR/$sd
    pngfiles=$(ls -1A *.png)
    for png in $pngfiles; do {
        [ -f $png ] && cp -u $png $PNG_TARGET_DIR
    }; done
}; done

exit 0

