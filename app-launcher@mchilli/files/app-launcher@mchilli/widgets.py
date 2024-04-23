#!/usr/bin/python3

import os
import sys
import time
import math
import gettext
import gi
gi.require_version("Gtk", "3.0")
gi.require_version('XApp', '1.0')

from gi.repository import GLib, Gio, Gtk, Gdk
from JsonSettingsWidgets import *

sys.path.append(os.path.join(os.path.dirname(__file__)))
from dialogs import EditDialog, ConfirmDialog

UUID = 'app-launcher@mchilli'
APP_NAME = "App Launcher"
APPLET_DIR = os.path.join(os.path.dirname(__file__))
HOME = os.path.expanduser("~")
ALIGNMENT_MAP = {
    "left":     0,
    "center":   0.5,
    "right":    1
}
HEADER_COLUMS = [
    {
        "title": _("Icon"),
        "type": "icon",
        "attribute": "gicon",
        "align": "center",
        "properties": {}
    },
    {
        "title": _("Name"),
        "type": "string",
        "attribute": "markup",
        "align": "left",
        "properties": {}
    },
    {
        "title": _("Command"),
        "type": "string",
        "attribute": "text",
        "align": "left",
        "properties": {
            "style": 2
        }
    }
]

# i18n
gettext.bindtextdomain(UUID, os.path.join(HOME, ".local/share/locale"))
gettext.textdomain(UUID)
gettext.install(UUID, GLib.get_home_dir() + '/.local/share/locale')


def _(message: str) -> str:
    return gettext.gettext(message)


