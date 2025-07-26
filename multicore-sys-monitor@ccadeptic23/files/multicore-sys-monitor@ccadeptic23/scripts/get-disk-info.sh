#!/bin/bash

#~ echo -n $(lsblk -A -b -f -t -J)
echo -n $(lsblk -A -b -O -J)

exit 0
