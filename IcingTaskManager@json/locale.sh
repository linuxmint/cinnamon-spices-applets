#!/bin/sh

cd "files/locale"
for f in *.po
do
 filebase=$(basename "$f")
 filename="${filebase%.*}"
 cp "./mo/$filename.mo" "$HOME/.local/share/locale/$filename/LC_MESSAGES/IcingTaskManager@json.mo"
 echo "Installed new languages file: $filename.mo to local."
done

