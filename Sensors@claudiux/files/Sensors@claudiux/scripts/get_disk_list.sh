#!/bin/sh
echo -n $(lsblk | grep disk | awk '{print $1}' | tr '\n' ' ')
exit 0
