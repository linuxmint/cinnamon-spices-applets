#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM
----------------------------
debug_log_viewer.py – Visor independiente del log de depuración.

Muestra el contenido de debug.log en tiempo real, con actualización
automática cada segundo.
"""

# ==========================================================
# IMPORTS DE TERCEROS (GTK)
# ==========================================================
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib, Gio

# ==========================================================
# IMPORTS DE MÓDULOS DEL PROYECTO
# ==========================================================
from debug_logger import read_log, get_log_path, clear_log
from i18n import _

# ----------------------------------------------------------------------
# LISTAS DE FILTROS PARA LOS COMBOS
# ----------------------------------------------------------------------

FILTER_ORIGINS = [
    "All",
    "ENGINE",
    "IMG_ENG",
    "PANEL",
    "CONFIG",
    "BACKEND",
    "SHELL_SEND",
    "SHELL_ADD",
    "ADD_BOOK",
    "DESKTOP",
    "UNKNOW"
]

FILTER_LEVELS = [
    "All",
    "DEBUG",
    "INFO",
    "WARN",
    "ERROR"
]

FILTER_REASONS = [
    "All",
    "GENERIC",
    "COMMAND",
    "NOTIFY",
    "VAULT",
    "LIBRARY",
    "HARDWARE",
    "TIMER",
    "BOOKMARK",
    "SETTINGS"
]

class DebugLogViewer(Gtk.Window):
    def __init__(self, parent=None):
        super().__init__(title="WMM - " + _("Debug Log Viewer"))
        self.set_icon_name("utilities-system-monitor")  # Icono de monitorización del sistema
        # Heredar los colores del tema del sistema (fondo de ventana)
        self.get_style_context().add_class("background")
        self.set_default_size(800, 550) # Un poco más ancho para los filtros
        self.set_position(Gtk.WindowPosition.CENTER)
        if parent:
            self.set_transient_for(parent)

        # ----------------------------------------------------------
        # CONTENEDOR PRINCIPAL
        # ----------------------------------------------------------
        main_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        main_vbox.set_border_width(8)
        self.add(main_vbox)

        # ==========================================================
        # DEFINICIÓN DE WIDGETS (por bloques)
        # ==========================================================

        # --- BLOQUE IZQUIERDO: COMBOS DE FILTRO ---
        combos_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)

        # Combo de Origen
        origin_vbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        origin_label = Gtk.Label(label=_("Origin"))
        origin_label.set_halign(Gtk.Align.CENTER)
        self.origin_combo = Gtk.ComboBoxText()
        for item in FILTER_ORIGINS:
            self.origin_combo.append_text(item)
        self.origin_combo.set_active(0)  # "All"
        self.origin_combo.connect("changed", self._on_filter_changed)
        origin_vbox.pack_start(origin_label, False, False, 0)
        origin_vbox.pack_start(self.origin_combo, False, False, 0)
        combos_box.pack_start(origin_vbox, False, False, 0)

        # Combo de Nivel
        level_vbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        level_label = Gtk.Label(label=_("Level"))
        level_label.set_halign(Gtk.Align.CENTER)
        self.level_combo = Gtk.ComboBoxText()
        for item in FILTER_LEVELS:
            self.level_combo.append_text(item)
        self.level_combo.set_active(0)  # "All"
        self.level_combo.connect("changed", self._on_filter_changed)
        level_vbox.pack_start(level_label, False, False, 0)
        level_vbox.pack_start(self.level_combo, False, False, 0)
        combos_box.pack_start(level_vbox, False, False, 0)

        # Combo de Reason
        reason_vbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        reason_label = Gtk.Label(label=_("Reason"))
        reason_label.set_halign(Gtk.Align.CENTER)
        self.reason_combo = Gtk.ComboBoxText()
        for item in FILTER_REASONS:
            self.reason_combo.append_text(item)
        self.reason_combo.set_active(0)  # "All"
        self.reason_combo.connect("changed", self._on_filter_changed)
        reason_vbox.pack_start(reason_label, False, False, 0)
        reason_vbox.pack_start(self.reason_combo, False, False, 0)
        combos_box.pack_start(reason_vbox, False, False, 0)

        # --- BLOQUE DERECHO: BARRA DE BÚSQUEDA ---
        search_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        search_label = Gtk.Label(label=_("Search"))
        search_label.set_halign(Gtk.Align.CENTER)
        self.search_entry = Gtk.Entry()
        self.search_entry.set_placeholder_text(_("Filter by text") + "...")
        self.search_entry.connect("changed", self._on_filter_changed)
        search_box.pack_start(search_label, False, False, 0)
        search_box.pack_start(self.search_entry, True, True, 0)

        # --- SEPARADORES VISUALES ---
        top_separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        bottom_separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)

        # --- VISOR DE TEXTO ---
        scrolled = Gtk.ScrolledWindow()
        self.textview = Gtk.TextView()
        self.textview.set_editable(False)
        self.textview.set_monospace(True)
        # Heredar los colores del tema del sistema (fondo de texto)
        self.textview.get_style_context().add_class("view")
        self.textbuffer = self.textview.get_buffer()
        scrolled.add(self.textview)

        # --- MARCAS PARA EL RESALTADO (no se invalidan al modificar el buffer) ---
        self._highlight_start_mark = self.textbuffer.create_mark(
            "highlight-start", self.textbuffer.get_start_iter(), True
        )
        self._highlight_end_mark = self.textbuffer.create_mark(
            "highlight-end", self.textbuffer.get_start_iter(), False
        )

        # --- RESALTADO DE LÍNEA ACTUAL ---
        # Creamos una etiqueta visual sin colores fijos: los tomaremos del tema
        self.highlight_tag = self.textbuffer.create_tag("highlight-line")

        # Aplicar los colores del tema actual al tag de resaltado
        self._update_highlight_colors()

        # Conectar señales: movimiento del cursor y cambios de tema
        self.textbuffer.connect("notify::cursor-position", self._on_cursor_moved)
        self.textview.connect("style-updated", lambda w: self._update_highlight_colors())

        # --- BOTONES DE ACCIÓN (LIMPIAR LOG) ---

        clear_btn = Gtk.Button.new_from_icon_name("edit-clear-symbolic", Gtk.IconSize.BUTTON)
        clear_btn.set_tooltip_text(_("Clear log"))
        clear_btn.connect("clicked", self._on_clear_log)

        # --- BLOQUE CENTRAL: SWITCHES DE VISUALIZACIÓN ---
        switches_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)

        # Switch Auto-scroll
        auto_scroll_vbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        auto_scroll_label = Gtk.Label(label=_("Auto-scroll"))
        auto_scroll_label.set_halign(Gtk.Align.CENTER)
        self.auto_scroll_switch = Gtk.Switch(active=True)
        self.auto_scroll_switch.set_halign(Gtk.Align.CENTER)
        auto_scroll_vbox.pack_start(auto_scroll_label, False, False, 0)
        auto_scroll_vbox.pack_start(self.auto_scroll_switch, False, False, 0)
        switches_box.pack_start(auto_scroll_vbox, False, False, 0)

        # Switch Orden inverso
        reverse_vbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        reverse_label = Gtk.Label(label=_("Reverse order"))
        reverse_label.set_halign(Gtk.Align.CENTER)
        self.reverse_order_switch = Gtk.Switch(active=True)
        self.reverse_order_switch.set_halign(Gtk.Align.CENTER)
        self.reverse_order_switch.connect("notify::active", lambda sw, ps: self._refresh())
        reverse_vbox.pack_start(reverse_label, False, False, 0)
        reverse_vbox.pack_start(self.reverse_order_switch, False, False, 0)
        switches_box.pack_start(reverse_vbox, False, False, 0)

        # ==========================================================
        # ORDEN DE EMPAQUETADO EN LA VENTANA
        # ==========================================================

        # --- FILA SUPERIOR: COMBOS (IZQ) + ESPACIADOR + BÚSQUEDA (DER) ---
        top_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        top_box.pack_start(combos_box, False, False, 0)  # Combos alineados a la izquierda
        top_box.pack_start(Gtk.Box(), True, True, 0)      # Espaciador central (empuja la búsqueda)
        top_box.pack_start(search_box, False, False, 0)   # Búsqueda alineada a la derecha
        main_vbox.pack_start(top_box, False, False, 0)
        # --- SEPARADOR SUPERIOR (entre barra de filtros y visor) ---
        main_vbox.pack_start(top_separator, False, False, 4)

        # --- VISOR DE TEXTO (OCUPA EL ESPACIO RESTANTE) ---
        main_vbox.pack_start(scrolled, True, True, 0)

        # --- SEPARADOR INFERIOR (entre visor y barra de acciones) ---
        main_vbox.pack_start(bottom_separator, False, False, 4)
        # --- FILA INFERIOR: SWITCHES (IZQ) + LIMPIAR (DER) ---
        toolbar_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        toolbar_box.pack_start(switches_box, False, False, 0) # Switches alineados a la izquierda
        toolbar_box.pack_start(Gtk.Box(), True, True, 0)      # Espaciador (empuja el botón limpiar)
        toolbar_box.pack_end(clear_btn, False, False, 0)      # Limpiar a la derecha
        main_vbox.pack_start(toolbar_box, False, False, 0)

        # ----------------------------------------------------------
        # PRIMERA CARGA Y MONITORIZACIÓN
        # ----------------------------------------------------------
        self._last_content = ""
        self._refresh()

        # Monitorizar cambios en el archivo de log para actualización reactiva
        log_file = Gio.File.new_for_path(get_log_path())
        self._log_monitor = log_file.monitor_file(Gio.FileMonitorFlags.NONE, None)
        self._log_monitor.connect("changed", self._on_log_changed)
        # Reaccionar a cambios de tema del sistema (claro/oscuro)
        self.connect("style-updated", lambda w: self._refresh(force=True))
        # Cancelar monitor al cerrar la ventana
        self.connect("destroy", self._on_destroy)

    def _on_filter_changed(self, widget):
        """Callback cuando cambia cualquier filtro (combo o búsqueda)."""
        self._refresh(force=False)  # Solo re-aplicar filtros, no releer archivo

    def _on_clear_log(self, widget):
        """Pide confirmación y vacía el archivo de log."""
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=0,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text=_("Clear debug log?")
        )
        dialog.format_secondary_text(_("All log entries will be permanently deleted."))
        response = dialog.run()
        if response == Gtk.ResponseType.YES:
            clear_log()
            self._refresh()
        dialog.destroy()

    def _on_cursor_moved(self, buffer, param):
        """Resalta la línea del cursor usando marcas (no se invalidan)."""
        # 1. Eliminar resaltado antiguo (usando las marcas)
        start = buffer.get_iter_at_mark(self._highlight_start_mark)
        end = buffer.get_iter_at_mark(self._highlight_end_mark)
        if not start.equal(end):  # Solo si hay algo que limpiar
            buffer.remove_tag(self.highlight_tag, start, end)

        # 2. Obtener la línea actual del cursor
        cursor = buffer.get_iter_at_mark(buffer.get_insert())
        line_start = cursor.copy()
        line_start.set_line_offset(0)
        line_end = line_start.copy()
        if not line_end.ends_line():
            line_end.forward_to_line_end()

        # 3. Aplicar nuevo resaltado
        buffer.apply_tag(self.highlight_tag, line_start, line_end)

        # 4. Mover las marcas a la nueva posición
        buffer.move_mark(self._highlight_start_mark, line_start)
        buffer.move_mark(self._highlight_end_mark, line_end)

    def _update_highlight_colors(self):
        """
        Aplica al tag de resaltado los colores del tema GTK actual.
        Se llama al iniciar y cada vez que el tema cambia.
        """
        style_ctx = self.textview.get_style_context()
        fg_color = style_ctx.get_color(Gtk.StateFlags.SELECTED)
        bg_color = style_ctx.get_background_color(Gtk.StateFlags.SELECTED)
        self.highlight_tag.set_property("foreground-rgba", fg_color)
        self.highlight_tag.set_property("background-rgba", bg_color)

    def _refresh(self, widget=None, force=False):
        """
        Lee el archivo de log, aplica filtros y actualiza el visor.
        Si force=True, relee el archivo aunque no haya cambiado.
        Si force=False y el contenido no ha cambiado, solo re-aplica filtros.
        """
        if force:
            content = read_log()
            self._last_content = content
        else:
            content = read_log()
            if content == self._last_content:
                # El archivo no ha cambiado: solo re-aplicar filtros a lo ya leído
                lines = self._last_content.splitlines()
                lines = self._apply_filters(lines)
                if self.reverse_order_switch.get_active():
                    lines.reverse()
                self.textbuffer.set_text("\n".join(lines))
                return
            self._last_content = content

        # El archivo ha cambiado o forzamos lectura: aplicar filtros a las nuevas líneas
        lines = content.splitlines()
        lines = self._apply_filters(lines)

        if self.reverse_order_switch.get_active():
            lines.reverse()

        self.textbuffer.set_text("\n".join(lines))

        # Programar auto-scroll
        if self.auto_scroll_switch.get_active():
            if self.reverse_order_switch.get_active():
                def scroll_to_start():
                    start_iter = self.textbuffer.get_start_iter()
                    self.textview.scroll_to_iter(start_iter, 0.0, False, 0.0, 0.0)
                    return False
                GLib.timeout_add(50, scroll_to_start)
            else:
                def scroll_to_end():
                    end_iter = self.textbuffer.get_end_iter()
                    self.textview.scroll_to_iter(end_iter, 0.0, False, 0.0, 0.0)
                    return False
                GLib.timeout_add(50, scroll_to_end)

    def _apply_filters(self, lines):
        """
        Filtra las líneas del log según los criterios activos.
        La barra de búsqueda filtra por texto en toda la línea.
        Los combos filtran por el campo correspondiente (origen, nivel, reason).
        Si un combo está en "All", no filtra por ese campo.
        """
        # 1. Filtro de búsqueda (texto libre en toda la línea)
        search_text = self.search_entry.get_text().strip().lower()
        if search_text:
            lines = [line for line in lines if search_text in line.lower()]

        # 2. Filtro por origen
        origin_filter = self.origin_combo.get_active_text()
        if origin_filter and origin_filter != "All":
            lines = [line for line in lines if f"[{origin_filter}]" in line]

        # 3. Filtro por nivel
        level_filter = self.level_combo.get_active_text()
        if level_filter and level_filter != "All":
            lines = [line for line in lines if f"[{level_filter}]" in line]

        # 4. Filtro por reason
        reason_filter = self.reason_combo.get_active_text()
        if reason_filter and reason_filter != "All":
            lines = [line for line in lines if f"[{reason_filter}]" in line]

        return lines

    def _on_log_changed(self, monitor, file, other_file, event_type):
        """Callback cuando el archivo de log es modificado."""
        if event_type == Gio.FileMonitorEvent.CHANGED:
            self._refresh(force=True)

    def _on_destroy(self, widget):
        """Cancela la monitorización al cerrar la ventana."""
        if hasattr(self, '_log_monitor') and self._log_monitor:
            self._log_monitor.cancel()
