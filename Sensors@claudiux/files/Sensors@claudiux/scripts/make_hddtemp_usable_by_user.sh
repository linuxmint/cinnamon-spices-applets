#!/bin/bash
[[ $UID -eq 0 ]] || exit 1
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
RIGHTS=$(ls -l /usr/sbin/hddtemp | awk '{print $1}')
RIGHTS=$(echo -n $RIGHTS)
[[ "$RIGHTS" = "-rwsr-sr-x" ]] || chmod +s /usr/sbin/hddtemp

exit 0
