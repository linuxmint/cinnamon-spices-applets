#!/usr/bin/env bash
parts=$(lsblk -n -r -y | grep part | sed -e "s/^.*part\ "//)
echo -n $parts
exit 0
