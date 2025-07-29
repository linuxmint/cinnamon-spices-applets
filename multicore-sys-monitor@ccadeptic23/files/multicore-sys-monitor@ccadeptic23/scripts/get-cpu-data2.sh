#!/bin/bash

echo -n $(grep 'cpu' /proc/stat | sed -n '2~1p' | sed s/cpu//g | awk '{cpu_usage=($2+$4)/($2+$4+$5)} {print cpu_usage}' FS=' ' OFS=' ')

exit 0
