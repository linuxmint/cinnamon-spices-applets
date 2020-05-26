#!/bin/bash
echo $(timedatectl | grep Time | sed s/^\ *//g |awk '{print $3}')
exit 0
