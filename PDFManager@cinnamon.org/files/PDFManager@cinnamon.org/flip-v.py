#!/usr/bin/env python

import gtk
import os
import gettext
import locale

home = os.path.expanduser("~")
gettext.install("PDFManager@cinnamon.org", home + "/.local/share/locale")

dialogO = gtk.FileChooserDialog(_("Select your PDF..."),
                               None,
                               gtk.FILE_CHOOSER_ACTION_OPEN,
                               (gtk.STOCK_CANCEL, gtk.RESPONSE_CANCEL,
                                gtk.STOCK_OPEN, gtk.RESPONSE_OK))
dialogO.set_default_response(gtk.RESPONSE_OK)
dialogO.set_select_multiple(True)

filter = gtk.FileFilter()
filter.set_name(_("PDF Files"))
filter.add_pattern("*.pdf")
dialogO.add_filter(filter)

if dialogO.run() == gtk.RESPONSE_OK:
	for f in dialogO.get_filenames():
		os.system("pdftk \"" + f + "\" cat 1-enddown output \"" + f + "_t\"")
		os.rename(f + "_t", f)
dialogO.destroy()

