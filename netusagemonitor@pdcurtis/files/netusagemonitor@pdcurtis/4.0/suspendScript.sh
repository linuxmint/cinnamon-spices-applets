#!/bin/bash
# This currently contains a script file which you can modify
# if required to satisfy your requirements.
# You need to install two programs for this script to run:
#
#    Zenity which is a program that will display GTK+ dialogs,
#    and returns (either in the return code, or on standard output)
#    the users input. This allows you to present information, and ask
#    for information from shell scripts. You can set timers if required.
#
#    Sox allows you to play an audio file as a warning -
#    you may need an extra library if you use mp3.
#
# Zenity and Sox can installed by
#    sudo apt-get install sox libsox-fmt-mp3 zenity
#
# Modifications to this script are likely to be overwritten by
# updates so back it up


# Play a sound file as a separate process
play "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga" &

# Put up a warning with timer using Zenity
version=$(/usr/bin/zenity --version)

if [[ $version == 4* ]]; then
  zenity --question --text="The data usage limit has been exceeded - the machine will be suspended shortly" --timeout=20 --ok-label="Suspend Immediately" --cancel-label="Abort Suspension" --title=WARNING_SUSPENDING_SHORTLY --icon=error --height=400 --width=750
else
  zenity --question --text="The data usage limit has been exceeded - the machine will be suspended shortly" --timeout=20 --ok-label="Suspend Immediately" --cancel-label="Abort Suspension" --title=WARNING_SUSPENDING_SHORTLY --window-icon=error --height=400 --width=750
fi

rc=$?

if [[ $rc -eq 0 || $rc -eq 5 ]]; then
  # Put up another warning which will be there when machine is restarted,
  zenity --warning --text="Machine was Suspended as the data usage limit set has been exceeded" &
  # wait a few seconds to stabilise then suspend.
  # sleep 2
  # Suspend via dbus in Mint 17.x
  dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Suspend
  # Suspend via systemctl in Mint 18
  systemctl suspend
  exit 1
else
  zenity --warning --text="Suspension aborted despite data limit being exceeded" &
fi
exit 0

# Modified 30-12-2023 to support Zenity 4.x
# Modified 07-07-2016 for Mint 18 using systemclt calls for suspend and add option of Suspend Immediately
