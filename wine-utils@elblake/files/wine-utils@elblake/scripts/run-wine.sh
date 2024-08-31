#!/bin/bash

TEXTDOMAIN="wine-utils@elblake"
TEXTDOMAINDIR="${HOME}/.local/share/locale"

_ERROR_MSG=$"Error running program:"
_ERROR_TITLE=$"Run Program Error"
ERROR_MSG="$(/usr/bin/gettext "$_ERROR_MSG")"
ERROR_TITLE="$(/usr/bin/gettext "$_ERROR_TITLE")"

prefix=$1; shift
wine_cmd=$1; shift
WINEPREFIX="$prefix" $wine_cmd "$@"
if [ "$?" -ne 0 ]
then
    zenity --info --text="${ERROR_MSG}\n\n$1" \
                  --title="${ERROR_TITLE}" \
                  --width="380"
fi

