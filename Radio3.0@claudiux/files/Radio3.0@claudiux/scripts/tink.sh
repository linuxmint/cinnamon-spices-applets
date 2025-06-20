#!/bin/bash

TINK=$HOME/.local/share/cinnamon/applets/Radio3.0@claudiux/sounds/tink.ogg

for i in $(seq 1 4); do {
    play -v 1 -q $TINK
    sleep 1
}; done

exit 0
