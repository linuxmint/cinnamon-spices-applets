#!/usr/bin/python3

import sys
from setproctitle import setproctitle
setproctitle("kdecapplet-dialog")

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, GLib

from os import path
import json
import re

class IllegalArgumentError(ValueError):
    pass

APPLET_DIR = path.split(path.dirname(path.normpath(__file__)))[0]

# Exit codes
EC_OK = 0
EC_CANCEL = 10
EC_ARGERROR = 2
EC_ERROR = 1

# Fallback UUID of applet
UUID = "kdecapplet@joejoetv"

# Read UUID from metadata.json file in applet directory
try:
    with open(path.join(APPLET_DIR, "metadata.json"), "r") as jsonfile:
        JSONMetadata = json.load(jsonfile)

    UUID = JSONMetadata["uuid"]
except Exception as e:
    print("Couldn't read metadata from metadata.json: ", e, file=sys.stderr)

class SendURLDialog(Gtk.Dialog):
    def __init__(self, device_name):
        super().__init__(title=_("Send URL to '{device_name}'").format(device_name=device_name), flags=0)
        
        self.set_resizable(False)
        self.set_icon_name("kdeconnect")
        
        cancel_button = Gtk.Button.new_from_icon_name("gtk-cancel", Gtk.IconSize.BUTTON)
        cancel_button.set_always_show_image(True)
        cancel_button.set_label(_("Cancel"))
        ok_button = Gtk.Button.new_from_icon_name("document-send-symbolic", Gtk.IconSize.BUTTON)
        ok_button.set_always_show_image(True)
        ok_button.set_label(_("Send"))
        
        self.add_action_widget(cancel_button, Gtk.ResponseType.CANCEL)
        self.add_action_widget(ok_button, Gtk.ResponseType.OK)
        
        self.set_default_size(500, 100)
        
        url_label = Gtk.Label(label=_("Enter a URL to send to '{device_name}'").format(device_name=device_name))
        url_label.set_xalign(Gtk.Justification.LEFT)
        
        self.url_entry = Gtk.Entry()
        self.url_entry.set_placeholder_text(_("URL"))
        self.url_entry.set_input_purpose(Gtk.InputPurpose.URL)
        
        box = Gtk.VBox()
        box.set_spacing(6)
        box.set_margin_top(6)
        box.set_margin_bottom(6)
        box.set_margin_start(6)
        box.set_margin_end(6)
        
        box.pack_start(url_label, False, False, 0)
        box.pack_end(self.url_entry, False, False, 0)
        
        content_box = self.get_content_area()
        content_box.pack_start(box, True, True, 0)
        
        self.show_all()
        
    def get_url_text(self):
        return self.url_entry.get_text()

class PhoneNumberEntry(Gtk.Entry):
    def __init__(self):
        super().__init__()
        self.connect("notify::text", self.on_text_changed)
        self.set_input_purpose(Gtk.InputPurpose.PHONE)
    
    def on_text_changed(self, *args):
        # Remove leading and following spaces
        text = re.sub(" +", " ", self.get_text())
        # Remove unwanted characters
        self.set_text("".join([c for c in text if c in " 0123456789+#*"]))

class SendSMSDialog(Gtk.Dialog):
    def __init__(self, device_name):
        super().__init__(title=_("Send SMS using '{device_name}'").format(device_name=device_name), flags=0)
        
        self.set_resizable(False)
        self.set_icon_name("kdeconnect")
        
        cancel_button = Gtk.Button.new_from_icon_name("gtk-cancel", Gtk.IconSize.BUTTON)
        cancel_button.set_always_show_image(True)
        cancel_button.set_label(_("Cancel"))
        ok_button = Gtk.Button.new_from_icon_name("document-send-symbolic", Gtk.IconSize.BUTTON)
        ok_button.set_always_show_image(True)
        ok_button.set_label(_("Send"))
        
        self.add_action_widget(cancel_button, Gtk.ResponseType.CANCEL)
        self.add_action_widget(ok_button, Gtk.ResponseType.OK)
        
        self.set_default_size(400, 300)
        
        label = Gtk.Label(label=_("Phone Number:"))
        label.set_xalign(Gtk.Justification.LEFT)
        
        self.pnr_entry = PhoneNumberEntry()
        self.pnr_entry.set_placeholder_text(_("Phone Number"))
        
        msg_label = Gtk.Label(label=_("Message:"))
        msg_label.set_xalign(Gtk.Justification.LEFT)
        
        frame = Gtk.Frame()
                
        self.msg_textview = Gtk.TextView()
        self.msg_textview.set_cursor_visible(True)
        self.msg_textview.set_editable(True)
        self.msg_textview.set_justification(Gtk.Justification.LEFT)
        self.msg_textview.set_wrap_mode(Gtk.WrapMode.WORD_CHAR)
        
        frame.add(self.msg_textview)
        
        box = Gtk.VBox()
        box.set_spacing(6)
        box.set_margin_top(6)
        box.set_margin_bottom(6)
        box.set_margin_start(6)
        box.set_margin_end(6)
        
        box.pack_start(label, False, False, 0)
        box.pack_start(self.pnr_entry, False, False, 0)
        box.pack_start(msg_label, False, False, 0)
        box.pack_end(frame, True, True, 0)
        
        content_box = self.get_content_area()
        content_box.pack_start(box, True, True, 0)
        
        self.show_all()
        
    def get_phone_number_text(self):
        return self.pnr_entry.get_text()

    def get_message_text(self):
        textbuffer = self.msg_textview.get_buffer()
        return textbuffer.get_text(textbuffer.get_start_iter(), textbuffer.get_end_iter(), True)


