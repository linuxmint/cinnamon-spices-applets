#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
RadioViva - Widget de Busca e Adição de Rádios Brasileiras
Integrado à janela de configurações nativa do Cinnamon (cinnamon-settings)
"""

import os
import json
import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gio, Gtk, GLib
from JsonSettingsWidgets import SettingsWidget

class RadioSearchWidget(SettingsWidget):
    def __init__(self, info, key, settings):
        super().__init__()
        self.key = key
        self.settings = settings
        self.info = info

        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(8)
        self.set_margin_left(4)
        self.set_margin_right(4)
        self.set_margin_top(4)
        self.set_margin_bottom(4)

        # Carregar catálogo
        self.initStore()

        # Filtro de busca
        self.station_filter = self.search_result_store.filter_new()
        self.station_filter.set_visible_func(self.filter_stations)
        self.current_filter_text = None

        # Componentes visuais
        self.initSearchEntry()
        self.initTreeView()
        self.initAddButton()
        self.initInfoBar()

    def initStore(self):
        # Colunas: Nome (str), Estado UF (str), Cidade/Gênero (str), URL (str)
        self.search_result_store = Gtk.ListStore(str, str, str, str)
        dir_path = os.path.dirname(os.path.realpath(__file__))
        file_path = os.path.join(dir_path, "data", "stations_brasil.json")

        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                stations = json.load(f)
            for s in stations:
                name = s.get("name", "").strip()
                uf = s.get("state", "BR").strip()
                city = s.get("city", "").strip()
                genre = s.get("genre", "").strip()
                detalhe = f"{city} • {genre}" if city and genre else (city or genre or "Nacional")
                url = s.get("url", "").strip()
                self.search_result_store.append([name, uf, detalhe, url])

    def initSearchEntry(self):
        self.search_entry = Gtk.SearchEntry()
        self.search_entry.set_placeholder_text("🔍 Digite o nome da rádio, cidade, estado (ex: SP, Campinas, Rock, CBN)...")
        self.search_entry.connect("search-changed", self.on_search_changed)
        self.pack_start(self.search_entry, False, False, 0)

    def initTreeView(self):
        self.treeview = Gtk.TreeView(model=self.station_filter)
        self.treeview.set_rules_hint(True)

        columns = [
            ("Nome da Rádio", 0, 260),
            ("UF", 1, 60),
            ("Cidade / Gênero", 2, 180),
            ("URL do Stream", 3, 220)
        ]

        for title, col_idx, width in columns:
            renderer = Gtk.CellRendererText()
            column = Gtk.TreeViewColumn(title, renderer, text=col_idx)
            column.set_resizable(True)
            column.set_min_width(width)
            self.treeview.append_column(column)

        scrollbox = Gtk.ScrolledWindow()
        scrollbox.set_size_request(-1, 380)
        scrollbox.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        scrollbox.add(self.treeview)
        self.pack_start(scrollbox, True, True, 0)

        self.treeview.get_selection().connect("changed", self.on_selection_changed)

    def initAddButton(self):
        self.add_button = Gtk.Button(label="➕ Adicionar Selecionada às Minhas Rádios")
        self.add_button.connect("clicked", self.on_add_button_clicked)
        self.add_button.set_sensitive(False)
        self.pack_start(self.add_button, False, False, 0)

    def initInfoBar(self):
        self.infobar = Gtk.InfoBar()
        self.infobar_icon = Gtk.Image()
        self.infobar_label = Gtk.Label()
        self.infobar_label.set_line_wrap(True)
        self.infobar.get_content_area().pack_start(self.infobar_icon, False, False, 8)
        self.infobar.get_content_area().pack_start(self.infobar_label, False, False, 0)

        self.infobar_holder = Gtk.Box()
        self.pack_start(self.infobar_holder, False, False, 0)

    def show_infobar(self, message, msg_type="info"):
        self.infobar_holder.foreach(lambda w: self.infobar_holder.remove(w))
        self.infobar_holder.add(self.infobar)
        self.infobar_label.set_text(message)

        if msg_type == "info":
            self.infobar.set_message_type(Gtk.MessageType.INFO)
            self.infobar_icon.set_from_icon_name("dialog-information-symbolic", Gtk.IconSize.BUTTON)
            timeout = 3
        else:
            self.infobar.set_message_type(Gtk.MessageType.ERROR)
            self.infobar_icon.set_from_icon_name("dialog-error-symbolic", Gtk.IconSize.BUTTON)
            timeout = 6

        self.infobar_holder.show_all()

        def hide():
            if self.infobar.get_parent() == self.infobar_holder:
                self.infobar_holder.remove(self.infobar)
            return False

        GLib.timeout_add_seconds(timeout, hide)

    def filter_stations(self, model, iter, data):
        if not self.current_filter_text:
            return True
        q = self.current_filter_text.strip().lower()
        name = (model[iter][0] or "").lower()
        uf = (model[iter][1] or "").lower()
        detalhe = (model[iter][2] or "").lower()
        return q in name or q in uf or q in detalhe

    def on_search_changed(self, entry):
        self.current_filter_text = entry.get_text()
        self.station_filter.refilter()

    def on_selection_changed(self, selection):
        model, t_iter = selection.get_selected()
        self.add_button.set_sensitive(t_iter is not None)

    def on_add_button_clicked(self, button):
        model, t_iter = self.treeview.get_selection().get_selected()
        if not t_iter:
            return

        name = model[t_iter][0]
        uf = model[t_iter][1]
        url = model[t_iter][3]

        display_name = f"{name} ({uf})" if uf and uf != "BR" and f"({uf})" not in name else name

        station_obj = {
            "name": display_name,
            "url": url,
            "inc": True
        }

        try:
            self.add_to_user_stations(station_obj)
            self.show_infobar(f'Rádio "{display_name}" adicionada com sucesso às "Minhas Rádios"!', "info")
        except Exception as err:
            self.show_infobar(str(err), "error")

    def add_to_user_stations(self, new_station):
        settings_key = "user-stations"
        current_list = self.settings.get_value(settings_key) or []

        for item in current_list:
            if item.get("url") == new_station["url"]:
                raise Exception(f'Esta URL já está cadastrada na rádio "{item.get("name")}".')
            if item.get("name") == new_station["name"]:
                raise Exception(f'Já existe uma rádio com o nome "{item.get("name")}".')

        updated = [dict(s) for s in current_list]
        updated.append(new_station)
        self.settings.set_value(settings_key, updated)
