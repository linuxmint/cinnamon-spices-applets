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
import sqlite3

config_note = Config()
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"
path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"
stay = ""

connb = sqlite3.connect(path + 'turbo.db')
a = connb.cursor()
a.execute("SELECT ping,protocolo,color,color_revert,multithread FROM config")
data =  a.fetchone()

ping = data[0]
protocolo  = data[1]
color = data[2]
color_revert = data[3]
multithread = data[4]

connb.close()


class HeaderBarWindow(Gtk.Window):

    def __init__(self):
        Gtk.Window.__init__(self, title = "Basic Configuration")
        self.set_icon_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png")	
        self.set_border_width(15)
       	self.set_default_size(480, 350)

        hb = Gtk.HeaderBar()
        hb.props.show_close_button = True
        hb.props.title = "Basic Configuration"

        box2 = Gtk.VBox(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box2.get_style_context(), "linked")

        self.set_titlebar(hb)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.grid = Gtk.Grid()
        self.add(self.grid)        
        self.create_textview(box2,hb)
        self.set_wmclass ("TurboNote Gnome", "TurboNote Gnome")
    
    def on_save(self, widget,a1,a2,a3,a4,a5):
		v1 = a1.get_text()
		v2 = a2.get_text()
		v3 = ""
		v4 = False
		v5 = False

		if a3.get_active():
			v3 = "_b";

		if a4.get_active():
			v4 = True;

		if a5.get_active():
			v5 = True;

		update = sqlite3.connect(path + 'turbo.db')
		c = update.cursor()
		c.execute("UPDATE config set protocolo = '" +str(v1)+ "', ping = '" +str(v2)+ "', color = '" +str(v3)+"', color_revert = '"+str(v4)+"', multithread = '"+str(v5)+"';");
		update.commit()
		update.close()

		msgerror = "Changed!\\nSuccessfully saved configuration!";                      
		command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
		os.system(command) 

    def create_textview(self,box2,hb):

		self.textview = Gtk.Entry()
		self.textview.set_text(protocolo)

		self.pingview = Gtk.Entry()
		self.pingview.set_text(ping)

		self.label1 = Gtk.Label()
		self.label1.set_text("Aditional Configuration") 

		self.label2 = Gtk.Label()
		self.label2.set_text("Black Icons") 

		self.label3 = Gtk.Label()
		self.label3.set_text("Reverte title black icons") 

		self.label4 = Gtk.Label()
		self.label4.set_text("Multithread Note")

		self.label5 = Gtk.Label()
		self.label5.set_text("IP/DNS for ping")

		self.label6 = Gtk.Label()
		self.label6.set_text(" ")
		
		save = Gtk.Button()	
		save.set_tooltip_text("Save Configuration")		
		
		self.switch1 = Gtk.Switch()	
		if color == "_b":	
			self.switch1.set_active(True)
		else:
			self.switch1.set_active(False)
		#switch.connect("notify::active", self.on_switch_activated)

		self.switch2 = Gtk.Switch()	
		if color_revert == "True":	
			self.switch2.set_active(True)
		else:
			self.switch2.set_active(False)

		self.switch3 = Gtk.Switch()	
		if multithread  == "True":	
			self.switch3.set_active(True)
		else:
			self.switch3.set_active(False)

		self.saveimg = Gtk.Image()  
		self.saveimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_save" + config_note.getColor() + ".png")     
		save.add(self.saveimg)
		
		box2.add(save)	

		save.connect("clicked", self.on_save,self.textview,self.pingview,self.switch1,self.switch2,self.switch3)	

		self.grid.attach(self.label1,   0, 0 , 1, 1)
		self.grid.attach(self.textview, 0, 1 , 1, 1)
		self.grid.attach(self.label5,   0, 2 , 1, 1)
		self.grid.attach(self.pingview, 0, 3 , 1, 1)		
		self.grid.attach(self.label2,   0, 4 , 1, 1)
		self.grid.attach(self.switch1,  0, 5 , 1, 1)
		self.grid.attach(self.label3,   0, 6 , 1, 1)
		self.grid.attach(self.switch2,  0, 7 , 1, 1)
		self.grid.attach(self.label4,   0, 8 , 1, 1)
		self.grid.attach(self.switch3,  0, 9 , 1, 1)
		self.grid.attach(self.label6,   0, 10, 1, 1)
		self.grid.attach(box2,			0, 11, 1, 1)	

		box2.set_hexpand(True)	

win = HeaderBarWindow()
win.connect("delete-event", Gtk.main_quit)
win.show_all()
Gtk.main()
