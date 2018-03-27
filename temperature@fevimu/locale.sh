#!/bin/sh

cd "files/temperature@fevimu"
cinnamon-json-makepot --js ./po/temperature@fevimu.pot
cd "po"

for f in *.po
do
 msgmerge -U $f ./temperature@fevimu.pot
 echo "Updated $f with new definitions"
 rm "$f~"
done

