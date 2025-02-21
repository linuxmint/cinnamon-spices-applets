#!/bin/bash

set -eux

get_mac()
{
    pactl info | sed -n "s/Default Sink: bluez_output\.\(.*\)\.\(.*\)/\1/p"
}

get_profile()
{
    local -r profile="$(pw-dump | jq --raw-output '.[].info.props | ."api.bluez5.profile" | select (.!=null)' | head -1)"
    if [[ $profile == "headset-head-unit" ]]; then
        echo "hfp"
    elif [[ $profile == "a2dp-sink" ]]; then
        echo "a2dp"
    else
        echo "none"
    fi
}

toggle_profile()
{
    local -r mac="$(get_mac)"
    local -r profile="$(get_profile)"

    if [[ $profile == "hfp" ]]; then
        pactl set-card-profile bluez_card."$mac" a2dp-sink
        echo "a2dp"
    elif [[ $profile == "a2dp" ]]; then
        pactl set-card-profile bluez_card."$mac" "headset-head-unit"
        echo "hfp"
    else
        echo "none"
    fi
}

cmd_toggle()
{
    toggle_profile
}

cmd_info()
{
    get_profile
}


if [[ $# -ne 1 ]]; then
    echo invalid
else
    cmd_"$1"
fi
