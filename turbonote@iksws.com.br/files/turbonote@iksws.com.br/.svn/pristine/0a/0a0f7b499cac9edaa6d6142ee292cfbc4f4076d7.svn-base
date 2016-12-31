#!/usr/bin/env python
#by ikswss@gmail.com
from gi.repository import Gtk,Gdk
import re
import time
import os
import cStringIO
import sys
from subprocess import call
import threading
from config_note import Config
from list_control import MyWindow

#call config class for get parameters
config_note = Config()
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"

#defini variables
attpick = True
attFile = ""
stay = ""
link = ""
tipo = ""
#get and setters
def assignNewValueToStay(s):
    global stay
    stay = s

def assignNewValueToAttFile(f):
    global attFile
    attFile = f

def assignNewValueToAttPick(p):
    global attpick
    attpick = p

def assignNewValueToLink(l):
    global link
    link = l

def assignNewValueToTipo(t):
    global tipo
    tipo = t

def assignNewValueToMsg(m):
    global new_msg
    new_msg = m

class HeaderBarWindow(Gtk.Window):
    def __init__(self,titulo,ip,msg_rec,nome,tipo,link,new_msg):
        Gtk.Window.__init__(self, title = "From " + titulo)
        self.set_icon_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png")	
        self.set_border_width(15)
        if(new_msg != "N"):
       		self.set_default_size(500, 350)
       	else:
       		self.set_default_size(500, 0)
       	self.move(0,0)
        hb = Gtk.HeaderBar()
        hb.props.show_close_button = True
        hb.props.title = title = "From " + titulo

        assignNewValueToLink(link)
        assignNewValueToTipo(tipo)
        assignNewValueToMsg(new_msg)

        box2 = Gtk.VBox(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box2.get_style_context(), "linked")

        self.set_titlebar(hb)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.grid = Gtk.Grid()
         
        self.create_textview(box2,hb)
        self.set_wmclass ("TurboNote Gnome", "TurboNote Gnome")
        self.connect('key-press-event',on_button_clicked2,nome)

    def msg_show(self,event,bt,box,attbtrmv):
    	self.resize(500, 350)
    	self.add(self.grid)  
    	box.add(self.toggle_stay)    	
    	self.show_all()
    	attbtrmv.hide();
    	bt.hide()

    def attaches_cb(self,event,data):
		try:
			call(["eog", data])
		except ValueError:
			print("saindo de erro....")

    def attaches_cb2(self,event,data):
		try:
			call(["gnome-open", data])
		except ValueError:
			print("saindo de erro....")

    def on_button_ss(self, widget):
		os.system("gnome-screenshot -i -a")

    def on_button_clicked(self, widget,nome):
		buf  = self.textview.get_buffer()
		text = buf.get_text(buf.get_start_iter(),buf.get_end_iter(),True)		
		s = threading.Thread(target=send_turbo ,args=(text,ip,nome,str(self.get_size()[0]),str(self.get_size()[1])))
		s.start()
		Gtk.main_quit()

    def on_button_contact(self,button):
		buf  = self.textview.get_buffer()
		text = buf.get_text(buf.get_start_iter(),buf.get_end_iter(),True)
		win = MyWindow(text.decode('utf-8').encode('windows-1252'),stay,attFile,str(self.get_size()[0]),str(self.get_size()[1]))
		win.connect("delete-event", Gtk.main_quit)
		win.show_all()
		Gtk.main()

    def on_file_clicked(self, widget):
		if attpick:
			self.grid.attach(self.label3, 0, 4, 4, 1)			
			self.grid.attach(self.labelattached, 0, 3, 4, 1)
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

    def toggle_stay_callback(self, button):
	    if self.toggle_stay.get_active():
	        assignNewValueToStay("Yes")
	    else:
	        assignNewValueToStay("")

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
		self.grid.attach(scrolledwindow, 0, 1, 1, 1)

		self.textview = Gtk.TextView()
		self.textview.set_wrap_mode(Gtk.WrapMode.WORD)
		self.textview.set_border_width(10)
		self.textbuffer = self.textview.get_buffer()
		self.textbuffer.set_text("")
		scrolledwindow.add(self.textview) 

		msglinux = msg_rec.replace("\\n","&N&")
		
		msgsplitlinux = msglinux.split('&N&')
		msg_unicode = ""

		box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
		Gtk.StyleContext.add_class(box.get_style_context(), "linked")	

		for i in range(len(msgsplitlinux)):                           
			msg_unicode = msg_unicode+ (msgsplitlinux[i].replace("\\r"," ") + "\n")

		self.textbuffer.set_text(msg_unicode)
		scrolledwindow.add(self.textview) 

		self.attachedbt = Gtk.Button()
		self.attachedbtrmv = Gtk.Button() 

		self.label = Gtk.Label()
		self.label.set_text(" ")

		self.label3 = Gtk.Label()
		self.label3.set_text(" ") 

		self.labelattached = Gtk.Label()
		self.labelattached.set_text("") 


		self.toggle_stay = Gtk.ToggleButton()
		self.toggle_stay.connect("toggled", self.toggle_stay_callback)

		self.att1 = Gtk.Button()
		self.att1.connect("clicked", self.attaches_cb,link)	

		self.msg = Gtk.Button()
		self.msg.connect("clicked", self.msg_show,self.msg,box,self.attachedbtrmv)	

		self.att2 = Gtk.Button()
		self.att2.connect("clicked", self.attaches_cb2,link)	

		responderbt = Gtk.Button()
		
		responderbt.connect("clicked", self.on_button_clicked,nome)

		sendcontact = Gtk.Button()
		sendcontact.connect("clicked", self.on_button_contact)


		scshot = Gtk.Button()	
		scshot.set_tooltip_text("Crop Picture")

		scshot.connect("clicked", self.on_button_ss)



		self.icomsg = Gtk.Image()	
		if config_note.getColorRevertTitle():
			self.icomsg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_email_all" + config_note.getColorOver() + ".png")		
		else:
			self.icomsg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_email_all" + config_note.getColor() + ".png")		

		self.msg.add(self.icomsg)


		self.att1ico = Gtk.Image()	
		if config_note.getColorRevertTitle():
			self.att1ico.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_picture_all" + config_note.getColorOver() + ".png")		
		else:
			self.att1ico.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_picture_all" + config_note.getColor() + ".png")		

		self.att1.add(self.att1ico)

		self.att2ico = Gtk.Image()	
		if config_note.getColorRevertTitle():
			self.att2ico.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_attachment_all" + config_note.getColorOver() + ".png")	
		else:
			self.att2ico.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_attachment_all" + config_note.getColor() + ".png")	

		self.att2.add(self.att2ico)

		self.photo = Gtk.Image()	
		self.photo.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_camera" + config_note.getColor() + ".png")		
		scshot.add(self.photo)

		self.staytop = Gtk.Image()	
		if config_note.getColorRevertTitle():
			self.staytop.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_cast" + config_note.getColorOver() + ".png")		
		else:
			self.staytop.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_cast" + config_note.getColor() + ".png")		
		self.toggle_stay.add(self.staytop)	

		self.sending = Gtk.Image()	
		self.sending.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_send_now" + config_note.getColor() + ".png")		
		sendcontact.add(self.sending)
	
		self.replyico = Gtk.Image()	
		self.replyico.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_repley_now" + config_note.getColor() + ".png")		
		responderbt.add(self.replyico)

		self.addattimg = Gtk.Image()	
		self.addattimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_new_attachment" + config_note.getColor() + ".png")		
		self.attachedbt.add(self.addattimg)

		self.addattimgrmv = Gtk.Image()	
		self.addattimgrmv.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_remove_attached" + config_note.getColor() + ".png")		
		self.attachedbtrmv.add(self.addattimgrmv)	

		self.attachedbt.connect("clicked", self.on_file_clicked)		
		self.attachedbtrmv.connect("clicked", self.on_file_clicked_rmv)	

		self.grid.attach(self.label, 0, 2, 4, 1)		

		if(tipo == "img"):
			box.add(self.att1)

		if(tipo == "att"):
			box.add(self.att2)

		if (new_msg == "N"):
			box.add(self.msg)
		else:
			box.add(self.toggle_stay)
			self.add(self.grid)

		hb.pack_start(box)

		self.attachedbtrmv.set_tooltip_text("Remove attachment")
		sendcontact.set_tooltip_text("Send [You can just press CTRL+Enter]")
		responderbt.set_tooltip_text("Reply to sender [You can just press CTRL+R]")
		self.attachedbt.set_tooltip_text("Attach file or image")
		self.toggle_stay.set_tooltip_text("Stay on Top")

		self.att1.set_tooltip_text("Received Img")
		self.att2.set_tooltip_text("Received File")

		box2.add(scshot)
		box2.add(responderbt)
		box2.add(sendcontact)
		box2.add(self.attachedbt)	
		box2.add(self.attachedbtrmv)

		scrolledwindow2 = Gtk.ScrolledWindow()
		scrolledwindow2.set_hexpand(True)
		scrolledwindow2.set_vexpand(True)
		scrolledwindow2.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
		self.grid.attach(box2, 0, 5, 1, 1)		

