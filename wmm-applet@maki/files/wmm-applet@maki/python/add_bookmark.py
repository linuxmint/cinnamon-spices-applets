#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM Applet - Cinnamon Edition
----------------------------
add_bookmark.py – Diálogo independiente para añadir un favorito (preset).

FLUJO DE CONTROL:
    1. Se invoca directamente desde el applet (sin pasar por el motor).
    2. Lee la sesión activa de monitores desde vault.json.
    3. Muestra un diálogo GTK para introducir el nombre del favorito.
    4. Al aceptar, guarda el preset completo en bookmarks.json y actualiza la lista plana.
    5. Cierra el diálogo sin dejar procesos en segundo plano.

INSTANCIA ÚNICA:
    Gracias a Gtk.Application, si se intenta abrir un segundo diálogo mientras
    ya hay uno abierto, simplemente se trae al frente el existente.

DEPENDENCIAS:
    - GTK+ 3.0
    - config_handler.py (mismo directorio)
"""
# ==========================================================
# IMPORTS DE LIBRERÍA ESTÁNDAR
# ==========================================================
import os
import sys

# ==========================================================
# IMPORTS DE TERCEROS (GTK)
# ==========================================================
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gio

# ==========================================================
# IMPORTS DE MÓDULOS DEL PROYECTO
# ==========================================================
from config_handler import ConfigHandler
from wmm_platform.core import PlatformManager
from debug_logger import log_event
from i18n import _

# ==========================================================
# DIÁLOGO PRINCIPAL: AÑADIR FAVORITO
# ==========================================================
class AddBookmarkDialog(Gtk.ApplicationWindow):
    """
    Ventana de diálogo para capturar el nombre del nuevo favorito.
    Hereda de Gtk.ApplicationWindow para integrarse con Gtk.Application.
    """

    def __init__(self, app):
        super().__init__(application=app, title=_("Add Favorite Preset"))
        self.set_icon_name("bookmark-new")  # Icono de añadir favorito
        self.app = app
        platform = PlatformManager()
        self.handler = ConfigHandler(cache_base_dir=platform.cache_dir)
        try:
            # Capturamos la sesión activa de monitores EN ESTE PRECISO INSTANTE.
            # Esto garantiza que el favorito refleje exactamente lo que el usuario ve.
            vault_data = self.handler.load_json("vault")
            raw_session = vault_data.get("active_session", {})

            # Leer configuración global para saber si spanned está activo
            settings = self.handler.load_json("settings").get("global", {})
            spanned_enabled = settings.get("spanned_enabled", False)

            # Obtener el monitor principal (o el primer activo) si spanned está activo
            primary_hash = None
            if spanned_enabled:
                geo = self.handler.load_json("geometry")
                monitors = geo.get("monitors", {})
                for h, info in monitors.items():
                    if info.get("primary", False):
                        primary_hash = h
                        break
                if primary_hash is None and raw_session:
                    primary_hash = list(raw_session.keys())[0]  # Fallback: primer monitor

            # Normalizar a formato dict y limpiar duplicados en spanned
            self.session_data = {}
            for m_hash, entry in raw_session.items():
                if isinstance(entry, dict):
                    path = entry.get("path", "") or ""
                    active = entry.get("active", True)
                else:
                    path = entry if entry else ""
                    active = True

                # Si spanned está activo y este no es el monitor principal, vaciar path
                if spanned_enabled and m_hash != primary_hash:
                    path = ""

                self.session_data[m_hash] = {"path": path, "active": active}

            # Nombre sugerido siguiendo el patrón "Bookmark XX"
            next_id = self.handler.get_next_bookmark_id()
            self.default_text = f"Bookmark {next_id:02d}"

        except Exception as e:
            log_event(f"Fallo al inicializar diálogo: {e}", origin="ADD_BOOK", level="ERROR", reason="BOOKMARK")
            self.show_warning(_("Error loading data. Please restart panel"))
            self._build_ui = lambda: None  # Anular la construcción de la UI
        self._build_ui()

    def _build_ui(self):
        """Construye la interfaz gráfica del diálogo."""
        self.set_default_size(300, 120)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_resizable(False)

        # Contenedor principal
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10, margin=15)
        self.add(vbox)

        # Etiqueta descriptiva
        label = Gtk.Label(label=_("Preset name:"))
        label.set_halign(Gtk.Align.START)
        vbox.pack_start(label, False, False, 0)

        # Etiqueta para mostrar advertencias (inicialmente oculta)
        self.warning_label = Gtk.Label()
        self.warning_label.set_no_show_all(True)
        vbox.pack_start(self.warning_label, False, False, 0)

        # Campo de entrada de texto
        self.entry = Gtk.Entry()
        self.entry.set_text(self.default_text)
        self.entry.set_activates_default(True)  # Permite confirmar con Enter
        vbox.pack_start(self.entry, False, False, 0)

        # Caja horizontal para los botones de acción
        hbox = Gtk.Box(spacing=5, halign=Gtk.Align.END)
        vbox.pack_start(hbox, False, False, 0)

        # Botón Cancelar
        cancel_btn = Gtk.Button.new_with_label(_("Cancel"))
        cancel_btn.set_can_default(True)
        cancel_btn.connect("clicked", self.on_cancel)
        hbox.pack_start(cancel_btn, False, False, 0)

        # Botón Aceptar
        ok_btn = Gtk.Button.new_with_label(_("OK"))
        ok_btn.connect("clicked", self.on_accept)
        ok_btn.set_can_default(True)
        ok_btn.grab_default()
        hbox.pack_start(ok_btn, False, False, 0)

        self.set_default(ok_btn)
        self.show_all()

    def on_accept(self, widget):
        """
        Maneja la aceptación del diálogo.
        Valida el nombre y persiste el favorito usando ConfigHandler.
        """
        name = self.entry.get_text().strip()

        # Validación: el nombre no puede estar vacío
        if not name:
            self.show_warning(_("The name cannot be empty."))
            return

        # Añadir preferencias globales al preset
        settings = self.handler.load_json("settings").get("global", {})
        self.session_data["__mode__"] = settings.get("wallpaper_mode", "fit")
        self.session_data["__spanned__"] = settings.get("spanned_enabled", False)
        self.session_data["__effect__"] = settings.get("wallpaper_effect", "none")
        self.session_data["__effect_scope__"] = settings.get("wallpaper_effect_scope", "blur")

        # Intentar guardar el favorito con la sesión activa capturada
        success, error = self.handler.save_new_bookmark(name, self.session_data)

        if success:
            # Notificar al motor para que el panel refresque la lista de presets
            # El motor detecta el cambio en commands.json vía Gio.FileMonitor
            try:
                self.handler.save_json("commands", {"action": "bookmark_added", "name": name})
            except Exception as e:
                log_event(f"No se pudo notificar al motor: {e}", origin="ADD_BOOK", level="WARN", reason="COMMAND")
            log_event(f"Preset guardado correctamente: {name}", origin="ADD_BOOK", level="INFO", reason="COMMAND")
            self.destroy()
        else:
            # Gestionar los errores conocidos
            if error == "DUPLICATE_NAME":
                self.show_warning(_("A Preset with that name already exists!"))
            else:
                self.show_warning(_("Error saving") + ": " + (error))

    def on_cancel(self, widget):
        """Cierra el diálogo sin guardar cambios."""
        self.destroy()

    def show_warning(self, text):
        """
        Muestra un mensaje de advertencia en la interfaz.
        Se utiliza para errores de validación o conflictos de nombres.
        """
        self.warning_label.set_markup(f"<span foreground='#D4A017'><b>{text}</b></span>")
        self.warning_label.show()


# ==========================================================
# APLICACIÓN GTK (INSTANCIA ÚNICA)
# ==========================================================
class BookmarkApplication(Gtk.Application):
    """
    Aplicación GTK con soporte de instancia única.
    Garantiza que solo exista un diálogo de añadir favorito a la vez.
    """

    def __init__(self):
        # Identificador único para el bus de sesión (D-Bus)
        super().__init__(application_id="org.wmm.BookmarkDialog")
        self.window = None

    def do_activate(self):
        """
        Crea la ventana del diálogo si no existe o la trae al frente.
        """
        if not self.window:
            self.window = AddBookmarkDialog(self)
            self.add_window(self.window)
        self.window.present()


# ==========================================================
# PUNTO DE ENTRADA
# ==========================================================
if __name__ == "__main__":
    app = BookmarkApplication()
    app.run(sys.argv)
