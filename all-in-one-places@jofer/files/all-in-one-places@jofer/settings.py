#!/usr/bin/python

'''
Settings Application for the All-in-one Places applet for Cinnamon.
http://jferrao.github.com/gtk

Requires Python 2.7


@author jferrao <jferrao@ymail.com>
@version 2.0

'''



from optparse import OptionParser
from gi.repository import Gio, Gtk
import os
import gettext

home = os.path.expanduser("~")
gettext.install("all-in-one-places@jofer", home + "/.local/share/locale")

APPLET_DIR = os.path.dirname(os.path.abspath(__file__)) 
SCHEMA_NAME = "org.cinnamon.applets.AllInOnePlaces"

PANEL_WIDGETS = [
    {'type': 'switch', 'args': { 'key': 'show-panel-icon', 'label': _("Show panel icon") }},
    {'type': 'switch', 'args': { 'key': 'full-color-panel-icon', 'label': _("Show the panel icon in full color") }},
    {'type': 'switch', 'args': { 'key': 'show-panel-text', 'label': _("Show text in panel") }},
    {'type': 'entry', 'args': { 'key': 'panel-text', 'label': _("Panel text") }},
    {'type': 'combo', 'args': { 'key': 'file-manager', 'label': _("File manager"), 'values': {'nautilus': 'Nautilus', 'thunar': 'Thunar', 'pcmanfm': 'PCManFM', 'nemo': 'Nemo'} }},
    {'type': 'entry', 'args': { 'key': 'connect-command', 'label': _("Application for the  \"Connect to...\" item") }},
    {'type': 'entry', 'args': { 'key': 'search-command', 'label': _("Application for the \"Search\" item") }}
]

MENU_WIDGETS = [
    {'type': 'switch', 'args': { 'key': 'show-desktop-item', 'label': _("Show desktop item") }},
    {'type': 'switch', 'args': { 'key': 'show-trash-item', 'label': _("Show trash item") }},
    {'type': 'switch', 'args': { 'key': 'hide-empty-trash-item', 'label': _("Hide trash item when trash is empty") }},
    {'type': 'switch', 'args': { 'key': 'show-bookmarks-section', 'label': _("Show bookmarks section") }},
    {'type': 'switch', 'args': { 'key': 'collapse-bookmarks-section', 'label': _("Drop-down style bookmarks section") }},
    {'type': 'switch', 'args': { 'key': 'show-filesystem-item', 'label': _("Show file system item") }},
    {'type': 'switch', 'args': { 'key': 'show-devices-section', 'label': _("Show devices section") }},
    {'type': 'switch', 'args': { 'key': 'collapse-devices-section', 'label': _("Drop-down style devices section") }},
    {'type': 'switch', 'args': { 'key': 'show-network-section', 'label': _("Show network section") }},
    {'type': 'switch', 'args': { 'key': 'collapse-network-section', 'label': _("Drop-down style network section") }},
    {'type': 'switch', 'args': { 'key': 'show-search-item', 'label': _("Show search item") }},
    {'type': 'switch', 'args': { 'key': 'show-documents-section', 'label': _("Show recent documents section") }},
    {'type': 'slider', 'args': { 'key': 'max-documents-documents', 'label': _("Maximum number of recent documents"), 'min': 5, 'max': 25, 'step': 1, 'default': 10 }},
    {'type': 'slider', 'args': { 'key': 'item-icon-size', 'label': _("Menu item icon size"), 'min': 8, 'max': 46, 'step': 1, 'default': 22 }},
]



class SettingsWindow(Gtk.Window):
    ''' Build settings panel window '''

    def __init__(self):
        Gtk.Window.__init__(self, title=_("All-in-one Places Applet Settings"))
        frame = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, border_width=10, spacing=10)

        # Global tab
        box_panel = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, border_width=10)
        for panel_widget in PANEL_WIDGETS:
            widget_obj = getattr(Widgets, panel_widget['type'])
            widgdet = widget_obj(Widgets(), **panel_widget['args'])
            box_panel.pack_start(widgdet, False, False, 5)
        
        #box_panel.pack_start(Gtk.HSeparator(), False, False, 10)
       
        # Items tab
        box_items = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, border_width=10)
        for menu_widget in MENU_WIDGETS:
            widget_obj = getattr(Widgets, menu_widget['type'])
            widgdet = widget_obj(Widgets(), **menu_widget['args'])
            box_items.pack_start(widgdet, False, False, 5)
        
        # Build tabs
        tabs = Gtk.Notebook()
        tabs.set_scrollable(True)
        tabs.set_size_request(100, 100)
        tabs.append_page(box_panel, Gtk.Label(label=_("Global")))
        tabs.append_page(box_items, Gtk.Label(label=_("Menu items")))
        frame.pack_start(tabs, False, False, 0)
        frame.show_all()
        self.add(frame)

        # Buttons box
        box_buttons = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, border_width=0, spacing=10)
        
        btn_close = Gtk.Button(stock=Gtk.STOCK_CLOSE)
        btn_close.connect('clicked', self._exit_application)
        box_buttons.pack_end(btn_close, False, False, 0)
        
        #img_default = Gtk.Image()
        #img_default.set_from_stock(Gtk.STOCK_REFRESH, 3)
        #button_default = Gtk.Button(_("Restore default settings"))
        #button_default.set_property("image", img_default)
        #button_default.connect('clicked', self._restore_default_values)
        #box_buttons.pack_end(button_default, False, False, 0)

        frame.pack_end(box_buttons, False, False, 0);
    
    def _restore_default_values(self, widget):
        print " ... restore !!!"
        
    def _restart_shell(self, widget):
        # Silent background process restart
        os.system("nohup cinnamon --replace >/dev/null 2>&1&")
                
    def _exit_application(self, widget):
        Gtk.main_quit()

        

