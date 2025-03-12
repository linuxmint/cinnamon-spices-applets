#!/bin/sh
echo -n $(sudo smartctl -A /dev/$1 | grep 'Temperature_Cel' | awk '{print $10}')
exit 0
