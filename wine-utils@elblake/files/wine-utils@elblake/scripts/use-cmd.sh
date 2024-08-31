#!/bin/sh

prefix=$1; shift
wineconsole_cmd=$1; shift
WINEPREFIX="$prefix" $wineconsole_cmd $@
if [ "$?" -ne 0 ]
then
    zenity --info --text="Command Prompt Error" \
                  --title="Command Prompt Error" \
                  --width="380"
fi

