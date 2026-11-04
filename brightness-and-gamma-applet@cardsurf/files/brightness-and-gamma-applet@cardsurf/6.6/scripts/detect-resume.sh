#!/usr/bin/env bash

DETECT=$(echo -n $(grep -E 'Stopped target (suspend|hibernate|sleep|graphical)|Starting screensaver' /var/log/syslog | tail -n 1))
LAST=$(echo -n $DETECT | awk '{print $1}')

echo -n $LAST
exit 0
