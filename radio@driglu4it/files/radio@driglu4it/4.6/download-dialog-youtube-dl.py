#!/usr/bin/python3

import sys
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
import gettext
import subprocess
from pathlib import Path

# i18n
gettext.install("radio@driglu4it", str(Path.home()) + "/.local/share/locale")

class CancelDownload():
    def __init__(self):
        self.message_dialog = Gtk.MessageDialog(
            parent=Gtk.Window(),
            type=Gtk.MessageType.WARNING,
            title=window_title,
            message_format=message,
            buttons=Gtk.ButtonsType.NONE
            )
        self.message_dialog.add_buttons(continue_button_text, 0, more_info_button, 1, cancel_button_text, 2)

        response = self.message_dialog.run()
        if response == 0:
            print("Continue")
        elif response == 1:
            print("Cancel")
            subprocess.call(["xdg-open", "https://packages.debian.org/sid/all/youtube-dl/download"])
        else:
            print("Cancel")
        self.message_dialog.destroy()

if __name__ == "__main__":
    window_title = _("Download Confirmation Dialog")
    hyperlink_format = '<a href={link}">{text}</a>'
    githublink = hyperlink_format.format(link="https://github.com/hoyon/mpv-mpris", text="GitHub")
    message = _("This function depends on the newest version of the '%s' apt package. Currently the newest version of this package is only included in the Debian package respository but not yet in the default Linux Mint repositories.") % ('youtube-dl') + "\n\n" + _("Do you want to proceed the Installation at your own risk?")
    cancel_button_text = _("Cancel Installation")
    more_info_button = _("More info")
    continue_button_text = _("Install at my own risk")
    CancelDownload()
