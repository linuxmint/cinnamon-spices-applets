#!/usr/bin/python3

from JsonSettingsWidgets import *
import gettext
from gi.repository import GLib, Gio, Gtk
# i18n
gettext.install("weather@mockturtl", GLib.get_home_dir() + '/.local/share/locale')

class FileSaver(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)
        self.key = key
        self.settings = settings
        self.info = info
        self.pack_start(Gtk.Label(_(info['description']), halign=Gtk.Align.START, wrap=True), True, True, 0)
        self.button = Gtk.Button(_("Save to File"))
        self.button.connect('clicked', self.button_pressed)
        self.pack_end(self.button, False, False, 0)
        self.set_tooltip_text(_(info["tooltip"]))

        # Binding
        self.entry = Gtk.Entry()
        # Have to bind to a different setting than this was opened from
        # otherwise the callback won't work
        self.settings.bind('selectedLogPath', self.entry, 'text', Gio.SettingsBindFlags.SET)

    def button_pressed(self, *args):
        saver = Gtk.FileChooserDialog(
            _('Select a destination'),
            None,
            Gtk.FileChooserAction.SAVE,
            (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
             Gtk.STOCK_SAVE, Gtk.ResponseType.OK))
        # Have to reset the text if we want it to work every time
        self.entry.set_text("")
        response = saver.run()
        if response == Gtk.ResponseType.OK:
            file_path = saver.get_filename()
            print("File selected: " + file_path)
            self.entry.set_text(file_path)
            print("Text set")
        elif response == Gtk.ResponseType.CANCEL:
            print("Cancel clicked")

        saver.destroy()
