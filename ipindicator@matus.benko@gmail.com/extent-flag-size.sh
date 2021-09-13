#!/bin/bash

files=`identify files/ipindicator@matus.benko@gmail.com/flags/* | grep --invert-match "64x64" | awk '{print $1}'`

while read filepath; do
  file=`basename $filepath`
  convert -gravity center -background None -extent 64x64 files/ipindicator@matus.benko@gmail.com/flags/$file
done <<< $files
