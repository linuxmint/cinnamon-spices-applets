#!/usr/bin/env python
#by ikswss@gmail.com

from gi.repository import Gtk,Gdk
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
nome_sender = ""
stay = ""
titulo = ""
att = ""
w = ""
h = ""
def assignNewValueToW(w1):
    global w
    w = w1

def assignNewValueToH(h1):
    global h
    h = h1

def assignNewValueToAtt(at):
    global att
    att = at

def assignNewValueTotitulo(t):
    global titulo
    titulo = t

def assignNewValueToStay(s):
    global stay
    stay = s

def assignNewValueToIp(v):
    global ip_sender
    ip_sender = v

def assignNewValueToNome(n):
    global nome_sender
    nome_sender = n

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

def on_button_clicked2(self, event,data,column,treesortable):
        keyval = event.keyval
        name = Gdk.keyval_name(keyval)
        mod = Gtk.accelerator_get_label(keyval,event.state)        

        if mod == "Ctrl+Mod2+Return" or mod == "Ctrl+Mod2+Enter":
            if ip_sender:
                call(["python", path + "cliente.py",""+ data +"","" + ip_sender + "","" + nome_sender + "","" + stay + "","" + titulo + "","" + att + "" + "","" + str(w) + "" + "","" + str(h) + ""])            
                sys.exit(0)
            else:
                msgerror = "No select contact!\\nPlease select one contact!";                      
                command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
                os.system(command) 
   
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

def treeview_clicked(widget, event,select,data):
    if event.type == Gdk.EventType._2BUTTON_PRESS and event.button == 1:    
        if ip_sender:
            call(["python", path + "cliente.py",""+ data +"","" + ip_sender + "","" + nome_sender + "","" + stay + "","" + titulo + "","" + att + "" + "","" + str(w) + "" + "","" + str(h) + ""])            
            sys.exit(0)
        else:           
            msgerror = "No select contact!\\nPlease select one contact!";                      
            command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
            os.system(command)            

        return True
    if event.button == 1 and event.type == Gdk.EventType.BUTTON_PRESS:
         return False 

class MyWindow(Gtk.Window):
    def __init__(self, msg,stay,att,titulo="",w="",h=""):
        Gtk.Window.__init__(self, title="Contact List")
        self.set_default_size(250, 100)
        hb = Gtk.HeaderBar()
        hb.props.show_close_button = True
        hb.props.title = "Contact List"

        box2 = Gtk.VBox(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box2.get_style_context(), "linked")

        self.set_titlebar(hb)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_border_width(15)      
        self.set_icon_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png")  
        self.set_wmclass ("TurboNote Gnome", "TurboNote Gnome")            
        grid = Gtk.Grid()

        assignNewValueToAtt(att)
        assignNewValueTotitulo(titulo)
        assignNewValueToStay(stay)
        assignNewValueToH(h)
        assignNewValueToW(w)
        
        scroller = Gtk.ScrolledWindow(hexpand=True, vexpand=True)
        scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scroller.set_min_content_height(300)
        scroller.set_shadow_type(2)
        scroller.set_border_width(border_width=1)
        scroller.set_min_content_width(150)
        grid.attach(scroller, 0, 0, 4, 1) 
         
        view = Gtk.TreeView()

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

        view.set_search_column(0)
        col.set_sort_column_id(0)
        col2.set_sort_column_id(0)

        for i in range(len(lista_contatos)):
           self.listmodel.append(lista_contatos[i])
        
        self.selection = view.get_selection()
        view.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE)
        self.selection.connect("changed", self.on_changed)

        self.label = Gtk.Label()
        self.label.set_text(" ")

        self.labelb = Gtk.Label()
        self.labelb.set_text(" ")

        self.label2 = Gtk.Label()
        self.label2.set_text(" ")

        self.sendto = Gtk.Label()
        self.sendto.set_text("Send To ")

        self.labelNome = Gtk.Label()
        self.labelNome.set_text("")

        self.button_add = Gtk.Button()
        self.button_add.connect("clicked", self.add_cb)

        self.button_send = Gtk.Button()
        self.button_send.connect("clicked", self.send_turbo,msg)

        self.nometxt = Gtk.SearchEntry()
        self.nometxt.set_text("Name")

        self.nometxt.set_tooltip_text("Add contact name in entry [You can just press Enter in entry]")        

        self.button_remove = Gtk.Button()
        self.button_remove.connect("clicked", self.remove_cb)

        self.button_remove_all = Gtk.Button()
        self.button_remove_all.connect("clicked", self.remove_all_cb)

        self.add(grid)

        self.connect('key-press-event',on_button_clicked2,msg,col,self.listmodel)
        view.connect("button-press-event", treeview_clicked,self.selection,msg) 

        self.addcontact = Gtk.Image()  
        if config_note.getColorRevertTitle(): 
            self.addcontact.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_add_person" + config_note.getColorOver() + ".png")      
        else:
            self.addcontact.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_add_person" + config_note.getColor() + ".png")                  
        self.button_add.add(self.addcontact)

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

        self.sending = Gtk.Image()  
        self.sending.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_send_now" + config_note.getColor() + ".png")      
        self.button_send.add(self.sending) 

        
        grid.attach(self.label2, 0, 2, 4, 1)  
        grid.attach(self.sendto, 0, 3, 4, 1)
        grid.attach(self.labelNome, 0, 4, 4, 1)
        grid.attach(self.label, 0, 5, 4, 1)
     
        grid.attach(self.nometxt, 0, 6, 4, 1)
        grid.attach(self.labelb, 0, 7, 4, 1)

        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box.get_style_context(), "linked")           
        
        box.add(self.button_add)
        box.add(self.button_remove)
        box.add(self.button_remove_all)       
        
        self.button_add.set_tooltip_text("Add contact name in entry [You can just press Enter in entry]")
        self.button_remove.set_tooltip_text("Remove selected contacts")
        self.button_remove_all.set_tooltip_text("Remove all contacts")
        self.button_send.set_tooltip_text("Send [You can just press CTRL+Enter after the selected contact or double click in contact name]")

        hb.pack_start(box)

        grid.attach(self.button_send, 0, 8, 4, 1)
    

    def send_turbo(self, button,data):
        if ip_sender:
            call(["python", path + "cliente.py",""+ data +"","" + ip_sender + "","" + nome_sender + "","" + stay + "","" + titulo + "","" + att + "" + "","" + str(w) + "" + "","" + str(h) + ""])            
            sys.exit(0)
        else:
            msgerror = "No select contact!\\nPlease select one contact!";                      
            command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
            os.system(command)        
               
        #Gtk.main_quit()

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

        self.labelNome.set_markup("<b>" +  (nomes) + "</b>")
        assignNewValueToNome(nomes)
        assignNewValueToIp(ips)
        return True

    def add_cb(self, button):
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

#if __name__ == "__main__":
#    args = sys.argv[1:]
#    msg = args[:1]
#    win = MyWindow(msg)
#    win.connect("delete-event", Gtk.main_quit)
#    win.show_all()
#    Gtk.main()
    #sys.exit(exit_status)
