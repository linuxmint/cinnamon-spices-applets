#!/bin/bash

typeset -a parameters

generate_filename() {
  . "$HOME/.config/user-dirs.dirs"
  ###   Date and time format   ###
  # 24-Hour time should not add pm/am, but is kept for compatibility for now
  echo "Cinnamon-$( date +'%b-%d-%Y_%H:%M:%S%#p' )"   ## 24-Hour time
}

record_screen() {
  local size=$( /usr/bin/xdpyinfo | grep 'dimensions:' | awk '{print $2}' )
  parameters+=(
    -f x11grab
    -i ':0'
    -s "$size"
    -r 30
    -qscale 1
  )
}

record_window() {
  id=$(/usr/bin/xdotool getactivewindow)
  width=$(/usr/bin/xwininfo -id "$id" | grep Width | cut -d' ' -f4)
  height=$(/usr/bin/xwininfo -id "$id" | grep Height | cut -d' ' -f4)
  y_offset=$(/usr/bin/xwininfo -id "$id" | grep "Absolute upper-left Y" | cut -d' ' -f7)
  x_offset=$(/usr/bin/xwininfo -id "$id" | grep "Absolute upper-left X" | cut -d' ' -f7)

  parameters+=(
    -f x11grab
    -i ":0+$x_offset,$y_offset"
    -s "${width}x${height}"
    -r 30
    -qscale 1
  )
}

record_audio() {
  parameters+=(
    -f alsa
    -ac 2
    -i pulse
  )
}

execute() {
  ffmpeg "${parameters[@]}" "$(generate_filename)"
}
