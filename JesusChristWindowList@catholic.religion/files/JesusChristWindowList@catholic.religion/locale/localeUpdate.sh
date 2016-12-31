#!/bin/sh
cd ..
cinnamon-json-makepot -j "new"
msguniq "new.pot" > "./locale/fixed.pot"
rm -fr "new.pot"
cd "locale"
mv -f "fixed.pot" "default.pot"
echo "Remove duplicate key done."
mkdir "temp"
mkdir "newpo"
for f in *.po
do
 filebase=$(basename "$f")
 filename="${filebase%.*}"
 msginit --no-translator -l "$filename" -i "default.pot" --o "./temp/$filebase"
 sed --in-place "./temp/$filebase" --expression='s/charset=ASCII/charset=UTF-8/'
 msgmerge -N "$filebase" "./temp/$filebase" > "./newpo/$filebase"
 echo "Generate new languages file: $filebase."
done
rm -fr "temp"
mv -f "./newpo/"*.po "."
rm -fr "newpo"
echo "All new .po languages was generate successfully."
rm -fr "./mo/"*
for f in *.po
do
 filebase=$(basename "$f")
 filename="${filebase%.*}"
 msgfmt -cv -o "./mo/$filename.mo" "./$filebase"
 echo "Generate new languages file: $filename.mo."
done
echo "All new .mo languages was generate successfully."




