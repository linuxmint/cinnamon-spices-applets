#!/bin/bash
export KEY="/org/cinnamon/enabled-applets"
VALUE="$(dconf read $KEY | sed -e 's+window-list@zeripath.sdf-eu.org+window-list@cinnamon.org+')"
DIR="$HOME/.local/share/cinnamon/applets/window-list@zeripath.sdf-eu.org"
rm -r $DIR
dconf write "$KEY" "$VALUE"

