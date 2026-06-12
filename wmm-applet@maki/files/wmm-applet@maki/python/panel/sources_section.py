#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM Applet - Cinnamon Edition
----------------------------
sources_section.py – Sección de fuentes de imagen del panel de control.

Gestiona el treeview de carpetas, la adición/eliminación de fuentes,
la sincronización de la biblioteca y el escaneado de imágenes.
"""

import os
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib
from debug_logger import log_event
from i18n import _

class SourcesSection:
    """
    Sección de fuentes de imagen del panel de control.
    """

    def __init__(self, handler, backend, ie, left_col):
        """
        Args:
            handler: Instancia de ConfigHandler.
            backend: Instancia de WMMBackend.
            ie:      Instancia de ImageEngine.
            left_col: El Gtk.Box donde se empaquetará esta sección.
        """
        self.handler = handler
        self.backend = backend
        self.ie = ie
        self._busy_counter = 0
        self._sources_need_refresh = False

        # Construir la interfaz
        self.widget = self._build()
        left_col.pack_start(self.widget, True, True, 0)

    # ==========================================================
    # CONSTRUCCIÓN DE LA INTERFAZ
    # ==========================================================
    def _build(self):
        """Construye y devuelve el widget principal de la sección."""
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)

        # Etiqueta de la sección
        label = Gtk.Label()
        label.set_markup(f"<span weight='bold' size='large'>{_('Image Sources')}</span>")
        label.set_halign(Gtk.Align.START)
        vbox.pack_start(label, False, False, 0)

        # ScrolledWindow para el treeview
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_min_content_height(150)
        self.scrolled_sources = scrolled

        # Modelo: [icono, nombre, ruta, active, recursive, is_raiz]
        self.sources_model = Gtk.TreeStore(str, str, str, bool, bool, bool)
        self.sources_tree = Gtk.TreeView(model=self.sources_model)
        self.sources_tree.connect("row-activated", self._on_source_row_activated)

        # Actualizar el botón de eliminar al cambiar la selección
        selection = self.sources_tree.get_selection()
        selection.connect("changed", self._update_delete_button)
        self.sources_model.connect("row-changed", self._update_delete_button)

        # Columna "Source" con icono y texto
        col_name = Gtk.TreeViewColumn(_("Source"))
        ri, rt = Gtk.CellRendererPixbuf(), Gtk.CellRendererText()
        col_name.pack_start(ri, False)
        col_name.pack_start(rt, True)
        col_name.set_cell_data_func(ri, self._render_source_icon)
        col_name.set_cell_data_func(rt, self._render_source_text)
        col_name.set_expand(True)
        self.sources_tree.append_column(col_name)

        # Columna "Recursive" con toggle
        renderer_rec = Gtk.CellRendererToggle()
        renderer_rec.connect("toggled", self.on_recursive_toggled)
        col_rec = Gtk.TreeViewColumn(_("Recursive"), renderer_rec, active=4)
        col_rec.set_cell_data_func(renderer_rec, self._hide_checkbox_in_children)
        self.sources_tree.append_column(col_rec)

        self.sources_tree.connect("button-press-event", self.on_tree_button_press)
        scrolled.add(self.sources_tree)
        vbox.pack_start(scrolled, True, True, 0)

        # Barra de botones inferior
        btn_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)

        self.refresh_btn = Gtk.Button.new_from_icon_name("view-refresh-symbolic", Gtk.IconSize.BUTTON)
        self.refresh_btn.set_tooltip_text(_("Resync Image Sources"))
        self.refresh_btn.connect("clicked", self.on_refresh_sources_clicked)
        btn_box.pack_start(self.refresh_btn, False, False, 0)

        self.center_stack = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        self.scan_progress = Gtk.ProgressBar()
        self.scan_progress.set_no_show_all(True)
        self.scan_progress.hide()
        self.scan_progress.set_margin_start(15)
        self.scan_progress.set_margin_end(15)
        self.scan_progress.set_valign(Gtk.Align.CENTER)
        self.btn_spacer = Gtk.Box()
        self.center_stack.pack_start(self.scan_progress, True, True, 0)
        self.center_stack.pack_start(self.btn_spacer, True, True, 0)
        btn_box.pack_start(self.center_stack, True, True, 0)

        self.add_btn = Gtk.Button.new_from_icon_name("folder-new", Gtk.IconSize.BUTTON)
        self.add_btn.set_tooltip_text(_("Add Image Source"))
        self.add_btn.connect("clicked", self.on_add_source_clicked)
        self.del_btn = Gtk.Button.new_from_icon_name("user-trash", Gtk.IconSize.BUTTON)
        self.del_btn.set_tooltip_text(_("Delete Image Source"))
        self.del_btn.connect("clicked", self._on_delete_button_clicked)

        btn_box.pack_end(self.del_btn, False, False, 0)
        btn_box.pack_end(self.add_btn, False, False, 5)

        vbox.pack_start(btn_box, False, False, 0)

        return vbox

    # ==========================================================
    # CARGA Y EXPANSIÓN DEL TREEVIEW
    # ==========================================================
    def load_sources_into_treeview(self):
        # Guardar posición actual del scroll
        vadj = self.scrolled_sources.get_vadjustment()
        saved_value = vadj.get_value()

        self.sources_model.clear()
        sources_data = self.backend.load_json("sources").get("sources", [])
        index_data = self.backend.load_json("index")

        for s in sources_data:
            root_path = s.get('path')
            if not root_path or s.get('type') == 'virtual':
                continue

            root_name = s.get('name', os.path.basename(root_path))
            is_recursive = s.get('recursive', False)

            index_info = index_data.get(root_path)
            root_active = True
            if isinstance(index_info, list) and len(index_info) > 1:
                root_active = index_info[1]
            else:
                root_active = s.get('active', True)

            parent_iter = self.sources_model.append(None, [
                "", root_name, root_path, root_active, is_recursive, True
            ])

            prefix = root_path if root_path.endswith(os.sep) else root_path + os.sep
            sub_paths = sorted([p for p in index_data if p.startswith(prefix)])
            path_to_iter = {root_path: parent_iter}

            for sub in sub_paths:
                parent_path = os.path.dirname(sub)
                if parent_path in path_to_iter:
                    sub_info = index_data.get(sub, [0, True])
                    sub_active = sub_info[1] if isinstance(sub_info, list) and len(sub_info) > 1 else True
                    current_iter = self.sources_model.append(path_to_iter[parent_path], [
                        "", os.path.basename(sub), sub, sub_active, False, False
                    ])
                    path_to_iter[sub] = current_iter

        log_event("Vista de fuentes reconstruida", origin="PANEL", level="INFO", reason="LIBRARY")

        # Restaurar posición del scroll
        def restore_scroll():
            vadj.set_value(saved_value)
            return False
        GLib.idle_add(restore_scroll)

    def _auto_expand_sources(self):
        model = self.sources_model
        parent_iter = model.get_iter_first()
        while parent_iter:
            path_str = model.get_value(parent_iter, 2)
            if model.get_value(parent_iter, 5):
                state = self.handler.get_children_state(path_str)
                if state in ("all_active", "mixed"):
                    tree_path = model.get_path(parent_iter)
                    if tree_path:
                        self.sources_tree.expand_row(tree_path, open_all=False)
            parent_iter = model.iter_next(parent_iter)

    # ==========================================================
    # RENDERERS DEL TREEVIEW
    # ==========================================================
    def _hide_checkbox_in_children(self, column, cell, model, iter, data):
        is_raiz = model.get_value(iter, 5)
        cell.set_property("visible", is_raiz)
        cell.set_property("activatable", is_raiz)

    def on_recursive_toggled(self, widget, path):
        tree_iter = self.sources_model.get_iter(path)
        current_val = self.sources_model.get_value(tree_iter, 4)
        new_val = not current_val
        self.sources_model.set_value(tree_iter, 4, new_val)
        path_disk = self.sources_model.get_value(tree_iter, 2)
        if hasattr(self.handler, 'update_source_recursive'):
            self.handler.update_source_recursive(path_disk, new_val)
        self.sources_tree.queue_draw()

    def _render_source_icon(self, column, cell, model, iter, data):
        is_active = model.get_value(iter, 3)
        is_recursive = model.get_value(iter, 4)
        is_raiz = model.get_value(iter, 5)
        icon = "folder-remote" if (is_raiz and is_recursive) else "folder"
        cell.set_property("icon-name", icon)
        cell.set_property("sensitive", is_active)

    def _render_source_text(self, column, cell, model, iter, data):
        text = model.get_value(iter, 1)
        is_active = model.get_value(iter, 3)
        cell.set_property("text", text)
        cell.set_property("sensitive", is_active)

    # ==========================================================
    # EVENTOS DEL TREEVIEW
    # ==========================================================
    def on_tree_button_press(self, treeview, event):
        if event.button == 3:
            selection = treeview.get_selection()
            model, iter = selection.get_selected()
            if iter:
                path = model.get_value(iter, 2)
                self.show_context_menu(path, iter, event)
        return False

    def _get_parent_source(self, path):
        sources = self.backend.load_json("sources").get("sources", [])
        for s in sources:
            root = s.get("path")
            if root and path.startswith(root):
                return s
        return None

    def _auto_update_recursive(self, parent_path):
        children_state = self.handler.get_children_state(parent_path)
        new_recursive = children_state != "all_inactive"
        sources = self.backend.load_json("sources").get("sources", [])
        for s in sources:
            if s.get("path") == parent_path and s.get("type") == "physical":
                if s.get("recursive") != new_recursive:
                    s["recursive"] = new_recursive
                    self.backend.save_json("sources", {"sources": sources})
                    self.load_sources_into_treeview()
                    log_event(f"Recursividad auto-ajustada: '{parent_path}' -> recursive={new_recursive}", origin="PANEL", level="INFO", reason="LIBRARY")
                break

    def _on_source_row_activated(self, treeview, path, column):
        model = treeview.get_model()
        iter = model.get_iter(path)
        folder_path = model.get_value(iter, 2)
        if folder_path:
            self.handler.open_in_file_manager(folder_path)

    def _on_delete_button_clicked(self, widget):
        """Elimina una fuente (padre) o desactiva una subcarpeta (hijo)."""
        selection = self.sources_tree.get_selection()
        model, tree_iter = selection.get_selected()
        if not tree_iter:
            return

        is_raiz = model.get_value(tree_iter, 5)
        path = model.get_value(tree_iter, 2)

        if is_raiz:
            # Es un padre: eliminar la fuente completamente
            self.on_remove_source_clicked(widget)
        else:
            # Es un hijo: desactivarlo inmediatamente
            self.toggle_child_active(widget, model, tree_iter)

    def _update_delete_button(self, *args):
        """Actualiza el icono y el tooltip del botón según el elemento seleccionado."""
        selection = self.sources_tree.get_selection()
        model, tree_iter = selection.get_selected()

        if not tree_iter:
            # Sin selección: icono de papelera inactivo
            self.del_btn.set_image(Gtk.Image.new_from_icon_name("user-trash", Gtk.IconSize.BUTTON))
            self.del_btn.set_tooltip_text(_("Delete selected preset/image"))
            self.del_btn.set_sensitive(False)
            return

        is_raiz = model.get_value(tree_iter, 5)  # Columna 5: is_raiz
        is_active = model.get_value(tree_iter, 3)  # Columna 3: active

        if is_raiz:
            # Carpeta padre: papelera
            self.del_btn.set_image(Gtk.Image.new_from_icon_name("user-trash", Gtk.IconSize.BUTTON))
            self.del_btn.set_tooltip_text(_("Delete image source"))
            self.del_btn.set_sensitive(True)
        else:
            # Subcarpeta: ojo con aspa (desactivar) u ojo sin aspa (activar)
            if is_active:
                self.del_btn.set_image(Gtk.Image.new_from_icon_name("view-conceal", Gtk.IconSize.BUTTON))
                self.del_btn.set_tooltip_text(_("Deactivate folder"))
            else:
                self.del_btn.set_image(Gtk.Image.new_from_icon_name("view-reveal", Gtk.IconSize.BUTTON))
                self.del_btn.set_tooltip_text(_("Activate folder"))
            self.del_btn.set_sensitive(True)

    # ==========================================================
    # CONTROL DE OCUPACIÓN (PROGRESS BAR)
    # ==========================================================
    def _increment_busy(self):
        self._busy_counter += 1
        if self._busy_counter == 1:
            self._set_sources_sensitive(False)

    def _decrement_busy(self):
        if self._busy_counter == 0:
            return
        self._busy_counter -= 1
        if self._busy_counter <= 0:
            self._busy_counter = 0
            self._set_sources_sensitive(True)

    def _set_sources_sensitive(self, sensitive):
        self.sources_tree.set_sensitive(sensitive)
        if hasattr(self, 'refresh_btn'):
            self.refresh_btn.set_sensitive(sensitive)
        if hasattr(self, 'add_btn'):
            self.add_btn.set_sensitive(sensitive)
        if hasattr(self, 'del_btn'):
            self.del_btn.set_sensitive(sensitive)

    # ==========================================================
    # SINCRONIZACIÓN Y PROGRESO
    # ==========================================================
    def _on_sync_folder_start(self, folder_path):
        pass

    def _on_sync_progress(self, current, total):
        if total > 0:
            fraction = current / total
            self.scan_progress.set_fraction(fraction)
            self.scan_progress.set_text(_("Scanning") + " " + str(current) + "/" + str(total) + " " + _("folders") + "...")
        if current >= total:
            self._decrement_busy()
            self._set_progress_active(False)
            if self._sources_need_refresh:
                self.load_sources_into_treeview()
                self._sources_need_refresh = False
            # Nota: _load_thumbnails se llamará desde el panel principal
            # mediante una señal o callback que definiremos más adelante.

    def show_context_menu(self, path, iter, event):
        is_active = self.sources_model.get_value(iter, 3)
        menu = Gtk.Menu()
        parent_source = self._get_parent_source(path)
        is_root = (path == parent_source.get("path")) if parent_source else True

        if is_root:
            menu.append(Gtk.SeparatorMenuItem())
            children_state = self.handler.get_children_state(path)
            item_activate = Gtk.MenuItem(label=_("Activate subfolders"))
            item_activate.set_sensitive(children_state != "all_active")
            item_activate.connect("activate", self.on_bulk_toggle, path, True)
            menu.append(item_activate)
            item_deactivate = Gtk.MenuItem(label=_("Deactivate subfolders"))
            item_deactivate.set_sensitive(children_state != "all_inactive")
            item_deactivate.connect("activate", self.on_bulk_toggle, path, False)
            menu.append(item_deactivate)
            menu.append(Gtk.SeparatorMenuItem())

        label = _("Deactivate folder") if is_active else _("Activate folder")
        item = Gtk.MenuItem(label=label)
        item.connect("activate", self.toggle_child_active, self.sources_model, iter)
        menu.append(item)

        if not is_active:
            item_purge = Gtk.MenuItem(label=_("Delete cache"))
            item_purge.connect("activate", self.on_purge_cache_clicked, path)
            menu.append(item_purge)

        menu.show_all()
        menu.popup(None, None, None, None, event.button, event.time)

    def toggle_child_active(self, widget, model, iter):
        path = model.get_value(iter, 2)
        new_state = not model.get_value(iter, 3)
        model.set_value(iter, 3, new_state)
        if self.handler.update_index_active_state(path, new_state):
            log_event(f"Estado cambiado: {path} -> {new_state}", origin="PANEL", level="INFO", reason="LIBRARY")
        parent_source = self._get_parent_source(path)
        if parent_source:
            self._auto_update_recursive(parent_source.get("path"))

    def on_purge_cache_clicked(self, widget, folder_path):
        dialog = Gtk.MessageDialog(
            transient_for=None,  # Se establecerá desde el panel principal
            flags=0,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text=_("Delete cache of this folder?")
        )
        dialog.format_secondary_text(
            _("Will be removed from your library") + ":" + "\n" +
            folder_path + "\n" +
            _("Images will no longer be available")
        )
        response = dialog.run()
        if response == Gtk.ResponseType.YES:
            deleted_count = self.handler.purge_folder_cache(folder_path)
            if deleted_count > 0:
                self.handler._send_notification(
                    reason=_("Cache deleted"),
                    detail_msg=str(deleted_count) + " " + _("thumbnails have been removed from cache"),
                    level="info"
                )
            else:
                self.handler._send_notification(
                    reason=_("No cache"),
                    detail_msg=_("No thumbnails found in cache for this folder."),
                    level="info"
                )
        dialog.destroy()

    def on_bulk_toggle(self, widget, parent_path, new_state):
        if self.handler.toggle_all_children(parent_path, new_state):
            log_event(f"Cambio masivo: {parent_path} -> {new_state}", origin="PANEL", level="INFO", reason="LIBRARY")
            self.load_sources_into_treeview()
            self._auto_update_recursive(parent_path)

    def _set_progress_active(self, active, text=None):
        if active:
            self.btn_spacer.hide()
            self.scan_progress.show()
            self.scan_progress.set_fraction(0.0)
            if text:
                self.scan_progress.set_show_text(True)
                self.scan_progress.set_text(text)
        else:
            self.scan_progress.hide()
            self.btn_spacer.show()
            self.scan_progress.set_fraction(0.0)
            self.scan_progress.set_show_text(False)

    # ==========================================================
    # BOTONES DE ACCIÓN
    # ==========================================================
    def on_refresh_sources_clicked(self, widget):
        # Nota: el cambio de cursor y las iteraciones pendientes se gestionarán
        # desde el panel principal si es necesario.
        self._set_progress_active(True, _("Resynchronizing library") + "...")
        self._set_progress_active(True, _("Scanning sources") + "...")
        self._sources_need_refresh = True
        self._increment_busy()
        self.handler.sync_library(
            on_progress=self._on_sync_progress,
            on_folder=self._on_sync_folder_start
        )

    def on_add_source_clicked(self, widget):
        dialog = Gtk.FileChooserDialog(
            title=_("Select Image Folder"),
            parent=None,  # Se establecerá desde el panel principal
            action=Gtk.FileChooserAction.SELECT_FOLDER
        )
        dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL)
        dialog.add_button(_("Add Source"), Gtk.ResponseType.OK)

        pictures_dir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES)
        if pictures_dir:
            dialog.set_current_folder(pictures_dir)

        content_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        spacer = Gtk.Label()
        spacer.set_hexpand(True)
        content_box.pack_start(spacer, True, True, 0)
        check_rec = Gtk.CheckButton(label=_("Include subfolders (Recursive)"))
        check_rec.set_active(True)
        check_rec.set_margin_end(10)
        check_rec.set_margin_bottom(10)
        content_box.pack_start(check_rec, False, False, 0)
        content_box.show_all()
        dialog.set_extra_widget(content_box)

        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            path = dialog.get_filename()
            if path:
                name = os.path.basename(path)
                recursive = check_rec.get_active()
                dialog.destroy()
                self._set_progress_active(True, _("Scanning") + ": " + name + "...")
                success = self.handler.add_source(name, path, recursive)
                if success:
                    self._sources_need_refresh = True
                    self._set_progress_active(True, _("Scanning") + ": " + name + "...")
                    self._increment_busy()
                    self.handler.sync_library(
                        on_progress=self._on_sync_progress,
                        on_folder=self._on_sync_folder_start
                    )
                else:
                    self._set_progress_active(False)
        else:
            dialog.destroy()

    def on_remove_source_clicked(self, widget):
        selection = self.sources_tree.get_selection()
        model, treeiter = selection.get_selected()
        if treeiter:
            source_name = model[treeiter][1]
            source_path = model[treeiter][2]
            dialog = Gtk.MessageDialog(
                transient_for=None,  # Se establecerá desde el panel principal
                flags=0,
                message_type=Gtk.MessageType.QUESTION,
                buttons=Gtk.ButtonsType.YES_NO,
                text=_("Delete image source?")
            )
            dialog.format_secondary_text(
                source_name + " " + _("will be removed from your library") + "\n" +
                _("Images will no longer be available")
            )
            response = dialog.run()
            if response == Gtk.ResponseType.YES:
                if self.handler.remove_source(source_path):
                    self.load_sources_into_treeview()
            dialog.destroy()
