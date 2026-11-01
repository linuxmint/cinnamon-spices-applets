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
wine_cmd_console=$1; shift

DIR="$(dirname $0)"
DIALOG="${DIR}/dialog.py"

cmd=$($DIALOG command-input "${COMMAND_MSG}" \
                            "${COMMAND_TITLE}")
if [ "$cmd" != '' ]
then
    path_var="$(WINEPREFIX="$prefix" "${wine_cmd}" "cmd" "/c" "echo" "%PATH%" | tr -d '\r' | grep -E "^[^[:cntrl:]]+" -)"
    case $cmd in
        -console:*)
            cmd=${cmd#-console:}
            wine_cmd="${wine_cmd_console}"
            ;;
        *)
            ## Check if it is a console program
            case $(echo "$cmd" | WINEPATHVAR="$path_var" xargs -r -x "${DIR}/run-command-is-console.py" "$prefix") in
                console)
                    wine_cmd="${wine_cmd_console}"
                    ;;
                *)
            esac
    esac
    exetype=$(echo "$cmd" | WINEPATHVAR="$path_var" xargs -r -x "${DIR}/run-command-type.py" "$prefix")
    case $exetype in
        "not-exe-outside-prefix")
            echo "$cmd" | WINEPREFIX="$prefix" xargs -r -x "${wine_cmd}" start /unix
            ;;
        "not-exe")
            echo "$cmd" | WINEPREFIX="$prefix" xargs -r -x "${wine_cmd}" start
            ;;
        *)
            echo "$cmd" | WINEPREFIX="$prefix" xargs -r -x "${wine_cmd}"
            ;;
    esac
    if [ "$?" -ne 0 ]
    then
        . "$DIR/version.sh"
        get_wine_version
        $DIALOG error "${ERROR_MSG}\n\n$cmd\n\n${WINE_VER_MSG}${wine_version}" \
                      "${ERROR_TITLE}"
    fi
fi

