#!/bin/bash
rm -f /tmp/*.mediaplayer-cover
ARTDIR="$HOME/.config/sound150/arts"
[[ -d $ARTDIR ]] && rm -f $ARTDIR/*
exit 0
