#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM
----------------------------
monitors_section.py – Sección de Monitores del panel de control.

Muestra los monitores virtuales con sus imágenes, permite activar/desactivar
monitores, cambiar la alineación del grupo, entrar en modo edición para
asignar imágenes manualmente mediante Drag & Drop, y guardar composiciones
como presets.
"""

import os
import base64
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib
from config_handler import ConfigHandler
from debug_logger import log_event
from i18n import _

class MonitorsSection:
    """
    Sección de Monitores del panel de control.
    """

    def __init__(self, handler, backend, ie, right_col,
                 fav_checkbox=None, accept_btn=None, spanned_switch=None):
        """
        Args:
            handler:        Instancia de ConfigHandler.
            backend:        Instancia de WMMBackend.
            ie:             Instancia de ImageEngine.
            right_col:      El Gtk.Box derecho donde se empaquetará la sección.
            callbacks:      Diccionario con funciones de callback para
                            comunicarse con otras secciones y el panel:
                            - 'create_section_label': (text) -> Gtk.Label
                            - 'notify_engine': (action_dict)
                            - 'load_monitors': ()
                            - 'load_presets': ()
                            - 'load_bookmarks_single': ()
                            - 'set_monitor_switches_sensitive': (bool)
                            - 'get_loading_state': () -> bool
                            - 'get_edit_mode_active': () -> bool
                            - 'get_fav_rotation_switch': () -> Gtk.Switch
                            - 'get_parent_window': () -> Gtk.Window
            fav_checkbox:   Gtk.CheckButton de favorito (compartido).
            accept_btn:     Gtk.Button de aceptar (compartido).
            spanned_switch: Gtk.Switch de modo distribuido (de OptionsSection).
        """
        self.handler = handler
        self.backend = backend
        self.ie = ie
        self._callbacks = {}  # Se configurarán después con set_callbacks()

        # Widgets compartidos
        self.fav_checkbox = fav_checkbox
        self.accept_btn = accept_btn
        self.spanned_switch = spanned_switch

        # Estado interno
        self._monitor_widgets = {}
        self._edit_monitor_widgets = {}
        self._monitor_switches = {}
        self._monitor_display_names = {}
        self._updating_switches = False
        self._repaint_scheduled = False
        self._last_container_size = (0, 0)
        self._current_preset_name = None

        # Construir la interfaz
        self.widget = self._build()
        right_col.pack_start(self.widget, False, True, 0)

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
    def _edit_mode_active(self):
        """Devuelve True si el modo edición está activo."""
        cb = self._callbacks.get('get_edit_mode_active')
        return cb() if cb else self.backend.edit_mode_active

    def _create_section_label(self, text):
        """Crea una etiqueta de sección usando el callback del panel."""
        cb = self._callbacks.get('create_section_label')
        if cb:
            return cb(text)
        label = Gtk.Label()
        label.set_markup(f"<span weight='bold' size='large'>{text}</span>")
        label.set_halign(Gtk.Align.START)
        return label

    def _notify_engine(self, action=None):
        """Envía una acción al motor."""
        cb = self._callbacks.get('notify_engine')
        if cb:
            cb(action)

    def _load_monitors(self):
        """Refresca la vista de monitores."""
        cb = self._callbacks.get('load_monitors')
        if cb:
            cb()

    def _load_presets(self):
        """Recarga la lista de presets."""
        cb = self._callbacks.get('load_presets')
        if cb:
            cb()

    def _load_bookmarks_single(self):
        """Recarga la lista plana de favoritos."""
        cb = self._callbacks.get('load_bookmarks_single')
        if cb:
            cb()

    def _set_monitor_switches_sensitive(self, sensitive):
        """Activa/desactiva todos los switches de monitor."""
        for switch, _ in self._monitor_switches.values():
            switch.set_sensitive(sensitive)

    # ==========================================================
    # CONSTRUCCIÓN DE LA INTERFAZ
    # ==========================================================
    def _build(self):
        """Construye y devuelve el widget principal de la sección."""
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)

        # ----------------------------------------------------------
        # CABECERA: Título + Alineación
        # ----------------------------------------------------------
        header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)
        header_box.pack_start(self._create_section_label(_("Displays")), False, False, 4)

        # Controles de alineación de 3 estados
        align_labels_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)
        self.align_label_start = Gtk.Label()
        self.align_label_start.set_markup("<b>  [  </b>")
        self.align_label_start.set_tooltip_text(_("Side Left"))
        align_labels_box.pack_start(self.align_label_start, False, False, 0)
        self.align_label_center = Gtk.Label()
        self.align_label_center.set_markup("<b>  •  </b>")
        self.align_label_center.set_tooltip_text(_("Center"))
        align_labels_box.pack_start(self.align_label_center, False, False, 0)
        self.align_label_end = Gtk.Label()
        self.align_label_end.set_markup("<b>  ]  </b>")
        self.align_label_end.set_tooltip_text(_("Side Right"))
        align_labels_box.pack_start(self.align_label_end, False, False, 0)
        self.align_label_start.get_style_context().add_class("align-active")

        align_event_box = Gtk.EventBox()
        align_event_box.get_style_context().add_class("edit-aspects-box")
        align_event_box.set_events(Gdk.EventMask.BUTTON_PRESS_MASK)
        align_event_box.add(align_labels_box)
        align_event_box.connect("button-press-event", self._on_align_label_clicked)

        header_box.pack_end(align_event_box, False, False, 0)
        vbox.pack_start(header_box, False, False, 0)

        # ----------------------------------------------------------
        # CONTENEDOR INTERNO (REDIMENSIONABLE)
        # ----------------------------------------------------------
        inner_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        inner_box.connect("size-allocate", self._on_container_resized)
        vbox.pack_start(inner_box, True, True, 0)

        # ----------------------------------------------------------
        # GRUPO UNIFICADO: Switches + Monitores + Botones
        # ----------------------------------------------------------
        self.monitor_group_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.monitor_group_box.set_halign(Gtk.Align.CENTER)

        # --- Sub-bloque 1: Switches de activación por monitor ---
        switch_align_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        switch_align_box.set_halign(Gtk.Align.CENTER)
        self.monitor_switches_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        switch_align_box.pack_start(self.monitor_switches_box, False, False, 0)
        self.monitor_group_box.pack_start(switch_align_box, False, False, 0)

        # --- Sub-bloque 2: Stack con páginas normal y edición ---
        self.monitors_stack = Gtk.Stack()
        self.monitors_stack.set_homogeneous(True)
        self.monitor_group_box.pack_start(self.monitors_stack, False, False, 0)

        # Página normal
        normal_page_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        normal_page_box.set_halign(Gtk.Align.START)
        anchor = Gtk.Box()
        anchor.set_size_request(825, 0)
        normal_page_box.pack_start(anchor, False, False, 0)
        self.monitors_fixed = Gtk.Fixed()
        self.monitors_fixed.set_valign(Gtk.Align.START)
        normal_page_box.pack_start(self.monitors_fixed, False, False, 0)
        self.monitors_stack.add_named(normal_page_box, "normal")

        # Página edición
        edit_page_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        edit_page_box.set_halign(Gtk.Align.START)
        self.monitors_fixed_edit = Gtk.Fixed()
        edit_page_box.pack_start(self.monitors_fixed_edit, False, False, 0)
        self.monitors_stack.add_named(edit_page_box, "edit")

        # --- Sub-bloque 3: Barra de botones inferior ---
        button_align_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)

        # 1. BOTÓN DE EDICIÓN (izquierda)
        edit_controls_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        edit_controls_box.set_halign(Gtk.Align.START)

        self.edit_mode_btn = Gtk.ToggleButton()
        icon = Gtk.Image.new_from_icon_name("document-edit-symbolic", Gtk.IconSize.SMALL_TOOLBAR)
        self.edit_mode_btn.add(icon)
        self.edit_mode_btn.set_relief(Gtk.ReliefStyle.NORMAL)
        self.edit_mode_btn.set_tooltip_text(_("Enable/disable screen editing mode"))
        self.edit_mode_btn.connect("toggled", self._on_toggle_edit_mode)
        edit_controls_box.pack_start(self.edit_mode_btn, False, False, 0)

        self.edit_label_stack = Gtk.Stack()
        self.edit_label_stack.set_homogeneous(True)
        self.edit_prompt_label = Gtk.Label()
        self.edit_prompt_label.set_markup("<b>" + _("Enable") + "\n" + _("Editing Mode") + "</b>")
        self.edit_prompt_label.set_halign(Gtk.Align.START)
        self.edit_label_stack.add_named(self.edit_prompt_label, "normal")
        self.edit_mode_label = Gtk.Label()
        self.edit_mode_label.set_markup("<b>" + _("Editing Mode") + ":\n" + _("Enabled") + "</b>")
        self.edit_mode_label.set_halign(Gtk.Align.START)
        self.edit_label_stack.add_named(self.edit_mode_label, "edit")
        self.edit_label_stack.set_visible_child_name("normal")
        self.edit_preset_label = Gtk.Label()
        self.edit_preset_label.set_halign(Gtk.Align.START)
        self.edit_label_stack.add_named(self.edit_preset_label, "edit_preset")
        edit_controls_box.pack_start(self.edit_label_stack, False, False, 0)

        button_align_box.pack_start(edit_controls_box, False, False, 0)

        # 2. OPCIONES DE EDICIÓN (centro)
        self.spanned_switch_edit = Gtk.Switch(active=False)
        self.spanned_switch_edit.set_tooltip_text(_("Span image across all active screens"))
        self.spanned_switch_edit.connect("notify::active", self._on_spanned_edit_changed)

        self.aspect_combo_edit = Gtk.ComboBoxText()
        for key, label in ConfigHandler.ASPECT_MODES.items():
            self.aspect_combo_edit.append_text(_(label))
        self.aspect_combo_edit.set_tooltip_text(_("Picture aspect") + "\n" + " " + _("for current composition"))
        self.aspect_combo_edit.connect("changed", self._on_aspect_edit_changed)

        self.image_effect_combo_edit = Gtk.ComboBoxText()
        for key, label in ConfigHandler.IMAGE_EFFECT.items():
            self.image_effect_combo_edit.append_text(_(label))
        self.image_effect_combo_edit.set_active(0)
        self.image_effect_combo_edit.connect("changed", self._on_image_effect_edit_changed)

        edit_aspects_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        edit_aspects_box.get_style_context().add_class("edit-aspects-box")
        edit_aspects_box.set_halign(Gtk.Align.CENTER)

        hbox_dist = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        hbox_dist.pack_start(Gtk.Label(label=_("Spanned") + ":"), False, False, 0)
        hbox_dist.pack_start(self.spanned_switch_edit, False, False, 0)
        edit_aspects_box.pack_start(hbox_dist, False, False, 0)

        hbox_aspect = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        hbox_aspect.pack_start(Gtk.Label(label=_("Aspect ratio:")), False, False, 0)
        hbox_aspect.pack_start(self.aspect_combo_edit, False, False, 0)
        edit_aspects_box.pack_start(hbox_aspect, False, False, 0)

        hbox_effect = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        hbox_effect.pack_start(Gtk.Label(label=_("Effects") + ":"), False, False, 0)
        hbox_effect.pack_start(self.image_effect_combo_edit, False, False, 0)
        edit_aspects_box.pack_start(hbox_effect, False, False, 0)

        self.edit_aspects_box = edit_aspects_box
        self.edit_aspects_box.set_sensitive(False)
        GLib.idle_add(lambda: self.edit_aspects_box.set_opacity(0.0) if self.edit_aspects_box else None)

        button_align_box.pack_start(edit_aspects_box, True, True, 0)

        # 3. GRUPO DERECHO (Checkbox Favorito + Aceptar + Refrescar)
        right_group = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)

        if self.fav_checkbox:
            self.fav_checkbox.connect("toggled", self._on_fav_checkbox_toggled)
            right_group.pack_start(self.fav_checkbox, False, False, 0)

        if self.accept_btn:
            self.accept_btn.set_sensitive(False)
            self.accept_btn.connect("clicked", self._on_accept_monitors)
            right_group.pack_start(self.accept_btn, False, False, 0)

        refresh_btn = Gtk.Button.new_from_icon_name("view-refresh-symbolic", Gtk.IconSize.BUTTON)
        refresh_btn.set_tooltip_text(_("Refresh real display status"))
        refresh_btn.connect("clicked", self._on_refresh_monitors)
        right_group.pack_start(refresh_btn, False, False, 0)

        button_align_box.pack_end(right_group, False, False, 0)

        self.monitor_group_box.pack_end(button_align_box, False, False, 0)

        # ----------------------------------------------------------
        # EMPAQUETADO FINAL
        # ----------------------------------------------------------
        inner_box.pack_start(self.monitor_group_box, False, False, 0)

        return vbox

    # ==========================================================
    # ALINEACIÓN DEL GRUPO DE MONITORES
    # ==========================================================
    def _on_align_label_clicked(self, widget, event):
        """Detecta clic en el control de alineación y actualiza el estado."""
        if event.button != 1:
            return False
        width = widget.get_allocated_width()
        x = event.x
        for lbl in (self.align_label_start, self.align_label_center, self.align_label_end):
            lbl.get_style_context().remove_class("align-active")
        if x < width / 3:
            self.monitor_group_box.set_halign(Gtk.Align.START)
            self.align_label_start.get_style_context().add_class("align-active")
            self.backend.save_setting("monitor_group_align", "START")
        elif x > 2 * width / 3:
            self.monitor_group_box.set_halign(Gtk.Align.END)
            self.align_label_end.get_style_context().add_class("align-active")
            self.backend.save_setting("monitor_group_align", "END")
        else:
            self.monitor_group_box.set_halign(Gtk.Align.CENTER)
            self.align_label_center.get_style_context().add_class("align-active")
            self.backend.save_setting("monitor_group_align", "CENTER")
        return True

    def _update_align_labels(self, align):
        """Actualiza las clases CSS de los labels de alineación según el valor."""
        for lbl in (self.align_label_start, self.align_label_center, self.align_label_end):
            lbl.get_style_context().remove_class("align-active")
        if align == Gtk.Align.START:
            self.align_label_start.get_style_context().add_class("align-active")
        elif align == Gtk.Align.CENTER:
            self.align_label_center.get_style_context().add_class("align-active")
        elif align == Gtk.Align.END:
            self.align_label_end.get_style_context().add_class("align-active")

    # ==========================================================
    # REDIMENSIONAMIENTO Y DEBOUNCE
    # ==========================================================
    def _on_container_resized(self, widget, allocation):
        """Reposiciona los monitores solo si el tamaño del contenedor cambia realmente."""
        new_size = (allocation.width, allocation.height)
        if new_size == self._last_container_size:
            return
        self._last_container_size = new_size
        if hasattr(self, '_debounce_timer_id') and self._debounce_timer_id:
            GLib.source_remove(self._debounce_timer_id)
        self._debounce_timer_id = GLib.timeout_add(150, self._debounced_load_monitors)

    def _debounced_load_monitors(self):
        """Se ejecuta tras el debounce para actualizar los monitores."""
        if self._monitor_widgets:
            self._load_monitors_normal()
        self._debounce_timer_id = None
        return False

    # ==========================================================
    # CARGA DE MONITORES (MODO NORMAL)
    # ==========================================================
    def _load_monitors_normal(self):
        """Carga los monitores virtuales en el modo normal."""
        geo_check = self.handler.load_json("geometry")
        num_monitors = len(geo_check.get("monitors", {}))
        log_event(f"Panel cargando geometría: {num_monitors} monitores encontrados en JSON",
                  origin="PANEL", level="DEBUG", reason="HARDWARE")

        for widget in self._monitor_widgets.values():
            self.monitors_fixed.remove(widget)
        self._monitor_widgets.clear()

        layout_w = self.monitors_fixed.get_allocated_width()
        if layout_w < 50:
            GLib.idle_add(self._load_monitors_normal)
            return

        target_height = 425
        layout_data = self.handler.get_monitors_layout_data(layout_w, target_height)
        if not layout_data:
            return

        # Construir img_source desde active_session
        vault = self.backend.load_vault()
        active_session = vault.get("active_session", {})
        img_source = {}
        for m_hash in [d['hash'] for d in layout_data]:
            entry = active_session.get(m_hash, {})
            if isinstance(entry, dict):
                img_source[m_hash] = entry
            else:
                img_source[m_hash] = {"path": entry if entry else "", "active": True}

        # Crear EventBox vacíos y posicionarlos
        for data in layout_data:
            m_hash = data['hash']
            x, y, w, h = data['x'], data['y'], data['w'], data['h']
            eb = Gtk.EventBox()
            eb.get_style_context().add_class("monitor-frame")
            eb.set_size_request(w, h)
            eb.set_tooltip_text(f"Monitor {m_hash}")
            eb.m_hash = m_hash
            eb.connect("button-press-event", self._on_monitor_event, m_hash)
            self.monitors_fixed.put(eb, x, y)
            eb.set_size_request(w, h)
            self._monitor_widgets[m_hash] = eb

        # Pintar miniaturas
        settings = self.backend.load_settings()
        settings = self.backend.load_settings()
        wallpaper_mode = settings.get("wallpaper_mode", "fit")
        spanned_enabled = settings.get("spanned_enabled", False)
        wallpaper_effect_scope = settings.get("wallpaper_effect_scope", "blur")
        wallpaper_effect = settings.get("wallpaper_effect", "none")

        self.ie.paint_monitors_thumbnails(
            fixed_widget=self.monitors_fixed,
            layout_data=layout_data,
            img_source=img_source,
            wallpaper_mode=wallpaper_mode,
            spanned_enabled=spanned_enabled,
            color_tuple=self.backend.get_background_color_tuple(),
            wallpaper_effect_scope=wallpaper_effect_scope,
            image_effect=wallpaper_effect
        )

        # Ajustar tamaño y switches
        if layout_data:
            min_x = min(d['x'] for d in layout_data)
            max_x = max(d['x'] + d['w'] for d in layout_data)
            max_y = max(d['y'] + d['h'] for d in layout_data)
            monitors_width = int(max_x - min_x)
            if monitors_width > 0:
                GLib.idle_add(self._adjust_fixed_size, monitors_width, max_y)

        self.monitors_fixed.show_all()
        self._build_monitor_switches()
        GLib.idle_add(self._update_monitor_tooltips)

    def _adjust_fixed_size(self, monitors_width, max_y):
        """Ajusta el tamaño del Fixed y la caja de switches."""
        self.monitors_fixed.set_size_request(monitors_width + 10, int(max_y) + 10)
        if hasattr(self, 'monitor_switches_box') and self.monitor_switches_box is not None:
            self.monitor_switches_box.set_size_request(monitors_width, -1)
        return False

    # ==========================================================
    # SWITCHES DE MONITOR
    # ==========================================================
    def _build_monitor_switches(self):
        """Crea o actualiza los switches de activación por monitor."""
        self._updating_switches = True
        state_source = self.backend.edit_active_states if self.backend.edit_mode_active else self.backend.get_active_session()

        for m_hash, eb in self._monitor_widgets.items():
            if self.backend.edit_mode_active:
                is_active = state_source.get(m_hash, True)
            else:
                entry = state_source.get(m_hash, {})
                is_active = entry.get("active", True) if isinstance(entry, dict) else True

            if m_hash in self._monitor_switches:
                self._monitor_switches[m_hash][0].set_active(is_active)
            else:
                hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
                label_text = self.handler.get_monitor_display_name(m_hash)
                info = self.handler.get_monitor_info(m_hash)  # aún necesario para detectar el primario

                if info and info.get("primary", False):
                    label = Gtk.Label()
                    label.set_markup(f"<b>{label_text}</b>")
                    label.set_tooltip_text(_("Primary monitor"))
                else:
                    label = Gtk.Label(label=label_text)

                self._monitor_display_names[m_hash] = label_text
                switch = Gtk.Switch(active=is_active)
                switch.connect("notify::active", self._on_monitor_active_toggled, m_hash)
                switch.set_tooltip_text(_("Enable/disable image"))

                hbox.pack_start(label, False, False, 0)
                hbox.pack_start(switch, False, False, 0)

                switch_event_box = Gtk.EventBox()
                switch_event_box.add(hbox)
                switch_event_box.connect("enter-notify-event", self._on_switch_enter, m_hash)
                switch_event_box.connect("leave-notify-event", self._on_switch_leave, m_hash)

                self.monitor_switches_box.pack_start(switch_event_box, False, False, 4)
                self._monitor_switches[m_hash] = (switch, switch_event_box)

        # Eliminar switches huérfanos
        for m_hash in list(self._monitor_switches.keys()):
            if m_hash not in self._monitor_widgets:
                switch, widget = self._monitor_switches.pop(m_hash)
                widget.destroy()

        # Insensibilizar switch "Distribuido" si solo hay un monitor
        if self.spanned_switch is not None:
            self.spanned_switch.set_sensitive(len(self._monitor_widgets) > 1)
            if len(self._monitor_widgets) <= 1:
                self.spanned_switch.set_active(False)

        settings = self.backend.load_settings()
        if settings.get("spanned_enabled", False):
            self._set_monitor_switches_sensitive(False)

        self.monitor_switches_box.show_all()
        log_event(f"Switches de monitor actualizados: {len(self._monitor_switches)} monitores",
                  origin="PANEL", level="DEBUG", reason="HARDWARE")
        self._updating_switches = False

    def _update_monitor_tooltips(self):
        """Actualiza los tooltips de los monitores con los nombres enriquecidos."""
        for m_hash, eb in self._monitor_widgets.items():
            name = self._monitor_display_names.get(m_hash, _("Display") + " " + m_hash[:6])
            eb.set_tooltip_text(name)
        return False

    def _on_fav_checkbox_toggled(self, checkbox):
        if not self.backend.edit_mode_active:
            if self.accept_btn:
                self.accept_btn.set_sensitive(checkbox.get_active())

    def _on_monitor_active_toggled(self, switch, param, m_hash):
        """Activa o desactiva la imagen de un monitor."""
        if self._loading or self._updating_switches:
            return
        if self.backend.edit_mode_active:
            self.backend.edit_active_states[m_hash] = switch.get_active()
            self._load_preset_to_edit_monitors(self.backend.edit_active_session)
            return

        if self.backend.toggle_monitor_active(m_hash, switch.get_active()):
            self._notify_engine({"action": "apply_manual_selection"})

        if m_hash in self._monitor_widgets:
            eb = self._monitor_widgets[m_hash]
            thumb = eb.get_child()
            w, h = eb.get_size_request()
            inner_w, inner_h = w - 2, h - 2
            active = switch.get_active()
            if active:
                img_path = self.backend.get_image_path(m_hash)
                blurred = self.handler.get_composite_thumbnail(img_path, inner_w, inner_h) if img_path else None
            else:
                color_tuple = self.backend.get_background_color_tuple()
                blurred = self.handler.get_composite_thumbnail(color_tuple, inner_w, inner_h)

            if thumb is not None:
                if not thumb.get_style_context().has_class("monitor-image"):
                    thumb.get_style_context().add_class("monitor-image")
                if blurred:
                    thumb.set_from_file(blurred)
                else:
                    thumb.set_from_icon_name("image-missing", Gtk.IconSize.DIALOG)

        self._build_monitor_switches()

    def _on_switch_enter(self, widget, event, m_hash):
        """Resalta el monitor correspondiente al pasar el ratón sobre el switch."""
        for eb in (self._edit_monitor_widgets.values() if self.backend.edit_mode_active else self._monitor_widgets.values()):
            if getattr(eb, 'm_hash', None) == m_hash:
                eb.get_style_context().add_class("dnd-target")
                eb.queue_draw()
                return False
        return False

    def _on_switch_leave(self, widget, event, m_hash):
        """Quita el resaltado del monitor al salir el ratón del switch."""
        for eb in (self._edit_monitor_widgets.values() if self.backend.edit_mode_active else self._monitor_widgets.values()):
            if getattr(eb, 'm_hash', None) == m_hash:
                eb.get_style_context().remove_class("dnd-target")
                eb.queue_draw()
                return False
        return False

    def _on_monitor_event(self, widget, event, m_hash):
        """Evento de clic derecho sobre un monitor virtual (sin acción por ahora)."""
        if event.button == 3:
            pass
        return False

    def _on_refresh_monitors(self, widget):
        """Refresca la vista de monitores desde el motor."""
        if self.backend.edit_mode_active:
            for m_hash in self.backend.edit_active_session:
                self.backend.edit_active_session[m_hash] = ""
                self.backend.edit_active_states[m_hash] = True
            self._load_monitors_edit()
            self._build_monitor_switches()
            log_event("Monitores reseteados a vacío", origin="PANEL", level="INFO", reason="HARDWARE")
            return
        self._load_monitors_normal()
        self._current_preset_name = None
        self._build_monitor_switches()
        log_event("Vista de monitores refrescada desde el motor", origin="PANEL", level="INFO", reason="HARDWARE")

    # ==========================================================
    # ACEPTAR CAMBIOS (GUARDAR PRESET)
    # ==========================================================
    def _on_accept_monitors(self, widget):
        """Guarda los cambios de edición y crea/actualiza el preset si procede."""
        if self.backend.edit_mode_active:
            log_msg, temp_settings, new_preset_name = self.backend.apply_edit_and_save(
                fav_checkbox_active=self.fav_checkbox.get_active() if self.fav_checkbox else False,
                preset_name=self._current_preset_name,
                monitor_hashes=list(self._monitor_widgets.keys()),
                get_path_func=lambda h: self.backend.edit_active_session.get(h, ""),
                get_active_func=lambda h: self.backend.edit_active_states.get(h, True)
            )

            if self.fav_checkbox and self.fav_checkbox.get_active():
                self._load_presets()
                self._load_bookmarks_single()

            self._notify_engine({
                "action": "apply_manual_selection",
                "temp_settings": temp_settings
            })
            log_event("apply_manual_selection enviada al motor", origin="PANEL", level="DEBUG", reason="BOOKMARK")

            settings = self.backend.load_settings()
            settings["slideshow_enabled"] = False
            self.backend.save_settings(settings)

            self._exit_edit_mode()

            if log_msg:
                log_event(log_msg, origin="PANEL", level="INFO", reason="BOOKMARK")
            else:
                log_event("Cambios aplicados y modo edición finalizado", origin="PANEL", level="INFO", reason="NOTIFY")
            return

        # Modo normal: guardar preset si el checkbox está activo
        if self.fav_checkbox and self.fav_checkbox.get_active():
            current_composition = {}
            for m_hash, eb in self._monitor_widgets.items():
                vault_entry = self.backend.get_active_session().get(m_hash, {})
                if isinstance(vault_entry, dict):
                    path = vault_entry.get("path", "")
                    active = vault_entry.get("active", True)
                else:
                    path = vault_entry if vault_entry else ""
                    active = True
                current_composition[m_hash] = {"path": path, "active": active}

            settings = self.backend.load_settings()
            current_composition["__mode__"] = settings.get("wallpaper_mode", "fit")
            current_composition["__spanned__"] = settings.get("spanned_enabled", False)
            current_composition["__effect__"] = settings.get("wallpaper_effect", "none")
            current_composition["__effect_scope__"] = settings.get("wallpaper_effect_scope", "blur")

            preset_name = f"Bookmark {self.handler.get_next_bookmark_id():02d}"
            self.handler.save_current_state_as_bookmark(preset_name, current_composition)
            self._load_presets()
            self._load_bookmarks_single()
            log_event(f"Preset guardado: {preset_name}", origin="PANEL", level="INFO", reason="BOOKMARK")
            if self.fav_checkbox:
                self.fav_checkbox.set_active(False)
            if self.accept_btn:
                self.accept_btn.set_sensitive(False)
        else:
            log_event("No se ha marcado Favorito, no se guarda nada", origin="PANEL", level="INFO", reason="BOOKMARK")

    # ==========================================================
    # MODO EDICIÓN
    # ==========================================================
    def _on_toggle_edit_mode(self, widget):
        """Activa o desactiva el modo edición de monitores."""
        was_active = self.backend.edit_mode_active
        self.backend.edit_mode_active = widget.get_active()
        page = "edit" if self.backend.edit_mode_active else "normal"
        self.edit_label_stack.set_visible_child_name(page)

        if self.backend.edit_mode_active:
            if not was_active:
                self.backend.edit_active_session.clear()
            active_session = self.backend.get_active_session()
            self.backend.edit_active_states = {
                m_hash: entry.get("active", True) if isinstance(entry, dict) else True
                for m_hash, entry in active_session.items()
            }
            self._load_monitors_edit()
            self._build_monitor_switches()
            self.monitors_stack.set_visible_child_name("edit")
            self.edit_aspects_box.set_opacity(1.0)
            self.edit_aspects_box.set_sensitive(True)

            settings = self.backend.load_settings()
            current_wp_mode = settings.get("wallpaper_mode", "fit")
            keys = list(ConfigHandler.ASPECT_MODES.keys())
            index = keys.index(current_wp_mode) if current_wp_mode in keys else 0
            self.aspect_combo_edit.set_active(index)
            self.backend.edit_temp_wp_mode = current_wp_mode

            spanned_enabled = settings.get("spanned_enabled", False)
            self.spanned_switch_edit.set_active(spanned_enabled)
            self.backend.edit_temp_spanned_enabled = spanned_enabled

            img_effect = settings.get("wallpaper_effect", "none")
            keys = list(ConfigHandler.IMAGE_EFFECT.keys())
            index = keys.index(img_effect) if img_effect in keys else 0
            self.image_effect_combo_edit.set_active(index)
            self.backend.edit_temp_image_effect = img_effect

            self.backend.edit_temp_wp_scope = settings.get("wallpaper_effect_scope", "blur")
            if self.accept_btn:
                self.accept_btn.set_sensitive(True)
        else:
            self._exit_edit_mode()
            self.edit_aspects_box.set_opacity(0.0)
            self.edit_aspects_box.set_sensitive(False)

    def _exit_edit_mode(self):
        """Sale del modo edición y restaura la vista normal."""
        self.backend.cancel_edit()
        self.edit_mode_btn.set_active(False)
        self.edit_label_stack.set_visible_child_name("normal")
        self.monitors_stack.set_visible_child_name("normal")
        self._load_monitors_normal()
        self._build_monitor_switches()
        if self.accept_btn:
            self.accept_btn.set_sensitive(False)
        if self.fav_checkbox:
            self.fav_checkbox.set_active(False)
        self._current_preset_name = None

    def _on_aspect_edit_changed(self, combo):
        """Actualiza el modo de aspecto en edición y refresca la vista previa."""
        if self._loading:
            return
        index = combo.get_active()
        keys = list(ConfigHandler.ASPECT_MODES.keys())
        if 0 <= index < len(keys):
            mode = keys[index]
            self.backend.edit_temp_wp_mode = mode
            if self.backend.edit_mode_active:
                self._set_monitor_switches_sensitive(mode != "spanned")
                self._load_monitors_edit()
                if self.backend.edit_active_session:
                    self._load_preset_to_edit_monitors(self.backend.edit_active_session)

    def _load_monitors_edit(self):
        """Carga los monitores virtuales en el modo edición."""
        for widget in self.monitors_fixed_edit.get_children():
            self.monitors_fixed_edit.remove(widget)
        self._edit_monitor_widgets.clear()

        layout_w = self.monitors_fixed.get_allocated_width()
        if layout_w < 50:
            layout_w = 400

        target_height = 425
        layout_data = self.handler.get_monitors_layout_data(layout_w, target_height)
        if not layout_data:
            return

        for data in layout_data:
            m_hash = data['hash']
            x, y, w, h = data['x'], data['y'], data['w'], data['h']
            eb = Gtk.EventBox()
            eb.get_style_context().add_class("monitor-frame")
            eb.set_size_request(w, h)
            eb.set_tooltip_text(
                self._monitor_display_names.get(m_hash, _("Display") + " " + m_hash[:6]) + " (" + _("editing") + ")"
            )
            eb.m_hash = m_hash
            eb.drag_dest_set(
                Gtk.DestDefaults.ALL,
                [Gtk.TargetEntry.new("text/plain", Gtk.TargetFlags.SAME_APP, 0)],
                Gdk.DragAction.COPY
            )
            eb.drag_dest_set_track_motion(True)
            eb.connect("drag-motion", self._on_edit_drag_motion, m_hash)
            eb.connect("drag-leave", self._on_edit_drag_leave, m_hash)
            eb.connect("drag-data-received", self._on_edit_drag_data_received, m_hash)
            self.monitors_fixed_edit.put(eb, x, y)
            self._edit_monitor_widgets[m_hash] = eb
            eb.show()

        if layout_data:
            min_x = min(d['x'] for d in layout_data)
            max_x = max(d['x'] + d['w'] for d in layout_data)
            monitors_width = int(max_x - min_x)
            if monitors_width > 0:
                self.monitors_fixed_edit.set_size_request(monitors_width + 10, -1)

        self.monitors_fixed_edit.show_all()

    def _load_preset_to_edit_monitors(self, preset_data):
        """Carga los datos de un preset en los monitores virtuales de edición."""
        layout_w = self.monitors_fixed.get_allocated_width()
        if layout_w < 50:
            layout_w = 400
        target_height = 0
        layout_data = self.handler.get_monitors_layout_data(layout_w, target_height)
        if not layout_data:
            return

        wall_mode = self.backend.edit_temp_wp_mode or self.backend.load_settings().get("wallpaper_mode", "fit")
        wp_scope = self.backend.edit_temp_wp_scope or self.backend.load_settings().get("wallpaper_effect_scope", "blur")
        wp_effect = self.backend.edit_temp_image_effect or self.backend.load_settings().get("wallpaper_effect", "none")
        spanned_enabled = self.backend.edit_temp_spanned_enabled
        if spanned_enabled is None:
            spanned_enabled = self.backend.load_settings().get("spanned_enabled", False)

        img_source = {}
        for data in layout_data:
            m_hash = data['hash']
            path = self.backend.edit_active_session.get(m_hash, "")
            active = self.backend.edit_active_states.get(m_hash, True)
            img_source[m_hash] = {"path": path, "active": active}

        self.ie.paint_monitors_thumbnails(
            fixed_widget=self.monitors_fixed_edit,
            layout_data=layout_data,
            img_source=img_source,
            wallpaper_mode=wall_mode,
            spanned_enabled=spanned_enabled,
            color_tuple=self.backend.get_background_color_tuple(),
            wallpaper_effect_scope=wp_scope,
            image_effect=wp_effect,
        )
        self._build_monitor_switches()

    # ==========================================================
    # DRAG & DROP (MODO EDICIÓN)
    # ==========================================================
    def _on_edit_drag_motion(self, widget, context, x, y, time, m_hash):
        """Resalta el monitor cuando se arrastra una imagen sobre él."""
        Gdk.drag_status(context, Gdk.DragAction.COPY, time)
        widget.get_style_context().add_class("dnd-target")
        return True

    def _on_edit_drag_leave(self, widget, context, time, m_hash):
        """Quita el resaltado cuando la imagen sale del monitor."""
        widget.get_style_context().remove_class("dnd-target")

    def _on_edit_drag_data_received(self, widget, context, x, y, data, info, time, m_hash):
        """Asigna la imagen soltada al monitor correspondiente."""
        try:
            img_path = base64.b64decode(data.get_text().encode('ascii')).decode('utf-8')
        except Exception:
            img_path = data.get_text()
        if not img_path:
            Gtk.drag_finish(context, False, False, time)
            return

        self.backend.edit_active_session[m_hash] = img_path
        if not self.backend.edit_active_states.get(m_hash, True):
            self.backend.edit_active_states[m_hash] = True
            if m_hash in self._monitor_switches:
                switch, hbox = self._monitor_switches[m_hash]
                switch.set_active(True)

        self._updating_switches = True
        if not self._repaint_scheduled:
            self._repaint_scheduled = True
            GLib.idle_add(self._idle_repaint_edit_monitors)
        self._updating_switches = False

        widget.get_style_context().remove_class("dnd-target")
        Gtk.drag_finish(context, True, False, time)
        log_event(f"Imagen asignada a {m_hash}: {img_path}", origin="PANEL", level="INFO", reason="BOOKMARK")

    def _idle_repaint_edit_monitors(self):
        """Repinta los monitores en edición tras un drag o cambio de switch."""
        self._repaint_scheduled = False
        if self.backend.edit_mode_active and self.backend.edit_active_session:
            self._load_preset_to_edit_monitors(self.backend.edit_active_session)
        return False

    # ==========================================================
    # EVENTOS DE EDICIÓN (SPANNED / IMAGE EFFECT)
    # ==========================================================
    def _on_spanned_edit_changed(self, switch, param):
        """Guarda el estado temporal de Distribuido en modo edición."""
        if self._loading:
            return
        self.backend.edit_temp_spanned_enabled = switch.get_active()
        if self.backend.edit_mode_active and self.backend.edit_active_session:
            self._updating_switches = True
            self._load_preset_to_edit_monitors(self.backend.edit_active_session)
            self._updating_switches = False

    def _on_image_effect_edit_changed(self, combo):
        """Guarda el estado temporal de efecto de imagen en modo edición."""
        if self._loading:
            return
        keys = list(ConfigHandler.IMAGE_EFFECT.keys())
        index = combo.get_active()
        if 0 <= index < len(keys):
            self.backend.edit_temp_image_effect = keys[index]
            if self.backend.edit_mode_active and self.backend.edit_active_session:
                self._updating_switches = True
                self._load_preset_to_edit_monitors(self.backend.edit_active_session)
                self._updating_switches = False
