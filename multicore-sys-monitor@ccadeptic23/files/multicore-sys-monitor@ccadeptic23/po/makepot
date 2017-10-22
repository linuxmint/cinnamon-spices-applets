#!/bin/bash
intltool-extract --type=gettext/glade ../3.0/prefsui.glade
intltool-extract --type=gettext/glade ../3.2/prefsui.glade
intltool-extract --type=gettext/glade ../3.4/prefsui.glade

xgettext --language=C --keyword=_ --keyword=N_ --output=multicore-sys-monitor.pot ../*/prefsui.glade.h
xgettext --language=JavaScript --keyword=_ --keyword=N_ --output=multicore-sys-monitor.pot --join-existing --from-code=UTF-8 ../*/*.js ../metadata.json

cd ..
cinnamon-json-makepot po/multicore-sys-monitor

rm -f */prefsui.glade.h
