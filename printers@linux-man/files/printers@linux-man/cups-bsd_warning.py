#!/usr/bin/python3

import sys
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
import gettext

# i18n
gettext.install("printers@linux-man", "/usr/share/locale")

class CupsBsdWarning:
    def __init__(self):
        self.message_dialog = Gtk.MessageDialog(
            parent=Gtk.Window(),
            message_type=Gtk.MessageType.WARNING,
            title=window_title,
            text=message,
            buttons=Gtk.ButtonsType.OK
            )

        response = self.message_dialog.run()
        self.message_dialog.destroy()

if __name__ == "__main__":
    window_title = _("Printers")
    message = _("Missing dependency.\n'lpq' command is missing! Please install 'cups-bsd' package (if available).")
    CupsBsdWarning()
