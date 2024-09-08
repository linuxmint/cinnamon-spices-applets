#!/usr/bin/python3

import os
import configparser
from contextlib import contextmanager
import gi
gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("XApp", "1.0")
from gi.repository import Gio, Gtk, Gdk, GdkPixbuf, GLib, XApp

UUID = 'app-launcher@mchilli'
APP_NAME = "App Launcher"
APPLET_DIR = os.path.join(os.path.dirname(__file__))

DEFAULT_APP_ICON = "application-x-executable"
DEFAULT_FOLDER_ICON = "folder"

class EditDialog():
    def __init__(self, variant, groups, item=None):
        self.groups = groups
        self.variant = variant
        self.item = item
        if self.variant == 'edit' and item:
            self.type = self.item[0]['type']
        else:
            self.type = self.variant
        
        self.icon_string = DEFAULT_FOLDER_ICON if self.type == "group" else DEFAULT_APP_ICON
        self.name_origin = ''
        self.new_group = None

        self.builder = Gtk.Builder()
        self.builder.add_from_file(os.path.join(APPLET_DIR, "ui", f"{self.type}.glade"))
        self.builder.connect_signals(self)

        self.dialog = self.builder.get_object("dialog")
        self.dialog.set_title(APP_NAME)

        self.button_ok = self.builder.get_object("button_ok")
        self.button_ok.set_label(_("OK"))

        self.builder.get_object("button_cancel").set_label(_("Cancel"))
        self.builder.get_object("label_name").set_text(_("Name"))

        self.name_entry = self.builder.get_object("name")
        self.icon_entry = self.builder.get_object("icon")

        if self.type == 'app':
            self.builder.get_object("label_group").set_text(_("Group"))
            self.builder.get_object("label_command").set_text(_("Command"))

            self.group_entry = self.builder.get_object("group")
            self.command_entry = self.builder.get_object("command")

            self.group_entry.append('', '') #to display an empty group entry
            self.group_entry.set_active_id('')
            for group in self.groups:
                self.group_entry.append(group, group)

        if self.variant == 'edit':
            self.name_entry.set_text(self.item[2])
            self.name_origin = self.item[2]
            self._set_icon(self.item[1])
            if self.type == 'app':
                self.group_entry.set_active_id(self.item[0]["group"])
                self.command_entry.set_text(self.item[3])
            
            self._validate_inputs()

    def run(self):
        response = self.dialog.run()
        
        if response != Gtk.ResponseType.OK:
            self.dialog.destroy()
            return None, None

        values = {
                "type": self.type,
                "name": self.name_entry.get_text(),
                "icon": self._get_icon()
            }
        
        if self.type == 'app':
            values["group"] = self.group_entry.get_active_id()
            values["command"] = self.command_entry.get_text()
        
        self.dialog.destroy()
        return values, self.new_group
    
    def on_size_allocate(self, widget, rect):
        widget.disconnect_by_func(self.on_size_allocate)
        hints = Gdk.Geometry()
        hints.max_width = widget.get_screen().get_width()
        hints.max_height = rect.height
        mask = Gdk.WindowHints.MAX_SIZE
        widget.set_geometry_hints(None, hints, mask)

    def on_choose_icon(self, *args):
        ''' Opens an icon chooser dialog, allowing the user to select an icon
            If an item exists, its current icon is pre-selected in the dialog
        '''
        dialog = XApp.IconChooserDialog()
        dialog.set_transient_for(self.dialog)
        dialog.set_modal(True)

        if self.item:
            icon_string = self.item[1]
            if hasattr(icon_string, 'to_string'):
                # is an object when opened from Settingswidget else string
                icon_string = icon_string.to_string()

            response = dialog.run_with_icon(icon_string)
        else:
            response = dialog.run()

        if response == Gtk.ResponseType.OK:
            self._set_icon(dialog.get_icon_string())
    
    def _set_icon(self, icon_string):
        ''' Sets the icon for the widget based on the provided icon_string
            If the icon_string is a file path, it loads the image from the file
            Otherwise, it sets the icon using the icon theme's icon name
        '''
        if hasattr(icon_string, 'to_string'):
            # is an object when opened from Settingswidget else string
            icon_string = icon_string.to_string()

        self.icon_string = icon_string

        if icon_string.startswith("/"):
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(icon_string, 48, 48)
            surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, self.dialog.get_scale_factor(), None)
            self.icon_entry.set_from_surface(surface)
        else:
            self.icon_entry.set_from_icon_name(icon_string, Gtk.IconSize.DIALOG)

    def _get_icon(self):
        ''' Returns the current icon string
        '''
        return self.icon_string

    def on_open_filechooser(self, *args):
        dialog = Gtk.FileChooserDialog(
            title=APP_NAME, 
            parent=self.dialog, 
            action=Gtk.FileChooserAction.OPEN,
            buttons=(
                Gtk.STOCK_CANCEL,
                Gtk.ResponseType.CANCEL,
                Gtk.STOCK_OPEN,
                Gtk.ResponseType.OK
            )
        )
        dialog.set_deletable(False)

        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            file = dialog.get_filename()
            dialog.destroy()
            if file.endswith('.desktop'):
                config = configparser.ConfigParser(interpolation=None)

                try:
                    config.read(file)
                except Exception as e:
                    print(f"Unexpected error: {e}")
                    return

                data = config['Desktop Entry']

                import_data = {}
                if 'Name' in data:
                    if self.name_entry.get_text() == '':
                        self.name_entry.set_text(data['Name'])
                    if self.name_entry.get_text() != data['Name']:
                        import_data['Name'] = (self.name_entry.get_text(), data['Name'])
                if 'Icon' in data:
                    if self._get_icon() == DEFAULT_APP_ICON:
                        self._set_icon(data['Icon'])
                    if self._get_icon() != data['Icon']:
                        import_data['Icon'] = (self._get_icon(), data['Icon'])
                if 'Exec' in data:
                    if self.command_entry.get_text() == '':
                        self.command_entry.set_text(data['Exec'])
                    if self.command_entry.get_text() != data['Exec']:
                        import_data['Exec'] = (self.command_entry.get_text(), data['Exec'])
                if len(import_data) > 0:
                    dialog = ImportDialog(import_data)
                    dialog.set_transient_for(self.dialog)
                    data = dialog.run()
                    if data:
                        if 'Name' in data: self.name_entry.set_text(data['Name'])
                        if 'Icon' in data: self._set_icon(data['Icon'])
                        if 'Exec' in data: self.command_entry.set_text(data['Exec'])

            else:    
                if self._is_command_valid(file):
                    self.command_entry.set_text(file)
                else:
                    mimetype, val = Gio.content_type_guess(filename=file, data=None)
                    icon = Gio.content_type_get_generic_icon_name(mimetype)
                    self._set_icon(icon)
                    
                    self.command_entry.set_text(f'xdg-open {file}')
        else:
            dialog.destroy()

    def on_add_group(self, *args):
        dialog = EditDialog('group', self.groups)
        dialog.set_transient_for(self.dialog)

        data, _ = dialog.run()
        if data:
            self.group_entry.append(data["name"], data["name"])
            self.group_entry.set_active_id(data["name"])
            self.new_group =  {
                "type": data["type"],
                "name": data["name"],
                "icon": data["icon"]
            }

    def set_transient_for(self, parent=None):
        self.dialog.set_transient_for(parent)

    def on_input_changed(self, *args):
        self._validate_inputs()

    def _validate_inputs(self):
        name = self.name_entry.get_text()

        valid_name = False

        if name.strip() == '':
            self.name_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'gtk-stop')
            self.name_entry.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("The name cannot be empty"))
        else:
            if self.type == 'group':
                if name != self.name_origin and name in self.groups:
                    self.name_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'gtk-stop')
                    self.name_entry.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("The name is already used"))
                else:
                    valid_name = True
            else:
                valid_name = True
        if valid_name:
            self.name_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'gtk-ok')
            self.name_entry.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("Valid name"))

        if self.type == 'app':
            valid_command = self._is_command_valid(self.command_entry.get_text())
            if valid_command:
                self.command_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'gtk-ok')
                self.command_entry.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("Valid command"))
            else:
                self.command_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'gtk-stop')
                self.command_entry.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("The command is not valid"))

        self.button_ok.set_sensitive(valid_name and (valid_command if self.type == 'app' else True))

    def _is_command_valid(self, command):
        try:
            if command == "":
                return False
            
            success, parsed = GLib.shell_parse_argv(command)
            if not success:
                return False

            if GLib.find_program_in_path(parsed[0]):
                return True

            if not os.path.isdir(parsed[0]) and os.access(parsed[0], os.X_OK):
                return True
            
        except Exception as e:
            print(f"Unexpected error: {e}")

        return False

