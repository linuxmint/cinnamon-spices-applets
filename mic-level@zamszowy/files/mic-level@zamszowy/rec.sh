#!/bin/bash

set -eu

readonly rec_time=${1:-0.1}

if amixer_out=$(amixer get Capture) && ! [[ $amixer_out =~ \[on\] ]]; then
    sleep "$rec_time"
    echo "-1"
    exit
fi

rec -n stat trim 0 "$rec_time" 2>&1 | awk '/^Maximum amplitude/ { $3 *= 100; print $3 }'
