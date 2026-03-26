#!/bin/sh

cd "files/multicore-sys-monitor@ccadeptic23"
cinnamon-xlet-makepot -o ./po/multicore-sys-monitor.pot ./
cd "po"

intltool-extract --type=gettext/glade ../3.0/prefsui.glade
intltool-extract --type=gettext/glade ../3.2/prefsui.glade
intltool-extract --type=gettext/glade ../3.4/prefsui.glade
intltool-extract --type=gettext/glade ../4.0/prefsui.glade
xgettext --language=C --keyword=_ --keyword=N_ --output=multicore-sys-monitor.pot ../*/prefsui.glade.h
xgettext --language=JavaScript --keyword=_ --keyword=N_ --output=multicore-sys-monitor.pot --join-existing --from-code=UTF-8 ../*/*.js ../metadata.json

#~ for f in *.po
#~ do
 #~ msgmerge -U $f ./multicore-sys-monitor.pot
 #~ echo "Updated $f with new definitions"
 #~ rm "$f~"
#~ done

rm ../*/prefsui.glade.h
