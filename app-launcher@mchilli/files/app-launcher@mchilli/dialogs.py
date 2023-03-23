#!/usr/bin/python3

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version('XApp', '1.0')

import os
import configparser
from gi.repository import Gio, Gtk, Gdk, GLib, XApp

UUID = 'app-launcher@mchilli'
APP_NAME = "App Launcher"
APPLET_DIR = os.path.join(os.path.dirname(__file__))

class EditDialog():
    def __init__(self, variant, groups, item=None):
        self.groups = groups
        self.variant = variant
        if self.variant == 'edit' and item is not None:
            self.item = item
            self.type = self.item[0]['type']
        else:
            self.type = self.variant
        
        self.name_origin = ''
        self.new_group = None

        self.builder = Gtk.Builder()
        self.builder.add_from_file(os.path.join(APPLET_DIR, "dialogs.glade"))
        self.builder.connect_signals(self)

        self.button_ok = self.builder.get_object("%s-ok" % self.type)
        self.button_cancel = self.builder.get_object("%s-cancel" % self.type)

        self.builder.get_object("%s-label-name" % self.type).set_text(_("Name"))

        self.name_entry = self.builder.get_object("%s-name" % self.type)
        self.name_entry.connect("changed", self.validate_inputs)
        self.icon_entry = self.builder.get_object("%s-icon" % self.type)
        if self.type == 'app':
            self.builder.get_object("app-label-group").set_text(_("Group"))
            self.builder.get_object("app-label-command").set_text(_("Command"))

            self.group_entry = self.builder.get_object("app-group")
            self.command_entry = self.builder.get_object("app-command")
            self.command_entry.connect("changed", self.validate_inputs)

            self.group_entry.append('', '') #to display without a group
            self.group_entry.set_active_id('')
            for group in self.groups:
                self.group_entry.append(group, group)

        if self.variant == 'edit':
            self.name_entry.set_text(self.item[2])
            self.name_origin = self.item[2]
            try:
                self.icon_entry.set_icon(self.item[1].to_string()) #Used from Settings widget
            except:
                self.icon_entry.set_icon(self.item[1]) #Used from JS Applet
            if self.type == 'app':
                self.group_entry.set_active_id(self.item[0]["group"])
                self.command_entry.set_text(self.item[3])
            
            self.validate_inputs()

        self.dialog = self.builder.get_object("%s-dialog" % self.type)
        self.dialog.set_title(APP_NAME)
        self.dialog.set_keep_above(True)
        self.dialog.set_position(Gtk.WindowPosition.MOUSE)
        self.dialog.show_all()

    def run(self):
        response = self.dialog.run()
        
        if response == Gtk.ResponseType.OK:
            name = self.name_entry.get_text()
            icon = self.icon_entry.get_icon()
            values = {
                    "type": self.type,
                    "name": name,
                    "icon": icon
                }
            if self.type == 'app':
                group = self.group_entry.get_active_id()
                command = self.command_entry.get_text()
                values["group"] = group
                values["command"] = command

            self.dialog.destroy()
            return values, self.new_group

        self.dialog.destroy()
        return None

    def on_size_allocate(self, widget, rect):
        widget.disconnect_by_func(self.on_size_allocate)
        hints = Gdk.Geometry()
        hints.max_width = widget.get_screen().get_width()
        hints.max_height = rect.height
        mask = Gdk.WindowHints.MAX_SIZE
        widget.set_geometry_hints(None, hints, mask)

    def open_filechooser(self, *args):
        filechooser = Gtk.FileChooserDialog(
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

        response = filechooser.run()
        if response == Gtk.ResponseType.OK:
            file = filechooser.get_filename()
            filechooser.destroy()
            if file.endswith('.desktop'):
                config = configparser.ConfigParser(interpolation=None)
                config.read(file)
                data = config['Desktop Entry']

                import_data = {}
                if 'Name' in data:
                    if self.name_entry.get_text() == '':
                        self.name_entry.set_text(data['Name'])
                    if self.name_entry.get_text() != data['Name']:
                        import_data['Name'] = (self.name_entry.get_text(), data['Name'])
                if 'Icon' in data:
                    if self.icon_entry.get_icon() == 'application-x-executable':
                        self.icon_entry.set_icon(data['Icon'])
                    if self.icon_entry.get_icon() != data['Icon']:
                        import_data['Icon'] = (self.icon_entry.get_icon(), data['Icon'])
                if 'Exec' in data:
                    if self.command_entry.get_text() == '':
                        self.command_entry.set_text(data['Exec'])
                    if self.command_entry.get_text() != data['Exec']:
                        import_data['Exec'] = (self.command_entry.get_text(), data['Exec'])
                if len(import_data) > 0:
                    data = ImportDialog(self.dialog, import_data).run()
                    if data is not None:
                        if 'Name' in data: self.name_entry.set_text(data['Name'])
                        if 'Icon' in data: self.icon_entry.set_icon(data['Icon'])
                        if 'Exec' in data: self.command_entry.set_text(data['Exec'])

            else:    
                self.command_entry.set_text(file)
        else:
            filechooser.destroy()

    def add_group(self, *args):
        dialog = EditDialog('group', self.groups)
        dialog.set_transient(self.dialog)

        data, new_group = dialog.run()
        if data is not None:
            self.group_entry.append(data["name"], data["name"])
            self.group_entry.set_active_id(data["name"])
            self.new_group =  {
                "type": data["type"],
                "name": data["name"],
                "icon": data["icon"]
            }

    def set_transient(self, parent=None):
        self.dialog.set_transient_for(parent)

    def valid_exec(self, exec):
        try:
            success, parsed = GLib.shell_parse_argv(exec)
            if GLib.find_program_in_path(parsed[0]) or ((not os.path.isdir(parsed[0])) and os.access(parsed[0], os.X_OK)):
                return True
        except:
            pass
        return False
    
    def validate_inputs(self, *args):
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
            valid_exec = self.valid_exec(self.command_entry.get_text())
            if valid_exec:
                self.command_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'gtk-ok')
                self.command_entry.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("Valid command"))
            else:
                self.command_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'gtk-stop')
                self.command_entry.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("The command is not valid"))

        self.button_ok.set_sensitive(valid_name and (valid_exec if self.type == 'app' else True))

