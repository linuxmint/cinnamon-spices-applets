#!/usr/bin/env python3

##
## Automatically find wine prefixes
##

import os
import sys
import re

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
from gi.repository import Gdk
from gi.repository import GLib
from gi.repository import Gio

import locale

UUID = 'wine-utils@elblake'

locale.setlocale(locale.LC_MESSAGES, "")
locale.textdomain(UUID)
locale.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale")

def _(str0):
    str1 = locale.dgettext(UUID, str0)
    if str1 == '':
        return str0
    return str1


## Iterate through folders for .desktop files
##
def iterate_paths(prefixes, path):
    file_list = os.listdir(path)
    for file in file_list:
        if file == '.' or file == '..':
            continue
        if os.path.isdir(os.path.join(path, file)):
            iterate_paths(prefixes, os.path.join(path, file) + "/")
        else:
            if re.match("^.+\\.desktop$", file) != None:
                try:
                    app_info = Gio.DesktopAppInfo.new_from_filename(os.path.join(path, file))
                except TypeError:
                    continue
                finally:
                    if app_info == None:
                        continue
                    app_info_cmd = app_info.get_string("Exec")
                    if app_info_cmd == None:
                        continue
                    prefix_match = re.match("^env\s+WINEPREFIX=\"([^\"]+)\"\s+(\S+)\s+", app_info_cmd)
                    if prefix_match != None:
                        prefix = prefix_match[1]
                        #wine_cmd = prefix_match[2]
                        if not os.path.isdir(prefix):
                            continue
                        if prefix in prefixes.keys():
                            prefixes[prefix] += "; "
                        else:
                            prefixes[prefix] = ""
                        app_info_name = app_info.get_string("Name")
                        if app_info_name != None:
                            app_info_name = re.sub("[<>]", " ", app_info_name)
                            prefixes[prefix] += app_info_name
                        else:
                            prefixes[prefix] += ""

## Is this the default prefix?
def main_prefix(prefix):
    prefix = re.sub("/\\./", "/", re.sub("//+", "/", re.sub("/+$", "", prefix)))
    home = re.sub("/\\./", "/", re.sub("//+", "/", re.sub("/+$", "", os.getenv("HOME"))))
    return prefix == (home + "/.wine")

## Find prefixes
##
def automatically_find_prefixes():
    paths = [
        GLib.get_user_data_dir() + "/applications/wine",
    ]
    if os.getenv("XDG_DATA_HOME") != None:
        for f1 in os.getenv("XDG_DATA_HOME").split(":"):
            filename = os.path.join(f1, "applications", "wine")
            if os.path.isdir(filename):
                paths.append(filename)
    for f1 in os.getenv("XDG_DATA_DIRS").split(":"):
        filename = os.path.join(f1, "applications", "wine")
        if os.path.isdir(filename):
            paths.append(filename)
    prefixes = {}
    for path in paths:
        if os.path.isdir(path):
            iterate_paths(prefixes, path + "/")
    for prefix in prefixes.keys():
        names = _("Unknown")
        if main_prefix(prefix):
            names = _("Default")
        else:
            names_list = prefixes[prefix].split("; ")
            names_list_len = len(names_list)
            if names_list_len == 1:
                names = names_list[0]
            elif names_list_len > 1:
                fmt = _("{} + {:d} more")
                if re.match("^[^{]*{[^d]*}", fmt):
                    names = fmt.format(names_list[0], names_list_len-1)
                else:
                    names = fmt.format(names_list_len-1, names_list[0])
        print("<" + prefix + "> <" + names + ">")

if __name__ == '__main__':
    automatically_find_prefixes()





