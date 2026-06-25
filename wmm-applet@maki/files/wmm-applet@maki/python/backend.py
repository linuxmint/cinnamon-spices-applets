#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM Applet - Cinnamon Edition
----------------------------
backend.py – Backend de lógica de datos para el panel de control.
* FLUJO DE CONTROL:
  1. Panel (UI) delega en el backend todas las operaciones de datos.
  2. Backend usa ConfigHandler para leer/escribir JSON.
  3. Backend notifica al motor (main.py) mediante commands.json + SIGUSR1.
"""
from debug_logger import log_event

class WMMBackend:
    """
    Capa intermedia entre la interfaz gráfica (panel.py) y la persistencia (config_handler.py).
    No depende de GTK. Solo usa ConfigHandler
    """

    def __init__(self, config_handler):
        self.ch = config_handler

        # Estado del modo edición
        self.edit_mode_active = False
        self.edit_active_session = {}
        self.edit_active_states = {}
        self.edit_temp_wp_mode = None
        self.edit_temp_spanned_enabled = None
        self.edit_temp_image_effect = None
        self.edit_temp_wp_scope = None

    # --- LECTURA / ESCRITURA DE JSON ---

    def load_settings(self):
        """Retorna el diccionario 'global' de settings.json."""
        return self.ch.load_json("settings").get("global", {})

    def save_setting(self, key, value):
        """Guarda un único ajuste en settings.json."""
        settings = self.ch.load_json("settings")
        settings["global"][key] = value
        self.ch.save_json("settings", settings)

    def load_json(self, key):
        """Lee cualquier archivo JSON usando ConfigHandler."""
        return self.ch.load_json(key)

    def save_json(self, key, data):
        """Guarda cualquier archivo JSON usando ConfigHandler."""
        self.ch.save_json(key, data)

    def save_settings(self, settings_dict):
        """Guarda el diccionario global completo en settings.json."""
        settings = self.ch.load_json("settings")
        settings["global"] = settings_dict
        self.ch.save_json("settings", settings)

    def load_vault(self):
        """Retorna el vault completo (monitor_vault.json)."""
        return self.ch.load_json("vault")

    def save_vault(self, vault_dict):
        """Guarda el vault completo."""
        self.ch.save_json("vault", vault_dict)

    def toggle_monitor_active(self, m_hash, active):
        """
        Activa o desactiva un monitor en el vault.
        Retorna True si el monitor existe y se actualizó, False si no se encontró.
        """
        vault = self.load_vault()
        if m_hash not in vault.get("active_session", {}):
            return False
        entry = vault["active_session"][m_hash]
        # Migrar formato antiguo si procede
        if isinstance(entry, str):
            entry = {"path": entry, "active": True}
        entry["active"] = active
        vault["active_session"][m_hash] = entry
        self.save_vault(vault)
        return True

    def apply_edit_changes(self, edit_active_session, edit_active_states):
        """
        Guarda los cambios temporales de edición en el vault.
        Ahora incluye monitores inactivos (active=False) aunque no tengan path.
        """
        vault = self.load_vault()
        active = vault.get("active_session", {})
        # Asegurar que todos los monitores en edit_active_states se procesen
        for m_hash, active_flag in edit_active_states.items():
            path = edit_active_session.get(m_hash, "")
            if m_hash in active:
                if isinstance(active[m_hash], dict):
                    active[m_hash]["path"] = path
                    active[m_hash]["active"] = active_flag
                else:
                    active[m_hash] = {"path": path, "active": active_flag}
            else:
                active[m_hash] = {"path": path, "active": active_flag}
        vault["active_session"] = active
        self.save_vault(vault)
        return vault

    def get_background_color_tuple(self):
        """Devuelve la tupla de color actual según la configuración de settings.json."""
        settings = self.load_settings()
        color_mode = settings.get("color_mode", "solid_color")
        solid_color = settings.get("solid_color", "#000000")
        grad_h = settings.get("gradient_h", ["#000000", "#8D9797"])
        grad_v = settings.get("gradient_v", ["#000000", "#8D9797"])
        return ("color", color_mode, solid_color, grad_h, grad_v)

    def get_active_session(self):
        """Retorna el diccionario active_session del vault."""
        vault = self.ch.load_json("vault")
        return vault.get("active_session", {})

    def get_image_path(self, m_hash):
        """
        Retorna la ruta de la imagen para el monitor m_hash desde la sesión activa,
        o None si no hay imagen. Maneja formato nuevo (dict) y antiguo (str).
        """
        active = self.get_active_session()
        entry = active.get(m_hash, {})
        if isinstance(entry, dict):
            return entry.get("path")
        return entry if entry else None

    # --- COMUNICACIÓN CON EL MOTOR ---

    def notify_engine(self, action):
        """
        Escribe un comando en commands.json.
        El motor será notificado automáticamente por Gio.FileMonitor.

        action: diccionario con la orden (ej. {"action": "force_rotation"}).
        """
        try:
            self.ch.save_json("commands", action)
            log_event(f"Comando enviado al motor: {action.get('action', 'unknown')}", origin="BACKEND", level="DEBUG", reason="COMMAND")

        except Exception as e:
            log_event(f"No se pudo escribir el comando: {e}", origin="BACKEND", level="ERROR", reason="COMMAND")

    # --- MODO EDICIÓN ---

    def load_preset_for_edit(self, preset_name):
        """
        Carga los datos de un preset en la sesión de edición.

        Args:
            preset_name (str): Nombre del preset a cargar.

        Returns:
            dict|None: Los datos del preset (monitores) ya procesados, o None si no existe.
        """
        bookmarks = self.ch.load_json("bookmarks")
        if preset_name not in bookmarks:
            log_event(f"El preset '{preset_name}' no existe", origin="BACKEND", level="ERROR", reason="BOOKMARK")
            return None

        preset_data = bookmarks[preset_name].copy()  # no modificar el original

        # Extraer preferencias del preset
        if "__mode__" in preset_data:
            self.edit_temp_wp_mode = preset_data.pop("__mode__")
        if "__spanned__" in preset_data:
            self.edit_temp_spanned_enabled = preset_data.pop("__spanned__")
        if "__effect__" in preset_data:
            self.edit_temp_image_effect = preset_data.pop("__effect__")
        if "__effect_scope__" in preset_data:
            self.edit_temp_wp_scope = preset_data.pop("__effect_scope__")

        # Limpiar sesión de edición y cargar los monitores del preset
        self.edit_active_session.clear()
        self.edit_active_states.clear()

        try:
            for m_hash, entry in preset_data.items():
                if m_hash.startswith("__"):
                    continue
                if isinstance(entry, dict):
                    path = entry.get("path", "") or ""
                    active = entry.get("active", True)
                else:
                    path = entry if entry else ""
                    active = True
                self.edit_active_session[m_hash] = path
                self.edit_active_states[m_hash] = active
        except Exception as e:
            log_event(f"Fallo al procesar preset '{preset_name}': {e}", origin="BACKEND", level="ERROR", reason="BOOKMARK")
            return None

        log_event(f"Preset cargado para edición: {preset_name}", origin="BACKEND", level="DEBUG", reason="BOOKMARK")
        return preset_data

    def apply_edit_and_save(self, fav_checkbox_active, preset_name, monitor_hashes, get_path_func, get_active_func):
        """
        Aplica los cambios de edición al vault y guarda el preset si procede.

        Args:
            fav_checkbox_active (bool): Si el checkbox de favorito está activo.
            preset_name (str|None): Nombre del preset actual, o None si no hay.
            monitor_hashes (list): Lista de hashes de monitores visibles.
            get_path_func (callable): Función que recibe un hash y devuelve la ruta temporal.
            get_active_func (callable): Función que recibe un hash y devuelve el estado active.

        Returns:
            str|None: Mensaje de log para imprimir desde el panel.
        """
        # 1. Guardar cambios temporales en el vault
        try:
            edit_session = {h: get_path_func(h) for h in monitor_hashes}
            edit_states = {h: get_active_func(h) for h in monitor_hashes}
        except Exception as e:
            log_event(f"Fallo al construir datos de edición: {e}", origin="BACKEND", level="ERROR", reason="BOOKMARK")
            return None, None, None
        self.apply_edit_changes(edit_session, edit_states)

        # 2. Construir datos del preset
        bookmark_data = {}
        for m_hash in monitor_hashes:
            path = edit_session.get(m_hash, "")
            active = edit_states.get(m_hash, True)
            bookmark_data[m_hash] = {"path": path, "active": active}
        bookmark_data["__mode__"] = self.edit_temp_wp_mode
        bookmark_data["__spanned__"] = self.edit_temp_spanned_enabled
        bookmark_data["__effect__"] = self.edit_temp_image_effect
        bookmark_data["__effect_scope__"] = self.edit_temp_wp_scope

        # 3. Guardar preset si el checkbox está activo
        log_msg = None
        if fav_checkbox_active:
            if preset_name:
                self.ch.save_current_state_as_bookmark(preset_name, bookmark_data)
                log_msg = f"Preset actualizado: {preset_name}"
            else:
                preset_name = f"Bookmark {self.ch.get_next_bookmark_id():02d}"
                self.ch.save_current_state_as_bookmark(preset_name, bookmark_data)
                log_msg = f"Preset guardado: {preset_name}"

        # 4. Notificar al motor
        temp_settings = {
            "wallpaper_mode": self.edit_temp_wp_mode,
            "spanned_enabled": self.edit_temp_spanned_enabled,
            "wallpaper_effect": self.edit_temp_image_effect,
        }
        temp_settings = {k: v for k, v in temp_settings.items() if v is not None}
        # La notificación se hace desde panel.py porque usa self._notify_engine
        # Así que devolvemos los temp_settings para que el panel los envíe.

        log_event("Cambios de edición aplicados correctamente", origin="BACKEND", level="INFO", reason="BOOKMARK")
        return log_msg, temp_settings, preset_name

    def cancel_edit(self):
        """Limpia el estado del modo edición."""
        try:
            self.edit_mode_active = False
            self.edit_active_session.clear()
            self.edit_active_states.clear()
            self.edit_temp_wp_mode = None
            self.edit_temp_spanned_enabled = None
            self.edit_temp_image_effect = None
            self.edit_temp_wp_scope = None
        except Exception as e:
            log_event(f"Fallo al cancelar edición: {e}", origin="BACKEND", level="ERROR", reason="BOOKMARK")
