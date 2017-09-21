#!/bin/bash

# Which spices? Get spices name
cd ..
parentDirName=$(basename -- "$(dirname -- "$(pwd)")")
spices=$(echo "$parentDirName" | cut -f3 -d '-')
cd status-scripts

rm -r ../$spices-status
rm -r ../language-status
rm ../README.md

# first execute applet-status script
./spices-status.sh

# testversion?!
./untranslatedpo2md.sh

# next execute language-status script, because it depends on outputs of applet-status script
./language-status.sh

# next execute translation-status script, because it depends on outputs of language-status script
./translation-status.sh
