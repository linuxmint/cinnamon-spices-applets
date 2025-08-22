#!/usr/bin/env bash

set -eu

DIR=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
readonly DIR

case "$1" in
check)
    pkcon get-updates | awk '/^Results:/{flag=1; next} flag && NF' &> "$DIR"/updates
    wc -l <"$DIR"/updates
    ;;
view)
    /usr/bin/cjs "$DIR"/info-window.js "$(wc -l <"$DIR"/updates) updates" "$DIR"/updates
    ;;
command)
    readonly cmd=$2
    gnome-terminal --wait --  /usr/bin/bash -c "echo \"Executing $cmd\"; $cmd; echo -en \"\nDone - press enter to exit\"; read"
    ;;
*)
    exit 1
    ;;
esac
