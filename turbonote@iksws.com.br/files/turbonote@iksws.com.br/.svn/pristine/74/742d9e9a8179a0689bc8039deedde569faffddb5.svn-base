#!/usr/bin/env python
#by ikswss@gmail.com

from gi.repository import Gtk, Gio,Gdk, Pango
import re
import time
import cStringIO
import sys,os
from subprocess import call
import threading
from config_note import Config
from list_control import MyWindow
from notestyle import WindowStyle

config_note = Config()
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"
path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"
stay = ""

def assignNewValueToStay(s):
    global stay
    stay = s

onepick = True

def assignNewValueToOnePick(p):
    global onepick
    onepick = p

attpick = True

attFile = ""

def assignNewValueToAttFile(f):
    global attFile
    attFile = f

def assignNewValueToAttPick(p):
    global attpick
    attpick = p

class HeaderBarWindow(Gtk.Window):

    def __init__(self):
        Gtk.Window.__init__(self, title = "New Note")
        self.set_icon_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png")	
        self.set_border_width(15)
       	self.set_default_size(480, 350)

        hb = Gtk.HeaderBar()
        hb.props.show_close_button = True
        hb.props.title = "New Note"

        box2 = Gtk.VBox(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box2.get_style_context(), "linked")

        self.set_titlebar(hb)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.grid = Gtk.Grid()
        self.add(self.grid)        
        self.create_textview(box2,hb)
        self.set_wmclass ("TurboNote Gnome", "TurboNote Gnome")
        self.connect('key-press-event',on_button_clicked2)
    
    def noteStyle(self,widget):
    	style = WindowStyle()
    	style.connect("delete-event", Gtk.main_quit)
    	style.show_all()
    	Gtk.main()

    def toggle_titulo_callback(self, button):
	    if self.toggle_titulo.get_active():
	    	if onepick:
	    		self.grid.attach(self.label2, 0, 2, 1 , 1)
	    		self.grid.attach(self.titulotxt, 0, 1, 1, 1)	 
	    		assignNewValueToOnePick(False)   	
	        self.titulotxt.show()
	        self.label2.show()
	    else:
	    	self.titulotxt.set_text("")
	        self.titulotxt.hide()
	        self.label2.hide()

    def toggle_stay_callback(self, button):
	    if self.toggle_stay.get_active():
	        assignNewValueToStay("Yes")
	    else:
	        assignNewValueToStay("")

    def on_button_ss(self, widget):
		os.system("gnome-screenshot -i -a")	

    def on_button_clicked1(self, widget):
		buf  = self.textview.get_buffer()
		text = buf.get_text(buf.get_start_iter(),buf.get_end_iter(),True)		
		send_turbo(text.decode('utf-8').encode('windows-1252'),self.titulotxt.get_text(),attFile,self.get_size()[0],self.get_size()[1])

    def on_file_clicked(self, widget,box2):
		if attpick:
			self.grid.attach(self.label3, 0, 6, 1, 1)			
			self.grid.attach(self.labelattached, 0, 5, 1, 1)
			box2.add(self.attachedbtrmv)
			self.show_all()
			self.attachedbtrmv.hide()				
			assignNewValueToAttPick(False)			
		dialog = Gtk.FileChooserDialog("Please choose a file", self,
            Gtk.FileChooserAction.OPEN,
            (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
             Gtk.STOCK_OPEN, Gtk.ResponseType.OK))
  		  		
  		resp = dialog.run()

  		if resp == Gtk.ResponseType.OK:     
	  		self.label3.show()
			self.labelattached.show()			
			filename = dialog.get_filename()
			filename = filename.split("/")
			assignNewValueToAttFile(dialog.get_filename())
			self.labelattached.set_markup("Attached file <b>" + filename[len(filename)-1] +  "</b>") 
			self.attachedbt.hide()
			self.attachedbtrmv.show()			

		elif resp == Gtk.ResponseType.CANCEL:
			self.labelattached.set_text("") 
			assignNewValueToAttFile("")

		dialog.destroy()

    def on_file_clicked_rmv(self, widget):
		self.labelattached.set_text("")
		assignNewValueToAttFile("")
		self.attachedbt.show()	
		self.attachedbtrmv.hide()	
		self.label3.hide()
		self.labelattached.hide()

    def create_textview(self,box2,hb):
		scrolledwindow = Gtk.ScrolledWindow()
		scrolledwindow.set_hexpand(True)
		scrolledwindow.set_vexpand(True)
		scrolledwindow.set_shadow_type(2)
		scrolledwindow.set_border_width(border_width=1)
		scrolledwindow.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
		self.grid.attach(scrolledwindow, 0, 3, 1, 1)

		self.textview = Gtk.TextView()
		self.textview.set_wrap_mode(Gtk.WrapMode.WORD)
		self.textview.set_border_width(10)
		self.textbuffer = self.textview.get_buffer()
		self.textbuffer.set_text("")
		scrolledwindow.add(self.textview) 

		self.label = Gtk.Label()
		self.label.set_text(" ") 
		self.label2 = Gtk.Label()
		self.label2.set_text(" ") 
		self.label3 = Gtk.Label()
		self.label3.set_text(" ") 

		self.labelattached = Gtk.Label()
		self.labelattached.set_text("") 

		self.toggle_stay = Gtk.ToggleButton()
		self.toggle_stay.set_tooltip_text("Stay on Top")
		self.toggle_stay.connect("toggled", self.toggle_stay_callback)

		self.toggle_titulo = Gtk.ToggleButton()
		self.toggle_titulo.set_tooltip_text("Set title")
		self.toggle_titulo.connect("toggled", self.toggle_titulo_callback)

		self.settings = Gtk.Button()
		self.settings.set_tooltip_text("Style windows settings")
		self.settings.connect("clicked", self.noteStyle)

		self.titulotxt = Gtk.Entry()
		responderbt = Gtk.Button()	
		responderbt.set_tooltip_text("Send [You can just press CTRL+Enter]")
		scshot = Gtk.Button()	
		scshot.set_tooltip_text("Crop Picture")
		self.attachedbt = Gtk.Button()
		self.attachedbt.set_tooltip_text("Attach file or image")
		self.attachedbtrmv = Gtk.Button()
		self.attachedbtrmv.set_tooltip_text("Remove attachment")
		self.attachedbt.connect("clicked", self.on_file_clicked,box2)		
		self.attachedbtrmv.connect("clicked", self.on_file_clicked_rmv)
		

		button_bold = Gtk.Button()
		button_italic = Gtk.Button()
		button_underline = Gtk.Button()

		self.boldico = Gtk.Image()	
		self.boldico.set_from_stock(Gtk.STOCK_BOLD,Gtk.IconSize.BUTTON)
		button_bold.add(self.boldico)

		self.italicico = Gtk.Image()	
		self.italicico.set_from_stock(Gtk.STOCK_ITALIC,Gtk.IconSize.BUTTON)
		button_italic.add(self.italicico)

		self.underico = Gtk.Image()	
		self.underico.set_from_stock(Gtk.STOCK_UNDERLINE,Gtk.IconSize.BUTTON)
		button_underline.add(self.underico)

		self.tag_bold = self.textbuffer.create_tag("bold",weight=Pango.Weight.BOLD)
		self.tag_italic = self.textbuffer.create_tag("italic",style=Pango.Style.ITALIC)
		self.tag_underline = self.textbuffer.create_tag("underline",underline=Pango.Underline.SINGLE)

		button_bold.connect("clicked", on_button_clicked, self.tag_bold,self.textbuffer)
		button_italic.connect("clicked", on_button_clicked,self.tag_italic,self.textbuffer)
		button_underline.connect("clicked", on_button_clicked,self.tag_underline,self.textbuffer)

		self.photo = Gtk.Image()	
		self.photo.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_camera" + config_note.getColor() + ".png")		
		scshot.add(self.photo)

		self.sending = Gtk.Image()	
		self.sending.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_send_now" + config_note.getColor() + ".png")		
		responderbt.add(self.sending)

		self.staytop = Gtk.Image()	
		
		if config_note.getColorRevertTitle():
			self.staytop.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_cast" + config_note.getColorOver() + ".png")		
		else:		
			self.staytop.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_cast" + config_note.getColor() + ".png")		
		self.toggle_stay.add(self.staytop)	

		self.enabletitle = Gtk.Image()	
		if config_note.getColorRevertTitle():
			self.enabletitle.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_labels" + config_note.getColorOver() + ".png")		
		else:
			self.enabletitle.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_labels" + config_note.getColor() + ".png")		
		self.toggle_titulo.add(self.enabletitle)

		self.addattimg = Gtk.Image()	
		self.addattimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_new_attachment" + config_note.getColor() + ".png")		
		self.attachedbt.add(self.addattimg)

		self.addattimgrmv = Gtk.Image()	
		self.addattimgrmv.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_remove_attached" + config_note.getColor() + ".png")		
		self.attachedbtrmv.add(self.addattimgrmv)	

		self.settingsimg = Gtk.Image()	
		if config_note.getColorRevertTitle():
			self.settingsimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_settings" + config_note.getColorOver() + ".png")		
		else:
			self.settingsimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_settings" + config_note.getColor() + ".png")		
		self.settings.add(self.settingsimg)

		self.grid.attach(self.label, 0, 4, 1, 1)
		box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
		Gtk.StyleContext.add_class(box.get_style_context(), "linked")			
		
		box.add(self.toggle_stay)
		box.add(self.toggle_titulo)
		box.add(self.settings)
		
		box2.add(scshot)
		box2.add(responderbt)
		box2.add(self.attachedbt)
		#box.add(button_italic)
		#box.add(button_bold)
		#box.add(button_underline)		
		hb.pack_start(box)

		scrolledwindow2 = Gtk.ScrolledWindow()
		scrolledwindow2.set_hexpand(True)
		scrolledwindow2.set_vexpand(True)
		scrolledwindow2.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
		self.grid.attach(box2, 0, 7, 1, 1)	
		box2.set_hexpand(True)

		responderbt.connect("clicked", self.on_button_clicked1)
		scshot.connect("clicked", self.on_button_ss)

