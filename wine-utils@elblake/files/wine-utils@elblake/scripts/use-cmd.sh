#!/bin/bash

TEXTDOMAIN="wine-utils@elblake"
TEXTDOMAINDIR="${HOME}/.local/share/locale"

_PROMPT_ERROR=$"Command Prompt Error"
PROMPT_ERROR="$(/usr/bin/gettext "$_PROMPT_ERROR")"

prefix=$1; shift
wineconsole_cmd=$1; shift

DIR=$(dirname $0)
DIALOG=$DIR/dialog.py

WINEPREFIX="$prefix" $wineconsole_cmd $@
if [ "$?" -ne 0 ]
then
    . "$DIR/version.sh"
    get_wine_version
    $DIALOG error "${PROMPT_ERROR}\n\n${WINE_VER_MSG}${wine_version}" \
                  "${PROMPT_ERROR}"
fi

