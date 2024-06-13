#!/bin/bash
PCDPID=$(pidof playerctld)
PCDPATH=$(which playerctld)

[[ -z $PCDPATH ]] && exit 1

[[ -z $PCDPID ]] || {
        killall playerctld
}

exit 0
