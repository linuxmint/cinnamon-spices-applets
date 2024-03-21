#!/bin/bash
PCDPID=$(pidof playerctld)
PCDPATH=$(which playerctld)

[[ -z $PCDPATH ]] && exit 1

[[ -z $PCDPID ]] && {
        playerctld &
}

exit 0
