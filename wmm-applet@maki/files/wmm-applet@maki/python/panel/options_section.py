#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM Applet - Cinnamon Edition
----------------------------
options_section.py – Sección de Opciones del panel de control.

Gestiona todas las opciones de configuración de WMM: persistencia,
modo distribuido, aspecto, efectos, colores, presentación de diapositivas
y los botones de acción (reiniciar, visor de logs, ayuda).
"""

import os
import time
import signal
import subprocess
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib
from config_handler import ConfigHandler
from i18n import _
from debug_logger import log_event

class OptionsSection:
    """
    Sección de Opciones del panel de control.
    """

    def __init__(self, handler, backend, ie, left_col):
        """
        Args:
            handler:  Instancia de ConfigHandler.
            backend:  Instancia de WMMBackend.
            ie:       Instancia de ImageEngine.
            left_col: El Gtk.Box donde se empaquetará esta sección.
            callbacks: Diccionario con funciones de callback para
                       comunicarse con el panel principal:
                       - 'create_section_label': (text) -> Gtk.Label
                       - 'notify_engine': (action_dict)
                       - 'load_monitors': ()
                       - 'set_monitor_switches_sensitive': (bool)
                       - 'get_edit_mode_active': () -> bool
                       - 'get_loading_state': () -> bool
                       - 'get_fav_rotation_switch': () -> Gtk.Switch
                       - 'get_parent_window': () -> Gtk.Window
                       - 'get_application': () -> Gtk.Application
        """
        self.handler = handler
        self.backend = backend
        self.ie = ie
        self._callbacks = {}  # Se configurarán después con set_callbacks()

        # Construir la interfaz
        self.widget = self._build()
        left_col.pack_start(self.widget, False, False, 0)
        left_col.pack_start(
            Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL),
            False, False, 0
        )

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
        return cb() if cb else False

    @property
    def _parent_window(self):
        """Devuelve la ventana principal del panel."""
        cb = self._callbacks.get('get_parent_window')
        return cb() if cb else None

    def _create_section_label(self, text):
        """Crea una etiqueta de sección usando el callback del panel."""
        cb = self._callbacks.get('create_section_label')
        if cb:
            return cb(text)
        # Fallback si no hay callback
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

    def _set_monitor_switches_sensitive(self, sensitive):
        """Activa/desactiva los switches de monitor."""
        cb = self._callbacks.get('set_monitor_switches_sensitive')
        if cb:
            cb(sensitive)

    # ==========================================================
    # CONSTRUCCIÓN DE LA INTERFAZ
    # ==========================================================
    def _build(self):
        """Construye y devuelve el widget principal de la sección."""
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)

        # ----------------------------------------------------------
        # CABECERA: Label + Botones de acción
        # ----------------------------------------------------------
        hbox_header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        options_label = self._create_section_label(_("Options"))
        options_label.set_margin_top(8)
        options_label.set_margin_bottom(8)
        hbox_header.pack_start(options_label, True, True, 0)

        action_block = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)

        # Botón reiniciar
        self.restart_btn = Gtk.Button.new_from_icon_name("view-refresh-symbolic", Gtk.IconSize.BUTTON)
        self.restart_btn.set_tooltip_text(_("Restart engine and panel"))
        self.restart_btn.connect("clicked", self._on_restart_clicked)
        action_block.pack_start(self.restart_btn, False, False, 0)

        # Botón Visor de logs
        self.debug_log_btn = Gtk.Button.new_from_icon_name("text-x-generic", Gtk.IconSize.BUTTON)
        self.debug_log_btn.set_tooltip_text(_("Open Debug Log Viewer"))
        self.debug_log_btn.connect("clicked", self._on_open_debug_log)
        action_block.pack_start(self.debug_log_btn, False, False, 0)

        # Botón de Ayuda
        self.help_btn = Gtk.Button.new_from_icon_name("help-contents", Gtk.IconSize.BUTTON)
        self.help_btn.set_tooltip_text(_("Open Help"))
        self.help_btn.connect("clicked", self._on_open_help)
        action_block.pack_start(self.help_btn, False, False, 0)

        hbox_header.pack_end(action_block, False, False, 0)

        vbox.pack_start(hbox_header, False, False, 0)
        vbox.pack_start(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL), False, False, 0)

        # ----------------------------------------------------------
        # OPCIONES DE CONFIGURACIÓN
        # ----------------------------------------------------------

        # --- Cambiar fondo al inicio ---
        self.persist_switch = Gtk.Switch(active=True, halign=Gtk.Align.END)
        self.persist_switch.set_tooltip_text(
            _("If enabled, the wallpaper is changed at startup; if disabled, the last wallpaper is kept.")
        )
        self.persist_switch.connect("notify::active", self._on_persist_changed)
        hbox_persist = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        hbox_persist.pack_start(Gtk.Label(label=_("Change wallpaper on startup"), halign=Gtk.Align.START), True, True, 0)
        hbox_persist.pack_start(self.persist_switch, False, False, 0)
        vbox.pack_start(hbox_persist, False, False, 0)

        # --- Modo Distribuido ---
        self.spanned_switch = Gtk.Switch(active=False, halign=Gtk.Align.END)
        self.spanned_switch.set_tooltip_text(_("Span image across all active screens (Only if more than one)"))
        self.spanned_switch.connect("notify::active", self._on_spanned_changed)
        hbox_spanned = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        hbox_spanned.pack_start(Gtk.Label(label=_("Spanned") + ":", halign=Gtk.Align.START), True, True, 0)
        hbox_spanned.pack_start(self.spanned_switch, False, False, 0)
        vbox.pack_start(hbox_spanned, False, False, 0)

        # --- Relación Aspecto ---
        hbox_aspect = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        hbox_aspect.pack_start(Gtk.Label(label=_("Picture aspect") + ":", halign=Gtk.Align.START), True, True, 0)
        self.aspect_combo = Gtk.ComboBoxText()
        for key, label in ConfigHandler.ASPECT_MODES.items():
            self.aspect_combo.append_text(_(label))
        self.aspect_combo.set_active(0)
        self.aspect_combo.connect("changed", self._on_aspect_changed)
        hbox_aspect.pack_start(self.aspect_combo, False, False, 0)
        vbox.pack_start(hbox_aspect, False, False, 5)

        # --- Efecto de Imagen ---
        self.image_effect_combo = Gtk.ComboBoxText()
        for key, label in ConfigHandler.IMAGE_EFFECT.items():
            self.image_effect_combo.append_text(_(label))
        self.image_effect_combo.set_active(0)
        self.image_effect_combo.connect("changed", self._on_image_effect_changed)
        hbox_img_effect = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        hbox_img_effect.pack_start(Gtk.Label(label=_("Image Effect:"), halign=Gtk.Align.START), True, True, 0)
        hbox_img_effect.pack_start(self.image_effect_combo, False, False, 0)
        vbox.pack_start(hbox_img_effect, False, False, 0)

        # --- Efecto de Fondo ---
        self.back_effect_combo = Gtk.ComboBoxText()
        for key, label in ConfigHandler.BACK_EFFECT.items():
            self.back_effect_combo.append_text(_(label))
        self.back_effect_combo.set_active(0)
        self.back_effect_combo.connect("changed", self._on_back_effect_changed)
        hbox_back_effect = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        hbox_back_effect.pack_start(Gtk.Label(label=_("Background Effect:"), halign=Gtk.Align.START), True, True, 0)
        hbox_back_effect.pack_start(self.back_effect_combo, False, False, 0)
        vbox.pack_start(hbox_back_effect, False, False, 0)

        # --- Color de fondo ---
        hbox_color = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        hbox_color.pack_start(Gtk.Label(label=_("Background color") + ":", halign=Gtk.Align.START), True, True, 0)

        self.bg_mode_combo = Gtk.ComboBoxText()
        for key, label in ConfigHandler.COLOR_MODES.items():
            self.bg_mode_combo.append_text(_(label))
        self.bg_mode_combo.set_active(0)
        self.bg_mode_combo.set_halign(Gtk.Align.END)
        self.bg_mode_combo.connect("changed", self._on_bg_mode_changed)

        self.bg_color_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        self.solid_color_btn = Gtk.ColorButton()
        self.solid_color_btn.set_tooltip_text(_("Background color"))
        self.solid_color_btn.connect("color-set", self._on_solid_color_changed)
        self.bg_color_box.pack_start(self.solid_color_btn, False, False, 0)

        self.grad_h_start_btn = Gtk.ColorButton()
        self.grad_h_start_btn.set_tooltip_text(_("Horizontal gradient start color"))
        self.grad_h_start_btn.connect("color-set", self._on_gradient_h_changed)
        self.grad_h_end_btn = Gtk.ColorButton()
        self.grad_h_end_btn.set_tooltip_text(_("Horizontal gradient end color"))
        self.grad_h_end_btn.connect("color-set", self._on_gradient_h_changed)

        self.grad_v_start_btn = Gtk.ColorButton()
        self.grad_v_start_btn.set_tooltip_text(_("Vertical gradient start color"))
        self.grad_v_start_btn.connect("color-set", self._on_gradient_v_changed)
        self.grad_v_end_btn = Gtk.ColorButton()
        self.grad_v_end_btn.set_tooltip_text(_("Vertical gradient end color"))
        self.grad_v_end_btn.connect("color-set", self._on_gradient_v_changed)

        color_controls_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        color_controls_box.pack_end(self.bg_mode_combo, False, False, 0)
        color_controls_box.pack_end(self.bg_color_box, False, False, 0)

        hbox_color.pack_end(color_controls_box, False, False, 0)
        vbox.pack_start(hbox_color, False, False, 5)

        # --- Presentación Diapositivas ---
        self.slideshow_switch = Gtk.Switch(active=True, halign=Gtk.Align.END)
        self.slideshow_switch.set_tooltip_text(_("Enable/Disable Timer"))
        self.slideshow_switch.connect("notify::active", self._on_slideshow_changed)
        hbox_slideshow = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        hbox_slideshow.pack_start(Gtk.Label(label=_("Slideshow"), halign=Gtk.Align.START), True, True, 0)
        hbox_slideshow.pack_start(self.slideshow_switch, False, False, 0)
        vbox.pack_start(hbox_slideshow, False, False, 0)

        # --- Max. Intervalo ---
        hbox_max = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        hbox_max.pack_start(
            Gtk.Label(label=_("Max. Frequency") + ": " + "(" + _("minutes") + ")", halign=Gtk.Align.START),
            True, True, 0
        )
        self.max_interval_spin = Gtk.SpinButton.new_with_range(1, 999, 1)
        self.max_interval_spin.set_value(60)
        self.max_interval_spin.connect("value-changed", self._on_max_interval_changed)
        self.max_interval_spin.connect("activate", lambda w: self.set_focus(None))
        hbox_max.pack_start(self.max_interval_spin, False, False, 0)
        vbox.pack_start(hbox_max, False, False, 0)

        # --- Rotación ---
        hbox_rot = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        hbox_rot.pack_start(
            Gtk.Label(label=_("Slideshow every") + ": " + "(" + _("minutes") + ")", halign=Gtk.Align.START),
            True, True, 0
        )
        self.rotation_spin = Gtk.SpinButton.new_with_range(1, 99, 1)
        self.rotation_spin.set_value(15)
        self.rotation_spin.connect("value-changed", self._on_rotation_changed)
        self.rotation_spin.connect("activate", lambda w: self.set_focus(None))
        hbox_rot.pack_start(self.rotation_spin, False, False, 0)
        vbox.pack_start(hbox_rot, False, False, 0)

        # --- Modo de rotación ---
        self.mode_switch = Gtk.Switch(active=True, halign=Gtk.Align.END)
        self.mode_switch.set_tooltip_text(
            _("Sync: All Screens change at once") + "\n" + _("Async: Change by turns")
        )
        self.mode_switch.connect("notify::active", self._on_mode_changed)
        self.mode_info_label = Gtk.Label(label="", halign=Gtk.Align.CENTER, margin_left=8)
        hbox_mode = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        hbox_mode.pack_start(Gtk.Label(label=_("Slideshow mode:"), halign=Gtk.Align.START), False, False, 0)
        hbox_mode.pack_start(self.mode_info_label, True, True, 0)
        hbox_mode.pack_start(self.mode_switch, False, False, 0)
        vbox.pack_start(hbox_mode, False, False, 0)

        return vbox

    # ==========================================================
    # EVENTOS DE OPCIONES
    # ==========================================================
    def _on_aspect_changed(self, combo):
        if self._loading:
            return
        index = combo.get_active()
        keys = list(ConfigHandler.ASPECT_MODES.keys())
        if 0 <= index < len(keys):
            mode = keys[index]
            self.backend.save_setting("wallpaper_mode", mode)
            self._notify_engine({"action": "apply_manual_selection"})
            if not self._edit_mode_active:
                self._load_monitors()

    def _on_bg_mode_changed(self, combo):
        if self._loading:
            return
        index = combo.get_active()
        keys = list(ConfigHandler.COLOR_MODES.keys())
        if 0 <= index < len(keys):
            mode = keys[index]
            self.backend.save_setting("color_mode", mode)
            self._notify_engine({"action": "apply_manual_selection"})
            self._update_bg_color_buttons(mode)
            if not self._edit_mode_active:
                self._load_monitors()

    def _update_bg_color_buttons(self, mode):
        for widget in self.bg_color_box.get_children():
            self.bg_color_box.remove(widget)
        if mode == "solid_color":
            self.bg_color_box.pack_start(self.solid_color_btn, False, False, 0)
        elif mode == "gradient_h":
            self.bg_color_box.pack_start(self.grad_h_start_btn, False, False, 0)
            self.bg_color_box.pack_start(self.grad_h_end_btn, False, False, 4)
        elif mode == "gradient_v":
            self.bg_color_box.pack_start(self.grad_v_start_btn, False, False, 0)
            self.bg_color_box.pack_start(self.grad_v_end_btn, False, False, 4)
        self.bg_color_box.show_all()

    def _on_solid_color_changed(self, button):
        if self._loading:
            return
        color = button.get_rgba()
        hex_color = "#{:02X}{:02X}{:02X}".format(
            int(color.red * 255), int(color.green * 255), int(color.blue * 255)
        )
        self.backend.save_setting("solid_color", hex_color)
        self._notify_engine({"action": "apply_manual_selection"})
        if not self._edit_mode_active:
            self._load_monitors()

    def _on_gradient_h_changed(self, button):
        if self._loading:
            return
        start = self.grad_h_start_btn.get_rgba()
        end = self.grad_h_end_btn.get_rgba()
        hex_start = "#{:02X}{:02X}{:02X}".format(int(start.red*255), int(start.green*255), int(start.blue*255))
        hex_end = "#{:02X}{:02X}{:02X}".format(int(end.red*255), int(end.green*255), int(end.blue*255))
        self.backend.save_setting("gradient_h", [hex_start, hex_end])
        self._notify_engine({"action": "apply_manual_selection"})
        if not self._edit_mode_active:
            self._load_monitors()

    def _on_gradient_v_changed(self, button):
        if self._loading:
            return
        start = self.grad_v_start_btn.get_rgba()
        end = self.grad_v_end_btn.get_rgba()
        hex_start = "#{:02X}{:02X}{:02X}".format(int(start.red*255), int(start.green*255), int(start.blue*255))
        hex_end = "#{:02X}{:02X}{:02X}".format(int(end.red*255), int(end.green*255), int(end.blue*255))
        self.backend.save_setting("gradient_v", [hex_start, hex_end])
        self._notify_engine({"action": "apply_manual_selection"})
        if not self._edit_mode_active:
            self._load_monitors()

    def _on_slideshow_changed(self, switch, param):
        if self._loading:
            return
        self.backend.save_setting("slideshow_enabled", switch.get_active())

    def _on_mode_changed(self, switch, param):
        if self._loading:
            return
        mode = "sync" if switch.get_active() else "async"
        self.backend.save_setting("slideshow_mode", mode)
        self._update_mode_info_label()

    def _on_persist_changed(self, switch, param):
        if self._loading:
            return
        self.backend.save_setting("persist_on_reboot", not switch.get_active())

    def _on_spanned_changed(self, switch, param):
        if self._loading:
            return
        self.backend.save_setting("spanned_enabled", switch.get_active())
        self._notify_engine({"action": "apply_manual_selection"})
        self._set_monitor_switches_sensitive(not switch.get_active())
        if not self._edit_mode_active:
            self._load_monitors()

    def _on_image_effect_changed(self, combo):
        if self._loading:
            return
        keys = list(ConfigHandler.IMAGE_EFFECT.keys())
        index = combo.get_active()
        if 0 <= index < len(keys):
            self.backend.save_setting("wallpaper_effect", keys[index])
            self._notify_engine({"action": "apply_manual_selection"})
            if not self._edit_mode_active:
                self._load_monitors()

    def _on_back_effect_changed(self, combo):
        if self._loading:
            return
        keys = list(ConfigHandler.BACK_EFFECT.keys())
        index = combo.get_active()
        if 0 <= index < len(keys):
            self.backend.save_setting("wallpaper_effect_scope", keys[index])
            self._notify_engine({"action": "apply_manual_selection"})
            if not self._edit_mode_active:
                self._load_monitors()

    def _on_max_interval_changed(self, spin):
        if self._loading:
            return
        max_val = spin.get_value_as_int()
        self.backend.save_setting("slideshow_max_interval", max_val)
        settings = self.backend.load_settings()
        if settings["slideshow_interval"] > max_val:
            self.backend.save_setting("slideshow_interval", max_val)
            self.rotation_spin.set_value(max_val)

    def _on_rotation_changed(self, spin):
        if self._loading:
            return
        settings = self.backend.load_settings()
        rot_val = spin.get_value_as_int()
        max_val = settings.get("slideshow_max_interval", 60)
        if rot_val > max_val:
            max_val = rot_val
            self.backend.save_setting("slideshow_max_interval", max_val)
            self._loading = True
            self.max_interval_spin.set_value(max_val)
            self._loading = False
        self.backend.save_setting("slideshow_interval", rot_val)

    def _update_mode_info_label(self):
        sync_active = self.mode_switch.get_active()
        fav_only = False
        fav_cb = self._callbacks.get('get_fav_rotation_switch')
        if fav_cb:
            fav_switch = fav_cb()
            if fav_switch:
                fav_only = fav_switch.get_active()
        if sync_active:
            mode_text = _("Synchronized")
            scope = _("Presets") if fav_only else _("All")
        else:
            mode_text = _("Asynchronous")
            scope = _("Favorites") if fav_only else _("Single")
        self.mode_info_label.set_text(f"{mode_text} ({scope})")

    # ==========================================================
    # BOTONES DE ACCIÓN
    # ==========================================================
    def _on_restart_clicked(self, widget):
        engine_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "main.py")
        self.backend.save_json("commands", {})
        log_event("Buzón de comandos limpiado antes de reiniciar motor", origin="PANEL", level="DEBUG", reason="COMMAND")
        time.sleep(0.1)
        pid_path = os.path.join(self.handler.cache_dir, "pid_main.pid")
        if os.path.exists(pid_path):
            try:
                with open(pid_path, "r") as f:
                    old_pid = int(f.read().strip())
                os.kill(old_pid, signal.SIGKILL)
                time.sleep(0.5)
                os.remove(pid_path)
            except (OSError, ValueError, FileNotFoundError):
                pass
        subprocess.Popen(
            ["python3", engine_path],
            start_new_session=True,
            env=os.environ.copy(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        time.sleep(0.5)
        panel_pid_path = os.path.join(self.handler.cache_dir, "pid_panel.pid")
        if os.path.exists(panel_pid_path):
            try:
                os.remove(panel_pid_path)
            except OSError:
                pass
        app = self._callbacks.get('get_application', lambda: None)()
        if app:
            app.quit()

    def _on_open_debug_log(self, widget):
        # Gestionado por el panel principal mediante callback
        cb = self._callbacks.get('on_open_debug_log')
        if cb:
            cb()

    def _on_open_help(self, widget):
        # Gestionado por el panel principal mediante callback
        cb = self._callbacks.get('on_open_help')
        if cb:
            cb()