def on_button_clicked2(self, event,nome):
	keyval = event.keyval
	name = Gdk.keyval_name(keyval)
	mod = Gtk.accelerator_get_label(keyval,event.state)

	if mod == "Ctrl+Mod2+Return" or mod == "Ctrl+Mod2+Enter":
		buf  = self.textview.get_buffer()
		text = buf.get_text(buf.get_start_iter(),buf.get_end_iter(),True)
		win = MyWindow(text.decode('utf-8').encode('windows-1252'),stay,attFile,str(self.get_size()[0]),str(self.get_size()[1]))
		win.connect("delete-event", Gtk.main_quit)
		win.show_all()
		Gtk.main()
	if mod == "Ctrl+Mod2+R":
		buf  = self.textview.get_buffer()
		text = buf.get_text(buf.get_start_iter(),buf.get_end_iter(),True)
		s = threading.Thread(target=send_turbo ,args=(text,ip,nome,str(self.get_size()[0]),str(self.get_size()[1])))
		s.start()
		Gtk.main_quit() 


def send_turbo(message,ip,nome,w,h):  
	#fix windows
	message.replace("\\","\\\\");
	call(["python", path + "cliente.py",""+ message.decode('utf-8').encode('windows-1252') + "","" + ip + "","" + nome + "","" + stay + "","" + "" + "", "" + attFile + "" + "","" + str(w) + "" + "","" + str(h) + ""])        

if __name__ == "__main__":
	args = sys.argv[1:]
	ip = args[1]
	nome = args[:1]
	nome = str(nome)[:-2][2:]	
	nome = nome.decode('iso-8859-1').encode('utf8')	
	msg_rec = args[2]	
	tipo = args[4]	
	img_link = args[5]
	new_msg = args[6]

	win = HeaderBarWindow(nome,ip,msg_rec,nome,tipo,img_link,new_msg)
	win.connect("delete-event", Gtk.main_quit)
	win.show_all()
	Gtk.main()
