#!/bin/bash

# Which spices? Get spices name
cd ..
parentDirName=$(basename -- "$(dirname -- "$(pwd)")")
spices=$(echo "$parentDirName" | cut -f3 -d '-')
cd status-scripts

if [ -d ../$spices-status ]; then
    rm -r ../$spices-status
fi
if [ -d ../language-status ]; then
    rm -r ../language-status
fi
if [ -f ../README.md ]; then
    rm ../README.md
fi

# first execute applet-status script
./spices-status.sh

# testversion?!
./untranslatedpo2md.sh

# next execute language-status script, because it depends on outputs of applet-status script
./language-status.sh

# next execute translation-status script, because it depends on outputs of language-status script
./translation-status.sh