#!/bin/bash

function prepare_filename () {
  . "$HOME/.config/user-dirs.dirs"
  ###   Date and time format   ###
  #format="$( date +'%b-%d-%Y_%I:%M:%S%#p' )"   ## 12-Hour time
  format="$( date +'%b-%d-%Y_%H:%M:%S%#p' )"   ## 24-Hour time
  
  name=Cinnamon-$format
  parameters="$parameters $XDG_VIDEOS_DIR/$name.mkv"
}

function record_screen () {
  size=$( /usr/bin/xdpyinfo | grep 'dimensions:' | awk '{print $2}' )
  parameters="$parameters -f x11grab -s $size -r 30 -i :0.0 -qscale 1 $video"
}

function record_window () { 
  id=`/usr/bin/xdotool getactivewindow`
  width=`/usr/bin/xwininfo -id $id | grep Width | cut -d' ' -f4`
  height=`/usr/bin/xwininfo -id $id | grep Height | cut -d' ' -f4`
  y_offset=`/usr/bin/xwininfo -id $id | grep "Absolute upper-left Y" | cut -d' ' -f7`
  x_offset=`/usr/bin/xwininfo -id $id | grep "Absolute upper-left X" | cut -d' ' -f7`

  parameters="$parameters -f x11grab -s ${width}x${height} -r 30 -i :0.0+$x_offset,$y_offset -qscale 1 $video"
}

function record_audio () {
  parameters="$parameters -f alsa -ac 2 -i pulse"
}

function execute () {
  prepare_filename
  /usr/bin/ffmpeg $parameters
}