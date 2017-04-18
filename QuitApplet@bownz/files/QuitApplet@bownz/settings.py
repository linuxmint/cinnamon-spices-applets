#!/usr/bin/python

'''
Settings Application for the All-in-one Places applet for Cinnamon
http://jferrao.github.com/gtk

Requires Python 2.7


@author jferrao <jferrao@ymail.com>
@version 1.0

'''





from optparse import OptionParser
from gi.repository import Gtk
import os
import json
import collections
import gettext


home = os.path.expanduser("~")
gettext.install("QuitApplet@bownz", home + "/.local/share/locale")

default_config = {
    'SHOW_POPUPS': True, 
    'SHOW_ICONS': True, 
    'ICON_SIZE': 22
}

config = None
config_file = os.path.dirname(os.path.abspath(__file__)) + "/config.json"



def load_config():
    global config
    f = open(config_file, 'r')
    config = json.loads(f.read(), object_pairs_hook=collections.OrderedDict)
    f.close()
    if (opts.verbose):
        print "config file loaded"

def save_config(data):
    f = open(config_file, 'w')
    f.write(json.dumps(data, sort_keys=False, indent=4))
    f.close()
    if (opts.verbose):
        print "config file saved"





class MyWindow(Gtk.Window):

    restart = False

    def __init__(self):
        
        Gtk.Window.__init__(self, title=_("Favorites Applet Settings"))

        window_icon = self.render_icon(Gtk.STOCK_PREFERENCES, 6)
        self.set_icon(window_icon)

        self.set_position(3)
        self.set_border_width(15)
        
        box_container = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=30)
        box_container.set_homogeneous(False)

     

        # Righ options column
        vbox_right = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        vbox_right.set_homogeneous(False)

        # Columns options container box
        box_options = Gtk.HBox(spacing=15)
        box_options.set_homogeneous(False)
        box_options.pack_start(vbox_right, False, False, 0)

        # Bottom options box
        #box_extra = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        #box_extra.set_homogeneous(False)

        # Buttons box
        box_buttons = Gtk.HBox(spacing=10)
        box_buttons.set_homogeneous(False)
        
        box_container.pack_start(box_options, True, True, 0)
        #box_container.pack_start(box_extra, True, True, 0)
        box_container.pack_start(box_buttons, True, True, 0)


       
        # Build options for right column
        if (config.has_key('SHOW_POPUPS')):
            switch_SHOW_POPUPS = switch_option()
            switch_SHOW_POPUPS.create(vbox_right, 'SHOW_POPUPS', config['SHOW_POPUPS'], _("Display pop-up confirmation windows for \"Quit...\" and \"Log Out...\"?"))

        vbox_right.pack_start(Gtk.HSeparator(), False, False, 0)
        
        # Icon size slider
        box_icon_size = Gtk.VBox(0)
       
        adjust_icon_size = Gtk.Adjustment(config['ICON_SIZE'], 16, 46, 6, 6, 0)
        adjust_icon_size.connect("value_changed", self.on_slider_change, 'ICON_SIZE')
        slider_icon_size = Gtk.HScale()
        slider_icon_size.set_adjustment(adjust_icon_size)
        slider_icon_size.set_digits(0)

        box_icon_size.pack_start(Gtk.Label(_("Icon size")), False, False, 0)
        box_icon_size.pack_start(slider_icon_size, False, False, 0)        

        vbox_right.pack_start(box_icon_size, False, False, 0)

        
        # Build extra options
        #self.restart = False
        #self.check_restart = Gtk.CheckButton("Restart Cinnamon on close")
        #self.check_restart.connect('toggled', self.change_restart_status)
        #self.check_restart.set_active(False)
        #box_extra.pack_start(self.check_restart, True, True, 0)        

        # Build buttons
        #img_default = Gtk.Image()
        #img_default.set_from_stock(Gtk.STOCK_PROPERTIES, 3)
        #btn_default = Gtk.Button(_("Default settings"))
        #btn_default.set_property("image", img_default)
        #btn_default.connect('clicked', self.generate_config_file)
        #box_buttons.pack_start(btn_default, False, False, 0)
        
        btn_close = Gtk.Button(stock=Gtk.STOCK_CLOSE)
        btn_close.connect('clicked', self.exit_application)
        box_buttons.pack_end(btn_close, False, False, 0)

        img_restart = Gtk.Image()
        img_restart.set_from_stock(Gtk.STOCK_REFRESH, 3)
        btn_restart = Gtk.Button(_("Restart Cinnamon"))
        btn_restart.set_property("image", img_restart)
        btn_restart.connect('clicked', self.restart_shell)
        box_buttons.pack_end(btn_restart, False, False, 0)

        self.add(box_container)



    def change_restart_status(self, widget):
        if widget.get_active():
            self.restart = True
        else:
            self.restart = False

    def on_check_custom_text_change(self, option_widget, text_widget):
        if option_widget.get_active():
            text_widget.set_sensitive(True)
            text_widget.grab_focus()
        else:
            text_widget.set_sensitive(False)
            config['PANEL_TEXT'] = None
            if (opts.verbose):
                print "changed key 'PANEL_TEXT' => %s" % None
            save_config(config)

    def on_custom_text_change(self, text_widget):
        config['PANEL_TEXT'] = text_widget.get_text()
        if (opts.verbose):
            print "changed key 'PANEL_TEXT' => %s" % text_widget.get_text()
        save_config(config)

    def on_slider_change(self, widget, key):
        config[key] = int(widget.get_value())
        if (opts.verbose):
            print "changed key %s => %s" % (key, int(widget.get_value()))
        save_config(config)

    def generate_config_file(self, widget):
        if (opts.verbose):
            print "new default config file generated"
        save_config(default_config)
    
    def restart_shell(self, widget):
        os.system('cinnamon --replace &')
        self.check_restart.set_active(False)

    def exit_application(self, widget):
        if (self.restart):
            os.system('cinnamon --replace &')
            self.check_restart.set_active(False)
        else:
            Gtk.main_quit()





class switch_option():
    
    def create(self, container, key, value, label):
        box = Gtk.HBox(spacing=20)
        box.set_homogeneous(False)
        label = Gtk.Label(label)
        
        widget = Gtk.Switch()
        widget.set_active(value)
        widget.connect('notify::active', self.change_state, key)

        box.pack_start(label, False, False, 0)
        box.pack_end(widget, False, False, 0)        

        container.add(box)        

    def change_state(self, widget, notice, key):
        global config
        if (config.has_key(key)):
            config[key] = widget.get_active();
            if (opts.verbose):
                print "changed key %s => %s" % (key, widget.get_active())
        save_config(config)





if __name__ == "__main__":

    parser = OptionParser()
    parser.add_option("-v", "--verbose", action="store_true", default=False, dest="verbose", help="print event and action messages")
    (opts, args) = parser.parse_args()
    
    load_config()

    win = MyWindow()
    win.connect("delete-event", Gtk.main_quit)
    win.show_all()
    Gtk.main()
    
