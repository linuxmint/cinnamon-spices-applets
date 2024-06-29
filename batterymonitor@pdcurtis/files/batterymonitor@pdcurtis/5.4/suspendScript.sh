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

TEXTDOMAIN="batterymonitor@pdcurtis"
TEXTDOMAINDIR="${HOME}/.local/share/locale"
_TITLE=$"WARNING: SUSPENDING SOON"
_TEXT=$"The battery level is critical. The machine will be suspended shortly."
_CANCEL_LABEL=$"Abort Suspension"
_OK_LABEL=$"Suspend Immediately"
_WARNING=$"The machine was suspended as the battery level was critical."
TITLE="$(/usr/bin/gettext "$_TITLE")"
TEXT="$(/usr/bin/gettext "$_TEXT")"
CANCEL_LABEL="$(/usr/bin/gettext "$_CANCEL_LABEL")"
OK_LABEL="$(/usr/bin/gettext "$_OK_LABEL")"
WARNING="$(/usr/bin/gettext "$_WARNING")"

# Put up a warning with timer using Zenity
version=$(/usr/bin/zenity --version)
if [[ $version == 4* ]]; then
  /usr/bin/zenity --question --text="${TEXT}" --timeout=40 --ok-label="${OK_LABEL}" --cancel-label="${CANCEL_LABEL}" --title="${TITLE}" --icon=error --height=400 --width=750
else
  /usr/bin/zenity --question --text="${TEXT}" --timeout=40 --ok-label="${OK_LABEL}" --cancel-label="${CANCEL_LABEL}" --title="${TITLE}" --window-icon=error --height=400 --width=750
fi

result=$?

if [[ $result -eq 0 || $result -eq 5 ]]; then
  # Put up another warning which will be there when machine is restarted.
  /usr/bin/zenity --warning --text="${WARNING}" &

  # Suspend via systemctl
  /usr/bin/systemctl suspend
  exit 1
fi
exit 0

# Modified 30-12-2023 to support translatable strings and Zenity 4.x
# Modified 08-12-2022 to cleanup suspendScript for Cinnamon 5.4+
# Modified 27-07-2017 to remove sound file which is transfered to applet
# Modified 15-07-2016 to correct messages and spelling.
# Modified 07-07-2016 for Mint 18 using systemctl calls for suspend and added option of Suspend Immediately
