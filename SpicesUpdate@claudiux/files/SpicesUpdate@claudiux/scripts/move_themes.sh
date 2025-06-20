#!/bin/bash
#####
# Moves themes to their new location,
# creating symbolic links to avoid any crash.

NEWDIR=$HOME/.local/share/themes
OLDDIR=$HOME/.themes

[[ -d $OLDDIR ]] || mkdir -p $OLDDIR

[[ -d $NEWDIR ]] || mkdir -p $NEWDIR

cd $OLDDIR
for f in $(ls -1A); do {
        [[ -d $f && ! -L $f ]] && {
				[[ -L $NEWDIR/$f ]] && rm -f $NEWDIR/$f
				mv $f $NEWDIR/
				ln -s $NEWDIR/$f
        }
}; done

exit 0
