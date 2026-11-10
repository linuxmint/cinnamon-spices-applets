#!/usr/bin/python3

# Written by: JoeJoeTV
# based on code from the applet app-launcher@mchilli

import gi
gi.require_version("Gtk", "3.0")
gi.require_version('XApp', '1.0')

import os
import sys
import time
import math
import gettext
from gi.repository import GLib, Gio, Gtk, Gdk
from JsonSettingsWidgets import *

APPLET_DIR = os.path.join(os.path.dirname(os.path.normpath(__file__)))

# Fallback UUID of applet
UUID = "kdecapplet@joejoetv"

# Read UUID from metadata.json file in applet directory
try:
    with open(os.path.join(APPLET_DIR, "metadata.json"), "r") as jsonfile:
        JSONMetadata = json.load(jsonfile)

    UUID = JSONMetadata["uuid"]
except Exception as e:
    print("Couldn't read metadata from metadata.json: ", e, file=sys.stderr)

# I18n support
gettext.install(UUID, GLib.get_home_dir() + '/.local/share/locale')

# Teplate for colums to pass to OrderList
# List of objects, each representing a column
COLUMNS_TEMPLATE = [
    {
        "title": "Test Title",      # Title of the column
        "type": "text",             # Type of column, can be one of: text, boolean, icon
        "align": "center",          # Alignment of column, can be one of: left, center, right
        "id": "test",               # The id that the entried of the column are stored as
        "translate": False          # Wether to translate the values in the column, while keeping the underlying data the same (only for "text" type)
    }
]

COLUMN_TYPE_MAP = {
    "text":     str,
    "boolean":  bool,
    "icon":     str
}

ALIGNMENT_MAP = {
    "left":     0,
    "center":   0.5,
    "right":    1
}

