#!/bin/bash
#
# Create .mo files (or replace older .mo files) into the right directories, from the .po existing files.
#
APPLET="sound150@claudiux"
cd $HOME/.local/share/cinnamon/applets/$APPLET/po/

for l in $(ls -1A *.po | sed s/"\.po$"/" "/g | tr "\n" " ")
do
  mkdir -p $HOME/.local/share/locale/$l/LC_MESSAGES
  msgfmt -cv -o $HOME/.local/share/locale/$l/LC_MESSAGES/$APPLET.mo $HOME/.local/share/cinnamon/applets/$APPLET/po/$l.po
done
