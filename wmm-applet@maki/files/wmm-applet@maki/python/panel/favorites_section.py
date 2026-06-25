#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM
----------------------------
favorites_section.py – Sección de Favoritos del panel de control.

Gestiona los presets (composiciones de fondos guardadas) y la lista
plana de favoritos individuales. Permite crear, cargar, renombrar,
eliminar y gestionar tanto presets como imágenes favoritas.
"""

import os
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Pango
from debug_logger import log_event
from i18n import _

class FavoritesSection:
    """
    Sección de Favoritos del panel de control.
    """

    def __init__(self, handler, backend, ie, left_col, callbacks=None):
        """
        Args:
            handler:  Instancia de ConfigHandler.
            backend:  Instancia de WMMBackend.
            ie:       Instancia de ImageEngine.
            left_col: El Gtk.Box donde se empaquetará esta sección.
            callbacks: Diccionario con funciones de callback para
                       comunicarse con el panel principal:
                       - 'on_load_preset_to_edit': (preset_name, preset_monitors)
                       - 'on_update_mode_info_label': ()
                       - 'on_show_warning_dialog': (message)
                       - 'get_loading_state': () -> bool
                       - 'get_parent_window': () -> Gtk.Window
        """
        self.handler = handler
        self.backend = backend
        self.ie = ie
        self._callbacks = {}  # Se configurarán después con set_callbacks()
        self._current_preset_name = None

        # Construir la interfaz
        self.widget = self._build()
        left_col.pack_start(self.widget, True, True, 0)

    def set_callbacks(self, callbacks):
        """Asigna los callbacks después de que la instancia exista."""
        self._callbacks = callbacks or {}

    # ==========================================================
    # PROPIEDADES DE ACCESO RÁPIDO A CALLBACKS
    # ==========================================================
    @property
    def _loading(self):
        """Devuelve True si el panel está en estado de carga."""
        cb = self._callbacks.get('get_loading_state')
        return cb() if cb else False

    @property
    def _parent_window(self):
        """Devuelve la ventana principal del panel."""
        cb = self._callbacks.get('get_parent_window')
        return cb() if cb else None

    # ==========================================================
    # CONSTRUCCIÓN DE LA INTERFAZ
    # ==========================================================
    def _build(self):
        """Construye y devuelve el widget principal de la sección."""
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)

        # --- Cabecera con switch "Solo favoritos" ---
        header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)
        label = Gtk.Label()
        label.set_markup(f"<span weight='bold' size='large'>{_('Favorites')}</span>")
        label.set_halign(Gtk.Align.START)
        header_box.pack_start(label, True, True, 0)
        self.fav_rotation_switch = Gtk.Switch(active=False)
        self.fav_rotation_switch.set_tooltip_text(_("Slideshow only among favorite images"))
        self.fav_rotation_switch.connect("notify::active", self._on_fav_rotation_changed)
        header_box.pack_end(self.fav_rotation_switch, False, False, 0)
        vbox.pack_start(header_box, False, False, 0)

        self.favorites_container = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.favorites_container.get_style_context().add_class("favorites-panel")

        self.paned = Gtk.HPaned()

        # ----------------------------------------------------------
        # Panel izquierdo: PRESETS
        # ----------------------------------------------------------
        left_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)

        presets_header = Gtk.Button(label=_("Presets"), relief=Gtk.ReliefStyle.NONE)
        presets_header.connect("clicked", self._expand_left_panel)
        left_box.pack_start(presets_header, False, False, 0)

        self.presets_model = Gtk.TreeStore(str, str, bool)  # [nombre, ruta, is_preset]
        self.presets_tree = Gtk.TreeView(model=self.presets_model)
        self.presets_tree.set_headers_visible(False)
        self.presets_tree.connect("row-activated", self._on_preset_row_activated)

        col_name = Gtk.TreeViewColumn(_("Name"))
        renderer_text = Gtk.CellRendererText()
        col_name.pack_start(renderer_text, True)
        col_name.set_cell_data_func(renderer_text, self._render_preset_name)
        self.presets_tree.append_column(col_name)

        renderer_text.connect("edited", self._on_preset_renamed)
        self.presets_tree.connect("button-press-event", self._on_preset_tree_click)

        self.scrolled_left = Gtk.ScrolledWindow()
        self.scrolled_left.set_min_content_height(150)
        self.scrolled_left.add(self.presets_tree)
        left_box.pack_start(self.scrolled_left, True, True, 0)

        ctrl_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)
        del_btn = Gtk.Button.new_from_icon_name("user-trash", Gtk.IconSize.BUTTON)
        del_btn.set_tooltip_text(_("Delete selected preset/image"))
        del_btn.connect("clicked", self._on_delete_preset_clicked)
        ctrl_box.pack_end(del_btn, False, False, 0)
        left_box.pack_start(ctrl_box, False, False, 0)

        self.paned.pack1(left_box, True, False)

        # ----------------------------------------------------------
        # Panel derecho: FAVORITOS INDIVIDUALES
        # ----------------------------------------------------------
        right_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)

        single_header = Gtk.Button(label=_("Favorites"), relief=Gtk.ReliefStyle.NONE)
        single_header.connect("clicked", self._expand_right_panel)
        right_box.pack_start(single_header, False, False, 0)

        self.bookmarks_single_model = Gtk.ListStore(str, str)  # [nombre, ruta]
        self.bookmarks_single_tree = Gtk.TreeView(model=self.bookmarks_single_model)
        self.bookmarks_single_tree.set_headers_visible(False)
        self.bookmarks_single_tree.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE)
        self.bookmarks_single_tree.connect("row-activated", self._on_bookmark_single_row_activated)

        col_single = Gtk.TreeViewColumn(_("Name"))
        renderer_single = Gtk.CellRendererText()
        col_single.pack_start(renderer_single, True)
        col_single.set_cell_data_func(renderer_single, self._render_bookmark_single)
        self.bookmarks_single_tree.append_column(col_single)

        self.bookmarks_single_tree.connect("button-press-event", self._on_single_tree_click)

        self.scrolled_right = Gtk.ScrolledWindow()
        self.scrolled_right.set_min_content_height(150)
        self.scrolled_right.add(self.bookmarks_single_tree)
        right_box.pack_start(self.scrolled_right, True, True, 0)

        btn_box_right = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)
        del_btn_right = Gtk.Button.new_from_icon_name("user-trash", Gtk.IconSize.BUTTON)
        del_btn_right.set_tooltip_text(_("Delete selected image from favorites"))
        del_btn_right.connect("clicked", self._on_delete_single_clicked)
        btn_box_right.pack_end(del_btn_right, False, False, 0)
        right_box.pack_start(btn_box_right, False, False, 0)

        self.paned.pack2(right_box, True, False)

        self.favorites_container.pack_start(self.paned, True, True, 0)
        vbox.pack_start(self.favorites_container, True, True, 0)

        return vbox

    # ==========================================================
    # ALTERNANCIA DE PANELES
    # ==========================================================
    def _expand_left_panel(self, widget):
        """Alterna el panel izquierdo entre el 80% y el 50% del ancho."""
        if self.paned.get_allocated_width() > 0:
            half = self.paned.get_allocated_width() // 2
            current = self.paned.get_position()
            if current > half * 1.4:
                self.paned.set_position(half)
            else:
                self.paned.set_position(int(self.paned.get_allocated_width() * 0.8))

    def _expand_right_panel(self, widget):
        """Alterna el panel derecho entre el 20% y el 50% del ancho."""
        if self.paned.get_allocated_width() > 0:
            half = self.paned.get_allocated_width() // 2
            current = self.paned.get_position()
            if current < half * 0.6:
                self.paned.set_position(half)
            else:
                self.paned.set_position(int(self.paned.get_allocated_width() * 0.2))

    # ==========================================================
    # CARGA DE DATOS
    # ==========================================================
    def _load_presets(self):
        """Carga los presets desde bookmarks.json y los muestra en el treeview."""
        self.presets_model.clear()
        bookmarks = self.backend.load_json("bookmarks")
        for preset_name, monitors in bookmarks.items():
            parent_iter = self.presets_model.append(None, [preset_name, "", True])
            for m_hash, entry in monitors.items():
                if m_hash.startswith("__"):
                    continue
                if isinstance(entry, dict):
                    img_path = entry.get("path", "") or ""
                else:
                    img_path = entry or ""
                display_name = os.path.basename(img_path) if img_path else "(" + _("empty") + ")"
                self.presets_model.append(parent_iter, [display_name, img_path, False])

    def _load_bookmarks_single(self):
        """Carga la lista plana de favoritos desde bookmarks_single_list.json."""
        self.bookmarks_single_model.clear()
        flat_list = self.backend.load_json("bookmarks_single")
        for entry in flat_list:
            if len(entry) >= 4 and entry[0]:
                name = os.path.basename(entry[0])
                self.bookmarks_single_model.append([name, entry[0]])

    # ==========================================================
    # RENDERERS DEL TREEVIEW DE PRESETS
    # ==========================================================
    def _render_preset_name(self, column, cell, model, iter, data):
        name = model.get_value(iter, 0)
        is_preset = model.get_value(iter, 2)
        cell.set_property("text", name)
        cell.set_property("weight", 700 if is_preset else 400)
        cell.set_property("editable", is_preset)
        if not is_preset and model.get_value(iter, 1) == "":
            cell.set_property("style", Pango.Style.ITALIC)
        else:
            cell.set_property("style", Pango.Style.NORMAL)

    def _render_bookmark_single(self, column, cell, model, iter, data):
        cell.set_property("text", model.get_value(iter, 0))

    # ==========================================================
    # EVENTOS DE PRESETS
    # ==========================================================
    def _on_preset_renamed(self, renderer, path, new_name):
        iter = self.presets_model.get_iter(path)
        if not iter:
            return
        old_name = self.presets_model.get_value(iter, 0)
        is_preset = self.presets_model.get_value(iter, 2)
        if not is_preset or old_name == new_name:
            return
        bookmarks = self.backend.load_json("bookmarks")
        if new_name in bookmarks:
            self._show_warning_dialog(_("A Preset with that name already exists!"))
            return
        bookmarks[new_name] = bookmarks.pop(old_name)
        self.backend.save_json("bookmarks", bookmarks)
        self._load_presets()
        self.handler.sync_bookmarks_flat_list()
        self.handler.refresh_history_metadata()

    def _on_preset_tree_click(self, treeview, event):
        if event.button != 3:
            return
        path = treeview.get_path_at_pos(int(event.x), int(event.y))
        if not path:
            return
        model = treeview.get_model()
        iter = model.get_iter(path[0])
        if not iter:
            return
        name = model.get_value(iter, 0)
        is_preset = model.get_value(iter, 2)

        menu = Gtk.Menu()
        if is_preset:
            item = Gtk.MenuItem(label=_("Delete preset"))
            item.connect("activate", self._delete_preset, name)
            item_load = Gtk.MenuItem(label=_("Load on screens"))
            item_load.connect("activate", self._load_preset_to_monitors, name)
            menu.append(item_load)
        else:
            img_path = model.get_value(iter, 1)
            if isinstance(img_path, dict):
                img_path = img_path.get("path", "")
            item = Gtk.MenuItem(label=_("Delete image"))
            item.connect("activate", self._delete_image_from_preset, iter)
        menu.append(item)
        menu.show_all()
        menu.popup(None, None, None, None, event.button, event.time)

    def _delete_preset(self, widget, preset_name):
        if self.handler.delete_bookmark(preset_name):
            self._load_presets()

    def _delete_image_from_preset(self, widget, iter):
        """Elimina la ruta de imagen de una entrada de preset."""
        model = self.presets_model
        img_path = model.get_value(iter, 1)
        if isinstance(img_path, dict):
            img_path_real = img_path.get("path", "")
        else:
            img_path_real = img_path if img_path else ""

        parent_iter = model.iter_parent(iter)
        if not parent_iter:
            return
        preset_name = model.get_value(parent_iter, 0)
        bookmarks = self.backend.load_json("bookmarks")
        if preset_name in bookmarks:
            bm = bookmarks[preset_name]
            for hash, entry in list(bm.items()):
                if isinstance(entry, dict):
                    entry_path = entry.get("path", "")
                else:
                    entry_path = entry if entry else ""
                if entry_path == img_path_real:
                    if isinstance(entry, dict):
                        entry["path"] = ""
                    else:
                        bm[hash] = {"path": "", "active": True}
                    break
            bookmarks[preset_name] = bm
            self.backend.save_json("bookmarks", bookmarks)
            self.handler.sync_bookmarks_flat_list()
            self.handler.refresh_history_metadata()
            model.set_value(iter, 0, "(" + _("empty") + ")")
            model.set_value(iter, 1, "")

    def _on_preset_row_activated(self, treeview, path, column):
        model = treeview.get_model()
        tree_iter = model.get_iter(path)
        is_preset = model.get_value(tree_iter, 2)
        if not is_preset:
            img_path = model.get_value(tree_iter, 1)
            if isinstance(img_path, dict):
                img_path = img_path.get("path", "")
            if img_path:
                if os.path.exists(img_path):
                    self.handler.open_in_file_manager(img_path)
                else:
                    log_event(f"Imagen no existe en disco: {img_path}", origin="PANEL", level="WARN", reason="BOOKMARK")

    def _load_preset_to_monitors(self, widget, preset_name):
        """Carga un preset en los monitores virtuales para edición."""
        cb = self._callbacks.get('on_load_preset_to_edit')
        if cb:
            cb(preset_name)

    def _on_delete_preset_clicked(self, button):
        selection = self.presets_tree.get_selection()
        model, iter = selection.get_selected()
        if not iter:
            return
        is_preset = model.get_value(iter, 2)
        if is_preset:
            self._delete_preset(None, model.get_value(iter, 0))
        else:
            self._delete_image_from_preset(None, iter)

    # ==========================================================
    # EVENTOS DE FAVORITOS INDIVIDUALES
    # ==========================================================
    def _on_bookmark_single_row_activated(self, treeview, path, column):
        model = treeview.get_model()
        tree_iter = model.get_iter(path)
        img_path = model.get_value(tree_iter, 1)
        if img_path and os.path.exists(img_path):
            self.handler.open_in_file_manager(img_path)
        else:
            log_event(f"Imagen no encontrada: {img_path}", origin="PANEL", level="WARN", reason="BOOKMARK")

    def _on_single_tree_click(self, treeview, event):
        if event.button != 3:
            return

        selection = treeview.get_selection()
        model, selected_paths = selection.get_selected_rows()

        if len(selected_paths) > 1:
            treeview.stop_emission_by_name('button-press-event')

        selection = treeview.get_selection()
        model, selected_paths = selection.get_selected_rows()
        if not selected_paths:
            return

        img_paths = []
        for path in selected_paths:
            tree_iter = model.get_iter(path)
            img_path = model.get_value(tree_iter, 1)
            img_paths.append(img_path)

        menu = Gtk.Menu()
        if len(img_paths) == 1:
            label = _("Delete")
        else:
            label = _("Delete") + " " + str(len(img_paths)) + " " + _("images")
        item = Gtk.MenuItem(label=label)
        item.connect('activate', lambda w: (
            [self._delete_bookmark_single(p) for p in img_paths],
            self._load_bookmarks_single()
        ))
        menu.append(item)
        menu.show_all()
        menu.popup(None, None, None, None, event.button, event.time)

    def _delete_bookmark_single(self, img_path):
        flat_list = self.backend.load_json("bookmarks_single")
        new_list = [entry for entry in flat_list if entry[0] != img_path]
        if len(new_list) != len(flat_list):
            self.backend.save_json("bookmarks_single", new_list)
            self.handler.refresh_history_metadata()

    def _on_delete_single_clicked(self, button):
        selection = self.bookmarks_single_tree.get_selection()
        model, paths = selection.get_selected_rows()
        for path in reversed(paths):
            tree_iter = model.get_iter(path)
            img_path = model.get_value(tree_iter, 1)
            self._delete_bookmark_single(img_path)
        self._load_bookmarks_single()

    # ==========================================================
    # SWITCH DE ROTACIÓN DE FAVORITOS
    # ==========================================================
    def _on_fav_rotation_changed(self, switch, param):
        if self._loading:
            return
        self.backend.save_setting("slideshow_bookmark", switch.get_active())
        cb = self._callbacks.get('on_update_mode_info_label')
        if cb:
            cb()

    # ==========================================================
    # DIÁLOGO DE ADVERTENCIA
    # ==========================================================
    def _show_warning_dialog(self, message):
        dialog = Gtk.MessageDialog(
            transient_for=self._parent_window,
            flags=0,
            message_type=Gtk.MessageType.WARNING,
            buttons=Gtk.ButtonsType.OK,
            text=message
        )
        dialog.run()
        dialog.destroy()
