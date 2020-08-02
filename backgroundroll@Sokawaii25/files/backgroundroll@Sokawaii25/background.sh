#!/bin/bash

IFS='
'

cd ~/Images/backgrounds/
images=( $(ls) )

gsettings set org.cinnamon.desktop.background picture-uri  "file://$PWD/${images[$RANDOM%${#images[*]}]}"
