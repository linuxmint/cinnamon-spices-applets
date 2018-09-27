#!/bin/sh

cd "files/multicore-sys-monitor@ccadeptic23"
cinnamon-xlet-makepot -o ./po/multicore-sys-monitor.pot ./
cd "po"

for f in *.po
do
 msgmerge -U $f ./multicore-sys-monitor.pot
 echo "Updated $f with new definitions"
 rm "$f~"
done

