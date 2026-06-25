#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM
----------------------------
main.py – Motor principal de WMM.

"""

# ==========================================================
# IMPORTS DE LIBRERÍA ESTÁNDAR
# ==========================================================
import os
import sys
import time
import random
import json
import atexit
import subprocess

# ==========================================================
# CONFIGURACIÓN DEL PATH DEL PROYECTO
# ==========================================================
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _PROJECT_ROOT)

# ==========================================================
# IMPORTS DE TERCEROS (GTK)
# ==========================================================
import gi
gi.require_version('Gdk', '3.0')
gi.require_version('Gio', '2.0')  # <--- AÑADIDO para Gio.FileMonitor
from gi.repository import Gdk, GLib, Gio  # <--- Añadido Gio

# ==========================================================
# IMPORTS DE MÓDULOS DEL PROYECTO
# ==========================================================
from wmm_platform.core import PlatformManager
from config_handler import ConfigHandler
from image_engine import ImageEngine
from debug_logger import log_event
from i18n import _, set_app_domain, set_locale_dir


class WMMDaemon:
    def __init__(self):
        # ----------------------------------------------------------
        # 1. INICIALIZAR LA PLATAFORMA
        # ----------------------------------------------------------
        self.platform = PlatformManager()

        # ----------------------------------------------------------
        # 1b. COMPLETAR EL .INI SI ES NECESARIO (antes de ConfigHandler)
        # ----------------------------------------------------------
        self._complete_ini_if_needed()

        # ----------------------------------------------------------
        # 2. CONFIGURAR EL SISTEMA DE TRADUCCIONES
        # ----------------------------------------------------------
        set_app_domain(self.platform.app_domain)
        set_locale_dir(self.platform.locale_dir)

        # ----------------------------------------------------------
        # 3. INICIALIZAR EL GESTOR DE CONFIGURACIÓN
        # ----------------------------------------------------------
        # ConfigHandler recibe la ruta de caché directamente desde PlatformManager
        self.ch = ConfigHandler(cache_base_dir=self.platform.cache_dir)

        # ----------------------------------------------------------
        # 4. INICIALIZAR EL RESTO DE COMPONENTES
        # ----------------------------------------------------------
        self.ie = ImageEngine(self.ch, None)  # None temporal hasta migrar MonitorManager
        self.loop = GLib.MainLoop()
        self.timer_id = None
        self.rotation_queue = []
        self.last_rotated_hash = None
        self.display = Gdk.Display.get_default()
        self._busy = False
        self._status_path = os.path.join(self.ch.cache_dir, "engine_status.json")
        # 1. Gestión del archivo PID
        self._manage_pid_file()

        # 2. Registro de limpieza al salir (DENTRO del __init__)
        atexit.register(self._cleanup_on_exit)

        # 3. Monitor de archivos para comunicación multiplataforma
        self._setup_command_monitor()

        if self.display:
            self.display.connect("monitor-added", self.on_hardware_change)
            self.display.connect("monitor-removed", self.on_hardware_change)

    def _setup_command_monitor(self):
        """
        Configura el Gio.FileMonitor sobre data/commands.json para escuchar
        comandos del applet, panel o scripts de integración.
        Sustituye al sistema de señales SIGUSR1 para ser 100% agnóstico.
        """
        commands_file = Gio.File.new_for_path(self.ch.files["commands"])
        self._command_monitor = commands_file.monitor_file(Gio.FileMonitorFlags.NONE, None)
        self._command_monitor.connect("changed", self._on_commands_file_changed)
        log_event("Monitor de commands.json iniciado. Esperando acciones...", origin="ENGINE", level="INFO", reason="COMMAND")

    def _on_commands_file_changed(self, monitor, file, other_file, event_type):
        """
        Callback asíncrono cuando el applet/panel escribe en commands.json.
        Filtra lecturas prematuras y evita bucles de eco (cuando el motor vacía el buzón).
        """
        try:
            # Micro-pausa para asegurar que el flush del disco terminó
            time.sleep(0.02)
            action_data = self.ch.load_json("commands")

            # Refuerzo anti-eco: si no hay acción, no hacemos nada
            if not action_data or "action" not in action_data:
                return

            order = action_data["action"]
            log_event(f"Comando recibido vía monitor: {order}", origin="ENGINE", level="DEBUG", reason="COMMAND")

            # Limpiamos el buzón (esto disparará otro evento, pero la condición de arriba lo parará)
            self.ch.save_json("commands", {})

            # --- DISPATCH DE LA ORDEN ---
            self._dispatch_command(order, action_data)

        except Exception as e:
            import traceback
            error_msg = f"Excepción leyendo commands.json (posible escritura a medias): {e}\n{traceback.format_exc()}"
            log_event(error_msg, origin="ENGINE", level="ERROR", reason="COMMAND")

    def _do_cycle_and_notify(self, reason, target_hashes, target_bookmark, temp_settings, event_dict):
        """
        Ejecuta el ciclo de rotación y, al terminar, notifica al panel.
        """
        log_event(f"Ejecutando ciclo: {reason}", origin="ENGINE", level="DEBUG", reason="COMMAND")
        self.execute_full_cycle(
            reason=reason,
            target_hashes=target_hashes,
            target_bookmark=target_bookmark,
            temp_settings=temp_settings
        )
        self._notify_panel(event_dict)
        return False  # Para GLib.idle_add

    def _set_busy_state(self, busy):
        self._busy = busy
        try:
            with open(self._status_path, "w") as f:
                json.dump({"busy": busy}, f)
        except Exception:
            pass

    def _notify_panel(self, event_dict):
        """
        Envía un evento al panel de control, si está abierto.
        El panel será notificado automáticamente por Gio.FileMonitor.

        Args:
            event_dict (dict): Diccionario con la acción y parámetros.
                               Ej: {"action": "wallpaper_changed"}
        """
        # Ya no necesitamos comprobar si el panel está vivo,
        # si el archivo se modifica y el panel no está, simplemente no pasa nada.
        command_path = os.path.join(self.ch.data_dir, "command_panel.json")
        try:
            with open(command_path, "w", encoding="utf-8") as f:
                json.dump(event_dict, f)
            log_event(f"Evento '{event_dict.get('action')}' enviado al panel", origin="ENGINE", level="DEBUG", reason="COMMAND")
        except Exception as e:
            log_event(f"Error al escribir command_panel.json: {e}", origin="ENGINE", level="ERROR", reason="COMMAND")

    def _cleanup_on_exit(self):
        """Borra el rastro del motor al cerrarse."""
        pid_path = os.path.join(self.ch.cache_dir, "pid_main.pid")
        if os.path.exists(pid_path):
            try:
                os.remove(pid_path)
                log_event("Archivo PID eliminado. Cierre limpio.", origin="ENGINE", level="INFO", reason="NOTIFY")
            except:
                pass

    def _manage_pid_file(self):
        """Crea el archivo PID y asegura su limpieza al cerrar."""
        pid_path = os.path.join(self.ch.cache_dir, "pid_main.pid")
        os.makedirs(os.path.dirname(pid_path), exist_ok=True)

        # Si el archivo existe, comprobamos si el proceso sigue vivo
        if os.path.exists(pid_path):
            try:
                with open(pid_path, "r") as f:
                    content = f.read().strip()
                    if content:
                        old_pid = int(content)
                        os.kill(old_pid, 0)
                        print(f" [!] El motor ya está corriendo (PID {old_pid}). Abortando.")
                        exit(1)
            except (OSError, ValueError):
                # Si el PID no existe o el archivo no tiene un número válido, seguimos
                pass

        # Escribimos el PID actual
        with open(pid_path, "w") as f:
            f.write(str(os.getpid()))

        # Registro de limpieza automática
        atexit.register(lambda: os.remove(pid_path) if os.path.exists(pid_path) else None)
        print(f" [SISTEMA] PID {os.getpid()} registrado en {pid_path}")

    def _dispatch_command(self, order, action_data):
        """
        Ejecuta la acción correspondiente basada en el comando recibido.
        (Antiguo _handle_sigusr1, extraído para separar la recepción de la ejecución)
        """
        # --- 1. ACTUALIZACIÓN DE SETTINGS ---
        if order == ConfigHandler.CMD_UPDATE_TIMER:
            settings = self.ch.load_json("settings")
            g = settings["global"]

            # Sincronización de variables desde el Applet
            g["slideshow_enabled"] = action_data.get("enabled", g["slideshow_enabled"])
            g["slideshow_interval"] = int(action_data.get("interval", g["slideshow_interval"]))
            g["slideshow_mode"] = action_data.get("mode", g["slideshow_mode"])
            g["slideshow_bookmark"] = action_data.get("slideshow_bookmark", g["slideshow_bookmark"])
            g["spanned_enabled"] = action_data.get("spanned_enabled", g.get("spanned_enabled", False))

            self.ch.save_json("settings", settings)
            GLib.idle_add(self._notify_panel, {"action": "settings_updated"})
            # Gestión del Temporizador
            GLib.idle_add(self.manage_timer, "start")

            log_event(
                f"Settings actualizados: enabled={g['slideshow_enabled']}, "
                f"interval={g['slideshow_interval']}, mode={g['slideshow_mode']}, "
                f"bookmark={g['slideshow_bookmark']}, spanned={g['spanned_enabled']}",
                origin="ENGINE", level="INFO", reason="SETTINGS"
            )

        # --- 2. CARGA DE FAVORITO ESPECÍFICO ---
        elif order == ConfigHandler.CMD_LOAD_BOOKMARK:
            name = action_data.get("name")

            # Soporte para apagar el timer si el favorito es una carga manual
            if action_data.get("timer_force_off"):
                settings = self.ch.load_json("settings")
                settings["global"]["slideshow_enabled"] = False
                self.ch.save_json("settings", settings)
                GLib.idle_add(self.manage_timer, "stop")
                log_event("Temporizador detenido por carga manual de favorito", origin="ENGINE", level="INFO", reason="TIMER")

            log_event(f"Cargando favorito: {name}", origin="ENGINE", level="INFO", reason="BOOKMARK")
            GLib.idle_add(
                self._do_cycle_and_notify,
                ConfigHandler.REASON_BOOKMARK,
                None,
                name,
                None,
                {"action": "wallpaper_changed"}
            )

        # --- 2.1 ELIMINACION DE FAVORITO ESPECÍFICO ---
        elif order == ConfigHandler.CMD_DELETE_BOOKMARK:
            name = action_data.get("name")
            if name:
                log_event(f"Eliminando favorito: {name}", origin="ENGINE", level="INFO", reason="BOOKMARK")
                if self.ch.delete_bookmark(name):
                    log_event(f"Favorito '{name}' eliminado correctamente", origin="ENGINE", level="INFO", reason="BOOKMARK")
                    self._notify_panel({"action": "bookmarks_updated"})
                    self.ch._send_notification(
                        reason=_("Favorite deleted"),
                        detail_msg=_("Preset") + " '" + name + "'\n" + _("deleted successfully."),
                        level="info"
                    )
                else:
                    log_event(f"No se pudo eliminar el favorito '{name}'", origin="ENGINE", level="ERROR", reason="BOOKMARK")

        # --- 3. ACCIONES MANUALES ---
        elif order == ConfigHandler.CMD_FORCE_ROTATION:
            log_event("Rotación manual solicitada (Click en Applet)", origin="ENGINE", level="INFO", reason="LIBRARY")
            GLib.idle_add(
                self._do_cycle_and_notify,
                ConfigHandler.REASON_MANUAL,
                None,
                None,
                None,
                {"action": "wallpaper_changed"}
            )

        # --- 4. MANTENIMIENTO ---
        elif order == ConfigHandler.CMD_SYNC_LIBRARY:
            log_event("Sincronizando biblioteca de imágenes...", origin="ENGINE", level="INFO", reason="LIBRARY")
            result = self.ch.sync_library()
            if result and len(result) == 4:
                total_h, total_v, has_changes, detail_msg = result
                if has_changes:
                    reason = _("Changes detected")
                else:
                    reason = _("No changes")
                log_event(f"Sincronización completada: {total_h}H / {total_v}V, cambios={has_changes}",
                          origin="ENGINE", level="INFO", reason="LIBRARY")
                body = f"{reason}\n{_('Total library') + ': {}H | {}V'.format(total_h, total_v)}"
                if detail_msg:
                    body = f"{detail_msg}\n{body}"
                self.ch._send_notification(
                    reason="WMM: " + _("Synchronization"),
                    detail_msg=body,
                    level="info"
                )

        # --- 5. ABRIR PANEL DE CONTROL ---
        elif order == ConfigHandler.CMD_OPEN_PANEL:
            log_event("Abriendo panel de control", origin="ENGINE", level="INFO", reason="COMMAND")
            panel_path = os.path.join(os.path.dirname(__file__), "panel.py")
            try:
                subprocess.Popen(
                    ["python3", panel_path],
                    start_new_session=True
                )
                log_event("Panel lanzado correctamente", origin="ENGINE", level="DEBUG", reason="COMMAND")
            except Exception as e:
                log_event(f"No se pudo abrir el panel: {e}", origin="ENGINE", level="ERROR", reason="COMMAND")

        # --- 6. APLICAR SELECCIÓN MANUAL ---
        elif order == ConfigHandler.CMD_APPLY_SELECTION:
            log_event("Aplicando selección manual desde el panel", origin="ENGINE", level="INFO", reason="COMMAND")
            temp_settings = action_data.get("temp_settings", None)
            GLib.idle_add(
                self._do_cycle_and_notify,
                ConfigHandler.REASON_SELECTION,
                None,
                None,
                temp_settings,
                {"action": "wallpaper_changed"}
            )

        # --- 7. Añadir PRESET desde add_bookmark.py ---
        elif order == ConfigHandler.CMD_BOOKMARK_ADDED:
            item_name = action_data.get("name", _("Unknown"))
            log_event(f"Nuevo preset añadido: {item_name}", origin="ENGINE", level="INFO", reason="BOOKMARK")
            self.ch._send_notification(
                reason=_("Favorite added"),
                detail_msg=item_name + "'\n" + _("added successfully."),
                level="info"
            )
            self._notify_panel({"action": "bookmarks_updated"})

        # --- 7b. Añadir IMAGEN SUELTA desde shell_add_bookmark.py ---
        elif order == ConfigHandler.CMD_SINGLE_FAVORITE_ADDED:
            item_name = action_data.get("name", _("Unknown"))
            log_event(f"Nueva imagen favorita añadida: {item_name}", origin="ENGINE", level="INFO", reason="BOOKMARK")
            self.ch._send_notification(
                reason=_("Favorite added"),
                detail_msg=item_name + "'\n" + _("added successfully."),
                level="info"
            )
            self._notify_panel({"action": "bookmarks_updated"})

        else:
            log_event(f"Orden desconocida recibida: {order}", origin="ENGINE", level="WARN", reason="COMMAND")

    def _timer_callback(self):
        """
        Callback del temporizador. Ejecuta un ciclo de rotación
        y notifica al panel.
        """
        log_event("Temporizador disparado: iniciando rotación", origin="ENGINE", level="DEBUG", reason="TIMER")
        self._do_cycle_and_notify(
            reason=ConfigHandler.REASON_TIMER,
            target_hashes=None,
            target_bookmark=None,
            temp_settings=None,
            event_dict={"action": "wallpaper_changed"}
        )
        return True

    def manage_timer(self, action="start"):
        """
        Gestiona el temporizador de rotación.
        - 'start': inicia o reinicia el temporizador según la configuración.
        - 'stop': detiene el temporizador si está activo.
        """
        if self.timer_id:
            GLib.source_remove(self.timer_id)
            self.timer_id = None

        if action == "stop":
            log_event("Temporizador detenido", origin="ENGINE", level="INFO", reason="TIMER")
            return

        # Acceder a la ruta real: global -> slideshow_...
        settings = self.ch.load_json("settings").get("global", {})
        enabled = settings.get("slideshow_enabled", True)
        interval_min = int(settings.get("slideshow_interval", 15))

        if enabled and interval_min > 0:
            self.timer_id = GLib.timeout_add_seconds(interval_min * 60, self._timer_callback)
            log_event(f"Temporizador activo: cada {interval_min} min", origin="ENGINE", level="INFO", reason="TIMER")
        else:
            log_event("Temporizador no iniciado (desactivado o intervalo inválido)", origin="ENGINE", level="INFO", reason="TIMER")

    def execute_full_cycle(self, reason=ConfigHandler.REASON_TIMER, target_hashes=None, target_bookmark=None, temp_settings=None):
        """
        Orquestador principal del cambio de fondo.
        Respeta el flujo de estabilización, gestión de hardware, lógica async
        e integra el soporte para favoritos y bookmarks específicos.
        """
        friendly_reason = ConfigHandler.EXECUTION_REASONS.get(reason, reason)
        log_event(f"Iniciando ciclo: {friendly_reason}", origin="ENGINE", level="INFO", reason="LIBRARY")

        if self._busy:
            log_event("Ciclo ignorado: motor ocupado", origin="ENGINE", level="DEBUG", reason="COMMAND")
            return
        self._set_busy_state(True)

        # 1. Estabilización de eventos GDK (Crítico para evitar desajustes)
        context = GLib.MainContext.default()
        while context.pending():
            context.iteration(False)

        # 2. Obtener la realidad actual del hardware
        platform = PlatformManager()
        monitors_map_real = platform.get_monitors()
        active_hashes = list(monitors_map_real.keys())

        # --- MODO SELECCIÓN MANUAL (aplicar lo que hay en el vault sin rotar) ---
        if reason == ConfigHandler.REASON_SELECTION:
            log_event("Modo selección manual: aplicando vault sin rotar", origin="ENGINE", level="DEBUG", reason="VAULT")
            self._handle_selection_mode(temp_settings, monitors_map_real, active_hashes)
            self._set_busy_state(False)
            return

        # --- GESTIÓN DE GEOMETRÍA ---
        if reason in ConfigHandler.RECONFIGURATION_REASONS:
            geo_snapshot, canvas_w, canvas_h = self._update_geometry(monitors_map_real, reason)
            monitors_map = monitors_map_real
        else:
            geo_snapshot = self.ch.load_json("geometry")
            monitors_map = geo_snapshot.get("monitors", monitors_map_real)
            canvas_w = geo_snapshot.get("canvas", {}).get("w", 0)
            canvas_h = geo_snapshot.get("canvas", {}).get("h", 0)

        monitors_map = geo_snapshot.get("monitors", {})

        # 3. Sincronización con el Vault (Estado persistente)
        _discard, vault = self.ch.sync_vault(active_hashes)
        active_session = vault.get("active_session", {})

        # 4. Carga de parámetros de usuario
        settings = self.ch.load_json("settings").get("global", {})
        color_mode = settings.get("color_mode", "solid_color")
        solid_color = settings.get("solid_color", "#000000")
        gradient_h = settings.get("gradient_h", ["#000000", "#8D9797"])
        gradient_v = settings.get("gradient_v", ["#000000", "#8D9797"])
        sl_mode = settings.get("slideshow_mode", "sync")
        wp_mode = settings.get("wallpaper_mode", "fit")
        fav_mode = settings.get("slideshow_bookmark", False)
        current_f_mode = sl_mode.lower()
        spanned_enabled = settings.get("spanned_enabled", False)
        wallpaper_effect_scope = settings.get("wallpaper_effect_scope", "blur")
        wallpaper_effect = settings.get("wallpaper_effect", "none")

        # El centinela: Controla si el motor encuentra material NUEVO o VÁLIDO en este ciclo
        valid_assets_found = False

        # --- LÓGICA ASYNC (Rotación por turnos) ---
        target_hashes = self._resolve_async_targets(reason, active_hashes, active_session, settings)

        # --- CONSTRUCCIÓN DE LA SELECCIÓN ---
        selection, valid_assets_found, spanned_enabled, wp_mode, wallpaper_effect, wallpaper_effect_scope, solid_color, color_mode, gradient_h, gradient_v = self._build_selection(
            reason, active_hashes, monitors_map, active_session, target_hashes, settings,
            target_bookmark=target_bookmark
        )

        # 5. Renderizado y Aplicación final
        # Si todos los monitores están inactivos, pintar el color de fondo global
        if not valid_assets_found and selection:
            log_event("Sin imágenes válidas. Aplicando color de fondo global.", origin="ENGINE", level="DEBUG", reason="LIBRARY")
            master_path = self.ie.render_master_wallpaper(
                selection,
                full_canvas=spanned_enabled,
                solid_color=solid_color,
                color_mode=color_mode,
                gradient_h=gradient_h,
                gradient_v=gradient_v,
                wallpaper_effect_scope=wallpaper_effect_scope,
                wallpaper_mode=wp_mode,
                image_effect=wallpaper_effect
            )
            self.platform.set_wallpaper(master_path, self.ch)

        elif valid_assets_found and selection:
            master_path = self.ie.render_master_wallpaper(
                selection,
                full_canvas=spanned_enabled,
                solid_color=solid_color,
                color_mode=color_mode,
                gradient_h=gradient_h,
                gradient_v=gradient_v,
                wallpaper_effect_scope=wallpaper_effect_scope,
                wallpaper_mode=wp_mode,
                image_effect=wallpaper_effect
            )
            self.platform.set_wallpaper(master_path, self.ch)
            log_event(f"Fondo aplicado: {len(selection)} monitores, spanned={spanned_enabled}", origin="ENGINE", level="INFO", reason="LIBRARY")

            # Aseguramos que el temporizador esté corriendo si no lo está
            if self.timer_id is None:
                self.manage_timer(action="start")
        else:
            # LA RED DE SEGURIDAD FINAL
            msg = _("Cycle aborted: not enough images available to complete selection.")
            log_event(msg, origin="ENGINE", level="WARN", reason="LIBRARY")
            self.ch._send_notification(
                reason=_("No images available"),
                action=_("Check status of Image Sources in Control Panel."),
                detail_msg=msg,
                level="error"
            )
            # Forzamos el inicio del timer para que reintente en el próximo intervalo
            if self.timer_id is None:
                self.manage_timer(action="start")
        self._set_busy_state(False)

    def _get_smart_favorite(self, m_hash, mode, target_orient, forced_bookmark=None, fname=None, exclude_paths=None):
        """
        Versión Definitiva V5: Respeta el Relleno Dinámico y gestiona imágenes desaparecidas.
        """
        exclude_paths = exclude_paths or [] # <--- PRESERVADO: El escudo anti-duplicados
        actual_settings = self.ch.load_json("settings")
        real_mode = actual_settings.get("global", {}).get("slideshow_mode", "async").lower()
        t_orient = target_orient[0].lower()

        # --- MODO SYNC O PRESET ESPECÍFICO ---
        if real_mode == "sync" or forced_bookmark:
            bookmarks = self.ch.load_json("bookmarks")
            if not forced_bookmark and bookmarks:
                forced_bookmark = random.choice(list(bookmarks.keys()))

            preset_data = bookmarks.get(forced_bookmark, {}) if forced_bookmark else {}
            path = preset_data.get(m_hash)

            # CASO A: La imagen no existe en el preset o el archivo ha sido borrado físicamente
            if not path or not os.path.exists(path):
                if path and not os.path.exists(path):
                    fname = os.path.basename(path)
                    # Aquí es donde lanzamos el aviso al sistema
                    msg = _("Image: '{image}' from preset: '{preset}' not found.").format(image=fname, preset=forced_bookmark)
                    print(f" [!] {msg}") # Consola
                    self.ch._send_notification(
                        reason=_("PRESET image not found"),
                        action=_("Assigning a random one"),
                        detail_msg=msg,
                        level="warn"
                    )
                # RELLENO DINÁMICO: Buscamos una alternativa que no esté ya en otro monitor
                path = self.ch.get_vault_selection(orientation=t_orient, exclude=exclude_paths)

            return path

        # --- MODO ASYNC ---
        else:
            # Rotación libre de favoritos evitando los que ya están en pantalla
            return self.ch.get_vault_selection(orientation=t_orient, exclude=exclude_paths)

    def on_hardware_change(self, display, monitor):
        """
        Callback cuando se conecta o desconecta un monitor.
        Reinicia el temporizador de estabilización con cada evento
        para garantizar que la sincronización se ejecute tras la calma.
        """
        log_event("Cambio físico de hardware detectado. Reiniciando temporizador de estabilización...",
                  origin="ENGINE", level="INFO", reason="HARDWARE")
        try:
            log_event(f"Evento hardware: conector={monitor.get_model()}, fabricante={monitor.get_manufacturer()}",
                      origin="ENGINE", level="DEBUG", reason="HARDWARE")
        except:
            pass

        # Cancelar temporizador anterior si existe
        if hasattr(self, '_reconfig_timer') and self._reconfig_timer:
            GLib.source_remove(self._reconfig_timer)

        # Programar un nuevo temporizador
        self._reconfig_timer = GLib.timeout_add(1500, self._final_hardware_sync)

    def _final_hardware_sync(self):
        """
        Ejecuta la sincronización final tras un cambio de hardware.
        Se llama tras el retardo programado en on_hardware_change.
        """
        # Limpiar el ID del temporizador para permitir futuros eventos
        self._reconfig_timer = None

        log_event("Ejecutando sincronización final de geometría", origin="ENGINE", level="INFO", reason="HARDWARE")
        self._do_cycle_and_notify(
            reason=ConfigHandler.REASON_HARDWARE,
            target_hashes=None,
            target_bookmark=None,
            temp_settings=None,
            event_dict={"action": "hardware_changed"}
        )
        return False

    def _handle_selection_mode(self, temp_settings, monitors_map_real, active_hashes):
        """
        Aplica la selección manual sin rotar (REASON_SELECTION).
        Carga las imágenes actuales del vault y las renderiza directamente.
        """
        log_event("Aplicando selección manual", origin="ENGINE", level="DEBUG", reason="LIBRARY")

        # Cargar la sesión activa del vault
        vault = self.ch.load_json("vault")
        active_session = vault.get("active_session", {})
        selection = {}

        # Leer los ajustes de color una sola vez
        settings = self.ch.load_json("settings").get("global", {})
        solid_color = settings.get("solid_color", "#000000")
        color_mode = settings.get("color_mode", "solid_color")
        gradient_h = settings.get("gradient_h", ["#000000", "#8D9797"])
        gradient_v = settings.get("gradient_v", ["#000000", "#8D9797"])
        wallpaper_effect_scope = settings.get("wallpaper_effect_scope", "blur")
        wallpaper_effect = temp_settings.get("wallpaper_effect", settings.get("wallpaper_effect", "none")) if temp_settings else settings.get("wallpaper_effect", "none")
        spanned_enabled = temp_settings.get("spanned_enabled", settings.get("spanned_enabled", False)) if temp_settings else settings.get("spanned_enabled", False)
        wp_mode = temp_settings.get("wallpaper_mode", settings.get("wallpaper_mode", "fit")) if temp_settings else settings.get("wallpaper_mode", "fit")

        for m_hash in active_hashes:
            entry = active_session.get(m_hash, {})
            if isinstance(entry, dict):
                path = entry.get("path")
                is_active = entry.get("active", True)
            else:
                path = entry if entry else None
                is_active = True

            if is_active:
                if path and os.path.exists(path):
                    selection[m_hash] = path
                    self.ch._update_history(path)
                else:
                    m = monitors_map_real.get(m_hash, {})
                    if m:
                        orient = m.get('orientation', 'horizontal')[0].lower()
                        new_path = self.ch.get_smart_selection(m.get('width', 1920), m.get('height', 1080), orientation=orient)
                        if new_path:
                            selection[m_hash] = new_path
                            self.ch.update_monitor_image(m_hash, new_path)
                            self.ch._update_history(new_path)
                        else:
                            selection[m_hash] = ("color", color_mode, solid_color, gradient_h, gradient_v)
                    else:
                        selection[m_hash] = ("color", color_mode, solid_color, gradient_h, gradient_v)
            else:
                selection[m_hash] = ("color", color_mode, solid_color, gradient_h, gradient_v)

        if selection:
            master_path = self.ie.render_master_wallpaper(
                selection,
                full_canvas=spanned_enabled,
                solid_color=solid_color,
                color_mode=color_mode,
                gradient_h=gradient_h,
                gradient_v=gradient_v,
                wallpaper_effect_scope=wallpaper_effect_scope,
                wallpaper_mode=wp_mode,
                image_effect=wallpaper_effect
            )
            self.platform.set_wallpaper(master_path, self.ch)
            log_event(f"Selección manual aplicada: {len(selection)} monitores", origin="ENGINE", level="INFO", reason="LIBRARY")
            if self.timer_id is None:
                self.manage_timer(action="start")
        else:
            log_event("Selección manual: no hay imágenes que aplicar", origin="ENGINE", level="WARN", reason="LIBRARY")

    def _resolve_async_targets(self, reason, active_hashes, active_session, settings):
        """
        Aplica la lógica de rotación asíncrona (async).
        Devuelve la lista de hashes objetivo (target_hashes) para este ciclo.
        """
        target_hashes = active_hashes[:]  # Copia inicial
        sl_mode = settings.get("slideshow_mode", "sync")

        if sl_mode == "async" and reason in ConfigHandler.ASYNC_ROTATION_REASONS:
            # Calcular qué monitores realmente tienen imagen (active:true)
            active_image_hashes = []
            for h in active_hashes:
                entry = active_session.get(h, {})
                if isinstance(entry, dict):
                    if entry.get("active", True):
                        active_image_hashes.append(h)
                else:
                    active_image_hashes.append(h)

            # Filtrar la cola actual para quitar monitores que ya no tienen imagen
            self.rotation_queue = [h for h in self.rotation_queue if h in active_image_hashes]

            # Si la cola quedó vacía o es inválida, reconstruirla
            invalid_queue = not set(self.rotation_queue).issubset(set(active_image_hashes))
            if not self.rotation_queue or invalid_queue:
                if not active_image_hashes:
                    target_hashes = []
                    self.rotation_queue = []
                    log_event("Modo Async: sin monitores activos con imagen", origin="ENGINE", level="DEBUG", reason="HARDWARE")
                else:
                    new_queue = list(active_image_hashes)
                    if len(new_queue) > 1:
                        while True:
                            random.shuffle(new_queue)
                            if new_queue[0] != self.last_rotated_hash:
                                break
                    else:
                        random.shuffle(new_queue)
                    self.rotation_queue = new_queue
                    target_hashes = [self.rotation_queue.pop(0)]
                    self.last_rotated_hash = target_hashes[0]
                    log_event(f"Modo Async: cola reconstruida, turno del monitor {target_hashes[0]}", origin="ENGINE", level="DEBUG", reason="HARDWARE")
            else:
                # La cola es válida y no está vacía: rotar normalmente
                target_hashes = [self.rotation_queue.pop(0)]
                self.last_rotated_hash = target_hashes[0]
                log_event(f"Modo Async: turno del monitor {target_hashes[0]}", origin="ENGINE", level="DEBUG", reason="HARDWARE")

        return target_hashes

    def _build_selection(self, reason, active_hashes, monitors_map, active_session, target_hashes,
                         settings, target_bookmark=None, preset_data=None):
        """
        Construye el diccionario 'selection' (monitor -> ruta de imagen).
        Devuelve (selection, valid_assets_found).
        """
        # Cargar parámetros de settings
        color_mode = settings.get("color_mode", "solid_color")
        solid_color = settings.get("solid_color", "#000000")
        gradient_h = settings.get("gradient_h", ["#000000", "#8D9797"])
        gradient_v = settings.get("gradient_v", ["#000000", "#8D9797"])
        sl_mode = settings.get("slideshow_mode", "sync")
        wp_mode = settings.get("wallpaper_mode", "fit")
        fav_mode = settings.get("slideshow_bookmark", False)
        current_f_mode = sl_mode.lower()
        spanned_enabled = settings.get("spanned_enabled", False)
        wallpaper_effect_scope = settings.get("wallpaper_effect_scope", "blur")
        wallpaper_effect = settings.get("wallpaper_effect", "none")

        selection = {}
        valid_assets_found = False

        # --- CONSTRUCCIÓN DE LA SELECCIÓN ---
        if reason in ConfigHandler.RECONFIGURATION_REASONS:
            # --- RECONFIGURACIÓN SIN ROTACIÓN (cambio de hardware o inicio) ---
            for m_hash in active_hashes:
                if m_hash not in monitors_map:
                    continue
                entry = active_session.get(m_hash, {})
                if isinstance(entry, dict):
                    path = entry.get("path")
                    is_active = entry.get("active", True)
                else:
                    path = entry if entry else None
                    is_active = True

                if not is_active:
                    selection[m_hash] = ("color", color_mode, solid_color, gradient_h, gradient_v)
                    continue

                if path and os.path.exists(path):
                    selection[m_hash] = path
                    self.ch._update_history(path)
                else:
                    m = monitors_map[m_hash]
                    orient = m.get('orientation', 'horizontal')[0].lower()
                    new_path = self.ch.get_smart_selection(m.get('width', 1920), m.get('height', 1080), orientation=orient)
                    if new_path:
                        selection[m_hash] = new_path
                        self.ch.update_monitor_image(m_hash, new_path)
                        self.ch._update_history(new_path)
                    else:
                        selection[m_hash] = ("color", color_mode, solid_color, gradient_h, gradient_v)
            valid_assets_found = bool(selection)
        else:
            # --- ROTACIÓN NORMAL ---
            target_preset = None
            preset_assigned_paths = []
            preset_wp_mode = None
            preset_spanned = None
            preset_effect_scope = None
            preset_effect = None

            # 1. Determinamos qué preset usar (Manual o Automático)
            if target_bookmark or (sl_mode == "sync" and fav_mode):
                bookmarks = self.ch.load_json("bookmarks")
                if target_bookmark:
                    target_preset = target_bookmark
                    log_event(f"Aplicando composición manual: '{target_preset}'", origin="ENGINE", level="INFO", reason="BOOKMARK")
                else:
                    if bookmarks:
                        presets_history = self.ch.load_json("history_presets").get("log", [])
                        available = [k for k in bookmarks if k not in presets_history]
                        if not available:
                            self.ch.save_json("history_presets", {
                                "last_update": time.time(),
                                "log": [],
                                "parent_total": len(bookmarks)
                            })
                            available = list(bookmarks.keys())
                        target_preset = random.choice(available)
                        log_event(f"Preset global elegido: {target_preset}", origin="ENGINE", level="DEBUG", reason="BOOKMARK")

                if target_preset:
                    bm_data = bookmarks.get(target_preset, {})
                    if not bm_data:
                        log_event(f"El favorito '{target_preset}' no existe en el JSON", origin="ENGINE", level="ERROR", reason="BOOKMARK")
                    else:
                        if "__mode__" in bm_data:
                            preset_wp_mode = bm_data.pop("__mode__")
                        if "__spanned__" in bm_data:
                            preset_spanned = bm_data.pop("__spanned__")
                        if "__effect_scope__" in bm_data:
                            preset_effect_scope = bm_data.pop("__effect_scope__")
                        if "__effect__" in bm_data:
                            preset_effect = bm_data.pop("__effect__")

                        for m_hash, val in list(bm_data.items()):
                            if m_hash.startswith("__"):
                                continue
                            if isinstance(val, str):
                                bm_data[m_hash] = {"path": val if val else "", "active": True}
                        self.ch._update_history(target_preset, mode="presets")
                        preset_assigned_paths = [v.get("path", "") for v in bm_data.values() if isinstance(v, dict) and v.get("path")]
                        target_preset_data = bm_data

            # Aplicar preferencias del preset
            if preset_wp_mode:
                wp_mode = preset_wp_mode
            if preset_spanned is not None:
                spanned_enabled = preset_spanned
            if preset_effect_scope:
                wallpaper_effect_scope = preset_effect_scope
            if preset_effect is not None:
                wallpaper_effect = preset_effect

            if spanned_enabled:
                # Caso A: Distribución sobre el lienzo completo (Spanned)
                # Obtener monitors_map_real de forma robusta:
                # 1. Geometría guardada (si existe y tiene datos)
                # 2. Hardware real (último recurso)
                geo_data = self.ch.load_json("geometry")
                monitors_map_real = geo_data.get("monitors", None) if geo_data else None
                if not monitors_map_real:
                    platform = PlatformManager()
                    monitors_map_real = platform.get_monitors()
                    log_event("Usando hardware real para monitors_map_real (fallback)", origin="MOTOR", level="DEBUG", reason="HARDWARE")
                canvas_w, canvas_h = self.platform.get_total_canvas_geometry(monitors_map_real)
                primary_hash = None
                for m_hash in active_hashes:
                    if monitors_map.get(m_hash, {}).get("primary", False):
                        primary_hash = m_hash
                        break
                if primary_hash is None:
                    primary_hash = active_hashes[0]

                entry = active_session.get(primary_hash)
                if isinstance(entry, dict):
                    current_path = entry.get("path")
                else:
                    current_path = entry

                if reason == ConfigHandler.REASON_HARDWARE and current_path and os.path.exists(current_path):
                    path = current_path
                else:
                    if target_bookmark:
                        path = preset_assigned_paths[0] if preset_assigned_paths else self._get_smart_favorite(primary_hash, "sync", "h", target_bookmark)
                    elif fav_mode:
                        path = self.ch.get_vault_selection(orientation="h")
                    else:
                        path = self.ch.get_smart_selection(canvas_w, canvas_h, orientation="h")

                if not path:
                    log_event("Spanned: Imposible encontrar imagen", origin="ENGINE", level="WARN", reason="LIBRARY")
                else:
                    selection = {primary_hash: path}
                    valid_assets_found = True
                    self.ch.update_monitor_image(primary_hash, path)
            else:
                # Caso B: Cada monitor con su imagen ajustada
                current_f_mode = sl_mode.lower()
                for m_hash in active_hashes:
                    if m_hash not in monitors_map:
                        continue
                    vault_entry = active_session.get(m_hash, {})
                    if isinstance(vault_entry, dict):
                        is_active = vault_entry.get("active", True)
                    else:
                        is_active = True

                    if not is_active:
                        selection[m_hash] = ("color", color_mode, solid_color, gradient_h, gradient_v)
                        continue
                    m = monitors_map[m_hash]
                    m_orient = m['orientation'][0].lower()
                    entry = active_session.get(m_hash)
                    if isinstance(entry, dict):
                        current_vault_path = entry.get("path")
                    else:
                        current_vault_path = entry

                    is_target = (m_hash in target_hashes) if reason in ConfigHandler.ASYNC_ROTATION_REASONS else True
                    img_path = None
                    if is_target and (target_preset or fav_mode):
                        if target_preset and m_hash in target_preset_data:
                            entry = target_preset_data[m_hash]
                            if not entry.get("active", True):
                                selection[m_hash] = ("color", color_mode, solid_color, gradient_h, gradient_v)
                                continue
                            elif entry.get("path"):
                                img_path = entry["path"]
                                if os.path.exists(img_path):
                                    selection[m_hash] = img_path
                                    self.ch.update_monitor_image(m_hash, img_path)
                                    valid_assets_found = True
                                    continue
                        img_path = self._get_smart_favorite(
                            m_hash, current_f_mode, m_orient,
                            forced_bookmark=target_preset,
                            exclude_paths=preset_assigned_paths
                        )
                    elif is_target:
                        img_path = self.ch.get_smart_selection(m['width'], m['height'], orientation=m_orient)

                    if img_path:
                        selection[m_hash] = img_path
                        self.ch.update_monitor_image(m_hash, img_path)
                        valid_assets_found = True
                    elif current_vault_path and os.path.exists(str(current_vault_path)):
                        selection[m_hash] = current_vault_path
                    else:
                        img_path = self.ch.get_smart_selection(m['width'], m['height'], orientation=m_orient)
                        if img_path:
                            selection[m_hash] = img_path
                            self.ch.update_monitor_image(m_hash, img_path)
                            valid_assets_found = True

        return selection, valid_assets_found, spanned_enabled, wp_mode, wallpaper_effect, wallpaper_effect_scope, solid_color, color_mode, gradient_h, gradient_v

    def _update_geometry(self, monitors_map_real, reason):
        """
        Calcula y guarda la geometría del lienzo maestro.
        Retorna una tupla (geo_snapshot, canvas_w, canvas_h).
        """
        canvas_w, canvas_h = self.platform.get_total_canvas_geometry(monitors_map_real)
        geo_snapshot = {
            "timestamp": time.time(),
            "canvas": {"w": canvas_w, "h": canvas_h},
            "monitors": monitors_map_real
        }
        log_event(f"Guardando geometría en JSON: {len(geo_snapshot['monitors'])} monitores, canvas={geo_snapshot['canvas']}", origin="ENGINE", level="DEBUG", reason="HARDWARE")
        self.ch.save_json("geometry", geo_snapshot)
        # Verificación de guardado
        saved_check = self.ch.load_json("geometry")
        if saved_check.get("monitors") != geo_snapshot["monitors"]:
            log_event("¡ALERTA! Discrepancia justo después de guardar geometry.json", origin="ENGINE", level="ERROR", reason="HARDWARE")
        else:
            log_event("Verificación de guardado de geometry.json exitosa", origin="ENGINE", level="DEBUG", reason="HARDWARE")
        log_event(f"Geometría actualizada por {reason}: {canvas_w}x{canvas_h}", origin="ENGINE", level="INFO", reason="HARDWARE")
        return geo_snapshot, canvas_w, canvas_h
    def startup_sync(self):
        """
        Sincronización inicial de geometría y vault.
        Garantiza que geometry.json existe y refleja la realidad actual.
        Devuelve True si el vault o la geometría han cambiado.
        """
        log_event("Sincronizando geometría inicial...", origin="ENGINE", level="INFO")

        # 1. Obtener la realidad actual del hardware
        platform = PlatformManager()
        monitors_map_real = platform.get_monitors()

        # 2. Guardar la geometría actual (crea el archivo si no existe)
        self._update_geometry(monitors_map_real, ConfigHandler.REASON_SERVICE)

        # Registrar si el archivo de geometría no existía (primer arranque o archivo borrado)
        if not self.ch.load_json("geometry"):
            log_event("Geometría inicial creada (no existía)", origin="ENGINE", level="INFO", reason="HARDWARE")

        # 3. Sincronizar el vault con los monitores detectados
        active_hashes = list(monitors_map_real.keys())
        vault_changed, _ = self.ch.sync_vault(active_hashes)

        if vault_changed:
            log_event("Vault sincronizado con la geometría actual", origin="ENGINE", level="INFO")
            return True

        # 4. Verificar si la geometría guardada difiere de la real
        saved_monitors = self.ch.load_json("geometry").get("monitors", {})
        if set(active_hashes) != set(saved_monitors.keys()):
            log_event("Cambio de geometría detectado", origin="ENGINE", level="INFO", reason="HARDWARE")
            return True

        log_event("Geometría sin cambios. Se mantiene el fondo actual.", origin="ENGINE", level="DEBUG", reason="SETTINGS")
        return False

    def run(self):
        """
        Punto de entrada principal del motor.
        Sincroniza la biblioteca, verifica la geometría y lanza el bucle GLib.
        """
        # ----------------------------------------------------------
        # 1. LIMPIEZA Y SINCRONIZACIÓN INICIAL
        # ----------------------------------------------------------
        self.ch._cleanup_blur_thumbnails()
        log_event("ENGINE iniciado", origin="ENGINE", level="INFO", reason="NOTIFY")
        log_event(f"[DIAG] Engine: platform.cache_dir={self.platform.cache_dir!r}, platform.locale_dir={self.platform.locale_dir!r}", origin="ENGINE", level="DEBUG", reason="SETTINGS")
        # Configuración post-instalación si el .ini está incompleto
        required_keys = ['platform', 'desktop', 'app_domain', 'data_base', 'cache_base', 'cache_dir', 'locale_dir', 'applet_dir']
        config = self.platform._ensure_platform_config()

        if not all(config.get(key) for key in required_keys):
            log_event("Archivo settings_core.ini incompleto. Iniciando post-instalación para completarlo.",
                      origin="ENGINE", level="INFO", reason="SETTINGS")
            self._post_install_setup()

        try:
            result = self.ch.sync_library()
            if result and len(result) >= 3:
                h, v = result[0], result[1]
                log_event(f"Biblioteca sincronizada: {h}H / {v}V", origin="ENGINE", level="INFO", reason="LIBRARY")
            else:
                log_event("Biblioteca: No se pudo obtener el total", origin="ENGINE", level="WARN", reason="LIBRARY")
        except Exception as e:
            log_event(f"Error en escaneo inicial: {e}", origin="ENGINE", level="ERROR", reason="LIBRARY")

        # Asegurar que las acciones del shell están instaladas
        self.platform.ensure_shell_actions(self.ch.applet_root, self.platform.data_base)
        # Asegurar que las traducciones están compiladas
        self._ensure_translations()

        # ----------------------------------------------------------
        # 2. DECISIÓN SOBRE LA PERSISTENCIA DEL FONDO
        # ----------------------------------------------------------
        settings = self.ch.load_json("settings").get("global", {})
        persist = settings.get("persist_on_reboot", True)
        log_event(f"Valor de persist_on_reboot: {persist}", origin="ENGINE", level="DEBUG", reason="SETTINGS")

        # Sincronizar geometría y vault (startup_sync ahora hace todo el trabajo)
        needs_cycle = self.startup_sync()

        if not persist:
            # El usuario quiere cambiar el fondo al iniciar
            log_event("Persistencia desactivada. Generando nuevo fondo.", origin="ENGINE", level="INFO", reason="SETTINGS")
            self.execute_full_cycle(reason=ConfigHandler.REASON_SERVICE)
        elif needs_cycle:
            # El hardware ha cambiado: regenerar
            log_event("Cambio de hardware detectado. Regenerando fondo...", origin="ENGINE", level="INFO", reason="HARDWARE")
            self.execute_full_cycle(reason=ConfigHandler.REASON_HARDWARE)
        # else: ni persistencia desactivada ni cambios de hardware -> mantener fondo

        # ----------------------------------------------------------
        # 3. BUCLE PRINCIPAL
        # ----------------------------------------------------------
        try:
            self.loop.run()
        except (KeyboardInterrupt, SystemExit):
            log_event("Cerrando motor...", origin="ENGINE", level="INFO", reason="NOTIFY")
            self.manage_timer(action="stop")
            self.loop.quit()

    def _ensure_translations(self):
        """
        Asegura que las traducciones estén compiladas.
        Delega en la capa de plataforma, que sabe cómo hacerlo en cada SO.
        """
        if hasattr(self.platform, 'compile_translations'):
            log_event(f"[DIAG] _ensure_translations: locale_dir={self.platform.locale_dir!r}", origin="ENGINE", level="DEBUG", reason="SETTINGS")
            self.platform.compile_translations(
                self.ch.applet_root,
                self.platform.locale_dir,
                self.platform.app_domain
            )

    def _complete_ini_if_needed(self):
        """
        Completa el .ini con las claves derivadas si está incompleto.
        Se ejecuta antes de crear ConfigHandler para que las rutas sean correctas.
        """
        required_keys = ['platform', 'desktop', 'app_domain', 'data_base', 'cache_base', 'cache_dir', 'locale_dir', 'applet_dir']
        config = self.platform._ensure_platform_config()
        if not all(config.get(key) for key in required_keys):
            updated = False
            if not config.get('cache_dir'):
                config['cache_dir'] = os.path.join(config['cache_base'], 'wmm')
                updated = True
            if not config.get('locale_dir'):
                config['locale_dir'] = os.path.join(config['data_base'], 'locale')
                updated = True
            if not config.get('applet_dir'):
                applet_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                config['applet_dir'] = applet_root
                updated = True
            if updated:
                self.platform.save_ini(config)
                log_event("Archivo settings_core.ini completado con claves derivadas", origin="ENGINE", level="INFO", reason="SETTINGS")
                # Actualizar los atributos de la plataforma con los nuevos valores
                self.platform.cache_dir = config['cache_dir']
                self.platform.locale_dir = config['locale_dir']
                self.platform.applet_dir = config['applet_dir']

    def _post_install_setup(self):
        """
        Ejecuta tareas de configuración inicial tras completar el .ini por primera vez.
        Se encarga de instalar las acciones de shell (Nemo, Nautilus, etc.)
        y de compilar las traducciones.
        """
        log_event("Primer arranque detectado. Ejecutando configuración post-instalación...", origin="ENGINE", level="INFO", reason="SETTINGS")

        # 1. Instalar scripts de shell (Nemo, Nautilus, etc.)
        if hasattr(self.platform, 'ensure_shell_actions'):
            self.platform.ensure_shell_actions(self.ch.applet_root, self.platform.data_base)
            log_event("Scripts de shell instalados correctamente", origin="ENGINE", level="INFO", reason="SETTINGS")

        # 2. Compilar traducciones
        self._ensure_translations()
        log_event("Configuración post-instalación completada", origin="ENGINE", level="INFO", reason="SETTINGS")

if __name__ == "__main__":
    daemon = WMMDaemon()
    daemon.run()
