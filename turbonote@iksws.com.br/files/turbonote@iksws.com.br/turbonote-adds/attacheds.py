#!/usr/bin/env python
#by ikswss@gmail.com

from gi.repository import Gtk,Gdk
import sys,os
import sqlite3
from subprocess import call
from config_note import Config
from gi.repository import GdkPixbuf

config_note = Config()
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"
path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"
path_attached = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/attacheds/"

lista_anexos = [] 
lista_nome = os.listdir(path_attached)

pageCounter = 1

def setPageCounter(p):
    global pageCounter
    pageCounter = p

def stringToDate(dt):
    data  = dt[:-12] + "/" + dt[2:-10] + "/" + dt[4:-6] + " "  + dt[8:-4] + ":"  + dt[10:-2] + ":"  + dt[12:]
    return data

for l in range(len(lista_nome)):
    lista_dir = os.listdir(path_attached+lista_nome[l] + "/")
    if lista_dir:
        for d in range(len(lista_dir)):
            lista_dir_files = os.listdir(path_attached+lista_nome[l] + "/" + lista_dir[d] + "/")
            if lista_dir_files:
                files = ""
                for f in range(len(lista_dir_files)):
                    if f == 0:    
                        #if(lista_dir_files[f].split(".")[1] == 'wmf'):
                        #    command1 = "cd  " +  path_attached+lista_nome[l] + "/" + lista_dir[d] + "/; convert " +  lista_dir_files[f] + " " + lista_dir_files[f][:-4]+".png"                            
                        #    os.system(command1)     
                        #    command2 = "cd  " +  path_attached+lista_nome[l] + "/" + lista_dir[d] + "/; rm -f " +  lista_dir_files[f]
                        #    os.system(command2)  
                        #    files =  lista_dir_files[f][:-4]+".png"
                        #else:
                        files = (lista_dir_files[f])
                    else:
                        #if(lista_dir_files[f].split(".")[1] == 'wmf'):
                        #    print "oi"
                        #    command1 = "cd  " +  path_attached+lista_nome[l] + "/" + lista_dir[d] + "/; convert " +  lista_dir_files[f] + " " + lista_dir_files[f][:-4]+".png"                            
                        #    os.system(command1)     
                        #    command2 = "cd  " +  path_attached+lista_nome[l] + "/" + lista_dir[d] + "/; rm -f " +  lista_dir_files[f]
                        #    os.system(command2)                              
                        #    files = files + (" | " +  lista_dir_files[f][:-4]+".png" )
                        #else:
                        files = files + (" | " + lista_dir_files[f])
                lista_anexos.append([lista_nome[l],stringToDate(lista_dir[d]),files])



def rmvattached(contactnome,folderName): 
    folderfile  = folderName.replace("/","").replace(":","").replace(" ","")
    command = "rm -rf " + path_attached + contactnome.upper() + "/" + folderfile
    os.system(command)

def rmvattachedssall():   
    for l in range(len(lista_nome)):
        lista_dir = os.listdir(path_attached+lista_nome[l] + "/")
        if lista_dir:
            for d in range(len(lista_dir)):
                lista_dir_files = os.listdir(path_attached+lista_nome[l] + "/" + lista_dir[d] + "/")                
                command = "rm -rf " + path_attached+lista_nome[l] + "/*"
                os.system(command)

def treeview_clicked(widget, event,data):
    (model, iter) = data.get_selected_rows()
    iters = []    

    for row in iter:
        iters.append(model.get_iter(row))

    if event.type == Gdk.EventType._2BUTTON_PRESS and event.button == 1:                            
        folderfile  = model[iter][1].replace("/","").replace(":","").replace(" ","")
        files =  model[iter][2].split("|")
        if model[iter][2].find("jpg") != -1 or model[iter][2].find("png") != -1  or model[iter][2].find("jpeg") != -1 or model[iter][2].find("gif") != -1  or model[iter][2].find("wmf") != -1 or model[iter][2].find("bmp") != -1:            
            if len(files) > 1:
                command = "eog " + path_attached + model[iter][0].upper() + "/" + folderfile + "/" + files[0][:-1]
            else:
                command = "eog " + path_attached + model[iter][0].upper() + "/" + folderfile + "/" + files[0]
            os.system(command)  
        else:
            command = "gnome-open " + path_attached + model[iter][0].upper() + "/" + folderfile + "/" + files[0]         
            os.system(command)                    
        return True
    

    if event.button == 1 and event.type == Gdk.EventType.BUTTON_PRESS:
         return False 

