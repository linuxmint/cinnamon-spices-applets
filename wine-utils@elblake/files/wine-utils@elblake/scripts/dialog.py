#!/usr/bin/env python3

##
## Dialog boxes for shell scripts:
##
## Run Command (has browse button)
## Error message box
##

import os
import sys
import re

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
from gi.repository import Gdk
from gi.repository import GLib

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


## Run command dialog
##
class RunDialog(Gtk.Window):
    def __init__(self, msg, title):
        super().__init__(type='toplevel')
        
        self.set_border_width(10)
        self.set_title(title)
        self.resize(400, 180)
        self.set_type_hint(Gdk.WindowTypeHint.DIALOG)

        vbox = Gtk.VBox()

        fill1 = Gtk.Label()
        vbox.pack_start(fill1, True, True, 0)

        label = Gtk.Label(label=msg)
        label.set_xalign(0.0)
        vbox.pack_start(label, False, True, 0)

        entry = Gtk.Entry()
        vbox.pack_start(entry, False, True, 0)
        self.entry = entry

        run_in_console_window = Gtk.CheckButton(label=_("Run in Console Window"))
        vbox.pack_start(run_in_console_window, False, True, 0)
        self.run_in_console_window = run_in_console_window

        fill2 = Gtk.Label()
        vbox.pack_start(fill2, True, True, 0)

        vbox.pack_start(self.run_dialog_button_row(), False, True, 0)
        self.add(vbox)

        entry.set_activates_default(True)

        self.connect("destroy", self.run_dialog_destroy_evt)
        self.connect("key_press_event", self.run_dialog_key_press_event_evt)
        entry.connect("activate", self.okay)
    
    def run_dialog_destroy_evt(self, widget):
        Gtk.main_quit()
        return True

    def run_dialog_key_press_event_evt(self, unused, evt):
        if (evt.keyval == Gdk.KEY_Escape):
            Gtk.main_quit()
            return True
        return False

    def okay (self, widget):
        self.run_dialog_exit(self.entry, self.run_in_console_window)

    def run_dialog_exit(self, entry, run_in_console_window):
        command = entry.get_text().strip()
        if command != "":
            command = self.adjust_path(command)
            console = run_in_console_window.get_active()
            if console == True:
                command = "-console:" + command
            print(command)
        Gtk.main_quit()

    def adjust_path(self, command):
        if command.startswith("/") and os.path.isfile(re.sub("\\\\ ", " ", command)):
            return command
        m = re.match("^\"([^\"]+)\"(.*)$", command)
        if m != None:
            return "\"" + self.backslashes(self.expand_path(m[1].strip())) + "\"" + self.backslashes(m[2])
        else:
            command = self.expand_path(command)
            if command.startswith("/") and os.path.isfile(re.sub("\\\\ ", " ", command)):
                return command
            return self.backslashes(command)

    def expand_path(self, command):
        if re.match("^~/", command) != None:
            homedir = os.getenv("HOME")
            while homedir.endswith("/"):
                homedir = homedir.removesuffix("/")
            homedir = homedir + "/"
            command = re.sub("^~/", homedir, command)
        return command
    
    def backslashes(self, command):
        command = re.sub("\\\\", "\\\\\\\\", command)
        return command

    def run_dialog_button_row_dismiss_clicked_evt(self, widget):
        Gtk.main_quit()

    def run_dialog_button_row_browse_clicked_evt(self, widget):
        self.run_dialog_browse(self.entry)


    ## Create the buttons for the run command dialog
    ##
    def run_dialog_button_row (self):
        
        btn_label_okay = _("Okay")
        btn_label_dismiss = _("Cancel")
        btn_label_browse = _("Browse Files...")
        hbox = Gtk.HBox()

        button_okay = Gtk.Button(label=btn_label_okay)
        hbox.pack_end(button_okay, False, True, 0)
        button_okay.connect("clicked", self.okay)

        button_dismiss = Gtk.Button(label=btn_label_dismiss)
        hbox.pack_end(button_dismiss, False, True, 0)
        button_dismiss.connect("clicked", self.run_dialog_button_row_dismiss_clicked_evt)

        button_browse = Gtk.Button(label=btn_label_browse)
        hbox.pack_start(button_browse, False, True, 0)
        button_browse.connect("clicked", self.run_dialog_button_row_browse_clicked_evt)

        return hbox

    def run_dialog_browse (self, entry):
        title = _("Choose Program")
        browse_dialog = Gtk.FileChooserDialog(
            title=title,
            parent=self,
            action=Gtk.FileChooserAction.OPEN,
            )
        browse_dialog.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            Gtk.STOCK_OPEN, Gtk.ResponseType.OK
        )
        browse_dialog.set_default_size(800, 400)
        response = browse_dialog.run()
        if response == Gtk.ResponseType.OK:
            file = browse_dialog.get_filename()
            entry.set_text(self.quote_path(file))
        browse_dialog.destroy()

    def quote_path (self, filename):
        if len(re.findall("['\"\\s]", filename)) > 0:
            filename = re.sub("\"", "\\\\\"", filename)
            return '"' + filename + '"'
        return filename


