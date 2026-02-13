#!/bin/bash

_WINE_ERROR_MSG=$"Wine could not be found, make sure Wine is installed correctly."
_WINE_ERROR_TITLE=$"Wine Not Found"
_WINE_VER_MSG=$"Wine version: "
WINE_ERROR_MSG="$(/usr/bin/gettext "$_WINE_ERROR_MSG")"
WINE_ERROR_TITLE="$(/usr/bin/gettext "$_WINE_ERROR_TITLE")"
WINE_VER_MSG="$(/usr/bin/gettext "$_WINE_VER_MSG")"

## Gets the Wine version

get_wine_version ()
{
    wine_version=$($wine_cmd --version)
    if [ "$?" -ne 0 ]
    then
        zenity --info --text="${WINE_ERROR_MSG}" \
                      --title="${WINE_ERROR_TITLE}" \
                      --width="380"
        exit 1
    fi
}


