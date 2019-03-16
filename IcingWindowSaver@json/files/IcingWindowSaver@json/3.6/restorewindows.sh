#!/bin/bash

file=$HOME/.local/share/cinnamon/applets/IcingWindowSaver@json/3.6/.windows.txt
declare -a mywinid
declare -a x
declare -a y
declare -a width
declare -a height

nl=$(cat "$file" | grep xwininfo |wc -l)

for i in $(seq 1 $nl)
do
    mywinid[i]=$(cat "$file" | grep "xwininfo" | awk -v p="$i" '{if(NR==p) print $4}')
    x[i]=$(cat "$file" | grep "Absolute upper-left X" | awk -v p="$i" '{if(NR==p) print $NF}')
    y[i]=$(cat "$file" | grep "Absolute upper-left Y" | awk -v p="$i" '{if(NR==p) print $NF}')
    width[i]=$(cat "$file" | grep "Width" | awk -v p="$i" '{if(NR==p) print $NF}')
    height[i]=$(cat "$file" | grep "Height" | awk -v p="$i" '{if(NR==p) print $NF}')
done

for it in $(seq 1 $nl)
do
    wmctrl -ir "${mywinid[$it]}" -b remove,maximized_vert,maximized_horz
    wmctrl -i -r "${mywinid[$it]}" -e 0,"${x[$it]}","${y[$it]}","${width[it]}","${height[it]}"
done