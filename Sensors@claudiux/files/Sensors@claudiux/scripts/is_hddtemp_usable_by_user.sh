#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
HDDTEMP=/usr/sbin/hddtemp
[ -f $HDDTEMP ] || exit 2
RIGHTS=$(ls -l $HDDTEMP | awk '{print $1}')
RIGHTS=$(echo -n $RIGHTS)
[[ "$RIGHTS" = "-rwsr-sr-x" ]] && exit 0 || exit 1