class ImportDialog():
    def __init__(self, data):
        self.data = data

        self.builder = Gtk.Builder()
        self.builder.add_from_file(os.path.join(APPLET_DIR, "ui", "import.glade"))

        self.dialog = self.builder.get_object("dialog")
        self.dialog.set_title(APP_NAME)
        
        self.builder.get_object("label").set_text(_('Which data should be replaced from *.desktop file?'))
        self.builder.get_object("button_ok").set_label(_("OK"))
        self.builder.get_object("button_cancel").set_label(_("Cancel"))

        self.list = self.builder.get_object("list")
        self.checkboxes = {}
        for key in self.data:
            row = Gtk.ListBoxRow()
            checkbox = Gtk.CheckButton(f'{key}\t"{self.data[key][0]}"\n └─>\t"{self.data[key][1]}"')
            checkbox.set_active(True)
            self.checkboxes[key] = checkbox
            row.add(checkbox)
            self.list.add(row)
        
        self.dialog.show_all()
    
    def run(self):
        response = self.dialog.run()

        if response != Gtk.ResponseType.OK:
            self.dialog.destroy()
            return None
        
        data = {}
        for key in self.checkboxes:
            if self.checkboxes[key].get_active():
                data[key] = self.data[key][1]

        self.dialog.destroy()
        return data

    def set_transient_for(self, parent=None):
        self.dialog.set_transient_for(parent)