def log(msg):
    ''' global log function for debugging
    '''
    with open(APPLET_DIR + '/debug.log', 'a') as f:
        f.write("[%s] %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()), str(msg)))


class CustomAppList(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)
        self.key = key
        self.settings = settings
        self.info = info
        
        self.groups = {}

        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(0)
        self.set_margin_left(0)
        self.set_margin_right(0)
        self.set_border_width(0)

        self.tree_view = Gtk.TreeView()
        self.tree_view.set_property("enable-grid-lines", 2)
        self.tree_view.set_property("enable-tree-lines", True)
        self.tree_view.set_property("level-indentation", 10)
        
        self.scrollbox = Gtk.ScrolledWindow()
        self.scrollbox.set_margin_bottom(-200)
        self.scrollbox.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.pack_start(self.scrollbox, True, True, 0)
        self.scrollbox.add(self.tree_view)

        for i, column in enumerate(HEADER_COLUMS):
            if column["type"] == 'boolean':
                renderer = Gtk.CellRendererToggle()
                attribute = 'active'
            elif column["type"] == 'icon':
                renderer = Gtk.CellRendererPixbuf()
                attribute = column["attribute"]
            else:
                renderer = Gtk.CellRendererText()
                attribute = column["attribute"]
            renderer.set_alignment(ALIGNMENT_MAP[column["align"]], 0.5)
            for property in column["properties"]:
                renderer.set_property(property, column["properties"][property])
            column = Gtk.TreeViewColumn(column["title"], renderer)
            column.add_attribute(renderer, attribute, i+1)
            column.set_alignment(0)
            column.set_resizable(True)
            self.tree_view.append_column(column)

        self.store = Gtk.TreeStore(object, Gio.Icon, str, str)

        self.tree_view.set_model(self.store)

        button_toolbar = Gtk.Toolbar()
        button_toolbar.set_icon_size(1)
        self.pack_start(button_toolbar, False, False, 0)

        self.add_button = Gtk.MenuToolButton(None, None)
        self.add_button.set_icon_name("list-add-symbolic")
        self.add_button.set_tooltip_text(_("Add application"))
        self.add_button.set_arrow_tooltip_text(_("Add new entry"))
        self.add_button.connect("clicked", self.add_item)

        add_button_menu = Gtk.Menu()
        separator_button = Gtk.MenuItem(_("Add separator"))
        separator_button.connect("activate", self.add_separator)
        add_button_menu.append(separator_button)
        add_button_menu.show_all()
        self.add_button.set_menu(add_button_menu)

        self.remove_button = Gtk.ToolButton(None, None)
        self.remove_button.set_icon_name("list-remove-symbolic")
        self.remove_button.set_tooltip_text(_("Remove selected entry"))
        self.remove_button.connect("clicked", self.remove_item)
        self.remove_button.set_sensitive(False)

        self.edit_button = Gtk.ToolButton(None, None)
        self.edit_button.set_icon_name("list-edit-symbolic")
        self.edit_button.set_tooltip_text(_("Edit selected entry"))
        self.edit_button.connect("clicked", self.edit_item)
        self.edit_button.set_sensitive(False)

        self.duplicate_button = Gtk.ToolButton(None, None)
        self.duplicate_button.set_icon_name("edit-copy-symbolic")
        self.duplicate_button.set_tooltip_text(_("Duplicate selected entry"))
        self.duplicate_button.connect("clicked", self.duplicate_item)
        self.duplicate_button.set_sensitive(False)

        self.move_up_button = Gtk.ToolButton(None, None)
        self.move_up_button.set_icon_name("go-up-symbolic")
        self.move_up_button.set_tooltip_text(_("Move selected entry up"))
        self.move_up_button.connect("clicked", self.move_item_up)
        self.move_up_button.set_sensitive(False)

        self.move_down_button = Gtk.ToolButton(None, None)
        self.move_down_button.set_icon_name("go-down-symbolic")
        self.move_down_button.set_tooltip_text(_("Move selected entry down"))
        self.move_down_button.connect("clicked", self.move_item_down)
        self.move_down_button.set_sensitive(False)

        button_toolbar.insert(self.add_button, -1)
        button_toolbar.insert(self.edit_button, -1)
        button_toolbar.insert(self.duplicate_button, -1)
        button_toolbar.insert(Gtk.SeparatorToolItem(), -1)
        button_toolbar.insert(self.move_up_button, -1)
        button_toolbar.insert(self.move_down_button, -1)
        button_toolbar.insert(Gtk.SeparatorToolItem(), -1)
        button_toolbar.insert(self.remove_button, -1)

        self.restore_list()

        def get_window(self, *args):
            window = self.get_toplevel()
            self.scrollbox.set_size_request(-1, window.get_size().height)
            window.connect("size-allocate", self.on_window_size_allocate)

        self.connect("realize", get_window)
        self.settings.listen("list-applications", self.valid_backup_restore)
        self.settings.listen("list-groups", self.valid_backup_restore)
        self.tree_view.get_selection().connect("changed", self.update_button_sensitivity)
        self.tree_view.set_activate_on_single_click(False)
        self.tree_view.connect("row-activated", self.on_row_activated)

    def on_window_size_allocate(self, window, size):
        ''' resize the list to fit the window height
        '''
        self.scrollbox.set_size_request(-1, size.height)

    def on_row_activated(self, *args):
        ''' activate if row double clicked
        '''
        self.edit_item()

    def valid_backup_restore(self, key, changed_entries):
        ''' restore list only if there are changes between internally 
            stored apps/groups and saved apps/groups in applet settings,
            e.g. when you restore a backup.
        '''
        if key == 'list-applications':
            compared_to = self.stored_apps
        else:
            compared_to = self.stored_groups
        if not changed_entries == compared_to:
            self.restore_list()

    def create_group(self, data):
        ''' append a group entry to store and saved it internally
        '''
        item = self.store.append(None, self.create_list_entry('group', data))
        self.groups[data["name"]] = item
        return item

    def create_separator_markup(self, rgb):
        color = "#%0.2X%0.2X%0.2X" % (rgb[0], rgb[1], rgb[2])
        prefix = f'<span foreground="{color}">══════════╣</span>'
        suffix = f'<span foreground="{color}">╠══════════</span>'
        markup = f'<span size="7500">{prefix} {_("Separator")} {suffix}</span>'
        return markup

    def create_list_entry(self, type, data):
        ''' return a formated store entry list
        '''
        meta_data = {
            "type": type,
            "group": '' if type == 'group' else data["group"],
            "color": data["color"] if 'color' in data else [255, 255, 255]
        }
        entry = [
            meta_data,
            None if data["icon"] == '' else Gio.Icon.new_for_string(data["icon"]),
            self.create_separator_markup(meta_data["color"]) if type == 'separator' else data["name"],
            "" if type in ['group', 'separator'] else data["command"],
        ]
        return entry

    def restore_list(self, *args):
        self.groups = {}
        self.store.clear()

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
                            parent = self.create_group(group)
                            break
            if data["name"] == "$eparator$":
                data["color"] = data["command"]
                self.store.append(parent, self.create_list_entry('separator', data))
            else:
                self.store.append(parent, self.create_list_entry('app', data))
        
        self.tree_view.expand_all()

    def update_button_sensitivity(self, *args):
        model, selected = self.tree_view.get_selection().get_selected()
        if selected is None:
            self.remove_button.set_sensitive(False)
            self.edit_button.set_sensitive(False)
        else:
            self.remove_button.set_sensitive(True)
            self.edit_button.set_sensitive(True)

        if self.store[selected][0]["type"] != "group":
            self.duplicate_button.set_sensitive(True)
        else:
            self.duplicate_button.set_sensitive(False)

        if selected is None or model.iter_previous(selected) is None:
            self.move_up_button.set_sensitive(False)
        else:
            self.move_up_button.set_sensitive(True)

        if selected is None or model.iter_next(selected) is None:
            self.move_down_button.set_sensitive(False)
        else:
            self.move_down_button.set_sensitive(True)

    def add_separator(self, *args):
        color = self.choose_separator_color()
        if color is not None:
            data = {
                "name": '',
                'icon': '',
                "group": '',
                "command": '',
                "color": color
            }
            self.store.append(None, self.create_list_entry('separator', data))
            self.list_changed()

    def add_item(self, *args):
        data, new_group = EditDialog('app', self.groups).run()
        if data is not None:
            if data["group"] in self.groups:
                parent = self.groups[data["group"]]
            elif new_group is not None:
                parent = self.create_group(new_group)
            else:
                parent = None
            self.store.append(parent, self.create_list_entry('app', data))
            if new_group is not None:
                self.tree_view.expand_row(self.store.get_path(parent), True)

            self.list_changed()

    def remove_item(self, *args):
        store, item = self.tree_view.get_selection().get_selected()
        item_type = self.store[item][0]['type']
        if item_type in ['app', 'group']:
            icon, name = [self.store[item][1].to_string(), self.store[item][2]]
        else:
            icon, name = ["list-remove-symbolic", _("Separator")]
        dialog = ConfirmDialog(icon, name)
        response = dialog.run()
        if response == Gtk.ResponseType.YES:
            if self.store.iter_has_child(item):
                # if deleted item is a group insert child's to root
                index = self.store.get_path(item)[0]
                for child in self.store[item].iterchildren():
                    data = {
                        "icon": child[1].to_string(),
                        "name": child[2],
                        "command": child[3],
                        "group": ''
                    }
                    self.store.insert(None, index, self.create_list_entry('app', data))
                    index += 1
                self.store.remove(item)
            else:
                # if deleted item is an app
                parent = self.store[item].get_parent()
                self.store.remove(item)

                # delete parent if they are no child's left
                if parent is not None:
                    if not self.store.iter_has_child(parent.iter):
                        self.store.remove(parent.iter)

            self.list_changed()

    def edit_item(self, *args):
        store, item = self.tree_view.get_selection().get_selected()
        parent = self.store[item].get_parent()
        item_type = self.store[item][0]['type']
        if item_type in ['app', 'group']:
            data, new_group = EditDialog('edit', self.groups, self.store[item]).run()
            if new_group is not None:
                self.create_group(new_group)
            if data is not None:
                # edit an application
                if data["type"] == "app":
                    if data["group"] != self.store[item][0]["group"]:
                        self.store.remove(item)
                        if data["group"] in self.groups:
                            new_parent = self.groups[data["group"]]
                        elif new_group is not None:
                            new_parent = self.create_group(new_group)
                        else:
                            new_parent = None
                        self.store.append(new_parent, self.create_list_entry('app', data))

                        if new_group is not None:
                            self.tree_view.expand_row(self.store.get_path(new_parent), True)

                        # delete parent if they are no child's left
                        if parent is not None:
                            if not self.store.iter_has_child(parent.iter):
                                self.store.remove(parent.iter)
                    else:
                        self.store[item][1] = Gio.Icon.new_for_string(data["icon"])
                        self.store[item][2] = data["name"]
                        self.store[item][3] = data["command"]
                # edit a group
                elif data["type"] == "group":
                    group_origin = self.store[item][2]

                    self.store[item][1] = Gio.Icon.new_for_string(data["icon"])
                    self.store[item][2] = data["name"]
                    for child in self.store[item].iterchildren():
                        child[0]["group"] = data["name"]
                    self.groups[data["name"]] = self.groups.pop(group_origin, None)
        elif item_type == 'separator':
            current_color = self.store[item][0]['color']
            new_color = self.choose_separator_color(current_color)
            if new_color is not None:
                self.store[item][0]['color'] = new_color
                self.store[item][2] = self.create_separator_markup(new_color)

        self.list_changed()

    def duplicate_item(self, *args):
        store, item = self.tree_view.get_selection().get_selected()
        parent = self.store[item].get_parent()
        if parent is not None:
            parent = parent.iter
        self.store.insert_after(parent, item, [*self.store[item]])

        self.list_changed()

    def choose_separator_color(self, rgb=[127,127,127]):
        colorchooser = Gtk.ColorChooserDialog(
            title=APP_NAME,
            rgba=Gdk.RGBA(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
        )
        colorchooser.set_use_alpha(False)
        colorchooser.set_position(Gtk.WindowPosition.MOUSE)

        response = colorchooser.run()
        if response == Gtk.ResponseType.OK:
            color = colorchooser.get_rgba()
            rgb = [
                math.floor(color.red * 255), 
                math.floor(color.green * 255), 
                math.floor(color.blue * 255)
            ]
            colorchooser.destroy()
            return rgb

        colorchooser.destroy()
        return None

    def move_item_up(self, *args):
        store, item = self.tree_view.get_selection().get_selected()
        self.store.swap(item, self.store.iter_previous(item))
        
        self.list_changed()

    def move_item_down(self, *args):
        store, item = self.tree_view.get_selection().get_selected()
        self.store.swap(item, self.store.iter_next(item))
        
        self.list_changed()

    def list_changed(self, *args):
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

        self.store.foreach(get_row_data, self.stored_apps, self.stored_groups)

        self.settings.set_value('list-applications', self.stored_apps)
        self.settings.set_value('list-groups', self.stored_groups)

        self.update_button_sensitivity()
