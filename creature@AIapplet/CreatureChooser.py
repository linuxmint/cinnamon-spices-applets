#!/usr/bin/python3
import json
import os
import traceback
from typing import Dict, Any

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gio, Gtk

try:
    from xapp.SettingsWidgets import SettingsWidget
except Exception:
    class SettingsWidget(Gtk.Box):
        def __init__(self, *args, **kwargs):
            Gtk.Box.__init__(self, orientation=Gtk.Orientation.VERTICAL, spacing=6)


class CreatureChooser(SettingsWidget):
    def __init__(self, info: Dict[str, Any], key: str, settings: Gio.Settings):
        try:
            super().__init__()
        except TypeError:
            Gtk.Box.__init__(self, orientation=Gtk.Orientation.VERTICAL, spacing=6)

        self.info = info or {}
        self.key = key
        self.settings = settings
        self._updating = False

        try:
            self._build_ui()
        except Exception as exc:
            self._show_error(exc)

    def _show_error(self, exc: Exception):
        try:
            box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            title = Gtk.Label(label="Le sélecteur de créature n'a pas pu se charger.", xalign=0)
            title.set_line_wrap(True)
            detail = Gtk.Label(label=str(exc), xalign=0)
            detail.set_line_wrap(True)
            box.pack_start(title, False, False, 0)
            box.pack_start(detail, False, False, 0)
            self.pack_start(box, True, True, 0)
            print("[creature@AIapplet] CreatureChooser error:")
            traceback.print_exc()
        except Exception:
            pass

    def _build_ui(self):
        library_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "creature-library.json")
        with open(library_path, "r", encoding="utf-8") as handle:
            self.library = json.load(handle)

        self.tree = self.library.get("tree", {})
        self.slug_paths = {}
        self._build_slug_paths()

        current_slug = self._safe_get_value(self.settings.get_value(self.key))
        if not current_slug or current_slug not in self.slug_paths:
            current_slug = self.library.get("default_slug", "pigeon")
        if current_slug not in self.slug_paths and self.slug_paths:
            current_slug = sorted(self.slug_paths.keys())[0]

        self.combo_category = Gtk.ComboBoxText()
        self.combo_type = Gtk.ComboBoxText()
        self.combo_habitat = Gtk.ComboBoxText()
        self.combo_family = Gtk.ComboBoxText()
        self.combo_creature = Gtk.ComboBoxText()

        self.summary_label = Gtk.Label(xalign=0)
        self.summary_label.set_line_wrap(True)

        self.combo_category.connect("changed", self._on_category_changed)
        self.combo_type.connect("changed", self._on_type_changed)
        self.combo_habitat.connect("changed", self._on_habitat_changed)
        self.combo_family.connect("changed", self._on_family_changed)
        self.combo_creature.connect("changed", self._on_creature_changed)

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        root.set_tooltip_text(self.info.get("tooltip", ""))
        root.pack_start(self._row("Catégorie", self.combo_category), False, False, 0)
        root.pack_start(self._row("Type", self.combo_type), False, False, 0)
        root.pack_start(self._row("Milieu", self.combo_habitat), False, False, 0)
        root.pack_start(self._row("Famille", self.combo_family), False, False, 0)
        root.pack_start(self._row("Créature", self.combo_creature), False, False, 0)
        root.pack_start(self.summary_label, False, False, 0)
        self.pack_start(root, True, True, 0)

        self._populate_category()
        if current_slug in self.slug_paths:
            self._apply_path(self.slug_paths[current_slug])

    def _safe_get_value(self, value):
        return value.unpack() if hasattr(value, "unpack") else value

    def _set_string_value(self, value: str):
        value = "" if value is None else str(value)
        if hasattr(self.settings, "set_string"):
            self.settings.set_string(self.key, value)
        else:
            self.settings.set_value(self.key, value)

    def _row(self, label_text, widget):
        box = Gtk.Box(spacing=6)
        label = Gtk.Label(label_text, xalign=0)
        label.set_size_request(90, -1)
        box.pack_start(label, False, False, 0)
        box.pack_start(widget, True, True, 0)
        return box

    def _build_slug_paths(self):
        for category_key, category_node in self.tree.items():
            for type_key, type_node in category_node.get("children", {}).items():
                for habitat_key, habitat_node in type_node.get("children", {}).items():
                    for family_key, family_node in habitat_node.get("children", {}).items():
                        for creature in family_node.get("creatures", []):
                            slug = creature.get("slug")
                            if slug:
                                self.slug_paths[slug] = (category_key, type_key, habitat_key, family_key, slug)

    def _clear_combo(self, combo):
        combo.remove_all()

    def _set_first_active(self, combo):
        model = combo.get_model()
        if model is not None and model.iter_n_children(None) > 0:
            combo.set_active(0)

    def _populate_category(self):
        self._clear_combo(self.combo_category)
        for category_key, category_node in self.tree.items():
            self.combo_category.append(category_key, category_node.get("label", category_key))
        self._set_first_active(self.combo_category)

    def _populate_type(self, selected_type=None):
        self._clear_combo(self.combo_type)
        category_key = self.combo_category.get_active_id()
        if not category_key: return
        for type_key, type_node in self.tree[category_key].get("children", {}).items():
            self.combo_type.append(type_key, type_node.get("label", type_key))
        if selected_type: self.combo_type.set_active_id(selected_type)
        if self.combo_type.get_active_id() is None: self._set_first_active(self.combo_type)

    def _populate_habitat(self, selected_habitat=None):
        self._clear_combo(self.combo_habitat)
        category_key = self.combo_category.get_active_id(); type_key = self.combo_type.get_active_id()
        if not category_key or not type_key: return
        for habitat_key, habitat_node in self.tree[category_key]["children"][type_key].get("children", {}).items():
            self.combo_habitat.append(habitat_key, habitat_node.get("label", habitat_key))
        if selected_habitat: self.combo_habitat.set_active_id(selected_habitat)
        if self.combo_habitat.get_active_id() is None: self._set_first_active(self.combo_habitat)

    def _populate_family(self, selected_family=None):
        self._clear_combo(self.combo_family)
        category_key = self.combo_category.get_active_id(); type_key = self.combo_type.get_active_id(); habitat_key = self.combo_habitat.get_active_id()
        if not category_key or not type_key or not habitat_key: return
        habitat_node = self.tree[category_key]["children"][type_key]["children"][habitat_key]
        for family_key, family_node in habitat_node.get("children", {}).items():
            self.combo_family.append(family_key, family_node.get("label", family_key))
        if selected_family: self.combo_family.set_active_id(selected_family)
        if self.combo_family.get_active_id() is None: self._set_first_active(self.combo_family)

    def _populate_creature(self, selected_slug=None):
        self._clear_combo(self.combo_creature)
        category_key = self.combo_category.get_active_id(); type_key = self.combo_type.get_active_id(); habitat_key = self.combo_habitat.get_active_id(); family_key = self.combo_family.get_active_id()
        if not category_key or not type_key or not habitat_key or not family_key: return
        creatures = self.tree[category_key]["children"][type_key]["children"][habitat_key]["children"][family_key].get("creatures", [])
        for creature in creatures:
            slug = creature.get("slug")
            if slug: self.combo_creature.append(slug, creature.get("label", slug))
        if selected_slug: self.combo_creature.set_active_id(selected_slug)
        if self.combo_creature.get_active_id() is None: self._set_first_active(self.combo_creature)

    def _apply_path(self, path_tuple):
        self._updating = True
        category_key, type_key, habitat_key, family_key, slug = path_tuple
        self.combo_category.set_active_id(category_key)
        self._populate_type(type_key)
        self._populate_habitat(habitat_key)
        self._populate_family(family_key)
        self._populate_creature(slug)
        self._updating = False
        self._refresh_summary_and_save()

    def _refresh_summary_and_save(self):
        try:
            category_key = self.combo_category.get_active_id(); type_key = self.combo_type.get_active_id(); habitat_key = self.combo_habitat.get_active_id(); family_key = self.combo_family.get_active_id(); slug = self.combo_creature.get_active_id()
            if not all([category_key, type_key, habitat_key, family_key, slug]): return
            category_label = self.tree[category_key].get("label", category_key)
            type_label = self.tree[category_key]["children"][type_key].get("label", type_key)
            habitat_label = self.tree[category_key]["children"][type_key]["children"][habitat_key].get("label", habitat_key)
            family_node = self.tree[category_key]["children"][type_key]["children"][habitat_key]["children"][family_key]
            family_label = family_node.get("label", family_key)
            creature_label = slug
            for creature in family_node.get("creatures", []):
                if creature.get("slug") == slug:
                    creature_label = creature.get("label", slug); break
            self.summary_label.set_text(f"Sélection : {category_label} → {type_label} → {habitat_label} → {family_label} → {creature_label}")
            self._set_string_value(slug)
        except Exception:
            traceback.print_exc()

    def _on_category_changed(self, _widget):
        if self._updating: return
        self._updating = True; self._populate_type(); self._populate_habitat(); self._populate_family(); self._populate_creature(); self._updating = False; self._refresh_summary_and_save()

    def _on_type_changed(self, _widget):
        if self._updating: return
        self._updating = True; self._populate_habitat(); self._populate_family(); self._populate_creature(); self._updating = False; self._refresh_summary_and_save()

    def _on_habitat_changed(self, _widget):
        if self._updating: return
        self._updating = True; self._populate_family(); self._populate_creature(); self._updating = False; self._refresh_summary_and_save()

    def _on_family_changed(self, _widget):
        if self._updating: return
        self._updating = True; self._populate_creature(); self._updating = False; self._refresh_summary_and_save()

    def _on_creature_changed(self, _widget):
        if self._updating: return
        self._refresh_summary_and_save()
