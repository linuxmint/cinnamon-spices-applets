#!/usr/bin/env python
import gtk,gobject,os,sys,threading,gettext,locale

home = os.path.expanduser("~")
gettext.install("PDFManager@cinnamon.org", home + "/.local/share/locale")

def all_threads_are_dead(threads):
	for t in threads:
		if t.isAlive():
			return False
	return True
	
def update_progress(bar):
	bar.pulse()
	return True
	
def PdfCommand(command, link):
	os.system(command)
	if link != None:
		os.rename(link + '_t', link)

def pdftk_is_installed(first):
	if os.path.isfile('/usr/bin/pdftk'):
		return True
	
	confirm = gtk.MessageDialog(None, 0, gtk.MESSAGE_QUESTION, 
					gtk.BUTTONS_YES_NO,
					_('Installation of PDF Toolkit necessary'))
	if first:
		confirm.format_secondary_text(_('Do you want to install PDF toolkit? Your operations will be performed after the installation.'))
	else:
		confirm.format_secondary_text(_('Installation failed. Do you want to try again? Your operations will be performed after the installation.'))
	response = confirm.run()
	confirm.destroy()
	
	if response == gtk.RESPONSE_YES:
		os.system('gksu apt-get install pdftk')
		return pdftk_is_installed(0)
	return False
		
def reduce():
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
	
	response = dialogO.run()
	files = dialogO.get_filenames()
	dialogO.destroy()

	if response == gtk.RESPONSE_OK:
		win = gtk.Window()
		bar = gtk.ProgressBar()
		win.add(bar)
		win.set_title(_('Reducing PDF'))
		win.set_border_width(10)
		bar.set_text(_('Your PDF are reducing... Don\'t manipulate selected files!'))
		bar.set_show_text(True)
		win.show_all()
		
		t_list = []
		for f in files:
			t = threading.Thread(target = lambda: PdfCommand('gs -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -sOutputFile="' + f + '_t" "' + f + '"', f))
			t.start()
			t_list.append(t)
		
		id_time = gobject.timeout_add(50, update_progress, bar)
		while not all_threads_are_dead(t_list):
			while gtk.events_pending():
				gtk.main_iteration()
		gobject.source_remove(id_time)
		win.destroy()

def merge():
	if pdftk_is_installed(1):
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
		
		response = dialogO.run()
		files = dialogO.get_filenames()
		dialogO.destroy()
		
		if response == gtk.RESPONSE_OK:
			
			dialogE = gtk.FileChooserDialog(_("Save as..."),
						                   None,
						                   gtk.FILE_CHOOSER_ACTION_SAVE,
						                   (gtk.STOCK_CANCEL, gtk.RESPONSE_CANCEL,
						                    gtk.STOCK_SAVE, gtk.RESPONSE_OK))
			dialogE.set_default_response(gtk.RESPONSE_OK)
			dialogE.set_do_overwrite_confirmation(True)
			dialogE.set_current_name("*.pdf")
			dialogE.add_filter(filter)
			
			response = dialogE.run()
			f = dialogE.get_filename()
			dialogE.destroy()
			
			if response == gtk.RESPONSE_OK:
			
				t = threading.Thread(target = lambda: PdfCommand("pdftk \"" + "\" \"".join(files) + "\" cat output \"" + f + "\"", None))
				t.start()
				
				win = gtk.Dialog('Merging PDF')
				bar = gtk.ProgressBar()
				win.get_content_area().pack_start(bar, True, True, 0)
				bar.set_text('Your PDF are merging... Don\'t manipulate selected files!')
				bar.set_show_text(True)
				win.show_all()
				
				id_time = gobject.timeout_add(50, update_progress, bar)
				while not all_threads_are_dead([t]):
					while gtk.events_pending():
						gtk.main_iteration()
				gobject.source_remove(id_time)
				win.destroy()

def extract():
	if pdftk_is_installed(1):
		dialogO = gtk.FileChooserDialog(_("Select your PDF..."),
				                       None,
				                       gtk.FILE_CHOOSER_ACTION_OPEN,
				                       (gtk.STOCK_CANCEL, gtk.RESPONSE_CANCEL,
				                        gtk.STOCK_OPEN, gtk.RESPONSE_OK))
		dialogO.set_default_response(gtk.RESPONSE_OK)

		filter = gtk.FileFilter()
		filter.set_name(_("PDF Files"))
		filter.add_pattern("*.pdf")
		dialogO.add_filter(filter)
	
		response = dialogO.run()
		f = dialogO.get_filename()
		dialogO.destroy()
		
		if response == gtk.RESPONSE_OK:
	
			win = gtk.Dialog(_('Extract PDF'), None, 0, 
							(gtk.STOCK_CANCEL, gtk.RESPONSE_CANCEL,
							gtk.STOCK_OK, gtk.RESPONSE_OK))
			
			e = gtk.Entry()
			b1 = gtk.RadioButton(None, _('Extract following pages (example: 1-10 15-17):'))
			b2 = gtk.RadioButton(b1, _('Extract even pages'))
			b3 = gtk.RadioButton(b1, _('Extract odd pages'))
		
			b1.connect('toggled', lambda x, y: e.set_editable(True), None)
			b2.connect('toggled', lambda x, y: e.set_editable(False), None)
			b3.connect('toggled', lambda x, y: e.set_editable(False), None)
		
			vbox = win.get_content_area()
			vbox.pack_start(b1, True, True, 0)
			vbox.pack_start(e, True, True, 0)
			vbox.pack_start(b2, True, True, 0)
			vbox.pack_start(b3, True, True, 0)
		
			win.show_all()
			response = win.run()
			t = e.get_text()
			win.destroy()
		
			if response == gtk.RESPONSE_OK:
				dialogE = gtk.FileChooserDialog(_('Save as...'),
		                       None,
		                       gtk.FILE_CHOOSER_ACTION_SAVE,
		                       (gtk.STOCK_CANCEL, gtk.RESPONSE_CANCEL,
		                        gtk.STOCK_SAVE, gtk.RESPONSE_OK))
				dialogE.set_default_response(gtk.RESPONSE_OK)
				dialogE.set_do_overwrite_confirmation(True)
				dialogE.set_current_name("*.pdf")
				dialogE.add_filter(filter)
				response = dialogE.run()
		
				if response == gtk.RESPONSE_OK:
					if b1.get_active():
						os.system('pdftk "' + f + '" cat ' + t + ' output "' + dialogE.get_filename() + '"')
					elif b2.get_active():
						os.system('pdftk "' + f + '" cat even output "' + dialogE.get_filename() + '"')
					else:
						os.system('pdftk "' + f + '" cat odd output "' + dialogE.get_filename() + '"')
				dialogE.destroy()

def flip():
	if pdftk_is_installed(1):
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

def rotate_left():
	if pdftk_is_installed(1):
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
				os.system("pdftk \"" + f + "\" cat 1-endleft output \"" + f + "_t\"")
				os.rename(f + "_t", f)
		dialogO.destroy()


def rotate_right():
	if pdftk_is_installed(1):
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


if sys.argv[1] == "-r":
	reduce()
elif sys.argv[1] == "-m":
	merge()
elif sys.argv[1] == "-e":
	extract()
elif sys.argv[1] == "-f":
	flip()
elif sys.argv[1] == "-rl":
	rotate_left()
elif sys.argv[1] == "-rr":
	rotate_right()
