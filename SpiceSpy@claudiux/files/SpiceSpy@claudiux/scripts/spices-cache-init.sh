#!/bin/bash
UUID="SpicesUpdate@claudiux"
for type in "action" "applet" "desklet" "extension" "theme"; do {
        mkdir -p $HOME/.cache/cinnamon/spices/$type
        echo "{}" > $HOME/.cache/cinnamon/spices/$type/index.json
}; done

$HOME/.local/share/cinnamon/applets/$UUID/scripts/spices-cache-updater.py --update-all

exit 0