class ImportDialog():
    def __init__(self, parent, data):
        self.data = data

        self.builder = Gtk.Builder()
        self.builder.add_from_file(os.path.join(APPLET_DIR, "dialogs.glade"))
        self.builder.connect_signals(self)

        self.builder.get_object("import-label").set_text(_('Which data should be replaced from *.desktop file?'))

        self.list = self.builder.get_object("import-list")
        self.checkboxes = {}
        for key in self.data:
            row = Gtk.ListBoxRow()
            checkbox = Gtk.CheckButton(f'{key}\t"{self.data[key][0]}"\n └─>\t"{self.data[key][1]}"')
            checkbox.set_active(True)
            self.checkboxes[key] = checkbox
            row.add(checkbox)
            self.list.add(row)

        self.dialog = self.builder.get_object("import-dialog")
        self.dialog.set_title(APP_NAME)
        self.dialog.set_transient_for(parent)
        self.dialog.set_position(Gtk.WindowPosition.MOUSE)
        self.dialog.show_all()
    
    def run(self):
        response = self.dialog.run()

        if response == Gtk.ResponseType.OK:
            data = {}
            for key in self.checkboxes:
                if self.checkboxes[key].get_active():
                    data[key] = self.data[key][1]
            self.dialog.destroy()
            return data

        self.dialog.destroy()
        return None

class ConfirmDialog():
    def __init__(self, icon, name):
        self.builder = Gtk.Builder()
        self.builder.add_from_file(os.path.join(APPLET_DIR, "dialogs.glade"))
        self.builder.connect_signals(self)


        self.icon = self.builder.get_object("question-icon")
        self.icon.set_from_gicon(Gio.Icon.new_for_string(icon), Gtk.IconSize.DIALOG)

        self.name = self.builder.get_object("question-name")
        self.name.set_markup("<span weight='bold'>%s</span>" % name)

        self.builder.get_object("question-label-really").set_text(_("really delete?"))

        self.dialog = self.builder.get_object("question-dialog")
        self.dialog.set_title(APP_NAME)
        self.dialog.set_keep_above(True)
        self.dialog.set_position(Gtk.WindowPosition.MOUSE)
        self.dialog.show_all()

    def run(self):
        response = self.dialog.run()
        self.dialog.destroy()
        return response

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
            dialog = ConfirmDialog(sys.argv[2], sys.argv[3])
            output = dialog.run()

        else:
            raise Exception("unkown dialog")
        print(json.dumps(output))
    except Exception as e:
        print(e)
