#!/usr/bin/env python
#by ikswss@gmail.com

from gi.repository import Gtk,Gdk,GdkPixbuf
import sys,os
import sqlite3
from subprocess import call
from config_note import Config
import threading

config_note = Config()
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"
path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"

lista_hist = []
lista_histfull = []
lista_contatos = []

connb = sqlite3.connect(path + 'turbo.db')
a = connb.cursor()
a.execute("SELECT nome FROM contacts order by nome asc")
rows =  a.fetchall()
lista_contatos.append("ALL")
for contacts in rows:
   lista_contatos.append(contacts[0])
connb.close()

def resp_cb(n, action,data):
    assert action == "resp"  
    try:        
        connb = sqlite3.connect(path + 'turbo.db')
        a = connb.cursor()
        a.execute("SELECT ip FROM contacts WHERE upper(nome) =  '" +  data[0] + "'" )
        try:
            ip_sender =  str(a.fetchone()[0])            
        except (RuntimeError, TypeError, NameError):
            pass
            ip_sender = ""

        connb.close()
        msgerror = "this contact does not exist!"
        if not ip_sender:
            command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
            os.system(command)        
        else:            
            call(["python", path + "caixa.py",""+ data[0] +"","" + str(ip_sender) + "","" + data[1] + ""," "])   
        #Gtk.main_quit()                     
    except ValueError:
        print("saindo de erro....")


def ignore_cb(n, action):
    assert action == "ignore"
    try:
        print("Notification closed")
        #Gtk.main_quit()
        n.close()
        #Gtk.main_quit()
    except ValueError:
        print("saindo de erro....")

def cap(s, l):
    return s if len(s)<=l else s[0:l-3]+'...'

ico_send = GdkPixbuf.Pixbuf.new_from_file_at_size(path_icon+"ic_action_send_now_b.png", 20, 20)
ico_receive = GdkPixbuf.Pixbuf.new_from_file_at_size(path_icon+"ic_action_repley_now_b.png", 20, 20)

connb = sqlite3.connect(path + 'turbo.db')
a = connb.cursor()
a.execute("SELECT id,nome,conteudo,data,tipo,ip FROM history order by id desc")
rows =  a.fetchall()
for history in rows:
    if history[4] == "S":
        lista_hist.append([str(history[0]),history[1],cap(history[2],50),history[3],ico_send,history[5]])
    else:
        lista_hist.append([str(history[0]),history[1],cap(history[2],50),history[3],ico_receive,history[5]])

connc = sqlite3.connect(path + 'turbo.db')
c = connc.cursor()
c.execute("SELECT id,nome,conteudo,data,tipo,ip FROM history order by id desc")
rowsc =  c.fetchall()
for history in rowsc:
    if history[4] == "S":
        lista_histfull.append([str(history[0]),history[1],history[2].encode("utf-8"),history[3],ico_send,history[5]])
    else:
        lista_histfull.append([str(history[0]),history[1],history[2].encode("utf-8"),history[3],ico_receive,history[5]])

connb.close()



def rmvhistory(idnote):
    connc = sqlite3.connect(path + 'turbo.db')
    c = connc.cursor()
    c.execute("delete from history where id = '"+ (idnote) + "'")
    connc.commit()
    connc.close()

def rmvhistoryall():
    connc = sqlite3.connect(path + 'turbo.db')
    c = connc.cursor()
    c.execute("delete from history")
    connc.commit()
    connc.close()    

def caixa(nome,conteudo,ip):
    call(["python", path + "caixa.py",""+ nome + "","" + ip + "","" + conteudo  + "",""," "," "," "])       

