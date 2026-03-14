#!/bin/bash

if pgrep -x "oneko" > /dev/null
then
    pkill -x oneko
    sleep 0.2
    xsetroot -cursor_name left_ptr
else
    if [ "$(date +%d)" = "13" ] && [ "$(date +%u)" = "5" ]; then
        oneko -rv &
    else
        oneko &
    fi
    sleep 0.2
    xsetroot -cursor_name left_ptr
fi


