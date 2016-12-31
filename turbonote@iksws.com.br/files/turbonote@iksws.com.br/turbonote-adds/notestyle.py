from gi.repository import Gtk, Gdk,GObject,Pango
import commands
import time
import sys,os
import threading
import sqlite3
from config_note import Config

config_note = Config()
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"
path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"
stay = ""


connb = sqlite3.connect(path + 'turbo.db')
a = connb.cursor()
a.execute("SELECT * FROM notestyle")
rows =  a.fetchall()
f1 = (str(rows[0][0]))
f2 = (str(rows[0][1]))
f3 = (str(rows[0][2]))
f4 = (str(rows[0][3]))
f5 = str(rows[0][4])
f6 = str(rows[0][5])
connb.close()

def setF1(f):
    global f1
    f1 = f
def setF2(f):
    global f2
    f2 = f
def setF3(f):
    global f3
    f3 = f
def setF4(f):
    global f4
    f4 = f
def setF5(f):
    global f5
    f5 = f
def setF6(f):
    global f6
    f6 = f

class WindowStyle(Gtk.Window):

    def __init__(self):
        Gtk.Window.__init__(self, title="SVN UPDATE")
        self.set_default_size(520, 400)
        self.set_border_width(15)      
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_resizable( False )
        
        hb = Gtk.HeaderBar()
        hb.props.show_close_button = True
        hb.props.title = "NOTE STYLE FOR WINDOWS VIEW"        
        self.set_titlebar(hb)    

    
        self.grid = Gtk.Grid()
        self.add(self.grid)        

        self.space = Gtk.Label()
        self.space.set_text("      ") 

        self.space2 = Gtk.Label()
        self.space2.set_text("      ") 

        self.space3 = Gtk.Label()
        self.space3.set_text("      ") 

        self.space4 = Gtk.Label()
        self.space4.set_text("      ") 

        self.space5 = Gtk.Label()
        self.space5.set_text("      ") 

        self.title_body = Gtk.Label()
        self.title_body.set_text("Body Components") 

        self.title_title = Gtk.Label()
        self.title_title.set_text("Title Components") 

        self.noteTextLabel = Gtk.Label("\n\n\n\n\n           Select font for text note...           \n\n\n\n\n")
        self.noteTextTitle = Gtk.Label("          Note Title...           ")


        fontbt = Gtk.Button()
        fontbt.set_tooltip_text("Body font")
        fontbt.connect("clicked", self.on_clickedTextFont)
       
        fontcolorbt = Gtk.Button()
        fontcolorbt.set_tooltip_text("Text body color")
        fontcolorbt.connect("clicked", self.on_clickedTextColor)

        fontbtTitle = Gtk.Button()
        fontbtTitle.set_tooltip_text("Font title")
        fontbtTitle.connect("clicked", self.on_clickedTextFontTitle)
        
        fontcolorbtTitle = Gtk.Button()
        fontcolorbtTitle.set_tooltip_text("title text color")
        fontcolorbtTitle.connect("clicked", self.on_clickedTextColorTitle)

        bodyColor = Gtk.Button()
        bodyColor.set_tooltip_text("Body Color")
        bodyColor.connect("clicked", self.on_clickedTextColorBody)

        bodytitleColor = Gtk.Button()
        bodytitleColor.set_tooltip_text("Title color")
        bodytitleColor.connect("clicked", self.on_clickedTextColorTitleBody)

        save = Gtk.Button()
        save.set_tooltip_text("Save Config")
        save.connect("clicked", self.on_save)

        

        self.colorBody = Gtk.Image()  
        self.colorBody.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_new_eventb" + config_note.getColor() + ".png")     
        bodyColor.add(self.colorBody)

        self.colorTextBody = Gtk.Image()  
        self.colorTextBody.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_new_eventtb" + config_note.getColor() + ".png")     
        fontcolorbt.add(self.colorTextBody)

        self.fontTextBody = Gtk.Image()  
        self.fontTextBody.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_new_eventt" + config_note.getColor() + ".png")     
        fontbt.add(self.fontTextBody)

        self.colorBodyTitle = Gtk.Image()  
        self.colorBodyTitle.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_new_eventb" + config_note.getColor() + ".png")     
        fontcolorbtTitle.add(self.colorBodyTitle)

        self.colorTextBodyTitle = Gtk.Image()  
        self.colorTextBodyTitle.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_new_eventtb" + config_note.getColor() + ".png")     
        bodytitleColor.add(self.colorTextBodyTitle)

        self.fontTextBodyTitle = Gtk.Image()  
        self.fontTextBodyTitle.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_new_eventt" + config_note.getColor() + ".png")     
        fontbtTitle.add(self.fontTextBodyTitle)

        self.saveimg = Gtk.Image()  
        self.saveimg.set_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/ic_action_save" + config_note.getColor() + ".png")     
        save.add(self.saveimg)
        

        self.grid.attach(self.title_body, 0,0 , 3 , 1)

        self.grid.attach(self.space2, 0,1 , 1 , 1)

        self.grid.attach(bodyColor    ,0,2 , 1 , 1) 
        self.grid.attach(fontcolorbt  ,1,2 , 1 , 1)
        self.grid.attach(fontbt       ,2,2 , 1 , 1)

        self.grid.attach(self.space, 3,2 , 1 , 3)

        self.grid.attach(self.noteTextTitle, 4,0 , 1 , 2)
        self.grid.attach(self.noteTextLabel, 4,1 , 1 , 8)

        self.grid.attach(self.space3, 0,3 , 3 , 1)
        self.grid.attach(self.title_title, 0,4 , 3 , 1)
     
        self.grid.attach(self.space4, 0,5 , 3 , 1)

        self.grid.attach(fontbtTitle, 2,6 , 1 , 1)
        self.grid.attach(bodytitleColor, 1,6 , 1 , 1) 
        self.grid.attach(fontcolorbtTitle, 0,6, 1 , 1) 

        self.grid.attach(self.space5, 0,7 , 3 , 1)

        self.grid.attach(save, 0,8 , 3 , 1)

        font1 = Gdk.RGBA()        
        font2 = Gdk.RGBA()       
        font3 = Gdk.RGBA()        
        font4 = Gdk.RGBA()

        connb = sqlite3.connect(path + 'turbo.db')
        a = connb.cursor()
        a.execute("SELECT * FROM notestyle")
        rows =  a.fetchall()
        font1.parse(str(rows[0][0]))
        font2.parse(str(rows[0][1]))
        font3.parse(str(rows[0][2]))
        font4.parse(str(rows[0][3]))
        fontbt = str(rows[0][4])
        fontbb = str(rows[0][5])
        connb.close()

        self.noteTextTitle.override_color(Gtk.StateFlags.NORMAL, font3)              
        self.noteTextTitle.override_background_color(Gtk.StateFlags.NORMAL, font1)      
        self.noteTextLabel.override_color(Gtk.StateFlags.NORMAL, font4) 
        self.noteTextLabel.override_background_color(Gtk.StateFlags.NORMAL, font2) 
       
        self.noteTextTitle.modify_font(Pango.FontDescription(fontbt))
        self.noteTextLabel.modify_font(Pango.FontDescription(fontbb))

    def rgb_to_hex(self,rgb):
        return '#%02x%02x%02x' % rgb

    def on_clickedTextColorTitleBody(self, widget):
        cdia = Gtk.ColorSelectionDialog("Select color")
        response = cdia.run()
              
        

        if response == Gtk.ResponseType.OK:
            colorsel = cdia.get_color_selection()   
            rgb =  colorsel.get_current_rgba().to_string()
            rgb = rgb.replace("rgb","").replace("(","").replace(")","").split(',')  
            setF1(self.rgb_to_hex((int(rgb[0]), int(rgb[1]), int(rgb[2]))))
            self.noteTextTitle.override_background_color(Gtk.StateFlags.NORMAL, colorsel.get_current_rgba())
        
        cdia.destroy()

    def on_save(self, widget):         
        connb = sqlite3.connect(path + 'turbo.db')
        a = connb.cursor()    
        a.execute("UPDATE notestyle SET titulo_color ='" + f1 +"',body_color='" + f2 + "',titulo_font_color ='" + f3 + "',body_font_color ='" + f4 + "',titulo_font_type='" + f5 + "',body_font_type = '" + f6 + "' where 1=1;")
        connb.commit()
        connb.close()

    def on_clickedTextColorBody(self, widget):
        cdia = Gtk.ColorSelectionDialog("Select color")
        response = cdia.run()
              
        if response == Gtk.ResponseType.OK:
            colorsel = cdia.get_color_selection()        
            rgb =  colorsel.get_current_rgba().to_string()
            rgb = rgb.replace("rgb","").replace("(","").replace(")","").split(',')  
            setF2(self.rgb_to_hex((int(rgb[0]), int(rgb[1]), int(rgb[2]))))
            self.noteTextLabel.override_background_color(Gtk.StateFlags.NORMAL, colorsel.get_current_rgba())
        
        cdia.destroy()

    def on_clickedTextColor(self, widget):
        cdia = Gtk.ColorSelectionDialog("Select color")
        response = cdia.run()
              
        if response == Gtk.ResponseType.OK:
            colorsel = cdia.get_color_selection()
            rgb =  colorsel.get_current_rgba().to_string()
            rgb = rgb.replace("rgb","").replace("(","").replace(")","").split(',')  
            setF4(self.rgb_to_hex((int(rgb[0]), int(rgb[1]), int(rgb[2]))))
            self.noteTextLabel.override_color(Gtk.StateFlags.NORMAL, colorsel.get_current_rgba())
        
        cdia.destroy()

    def on_clickedTextFont(self, widget):
        fdia = Gtk.FontSelectionDialog("Select font name")
        response = fdia.run()
              
        if response == Gtk.ResponseType.OK:
            font_desc = Pango.FontDescription(fdia.get_font_name())           
            setF6(font_desc.get_family())
            if font_desc:
                self.noteTextLabel.modify_font(font_desc)
        
        fdia.destroy()

    def on_clickedTextColorTitle(self, widget):
        cdia = Gtk.ColorSelectionDialog("Select color")
        response = cdia.run()
              
        if response == Gtk.ResponseType.OK:
            colorsel = cdia.get_color_selection()
            rgb =  colorsel.get_current_rgba().to_string()
            rgb = rgb.replace("rgb","").replace("(","").replace(")","").split(',')  
            setF3(self.rgb_to_hex((int(rgb[0]), int(rgb[1]), int(rgb[2]))))
            self.noteTextTitle.override_color(Gtk.StateFlags.NORMAL, colorsel.get_current_rgba())
        
        cdia.destroy()

    def on_clickedTextFontTitle(self, widget):
        fdia = Gtk.FontSelectionDialog("Select font name")
        response = fdia.run()
              
        if response == Gtk.ResponseType.OK:
            font_desc = Pango.FontDescription(fdia.get_font_name())
            if font_desc:
                setF5(font_desc.get_family())
                self.noteTextTitle.modify_font(font_desc)
        
        fdia.destroy()
