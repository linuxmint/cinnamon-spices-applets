#!/usr/bin/python3

import random
from JsonSettingsWidgets import *
from gi.repository import Gio, Gtk


class TextWidget(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)
        self.settings = settings

        self.set_margin_left(0)
        self.set_margin_right(0)
        self.set_border_width(0)

        css_provider = Gtk.CssProvider()
        css_provider.load_from_data(b"""
            textview {
                font-size: 14px;
                font-family: monospace;
            }
        """)

        screen = Gdk.Screen.get_default()
        Gtk.StyleContext().add_provider_for_screen(
            Gdk.Screen.get_default(),
            css_provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        self.textview = Gtk.TextView()
        self.textview.set_border_width(10)
        self.textbuffer = self.textview.get_buffer()

        self.settings.bind(key, self.textbuffer, 'text', Gio.SettingsBindFlags.DEFAULT)

        self.pack_start(self.textview, True, True, 0)
