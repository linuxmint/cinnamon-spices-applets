#!/usr/bin/env python2.7

from gi.repository import Gtk, Gio, Gdk

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
        self.pack_start(self.content_widget, False, False, 2)
        if (units != ""):
            self.pack_start(self.units, False, False, 2)
        
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

class CinnamonMenuSettings:

    def __init__(self):
        self.window = Gtk.Window(title='Classic Menu Settings')
        self.window.connect('destroy', Gtk.main_quit)

        self.vbox = Gtk.VBox();
        self.app_icon_size = GSettingsSpinButton("Application icon size", "org.cinnamon.applets.classicMenu", "application-icon-size", 0, 50, 1, 1, "")
        self.vbox.add(self.app_icon_size)
        self.cat_icon_size = GSettingsSpinButton("Categories icon size", "org.cinnamon.applets.classicMenu", "categories-icon-size", 0, 50, 1, 1, "")
        self.vbox.add(self.cat_icon_size)
        self.fav_icon_size = GSettingsSpinButton("Favorites icon size", "org.cinnamon.applets.classicMenu", "favorites-icon-size", 0, 100, 1, 1, "")
        self.vbox.add(self.fav_icon_size)
        self.right_app = GSettingsCheckButton("Right panel shows all applications", "org.cinnamon.applets.classicMenu", "right-app")
        self.vbox.add(self.right_app)
        self.vbox.show_all()
        self.window.add(self.vbox)
        self.window.show_all()

def main():
    CinnamonMenuSettings()
    Gtk.main()

if __name__ == '__main__':
    main()
