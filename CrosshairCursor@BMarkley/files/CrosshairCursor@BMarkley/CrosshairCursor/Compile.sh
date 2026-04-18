#!/bin/bash
##compile

cd CrosshairCursor
if [[ ! -f "CrosshairCursor" ]]; then #if the file doesn't exist
    make
fi
