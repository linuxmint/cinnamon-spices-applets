#!/bin/sh

cd "files/IcingTaskManager@json"
cinnamon-json-makepot --js ./po/default.pot
cd "po"

for f in *.po
do
 msgmerge -U $f ./default.pot
 echo "Updated $f with new definitions"
 rm "$f~"
done

