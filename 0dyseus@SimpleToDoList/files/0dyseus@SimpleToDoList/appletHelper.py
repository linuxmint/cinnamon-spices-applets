#!/usr/bin/python3

"""
This file is just a helper to open a Gtk.FileChooserDialog from an xlet code.
All the _import_export function does is to print a path to then be used on
the JavaScript side of the xlet.
"""

import os
import gettext
import sys
import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk

gettext.install("cinnamon", "/usr/share/locale")

HOME = os.path.expanduser("~")
APPLET_DIR = os.path.dirname(os.path.abspath(__file__))
APPLET_UUID = str(os.path.basename(APPLET_DIR))

TRANSLATIONS = {}


def _(string):
    # check for a translation for this xlet
    if APPLET_UUID not in TRANSLATIONS:
        try:
            TRANSLATIONS[APPLET_UUID] = gettext.translation(
                APPLET_UUID, HOME + "/.local/share/locale").gettext
        except IOError:
            try:
                TRANSLATIONS[APPLET_UUID] = gettext.translation(
                    APPLET_UUID, "/usr/share/locale").gettext
            except IOError:
                TRANSLATIONS[APPLET_UUID] = None

    # do not translate white spaces
    if not string.strip():
        return string

    if TRANSLATIONS[APPLET_UUID]:
        result = TRANSLATIONS[APPLET_UUID](string)

        try:
            result = result.decode("utf-8")
        except:
            result = result

        if result != string:
            return result

    return gettext.gettext(string)


def _import_export(type):
    try:
        last_dir = os.path.dirname(sys.argv[2])
    except:
        last_dir = None

    if type == "export":
        mode = Gtk.FileChooserAction.SAVE
        string = _("Select or enter file to export to")
        # TO TRANSLATORS: Could be left blank.
        btns = (_("_Cancel"), Gtk.ResponseType.CANCEL,
                _("_Save"), Gtk.ResponseType.ACCEPT)
    elif type == "import":
        mode = Gtk.FileChooserAction.OPEN
        string = _("Select a file to import")
        # TO TRANSLATORS: Could be left blank.
        btns = (_("_Cancel"), Gtk.ResponseType.CANCEL,
                # TO TRANSLATORS: Could be left blank.
                _("_Open"), Gtk.ResponseType.OK)
    elif type == "save":
        mode = Gtk.FileChooserAction.SAVE
        string = _("Select a file to save to")
        # TO TRANSLATORS: Could be left blank.
        btns = (_("_Cancel"), Gtk.ResponseType.CANCEL,
                _("_Save"), Gtk.ResponseType.ACCEPT)

    dialog = Gtk.FileChooserDialog(parent=None,
                                   title=string,
                                   action=mode,
                                   buttons=btns)

    if last_dir is not None:
        dialog.set_current_folder(last_dir)

    if type == "export" or type == "save":
        dialog.set_do_overwrite_confirmation(True)

    filter_text = Gtk.FileFilter()

    if type == "save":
        filter_text.add_pattern("*")
        filter_text.set_name(_("TODO files"))
    else:
        filter_text.add_pattern("*.json")
        filter_text.set_name(_("JSON files"))

    dialog.add_filter(filter_text)

    response = dialog.run()

    if response == Gtk.ResponseType.ACCEPT or response == Gtk.ResponseType.OK:
        filename = dialog.get_filename()

        if type == "export" and ".json" not in filename:
            filename = filename + ".json"

        # The file path is "stripped/trimmed" on the JavaScript side.
        print(filename)

    dialog.destroy()


if __name__ == "__main__":
    try:
        arg = sys.argv[1]
    except:
        arg = None

    if arg == "export":
        _import_export("export")
    elif arg == "import":
        _import_export("import")
    elif arg == "save":
        _import_export("save")
    else:
        print(_("Nothing to do here."))
