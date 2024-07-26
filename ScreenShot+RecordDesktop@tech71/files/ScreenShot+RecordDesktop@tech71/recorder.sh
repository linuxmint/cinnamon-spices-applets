#!/bin/bash

typeset -a parameters

generate_filename() {
  . "$HOME/.config/user-dirs.dirs"
  ###   Date and time format   ###
  # 24-Hour time should not add pm/am, but is kept for compatibility for now
  echo "$XDG_VIDEOS_DIR/Cinnamon-$( date +'%b-%d-%Y_%H:%M:%S%#p' ).mkv"   ## 24-Hour time
}

record_screen() {
  local size=$( /usr/bin/xdpyinfo | grep 'dimensions:' | awk '{print $2}' )
  parameters+=(
    -f x11grab
    -s "$size"
    -r 30
    -i "$DISPLAY"
    -qscale 1
    -vf mpdecimate=0:0:0:0
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
    -s "${width}x${height}"
    -r 30
    -i "$DISPLAY+$x_offset,$y_offset"
    -qscale 1
    -vf mpdecimate=0:0:0:0
  )
}

record_audio() {
  parameters+=(
    -f pulse
    -ac 2
    -i default
  )
}

execute() {
  ffmpeg "${parameters[@]}" "$(generate_filename)"
}
