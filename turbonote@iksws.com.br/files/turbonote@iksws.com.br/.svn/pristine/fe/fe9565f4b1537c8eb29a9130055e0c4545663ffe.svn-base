#!/usr/bin/env python
#by ikswss@gmail.com

from gi.repository import Gtk,Gdk
from gi.repository import Pango
import sys,os
import sqlite3
from subprocess import call
from config_note import Config
import socket

config_note = Config()
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"
path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"
path_attached = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/attacheds/"

lista_contatos = []

connb = sqlite3.connect(path + 'turbo.db')
a = connb.cursor()
a.execute("SELECT nome,ip FROM contacts order by nome asc")
rows =  a.fetchall()
for contacts in rows:
   lista_contatos.append([contacts[0],contacts[1]])
connb.close()

ip_sender = ""

def assignNewValueToIp(v):
    global ip_sender
    ip_sender = v

def addcontacts(contactnome,addressip):
    connc = sqlite3.connect(path + 'turbo.db')
    c = connc.cursor()
    c.execute("INSERT INTO contacts (nome,ip) VALUES (?,?)",(contactnome.upper(),addressip))
    connc.commit()
    connc.close()
    command = "mkdir " + path_attached + contactnome.upper()
    os.system(command)   

def rmvcontacts(contactnome,addressip):
    connc = sqlite3.connect(path + 'turbo.db')
    c = connc.cursor()
    c.execute("delete from contacts where nome = ? and ip = ?",(contactnome,addressip))
    connc.commit()
    connc.close()
    command = "rm -rf " + path_attached + contactnome.upper()
    os.system(command)

def rmvcontactsall():
    connc = sqlite3.connect(path + 'turbo.db')
    c = connc.cursor()
    c.execute("delete from contacts")
    connc.commit()
    connc.close()
    command = "rm -rf " + path_attached + "*"
    os.system(command)

def on_button_clicked2(self, event,column,treesortable):
        keyval = event.keyval
        name = Gdk.keyval_name(keyval)
        mod = Gtk.accelerator_get_label(keyval,event.state)        

        if mod == "Mod2+Enter" or mod == "Mod2+Return":             
            nome = self.nometxt.get_text()    
            connb = sqlite3.connect(path + 'turbo.db')
            a = connb.cursor()
            a.execute("SELECT nome FROM contacts WHERE upper(nome) = upper('" + nome + "')")
            contactsName =  a.fetchone()
            connb.close()
            if not contactsName:
                try:                          
                    IP = socket.gethostbyname(nome)
                    addcontacts(nome,IP)
                    self.listmodel.append([nome.upper(),IP])
                    treesortable.set_sort_column_id(1, Gtk.SortType.ASCENDING)
                except socket.gaierror, err:    
                        msgerror = "I can't ping this host name!\\nPlease chech the host name and try again!";                      
                        command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
                        os.system(command)                          
            else:     
                msgerror = "This contact already exists!\\nPlease chech the host name and try again!";                    
                command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
                os.system(command)

