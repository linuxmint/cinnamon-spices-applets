#!/usr/bin/env bash
cd "$HOME/.local/share/locale"

for lang in $(ls -1A); do {
  [[ -d $lang/LC_MESSAGES ]] && {
    [[ -f $lang/LC_MESSAGES/Radio3.0@claudiux.mo ]] && {
      [[ -f $lang/LC_MESSAGES/AlbumArt3.0@claudiux.mo ]] && {
        size1=$(stat -c %s "$lang/LC_MESSAGES/Radio3.0@claudiux.mo")
        size2=$(stat -c %s "$lang/LC_MESSAGES/AlbumArt3.0@claudiux.mo")
        [[ $size1 -eq $size2 ]] || {
          cp -a -f $lang/LC_MESSAGES/Radio3.0@claudiux.mo $lang/LC_MESSAGES/AlbumArt3.0@claudiux.mo;
        }
      } || {
        cp -a -f $lang/LC_MESSAGES/Radio3.0@claudiux.mo $lang/LC_MESSAGES/AlbumArt3.0@claudiux.mo
      }
    }
  }
}; done

exit 0
