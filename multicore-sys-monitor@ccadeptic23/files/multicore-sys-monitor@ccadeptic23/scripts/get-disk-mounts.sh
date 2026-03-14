#!/usr/bin/env bash
#~ parts=$(lsblk -n -r -y | grep part | sed -e "s/^.*part\ "//)
parts=$(lsblk -n -r -y | grep -E 'part|crypt' | sed -n -e 's/^.*part\ //p' -e 's/^.*crypt\ //p')
echo -n $parts
exit 0