class MyWindow(Gtk.Window):
    def __init__(self):
        Gtk.Window.__init__(self, title="Contact List")
        self.set_default_size(250, 100)
        self.set_border_width(15)      
        hb = Gtk.HeaderBar()
        hb.props.show_close_button = True
        hb.props.title = "Contact List"

        box2 = Gtk.VBox(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box2.get_style_context(), "linked")

        self.set_titlebar(hb)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_icon_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png") 
        self.set_wmclass ("TurboNote Gnome", "TurboNote Gnome")
        grid = Gtk.Grid()

        scroller = Gtk.ScrolledWindow(hexpand=True, vexpand=True)
        scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scroller.set_min_content_height(300)
        scroller.set_shadow_type(2)
        scroller.set_border_width(border_width=1)
        scroller.set_min_content_width(150)
        grid.attach(scroller, 0, 0, 3, 1) 
         
        view = Gtk.TreeView()
        view.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE)
        cell  = Gtk.CellRendererText(weight=300)
        cell2 = Gtk.CellRendererText(weight=300)

        cell.set_fixed_size(200, -1)
        cell2.set_fixed_size(200, -1)

        col = Gtk.TreeViewColumn("Name", cell, text=0)
        col2 = Gtk.TreeViewColumn("IP Adress", cell2, text=1)

        view.append_column(col)
        view.append_column(col2)
        
        scroller.add(view)
        self.listmodel = Gtk.ListStore(str,str)       

        view.set_model(self.listmodel)

        for i in range(len(lista_contatos)):
           self.listmodel.append(lista_contatos[i])
        
        self.selection = view.get_selection()
        self.selection.connect("changed", self.on_changed)

        self.button_add = Gtk.Button()
        self.button_add.connect("clicked", self.add_cb,col,self.listmodel)        

        self.label = Gtk.Label()
        self.label.set_text(" ")

        self.label2 = Gtk.Label()
        self.label2.set_text(" ")

        view.set_search_column(0)
        col.set_sort_column_id(0)
        col2.set_sort_column_id(0)


        self.nometxt = Gtk.SearchEntry()
        self.nometxt.set_tooltip_text("Add contact name in entry [You can just press Enter in entry]")     
        self.nometxt.set_text("Name")  


        self.label3 = Gtk.Label()
        self.label3.set_text(" ")   

        self.nomeAvul = Gtk.Entry()
        self.nomeAvul.set_tooltip_text("Add contact name in entry")     
        self.nomeAvul.set_text("Name")    

        self.ipAvul = Gtk.Entry()
        self.ipAvul.set_tooltip_text("Add ip in entry")     
        self.ipAvul.set_text("IP Adress")  

        self.button_add2 = Gtk.Button()
        self.button_add2.connect("clicked", self.add_cb_avul,self.nomeAvul,self.ipAvul,self.listmodel) 

        self.button_remove = Gtk.Button()
        self.button_remove.connect("clicked", self.remove_cb)

        self.button_remove_all = Gtk.Button()
        self.button_remove_all.connect("clicked", self.remove_all_cb)

        self.add(grid)

        self.connect('key-press-event',on_button_clicked2,col,self.listmodel)

        self.addcontact = Gtk.Image()  
        if config_note.getColorRevertTitle():
            self.addcontact.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_add_person" + config_note.getColorOver() + ".png")      
        else:
            self.addcontact.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_add_person" + config_note.getColor() + ".png")      
        self.button_add.add(self.addcontact)

        self.addcontact2 = Gtk.Image()  
        self.addcontact2.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_add_person" + config_note.getColor() + ".png")      
        self.button_add2.add(self.addcontact2)

        self.rmvcontact = Gtk.Image()  
        if config_note.getColorRevertTitle():
            self.rmvcontact.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_rmv_person" + config_note.getColorOver() + ".png")      
        else:
            self.rmvcontact.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_rmv_person" + config_note.getColor() + ".png")  
        self.button_remove.add(self.rmvcontact)  

        self.rmvall = Gtk.Image()  
        if config_note.getColorRevertTitle():
            self.rmvall.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_rmv_group" + config_note.getColorOver() + ".png")      
        else:
            self.rmvall.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_rmv_group" + config_note.getColor() + ".png")      
        self.button_remove_all.add(self.rmvall) 

        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box.get_style_context(), "linked")           
        
        box.add(self.button_add)
        box.add(self.button_remove)
        box.add(self.button_remove_all)    

        hb.pack_start(box)

        self.button_add.set_tooltip_text("Add contact name in entry [You can just press Enter in entry]")
        self.button_remove.set_tooltip_text("Remove selected contacts")
        self.button_remove_all.set_tooltip_text("Remove all contacts")        

        grid.attach(self.label, 0, 2, 3, 1)        
        grid.attach(self.nometxt, 0, 3, 3, 1)

        box3 = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box3.get_style_context(), "linked")   

        grid.attach(self.label3, 0, 4, 3, 1)  
        grid2 = Gtk.Grid()
        grid2.attach(self.nomeAvul, 0, 0, 1, 1)  
        grid2.attach(self.ipAvul, 0, 1, 1, 1)  
        grid2.attach(self.button_add2, 0, 2, 1, 1) 

        scroller2 = Gtk.ScrolledWindow(hexpand=True, vexpand=True)
        scroller2.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        grid2.attach(scroller2, 0, 2, 1, 1)      

        self.exp = Gtk.Expander()
      	self.exp.set_label("Add contact loose")      	
      	self.exp.set_resize_toplevel(True)
      	self.exp.add(grid2)  

      	grid.attach(self.exp, 0, 9, 3, 1)
        

        
    def on_changed(self, selection):
        (model, iter) = selection.get_selected_rows()
        iters = []
        for row in iter:
            iters.append(model.get_iter(row))

        nomes = ""
        ips = ""
        for i in range(len(iters)):      
                           
            if i == 0:
                nomes = model[iters[i]][0] 
                ips   = model[iters[i]][1] 
            else:    
                if i == (len(iters)-1):
                    nomes = nomes +  (" and " + str(model[iters[i]][0]))
                    ips = ips +  ("," + str(model[iters[i]][1]))
                else:           
                    nomes = nomes +  ("," + str(model[iters[i]][0]))
                    ips = ips +  ("," + str(model[iters[i]][1]))

        assignNewValueToIp(ips)
        return True
      
    def add_cb_avul(self, button,name,ip_adress,treesortable):
    	contato = name.get_text()
    	ip = ip_adress.get_text()
    	try:
	    	connc = sqlite3.connect(path + 'turbo.db')
	        c = connc.cursor()
	        c.execute("INSERT INTO contacts (nome,ip) VALUES (?,?)",(contato.upper(),ip))
	        connc.commit()
	        connc.close()
	        self.listmodel.append([contato.upper(),ip])
	        treesortable.set_sort_column_id(1, Gtk.SortType.ASCENDING)
	        name.set_text("")
	        ip_adress.set_text("")
        except socket.gaierror, err:    
            msgerror = "I can't ping this host name!\\nPlease chech the host name and try again!";                      
            command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
            os.system(command)


    def add_cb(self, button,column,treesortable):
        nome = self.nometxt.get_text()
        connb = sqlite3.connect(path + 'turbo.db')
        a = connb.cursor()
        a.execute("SELECT nome FROM contacts WHERE upper(nome) = upper('" + nome + "')")
        contactsName =  a.fetchone()
        connb.close()
        if not contactsName:
            if nome != "nome":
                try:
                    IP = socket.gethostbyname(nome)
                    connc = sqlite3.connect(path + 'turbo.db')
                    c = connc.cursor()
                    c.execute("INSERT INTO contacts (nome,ip) VALUES (?,?)",(nome.upper(),IP))
                    connc.commit()
                    connc.close()
                    command = "mkdir " + path_attached + nome.upper()
                    os.system(command)
                    self.listmodel.append([nome.upper(),IP])     
                    treesortable.set_sort_column_id(1, Gtk.SortType.ASCENDING)          
                except socket.gaierror, err:    
                    msgerror = "I can't ping this host name!\\nPlease chech the host name and try again!";                      
                    command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
                    os.system(command)            
            else:
                msgerror = "No data Found!\\nPlease i need contact name and ip adress for save contact!";                      
                command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
                os.system(command)    
        else:
            msgerror = "This contact already exists!\\nPlease chech the host name and try again!";                      
            command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
            os.system(command)                   
    
    def remove_cb(self, button):
        if len(self.listmodel) != 0:
            (model, iter) = self.selection.get_selected_rows()
            iters = []
        
            for row in iter:
                iters.append(model.get_iter(row))
                
            if len(iters) != 0:
                for i in range(len(iters)):      
                    rmvcontacts(model[iters[i]][0],model[iters[i]][1])
                    self.listmodel.remove(iters[i])                
            else:
                msgerror = "No select contact!\\nPlease select one contact to remove!";                      
                command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
                os.system(command)    
        else:
            msgerror = "Empty list!\\nYou don't have contacts to remove!";                      
            command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
            os.system(command)    

    def remove_all_cb(self, button):
        if len(self.listmodel) != 0:
            for i in range(len(self.listmodel)):
                iter = self.listmodel.get_iter(0)
                self.listmodel.remove(iter)
                rmvcontactsall()
        msgerror = "Empty list!\\nAll contacts removed!";                      
        command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
        os.system(command)    


if __name__ == "__main__":
    win = MyWindow()
    win.connect("delete-event", Gtk.main_quit)
    win.show_all()
    Gtk.main()
    #sys.exit(exit_status)

