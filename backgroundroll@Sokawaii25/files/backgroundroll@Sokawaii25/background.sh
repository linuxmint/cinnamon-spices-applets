#!/bin/bash

IFS='
'

cd ~/Images/backgrounds/
images=( $(ls) )
pwd=`echo $PWD`

gsettings set org.cinnamon.desktop.background picture-uri  "file://$pwd/${images[$RANDOM%${#images[*]}]}"