#!/usr/bin/env bash

APPLET_ID=calc-js@ptandler
SRC="$(dirname "${BASH_SOURCE[0]}")/files/$APPLET_ID"
DEST="$HOME/.local/share/cinnamon/applets/$APPLET_ID"

cd "$SRC" || exit 1 # "source DIR $SRC not found"

for file in *; do
  if cmp "$file" "$DEST/$file"; then
    # : = no-op
    : echo "$file ... unchanged"
  else
    # echo "$file ... has changed ... copy"
    cp --reflink=auto "$file" "$DEST/$file"
  fi
done
