#!/usr/bin/python3

from JsonSettingsWidgets import *
from gi.repository import Gio, Gtk

class FileSaver(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)
        self.key = key
        self.settings = settings
        self.info = info
        self.pack_start(Gtk.Label(_(info['description']), halign=Gtk.Align.START), True, True, 0)
        self.button = Gtk.Button(_("Save"))
        self.button.connect('clicked', self.button_pressed)
        self.pack_end(self.button, False, False, 0)

        # Binding
        self.entry = Gtk.Entry()
        self.settings.bind('selectedLogPath', self.entry, 'text', Gio.SettingsBindFlags.SET)

    def button_pressed(self, *args):
        saver = Gtk.FileChooserDialog(
            'Select a destination',
            None,
            Gtk.FileChooserAction.SAVE,
            (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
             Gtk.STOCK_SAVE, Gtk.ResponseType.OK))
        response = saver.run()
        if response == Gtk.ResponseType.OK:
            file_path = saver.get_filename()
            print("File selected: " + file_path)
            self.entry.set_text(file_path)
            print("Text set")
        elif response == Gtk.ResponseType.CANCEL:
            print("Cancel clicked")

        saver.destroy()
