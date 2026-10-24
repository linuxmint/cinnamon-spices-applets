
##
## Get colors from desktop theme.
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

import draw_gui
import read_theme
import read_wine_reg

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

class ColorFromTheme(Gtk.Dialog):
    def __init__(self, parent, wine_prefix):
        super().__init__(flags=0)
        
        self.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL)
        self.add_button(Gtk.STOCK_OK, Gtk.ResponseType.OK)

        self.set_modal(True)
        self.set_transient_for(parent)

        self.set_title(_("Color From Theme"))
        self.set_type_hint(Gdk.WindowTypeHint.DIALOG)
        self.defaults()

        self.wine_prefix = wine_prefix

        r = read_wine_reg.ReadWineReg(self.wine_prefix)
        r.read()
        for name in r.values.keys():
            self.colors[name] = r.values[name]

        self.box = Gtk.Box(margin=10,spacing=3,orientation=Gtk.Orientation.VERTICAL)
        self.get_content_area().add(self.box)

        self.box3 = Gtk.Box(margin=10,spacing=10,orientation=Gtk.Orientation.HORIZONTAL)
        self.box.add(self.box3)

        val = 1.5

        self.accent = -20.0/100.0
        self.emboss = (((val-1.0)*100) + 100.0) / 100.0

        self.systheme = read_theme.ReadSystemTheme()
        self.systheme.load_colors()
        c = self.systheme.get_colors(self.emboss, self.accent)
        for name in c.keys():
            self.colors[name] = c[name]

        self.gui = draw_gui.DrawGUI(300, 200)
        self.gui.update_from(self.colors)
        self.gui.redraw()
        
        self.preview = Gtk.Image.new_from_surface(self.gui.surface)
        self.box3.pack_start(self.preview, True, True, 0)


        accent_slider_box = Gtk.Box(margin=2,spacing=5,orientation=Gtk.Orientation.HORIZONTAL)
        self.box.add(accent_slider_box)
        accent_slider_label = Gtk.Label(label=_("Accent"),margin=10)
        accent_slider_box.pack_start(accent_slider_label, False, False, 0)
        self.accent_slider = Gtk.Scale(orientation=Gtk.Orientation.HORIZONTAL,adjustment=Gtk.Adjustment(lower=-100,upper=100,value=-20),margin=5)
        self.accent_slider.connect("value-changed", self.on_accent_changed, "unused")
        accent_slider_box.pack_start(self.accent_slider, True, True, 0)

        emboss_slider_box = Gtk.Box(margin=2,spacing=5,orientation=Gtk.Orientation.HORIZONTAL)
        self.box.add(emboss_slider_box)
        emboss_slider_label = Gtk.Label(label=_("Emboss Amount"),margin=10)
        emboss_slider_box.pack_start(emboss_slider_label, False, False, 0)
        self.emboss_slider = Gtk.Scale(orientation=Gtk.Orientation.HORIZONTAL,adjustment=Gtk.Adjustment(lower=0,upper=100,value=(val-1.0)*100),margin=5)
        self.emboss_slider.connect("value-changed", self.on_emboss_changed, "unused")
        emboss_slider_box.pack_start(self.emboss_slider, True, True, 0)



        self.box2 = Gtk.Box(spacing=10,orientation=Gtk.Orientation.HORIZONTAL)
        self.box.pack_start(self.box2, True, True, 0)

        self.show_all()

    def defaults(self):
        self.colors = default_colors.default_colors()

    def load_from(self, which):
        c = self.colors[which]
        return Gdk.RGBA(c[0] / 255.0, c[1] / 255.0, c[2] / 255.0, 1.0)


    def on_accent_changed(self, widget, data_name):
        self.accent = widget.get_value()/100.0
        self.update()

    def on_emboss_changed(self, widget, data_name):
        self.emboss = (widget.get_value() + 100.0) / 100.0
        self.update()

    def update(self):
        c = self.systheme.get_colors(self.emboss, self.accent)
        for name in c.keys():
            self.colors[name] = c[name]
            self.gui.update(name, c[name])
        self.gui.redraw()
        self.preview.set_from_surface(self.gui.surface)


