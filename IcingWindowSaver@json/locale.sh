#!/bin/sh

cd "files/IcingWindowSaver@json"
cinnamon-xlet-makepot -o ./po/IcingWindowSaver@json.pot ./
cd "po"

for f in *.po
do
 msgmerge -U $f ./IcingWindowSaver@json.pot
 echo "Updated $f with new definitions"
 rm "$f~"
done