class SendTextDialog(Gtk.Dialog):
    def __init__(self, device_name):
        super().__init__(title=_("Send text to '{device_name}'").format(device_name=device_name), flags=0)
        
        self.set_resizable(False)
        self.set_icon_name("kdeconnect")
        
        cancel_button = Gtk.Button.new_from_icon_name("gtk-cancel", Gtk.IconSize.BUTTON)
        cancel_button.set_always_show_image(True)
        cancel_button.set_label(_("Cancel"))
        ok_button = Gtk.Button.new_from_icon_name("document-send-symbolic", Gtk.IconSize.BUTTON)
        ok_button.set_always_show_image(True)
        ok_button.set_label(_("Send"))
        
        self.add_action_widget(cancel_button, Gtk.ResponseType.CANCEL)
        self.add_action_widget(ok_button, Gtk.ResponseType.OK)
        
        self.set_default_size(300, 150)
        
        text_label = Gtk.Label(label=_("Text to send:"))
        text_label.set_xalign(Gtk.Justification.LEFT)
        
        frame = Gtk.Frame()
                
        self.text_textview = Gtk.TextView()
        self.text_textview.set_cursor_visible(True)
        self.text_textview.set_editable(True)
        self.text_textview.set_justification(Gtk.Justification.LEFT)
        self.text_textview.set_wrap_mode(Gtk.WrapMode.WORD_CHAR)
        
        frame.add(self.text_textview)
        
        box = Gtk.VBox()
        box.set_spacing(6)
        box.set_margin_top(6)
        box.set_margin_bottom(6)
        box.set_margin_start(6)
        box.set_margin_end(6)
        
        box.pack_start(text_label, False, False, 0)
        box.pack_end(frame, True, True, 0)
        
        content_box = self.get_content_area()
        content_box.pack_start(box, True, True, 0)
        
        self.show_all()
        

    def get_text(self):
        textbuffer = self.text_textview.get_buffer()
        return textbuffer.get_text(textbuffer.get_start_iter(), textbuffer.get_end_iter(), True)
    


if __name__ == "__main__":
    import gettext
    import os
    
    # I18n support
    gettext.install(UUID, GLib.get_home_dir() + '/.local/share/locale')
    
    if len(sys.argv) >= 3:
        if sys.argv[1] == "sendfiles":
            deviceName = sys.argv[2]
    
            filechooserdialog = Gtk.FileChooserNative(title=_("Select files to send to '{deviceName}'").format(deviceName=deviceName), action=Gtk.FileChooserAction.OPEN)
            filechooserdialog.set_select_multiple(True)
            filechooserdialog.set_current_folder(GLib.get_home_dir())
            
            response = filechooserdialog.run()
            
            if response == Gtk.ResponseType.ACCEPT:
                print(json.dumps(filechooserdialog.get_filenames()))
                
                filechooserdialog.destroy()
                sys.exit(EC_OK)
            else:
                filechooserdialog.destroy()
                sys.exit(EC_CANCEL)
        elif sys.argv[1] == "sendurl":
            urldialog = SendURLDialog(sys.argv[2])
            
            response = urldialog.run()
            
            if response == Gtk.ResponseType.OK:
                print(json.dumps(urldialog.get_url_text()))
                
                urldialog.destroy()
                sys.exit(EC_OK)
            else:
                urldialog.destroy()
                sys.exit(EC_CANCEL)
        elif sys.argv[1] == "sendsms":
            smsdialog = SendSMSDialog(sys.argv[2])
            
            response = smsdialog.run()
            
            returnObject = {
                "phone_number": smsdialog.get_phone_number_text(),
                "message": smsdialog.get_message_text()
            }
            
            if response == Gtk.ResponseType.OK:
                print(json.dumps(returnObject))
                
                smsdialog.destroy()
                sys.exit(EC_OK)
            else:
                smsdialog.destroy()
                sys.exit(EC_CANCEL)
        elif sys.argv[1] == "sendtext":
            textdialog = SendTextDialog(sys.argv[2])
            
            response = textdialog.run()
            
            if response == Gtk.ResponseType.OK:
                print(json.dumps(textdialog.get_text()))
                
                textdialog.destroy()
                sys.exit(EC_OK)
            else:
                textdialog.destroy()
                sys.exit(EC_CANCEL)
        elif sys.argv[1] == "receivephoto":
            deviceName = sys.argv[2]
    
            filechooserdialog = Gtk.FileChooserNative(title=_("Select where to save photo received from '{deviceName}'").format(deviceName=deviceName), action=Gtk.FileChooserAction.SAVE)
            filechooserdialog.set_select_multiple(False)
            filechooserdialog.set_do_overwrite_confirmation(True)
            filechooserdialog.set_current_folder(GLib.get_home_dir())
            filechooserdialog.set_current_name(_("photo.jpg"))
            
            jpegfilter = Gtk.FileFilter()
            jpegfilter.set_name(_("JPEG Photo"))
            jpegfilter.add_mime_type("image/jpeg")
            
            filechooserdialog.add_filter(jpegfilter)
            
            response = filechooserdialog.run()
            
            if response == Gtk.ResponseType.ACCEPT:
                print(json.dumps(filechooserdialog.get_filename()))
                
                filechooserdialog.destroy()
                sys.exit(EC_OK)
            else:
                filechooserdialog.destroy()
                sys.exit(EC_CANCEL)
        else:
            print("Unknown dialog type!", file=sys.stderr)
            sys.exit(EC_ARGERROR)
    else:
        print("Not enough arguments!", file=sys.stderr)
        sys.exit(EC_ARGERROR)
    
    