#!/bin/bash
command -v dconf >/dev/null 2>&1 || { echo >&2 "I require dconf, part of dconf-tools, but this doesn't exist. Please install dconf-tools: sudo apt-get install dconf-tools"; exit 1; }
export KEY="/org/cinnamon/enabled-applets"
VALUE="$(dconf read $KEY | sed -e 's+window-list@cinnamon.org+window-list@zeripath.sdf-eu.org+')"
DIR="$HOME/.local/share/cinnamon/applets/window-list@zeripath.sdf-eu.org"
mkdir -p "$DIR"
cp applet.js metadata.json settings-schema.json $DIR
dconf write "$KEY" "$VALUE"

