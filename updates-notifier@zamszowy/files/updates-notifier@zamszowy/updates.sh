#!/usr/bin/env bash

set -u

DIR=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
readonly DIR

case "$1" in
check)
    pkcon refresh &>/dev/null
    pkcon get-updates &>/dev/null
    pkcon get-packages --filter installed &>/dev/null

    if command -v fwupdmgr &>/dev/null && command -v jq &>/dev/null; then
        fwupdmgr refresh &>/dev/null
        fwupdmgr get-updates --json 2>/dev/null | jq -r '
            .Devices[]
            | select(.Releases | length > 0)
            | . as $d
            | $d.Releases[]
            | "\($d.Name)#\($d.DeviceId)#\($d.Version)#\(.Version)#\($d.Summary)"
        ' 2>/dev/null
    fi

    sleep 1 # give time for transaction to finish
    ;;
view)
    /usr/bin/cjs "$DIR"/info-window.js "$DIR" "$DIR"/updates
    ;;
command)
    readonly cmd=$2
    if command -v gsettings &>/dev/null; then
        term=$(gsettings get org.cinnamon.desktop.default-applications.terminal exec | tr -d \')
        termarg=$(gsettings get org.cinnamon.desktop.default-applications.terminal exec-arg | tr -d \')
        bash_cmd="echo \"Executing $cmd\"; $cmd; echo -en \"\nDone - press enter to exit\"; read"
        if [ -n "$term" ]; then
            args=("$term")
            [ -n "$termarg" ] && args+=("$termarg")
            args+=("$bash_cmd")
            "${args[@]}"
        fi
    fi
    ;;
*)
    exit 1
    ;;
esac