'''
    Settings Widget that displays a list that can be reordered, but not modified anyway else
'''
# NOTE: The "storage" key is used to get the settings entry to store the actualy data,
# NOTE: because the "custom" settings type can't currently be used to bind in JS code
class OrderList(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)
        self.key = key
        self.settings = settings
        self.info = info
        
        # Get column structure from info
        self.columns = self.info["columns"]
        
        # Gett settings key for storig actual settings data
        self.storage = self.info["storage"]
        
        if ("size" in self.info):
            self.size = self.info["size"]
        else:
            self.size = 150
        
        # Flag to stop saving settings, when loading them
        self.dontModify = False
        
        # Flag to use when user has dropped something on the widget
        self.droppedDND = False
        
        # Remove margin and spacing around widget, since it should fill the whole space
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(0)
        self.set_margin_left(0)
        self.set_margin_right(0)
        self.set_border_width(0)
        
        # Setup the tree view for the devices
        self.tree_view = Gtk.TreeView()
        self.tree_view.set_property("enable-grid-lines", 0)
        self.tree_view.set_property("enable-tree-lines", False)
        self.tree_view.set_property("reorderable", True)

        # Make tree view scrollable, if it gets too big
        self.scrollbox = Gtk.ScrolledWindow()
        self.scrollbox.set_size_request(-1, self.size)
        self.scrollbox.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.pack_start(self.scrollbox, True, True, 0)
        self.scrollbox.add(self.tree_view)
        
        # Add columns
        
        # List of types to initialize model with
        model_type_list = [object]
        
        for i, col in enumerate(self.columns):
            if col["type"] == "text":
                renderer = Gtk.CellRendererText()
                attribute = "text"
            elif col["type"] == "icon":
                renderer = Gtk.CellRendererPixbuf()
                attribute = "icon-name"
            elif col["type"] == "boolean":
                renderer = Gtk.CellRendererToggle()
                renderer.set_property("activatable", True)
                renderer.connect("toggled", self.on_checkboxcolumn_toggle, i+1)
                attribute = "active"
            else:
                raise ValueError("Unknown type for column "+i)
                continue
            
            # Add matching type to type list, so we can later use it to build the model
            model_type_list.append(COLUMN_TYPE_MAP[col["type"]])
            
            # Set alignment set in column structure, vertical alignment is always center
            renderer.set_alignment(ALIGNMENT_MAP[col["align"]], ALIGNMENT_MAP["center"])
            
            column = Gtk.TreeViewColumn(col["title"], renderer)
            column.add_attribute(renderer, attribute, i+1)
            column.set_alignment(0)
            column.set_resizable(True)
            self.tree_view.append_column(column)
        
        # Create ListStore with created type list
        self.store = Gtk.ListStore(*model_type_list)
        self.tree_view.set_model(self.store)
        
        # Toolbar with buttons
        button_toolbar = Gtk.Toolbar()
        button_toolbar.set_icon_size(1)
        self.pack_start(button_toolbar, False, False, 0)
        
        # Button to move row up
        self.move_up_button = Gtk.ToolButton(None, None)
        self.move_up_button.set_icon_name("go-up-symbolic")
        self.move_up_button.set_tooltip_text(_("Move selected entry up"))
        self.move_up_button.connect("clicked", self.move_item_up)
        self.move_up_button.set_sensitive(False)

        # Button to move row down
        self.move_down_button = Gtk.ToolButton(None, None)
        self.move_down_button.set_icon_name("go-down-symbolic")
        self.move_down_button.set_tooltip_text(_("Move selected entry down"))
        self.move_down_button.connect("clicked", self.move_item_down)
        self.move_down_button.set_sensitive(False)
        
        button_toolbar.insert(self.move_up_button, -1)
        button_toolbar.insert(self.move_down_button, -1)
        
        # Restore list from settings
        self.restore_list()
        
        # NOTE: "value" property of the settings object gets added by the js part of cinnamon when installing or upgrading the settings, IF the "default" property is set
        
        # Connect signals for tree view
        self.tree_view.get_selection().connect("changed", self.update_button_sensitivity)
        self.tree_view.connect("drag-drop", self.on_drag_drop)
        self.tree_view.connect("drag-motion", self.on_drag_motion)
        
        # Use "row-deleted" signal, as it is the only one signalled at the right time AFAIK
        self.store.connect("row-deleted", self.on_row_deleted)
        
        #self.settings.listen(self.key, self.valid_backup_restore)
        self.settings.listen(self.storage, self.valid_backup_restore)
    
    ## Callbacks
    
    def on_checkboxcolumn_toggle(self, renderer, path, column, *args):
        old_value = self.store[path][column]
        
        self.store[path][column] = not old_value
        
        self.list_changed()
        
    def on_drag_drop(self, *args):
        self.droppedDND = True
    
    def on_row_deleted(self, *args):
        if self.droppedDND and (not self.dontModify):
            self.list_changed()
            
            # Reset DND flag
            self.droppedDND = False
    
    def on_drag_motion(self, *args):
        # Reset droppedDND value, if not reset by row-deleted signal
        self.droppedDND = False
    
    ## List functions
    
    def restore_list(self):
        # Don't modify from callback
        self.dontModify = True
        
        self.store.clear()
        
        #self.stored_entries = self.settings.get_value(self.key)
        self.stored_entries = self.settings.get_value(self.storage)
        
        for entry in self.stored_entries:
            entry_value_list = [entry]
            
            for i, col in enumerate(self.columns):
                if col["id"] in entry:
                    if col["type"] == "text" and ("translate" in col and col["translate"] == True):
                        entry_value_list.append(_(entry[col["id"]]))
                    else:
                        entry_value_list.append(entry[col["id"]])
                else:
                    raise ValueError("Entry of column "+str(i)+" doesn't contain key: "+col["id"])
                    continue
            
            self.store.append(entry_value_list)

        self.tree_view.expand_all()
        
        self.dontModify = False
    
    def list_changed(self):
        def get_row_data(store, treepath, treeiter, devices):
            item = {}
            
            for i, col in enumerate(self.columns):
                if col["type"] == "text" and ("translate" in col and col["translate"] == True):
                    item[col["id"]] = store[treeiter][0][col["id"]]
                else:
                    item[col["id"]] = store[treeiter][i+1]
            
            devices.append(item)
        
        self.stored_entries = []
        
        self.store.foreach(get_row_data, self.stored_entries)
        
        #self.settings.set_value(self.key, self.stored_entries)
        self.settings.set_value(self.storage, self.stored_entries)
        
        self.update_button_sensitivity()
        
    def update_button_sensitivity(self, *args):
        model, selected = self.tree_view.get_selection().get_selected()
        
        if selected is None or model.iter_previous(selected) is None:
            self.move_up_button.set_sensitive(False)
        else:
            self.move_up_button.set_sensitive(True)

        if selected is None or model.iter_next(selected) is None:
            self.move_down_button.set_sensitive(False)
        else:
            self.move_down_button.set_sensitive(True)
    
    def valid_backup_restore(self, key, changed_entries):
        ''' restore list only if there are changes between internally 
            stored apps/groups and saved apps/groups in applet settings,
            e.g. when you restore a backup.
        '''
        if not changed_entries == self.stored_entries:
            self.restore_list()
    
    def move_item_up(self, *args):
        store, item = self.tree_view.get_selection().get_selected()
        self.store.swap(item, self.store.iter_previous(item))
        
        self.list_changed()

    def move_item_down(self, *args):
        store, item = self.tree_view.get_selection().get_selected()
        self.store.swap(item, self.store.iter_next(item))
        
        self.list_changed()
