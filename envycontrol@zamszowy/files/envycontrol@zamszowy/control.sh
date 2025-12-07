#!/usr/bin/env bash

set -u

DIR=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
readonly DIR

[[ ! -d "$DIR/data" ]] && mkdir -p "$DIR/data"

DATA="$DIR/data"
readonly DATA

case "$1" in
change)
    mode_to_change=$2
    shift 2
    if ! pkexec envycontrol --verbose -s "$mode_to_change" "$@" &>"$DATA"/log; then
        nohup &>/dev/null /usr/bin/cjs "$DIR/info-window.js" "EnvyControl: error: failed to switch to $mode_to_change mode" "$DATA"/log &
        exit 0
    fi

    echo -n "$mode_to_change" >"$DATA"/pending
    if [[ "$mode_to_change" == "$(cat "$DATA"/current)" ]]; then
        rm -f "$DATA"/pending
    fi
    echo -n "ok"
    ;;
info)
    cpu=unknown
    current_mode=unknown
    pending_mode=""

    vendor=$(grep -m1 vendor_id /proc/cpuinfo | cut -d':' -f 2 | tr -d '[:space:]')
    if [[ "$vendor" == "GenuineIntel" ]]; then
        cpu=intel
    elif [[ "$vendor" == "AuthenticAMD" ]]; then
        cpu=amd
    fi

    current_boot=$(cat /proc/sys/kernel/random/boot_id)
    if [[ "$current_boot" != "$(cat "$DATA"/boot-id)" ]]; then
        current_mode=$(envycontrol -q)
        echo -n "$current_mode" >"$DATA"/current
        echo -n "$current_boot" >"$DATA"/boot-id
        rm -f "$DATA"/pending
    else
        current_mode=$(cat "$DATA"/current)
    fi

    if [[ -f "$DATA"/pending ]]; then
        pending_mode=$(cat "$DATA"/pending)
    fi

    echo -n "$cpu:$current_mode:$pending_mode"
    ;;
run)
    priviliged=$2
    show_mode=$3
    shift 3

    cmd=()
    if [[ $priviliged == "priviliged" ]]; then
        cmd+=(pkexec)
    fi
    cmd+=('envycontrol' '--verbose' "$@")

    if "${cmd[@]}" &>"$DATA"/out; then
        if [[ $show_mode == "show-out-always" ]]; then
            nohup &>/dev/null /usr/bin/cjs "$DIR/dialog-window.js" "EnvyControl: success" "$(cat "$DATA"/out)" &
        fi
        echo -n "ok"
    else
        if [[ $show_mode == "show-out-on-fail" ]]; then
            nohup &>/dev/null /usr/bin/cjs "$DIR/dialog-window.js" "EnvyControl: error" "\"envycontrol $*\" failed:\n\n$(cat "$DATA"/out)" &
        fi
    fi
    ;;
show-last-log)
    nohup &>/dev/null /usr/bin/cjs "$DIR/info-window.js" "EnvyControl: log" "$DATA"/log &
    ;;
*)
    exit 1
    ;;
esac
