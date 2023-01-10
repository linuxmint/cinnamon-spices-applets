#!/bin/bash
# This script is a part of the Radio3.0@claudiux applet.

APP_NAME="Radio3.0"
UUID="${APP_NAME}@claudiux"
MPV_SCRIPTS_DIR="${HOME}/.config/${APP_NAME}/mpv/scripts"

mkdir -p ${MPV_SCRIPTS_DIR}
cp -a "${HOME}/.local/share/cinnamon/applets/${UUID}/mpv-init/watchTitle.lua" ${MPV_SCRIPTS_DIR}
chmod 700 "$HOME/.config/${APP_NAME}/mpv"
chmod -R 700 ${MPV_SCRIPTS_DIR}
