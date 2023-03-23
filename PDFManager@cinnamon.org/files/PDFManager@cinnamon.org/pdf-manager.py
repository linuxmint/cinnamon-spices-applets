#!/usr/bin/python3
import os,sys,threading,gettext,locale
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib

home = os.path.expanduser("~")
gettext.install("PDFManager@cinnamon.org", home + "/.local/share/locale")

def all_threads_are_dead(threads):
	for t in threads:
		if t.is_alive():
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
	
	confirm = Gtk.MessageDialog(
					parent=Gtk.Window(),
					message_type=Gtk.MessageType.QUESTION, 
					buttons=Gtk.ButtonsType.YES_NO,
					text=_('Installation of PDF Toolkit necessary'))
	if first:
		confirm.format_secondary_text(_('Do you want to install PDF toolkit? Your operations will be performed after the installation.'))
	else:
		confirm.format_secondary_text(_('Installation failed. Do you want to try again? Your operations will be performed after the installation.'))
	response = confirm.run()
	confirm.destroy()
	
	if response == Gtk.ResponseType.YES:
		os.system('apturl apt://pdftk')
		return pdftk_is_installed(0)
	return False
		
def reduce():
	dialogO = Gtk.FileChooserDialog(title=_("Select your PDF..."),
									action=Gtk.FileChooserAction.OPEN)
	dialogO.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
						Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
	dialogO.set_default_response(Gtk.ResponseType.OK)
	dialogO.set_select_multiple(True)

	filter = Gtk.FileFilter()
	filter.set_name(_("PDF Files"))
	filter.add_pattern("*.pdf")
	dialogO.add_filter(filter)
	
	response = dialogO.run()
	files = dialogO.get_filenames()
	dialogO.destroy()

	if response == Gtk.ResponseType.OK:
		win = Gtk.Window()
		bar = Gtk.ProgressBar()
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
		
		id_time = GLib.timeout_add(50, update_progress, bar)
		while not all_threads_are_dead(t_list):
			while Gtk.events_pending():
				Gtk.main_iteration()
		GLib.source_remove(id_time)
		win.destroy()

def merge():
	if pdftk_is_installed(1):
		dialogO = Gtk.FileChooserDialog(title=_("Select your PDF..."),
										action=Gtk.FileChooserAction.OPEN)
		dialogO.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
							Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
		dialogO.set_default_response(Gtk.ResponseType.OK)
		dialogO.set_select_multiple(True)

		filter = Gtk.FileFilter()
		filter.set_name(_("PDF Files"))
		filter.add_pattern("*.pdf")
		dialogO.add_filter(filter)
		
		response = dialogO.run()
		files = dialogO.get_filenames()
		dialogO.destroy()
		
		if response == Gtk.ResponseType.OK:
			
			dialogE = Gtk.FileChooserDialog(title=_("Save as..."),
											action=Gtk.FileChooserAction.SAVE)
			dialogE.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
								Gtk.STOCK_SAVE, Gtk.ResponseType.OK)
			dialogE.set_default_response(Gtk.ResponseType.OK)
			dialogE.set_do_overwrite_confirmation(True)
			dialogE.set_current_name("*.pdf")
			dialogE.add_filter(filter)
			
			response = dialogE.run()
			f = dialogE.get_filename()
			dialogE.destroy()
			
			if response == Gtk.ResponseType.OK:
			
				t = threading.Thread(target = lambda: PdfCommand("pdftk \"" + "\" \"".join(files) + "\" cat output \"" + f + "\"", None))
				t.start()
				
				win = Gtk.Dialog('Merging PDF')
				bar = Gtk.ProgressBar()
				win.get_content_area().pack_start(bar, True, True, 0)
				bar.set_text('Your PDF are merging... Don\'t manipulate selected files!')
				bar.set_show_text(True)
				win.show_all()
				
				id_time = GLib.timeout_add(50, update_progress, bar)
				while not all_threads_are_dead([t]):
					while Gtk.events_pending():
						Gtk.main_iteration()
				GLib.source_remove(id_time)
				win.destroy()

