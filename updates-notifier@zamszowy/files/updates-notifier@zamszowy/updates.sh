#!/usr/bin/env bash

set -u

DIR=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
readonly DIR

PKG_TOOL=""
if command -v pkgcli &>/dev/null; then
    PKG_TOOL=pkgcli
elif command -v pkgctl &>/dev/null; then
    PKG_TOOL=pkgctl
elif command -v pkcon &>/dev/null; then
    PKG_TOOL=pkcon
else
    echo "No suitable package manager found (pkgcli, pkgctl, pkcon)" >"$DIR/error"
    echo ERROR
    exit 0
fi
readonly PKG_TOOL

pkg_refresh() {
    case "$PKG_TOOL" in
    pkgcli | pkgctl)
        $PKG_TOOL -q refresh
        ;;
    pkcon)
        $PKG_TOOL refresh
        ;;
    esac
}

pkg_list_updates() {
    case "$PKG_TOOL" in
    pkgcli | pkgctl)
        $PKG_TOOL -q list-updates
        ;;
    pkcon)
        $PKG_TOOL get-updates
        local -r ret=$?
        [[ $ret -eq 5 ]] && ret=0
        return $ret
        ;;
    esac
}

pkg_list_installed() {
    case "$PKG_TOOL" in
    pkgcli | pkgctl)
        $PKG_TOOL -q -f installed list
        ;;
    pkcon)
        $PKG_TOOL get-packages --filter installed
        ;;
    esac
}

case "$1" in
check)
    refreshMode=$2

    if [[ "$refreshMode" = "updates" ]]; then
        pkg_refresh &>/dev/null
    fi

    if ! out=$(pkg_list_updates 2>&1); then
        echo ERROR
        echo "$out" > "$DIR/error"
        exit 0
    fi

    pkg_list_installed &>/dev/null

    if command -v fwupdmgr &>/dev/null && command -v jq &>/dev/null; then
        if [[ "$refreshMode" = "updates" ]]; then
            fwupdmgr refresh &>/dev/null
        fi
        fwupdmgr get-updates --no-authenticate --json 2>/dev/null | jq -r '
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
error)
    /usr/bin/cjs "$DIR"/error-window.js "$DIR"/error
    ;;
command)
    readonly cmd=$2
    if command -v gsettings &>/dev/null; then
        term=$(gsettings get org.cinnamon.desktop.default-applications.terminal exec | tr -d \')
        termarg=$(gsettings get org.cinnamon.desktop.default-applications.terminal exec-arg | tr -d \')
        if [ -n "$term" ]; then
            args=("$term")
            [ -n "$termarg" ] && args+=("$termarg")
            args+=("/usr/bin/bash" "-c" "$cmd")
            "${args[@]}"
        fi
    fi
    ;;
*)
    exit 1
    ;;
esac
