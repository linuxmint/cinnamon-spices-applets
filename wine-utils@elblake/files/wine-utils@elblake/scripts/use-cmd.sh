#!/bin/bash

TEXTDOMAIN="wine-utils@elblake"
TEXTDOMAINDIR="${HOME}/.local/share/locale"

_PROMPT_ERROR=$"Command Prompt Error"
PROMPT_ERROR="$(/usr/bin/gettext "$_PROMPT_ERROR")"

prefix=$1; shift
wineconsole_cmd=$1; shift
WINEPREFIX="$prefix" $wineconsole_cmd $@
if [ "$?" -ne 0 ]
then
    zenity --info --text="${PROMPT_ERROR}" \
                  --title="${PROMPT_ERROR}" \
                  --width="380"
fi

