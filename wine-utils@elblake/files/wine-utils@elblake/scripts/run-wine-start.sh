#!/bin/sh

prefix=$1; shift
wine_cmd=$1; shift
WINEPREFIX="$prefix" $wine_cmd start /unix "$@"
if [ "$?" -ne 0 ]
then
    zenity --info --text="Error starting:\n\n$1" \
                  --title="Run Program Error" \
                  --width="380"
fi

