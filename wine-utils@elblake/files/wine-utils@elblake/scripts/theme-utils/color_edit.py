#!/usr/bin/env python3

##
## Color Editor
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

import color_from_theme
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


class ColorEdit(Gtk.Window):
    def __init__(self, wine_prefix, wine_cmd):
        super().__init__()

        self.set_title(_("Edit Colors"))
        self.set_type_hint(Gdk.WindowTypeHint.DIALOG)

        self.wine_prefix = wine_prefix
        self.wine_cmd = wine_cmd
        self.defaults()

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

        mm = Gtk.Notebook(margin=0)
        self.box3.pack_start(mm, True, True, 0)

        mm.append_page(self.page_menu(), Gtk.Label(label=_("Menu")))
        mm.append_page(self.page_button(), Gtk.Label(label=_("Button")))
        mm.append_page(self.page_window(), Gtk.Label(label=_("Window")))
        mm.append_page(self.page_misc(), Gtk.Label(label=_("Misc")))

        self.gui = draw_gui.DrawGUI(300, 200)
        self.gui.update_from(self.colors)
        self.gui.redraw()
        
        self.preview = Gtk.Image.new_from_surface(self.gui.surface)
        self.box3.pack_start(self.preview, True, True, 0)

        self.box2 = Gtk.Box(spacing=10,orientation=Gtk.Orientation.HORIZONTAL)
        self.box.pack_start(self.box2, True, True, 0)
        
        button = Gtk.Button(label=_("Colors From Theme"))
        button.connect("clicked", self.on_colors_from_theme_clicked)
        self.box2.pack_start(button, False, True, 0)

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


    def on_button_save(self, widget):
        return

    def on_button_cancel(self, widget):
        return

    def defaults(self):
        self.colors = default_colors.default_colors()

    def page_misc(self):
        g = Gtk.Grid(margin=5)

        ## "ButtonAlternateFace"
        controls_alternate_background_col_label = Gtk.Label(label=_("Controls Alternate Background"),margin=10)
        g.attach(controls_alternate_background_col_label, 0, 0, 1, 1)
        self.controls_alternate_background_col = Gtk.ColorButton(margin=5)
        self.controls_alternate_background_col.set_rgba(self.load_from("ButtonAlternateFace"))
        g.attach(self.controls_alternate_background_col, 1, 0, 1,1)
        self.controls_alternate_background_col.connect("color-set", self.on_color_changed, "ButtonAlternateFace")
        
        ## "ActiveBorder"
        active_border_col_label = Gtk.Label(label=_("Active Border"),margin=10)
        g.attach(active_border_col_label, 0, 1, 1, 1)
        self.active_border_col = Gtk.ColorButton(margin=5)
        self.active_border_col.set_rgba(self.load_from("ActiveBorder"))
        g.attach(self.active_border_col, 1, 1, 1,1)
        self.active_border_col.connect("color-set", self.on_color_changed, "ActiveBorder")

        ## "InactiveTitleText"
        inactive_title_text_col_label = Gtk.Label(label=_("Inactive Title Text"),margin=10)
        g.attach(inactive_title_text_col_label, 0, 2, 1, 1)
        self.inactive_title_text_col = Gtk.ColorButton(margin=5)
        self.inactive_title_text_col.set_rgba(self.load_from("InactiveTitleText"))
        g.attach(self.inactive_title_text_col, 1, 2, 1,1)
        self.inactive_title_text_col.connect("color-set", self.on_color_changed, "InactiveTitleText")
        
        ## "WindowFrame"
        window_frame_col_label = Gtk.Label(label=_("Window Frame"),margin=10)
        g.attach(window_frame_col_label, 0, 3, 1, 1)
        self.window_frame_col = Gtk.ColorButton(margin=5)
        self.window_frame_col.set_rgba(self.load_from("WindowFrame"))
        g.attach(self.window_frame_col, 1, 3, 1,1)
        self.window_frame_col.connect("color-set", self.on_color_changed, "WindowFrame")

        return g

    def page_button(self):
        g = Gtk.Grid(margin=5)

        ## "ButtonDkShadow"
        controls_dark_shadow_col_label = Gtk.Label(label=_("Controls Dark Shadow"),margin=10)
        g.attach(controls_dark_shadow_col_label, 0, 0, 1, 1)
        self.controls_dark_shadow_col = Gtk.ColorButton(margin=5)
        self.controls_dark_shadow_col.set_rgba(self.load_from("ButtonDkShadow"))
        g.attach(self.controls_dark_shadow_col, 1, 0, 1,1)
        self.controls_dark_shadow_col.connect("color-set", self.on_color_changed, "ButtonDkShadow")
        
        ## "ButtonFace"
        controls_background_col_label = Gtk.Label(label=_("Controls Background"),margin=10)
        g.attach(controls_background_col_label, 0, 1, 1, 1)
        self.controls_background_col = Gtk.ColorButton(margin=5)
        self.controls_background_col.set_rgba(self.load_from("ButtonFace"))
        g.attach(self.controls_background_col, 1, 1, 1,1)
        self.controls_background_col.connect("color-set", self.on_color_changed, "ButtonFace")
        
        ## "ButtonHilight"
        controls_hilight_col_label = Gtk.Label(label=_("Controls Highlight"),margin=10)
        g.attach(controls_hilight_col_label, 0, 2, 1, 1)
        self.controls_hilight_col = Gtk.ColorButton(margin=5)
        self.controls_hilight_col.set_rgba(self.load_from("ButtonHilight"))
        g.attach(self.controls_hilight_col, 1, 2, 1,1)
        self.controls_hilight_col.connect("color-set", self.on_color_changed, "ButtonHilight")
        
        ## "ButtonLight"
        controls_light_col_label = Gtk.Label(label=_("Controls Light"),margin=10)
        g.attach(controls_light_col_label, 0, 3, 1, 1)
        self.controls_light_col = Gtk.ColorButton(margin=5)
        self.controls_light_col.set_rgba(self.load_from("ButtonLight"))
        g.attach(self.controls_light_col, 1, 3, 1,1)
        self.controls_light_col.connect("color-set", self.on_color_changed, "ButtonLight")
        
        ## "ButtonShadow"
        controls_shadow_col_label = Gtk.Label(label=_("Controls Shadow"),margin=10)
        g.attach(controls_shadow_col_label, 0, 4, 1, 1)
        self.controls_shadow_col = Gtk.ColorButton(margin=5)
        self.controls_shadow_col.set_rgba(self.load_from("ButtonShadow"))
        g.attach(self.controls_shadow_col, 1, 4, 1,1)
        self.controls_shadow_col.connect("color-set", self.on_color_changed, "ButtonShadow")
        
        ## "ButtonText"
        controls_text_col_label = Gtk.Label(label=_("Controls Text"),margin=10)
        g.attach(controls_text_col_label, 0, 5, 1, 1)
        self.controls_text_col = Gtk.ColorButton(margin=5)
        self.controls_text_col.set_rgba(self.load_from("ButtonText"))
        g.attach(self.controls_text_col, 1, 5, 1,1)
        self.controls_text_col.connect("color-set", self.on_color_changed, "ButtonText")
        
        ## "GrayText"
        gray_text_col_label = Gtk.Label(label=_("Gray Text"),margin=10)
        g.attach(gray_text_col_label, 0, 6, 1, 1)
        self.gray_text_col = Gtk.ColorButton(margin=5)
        self.gray_text_col.set_rgba(self.load_from("GrayText"))
        g.attach(self.gray_text_col, 1, 6, 1,1)
        self.gray_text_col.connect("color-set", self.on_color_changed, "GrayText")

        return g

    def page_menu(self):
        s0 = Gtk.Box(margin=0,spacing=0,orientation=Gtk.Orientation.VERTICAL)
        g = Gtk.Grid(margin=5)
        s0.add(g)

        ## "Menu"
        menu_background_col_label = Gtk.Label(label=_("Menu Background"),margin=10)
        g.attach(menu_background_col_label, 0, 0, 1, 1)
        self.menu_background_col = Gtk.ColorButton(margin=5)
        self.menu_background_col.set_rgba(self.load_from("Menu"))
        g.attach(self.menu_background_col, 1, 0, 1,1)
        self.menu_background_col.connect("color-set", self.on_color_changed, "Menu")
        
        ## MenuBar
        menu_bar_col_label = Gtk.Label(label=_("Menu Bar"),margin=10)
        g.attach(menu_bar_col_label, 0, 1, 1, 1)
        self.menu_bar_col = Gtk.ColorButton(margin=5)
        self.menu_bar_col.set_rgba(self.load_from("MenuBar"))
        g.attach(self.menu_bar_col, 1, 1, 1,1)
        self.menu_bar_col.connect("color-set", self.on_color_changed, "MenuBar")

        ## Hilight
        selection_hilight_col_label = Gtk.Label(label=_("Selection Highlight"),margin=10)
        g.attach(selection_hilight_col_label, 0, 2, 1, 1)
        self.selection_hilight_col = Gtk.ColorButton(margin=5)
        self.selection_hilight_col.set_rgba(self.load_from("Hilight"))
        g.attach(self.selection_hilight_col, 1, 2, 1,1)
        self.selection_hilight_col.connect("color-set", self.on_color_changed, "Hilight")
        
        ## MenuText
        menu_text_col_label = Gtk.Label(label=_("Menu Text"),margin=10)
        g.attach(menu_text_col_label, 0, 3, 1, 1)
        self.menu_text_col = Gtk.ColorButton(margin=5)
        self.menu_text_col.set_rgba(self.load_from("MenuText"))
        g.attach(self.menu_text_col, 1, 3, 1,1)
        self.menu_text_col.connect("color-set", self.on_color_changed, "MenuText")

        s = Gtk.Box(margin=2,spacing=2,orientation=Gtk.Orientation.HORIZONTAL)
        s0.add(s)
        menu_height_slider_label = Gtk.Label(label=_("Menu Height"),margin=10)
        s.pack_start(menu_height_slider_label, False, False, 0)
        self.menu_height_slider = Gtk.Scale(orientation=Gtk.Orientation.HORIZONTAL,adjustment=self.adjustment_from("MenuHeight"),margin=5)
        self.menu_height_slider.connect("value-changed", self.on_value_changed, ["MenuHeight","MenuWidth"])
        s.pack_start(self.menu_height_slider, True, True, 0)
        return s0

    def page_window(self):
        s0 = Gtk.Box(margin=0,spacing=0,orientation=Gtk.Orientation.VERTICAL)
        g = Gtk.Grid(margin=5)
        s0.add(g)

        ## "Scrollbar"
        scrollbar_col_label = Gtk.Label(label=_("Scrollbar"),margin=10)
        g.attach(scrollbar_col_label, 0, 0, 1, 1)
        self.scrollbar_col = Gtk.ColorButton(margin=5)
        self.scrollbar_col.set_rgba(self.load_from("Scrollbar"))
        g.attach(self.scrollbar_col, 1, 0, 1,1)
        self.scrollbar_col.connect("color-set", self.on_color_changed, "Scrollbar")
        
        ## "Window"
        window_background_col_label = Gtk.Label(label=_("Window Background"),margin=10)
        g.attach(window_background_col_label, 0, 1, 1, 1)
        self.window_background_col = Gtk.ColorButton(margin=5)
        self.window_background_col.set_rgba(self.load_from("Window"))
        g.attach(self.window_background_col, 1, 1, 1,1)
        self.window_background_col.connect("color-set", self.on_color_changed, "Window")
        
        ## "WindowText"
        window_text_col_label = Gtk.Label(label=_("Window Text"),margin=10)
        g.attach(window_text_col_label, 0, 2, 1, 1)
        self.window_text_col = Gtk.ColorButton(margin=5)
        self.window_text_col.set_rgba(self.load_from("WindowText"))
        g.attach(self.window_text_col, 1, 2, 1,1)
        self.window_text_col.connect("color-set", self.on_color_changed, "WindowText")
        
        ## "InfoText"
        tooltip_text_col_label = Gtk.Label(label=_("Tooltip Text"),margin=10)
        g.attach(tooltip_text_col_label, 0, 3, 1, 1)
        self.tooltip_text_col = Gtk.ColorButton(margin=5)
        self.tooltip_text_col.set_rgba(self.load_from("InfoText"))
        g.attach(self.tooltip_text_col, 1, 3, 1,1)
        self.tooltip_text_col.connect("color-set", self.on_color_changed, "InfoText")
        
        ## "InfoWindow"
        tooltip_background_col_label = Gtk.Label(label=_("Tooltip Background"),margin=10)
        g.attach(tooltip_background_col_label, 0, 4, 1, 1)
        self.tooltip_background_col = Gtk.ColorButton(margin=5)
        self.tooltip_background_col.set_rgba(self.load_from("InfoWindow"))
        g.attach(self.tooltip_background_col, 1, 4, 1,1)
        self.tooltip_background_col.connect("color-set", self.on_color_changed, "InfoWindow")

        s = Gtk.Box(margin=2,spacing=2,orientation=Gtk.Orientation.HORIZONTAL)
        s0.add(s)
        scrollbar_height_slider_label = Gtk.Label(label=_("Scrollbar Height"),margin=10)
        s.pack_start(scrollbar_height_slider_label, False, False, 0)
        self.scrollbar_height_slider = Gtk.Scale(orientation=Gtk.Orientation.HORIZONTAL,adjustment=self.adjustment_from("ScrollHeight"),margin=5)
        self.scrollbar_height_slider.connect("value-changed", self.on_value_changed, ["ScrollHeight", "ScrollWidth"])
        s.pack_start(self.scrollbar_height_slider, True, True, 0)

        return s0

    def adjustment_from(self, name):
        val = (-int(self.colors[name])) / 15.0
        return Gtk.Adjustment(lower=10,upper=100,value=val)

    def load_from(self, which):
        c = self.colors[which]
        return Gdk.RGBA(c[0] / 255.0, c[1] / 255.0, c[2] / 255.0, 1.0)

    def on_colors_from_theme_clicked(self, widget):
        themecolor = color_from_theme.ColorFromTheme(self, self.wine_prefix)
        ret = themecolor.run()
        if ret == Gtk.ResponseType.OK:
            if themecolor.colors != None:
                keys = ["ActiveBorder","ButtonAlternateFace","ButtonDkShadow","ButtonFace",
                    "ButtonHilight","ButtonLight","ButtonShadow","ButtonText","GrayText",
                    "Hilight","InactiveTitleText","InfoText","InfoWindow","Menu","MenuBar",
                    "MenuHilight","MenuText","Scrollbar","Window","WindowFrame","WindowText"]
                self.update_timer = 60
                for name in themecolor.colors.keys():
                    if name in keys:
                        val = themecolor.colors[name]
                        if len(val) == 3:
                            self.colors[name] = val
                            self.changes[name] = val
                self.gui.update_from(self.colors)
                self.gui.redraw()
                self.preview.set_from_surface(self.gui.surface)
        themecolor.destroy()

    def on_color_changed(self, widget, data_name):
        color = widget.get_rgba()
        val = [round(color.red*255), round(color.green*255), round(color.blue*255)]
        self.gui.update(data_name, val)
        self.gui.redraw()
        self.preview.set_from_surface(self.gui.surface)
        self.update_timer = 60
        self.changes[data_name] = val

    def on_value_changed(self, widget, data_name):
        # twips value / 10 = pixels
        val = -round(widget.get_value() * 15)
        self.update_timer = 60
        for name in data_name:
            self.gui.update(name, val)
            self.changes[name] = val
        self.gui.redraw()
        self.preview.set_from_surface(self.gui.surface)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: <prefix> <winecommand>",file=sys.stderr)
        sys.exit(1)
    m = ColorEdit(sys.argv[1], sys.argv[2])
    m.show_all()
    Gtk.main()


