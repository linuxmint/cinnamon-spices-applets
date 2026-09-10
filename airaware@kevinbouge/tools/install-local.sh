#!/usr/bin/env bash
set -euo pipefail

APPLET_UUID="airaware@kevinbouge"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(dirname -- "$SCRIPT_DIR")"
APPLET_DIR="${ROOT_DIR}/files/${APPLET_UUID}"
DATA_HOME="${XDG_DATA_HOME:-"$HOME/.local/share"}"
DESTINATION="${DATA_HOME}/cinnamon/applets/${APPLET_UUID}"
PARENT_DIR="$(dirname -- "$DESTINATION")"
TEMP_DESTINATION="${DESTINATION}.tmp.$$"

cleanup() {
    rm -rf -- "$TEMP_DESTINATION"
}

trap cleanup EXIT

cd "$APPLET_DIR"

mkdir -p -- "$PARENT_DIR"
mkdir -p -- "$TEMP_DESTINATION"

cp -a \
    applet.js \
    metadata.json \
    settings-schema.json \
    stylesheet.css \
    icon.png \
    icon.svg \
    icons \
    lib \
    po \
    README.md \
    LICENSE \
    "$TEMP_DESTINATION/"

rm -rf -- "$DESTINATION"
mv -- "$TEMP_DESTINATION" "$DESTINATION"
trap - EXIT

printf 'Installed %s to %s\n' "$APPLET_UUID" "$DESTINATION"
printf 'Restart Cinnamon, then add AirAware from System Settings -> Applets.\n'
