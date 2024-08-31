#!/bin/sh

prefix=$1; shift
wine_cmd=$1; shift

cmd=$(zenity --entry --text="Command to run:" \
                     --title="Run Command" \
                     --width="380")
if [ "$cmd" != '' ]
then
    WINEPREFIX="$prefix" $wine_cmd $cmd
    if [ "$?" -ne 0 ]
    then
        zenity --info --text="Error running command:\n\n$cmd" \
                      --title="Run Command Error" \
                      --width="380"
    fi
fi

