#!/bin/sh

cd "files/wattusage@joka42"
cinnamon-json-makepot --js ./po/wattusage@joka42.pot
cd "po"

for f in *.po
do
 msgmerge -U $f ./wattusage@joka42.pot
 echo "Updated $f with new definitions"
 rm "$f~"
done

