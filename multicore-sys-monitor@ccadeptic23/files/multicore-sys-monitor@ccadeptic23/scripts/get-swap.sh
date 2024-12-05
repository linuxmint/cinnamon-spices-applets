#!/bin/bash
###
# Get swap usage
###
ret=$(swapon --bytes --show=SIZE,USED | tail +2)
echo -n $ret
exit 0
