#!/usr/bin/env bash

nbmon=$(xrandr --query | grep connected | grep -v disconnected | wc -l)

echo -n $nbmon
exit 0
