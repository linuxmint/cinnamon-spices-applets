#!/usr/bin/env python
# -*- coding: iso-8859-1 -*-

from gi.repository import Gtk, Gio, Gdk
import pygtk
import os

class GSettingsCheckButton(Gtk.CheckButton):    
    def __init__(self, label, schema, key):        
        self.key = key
        super(GSettingsCheckButton, self).__init__(label)
        self.settings = Gio.Settings.new(schema)        
        self.set_active(self.settings.get_boolean(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.connect('toggled', self.on_my_value_changed)            
    
    def on_my_setting_changed(self, settings, key):
        self.set_active(self.settings.get_boolean(self.key))
        
    def on_my_value_changed(self, widget):
        self.settings.set_boolean(self.key, self.get_active())

class GSettingsSpinButton(Gtk.HBox):    
    def __init__(self, label, schema, key, min, max, step, page, units):        
        self.key = key
        super(GSettingsSpinButton, self).__init__()        
        self.label = Gtk.Label(label)
        self.content_widget = Gtk.SpinButton()
        self.units = Gtk.Label(units)
        if (label != ""):
            self.pack_start(self.label, False, False, 2)                
        self.pack_end(self.content_widget, False, False, 2)              
        if (units != ""):
            self.pack_end(self.units, False, False, 2)              
        
        self.content_widget.set_range(min, max)
        self.content_widget.set_increments(step, page)
        self.content_widget.set_editable(False)
        
        self.settings = Gio.Settings.new(schema)        
        self.content_widget.set_value(self.settings.get_int(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('focus-out-event', self.on_my_value_changed)
    
    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_value(self.settings.get_int(self.key))
        
    def on_my_value_changed(self, widget, data):
        print self.content_widget.get_value()
        self.settings.set_int(self.key, self.content_widget.get_value())


class CinnamonMenuSettings(Gtk.Window):


    def __init__(self):
	
        self.window = Gtk.Window(title='GnomeMenu Settings')
	self.window.set_default_size(420, 100)
	self.window.set_border_width(5)
	self.window.set_position(Gtk.WindowPosition.CENTER)
        self.window.connect('destroy', Gtk.main_quit)

	

        self.hbox = Gtk.VBox();

	

	self.app_icon_size = GSettingsSpinButton("Menu Entry Icon size:", "org.cinnamon.applets.GnomeMenu", "icon-size", 0, 50, 1, 1, "")
	self.hbox.add(self.app_icon_size)

	self.sub_app_icon_size = GSettingsSpinButton("Sub-Menu Entry Icon size:", "org.cinnamon.applets.GnomeMenu", "sub-icon-size", 0, 50, 1, 1, "")
	self.hbox.add(self.sub_app_icon_size)

	self.bookmarks = GSettingsCheckButton("Collapsable Bookmarks", "org.cinnamon.applets.GnomeMenu", "collapse-bookmarks")
	self.hbox.add(self.bookmarks)

	label = Gtk.Label()
        label.set_markup("<i><small>Must restart Cinnamon for changes to take place.</small></i>")
        label.set_line_wrap(True)
        self.hbox.pack_start(label, True, True, 0)

	label = Gtk.Label()
        label.set_markup("<i><small>(To restart Cinnamon, press <b>ALT</b> + <b>F2</b> then type \"<b>r</b>\", then <b>enter</b>.)</small></i>")
        label.set_line_wrap(True)
        self.hbox.pack_start(label, True, True, 0)

	button = Gtk.Button("Close")
	button.connect("clicked", Gtk.main_quit)
	self.hbox.pack_start(button, True, True, 0)




	 


        self.hbox.show_all()
        self.window.add(self.hbox)
	self.window.show_all()



def main():
    CinnamonMenuSettings()
    Gtk.main()

if __name__ == '__main__':
    main()