class Settings(object):
    ''' Get settings values using gsettings '''
    
    _settings = None

    def __new__(cls, *p, **k):
        ''' Implementation of the borg pattern
        This way we make sure that all instances share the same state 
        and that the schema is read from file only once.
        '''
        if not '_the_instance' in cls.__dict__:
            cls._the_instance = object.__new__(cls)
        return cls._the_instance    

    def set_settings(self, schema_name):
        ''' Get settings values from corresponding schema file '''

        # Try to get schema from local installation directory
        schemas_dir = "%s/schemas" % APPLET_DIR
        if os.path.isfile("%s/gschemas.compiled" % schemas_dir):
            schema_source = Gio.SettingsSchemaSource.new_from_directory(schemas_dir, Gio.SettingsSchemaSource.get_default(), False)
            schema = schema_source.lookup(schema_name, False)
            self._settings = Gio.Settings.new_full(schema, None, None)
        # Schema is installed system-wide
        else:
            self._settings = Gio.Settings.new(schema_name)

    def get_settings(self):
        return self._settings



class Widgets():
    ''' Build widgets associated with gsettings values '''

    def switch(self, key, label):
        ''' Switch widget '''
        box = Gtk.HBox()
        label = Gtk.Label(label)
        widget = Gtk.Switch()
        widget.set_active(Settings().get_settings().get_boolean(key))
        widget.connect('notify::active', self._switch_change, key)
        box.pack_start(label, False, False, 20)
        box.pack_end(widget, False, False, 0)        
        return box
        
    def _switch_change(self, widget, notice, key):
        Settings().get_settings().set_boolean(key, widget.get_active())	

    def entry(self, key, label):
        ''' Entry text widget '''
        box = Gtk.HBox()
        label = Gtk.Label(label)
        widget = Gtk.Entry(hexpand=True)
        widget.set_text(Settings().get_settings().get_string(key))
        widget.connect('changed', self._entry_change, key)
        box.pack_start(label, False, False, 20)
        box.add(widget)    
        return box

    def _entry_change(self, widget, key):
        Settings().get_settings().set_string(key, widget.get_text());

    def combo(self, key, label, values):
        ''' Combo box widget '''
        box = Gtk.HBox()
        label = Gtk.Label(label)
        widget = Gtk.ComboBoxText()
        for command, name in values.items():
            widget.append(command, name)
        widget.set_active_id(Settings().get_settings().get_string(key))
        widget.connect('changed', self._combo_change, key)
        box.pack_start(label, False, False, 20)
        box.pack_end(widget, False, False, 0)
        return box

    def _combo_change(self, widget, key):
        Settings().get_settings().set_string(key, widget.get_active_id())

    def slider(self, key, label, min, max, step, default):
        ''' Slider widget '''
        box = Gtk.HBox()
        label = Gtk.Label(label)
        widget = Gtk.HScale.new_with_range(min, max, step)
        widget.set_value(Settings().get_settings().get_int(key));
        widget.connect('value_changed', self._slider_change, key)
        widget.set_size_request(200, -1)
        box.pack_start(label, False, False, 20)
        box.pack_end(widget, False, False, 0)
        return box
        
    def _slider_change(self, widget, key):
        Settings().get_settings().set_int(key, widget.get_value())



if __name__ == "__main__":
    
    # Initialize and load gsettings values
    Settings().set_settings(SCHEMA_NAME)
    
    win = SettingsWindow()
    win.connect("delete-event", Gtk.main_quit)
    win.show_all()
    Gtk.main()
