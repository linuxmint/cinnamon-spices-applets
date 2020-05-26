#!/bin/bash
#
# Create .mo files (or replace older .mo files) into the right directories, from the .po existing files.
UUID="SpicesUpdate@claudiux"
cd $HOME/.local/share/cinnamon/applets/$UUID/po/

for l in $(ls -1A *.po | sed s/"\.po$"/" "/g | tr "\n" " ")
do
  mkdir -p $HOME/.local/share/locale/$l/LC_MESSAGES
  msgfmt -cv -o $HOME/.local/share/locale/$l/LC_MESSAGES/${UUID}.mo $l.po
done
