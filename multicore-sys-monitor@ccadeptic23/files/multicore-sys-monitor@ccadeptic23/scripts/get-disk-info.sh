#!/usr/bin/env bash

#~ echo -n $(lsblk -A -b -O -J)
echo -n $(lsblk -b -O -J)

exit 0
