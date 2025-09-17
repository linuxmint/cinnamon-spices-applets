#!/usr/bin/env bash

set -u

DIR=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
readonly DIR

case "$1" in
check)
    pkcon refresh &>/dev/null
    pkcon get-updates &>/dev/null
    pkcon get-packages --filter installed &>/dev/null
    sleep 1 # give time for transaction to finish
    ;;
view)
    /usr/bin/cjs "$DIR"/info-window.js "$DIR" "$DIR"/updates
    ;;
command)
    readonly cmd=$2
    gnome-terminal --wait -- /usr/bin/bash -c "echo \"Executing $cmd\"; $cmd; echo -en \"\nDone - press enter to exit\"; read"
    ;;
*)
    exit 1
    ;;
esac
