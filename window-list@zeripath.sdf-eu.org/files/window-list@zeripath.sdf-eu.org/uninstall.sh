#!/bin/bash
command -v dconf >/dev/null 2>&1 || { echo >&2 "I require dconf, part of dconf-tools, but this doesn't exist. Please install dconf-tools: sudo apt-get install dconf-tools"; exit 1; }
export KEY="/org/cinnamon/enabled-applets"
VALUE="$(dconf read $KEY | sed -e 's+window-list@zeripath.sdf-eu.org+window-list@cinnamon.org+')"
DIR="$HOME/.local/share/cinnamon/applets/window-list@zeripath.sdf-eu.org"
rm -r $DIR
dconf write "$KEY" "$VALUE"