def run_dialog (msg, title):
    window = RunDialog(msg, title)
    window.show_all()
    Gtk.main()


## Info dialog
##
class InfoDialog(Gtk.Window):
    def __init__(self, msg, title):
        super().__init__(type='toplevel')
        
        self.set_border_width(10)
        self.set_title(title)
        self.resize(500, 220)
        self.set_type_hint(Gdk.WindowTypeHint.DIALOG)

        vbox = Gtk.VBox()

        hbox = Gtk.HBox()
        hbox.set_spacing(25)
        hbox.set_border_width(15)
        vbox.add(hbox)

        image_vbox = Gtk.VBox()
        image = Gtk.Image.new_from_icon_name("dialog-warning", Gtk.IconSize.DIALOG)
        image_vbox.pack_start(image, False, True, 0)
        hbox.pack_start(image_vbox, False, True, 0)

        label = Gtk.Label(label=msg)
        label.set_yalign(0.0)
        label.set_xalign(0.0)
        hbox.pack_start(label, True, True, 0)

        self.message = msg
        vbox.pack_start(self.info_dialog_button_row(msg), False, True, 0)
        self.add(vbox)

        self.connect("destroy", self.closing)
        self.connect("key_press_event", self.info_dialog_key_press_event_evt)

    def info_dialog_button_row (self, message):
        
        btn_label_okay = _("Okay")
        btn_label_copy = _("Copy to clipboard")

        hbox = Gtk.HBox()

        button_okay = Gtk.Button(label=btn_label_okay)
        hbox.pack_end(button_okay, False, True, 0)
        button_okay.connect("clicked", self.closing)

        button_copy = Gtk.Button(label=btn_label_copy)
        hbox.pack_start(button_copy, False, True, 0)
        button_copy.connect("clicked", self.info_dialog_button_row_clicked_evt)

        self.set_focus(button_okay)

        return hbox

    def info_dialog_button_row_clicked_evt(self, widget):
        atom = Gdk.Atom.intern('CLIPBOARD', False)
        clipboard = Gtk.Clipboard.get(atom)
        clipboard.set_text(self.message, len(self.message))
        clipboard.store

    def closing(self, widget):
        Gtk.main_quit()

    def info_dialog_key_press_event_evt(self, unused, evt):
        if evt.keyval == Gdk.KEY_Escape:
            Gtk.main_quit()
            return True
        
        return False


def info_dialog (msg, title):
    window = InfoDialog(msg, title)
    window.show_all()
    Gtk.main()


def dialog ():
    action = sys.argv[1]
    message = sys.argv[2]
    title = sys.argv[3]
    message = re.sub("\\\\n", "\n", message)
    if action == 'error':
        info_dialog(message, title)
        return
    if action == 'command-input':
        run_dialog(message, title)
        return

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: <action> <message> <title>",file=sys.stderr)
        sys.exit(1)
    dialog()

