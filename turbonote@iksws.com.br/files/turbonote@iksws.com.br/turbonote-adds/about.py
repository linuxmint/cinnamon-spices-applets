#!/usr/bin/env python3
from gi.repository import Gtk,Gdk
from config_note import Config
from gi.repository import GdkPixbuf

config_note = Config()
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds"
pathIcon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"



aboutdialog = Gtk.AboutDialog()
aboutdialog.set_name("Gnome TuboNote Extension")
aboutdialog.set_version("V 2.0")
aboutdialog.set_comments("Thank you for using this extension, please reporting bugs in")
aboutdialog.set_website("https://github.com/iksws/GnomeTurboNoteExtension")
aboutdialog.set_website_label("GitHub")
aboutdialog.set_authors(["iksws <ikswss@gmail.com>"])
aboutdialog.set_copyright(".Exe Design 2014")
with open ("/usr/share/cinnamon/applets/turbonote@iksws.com.br/COPYING", "r") as myfile:
	data=myfile.read()
aboutdialog.set_license(data)
aboutdialog.set_program_name("Gnome TurboNote Extension")
pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png",60,60)
aboutdialog.set_logo(pixbuf)
aboutdialog.run()
aboutdialog.destroy()


#self.set_icon_from_file("/home/" + config_note.getOwner() + "/.local/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png")
#donatebt.connect("clicked", self.on_button_clickedDonate)

def on_button_clickedDonate(self, widget):		
	os.system("firefox -new-tab https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick'&'hosted_button_id=ZVJ95XE3FKM3E");