class MyWindow(Gtk.Window):
    def __init__(self):
        Gtk.Window.__init__(self, title="Attacheds List")
        self.set_default_size(1100, 100)
        self.set_border_width(15)      
        hb = Gtk.HeaderBar()
        hb.props.show_close_button = True
        hb.props.title = "Attacheds List"

        box2 = Gtk.VBox(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box2.get_style_context(), "linked")

        self.set_titlebar(hb)        

        boxPV = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(boxPV.get_style_context(), "linked")

        self.buttonBK = Gtk.Button()
        self.buttonBK.add(Gtk.Arrow(Gtk.ArrowType.LEFT, Gtk.ShadowType.NONE))
        boxPV.add(self.buttonBK)

        self.buttonGO = Gtk.Button()
        self.buttonGO.add(Gtk.Arrow(Gtk.ArrowType.RIGHT, Gtk.ShadowType.NONE))
        boxPV.add(self.buttonGO)

        self.buttonBK.set_sensitive(False)
        self.buttonGO.set_sensitive(False)

        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_icon_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png")  
        self.set_wmclass ("TurboNote Gnome", "TurboNote Gnome")
        grid = Gtk.Grid()

        scroller = Gtk.ScrolledWindow(hexpand=True, vexpand=True)
        scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scroller.set_min_content_height(300)
        scroller.set_min_content_width(150)
        scroller.set_shadow_type(2)
        scroller.set_border_width(border_width=1)
        

        image = Gtk.Image()         
        
        label = Gtk.Label()
        label.set_text("   ")

        self.labelCounter = Gtk.Label()
        self.labelCounter.set_text("1/1")

        scroller2 = Gtk.ScrolledWindow(hexpand=True, vexpand=True)
        scroller2.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER)
        scroller2.set_min_content_height(300)
        scroller2.set_min_content_width(300)
        scroller2.set_shadow_type(2)
        scroller2.set_border_width(border_width=1)
        scroller2.add(image)

        grid.attach(scroller, 0, 0, 1, 3) 
        grid.attach(label, 1, 0, 1, 3) 
        grid.attach(scroller2, 2, 0, 1, 1) 
        grid.attach(self.labelCounter, 2, 1, 1, 1) 
        #grid.attach(boxPV, 2, 2, 1, 1) 
        hb.pack_start(boxPV)
         
        view = Gtk.TreeView()
        view.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE)
       
        cell  = Gtk.CellRendererText(weight=300)
        cell2 = Gtk.CellRendererText(weight=300)
        cell3 = Gtk.CellRendererText(weight=300)

        cell.set_fixed_size(200, -1)
        cell2.set_fixed_size(200, -1)
        cell3.set_fixed_size(200, -1)

        col = Gtk.TreeViewColumn("Name", cell, text=0)
        col2 = Gtk.TreeViewColumn("Date", cell2, text=1)
        col3 = Gtk.TreeViewColumn("File(s)", cell3, text=2)
        
        view.append_column(col)
        view.append_column(col2)
        view.append_column(col3)

        scroller.add(view)
        self.listmodel = Gtk.ListStore(str,str,str)       

        view.set_model(self.listmodel)

        for i in range(len(lista_anexos)):
           self.listmodel.append(lista_anexos[i])
        
        self.selection = view.get_selection()
        self.selection.connect("changed", self.on_changed,image)

        self.buttonGO.connect("clicked", self.nextGO,self.selection,image)
        self.buttonBK.connect("clicked", self.backGO,self.selection,image)

        self.label = Gtk.Label()
        self.label.set_text(" ")

        view.set_search_column(0)
        col.set_sort_column_id(0)
        col2.set_sort_column_id(0)

        view.connect("button-press-event", treeview_clicked,self.selection) 

        self.button_remove = Gtk.Button()
        self.button_remove.connect("clicked", self.remove_cb)

        self.button_remove_all = Gtk.Button()
        self.button_remove_all.connect("clicked", self.remove_all_cb)

        self.removeimg = Gtk.Image()  
        if config_note.getColorRevertTitle():
            self.removeimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_remove_attached" + config_note.getColorOver() + ".png")      
        else:
            self.removeimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_remove_attached" + config_note.getColor() + ".png")      
        self.button_remove.add(self.removeimg)  

        self.removeallimg = Gtk.Image() 
        if config_note.getColorRevertTitle(): 
            self.removeallimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_remove_attached_all" + config_note.getColorOver() + ".png")        
        else:
            self.removeallimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_remove_attached_all" + config_note.getColor() + ".png")        
        self.button_remove_all.add(self.removeallimg)

        self.add(grid)

        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        Gtk.StyleContext.add_class(box.get_style_context(), "linked")           
        
        box.add(self.button_remove)
        box.add(self.button_remove_all)
        hb.pack_start(box)
        
        self.button_remove.set_tooltip_text("Remove selected")
        self.button_remove_all.set_tooltip_text("Remove all")
        
        grid.attach(self.button_remove_all, 1, 3, 1, 1)

    def nextGO(self,button,selection,image):
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


        
        filesFound = model[iters[i]][2].strip(" ").split("|")        
        datafile =  str(model[iters[i]][1])[:2]  + str(model[iters[i]][1])[3:-14]  + str(model[iters[i]][1])[6:-9]  + str(model[iters[i]][1])[11:-6] + str(model[iters[i]][1])[14:-3]+ str(model[iters[i]][1])[17:]

        setPageCounter(pageCounter +1)
  
        if pageCounter >= len(filesFound):
            self.buttonGO.set_sensitive(False)
            self.buttonBK.set_sensitive(True)

        if pageCounter > 1 and pageCounter < len(filesFound):
            self.buttonGO.set_sensitive(True)
            self.buttonBK.set_sensitive(True)

        print ">" + self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") + "<"

        if self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "png":           
            self.labelCounter.set_text(str(pageCounter) + " - This file not is image/" + str(len(filesFound))) 
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png", 200, 200, True)
            image.set_from_pixbuf(pixbuf)   
        else:           
            self.labelCounter.set_text(str(pageCounter) + "/" + str(len(filesFound)))        
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale("/usr/share/cinnamon/applets/turbonote@iksws.com.br/attacheds/"+str(model[iters[i]][0])+"/" + datafile + "/" + self.strip_one_space(str(filesFound[pageCounter-1])) , 500, 500, True)
            image.set_from_pixbuf(pixbuf)

    def strip_one_space(self,s):
        if s.endswith(" "): s = s[:-1]
        if s.startswith(" "): s = s[1:]
        return s

    def backGO(self,button,selection,image):
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


        
        filesFound = model[iters[i]][2].strip(" ").split("|")        
        datafile =  str(model[iters[i]][1])[:2]  + str(model[iters[i]][1])[3:-14]  + str(model[iters[i]][1])[6:-9]  + str(model[iters[i]][1])[11:-6] + str(model[iters[i]][1])[14:-3]+ str(model[iters[i]][1])[17:]

        setPageCounter(pageCounter -1)
        
        if pageCounter == 1:
            self.buttonGO.set_sensitive(True)
            self.buttonBK.set_sensitive(False)        

        if self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "png" and self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "gif" and self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "jpg" and self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "bmp":
            self.labelCounter.set_text(str(pageCounter) + " - [This file not is image]/" + str(len(filesFound))) 
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png", 200, 200, True)
            image.set_from_pixbuf(pixbuf)   
        else:
            self.labelCounter.set_text(str(pageCounter) + "/" + str(len(filesFound)))        
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale("/usr/share/cinnamon/applets/turbonote@iksws.com.br/attacheds/"+str(model[iters[i]][0])+"/" + datafile + "/" + self.strip_one_space(str(filesFound[pageCounter-1])) , 400, 400, True)
            image.set_from_pixbuf(pixbuf)

    def on_changed(self, selection,image):
        setPageCounter(1)
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


        
        filesFound = model[iters[i]][2].split("|")        
        datafile =  str(model[iters[i]][1])[:2]  + str(model[iters[i]][1])[3:-14]  + str(model[iters[i]][1])[6:-9]  + str(model[iters[i]][1])[11:-6] + str(model[iters[i]][1])[14:-3]+ str(model[iters[i]][1])[17:]        
        
        if len(filesFound) == 1:      
            if self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "png" and self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "gif" and self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "jpg" and self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "bmp":
                self.labelCounter.set_text("This file not is image")
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png", 200, 200, True)
                image.set_from_pixbuf(pixbuf)   
                self.buttonGO.set_sensitive(False)
                self.buttonBK.set_sensitive(False)
            else: 
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale("/usr/share/cinnamon/applets/turbonote@iksws.com.br/attacheds/"+str(model[iters[i]][0])+"/" + datafile + "/" + str(model[iters[i]][2]) , 400, 400, True)
                image.set_from_pixbuf(pixbuf)
                self.labelCounter.set_text("1/1")
                self.buttonGO.set_sensitive(False)
                self.buttonBK.set_sensitive(False)
        else:            
            if self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "png" and self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "gif" and self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "jpg" and self.strip_one_space(str(filesFound[pageCounter-1][-4:])).strip(".") != "bmp":
               self.labelCounter.set_text("1 - [This file not is image]/" + str(len(filesFound)))
               self.buttonGO.set_sensitive(True)
               pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png", 200, 200, True)
               image.set_from_pixbuf(pixbuf)   
            else:
                self.labelCounter.set_text("1/" + str(len(filesFound)))
                self.buttonGO.set_sensitive(True)
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale("/usr/share/cinnamon/applets/turbonote@iksws.com.br/attacheds/"+str(model[iters[i]][0])+"/" + datafile + "/" + str(filesFound[0][:-1]) , 400, 400, True)
                image.set_from_pixbuf(pixbuf)


        return True
    
    def remove_cb(self, button):
        if len(self.listmodel) != 0:
            (model, iter) = self.selection.get_selected_rows()
            iters = []
        
            for row in iter:
                iters.append(model.get_iter(row))

            if len(iters) != 0:
                for i in range(len(iters)):                     
                    rmvattached(model[iters[i]][0],model[iters[i]][1])
                    self.listmodel.remove(iters[i])                
            else:
                msgerror = "No select Attached!\\nPlease select one Attached to remove!";                      
                command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
                os.system(command)        
        else:
            msgerror = "Empty list!\\nYou don't have Attached(s) to remove!";                      
            command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
            os.system(command)        

    def remove_all_cb(self, button):
        if len(self.listmodel) != 0:
            for i in range(len(self.listmodel)):
                iter = self.listmodel.get_iter(0)
                self.listmodel.remove(iter)
            rmvattachedssall()
        msgerror = "Empty list!\\nAll contacts removed!";                      
        command = "notify-send --hint=int:transient:1 \"TurboNote Gnome3\" \"" + (msgerror).decode('iso-8859-1').encode('utf8') + "\" -i " + path_icon + "turbo.png"                  
        os.system(command)        


if __name__ == "__main__":
    win = MyWindow()
    win.connect("delete-event", Gtk.main_quit)
    win.show_all()
    Gtk.main()
