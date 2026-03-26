#!/usr/bin/env bash
MYPROC=$1
ret=$(cat /proc/${MYPROC}/status | grep VmRSS | awk '{print $2}')
echo -n $ret
exit 0