def extract():
	if pdftk_is_installed(1):
		dialogO = Gtk.FileChooserDialog(title=_("Select your PDF..."),
										action=Gtk.FileChooserAction.OPEN)
		dialogO.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
							Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
		dialogO.set_default_response(Gtk.ResponseType.OK)

		filter = Gtk.FileFilter()
		filter.set_name(_("PDF Files"))
		filter.add_pattern("*.pdf")
		dialogO.add_filter(filter)
	
		response = dialogO.run()
		f = dialogO.get_filename()
		dialogO.destroy()
		
		if response == Gtk.ResponseType.OK:
	
			win = Gtk.Dialog(title=_('Extract PDF')) 
			win.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
							Gtk.STOCK_OK, Gtk.ResponseType.OK)
			
			e = Gtk.Entry()
			b1 = Gtk.RadioButton(label=_('Extract following pages (example: 1-10 15-17):'))
			b2 = Gtk.RadioButton.new_from_widget(b1)
			b2.set_label(_('Extract even pages'))
			b3 = Gtk.RadioButton.new_from_widget(b1)
			b3.set_label(_('Extract odd pages'))
		
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
		
			if response == Gtk.ResponseType.OK:
				dialogE = Gtk.FileChooserDialog(title=_('Save as...'),
												action=Gtk.FileChooserAction.SAVE)
				dialogE.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
									Gtk.STOCK_SAVE, Gtk.ResponseType.OK)
				dialogE.set_default_response(Gtk.ResponseType.OK)
				dialogE.set_do_overwrite_confirmation(True)
				dialogE.set_current_name("*.pdf")
				dialogE.add_filter(filter)
				response = dialogE.run()
		
				if response == Gtk.ResponseType.OK:
					if b1.get_active():
						os.system('pdftk "' + f + '" cat ' + t + ' output "' + dialogE.get_filename() + '"')
					elif b2.get_active():
						os.system('pdftk "' + f + '" cat even output "' + dialogE.get_filename() + '"')
					else:
						os.system('pdftk "' + f + '" cat odd output "' + dialogE.get_filename() + '"')
				dialogE.destroy()

def flip():
	if pdftk_is_installed(1):
		dialogO = Gtk.FileChooserDialog(title=_("Select your PDF..."),
										action=Gtk.FileChooserAction.OPEN)
		dialogO.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
							Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
		dialogO.set_default_response(Gtk.ResponseType.OK)
		dialogO.set_select_multiple(True)

		filter = Gtk.FileFilter()
		filter.set_name(_("PDF Files"))
		filter.add_pattern("*.pdf")
		dialogO.add_filter(filter)

		if dialogO.run() == Gtk.ResponseType.OK:
			for f in dialogO.get_filenames():
				os.system("pdftk \"" + f + "\" cat 1-enddown output \"" + f + "_t\"")
				os.rename(f + "_t", f)
		dialogO.destroy()

def rotate_left():
	if pdftk_is_installed(1):
		dialogO = Gtk.FileChooserDialog(title=_("Select your PDF..."),
										action=Gtk.FileChooserAction.OPEN)
		dialogO.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
							Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
		dialogO.set_default_response(Gtk.ResponseType.OK)
		dialogO.set_select_multiple(True)

		filter = Gtk.FileFilter()
		filter.set_name(_("PDF Files"))
		filter.add_pattern("*.pdf")
		dialogO.add_filter(filter)

		if dialogO.run() == Gtk.ResponseType.OK:
			for f in dialogO.get_filenames():
				os.system("pdftk \"" + f + "\" cat 1-endleft output \"" + f + "_t\"")
				os.rename(f + "_t", f)
		dialogO.destroy()


def rotate_right():
	if pdftk_is_installed(1):
		dialogO = Gtk.FileChooserDialog(title=_("Select your PDF..."),
										action=Gtk.FileChooserAction.OPEN)
		dialogO.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
							Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
		dialogO.set_default_response(Gtk.ResponseType.OK)
		dialogO.set_select_multiple(True)

		filter = Gtk.FileFilter()
		filter.set_name(_("PDF Files"))
		filter.add_pattern("*.pdf")
		dialogO.add_filter(filter)

		if dialogO.run() == Gtk.ResponseType.OK:
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