def treeview_clicked(widget, event,data):

    (model, iter) = data.get_selected_rows()
    iters = []
    
    for row in iter:
            iters.append(model.get_iter(row))

    if event.type == Gdk.EventType._2BUTTON_PRESS and event.button == 1:        
        for i in range(len(lista_histfull)):
            if lista_histfull[i][0] == model[iter][0]: 
                connb = sqlite3.connect(path + 'turbo.db')
                a = connb.cursor()
                a.execute("SELECT ip FROM contacts WHERE upper(nome) =  '" +  model[iter][1] + "'" )
                try:
                    ip_sender =  str(a.fetchone()[0])            
                except (RuntimeError, TypeError, NameError):
                    pass
                    ip_sender = ""

                connb.close()   
                t = threading.Thread(target=caixa,args=[model[iter][1],lista_histfull[i][2],ip_sender])
                t.start()                                       
                #call(["python", path + "caixa.py",""+ model[iter][1] + "","" + ip_sender + "","" + lista_histfull[i][2]   + "",""," "," "])                                  
        return True
    

    if event.button == 1 and event.type == Gdk.EventType.BUTTON_PRESS:
         return False 

def searching(self,entry,model):
    lista_hist[:] = []
    lista_histfull[:] = []


    connb = sqlite3.connect(path + 'turbo.db')
    a = connb.cursor()    
    a.execute("SELECT id,nome,conteudo,data,tipo,ip FROM history where conteudo like '%" + entry.get_text() + "%' order by id desc")
    rows =  a.fetchall()
    for history in rows:
        if history[4] == "S":
            lista_hist.append([str(history[0]),history[1],cap(history[2],200),history[3],ico_send,history[5]])
        else:
            lista_hist.append([str(history[0]),history[1],cap(history[2],200),history[3],ico_receive,history[5]])

    connc = sqlite3.connect(path + 'turbo.db')
    c = connc.cursor()
    c.execute("SELECT id,nome,conteudo,data,tipo,ip FROM history where conteudo like '%" + entry.get_text() + "%' order by id desc")
    rowsc =  c.fetchall()
    for history in rowsc:
        if history[4] == "S":
            lista_histfull.append([str(history[0]),history[1],history[2].encode("utf-8"),history[3],ico_send,history[5]])
        else:
            lista_histfull.append([str(history[0]),history[1],history[2].encode("utf-8"),history[3],ico_receive,history[5]])

    connb.close()

    if len(model) != 0:
        for i in range(len(model)):
            iter = model.get_iter(0)
            model.remove(iter)                

    for i in range(len(lista_hist)):
        model.append(lista_hist[i])