class ConfirmDialog():
    def __init__(self, icon, name):
        self.builder = Gtk.Builder()
        self.builder.add_from_file(os.path.join(APPLET_DIR, "ui", "confirm.glade"))

        self.dialog = self.builder.get_object("dialog")
        self.dialog.set_title(APP_NAME)

        self.builder.get_object("icon").set_from_gicon(Gio.Icon.new_for_string(icon), Gtk.IconSize.DIALOG)
        self.builder.get_object("item_name").set_markup("<span weight='bold'>%s</span>" % name)
        self.builder.get_object("ask_label").set_text(_("really delete?"))
        self.builder.get_object("button_no").set_label(_("No"))
        self.builder.get_object("button_yes").set_label(_("Yes"))
        
    @contextmanager
    def run(self):
        try:
            yield self.dialog.run()
        finally:
            self.dialog.destroy()
        
    def set_transient_for(self, parent=None):
        self.dialog.set_transient_for(parent)

if __name__ == "__main__":
    import sys
    import gettext
    
    sys.path.append('/usr/share/cinnamon/cinnamon-settings/bin')
    from JsonSettingsWidgets import *

    # i18n
    gettext.install(UUID, GLib.get_home_dir() + '/.local/share/locale')
    
    try:
        output = None
        if sys.argv[1] == 'edit':
            groups = []
            for group in json.loads(sys.argv[2]):
                groups.append(group["name"])
            item = json.loads(sys.argv[3])

            dialog = EditDialog('edit', groups, item)
            output = dialog.run()

        elif sys.argv[1] == 'confirm':
            confirm_dialog = ConfirmDialog(sys.argv[2], sys.argv[3])
            with confirm_dialog.run() as response:
                output = response

        else:
            raise Exception("unkown dialog")
        print(json.dumps(output))
    except Exception as e:
        print(e)
