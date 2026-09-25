
##
## Read the current system theme.
##

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gio

import read_theme_gtk2
import write_wine_reg
import subprocess

import os
import sys
import math

class ReadSystemTheme:

    def __init__(self):
        self.theme_settings = Gio.Settings.new("org.cinnamon.theme")
        self.interface_settings = Gio.Settings.new("org.cinnamon.desktop.interface")

    def find_theme_file(self, theme):
        if os.getenv("XDG_CONFIG_HOME") != None:
            for f1 in os.getenv("XDG_CONFIG_HOME").split(":"):
                filename = os.path.join(f1, "gtk-2.0/gtkrc")
                if os.path.isfile(filename):
                    return filename
        if os.getenv("XDG_DATA_HOME") != None:
            for f1 in os.getenv("XDG_DATA_HOME").split(":"):
                filename = os.path.join(f1, "themes", theme, "gtk-2.0/gtkrc")
                if os.path.isfile(filename):
                    return filename
        if os.getenv("HOME") != None:
            for f1 in os.getenv("HOME").split(":"):
                filename = os.path.join(f1, ".themes", theme, "gtk-2.0/gtkrc")
                if os.path.isfile(filename):
                    return filename
        for f1 in os.getenv("XDG_DATA_DIRS").split(":"):
            filename = os.path.join(f1, "themes", theme, "gtk-2.0/gtkrc")
            if os.path.isfile(filename):
                return filename
        raise "Theme not found"


    def find_color(self, l, color1):
        for s in l:
            if s in color1:
                return color1[s]
        return [0,258,0]

    def shade(self, a, b1):
        
        [r,g,b] = b1
        r = a * r
        g = a * g
        b = a * b
        if r > 255.0:
            r = 255.0
        if g > 255.0:
            g = 255.0
        if b > 255.0:
            b = 255.0
        return [int(r),int(g),int(b)]
        
    def load_colors(self):
        t_name = self.theme_settings.get_string("name")
        if t_name == None:
            t_name = self.interface_settings.get_string("gtk-theme")

        filename = self.find_theme_file(t_name)
        b = read_theme_gtk2.ThemeFile()
        self.color1 = b.load(filename)
        
    def get_colors(self, shade_range, accent1):
        color1 = self.color1
        c = {}
        c["Menu"] = self.find_color(
            ["GtkMenuBar.GtkMenuItem.bg.normal",
             "GtkMenu.GtkMenuItem.bg.normal",
             "GtkMenuItem.bg.normal",
             "GtkMenuBar.bg.normal",
             "GtkMenu.bg.normal"], color1)
        c["MenuBar"] = self.find_color(
            ["GtkMenuBar.GtkMenuItem.bg.normal",
             "GtkMenu.GtkMenuItem.bg.normal",
             "GtkMenuItem.bg.normal",
             "GtkMenuBar.bg.normal",
             "GtkMenu.bg.normal"], color1)
        c["MenuHilight"] = self.find_color(
            ["GtkMenuBar.GtkMenuItem.bg.prelight",
             "GtkMenuItem.bg.prelight",
             "GtkMenuBar.bg.prelight",
             "GtkMenu.bg.prelight"], color1)
        c["MenuText"] = self.find_color(
            ["GtkMenuBar.GtkMenuItem.fg.normal",
             "GtkMenuBar.GtkMenuItem.text.normal",
             "GtkMenu.GtkMenuItem.fg.normal",
             "GtkMenu.GtkMenuItem.text.normal"
             "GtkMenuItem.fg.normal",
             "GtkMenuItem.text.normal",
             "GtkMenuItem.fg.prelight",
             "GtkMenuItem.text.prelight",
             "GtkMenuBar.fg.normal",
             "GtkMenuBar.text.normal",
             "GtkMenu.fg.normal",
             "GtkMenu.text.normal",], color1)

        #shade_range = 1.5
        c["ButtonDkShadow"] = self.shade(1.0 / shade_range, self.find_color(
            ["GtkWidget.bg.normal"], color1))
        c["ButtonFace"] = self.find_color(
            ["GtkWidget.bg.normal"], color1)
        c["ButtonHilight"] = self.shade(shade_range,self.find_color(
            ["GtkWidget.bg.normal"], color1))
        c["ButtonLight"] = self.shade(1.0 + ((shade_range - 1.0) / 2.0), self.find_color(
            ["GtkWidget.bg.normal"], color1))
        c["ButtonShadow"] = self.shade(1.0 / (1.0 + ((shade_range - 1.0) / 2.0)), self.find_color(
            ["GtkWidget.bg.normal"], color1))
        c["ButtonText"] = self.find_color(
            ["GtkWidget.text.normal",
             "GtkWidget.fg.normal"], color1)

        c["GrayText"] = self.find_color(
            ["GtkWidget.text.insensitive",
             "GtkWidget.fg.insensitive"], color1)
        c["InfoText"] = self.find_color(
            ["gtk-tooltip*.text.normal",
             "gtk-tooltip*.fg.normal",
             "gtk-tooltips*.text.normal",
             "gtk-tooltips*.fg.normal"], color1)
        c["InfoWindow"] = self.find_color(
            ["gtk-tooltip*.bg.normal",
             "gtk-tooltips*.bg.normal",
             "gtk-tooltip*.bg.selected",
             "gtk-tooltips*.bg.selected"], color1)

        c["Scrollbar"] = self.shade(1.0 / math.pow(0.5, (accent1*0.5)), self.find_color(
            ["GtkWidget.bg.normal"], color1))
        c["Window"] = self.shade(1.0 / math.pow(0.5, accent1), self.find_color(
            ["GtkWidget.bg.normal"], color1))
        c["WindowFrame"] = self.find_color(
            ["GtkWidget.fg.normal",
             "GtkWidget.text.normal"], color1)
        c["WindowText"] = self.find_color(
            ["GtkWidget.text.normal",
             "GtkWidget.fg.normal"], color1)
        c["ActiveBorder"] = self.find_color(
            ["GtkWidget.fg.prelight",
             "GtkWidget.fg.selected",
             "GtkWidget.bg.prelight",
             "GtkWidget.bg.selected"], color1)

        c["MenuFont"]=["Liberation Sans", 500, 10, 0]
        return c


if __name__ == '__main__':
    c = ReadSystemTheme().get_colors()
    write_wine_reg.WriteWineReg(c, sys.stdout).menu_color()


