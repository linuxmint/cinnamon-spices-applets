#!/usr/bin/env python3

##
## Customize Font of wine prefix
##

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk
from gi.repository import Gdk
from gi.repository import Gio
from gi.repository import GLib
from gi.repository import GObject
from gi.repository import Pango

from os import path
import os
import sys
import locale
import re

import draw_gui
import read_wine_reg
import write_wine_reg

import default_colors

UUID = 'wine-utils@elblake'

locale.setlocale(locale.LC_MESSAGES, "")
locale.textdomain(UUID)
locale.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale")

def _(str0):
    str1 = locale.dgettext(UUID, str0)
    if str1 == '':
        return str0
    return str1


class MWin(Gtk.Window):
    def __init__(self, wine_prefix, wine_cmd):
        super().__init__()

        self.interface_setting = Gio.Settings.new("org.cinnamon.desktop.interface")

        self.set_title(_("Customize Fonts"))
        self.set_type_hint(Gdk.WindowTypeHint.DIALOG)
        self.defaults()

        self.wine_prefix = wine_prefix
        self.wine_cmd = wine_cmd

        self.update_timer = 0
        self.changes = {}
        GLib.timeout_add(1000, self.apply_changes, 0)
        
        r = read_wine_reg.ReadWineReg(self.wine_prefix)
        r.read()
        for name in r.values.keys():
            self.colors[name] = r.values[name]

        self.box = Gtk.Box(margin=10,spacing=10,orientation=Gtk.Orientation.VERTICAL)
        self.add(self.box)

        self.box3 = Gtk.Box(margin=10,spacing=10,orientation=Gtk.Orientation.HORIZONTAL)
        self.box.add(self.box3)

        self.box3.pack_start(self.page_menu(), True, True, 0)

        self.gui = draw_gui.DrawGUI(300, 200)
        self.gui.update_from(self.colors)
        self.gui.redraw()
        
        self.preview = Gtk.Image.new_from_surface(self.gui.surface)
        self.box3.pack_start(self.preview, True, True, 0)

        self.box2 = Gtk.Box(margin=5,spacing=5,orientation=Gtk.Orientation.HORIZONTAL)
        self.box.add(self.box2)

        self.button = Gtk.Button(label=_("Use Desktop Font"))
        self.button.connect("clicked", self.on_use_system_font_clicked)
        self.box2.pack_start(self.button, False, True, 0)

        self.connect("destroy", self.closing)

    def closing(self, widget):
        self.apply_changes_now()
        Gtk.main_quit()

    def apply_changes(self, val):
        if len(self.changes.keys()) > 0:
            if self.update_timer > 0:
                self.update_timer = self.update_timer - 1
            else:
                self.apply_changes_now()
        return 1

    def apply_changes_now(self):
        changes = self.changes
        if len(changes.keys()) > 0:
            self.changes = {}
            t = write_wine_reg.WriteWineReg(self.wine_prefix, self.wine_cmd, changes)
            t.write()


    def defaults(self):
        self.colors = default_colors.default_colors()

    def page_menu(self):
        g = Gtk.Grid(margin=5)
        
        ## MenuText
        font_chooser_menu_label = Gtk.Label(label=_("Menu Text"),margin=10)
        g.attach(font_chooser_menu_label, 0, 0, 1, 1)
        self.font_chooser_menu = Gtk.FontButton(margin=5)
        self.font_chooser_menu.set_font_desc(self.load_from("MenuFont"))
        g.attach(self.font_chooser_menu, 1, 0, 1,1)
        self.font_chooser_menu.connect("font-set", self.on_font_changed, "MenuFont")
        
        ## MenuText
        font_chooser_caption_label = Gtk.Label(label=_("Window Title"),margin=10)
        g.attach(font_chooser_caption_label, 0, 1, 1, 1)
        self.font_chooser_caption = Gtk.FontButton(margin=5)
        self.font_chooser_caption.set_font_desc(self.load_from("CaptionFont"))
        g.attach(self.font_chooser_caption, 1, 1, 1,1)
        self.font_chooser_caption.connect("font-set", self.on_font_changed, "CaptionFont")
        
        ## MenuText
        font_chooser_message_label = Gtk.Label(label=_("Message Box Text"),margin=10)
        g.attach(font_chooser_message_label, 0, 2, 1, 1)
        self.font_chooser_message = Gtk.FontButton(margin=5)
        self.font_chooser_message.set_font_desc(self.load_from("MessageFont"))
        g.attach(self.font_chooser_message, 1, 2, 1,1)
        self.font_chooser_message.connect("font-set", self.on_font_changed, "MessageFont")
        
        ## Status Font
        font_chooser_status_label = Gtk.Label(label=_("Tooltip Text"),margin=10)
        g.attach(font_chooser_status_label, 0, 3, 1, 1)
        self.font_chooser_status = Gtk.FontButton(margin=5)
        self.font_chooser_status.set_font_desc(self.load_from("StatusFont"))
        g.attach(self.font_chooser_status, 1, 3, 1,1)
        self.font_chooser_status.connect("font-set", self.on_font_changed, "StatusFont")
        return g

    def load_from(self, which):
        return self.to_pango(self.colors[which])

    def to_pango(self, c):
        font = Pango.FontDescription()
        font.set_family(c[0])
        font.set_weight(c[1])
        font.set_style(c[3])
        font.set_size(c[2] * Pango.SCALE)
        return font
        

    def on_button_clicked(self, widget):
        self.gui.redraw()
        self.preview.set_from_surface(self.gui.surface)
        

    def on_font_changed(self, widget, data_name):
        newfont = widget.get_font_desc()
        size = widget.get_font_size() / Pango.SCALE
        fontname = str(newfont.get_family())
        weight = int(newfont.get_weight())
        #variant = newfont.get_variant()
        style = int(newfont.get_style())
        val = [fontname, weight, round(size), style]
        self.gui.update(data_name, val)
        self.gui.redraw()
        self.preview.set_from_surface(self.gui.surface)
        self.update_timer = 60
        self.changes[data_name] = val

    def get_font_setting(self, key):
        f = self.interface_setting.get_string(key)
        m = re.match("^(.+) ([0-9]+)$", f)
        return (m[1], int(m[2]))

    def on_use_system_font_clicked(self, *args):
        self.set_from_system("MenuFont", self.font_chooser_menu)
        self.set_from_system("CaptionFont", self.font_chooser_caption)
        self.set_from_system("MessageFont", self.font_chooser_message)
        self.set_from_system("StatusFont", self.font_chooser_status)

    def set_from_system(self, data_name, font_chooser):
        (font_name, font_size) = self.get_font_setting("font-name")
        val = (font_name, 500, font_size, 0)
        font_chooser.set_font_desc(self.to_pango(val))
        self.gui.update(data_name, val)
        self.gui.redraw()
        self.preview.set_from_surface(self.gui.surface)
        self.update_timer = 60
        self.changes[data_name] = val


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: <prefix> <winecommand>",file=sys.stderr)
        sys.exit(1)
    m = MWin(sys.argv[1], sys.argv[2])
    m.show_all()
    Gtk.main()


