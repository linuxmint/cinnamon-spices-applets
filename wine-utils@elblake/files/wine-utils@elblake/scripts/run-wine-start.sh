#!/bin/bash

TEXTDOMAIN="wine-utils@elblake"
TEXTDOMAINDIR="${HOME}/.local/share/locale"

_ERROR_MSG=$"Error starting"
_ERROR_TITLE=$"Run Program Error"
ERROR_MSG="$(/usr/bin/gettext "$_ERROR_MSG")"
ERROR_TITLE="$(/usr/bin/gettext "$_ERROR_TITLE")"

prefix=$1; shift
wine_cmd=$1; shift

DIR=$(dirname $0)
DIALOG=$DIR/dialog.py

WINEPREFIX="$prefix" $wine_cmd start /unix "$@"
if [ "$?" -ne 0 ]
then
    cmd_used=$1
    . "$DIR/version.sh"
    get_wine_version
    $DIALOG error "${ERROR_MSG}:\n\n${cmd_used}\n\n${WINE_VER_MSG}${wine_version}" \
                  "${ERROR_TITLE}"
fi

