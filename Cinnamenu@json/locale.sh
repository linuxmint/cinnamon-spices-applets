#!/bin/sh

cd "files/Cinnamenu@json"
cinnamon-xlet-makepot -o ./po/Cinnamenu.pot ./
cd "po"

for f in *.po
do
 msgmerge -U $f ./Cinnamenu.pot
 echo "Updated $f with new definitions"
 rm "$f~"
done

