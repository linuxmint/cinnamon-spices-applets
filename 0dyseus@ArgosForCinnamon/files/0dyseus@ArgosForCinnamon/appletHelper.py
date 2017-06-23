#!/usr/bin/python3

"""
This file is just a helper to open a Gtk.FileChooserDialog from an xlet code.
All the _file_chooser function does is to print a path to then be used on
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


def _file_chooser():
    try:
        last_dir = os.path.dirname(sys.argv[2])
    except:
        last_dir = None

    mode = Gtk.FileChooserAction.OPEN
    string = _("Select a file")
    # TO TRANSLATORS: Could be left blank.
    btns = (_("_Cancel"), Gtk.ResponseType.CANCEL,
            # TO TRANSLATORS: Could be left blank.
            _("_Open"), Gtk.ResponseType.OK)

    dialog = Gtk.FileChooserDialog(parent=None,
                                   title=string,
                                   action=mode,
                                   buttons=btns)

    if last_dir is not None:
        dialog.set_current_folder(last_dir)

    response = dialog.run()

    if response == Gtk.ResponseType.OK:
        filename = dialog.get_filename()

        # The file path is "stripped/trimmed" on the JavaScript side.
        print(filename)

    dialog.destroy()


if __name__ == "__main__":
    try:
        arg = sys.argv[1]
    except:
        arg = None

    if arg == "open":
        _file_chooser()
    else:
        print(_("Nothing to do here."))
