#!/usr/bin/env python

import gtk
import os
import gettext
import locale

locale.setlocale(locale.LC_ALL, '')
loc = locale.getlocale()
filename = os.path.abspath(os.path.split(__file__)[0]) + "/locale/%s/LC_MESSAGES/PDFManager.mo" % locale.getlocale()[0][0:2]

try:
	trans = gettext.GNUTranslations(open( filename, "rb" ) )
except IOError:
	trans = gettext.NullTranslations()

trans.install()

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
		os.system("pdftk \"" + f + "\" cat 1-endright output \"" + f + "_t\"")
		os.rename(f + "_t", f)
dialogO.destroy()