def on_button_clicked2(self, event):
	keyval = event.keyval
	name = Gdk.keyval_name(keyval)
	mod = Gtk.accelerator_get_label(keyval,event.state)
	if mod == "Ctrl+Mod2+Return" or mod == "Ctrl+Mod2+Enter":
		buf  = self.textview.get_buffer()
		text = buf.get_text(buf.get_start_iter(),buf.get_end_iter(),True)

		#fix windows
		text.replace("\\","\\\\");

		try:
			send_turbo(text.decode('utf-8').encode('windows-1252'),self.titulotxt.get_text(),attFile,self.get_size()[0],self.get_size()[1])
		except Exception, e:
			msgerror = "Unable to send to " + name.upper() + "\\nInvalid Characters!"
			command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"
			os.system(command)
		
def send_turbo(message,titulo,att,w,h):
	win = MyWindow(message,stay,att,titulo,w,h)
	win.connect("delete-event", Gtk.main_quit)
	win.show_all()
	Gtk.main()

def on_button_clicked(self, tag,textbuffer):
	bounds = textbuffer.get_selection_bounds()
	if len(bounds) != 0:
		start, end = bounds		
		textbuffer.apply_tag(tag, start, end)

win = HeaderBarWindow()
win.connect("delete-event", Gtk.main_quit)
win.show_all()
Gtk.main()
