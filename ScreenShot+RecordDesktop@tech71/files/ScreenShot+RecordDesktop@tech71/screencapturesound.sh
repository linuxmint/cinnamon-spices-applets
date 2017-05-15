#!/bin/bash
set -e

. "$HOME/.config/user-dirs.dirs"
###   Date and time format   ###
#format="$( date +'%b-%d-%Y_%I:%M:%S%#p' )"   ## 12-Hour time
format="$( date +'%b-%d-%Y_%H:%M:%S%#p' )"   ## 24-Hour time
size=$( xdpyinfo | grep 'dimensions:' | awk '{print $2}' )
name=Cinnamon-$format
video="$XDG_VIDEOS_DIR/$name.mkv"
ffmpeg -f alsa -ac 2 -i pulse -f x11grab -s $size -r 30 -i :0.0 -qscale 1 $video
