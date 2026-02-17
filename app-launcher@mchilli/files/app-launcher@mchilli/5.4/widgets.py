#!/usr/bin/python3

import sys
import os
import gettext
from JsonSettingsWidgets import *

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gio, Gtk, Gdk

UUID = 'app-launcher@mchilli'
APP_NAME = "App Launcher"
APPLET_DIR = os.path.join(os.path.dirname(__file__))

sys.path.append(APPLET_DIR)

from dialogs import EditDialog, ConfirmDialog

# i18n
gettext.install(UUID, GLib.get_home_dir() + '/.local/share/locale')

class CustomAppList(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)
        self.key = key
        self.settings = settings
        self.info = info

        self.saved_configuration = True

        provider = Gtk.CssProvider()
        provider.load_from_path(os.path.join(APPLET_DIR, "ui", "style.css"))
        context = Gtk.StyleContext()
        context.add_provider_for_screen(Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_USER)

        self.builder = Gtk.Builder()
        self.builder.add_from_file(os.path.join(APPLET_DIR, "ui", "widget.glade"))
        
        self.custom_widget = self.builder.get_object("custom_widget")

        self.tree_store = Gtk.TreeStore(object, Gio.Icon, str, str)

        self.tree_view = self.builder.get_object("treeview")
        self.tree_view.set_model(self.tree_store)
        self.tree_view.get_column(0).set_title(_("Icon"))
        self.tree_view.get_column(1).set_title(_("Name"))
        self.tree_view.get_column(2).set_title(_("Command"))

        self.add_button = self.builder.get_object("add_button")
        self.add_button.set_tooltip_text(_("Add application"))
        self.add_button.set_arrow_tooltip_text(_("Add new entry"))

        self.separator_button = self.builder.get_object("separator_button")
        self.separator_button.set_label(_("Add separator"))

        self.edit_button = self.builder.get_object("edit_button")
        self.edit_button.set_tooltip_text(_("Edit selected entry"))

        self.duplicate_button = self.builder.get_object("duplicate_button")
        self.duplicate_button.set_tooltip_text(_("Duplicate selected entry"))

        self.move_up_button = self.builder.get_object("move_up_button")
        self.move_up_button.set_tooltip_text(_("Move selected entry up"))

        self.move_down_button = self.builder.get_object("move_down_button")
        self.move_down_button.set_tooltip_text(_("Move selected entry down"))

        self.remove_button = self.builder.get_object("remove_button")
        self.remove_button.set_tooltip_text(_("Remove selected entry"))

        self.cancel_button = self.builder.get_object("cancel_button")
        self.cancel_button.set_tooltip_text(_("Cancel"))

        self.save_button = self.builder.get_object("save_button")
        self.save_button.set_label(_("Save?"))
        self.save_button.set_tooltip_text(_("Save the current configuration"))

        self._restore_list()
        
        self.settings.listen("list-applications", self._valid_backup_restore)
        self.settings.listen("list-groups", self._valid_backup_restore)

        self.connect("realize", self.on_window_realized)

    def _restore_list(self, *args):
        self.groups = {}
        self.tree_store.clear()

        self.stored_groups = self.settings.get_value("list-groups")
        self.stored_apps = self.settings.get_value("list-applications")
        for data in self.stored_apps:
            parent = None
            if data["group"] != '':
                if data["group"] in self.groups:
                    parent = self.groups[data["group"]]
                else:
                    for group in self.stored_groups:
                        if group["name"] == data["group"]:
                            parent = self._create_group(group)
                            break
            if data["name"] == "$eparator$":
                data["color"] = data["command"]
                entry_type = 'separator'
            else:
                entry_type = 'app'
            self.tree_store.append(parent, self._prepare_store_entry(entry_type, data))

        self.tree_view.expand_all()

    def on_window_realized(self, *args):
        ''' A bit hacky, but hiding the frame and inserting the widget directly
            into the section page allows the list to use the entire space :)
        '''
        frame = self._get_parent_at_level(5)
        frame.hide()

        section_page = self._get_parent_at_level(6)
        section_page.set_property("expand", True)
        section_page.get_parent().set_child_packing(section_page, False, True, 0, 0)
        section_page.pack_end(self.custom_widget, True, True, 0)

        self.builder.connect_signals(self)

    def _get_parent_at_level(self, level):
        ''' Returns the parent at a specified level in the hierarchy
        '''
        parent = self
        for _ in range(level):
            parent = parent.get_parent()
        return parent

    def on_selection_changed(self, *args):
        ''' Handles changes in the tree view selection.
        '''
        self._update_button_sensitivity()
    
    def _update_button_sensitivity(self):
        ''' Updates the sensitivity (enabled/disabled state) of action buttons 
            based on the currently selected item in the tree view
        '''
        tree_store, item_iter = self.tree_view.get_selection().get_selected()
        
        # Set default states when no item is selected
        selection_exists = item_iter is not None
        is_group = self.tree_store[item_iter][0]["type"] == "group" if selection_exists else False

        self.remove_button.set_sensitive(selection_exists)
        self.edit_button.set_sensitive(selection_exists)
        self.duplicate_button.set_sensitive(selection_exists and not is_group)
        self.move_up_button.set_sensitive(selection_exists and self.tree_store.iter_previous(item_iter) is not None)
        self.move_down_button.set_sensitive(selection_exists and self.tree_store.iter_next(item_iter) is not None)

    def _add_item_by_type(self, type):
        ''' Handles the addition of a new item to the tree store by type
        '''
        dialog = EditDialog(type, self.groups)
        dialog.set_transient_for(self.get_toplevel())
        data, new_group = dialog.run()
        if not data:
            return
        
        # Determine the parent node based on the data
        parent = None
        if data["group"] in self.groups:
            parent = self.groups[data["group"]]
        elif new_group:
            parent = self._create_group(new_group)

        self.tree_store.append(parent, self._prepare_store_entry(type, data))

        if new_group and parent:
            self.tree_view.expand_row(self.tree_store.get_path(parent), True)

        self._configuration_changed(True)

    def on_add_item(self, *args):
        ''' Handles the addition of a new item to the tree store
        '''
        self._add_item_by_type('app')
    
    def on_add_separator(self, *args):
        ''' Adds a new separator to the store with a user-chosen color
        '''
        self._add_item_by_type('separator')

    def _prepare_store_entry(self, entry_type, entry_data):
        ''' Creates a formatted store entry based on the entry type and provided data
        '''
        meta_data = {
            "type": entry_type,
            "group": '' if entry_type == 'group' else entry_data.get("group", ''),
            "color": entry_data["color"] if 'color' in entry_data else [255, 255, 255]
        }
        entry = [
            meta_data,
            None if entry_data["icon"] == '' else Gio.Icon.new_for_string(entry_data["icon"]),
            self._create_separator_markup(meta_data["color"]) if entry_type == 'separator' else entry_data["name"],
            "" if entry_type in ['group', 'separator'] else entry_data["command"],
        ]
        return entry

    def _create_separator_markup(self, rgb):
        ''' Generates GTK markup for a separator with the specified RGB color
        '''
        color = "#%0.2X%0.2X%0.2X" % (rgb[0], rgb[1], rgb[2])
        prefix = f'<span foreground="{color}">══════════╣</span>'
        suffix = f'<span foreground="{color}">╠══════════</span>'
        markup = f'<span size="7500">{prefix} {_("Separator")} {suffix}</span>'
        return markup

    def _create_group(self, data):
        ''' append a group entry to store and saved it internally
        '''
        item = self.tree_store.append(None, self._prepare_store_entry('group', data))
        self.groups[data["name"]] = item
        return item

    def on_remove_item(self, *args):
        ''' Handles the removal of a selected item from the tree store
        '''
        tree_store, item_iter = self.tree_view.get_selection().get_selected()

        entry_type = self.tree_store[item_iter][0]['type']
        if entry_type in ['app', 'group']:
            icon = self.tree_store[item_iter][1].to_string()
            name = self.tree_store[item_iter][2]
        else:
            icon = "list-remove-symbolic"
            name = _("Separator")

        dialog = ConfirmDialog(icon, name)
        dialog.set_transient_for(self.get_toplevel())

        with dialog.run() as response:
            if response == Gtk.ResponseType.YES:
                self._delete_item(item_iter)

    def _delete_item(self, item_iter):
        ''' Deletes the selected element and organizes the child elements if required
        '''
        if self.tree_store.iter_has_child(item_iter):
            self._move_children_to_root(item_iter)
        else:
            self._remove_item_and_cleanup_parent(item_iter)
        
        self._configuration_changed(True)

    def _move_children_to_root(self, item_iter):
        ''' Moves children of a deleted group element to the root level
        '''
        index = self.tree_store.get_path(item_iter)[0]
        for child in self.tree_store[item_iter].iterchildren():
            data = {
                "icon": child[1].to_string() if child[1] is not None else '',
                "name": child[2] if child[2] is not None else '',
                "command": child[3] if child[3] is not None else '',
                "group": '',
                "color": child[0]["color"] if child[0]["type"] == 'separator' else ''
            }
            self.tree_store.insert(None, index, self._prepare_store_entry(child[0]["type"], data))
            index += 1

        self.groups.pop(self.tree_store[item_iter][2], None)
        self.tree_store.remove(item_iter)

    def _remove_item_and_cleanup_parent(self, item_iter):
        ''' Removes an element and deletes the parent if it no longer has any children
        '''
        parent = self.tree_store[item_iter].get_parent()
        self.tree_store.remove(item_iter)
        
        if parent and not self.tree_store.iter_has_child(parent.iter):
            self.groups.pop(self.tree_store[parent.iter][2], None)
            self.tree_store.remove(parent.iter)

    def on_edit_item(self, *args):
        tree_store, item_iter = self.tree_view.get_selection().get_selected()
        item_type = self.tree_store[item_iter][0]['type']

        dialog = EditDialog('edit', self.groups, self.tree_store[item_iter])
        dialog.set_transient_for(self.get_toplevel())
        data, new_group = dialog.run()
        if not data:
            return
        
        if new_group:
            self._create_group(new_group)

        # edit an application
        if data["type"] == "app":
            if data["group"] != self.tree_store[item_iter][0]["group"]:
                old_parent = self.tree_store[item_iter].get_parent()

                parent = None
                if data["group"] in self.groups:
                    parent = self.groups[data["group"]]
                elif new_group:
                    parent = self._create_group(new_group)
                
                self.tree_store.remove(item_iter)
                self.tree_store.append(parent, self._prepare_store_entry('app', data))

                if new_group:
                    self.tree_view.expand_row(self.tree_store.get_path(parent), True)

                # delete old parent if there are no children left
                if old_parent:
                    if not self.tree_store.iter_has_child(old_parent.iter):
                        self.groups.pop(self.tree_store[old_parent.iter][2], None)
                        self.tree_store.remove(old_parent.iter)
            else:
                self.tree_store[item_iter][1] = Gio.Icon.new_for_string(
                    data["icon"])
                self.tree_store[item_iter][2] = data["name"]
                self.tree_store[item_iter][3] = data["command"]

        # edit a group
        elif data["type"] == "group":
            group_origin = self.tree_store[item_iter][2]

            self.tree_store[item_iter][1] = Gio.Icon.new_for_string(data["icon"])
            self.tree_store[item_iter][2] = data["name"]
            for child in self.tree_store[item_iter].iterchildren():
                child[0]["group"] = data["name"]
            self.groups[data["name"]] = self.groups.pop(
                group_origin, None)
                
        # edit a separator
        elif data["type"] == "separator":
            if data["group"] != self.tree_store[item_iter][0]["group"]:
                old_parent = self.tree_store[item_iter].get_parent()

                parent = None
                if data["group"] in self.groups:
                    parent = self.groups[data["group"]]
                elif new_group:
                    parent = self._create_group(new_group)
                
                self.tree_store.remove(item_iter)
                self.tree_store.append(parent, self._prepare_store_entry('separator', data))

                if new_group:
                    self.tree_view.expand_row(self.tree_store.get_path(parent), True)

                # delete old parent if there are no children left
                if old_parent:
                    if not self.tree_store.iter_has_child(old_parent.iter):
                        self.groups.pop(self.tree_store[old_parent.iter][2], None)
                        self.tree_store.remove(old_parent.iter)
            else:
                self.tree_store[item_iter][0]['color'] = data["color"]
                self.tree_store[item_iter][2] = self._create_separator_markup(data["color"])

        self._configuration_changed(True)

    def on_duplicate_item(self, *args):
        ''' Duplicates the currently selected item in the tree view
        '''
        tree_store, item_iter = self.tree_view.get_selection().get_selected()
        parent = self.tree_store[item_iter].get_parent()
        if parent:
            parent = parent.iter

        item_data = self.tree_store[item_iter]
        self.tree_store.insert_after(parent, item_iter, list(item_data))

        self._update_button_sensitivity()
        self._configuration_changed(True)

    def on_move_item_up(self, *args):
        ''' Moves the selected item in the tree view up by one position
            Swaps the selected item with the previous item in the list
        '''
        tree_store, item_iter = self.tree_view.get_selection().get_selected()
        self.tree_store.swap(item_iter, self.tree_store.iter_previous(item_iter))

        self._update_button_sensitivity()
        self._configuration_changed(True)

    def on_move_item_down(self, *args):
        ''' Moves the selected item in the tree view down by one position
            Swaps the selected item with the next item in the list
        '''
        tree_store, item_iter = self.tree_view.get_selection().get_selected()
        self.tree_store.swap(item_iter, self.tree_store.iter_next(item_iter))

        self._update_button_sensitivity()
        self._configuration_changed(True)

    def _valid_backup_restore(self, key, changed_entries):
        ''' restore list only if there are changes between internally 
            stored apps/groups and saved apps/groups in applet settings,
            e.g. when you restore a backup.
        '''
        if not self.saved_configuration:
            return
        
        if key == 'list-applications':
            compared_to = self.stored_apps
        else:
            compared_to = self.stored_groups
        if not changed_entries == compared_to:
            self._restore_list()

    def _configuration_changed(self, changed):
        ''' Marks the configuration as changed and set the state of the save and cancel button.
        '''
        self.saved_configuration = not changed
        self.save_button.set_is_important(changed)
        self.save_button.set_visible(changed)
        self.cancel_button.set_visible(changed)

    def on_save_list(self, *args):
        ''' Handles the save event by calling the method to save the current configuration
        '''
        self._save_configuration()
    
    def on_cancel_changes(self, *args):
        ''' Resets any changes made by restoring the list to its original state
        '''
        self._restore_list()
        self._configuration_changed(False)

    def _save_configuration(self, *args):
        ''' Saves the current configuration of applications and groups.
        '''
        def get_row_data(store, treepath, treeiter, apps, groups):
            item_type = store[treeiter][0]["type"]
            if not store.iter_has_child(treeiter):
                if item_type == 'app':
                    item = {
                        "name": store[treeiter][2],
                        "group": store[treeiter][0]["group"],
                        "icon": store[treeiter][1].to_string(),
                        "command": store[treeiter][3]
                    }
                elif item_type == 'separator':
                    item = {
                        "name": '$eparator$',
                        "group": store[treeiter][0]["group"],
                        "icon": '',
                        "command": store[treeiter][0]["color"]
                    }
                apps.append(item)
            else:
                item = {
                    "name": store[treeiter][2],
                    "icon": store[treeiter][1].to_string(),
                }
                groups.append(item)

        self.stored_apps = []
        self.stored_groups = []

        self.tree_store.foreach(get_row_data, self.stored_apps, self.stored_groups)

        self.settings.set_value('list-applications', self.stored_apps)
        self.settings.set_value('list-groups', self.stored_groups)

        self._update_button_sensitivity()
        self._configuration_changed(False)
