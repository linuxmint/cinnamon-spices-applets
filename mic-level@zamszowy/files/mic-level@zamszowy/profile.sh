#!/bin/bash

set -eux

get_info()
{
    pactl info | sed -n "s/Default Sink: bluez_sink\.\(.*\)\.\(.*\)/\1;\2/p"
}

get_profile()
{
    IFS=';' read -r _ profile <<< "$(get_info)"
    if [[ $profile == "handsfree_head_unit" ]]; then
        echo "hfp"
    elif [[ $profile == "a2dp_sink" ]]; then
        echo "a2dp"
    else
        echo "none"
    fi
}

toggle_profile()
{
    IFS=';' read -r mac profile <<< "$(get_info)"

    if [[ $profile == "handsfree_head_unit" ]]; then
        pactl set-card-profile bluez_card."$mac" a2dp_sink
        echo "a2dp"
    elif [[ $profile == "a2dp_sink" ]]; then
        pactl set-card-profile bluez_card."$mac" handsfree_head_unit
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
