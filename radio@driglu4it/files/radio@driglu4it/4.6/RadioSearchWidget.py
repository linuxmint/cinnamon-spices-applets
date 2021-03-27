#!/usr/bin/python3

import random
from JsonSettingsWidgets import *
from gi.repository import Gio, Gtk
import requests
import json
import os


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
        self.add_button = Gtk.Button(_("Add to My Stations"))
        self.add_button.connect('clicked', self.add_button_pressed)
        self.pack_end(self.add_button, False, True, 0)

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
        userStationList = []
        for station in self.settings.get_value("tree"):
            dict = {
                "name": station['name'],
                "url": station['url'],
                "inc": station['inc']
            }
            userStationList.append(dict)

        model, t_iter = self.treeview.get_selection().get_selected()
        row = model[t_iter]
        selectedStation = {
            "name": row[0],
            "url": row[1],
            "inc": True
        }
        userStationList.append(selectedStation)
        self.settings.set_value('tree', userStationList)
