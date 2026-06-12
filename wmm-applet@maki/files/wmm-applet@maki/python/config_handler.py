#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM Applet - Cinnamon Edition
----------------------------
config_handler.py – Gestor de configuración y persistencia.
"""

# ==========================================================
# IMPORTS DE LIBRERÍA ESTÁNDAR
# ==========================================================
import os
import sys
import json
import hashlib
import random
import re
import time
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
gi.require_version('GLib', '2.0')
from gi.repository import GLib

# ==========================================================
# IMPORTS DE MÓDULOS DEL PROYECTO
# ==========================================================
from image_engine import ImageEngine
from wmm_platform.core import PlatformManager
from debug_logger import log_event
from i18n import _

class ConfigHandler:
    ...
    """
    Gestor de configuración y persistencia para WMM (Wallpaper Master Manager).
    Maneja la lectura/escritura de JSONs, el escaneo de bibliotecas y la
    normalización de rutas con soporte para caracteres especiales.
    """

    # Modos de ajuste disponibles para la interfaz
    ASPECT_MODES = {
        # "none": "No image",
        # "centered": "Centered",
        "fit": "Scaled",
        "zoom": "Zoom",
        "stretched": "Stretched"
    }
    COLOR_MODES = {
        "solid_color": "Solid color",
        "gradient_h": "Gradient H",
        "gradient_v": "Gradient V"
    }
    IMAGE_EFFECT = {
        "none" : "None",
        "sepia": "Sepia",
        "bw": "Black and White"
    }
    BACK_EFFECT = {
        "blur": "Blur effect",
        "color": "Color"
    }
    # ------------------------------------------------------------
    # Claves internas para motivos de ejecución (estables, no traducibles)
    # ------------------------------------------------------------
    REASON_HARDWARE  = "hardware_plug_unplug"
    REASON_SERVICE   = "service_startup"
    REASON_TIMER     = "timer_rotation"
    REASON_MANUAL    = "manual_next"
    REASON_SELECTION = "manual_selection"
    REASON_BOOKMARK  = "bookmark_load"

    EXECUTION_REASONS = {
        REASON_HARDWARE:  "Hardware Plug/Unplug",
        REASON_SERVICE:   "WMM Service",
        REASON_TIMER:     "Timer",
        REASON_MANUAL:    "manual_next_wallpaper",
        REASON_SELECTION: "manual_selection",
        REASON_BOOKMARK: "Bookmark Load"
    }

    RECONFIGURATION_REASONS = (REASON_HARDWARE,)
    ROTATION_REASONS = (REASON_TIMER, REASON_MANUAL, REASON_SELECTION)
    ASYNC_ROTATION_REASONS = (REASON_TIMER, REASON_MANUAL)

    # Órdenes externas (lo que envía el applet/panel en commands.json)
    CMD_UPDATE_TIMER    = "update_timer_settings"
    CMD_LOAD_BOOKMARK   = "load_bookmark"
    CMD_DELETE_BOOKMARK = "delete_bookmark"
    CMD_BOOKMARK_ADDED  = "bookmark_added"
    CMD_FORCE_ROTATION  = "force_rotation"
    CMD_SYNC_LIBRARY    = "sync_library"
    CMD_OPEN_PANEL      = "open_panel"
    CMD_APPLY_SELECTION = "apply_manual_selection"

    def __init__(self, cache_base_dir=None):
        """
        Inicializa el gestor de configuración.
        Define todas las rutas del proyecto, la caché y los archivos JSON.

        Args:
            cache_base_dir (str, optional): Ruta base para la caché, proporcionada
                                           por la plataforma (PlatformManager).
                                           Si es None, se usa un fallback local.
        """
        # ==========================================================
        # BLOQUE 1: RUTAS DEL PROYECTO (RELATIVAS AL SCRIPT)
        # ==========================================================
        # Estas rutas son independientes del SO y siempre apuntan
        # a la estructura interna del applet.
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.applet_root = os.path.dirname(self.base_dir)
        self.data_dir = os.path.join(self.applet_root, "data")

        # ==========================================================
        # BLOQUE 2: RUTAS DE CACHÉ (DEPENDIENTES DEL SO)
        # ==========================================================
        # La ruta base de caché la proporciona la plataforma.
        # En Linux: ~/.cache/wmm
        # En Windows: %LOCALAPPDATA%/wmm (cuando se implemente)
        # En macOS: ~/Library/Caches/wmm (cuando se implemente)
        # Si no se proporciona, se usa un fallback local dentro del proyecto.
        if cache_base_dir:
            self.cache_dir = cache_base_dir
        else:
            self.cache_dir = os.path.join(self.applet_root, "cache")

        # Rutas derivadas de la caché
        self.master_canvas = os.path.join(self.cache_dir, "wallpaper_master.jpg")
        self.thumbnails_dir = os.path.join(self.cache_dir, "thumbnails")

        # ==========================================================
        # BLOQUE 3: CONFIGURACIÓN DEL LOGGER CENTRALIZADO
        # ==========================================================
        # El debug_logger usa la misma ruta de caché que ConfigHandler.
        # Así, los logs se guardan siempre en el directorio correcto
        # independientemente del SO.
        from debug_logger import set_cache_dir
        set_cache_dir(self.cache_dir)

        # ==========================================================
        # BLOQUE 4: CONSTANTES DEL MOTOR
        # ==========================================================
        # Extensiones de imagen soportadas por WMM.
        self.img_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif')

        # ==========================================================
        # BLOQUE 5: MAPA DE ARCHIVOS JSON
        # ==========================================================
        # Centraliza las rutas de todos los archivos de persistencia.
        # Así, si en el futuro se cambia la ubicación de data/, solo
        # hay que modificar este diccionario.
        self.files = {
            "settings":          os.path.join(self.data_dir, "settings.json"),
            "mfg_codes":         os.path.join(self.data_dir, "monitor_mfg.json"),
            "cache":             os.path.join(self.data_dir, "image_cache.json"),
            "index":             os.path.join(self.data_dir, "scan_index.json"),
            "sources":           os.path.join(self.data_dir, "sources.json"),
            "vault":             os.path.join(self.data_dir, "monitor_vault.json"),
            "geometry":          os.path.join(self.data_dir, "geometry.json"),
            "history":           os.path.join(self.data_dir, "history.json"),
            "history_vault":     os.path.join(self.data_dir, "history_vault.json"),
            "history_presets":   os.path.join(self.data_dir, "history_presets.json"),
            "commands":          os.path.join(self.data_dir, "commands.json"),
            "bookmarks":         os.path.join(self.data_dir, "bookmarks.json"),
            "bookmarks_single":  os.path.join(self.data_dir, "bookmarks_single_list.json")
        }

        # ==========================================================
        # BLOQUE 6: INICIALIZACIÓN DE LA ESTRUCTURA
        # ==========================================================
        # Garantiza que todos los directorios y archivos JSON existan.
        # Si es la primera ejecución, los crea con valores por defecto.
        self.ensure_structure()

    def ensure_structure(self):
        """
        Garantiza la infraestructura de archivos del sistema.
        Migra las fuentes a su propio archivo y asegura el Vault Virtual como raíz.
        """
        os.makedirs(self.thumbnails_dir, exist_ok=True)
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.cache_dir, exist_ok=True)

        # --- MAPA DE INICIALIZACIÓN POR DEFECTO ---
        default_map = {
            "settings": {
                "global": {
                    "slideshow_enabled": True,
                    "slideshow_mode": "sync",
                    "slideshow_bookmark": False,
                    "slideshow_interval": 15,
                    "slideshow_max_interval": 60,
                    "wallpaper_mode": "fit",
                    "wallpaper_effect": "none",
                    "wallpaper_effect_scope": "blur",
                    "spanned_enabled": False,
                    "min_area_coverage": 0.60,
                    "transition_effect": "fade",
                    "persist_on_reboot": True,
                    "generate_on_login": True,
                    "color_mode": "solid_color",
                    "solid_color": "#000000",
                    "gradient_h": ["#000000", "#8D9797"],
                    "gradient_v": ["#000000", "#8D9797"],
                    "monitor_group_align": "START",
                }
            },
            "sources": {"sources": []},
            "vault": {
                "active_session": {},
                "history": {}
            },
            "history": {"last_update": 0, "history_log": []},
            "history_vault": {"last_update": 0, "log": []},
            "history_presets": {"last_update": 0, "log": []},
            "cache": {"folders": {}},
            "index": {},
            "commands": {},
            "bookmarks": {},
            "bookmarks_single": []
        }

        # --- BUCLE DE INICIALIZACIÓN ÚNICO ---
        for key, default_content in default_map.items():
            if not os.path.exists(self.files[key]):
                self.save_json(key, default_content)

        # --- BLOQUE DE MIGRACIÓN Y GESTIÓN DE FUENTES ---
        sources_data = self.load_json("sources")
        settings_data = self.load_json("settings")
        global_conf = settings_data.get("global", {})

        # 1. Migración: De settings.json -> sources.json
        # Extraemos la lista según tu JSON real
        legacy_sources = global_conf.get("sources", [])

        if legacy_sources and not sources_data.get("sources"):
            log_event("Migrando fuentes a sources.json", origin="CONFIG", level="INFO", reason="SETTINGS")
            for item in legacy_sources:
                # Extraemos la ruta: en tu JSON es un dict con clave "path"
                folder_path = item.get("path") if isinstance(item, dict) else item
                # Extraemos la recursividad (si existe en el dict, si no, True por defecto)
                is_recursive = item.get("recursive", True) if isinstance(item, dict) else True

                if not folder_path or not isinstance(folder_path, str):
                    continue

                # Evitar duplicados y añadir
                if not any(s.get("path") == folder_path for s in sources_data["sources"]):
                    sources_data["sources"].append({
                        "id": hashlib.md5(folder_path.encode()).hexdigest()[:8],
                        "name": os.path.basename(folder_path.rstrip(os.sep)) or folder_path,
                        "path": folder_path,
                        "type": "physical",
                        "locked": False,
                        "recursive": is_recursive
                    })

            # Limpieza del settings.json para no volver a migrar
            if "sources" in global_conf:
                del global_conf["sources"]
                self.save_json("settings", settings_data)

        # 2. Garantía del VAULT VIRTUAL (Siempre el primero por defecto)
        # Buscamos si ya existe por ID
        vault_exists = any(s.get("id") == "vault" for s in sources_data["sources"])

        if not vault_exists:
            vault_source = {
                "id": "vault",
                "name": "Favoritos",
                "path": "__vault__",
                "type": "virtual",
                "locked": True,
                "recursive": False
            }
            # Insertar en la posición 0 (Cabecera)
            sources_data["sources"].insert(0, vault_source)
            log_event("Fuente del sistema 'Vault' inicializada", origin="CONFIG", level="INFO", reason="VAULT")
        else:
            # Si existe pero no está el primero, podríamos reordenar aquí si fuera crítico
            pass

        self.save_json("sources", sources_data)
        # Sincronización final de metadatos al iniciar
        self.refresh_history_metadata()
        # --- VALIDACIÓN DE SINCRONIZACIÓN CRÍTICA ---
        #self.sync_bookmarks_flat_list()  <---- por el momento dejamos que la sincronización de favoritos sea un proceso "bajo demanda

    def get_mfg_map(self):
        """Carga el diccionario de códigos de fabricante."""
        return self.load_json("mfg_codes")

    def sync_vault(self, current_active_hashes):
        """
        Sincroniza el Vault y retorna True si ha habido cambios en la
        composición de monitores (altas o bajas).
        """
        vault = self.load_json("vault")
        active = vault.get("active_session", {})
        history = vault.get("history", {})

        has_changed = False
        new_active = {}

        # 1. Detectar si algún monitor activo ha desaparecido (Mover a History)
        for m_hash, data in active.items():
            # Migrar formato antiguo (string) a nuevo diccionario
            if isinstance(data, str):
                data = {"path": data if data else None, "active": True}
            if m_hash not in current_active_hashes:
                history[m_hash] = data       # guardar siempre, con o sin imagen
                has_changed = True
                log_event(f"Monitor {m_hash} movido a histórico", origin="CONFIG", level="DEBUG", reason="VAULT")

        # 2. Reconstruir la sesión activa con los hashes actuales
        for m_hash in current_active_hashes:
            if m_hash in active:
                entry = active[m_hash]
                # Migrar formato antiguo si es string
                if isinstance(entry, str):
                    entry = {"path": entry if entry else None, "active": True}
                new_active[m_hash] = entry
            elif m_hash in history:
                entry = history.pop(m_hash)
                if isinstance(entry, str):
                    entry = {"path": entry if entry else None, "active": True}
                new_active[m_hash] = entry
                has_changed = True
                log_event(f"Monitor {m_hash} recuperado del histórico", origin="CONFIG", level="DEBUG", reason="VAULT")
            else:
                # Nuevo monitor: sin imagen y activo por defecto
                new_active[m_hash] = {"path": None, "active": True}
                has_changed = True
                log_event(f"Nuevo monitor {m_hash} detectado", origin="CONFIG", level="INFO", reason="VAULT")

        if has_changed:
            vault["active_session"] = new_active
            log_event("Vault sincronizado con cambios", origin="CONFIG", level="DEBUG", reason="VAULT")
            vault["history"] = history
            self.save_json("vault", vault)

        return has_changed, vault

    def get_monitors_layout_data(self, area_w, area_h):
        """
        Devuelve una lista de diccionarios con los datos necesarios para pintar
        cada monitor virtual: hash, x, y, w, h, img_path.
        """
        geometry = self.load_json("geometry")
        if not geometry:
            return []

        monitors_map = geometry.get("monitors", {})
        if not monitors_map:
            return []

        vault = self.load_json("vault")
        active_session = vault.get("active_session", {})

        # Obtener coordenadas escaladas desde MonitorManager
        platform = PlatformManager()
        scaled = platform.scale_monitors_to_area(monitors_map, area_w, area_h)

        layout_data = []
        for m_hash, coords in scaled.items():
            entry = active_session.get(m_hash, "")
            if isinstance(entry, dict):
                img_path = entry.get("path") or ""
            else:
                img_path = entry if entry else ""
            layout_data.append({
                'hash': m_hash,
                'x': coords['x'],
                'y': coords['y'],
                'w': coords['w'],
                'h': coords['h'],
                'img_path': img_path
            })
        return layout_data

    def get_monitor_info(self, m_hash):
        """Devuelve la info completa de un monitor desde geometry.json."""
        geo = self.load_json("geometry")
        monitors = geo.get("monitors", {})
        return monitors.get(m_hash, {})

    def refresh_history_metadata(self):
        """
        Sincroniza los contadores de los padres en los metadatos de los hijos.
        Evita lecturas pesadas durante el ciclo de ejecución principal.
        """
        try:
            # 1. Presets (Sincronía con bookmarks.json)
            hist_p = self.load_json("history_presets")
            hist_p["parent_total"] = len(self.load_json("bookmarks"))
            self.save_json("history_presets", hist_p)

            # 2. Vault (Sincronía con la lista plana de favoritos)
            hist_v = self.load_json("history_vault")
            hist_v["parent_total"] = len(self.load_json("bookmarks_single"))
            self.save_json("history_vault", hist_v)

            # 3. General (Sincronía con la caché completa)
            hist_g = self.load_json("history")
            h, v = self._get_cache_totals(self.load_json("cache"))
            hist_g["parent_total"] = h + v
            self.save_json("history", hist_g)

        except Exception as e:
            log_event(f"Error en refresh_metadata: {e}", origin="CONFIG", level="ERROR", reason="LIBRARY")

    def update_monitor_image(self, m_hash, image_path):
        """Actualiza la asociación de imagen para un monitor específico en la sesión activa."""
        vault = self.load_json("vault")
        if m_hash in vault["active_session"]:
            # Asegurar el nuevo formato (diccionario con path y active)
            if isinstance(vault["active_session"][m_hash], str):
                vault["active_session"][m_hash] = {"path": vault["active_session"][m_hash], "active": True}
            vault["active_session"][m_hash]["path"] = image_path
            self.save_json("vault", vault)

    def load_json(self, key):
        """Lee un JSON con soporte para UTF-8."""
        if not os.path.exists(self.files[key]):
            return {}
        try:
            with open(self.files[key], 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, Exception) as e:
            log_event(f"Error cargando {key}: {e}", origin="CONFIG", level="ERROR", reason="SETTINGS")
            return {}

    def save_json(self, key, data):
        """Guarda datos en formato JSON con soporte para múltiples formatos compactos."""
        path = self.files.get(key)
        if not path: return

        try:
            with open(path, 'w', encoding='utf-8') as f:
                # Generamos el JSON estándar con indentación para procesar
                raw_json = json.dumps(data, indent=4, ensure_ascii=False)

                if key == "cache":
                    # Formato compacto para 3 elementos: ["ruta", w, h]
                    compact_json = re.sub(
                        r'\[\s+"([^"]+)",\s+(\d+),\s+(\d+)\s+\]',
                        r'["\1", \2, \3]',
                        raw_json
                    )
                    f.write(compact_json)

                elif key == "index":
                    # Formato compacto para el vigía: [timestamp, active]
                    # Captura: [ un número (entero o float), un booleano ]
                    compact_json = re.sub(
                        r'\[\s+([\d\.]+),\s+(true|false)\s+\]',
                        r'[\1, \2]',
                        raw_json
                    )
                    f.write(compact_json)

                elif key == "bookmarks_single":
                    # Formato compacto para 4 elementos: ["ruta", w, h, "orient"]
                    # Sherlock: Cazamos el trío V5 + el string de orientación
                    compact_json = re.sub(
                        r'\[\s+"([^"]+)",\s+(\d+),\s+(\d+),\s+"([^"]+)"\s+\]',
                        r'["\1", \2, \3, "\4"]',
                        raw_json
                    )
                    f.write(compact_json)

                elif key == "settings":
                    # Compactar los arrays de degradados para que ocupen una sola línea
                    compact_json = re.sub(
                        r'"gradient_h": \[\s+("[^"]*"),\s+("[^"]*")\s+\]',
                        r'"gradient_h": [\1, \2]',
                        raw_json
                    )
                    compact_json = re.sub(
                        r'"gradient_v": \[\s+("[^"]*"),\s+("[^"]*")\s+\]',
                        r'"gradient_v": [\1, \2]',
                        compact_json
                    )
                    f.write(compact_json)

                else:
                    # Settings, vault, geometry, etc. (Formato expandido estándar)
                    f.write(raw_json)

        except Exception as e:
            log_event(f"Error al guardar {key}: {e}", origin="CONFIG", level="ERROR", reason="SETTINGS")

        # --- PERSISTENCIA DE ESTADOS ---

    def update_source_recursive(self, path, state):
        """Actualiza el modo recursivo de una raíz en sources.json."""
        data = self.load_json("sources")
        for s in data.get("sources", []):
            if s.get("path") == path:
                s["recursive"] = state
                self.save_json("sources", data)
                return True
        return False

    def update_index_active_state(self, path, state):
        """Cambia el estado de activación en el índice sin perder el mtime."""
        index = self.load_json("index")
        if path in index:
            entry = index[path]
            mtime = entry[0] if isinstance(entry, list) else entry
            index[path] = [mtime, state]
            self.save_json("index", index)
            return True
        return False

    def toggle_all_children(self, parent_path, new_state):
        """Actualiza todos los hijos de una raíz en el scan_index."""
        index = self.load_json("index")
        changed = False

        # Normalización absoluta para evitar fallos con espacios o "/" finales
        root = os.path.abspath(parent_path)

        for path in index.keys():
            current_path = os.path.abspath(path)

            # Verificamos si es un hijo (está dentro de la carpeta pero no es la carpeta misma)
            if current_path.startswith(root) and current_path != root:
                if isinstance(index[path], list) and len(index[path]) > 1:
                    # Solo marcamos como cambiado si el estado es realmente distinto
                    if index[path][1] != new_state:
                        index[path][1] = new_state
                        changed = True

        if changed:
            self.save_json("index", index)
            log_event(f"Cambio masivo completado: {len(index)} entradas procesadas", origin="CONFIG", level="INFO", reason="SETTINGS")
            return True

        # Si llegamos aquí sin cambios, es que no había hijos o ya estaban en ese estado
        return False

    def sync_bookmarks_flat_list(self):
        """
        Actualiza la lista plana con las imágenes de los presets.
        No elimina las entradas existentes; solo añade las nuevas.
        """
        bookmarks = self.load_json("bookmarks")
        cache = self.load_json("cache")

        # 1. Mapa de linaje (rápido)
        lookup = {}
        for folder_data in cache.get("folders", {}).values():
            for img in folder_data.get("h", []): lookup[img[0]] = [img[1], img[2], "h"]
            for img in folder_data.get("v", []): lookup[img[0]] = [img[1], img[2], "v"]

        # 2. Cargar la lista actual para preservar entradas manuales
        current_list = self.load_json("bookmarks_single")
        existing_paths = {item[0] for item in current_list if item}

        # 3. Recorrer presets y añadir nuevas imágenes
        for bookmark_name, monitor_data in bookmarks.items():
            for monitor_id, path_entry in monitor_data.items():
                # Extraer el path real si es un diccionario (nuevo formato)
                if isinstance(path_entry, dict):
                    actual_path = path_entry.get("path", "") or ""
                else:
                    actual_path = path_entry if path_entry else ""

                if not actual_path or not os.path.exists(actual_path):
                    continue
                if actual_path in existing_paths:
                    continue

                info = lookup.get(actual_path)
                if info:
                    entry = [actual_path, info[0], info[1], info[2]]
                else:
                    try:
                        with Image.open(actual_path) as img:
                            w, h = img.size
                            orient = "h" if w >= h else "v"
                        entry = [actual_path, w, h, orient]
                    except:
                        continue

                current_list.append(entry)
                existing_paths.add(actual_path)

        self.save_json("bookmarks_single", current_list)
        # Metadatos se actualizan en refresh_history_metadata, no aquí

    def maintenance_flat_list(self):
        """
        Inspecciona 'bookmarks_single_list.json' y elimina entradas inexistentes.
        No depende de los presets, solo de la realidad del disco duro.
        """
        # Cargamos la lista plana usando su clave oficial
        flat_list = self.load_json("bookmarks_single")

        if not flat_list:
            return

        # Filtramos: Solo mantenemos lo que os.path.exists confirme
        new_list = [item for item in flat_list if item[0] and os.path.exists(item[0])]

        # Si el tamaño ha cambiado, es que había "paja"
        if len(new_list) != len(flat_list):
            num_removed = len(flat_list) - len(new_list)
            self.save_json("bookmarks_single", new_list)
            log_event(f"Limpieza: {num_removed} favoritos eliminados (no existen en disco)", origin="CONFIG", level="INFO", reason="BOOKMARK")
        else:
            log_event("Lista de favoritos verificada: sin huérfanos", origin="CONFIG", level="INFO", reason="BOOKMARK")

    def save_current_state_as_bookmark(self, bookmark_name, current_state):
        """
        Guarda la sesión actual y dispara automáticamente la sincronización plana.
        current_state: dict {m_hash: {"path": str, "active": bool}}.
        """
        try:
            bookmarks = self.load_json("bookmarks")
            bookmarks[bookmark_name] = current_state

            # Asegurar orden canónico: preferencias primero, luego monitores
            ordered = {}
            for pref in ("__mode__", "__spanned__", "__effect__", "__effect_scope__"):
                if pref in bookmarks[bookmark_name]:
                    ordered[pref] = bookmarks[bookmark_name][pref]
            for key in bookmarks[bookmark_name]:
                if not key.startswith("__"):
                    ordered[key] = bookmarks[bookmark_name][key]
            bookmarks[bookmark_name] = ordered

            self._cleanup_preset_data(bookmarks[bookmark_name])
            self.save_json("bookmarks", bookmarks)

            self.sync_bookmarks_flat_list()
            self.refresh_history_metadata()
            return True
        except Exception as e:
            log_event(f"Error al guardar favorito '{bookmark_name}': {e}", origin="CONFIG", level="ERROR", reason="BOOKMARK")
            return False

    def get_next_bookmark_id(self):
        """
        Busca el primer hueco disponible siguiendo el patrón 'Bookmark XX'.
        """
        try:
            data = self.load_json("bookmarks")
            if not data: return 1

            next_id = 1
            while True:
                candidate = f"Bookmark {next_id:02d}"
                if candidate not in data:
                    return next_id
                next_id += 1
        except:
            return 1

    def save_new_bookmark(self, name, session_data):
        """
        Validates the bookmark name and saves the current monitor session.
        session_data: dict {m_hash: {"path": str, "active": bool}}.
        Returns: (success: bool, error_code: str)
        """
        bookmarks = self.load_json("bookmarks")
        clean_name = name.strip()
        if not clean_name:
            return False, "EMPTY_NAME"
        if clean_name in bookmarks:
            return False, "DUPLICATE_NAME"
        try:
            bookmarks[clean_name] = session_data
            # Asegurar orden canónico: preferencias primero, luego monitores
            ordered = {}
            for pref in ("__mode__", "__spanned__", "__effect__", "__effect_scope__"):
                if pref in bookmarks[clean_name]:
                    ordered[pref] = bookmarks[clean_name][pref]
            for key in bookmarks[clean_name]:
                if not key.startswith("__"):
                    ordered[key] = bookmarks[clean_name][key]
            bookmarks[clean_name] = ordered

            self._cleanup_preset_data(bookmarks[clean_name])
            self.save_json("bookmarks", bookmarks)

            self.sync_bookmarks_flat_list()
            self.refresh_history_metadata()
            return True, "SUCCESS"
        except Exception as e:
            return False, f"ERROR: {str(e)}"
            log_event(f"Error al guardar bookmark: {e}", origin="CONFIG", level="ERROR", reason="BOOKMARK")

    def _cleanup_preset_data(self, preset_data):
        """
        Si el preset tiene __spanned__ = True, elimina todos los monitores
        excepto el principal (o el que tenga imagen) para no guardar duplicados.
        """
        if preset_data.get("__spanned__", False):
            # Buscar el monitor principal desde geometry.json
            geo = self.load_json("geometry")
            monitors = geo.get("monitors", {})
            primary_hash = None
            for h, info in monitors.items():
                if info.get("primary", False):
                    primary_hash = h
                    break
            # Si no hay principal, buscar el primer monitor con imagen
            if primary_hash is None:
                for h, entry in preset_data.items():
                    if h.startswith("__"):
                        continue
                    if isinstance(entry, dict) and entry.get("path", ""):
                        primary_hash = h
                        break
            # Si aun así no hay, dejar el primer monitor como principal
            if primary_hash is None:
                for h in preset_data:
                    if not h.startswith("__"):
                        primary_hash = h
                        break

            # Eliminar todos los monitores excepto el principal
            keys_to_remove = [h for h in preset_data if not h.startswith("__") and h != primary_hash]
            for h in keys_to_remove:
                del preset_data[h]

    def delete_bookmark(self, name):
        """
        Elimina un preset de bookmarks.json y actualiza la lista plana y metadatos.

        Args:
            name (str): Nombre del favorito a eliminar.

        Returns:
            bool: True si se eliminó correctamente, False si no existía.
        """
        bookmarks = self.load_json("bookmarks")
        if name in bookmarks:
            del bookmarks[name]
            self.save_json("bookmarks", bookmarks)
            # Sincronizar lista plana y metadatos
            self.sync_bookmarks_flat_list()
            self.refresh_history_metadata()
            return True
        return False

    def add_to_favorites(self, img_path):
        """Añade una imagen a la lista plana de favoritos (bookmarks_single_list.json)."""
        flat_list = self.load_json("bookmarks_single")
        if any(entry[0] == img_path for entry in flat_list):
            return False  # ya existe

        orient, w, h = ImageEngine.process_image(img_path)
        if orient is None:
            return False  # no se pudo procesar la imagen

        flat_list.append([img_path, w, h, orient])
        self.save_json("bookmarks_single", flat_list)
        self.refresh_history_metadata()
        return True

    def remove_from_favorites(self, img_path):
        """Elimina una imagen de la lista plana de favoritos (bookmarks_single_list.json)."""
        flat_list = self.load_json("bookmarks_single")
        new_list = [entry for entry in flat_list if entry[0] != img_path]
        if len(new_list) != len(flat_list):
            self.save_json("bookmarks_single", new_list)
            self.refresh_history_metadata()
            return True
        return False

        # --- ENTRADA DE MOTOR ---

    def _is_covered_by_any_recursive_source(self, path, sources_data):
        """
        Retorna True si el path está dentro de al menos una fuente
        física, recursiva y que no esté desactivada.
        """
        for source in sources_data:
            if source.get("type") != "physical":
                continue
            if not source.get("recursive", False):
                continue
            root = source.get("path", "")
            if not root:
                continue
            # Verificar si el path cuelga de esta raíz
            if path == root or path.startswith(root.rstrip(os.sep) + os.sep):
                return True
        return False

    def _is_path_active(self, img_path):
        """
        Retorna True si la imagen debe mostrarse en los thumbnails.
        - Si la carpeta contenedora está en el índice, obedece su campo 'active'.
        - Si no está en el índice, se muestra solo si está bajo una fuente recursiva activa.
        """
        index = self.load_json("index")
        container = os.path.dirname(img_path)
        check_path = container
        while check_path:
            if check_path in index:
                entry = index[check_path]
                active = entry[1] if isinstance(entry, list) and len(entry) > 1 else True
                return active
            parent = os.path.dirname(check_path)
            if parent == check_path:
                break
            check_path = parent
        # No está en el índice → verificar cobertura recursiva
        sources_data = self.load_json("sources").get("sources", [])
        return self._is_covered_by_any_recursive_source(container, sources_data)

    def sync_library(self, on_progress=None, on_folder=None):
        """
        Sincroniza la biblioteca física basándose en sources.json.
        Implementa discriminación por carpeta y poda de árbol recursiva.
        """
        # --- 1. CARGA DE INFRAESTRUCTURA ---
        sources_data = self.load_json("sources").get("sources", [])
        scan_index = self.load_json("index")  # Formato: {ruta: [mtime, active]}
        extensions = self.img_extensions
        # Mapa de carpetas que el motor DEBE tener en cuenta
        active_folders_mtime = {}
        if active_folders_mtime:
            log_event(f"active_folders_mtime keys = {list(active_folders_mtime.keys())}", origin="CONFIG", level="DEBUG", reason="LIBRARY")
        # --- 2. MAPEO DE REALIDAD FÍSICA Y PODA LÓGICA ---
        for source in sources_data:
            if source.get("type") != "physical" or not os.path.exists(source.get("path", "")):
                continue

            root_path = source.get("path")
            if not root_path or not os.path.exists(root_path):
                continue

            is_recursive = source.get("recursive", False)

            if is_recursive:
                for root, dirs, _ in os.walk(root_path):
                    # --- BISTURÍ: Inyección de novedad ---
                    # Si es totalmente nueva, nace en el índice lista para procesar
                    if root not in scan_index:
                        scan_index[root] = [0, True]

                    # Normalización por si venimos de versiones antiguas (mtime float simple)
                    idx_entry = scan_index[root]
                    if not isinstance(idx_entry, list):
                        idx_entry = [idx_entry, True]
                        scan_index[root] = idx_entry

                    folder_active = idx_entry[1]

                    if not folder_active:
                        # Si alguna fuente recursiva activa cubre esta carpeta, no podar
                        if not self._is_covered_by_any_recursive_source(root, sources_data):
                            dirs[:] = []
                        continue
                        # Si está cubierta, la consideramos activa

                    active_folders_mtime[root] = os.path.getmtime(root)
            else:
                # Fuente no recursiva: solo la raíz
                active_folders_mtime[root_path] = os.path.getmtime(root_path)

        # --- 3. DETECCIÓN DIFERENCIAL ---
        def needs_rescan(f, current_m):
            entry = scan_index.get(f, [0, True])
            if not isinstance(entry, list):
                return True
            old_mtime, old_active = entry[0], entry[1] if len(entry) > 1 else True
            # Si la carpeta está marcada como inactiva, NUNCA se reescanea (aunque el mtime cambie)
            if not old_active:
                return False
            # Si está activa y el mtime cambió, reescaneamos
            return old_mtime != current_m

        folders_to_rescan = [f for f, m in active_folders_mtime.items() if needs_rescan(f, m)]
        # Añadir carpetas activas que aún no tienen entrada en la caché (recién activadas)
        full_cache = self.load_json("cache")
        if "folders" not in full_cache:
            full_cache["folders"] = {}
        cached_folders = set(full_cache["folders"].keys())
        for f in active_folders_mtime:
            if f not in cached_folders and f not in folders_to_rescan:
                folders_to_rescan.append(f)

        # --- Carpetas a eliminar de la caché ---
        # Separamos las que han sido eliminadas (fuente ya no existe) de las
        # que simplemente están desactivadas (hijos inactivos).
        deleted_folders = []
        inactive_folders = []
        for f in scan_index:
            if f not in active_folders_mtime:
                entry = scan_index.get(f)
                is_inactive = isinstance(entry, list) and len(entry) > 1 and entry[1] is False
                if is_inactive:
                    inactive_folders.append(f)
                else:
                    deleted_folders.append(f)
            elif (
                isinstance(scan_index.get(f), list)
                and len(scan_index[f]) > 1
                and scan_index[f][1] is False
            ):
                inactive_folders.append(f)

        # Mantenimiento de Favoritos y Metadatos
        self.maintenance_flat_list()
        self.refresh_history_metadata()

        # Logs condicionados
        if deleted_folders:
            log_event(f"Carpetas eliminadas: {deleted_folders}", origin="CONFIG", level="DEBUG", reason="LIBRARY")
        if inactive_folders:
            log_event(f"Carpetas desactivadas: {inactive_folders}", origin="CONFIG", level="DEBUG", reason="LIBRARY")
        if active_folders_mtime:
            log_event(f"active_folders_mtime keys = {list(active_folders_mtime.keys())}", origin="CONFIG", level="DEBUG", reason="LIBRARY")

        # SALIDA RÁPIDA: Si nada ha cambiado
        if not folders_to_rescan and not deleted_folders:
            log_event("Biblioteca sincronizada. Sin cambios", origin="CONFIG", level="INFO", reason="LIBRARY")
            # Si estábamos en modo asíncrono, avisar al panel para que decremente el semáforo
            if on_progress:
                on_progress(0, 0)
            full_cache = self.load_json("cache")
            h, v = self._get_cache_totals(full_cache)
            return h, v, False, None

        # --- MODO ASÍNCRONO (si se solicita desde la UI) ---
        if on_progress and on_folder:
            self._async_state = {
                'folders_to_rescan': folders_to_rescan,
                'deleted_folders': deleted_folders,
                'full_cache': full_cache,
                'extensions': extensions,
                'scan_index': scan_index,
                'active_folders_mtime': active_folders_mtime,
                'stats': {"added_h": 0, "added_v": 0, "removed_h": 0, "removed_v": 0},
                'index': 0,
                'on_progress': on_progress,
                'on_folder': on_folder
            }
            GLib.idle_add(self._process_next_folder_async)
            return None  # Salida temporal, el resultado se comunicará por callback
        # --- FIN MODO ASÍNCRONO ---

        # --- 4. PROCESAMIENTO QUIRÚRGICO DE CAMBIOS ---
        full_cache = self.load_json("cache")
        if "folders" not in full_cache: full_cache = {"folders": {}}
        stats = {"added_h": 0, "added_v": 0, "removed_h": 0, "removed_v": 0}

        # A. Limpieza de carpetas eliminadas o desactivadas
        for f in deleted_folders:
            # 1. Poda del Caché: Se elimina siempre para no mostrar fotos "apagadas"
            if f in full_cache["folders"]:
                stats["removed_h"] += len(full_cache["folders"][f]['h'])
                stats["removed_v"] += len(full_cache["folders"][f]['v'])
                # Limpiar miniaturas asociadas antes de eliminar la carpeta de la caché
                log_event(f"Eliminando caché de carpeta inactiva: {f}", origin="CONFIG", level="DEBUG", reason="LIBRARY")
                self._delete_thumbnails_for_folder(full_cache["folders"][f])
                del full_cache["folders"][f]

            # 2. BISTURÍ EN EL ÍNDICE: Eliminar la entrada siempre que la carpeta
            #    no esté activa, independientemente de si existe en disco.
            del scan_index[f]
            log_event(f"Entrada de índice eliminada: {f}", origin="CONFIG", level="DEBUG", reason="LIBRARY")

        # B. Escaneo de carpetas modificadas
        if folders_to_rescan:
            log_event(f"Sincronizando {len(folders_to_rescan)} directorios", origin="CONFIG", level="INFO", reason="LIBRARY")

        for folder in folders_to_rescan:
            # Limpiar caché previo de la carpeta para actualizar estadísticas
            if folder in full_cache["folders"]:
                stats["removed_h"] += len(full_cache["folders"][folder]['h'])
                stats["removed_v"] += len(full_cache["folders"][folder]['v'])

            new_h, new_v = [], []
            try:
                for filename in os.listdir(folder):
                    if filename.lower().endswith(extensions):
                        f_path = os.path.join(folder, filename)
                        if os.path.isfile(f_path):
                            orient, w, h = self._process_image(f_path)
                            if orient == "h": new_h.append([f_path, w, h])
                            elif orient == "v": new_v.append([f_path, w, h])
                # Limpiar miniaturas antiguas antes de actualizar (por si se eliminaron imágenes externamente)
                if folder in full_cache["folders"]:
                    log_event(f"Limpiando miniaturas antes de reescaneo: {folder}", origin="CONFIG", level="DEBUG", reason="LIBRARY")
                    self._delete_thumbnails_for_folder(full_cache["folders"][folder])
                # Actualizar caché
                full_cache["folders"][folder] = {"h": new_h, "v": new_v}
                stats["added_h"] += len(new_h)
                stats["added_v"] += len(new_v)
                # Actualizar índice respetando su estado 'active'
                current_active = scan_index.get(folder, [0, True])[1] if isinstance(scan_index.get(folder), list) else True
                scan_index[folder] = [active_folders_mtime[folder], current_active]

            except (PermissionError, FileNotFoundError):
                continue

        # --- 5. PERSISTENCIA Y REPORTE ---
        self.save_json("cache", full_cache)
        self.save_json("index", scan_index)
        log_event(f"Índice guardado: {len(scan_index)} entradas", origin="CONFIG", level="DEBUG", reason="LIBRARY")

        detail_msg = self._notify_detailed_changes(stats, full_cache)  # Ahora devuelve el detalle o None
        h, v = self._get_cache_totals(full_cache)
        has_changes = any((
            stats["added_h"] > 0,
            stats["added_v"] > 0,
            stats["removed_h"] > 0,
            stats["removed_v"] > 0
        ))
        return h, v, has_changes, detail_msg

        log_event(f"cache folders keys = {list(full_cache.get('folders', {}).keys())}", origin="CONFIG", level="DEBUG", reason="LIBRARY")

        return self._get_cache_totals(full_cache)

    def _process_next_folder_async(self):
        """
        Procesa una carpeta de la lista de reescaneo.
        Al terminar, programa la siguiente o finaliza el proceso.
        """
        try:
            state = self._async_state
            i = state['index']
            folders = state['folders_to_rescan']
            full_cache = state['full_cache']
            stats = state['stats']
            scan_index = state['scan_index']

            # Si quedan carpetas, procesamos la siguiente
            if i < len(folders):
                folder = folders[i]
                # Notificar a la UI qué carpeta se está procesando
                state['on_folder'](folder)

                # Limpiar caché previo de la carpeta
                if folder in full_cache["folders"]:
                    stats["removed_h"] += len(full_cache["folders"][folder]['h'])
                    stats["removed_v"] += len(full_cache["folders"][folder]['v'])
                    self._delete_thumbnails_for_folder(full_cache["folders"][folder])

                new_h, new_v = [], []
                try:
                    for filename in os.listdir(folder):
                        if filename.lower().endswith(state['extensions']):
                            f_path = os.path.join(folder, filename)
                            if os.path.isfile(f_path):
                                orient, w, h = self._process_image(f_path)
                                if orient == "h":
                                    new_h.append([f_path, w, h])
                                elif orient == "v":
                                    new_v.append([f_path, w, h])

                    full_cache["folders"][folder] = {"h": new_h, "v": new_v}
                    stats["added_h"] += len(new_h)
                    stats["added_v"] += len(new_v)

                    # Actualizar índice respetando su estado 'active'
                    current_active = scan_index.get(folder, [0, True])[1] if isinstance(scan_index.get(folder), list) else True
                    scan_index[folder] = [state['active_folders_mtime'][folder], current_active]

                except (PermissionError, FileNotFoundError):
                    pass

                # Actualizar progreso
                state['on_progress'](i + 1, len(folders))

                # Preparar siguiente carpeta
                state['index'] = i + 1
                GLib.idle_add(self._process_next_folder_async)

            else:
                # --- TODAS LAS CARPETAS PROCESADAS ---
                # Fase de limpieza de carpetas eliminadas/desactivadas
                for f in state['deleted_folders']:
                    if f in full_cache["folders"]:
                        stats["removed_h"] += len(full_cache["folders"][f]['h'])
                        stats["removed_v"] += len(full_cache["folders"][f]['v'])
                        self._delete_thumbnails_for_folder(full_cache["folders"][f])
                        del full_cache["folders"][f]
                    if not os.path.exists(f):
                        del scan_index[f]

                # Persistencia final
                self.save_json("cache", full_cache)
                self.save_json("index", scan_index)
                self._notify_detailed_changes(stats, full_cache)

                # Notificar fin a la UI (current == total)
                state['on_progress'](len(folders), len(folders))

                # Limpiar estado temporal
                del self._async_state
                log_event(f"Escaneo asíncrono completado: {len(folders)} carpetas procesadas", origin="CONFIG", level="INFO", reason="LIBRARY")

        except Exception as e:
            log_event(f"Fallo en escaneo asíncrono: {e}", origin="CONFIG", level="ERROR", reason="LIBRARY")
            # Forzar el callback final para que el semáforo se destrabe
            if hasattr(self, '_async_state'):
                total = len(self._async_state.get('folders_to_rescan', []))
                if self._async_state.get('on_progress'):
                    self._async_state['on_progress'](total, total)

        return False  # Para que GLib.idle_add no repita

    # --- [SECCIÓN: GESTIÓN DE FUENTES] ---

    def add_source(self, name, path, recursive=False):
        """Añade una nueva fuente y sincroniza la biblioteca."""
        data = self.load_json("sources")
        # Accedemos a la lista interna para evitar el TypeError
        sources_list = data.get("sources", [])

        # Generar ID basado en la ruta (igual que en la migración)
        source_id = hashlib.md5(path.encode()).hexdigest()[:8]

        # Evitar duplicados por ruta o por ID
        if any(s.get('path') == path or s.get('id') == source_id for s in sources_list if isinstance(s, dict)):
            return False

        new_entry = {
            "id": source_id,
            "name": name,
            "path": path,
            "type": "physical",
            "locked": False,
            "recursive": recursive
        }

        sources_list.append(new_entry)
        data["sources"] = sources_list # Actualizamos el diccionario original
        self.save_json("sources", data) # Guardamos el objeto completo

        log_event(f"Fuente añadida: {name}", origin="CONFIG", level="INFO", reason="LIBRARY")
        # self.sync_library() # La sincronización ahora se hace asíncronamente desde el panel
        return True

    def remove_source(self, path):
        """Elimina una fuente, limpia su índice y sincroniza la biblioteca."""
        data = self.load_json("sources")
        sources_list = data.get("sources", [])

        original_count = len(sources_list)
        sources_list = [
            s for s in sources_list
            if not (s.get('path') == path and not s.get('locked', False))
        ]

        if len(sources_list) < original_count:
            data["sources"] = sources_list
            self.save_json("sources", data)

            # Limpiar el índice de la carpeta eliminada y sus subcarpetas
            index = self.load_json("index")
            prefix = path if path.endswith(os.sep) else path + os.sep
            keys_to_remove = [key for key in index if key == path or key.startswith(prefix)]
            for key in keys_to_remove:
                del index[key]
            self.save_json("index", index)

            log_event(f"Fuente eliminada: {path}", origin="CONFIG", level="INFO", reason="LIBRARY")
            self.sync_library()
            return True

        log_event(f"No se pudo eliminar la fuente: {path}", origin="CONFIG", level="WARN", reason="LIBRARY")
        return False

    def purge_folder_cache(self, folder_path):
        """
        Elimina de image_cache.json la entrada correspondiente a folder_path
        y borra todas las miniaturas asociadas. Retorna True si se eliminó algo.
        """
        cache = self.load_json("cache")
        if "folders" not in cache:
            return False
        if folder_path in cache["folders"]:
            # Borrar miniaturas antes de quitar la entrada
            deleted = self._delete_thumbnails_for_folder(cache["folders"][folder_path])
            del cache["folders"][folder_path]
            self.save_json("cache", cache)
            log_event(f"Carpeta purgada: {folder_path}", origin="CONFIG", level="INFO", reason="LIBRARY")
            return deleted
        return 0

    def get_children_state(self, parent_path):
        """
        Retorna el estado global de los hijos de parent_path:
        'all_active', 'all_inactive', o 'mixed'.
        """
        index = self.load_json("index")
        prefix = parent_path if parent_path.endswith(os.sep) else parent_path + os.sep
        has_active = False
        has_inactive = False
        for path, entry in index.items():
            if path.startswith(prefix) and path != parent_path:
                # entry puede ser lista [mtime, active] o solo mtime (float)
                if isinstance(entry, list) and len(entry) > 1:
                    active = entry[1]
                else:
                    active = True  # por defecto activo si no se especifica
                if active:
                    has_active = True
                else:
                    has_inactive = True
                if has_active and has_inactive:
                    return "mixed"
        if has_active and not has_inactive:
            return "all_active"
        elif has_inactive and not has_active:
            return "all_inactive"
        else:
            # Sin hijos, consideramos all_active para que "Desactivar" esté habilitada
            return "all_active"

    def _delete_thumbnails_for_folder(self, folder_data):
        """
        Elimina los archivos de miniatura de todas las imágenes de una carpeta.
        folder_data es el valor asociado a una clave en cache['folders'],
        por ejemplo: {'h': [['/ruta/img.jpg', 1920, 1080], ...], 'v': [...]}
        """
        thumb_dir = self.thumbnails_dir
        deleted_count = 0
        for orientation in ('h', 'v'):
            for img_entry in folder_data.get(orientation, []):
                img_path = img_entry[0]
                m = hashlib.md5(img_path.encode()).hexdigest()
                thumb_path = os.path.join(thumb_dir, f"{m}.jpg")
                if os.path.exists(thumb_path):
                    try:
                        os.remove(thumb_path)
                        deleted_count += 1
                    except OSError as e:
                        log_event(f"No se pudo eliminar miniatura {thumb_path}: {e}", origin="CONFIG", level="WARN", reason="LIBRARY")
        log_event(f"{deleted_count} miniaturas eliminadas", origin="CONFIG", level="INFO", reason="LIBRARY")
        return deleted_count

    def _cleanup_blur_thumbnails(self):
        """
        Elimina todas las miniaturas compuestas (blur_*.jpg) del directorio thumbnails.
        Se ejecuta solo al inicio de sesión para evitar acumulación.
        """
        thumb_dir = self.thumbnails_dir
        if not os.path.isdir(thumb_dir):
            return
        deleted = 0
        for fname in os.listdir(thumb_dir):
            if fname.startswith("blur_") and fname.endswith(".jpg"):
                fpath = os.path.join(thumb_dir, fname)
                try:
                    os.remove(fpath)
                    deleted += 1
                except OSError as e:
                    log_event(f"No se pudo eliminar miniatura blur {fpath}: {e}", origin="CONFIG", level="WARN", reason="LIBRARY")
        if deleted > 0:
            log_event(f"{deleted} miniaturas blur eliminadas al inicio", origin="CONFIG", level="INFO", reason="LIBRARY")

    # --- [SIGUIENTE SECCIÓN: HISTORIAL Y LOGS] ---

    def log_error(self, message, reason=None):
        """
        Registra un error en el archivo de log.
        Mantiene solo las últimas 10 entradas.
        """
        log_path = os.path.join(self.data_dir, "error_log.txt")
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        entry = f"[{timestamp}]"
        if reason:
            entry += f" [{reason}]"
        entry += f" {message}\n"

        # Leer entradas existentes
        lines = []
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as f:
                lines = f.readlines()

        # Añadir nueva entrada al principio
        lines.insert(0, entry)

        # Mantener solo las últimas 10
        lines = lines[:10]

        # Guardar
        with open(log_path, "w", encoding="utf-8") as f:
            f.writelines(lines)

    def _get_cache_totals(self, cache):
        """Helper para sumar totales del caché V5"""
        total_h = sum(len(d['h']) for d in cache.get("folders", {}).values())
        total_v = sum(len(d['v']) for d in cache.get("folders", {}).values())
        return total_h, total_v

    def get_flat_lists(self):
        """
        Extrae todas las imágenes del caché y las devuelve en dos listas planas (H y V).
        Cada elemento de la lista es: [ruta, ancho, alto].
        """
        full_cache = self.load_json("cache")
        h_list = []
        v_list = []

        for folder_data in full_cache.get("folders", {}).values():
            h_list.extend(folder_data.get("h", []))
            v_list.extend(folder_data.get("v", []))

        return h_list, v_list

    def _update_history(self, entry_id, mode="history"):
        """
        Registra una entrada en el historial aplicando 'Aleatoriedad Redonda':
        Si el ciclo está a punto de completarse, se vacía preventivamente para
        garantizar que el último elemento no se repita en el nuevo inicio.
        """
        # 1. Configuración de claves según el modo
        is_main = mode == "history"
        file_key = "history" if is_main else f"history_{mode}"
        log_key = "history_log" if is_main else "log"

        # 2. Carga y metadatos
        hist = self.load_json(file_key)
        log = hist.get(log_key, [])
        parent_total = hist.get("parent_total", 100)

        # 3. Lógica de la Escoba (Ciclo cerrado para colecciones pequeñas)
        # Si el log llegará al total con esta inserción, reseteamos el pool.
        if parent_total <= 100 and len(log) >= (parent_total - 1):
            log = []

        # 4. Gestión quirúrgica del log: evitar duplicados y mover al top
        if entry_id in log:
            log.remove(entry_id)

        log.insert(0, entry_id)

        # 5. Persistencia y actualización de timestamp
        limit = min(parent_total, 100)
        log_event(f"parent_total={parent_total}, limit={limit}, log_len antes={len(log)}", origin="CONFIG", level="DEBUG", reason="LIBRARY")
        hist.update({
            log_key: log[:limit],
            "last_update": time.time()
        })

        self.save_json(file_key, hist)

    def _filter_by_smart_ratio(self, candidates, m_w, m_h, orientation):
        """
        Filtra candidatos basándose en el ratio del monitor y la orientación.
        """
        final_candidates = []
        m_ratio = m_w / m_h

        for item in candidates:
            # Soportar tanto [path, w, h] como [path, w, h, orient]
            path, w, h = item[0], item[1], item[2]

            # 1. Filtro de Orientación Físico
            img_orient = "h" if w >= h else "v"
            if img_orient != orientation:
                continue

            # 2. Filtro de "Cuadratura" para monitores verticales (Ratio 1.0 Estricto)
            # No permitimos imágenes horizontales en monitores verticales.
            if orientation == "v":
                ratio = w / h
                if ratio > 1.0: # Si es horizontal (ancho > alto), descartar.
                    continue

            # 3. Filtro de Smart Ratio (evitar deformación excesiva)
            img_ratio = w / h
            diff = abs(img_ratio - m_ratio)

            if diff < 0.5:
                final_candidates.append(path)

        return final_candidates

    def get_vault_selection(self, orientation="h", exclude=None):
        """
        Selección inteligente del Vault evitando duplicados inmediatos
        y respetando el historial global.
        """
        exclude = exclude or [] # Rutas ya usadas en este ciclo por otros monitores
        vault_data = self.load_json("bookmarks_single")

        if not vault_data: return None

        # 1. Filtro: Misma orientación Y que no esté ya en pantalla
        pool = [img for img in vault_data if len(img) >= 4 and img[3] == orientation and img[0] not in exclude]

        # Si no hay de esa orientación (libres), buscamos cualquiera que no esté en pantalla
        if not pool:
            pool = [img for img in vault_data if img[0] not in exclude]

        # Si todo falla (caso extremo), usamos todo el vault
        if not pool: pool = vault_data

        # 2. Filtro Anti-Repetición (Historial Global)
        history = self.load_json("history_vault").get("log", [])
        log_event(f"history_len={len(history)}, vault_total={len(vault_data)}", origin="CONFIG", level="DEBUG")
        fresh_pool = [img for img in pool if img[0] not in history]

        selected_path = random.choice(fresh_pool)[0] if fresh_pool else random.choice(pool)[0]

        # Registramos para que no se repita pronto
        self._update_history(selected_path, mode="vault")
        return selected_path

    def get_smart_selection(self, target_w, target_h, orientation="h"):
        """Selección avanzada: Área V5 + Ratio Inteligente + Anti-repetición."""

        # 1. Obtener datos base
        h_list, v_list = self.get_flat_lists()
        history = self.load_json("history").get("history_log", [])
        log_event(f"history_len={len(history)}, total_h={len(h_list)}, total_v={len(v_list)}", origin="CONFIG", level="DEBUG", reason="LIBRARY")
        # 2. Intentar selección ideal (Misma orientación - Historial)
        candidates = v_list if orientation == "v" else h_list
        # En modo spanned (lienzo panorámico), usar todas las horizontales
        if orientation == "h" and target_w / target_h > 2.0:
            pool = [item[0] for item in candidates]  # todas las horizontales, sin filtro de ratio
        else:
            pool = self._filter_by_smart_ratio(candidates, target_w, target_h, orientation)
        log_event(f"candidates_total={len(candidates)}, after_filter={len(pool)}, target_ratio={target_w/target_h:.2f}", origin="CONFIG", level="DEBUG", reason="LIBRARY")
        # Quitamos lo que ya ha salido recientemente
        fresh_pool = [p for p in pool if p not in history]

        # 3. Fallback: Si no hay ideales, buscamos en la "otra" lista (solo para verticales)
        if not fresh_pool and orientation == "v":
            pool = self._filter_by_smart_ratio(h_list, target_w, target_h, "v")
            fresh_pool = [p for p in pool if p not in history]

        # 4. Resultado final (Bisturí aplicado aquí)
        selected = None
        if fresh_pool:
            selected = random.choice(fresh_pool)
        elif pool:
            selected = random.choice(pool)
        else:
            all_candidates = v_list + h_list
            if all_candidates: # Solo ejecutamos max si hay material
                selected = max(all_candidates, key=lambda x: x[1] * x[2])[0]
            else:
                # El abismo: no hay imágenes en ninguna lista
                return None

        # 5. Registrar en el historial solo si tenemos éxito
        if selected:
            self._update_history(selected)

        return selected

    def _process_image(self, path):
        """Delega en ImageEngine el procesado de la imagen."""
        return ImageEngine.process_image(path)

    def get_thumbnail(self, img_path, max_height=160, max_width=250):
        """Delega en ImageEngine la generación de miniaturas."""
        return ImageEngine.generate_thumbnail(img_path, max_height, max_width, thumb_dir=self.thumbnails_dir)

    def get_composite_thumbnail(self, img_path, target_w, target_h):
        """Delega en ImageEngine la generación de miniaturas compuestas con blur."""
        return ImageEngine.generate_composite_thumbnail(img_path, target_w, target_h, thumb_dir=self.thumbnails_dir)

    def open_in_file_manager(self, path):
        """
        Abre la ruta con la aplicación predeterminada del sistema.
        La comprobación de existencia y el manejo de errores se mantienen aquí.
        La ejecución se delega en PlatformManager.
        """
        try:
            if os.path.exists(path):
                platform = PlatformManager()
                platform.open_file(path)
                return True
            return False
        except Exception as e:
            log_event(f"No se pudo abrir archivo: {e}", origin="CONFIG", level="ERROR", reason="LIBRARY")
            return False

    def _notify_detailed_changes(self, stats, cache):
        """Construye un informe basado en entradas y salidas reales."""
        # Calculamos el movimiento total (Añadidas + Eliminadas)
        total_changes = sum(stats.values())

        # Si el movimiento es 0, salimos sin devolver nada
        if total_changes == 0:
            return None

        msg_lines = []

        # Bloque de Altas
        if stats["added_h"] > 0 or stats["added_v"] > 0:
            added = []
            if stats["added_h"] > 0: added.append(f"<b>+{stats['added_h']}</b> H")
            if stats["added_v"] > 0: added.append(f"<b>+{stats['added_v']}</b> V")
            msg_lines.append(_("New") + ": " + ' • '.join(added))

        # Bloque de Bajas
        if stats["removed_h"] > 0 or stats["removed_v"] > 0:
            removed = []
            if stats["removed_h"] > 0: removed.append(f"<b>-{stats['removed_h']}</b> H")
            if stats["removed_v"] > 0: removed.append(f"<b>-{stats['removed_v']}</b> V")
            msg_lines.append(_("Removed") + ": " + ' • '.join(removed))

        # Totales actuales para contexto
        total_h, total_v = self._get_cache_totals(cache)

        body = "\n".join(msg_lines)
        summary = "\n" + _("Total library") + ": {}H | {}V".format(total_h, total_v)

        # Devolvemos el texto completo para que otro método (main.py) lo use en la notificación
        return f"{body}\n{summary}"

    def _send_notification(self, reason, detail_msg, action=None, level="info"):
        """
        Motor de notificaciones con jerarquía visual automática.
        La lógica de construcción del mensaje se mantiene aquí.
        La ejecución se delega en PlatformManager para usar la implementación adecuada según el SO.
        Niveles:
          - 'info' (default): icon dialog-information
          - 'warn': icon dialog-warning
          - 'error': icon dialog-error
        """
        # 1. Mapa de jerarquía de iconos
        icon_map = {
            "info": "dialog-information-symbolic",
            "warn": "dialog-warning-symbolic",
            "error": "dialog-error-symbolic"
        }
        selected_icon = icon_map.get(level, "dialog-information")

        # 2. Construcción dinámica del cuerpo
        fixed_title = "WMM Wallpapers"
        lines = [f"<b>{reason}</b>"]
        if action:
            lines.append(_("Action") + ": " + action)
        lines.append(f"\n<i>{detail_msg}</i>")

        full_message = "\n".join(lines)

        # 3. Delegar la ejecución en PlatformManager
        try:
            platform = PlatformManager()
            platform.send_notification(fixed_title, full_message, selected_icon)
        except Exception as e:
            log_event(f"Error en notificación: {e}", origin="CONFIG", level="ERROR", reason="NOTIFY")

# --- DEBUGGER & DIAGNOSTIC MODE ---
if __name__ == "__main__":
    print("\n" + "═"*50)
    print("  WMM CONFIG HANDLER - SYSTEM CHECKUP")
    print("═"*50)

    handler = ConfigHandler()

    # 1. Rutas Críticas
    print(f"\n[PATH CHECK]")
    print(f"  Root:  {handler.applet_root}")
    print(f"  Data:  {handler.data_dir}")
    print(f"  Cache: {handler.cache_dir}")

    # 2. Integridad de Archivos JSON
    print(f"\n[JSON FILES]")
    for key, path in handler.files.items():
        status = "✔ OK" if os.path.exists(path) else "✘ MISSING"
        size = f"({os.path.getsize(path)} bytes)" if os.path.exists(path) else ""
        print(f"  {key.ljust(10)} {status.ljust(10)} {size}")

    # 3. Test de Lógica de Marcadores
    print(f"\n[BOOKMARKS LOGIC]")
    next_id = handler.get_next_bookmark_id()
    print(f"  Next suggested: Bookmark {next_id:02d}")

    # 4. Estado de la Biblioteca Global
    print(f"\n[LIBRARY OVERALL]")
    h_list, v_list = handler.get_flat_lists()
    print(f"  Total Horizontal: {len(h_list)}")
    print(f"  Total Vertical:   {len(v_list)}")

    # 5. SOURCES STAT (Desglose por carpetas)
    print(f"\n[SOURCES STAT]")
    settings = handler.load_json("settings")
    cache = handler.load_json("cache")

    # Accedemos a la lista de diccionarios
    sources_list = settings.get("global", {}).get("sources", [])

    if not sources_list:
        print("  (!) No sources defined in settings.json")
    else:
        for source_item in sources_list:
            # EXTRAEMOS LA RUTA (aquí estaba el fallo)
            path = source_item.get("path")

            if not path:
                continue

            # Ahora path es un string, os.path.exists funcionará
            exists = "✔" if os.path.exists(path) else "✘ NOT FOUND"

            # Buscamos en el caché
            #folder_data = cache.get("folders", {}).get(path, {"h": [], "v": []})
            #num_h = len(folder_data["h"])
            #num_v = len(folder_data["v"])

            # Formateamos la salida
            folder_name = os.path.basename(path) or path
            print(f"  [{exists}] {folder_name[:20].ljust(20)}") # | H: {str(num_h).ljust(4)} | V: {str(num_v).ljust(4)}")
            if exists == "✘ NOT FOUND":
                print(f"      └─ Path: {path}")

    print("\n" + "═"*50)
    print("  Diagnostic complete.")
    print("═"*50 + "\n")
