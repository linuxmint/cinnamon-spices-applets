#!/usr/bin/env bash
PARAM=$1
[ -z $PARAM ] && PARAM="N"
case $PARAM in
    N)
        DETECT=$(echo -n $(grep -E 'Stopped target (suspend|hibernate|sleep)' /var/log/syslog | tail -n 1))
        ;;
    G)
        DETECT=$(echo -n $(grep -E 'Stopped target (suspend|hibernate|sleep|graphical)' /var/log/syslog | tail -n 1))
        ;;
    S)
        DETECT=$(echo -n $(grep -E 'Stopped target (suspend|hibernate|sleep)|Starting screensaver' /var/log/syslog | tail -n 1))
        ;;
    B)
        DETECT=$(echo -n $(grep -E 'Stopped target (suspend|hibernate|sleep|graphical)|Starting screensaver' /var/log/syslog | tail -n 1))
        ;;
    *)
        ;;
esac

LAST=$(echo -n $DETECT | awk '{print $1}')

echo -n $LAST
exit 0