class MyWindow(Gtk.Window):
    def __init__(self):
        Gtk.Window.__init__(self, title="History Note List")
        self.set_default_size(1000, 500)            
        hb = Gtk.HeaderBar()
        hb.props.show_close_button = True
        hb.props.title = "History Note List"

        box2 = Gtk.VBox(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box2.get_style_context(), "linked")

        self.set_titlebar(hb)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_icon_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png")
        self.set_wmclass ("TurboNote Gnome", "TurboNote Gnome")
        grid = Gtk.Grid()
        self.set_border_width(15)
        scroller = Gtk.ScrolledWindow(hexpand=True, vexpand=True)
        scroller.set_shadow_type(2)
        scroller.set_border_width(border_width=1)
        scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        self.searchtxt = Gtk.SearchEntry() 
        self.label3 = Gtk.Label()
        self.label3.set_text(" ") 
        self.label4 = Gtk.Label()
        self.label4.set_text(" ") 
        self.searchtxt.set_tooltip_text("[press Enter to search]")
           
         
        treeview = Gtk.TreeView()
        treeview.set_enable_tree_lines(True)
        treeview.set_grid_lines(1)
        treeview.set_tooltip_text("[Double click to view note again]")

        cell  = Gtk.CellRendererText(weight=300)
        cell2 = Gtk.CellRendererText(weight=300)
        cell3 = Gtk.CellRendererText(weight=300)
        cell4 = Gtk.CellRendererText(weight=300)
        cell5 = Gtk.CellRendererPixbuf()
        cell6 = Gtk.CellRendererText(weight=50)

        cell.set_fixed_size(50, 5)
        cell2.set_fixed_size(200, -1)
        cell3.set_fixed_size(500, -1)
        cell4.set_fixed_size(150, -1)
        cell5.set_fixed_size(50, -1)
        cell6.set_fixed_size(50, -1)

        col  = Gtk.TreeViewColumn("ID",    cell, text=0)
        col2 = Gtk.TreeViewColumn("Name", cell2, text=1)
        col3 = Gtk.TreeViewColumn("Data", cell3, text=2)
        col4 = Gtk.TreeViewColumn("Date", cell4, text=3)
        col5 = Gtk.TreeViewColumn("R/S",cell5, pixbuf=4)
        col6 = Gtk.TreeViewColumn("IP", cell6, text=5)
        

        treeview.append_column(col)
        treeview.append_column(col2)
        treeview.append_column(col3)
        treeview.append_column(col4)
        treeview.append_column(col5)
        treeview.append_column(col6)

        cell.set_visible(False)
        col.set_visible(False)

        cell6.set_visible(False)
        col6.set_visible(False)


        col2.set_sort_column_id(0)
        col3.set_sort_column_id(0)
        col4.set_sort_column_id(0)
        col5.set_sort_column_id(0)

        scroller.add(treeview)
 
        self.model = Gtk.ListStore(str,str,str,str,GdkPixbuf.Pixbuf,str)             
        treeview.set_model(self.model)
        
        for i in range(len(lista_hist)):
            self.model.append(lista_hist[i])
 
        self.searchtxt.connect("activate", searching, self.searchtxt,self.model) 

        self.selection = treeview.get_selection()
        treeview.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE)
        treeview.connect("button-press-event", treeview_clicked,self.selection) 

        self.label = Gtk.Label()
        self.label.set_text(" ")

        self.button_remove = Gtk.Button()
        self.button_remove.connect("clicked", self.remove_cb)
        self.button_remove_all = Gtk.Button()
        self.button_remove_all.connect("clicked", self.remove_all_cb)

        self.nomeStore = Gtk.ListStore(str)

        for nomes in lista_contatos:            
            self.nomeStore.append([nomes])

        self.nomecombo = Gtk.ComboBox.new_with_model(self.nomeStore)
        renderer_text = Gtk.CellRendererText()
        self.nomecombo.pack_start(renderer_text, False)
        self.nomecombo.add_attribute(renderer_text, "text", 0)
        self.nomecombo.connect("changed", self.on_nome_combo_changed,self.model)
        self.nomecombo.set_wrap_width(7)        

        grid.attach(self.searchtxt, 0, 1, 3, 1)                
        grid.attach(self.label3, 0, 3, 3, 1) 
        grid.attach(scroller, 0, 4, 3, 1) 
        grid.attach(self.label4, 0, 5, 3, 1) 
        grid.attach(self.nomecombo, 0, 6, 3, 1) 


        self.nomecombo.set_active(0)       

        self.removeimg = Gtk.Image()  
        if config_note.getColorRevertTitle():
            self.removeimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_storage" + config_note.getColorOver() + ".png")      
        else:
            self.removeimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_storage" + config_note.getColor() + ".png")      
        self.button_remove.add(self.removeimg)  

        self.removeallimg = Gtk.Image()  
        if config_note.getColorRevertTitle():
            self.removeallimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_storage_all" + config_note.getColorOver() + ".png")        
        else:               
            self.removeallimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_storage_all" + config_note.getColor() + ".png")        
        self.button_remove_all.add(self.removeallimg)

        self.responderbt = Gtk.Button()      

        self.sending = Gtk.Image()  
        if config_note.getColorRevertTitle():
            self.sending.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_send_now_all" + config_note.getColorOver() + ".png")        
        else:
            self.sending.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_send_now_all" + config_note.getColor() + ".png")        

        self.responderbt.add(self.sending)

        self.responderbt.connect("clicked", self.resend)        
        self.responderbt.set_tooltip_text("Resend  [You can just press double click in message row]")
       
        self.add(grid)   
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box.get_style_context(), "linked")           
        
        box.add(self.button_remove)
        box.add(self.button_remove_all)
        box.add(self.responderbt)
        hb.pack_start(box)

        self.button_remove.set_tooltip_text("Remove selected")
        self.button_remove_all.set_tooltip_text("Remove all")

    def on_nome_combo_changed(self, combo,model):
        nome = ""
        tree_iter = combo.get_active_iter()
        if tree_iter != None:
            model1 = combo.get_model()
            nome = model1[tree_iter][0]

        lista_hist[:] = []
        lista_histfull[:] = []


        connb = sqlite3.connect(path + 'turbo.db')
        a = connb.cursor()   
        if nome == "ALL": 
            a.execute("SELECT id,nome,conteudo,data,tipo,ip FROM history order by id desc")
        else:
            a.execute("SELECT id,nome,conteudo,data,tipo,ip FROM history where nome = '" + nome + "' order by id desc")            
        rows =  a.fetchall()
        for history in rows:
            if history[4] == "S":
                lista_hist.append([str(history[0]),history[1],cap(history[2],200),history[3],ico_send,history[5]])
            else:
                lista_hist.append([str(history[0]),history[1],cap(history[2],200),history[3],ico_receive,history[5]])

        connc = sqlite3.connect(path + 'turbo.db')
        c = connc.cursor()
        if nome == "ALL": 
            c.execute("SELECT id,nome,conteudo,data,tipo,ip FROM history order by id desc")
        else:
            c.execute("SELECT id,nome,conteudo,data,tipo,ip FROM history where nome = '" + nome + "' order by id desc")            
        rows =  a.fetchall()
        rowsc =  c.fetchall()
        for history in rowsc:
            if history[4] == "S":
                lista_histfull.append([str(history[0]),history[1],history[2].encode("utf-8"),history[3],ico_send,history[5]])
            else:
                lista_histfull.append([str(history[0]),history[1],history[2].encode("utf-8"),history[3],ico_receive,history[5]])

        connb.close()

        if len(model) != 0:
            for i in range(len(model)):
                iter = model.get_iter(0)
                model.remove(iter)                

        for i in range(len(lista_hist)):
            model.append(lista_hist[i])

            
    
    def resend(self, button):
        if len(self.model) != 0:
            (self.model, iter) = self.selection.get_selected_rows()
            iters = []

            for row in iter:                
                iters.append(self.model.get_iter(row))              
                
            if len(iters) != 0:
                for i in range(len(iters)):                     
                  call(["python", path + "cliente.py",""+ (self.model[iters[i]][2]) +"","" + (self.model[iters[i]][5]) + "","" + (self.model[iters[i]][1]) + "","" + 'TRUE' + "","" + '' + "","" + '' + "","" + '' + "","" + '' + ""])            
            else:
                msgerror = "No select Note!\\nPlease select one Note to resend!";                      
                command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
                os.system(command)        
        else:
            msgerror = "Empty list!\\nYou don't have Notes to resend!";                      
            command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
            os.system(command)

    def remove_cb(self, button):
        if len(self.model) != 0:
            (self.model, iter) = self.selection.get_selected_rows()
            iters = []

            for row in iter:                
                iters.append(self.model.get_iter(row))              
                
            if len(iters) != 0:
                for i in range(len(iters)):                                     
                    rmvhistory(self.model[iters[i]][0])
                    self.model.remove(iters[i])   
            else:
                msgerror = "No select Note!\\nPlease select one Note to remove!";                      
                command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
                os.system(command)        
        else:
            msgerror = "Empty list!\\nYou don't have Notes to remove!";                      
            command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
            os.system(command)        

    def remove_all_cb(self, button):
        if len(self.model) != 0:
            for i in range(len(self.model)):
                iter = self.model.get_iter(0)
                self.model.remove(iter)
                rmvhistoryall()

        msgerror = "Empty list!\\nAll Notes removed!";                      
        command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
        os.system(command)        


if __name__ == "__main__":
    win = MyWindow()
    win.connect("delete-event", Gtk.main_quit)
    win.show_all()
    Gtk.main()
