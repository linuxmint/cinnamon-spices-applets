#!/bin/bash
if [ ! -e $HOME/Videos ]
then
mkdir -p $HOME/Videos
fi
dir="$HOME/Videos"
size=$( xdpyinfo | grep 'dimensions:' | awk '{print $2}' )
name=$( date +'%b.%d_%I:%M%#p' )
video="$dir/$name.mkv"
ffmpeg -f x11grab -s $size -r 30 -qscale 1  -i :0.0 $video

