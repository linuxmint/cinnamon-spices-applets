#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
/usr/bin/pkexec $SCRIPT_DIR/make_hddtemp_usable_by_user.sh

exit 0
