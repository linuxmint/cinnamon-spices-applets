#!/bin/bash
#####
# Moves themes to their new location,
# creating symbolic links to avoid any crash.

SOURCEDIR="$HOME/.local/share/themes/"
TARGETDIR="$HOME/.themes/"

[[ -d $SOURCEDIR ]] || exit 0

cd $SOURCEDIR
for f in $(ls -A); do {
        [[ -d $f && ! -L $f ]] && {
          [[ -L $TARGETDIR$f ]] && rm -f $TARGETDIR$f
          mv $f $TARGETDIR || rm -rf $f
          ln -s $TARGETDIR$f
        }
}; done
