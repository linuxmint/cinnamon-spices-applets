#!/usr/bin/python3

import os
import json
import gi.repository.GLib as GLib
from gi.repository import Gio, Gtk
import random
from JsonSettingsWidgets import *

import gi
gi.require_version("Gtk", "3.0")


class RadioSearchWidget(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)
        self.key = key
        self.settings = settings
        self.info = info

        # ensures that the widget fully uses the avaiblabe space
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.removeOuterSpace()

        # Create data model
        self.initStore()

        # create filter
        self.station_filter = self.search_result_store.filter_new()
        self.station_filter.set_visible_func(self.filter)
        self.current_filter_text = None

        self.initAddButton()
        self.initTreeView()
        self.initSearchEntry()
        self.initInfoBar()

    # ensures no spaces above or right/left of the widget
    def removeOuterSpace(self):
        self.set_spacing(0)
        self.set_margin_left(0)
        self.set_margin_right(0)
        self.set_border_width(0)

    def initSearchEntry(self):
        # set up search input
        self.search_entry = Gtk.SearchEntry()
        self.search_entry.set_placeholder_text(_("Find Radio Station"))
        self.search_entry.connect('search-changed', self.search_entry_changed)
        self.pack_end(self.search_entry, False, False, 0)

    def initAddButton(self):
        self.add_button = Gtk.Button(label=_("Add to My Stations"))
        self.add_button.connect('clicked', self.add_button_pressed)
        self.add_button.set_sensitive(False)
        self.pack_end(self.add_button, False, True, 0)

    # creates an infobar and adds the infobar to a holder (based on the implementation of cinnamon ExtensionCore.py). But the infobar is not shown immediately (as the infobar only shall be shown after specific user actions)

    def initInfoBar(self):
        self.infobar = Gtk.InfoBar()
        self.infobar_icon = Gtk.Image()
        self.infobar_label = Gtk.Label()
        self.infobar_label.set_line_wrap(True)
        self.infobar.get_content_area().pack_start(self.infobar_icon, False, False, 12)
        self.infobar.get_content_area().pack_start(self.infobar_label, False, False, 0)

        self.infobar_holder = Gtk.Box()

        self.pack_end(self.infobar_holder, False, False, 0)

    def showInfobar(self, label, msg_type):
        self.infobar_holder.add(self.infobar)
        self.infobar_label.set_property("label", label)

        if (msg_type == "info"):
            self.infobar.set_message_type(Gtk.MessageType.INFO)
            self.infobar_icon.set_from_icon_name(
                "dialog-information-symbolic", Gtk.IconSize.LARGE_TOOLBAR)
            timeout = 3

        if (msg_type == "error"):
            self.infobar.set_message_type(Gtk.MessageType.ERROR)
            self.infobar_icon.set_from_icon_name(
                "dialog-error-symbolic", Gtk.IconSize.LARGE_TOOLBAR)
            timeout = 10

        self.infobar_holder.show_all()

        def hideInfobar():
            self.infobar_holder.remove(self.infobar)

        GLib.timeout_add_seconds(timeout, hideInfobar)

    def initTreeView(self):
        self.treeview = Gtk.TreeView(model=self.station_filter)
        for i, column_title in enumerate(
            ["Name",  "URL"]
        ):
            renderer = Gtk.CellRendererText()
            column = Gtk.TreeViewColumn(column_title, renderer, text=i)
            column.set_resizable(True)
            column.set_max_width(300)
            self.treeview.append_column(column)

        scrollbox = Gtk.ScrolledWindow()
        scrollbox.set_size_request(-1, 400)
        scrollbox.set_policy(Gtk.PolicyType.AUTOMATIC,
                             Gtk.PolicyType.AUTOMATIC)
        scrollbox.add(self.treeview)
        self.pack_end(scrollbox, False, False, 0)
        self.treeview.get_selection().connect("changed", self.on_tree_selection_changed)




    def on_tree_selection_changed(self, *args):
        self.add_button.set_sensitive(True)

    def initStore(self):
        self.search_result_store = Gtk.ListStore(str, str)
        dir_path = os.path.dirname(os.path.realpath(__file__))
        file_path = dir_path + '/allStations.json'
        with open(file_path) as f:
            allStations = json.load(f)
        for station in allStations:
            self.search_result_store.append(station)

    def filter(self, model, iter, data):
        if (self.current_filter_text is None):
            return True  # meaning no filter
        else:
            return self.current_filter_text.strip().lower() in model[iter][0].lower()

    def search_entry_changed(self, *args):
        self.current_filter_text = self.search_entry.props.text
        self.station_filter.refilter()

    def add_button_pressed(self, *args):
        model, t_iter = self.treeview.get_selection().get_selected()
        row = model[t_iter]
        selectedStation = {
            "name": row[0],
            "url": row[1],
            "inc": True
        }

        try:
            self.addStation(selectedStation)
            self.showInfobar(
                'Station ' + selectedStation["name"] + ' sucessfully added to "My Stations"!', "info")
        except Exception as err:
            self.showInfobar(format(err), "error")

        self.treeview.get_selection().connect("changed", self.on_tree_selection_changed)
        # selection.connect('changed' self.on_tree_selection_changed)

    # saves passed station to settings

    def addStation(self, station):
        userStationList = []
        settings_key = "tree"
        for saved_station in self.settings.get_value(settings_key):
            if saved_station["url"] == station["url"]:
                raise Exception("Can't add station as each station must have a different url. The station " +
                                saved_station["name"] + " has already the provided url")

            if saved_station["name"] == station["name"]:
                raise Exception("Can't add station as each station must have a different name. There is already a station with name: " +
                                station["name"] + ". Rename the station and try to add the station again.")
            # each entry returned from get_value is a OrderedDict but must be for some reasons a normal Dict as arg for set_value.
            userStationList.append(dict(saved_station))
        userStationList.append(station)
        self.settings.set_value(settings_key, userStationList)
