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

dialogE = gtk.FileChooserDialog(_("Save as..."),
                               None,
                               gtk.FILE_CHOOSER_ACTION_SAVE,
                               (gtk.STOCK_CANCEL, gtk.RESPONSE_CANCEL,
                                gtk.STOCK_SAVE, gtk.RESPONSE_OK))
dialogE.set_default_response(gtk.RESPONSE_OK)
dialogE.set_do_overwrite_confirmation(True)
dialogE.set_current_name("*.pdf");

filter = gtk.FileFilter()
filter.set_name(_("PDF Files"))
filter.add_pattern("*.pdf")
dialogO.add_filter(filter)
dialogE.add_filter(filter)


if dialogO.run() == gtk.RESPONSE_OK:
	dialogO.hide()
	dlg = gtk.Dialog(_('Pages to extract'))
	dlg.show()
	
	label = gtk.Label(_("Input pages to extract (e.g. : 1-5 7-9 or 3-end or even or odd) :"))
	label.show()
	dlg.vbox.pack_start(label)
	
	entry = gtk.Entry()
	entry.show()
	entry.set_activates_default(gtk.TRUE)
	dlg.vbox.pack_start(entry)

	dlg.add_button(gtk.STOCK_CANCEL, gtk.RESPONSE_CANCEL)
	dlg.add_button(gtk.STOCK_OK, gtk.RESPONSE_OK)
	dlg.set_default_response(gtk.RESPONSE_OK)

	if dlg.run() == gtk.RESPONSE_OK:
		dlg.hide()
		if dialogE.run() == gtk.RESPONSE_OK:
			os.system("pdftk \"" + dialogO.get_filename() + "\" cat " + entry.get_text() + " output \"" + dialogE.get_filename() + "\"")
		
dlg.destroy()
dialogO.destroy()
dialogE.destroy()
