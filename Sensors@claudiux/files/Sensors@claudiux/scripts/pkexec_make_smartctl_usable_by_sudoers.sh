#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
/usr/bin/pkexec $SCRIPT_DIR/make_smartctl_usable_by_sudoers.sh

exit 0
