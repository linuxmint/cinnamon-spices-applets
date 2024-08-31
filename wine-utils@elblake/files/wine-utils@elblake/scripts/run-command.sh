#!/bin/bash

TEXTDOMAIN="wine-utils@elblake"
TEXTDOMAINDIR="${HOME}/.local/share/locale"

_COMMAND_MSG=$"Command to run:"
_COMMAND_TITLE=$"Run Command"
_ERROR_MSG=$"Error running command:"
_ERROR_TITLE=$"Run Command Error"
COMMAND_MSG="$(/usr/bin/gettext "$_COMMAND_MSG")"
COMMAND_TITLE="$(/usr/bin/gettext "$_COMMAND_TITLE")"
ERROR_MSG="$(/usr/bin/gettext "$_ERROR_MSG")"
ERROR_TITLE="$(/usr/bin/gettext "$_ERROR_TITLE")"

prefix=$1; shift
wine_cmd=$1; shift

cmd=$(zenity --entry --text="${COMMAND_MSG}" \
                     --title="${COMMAND_TITLE}" \
                     --width="380")
if [ "$cmd" != '' ]
then
    WINEPREFIX="$prefix" $wine_cmd $cmd
    if [ "$?" -ne 0 ]
    then
        zenity --info --text="${ERROR_MSG}\n\n$cmd" \
                      --title="${ERROR_TITLE}" \
                      --width="380"
    fi
fi

