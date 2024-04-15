#!/bin/bash
#####
# Moves themes to their new location,
# creating symbolic links to avoid any crash.

SOURCEDIR="$HOME/.themes/"
TARGETDIR="$HOME/.local/share/themes/"

cd $SOURCEDIR
for f in $(ls -A); do {
        [[ -d $f ]] && {
          mv $f $TARGETDIR
          ln -s $TARGETDIR$f
        }
}; done
