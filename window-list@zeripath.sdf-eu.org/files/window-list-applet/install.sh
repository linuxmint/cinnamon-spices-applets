#!/bin/bash
export KEY="/org/cinnamon/enabled-applets"
VALUE="$(dconf read $KEY | sed -e 's+window-list@cinnamon.org+window-list@zeripath.sdf-eu.org+')"
DIR="$HOME/.local/share/cinnamon/applets/window-list@zeripath.sdf-eu.org"
mkdir -p "$DIR"
cp applet.js metadata.json $DIR
dconf write "$KEY" "$VALUE"

