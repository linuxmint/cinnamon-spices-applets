"""
WMM - Platform Core
Lee settings_core.json, carga el módulo de plataforma adecuado
y expone sus funciones como propias.
"""
import os
import json
import importlib

def _read_ini(filepath):
    """Lee un archivo .ini y devuelve un diccionario con las claves y valores."""
    config = {}
    if not os.path.exists(filepath):
        return config
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # Ignorar comentarios y líneas vacías
            if not line or line.startswith('#') or line.startswith(';'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                config[key.strip()] = value.strip()
    return config

def _write_ini(filepath, config):
    """Escribe un diccionario en un archivo .ini."""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("# WMM Platform Configuration\n")
        for key, value in config.items():
            f.write(f"{key}={value}\n")

class PlatformManager:
    def __init__(self):
        """
        Constructor del núcleo de plataforma.
        Detecta el SO y el escritorio, carga los módulos adecuados y expone
        todas las funciones necesarias para que el motor funcione de forma
        agnóstica al sistema operativo.
        """
        # ----------------------------------------------------------
        # 0. CONFIGURACIÓN DE PLATAFORMA (settings_core.json)
        # ----------------------------------------------------------
        # _ensure_platform_config() garantiza que el archivo existe.
        # Si no existe (primera instalación desde Spices), lo crea
        # detectando el SO y el escritorio automáticamente.
        config = self._ensure_platform_config()

        self.platform = config['platform']
        self.desktop = config['desktop']
        self.app_domain = config.get('app_domain', 'wmm-applet@maki')
        self.applet_dir = config.get('applet_dir', '')
        self.data_base = config.get('data_base', '')
        self.cache_dir = config.get('cache_dir', '')
        self.locale_dir = config.get('locale_dir', '')
        platform_name = config['platform']
        desktop = config.get('desktop', '')

        # ----------------------------------------------------------
        # 1. CARGA DEL MÓDULO DEL SISTEMA OPERATIVO
        # ----------------------------------------------------------
        # Importa el módulo correspondiente al SO (linux.py, windows.py, mac.py).
        # Si no existe, usa 'generic' como fallback.
        # Este módulo contiene funciones COMUNES a todos los escritorios de ese SO.
        try:
            so_module = importlib.import_module(f'.{platform_name}', package='wmm_platform')
        except ImportError:
            so_module = importlib.import_module('.generic', package='wmm_platform')

        # ----------------------------------------------------------
        # 2. EXPOSICIÓN DE FUNCIONES COMUNES DEL SO
        # ----------------------------------------------------------
        # Estas funciones están disponibles en TODOS los escritorios
        # que se ejecuten sobre este SO. Se exponen como atributos
        # para que el motor pueda llamarlas sin saber en qué SO está.

        # Abrir archivos/carpetas con la aplicación predeterminada del SO
        self.open_file = so_module.open_file

        # Enviar notificaciones de escritorio nativas del SO
        self.send_notification = so_module.send_notification

        # Compilar archivos .po a .mo (solo si el SO lo soporta)
        # En Linux se usa msgfmt; en otros SO puede no estar disponible
        if hasattr(so_module, 'compile_translations'):
            self.compile_translations = so_module.compile_translations

        # Bloqueo de archivos para escritura atómica (logs, JSONs, etc.)
        # En Linux/macOS se usa fcntl.flock; en Windows, msvcrt.locking
        if hasattr(so_module, 'lock_file'):
            self.lock_file = so_module.lock_file
        if hasattr(so_module, 'unlock_file'):
            self.unlock_file = so_module.unlock_file

        # Instalar acciones de shell (Nemo, Nautilus, Dolphin) a nivel de SO
        if hasattr(so_module, 'ensure_shell_actions'):
            self.ensure_shell_actions = so_module.ensure_shell_actions

        # ----------------------------------------------------------
        # 3. FUNCIONES CON VALOR POR DEFECTO
        # ----------------------------------------------------------
        # Algunas funciones solo tienen sentido en ciertos escritorios/SO.
        # Se define un valor por defecto (normalmente no hacer nada)
        # que será sobrescrito si el SO o el escritorio lo implementan.

        # Instalar acciones de shell (menús contextuales de Nemo, Nautilus, Dolphin, etc.)
        # Por defecto, no hace nada. Solo Linux lo implementa por ahora.
        if not hasattr(so_module, 'ensure_shell_actions'):
            self.ensure_shell_actions = lambda applet_root, data_base: None
        # ----------------------------------------------------------
        # 4. CARGA DEL MÓDULO DEL ESCRITORIO (si existe)
        # ----------------------------------------------------------
        # Si se detectó un escritorio específico (cinnamon, gnome, kde...),
        # se carga su módulo y se SOBRESCRIBEN las funciones que el
        # escritorio implemente de forma diferente a la del SO base.
        if desktop:
            try:
                desktop_module = importlib.import_module(f'.{desktop}', package='wmm_platform')

                # Obtener la geometría de los monitores (Gdk, D-Bus, Win32...)
                if hasattr(desktop_module, 'get_monitors'):
                    self.get_monitors = desktop_module.get_monitors

                # Aplicar el fondo de pantalla (gsettings, plasma-apply-wallpaperimage...)
                if hasattr(desktop_module, 'set_wallpaper'):
                    self.set_wallpaper = desktop_module.set_wallpaper

                # El escritorio puede definir su propio dominio de traducciones
                # (ej: 'cinnamon' vs 'gnome-shell'). Sobrescribe el del SO.
                if hasattr(desktop_module, 'system_domain'):
                    self.system_domain = desktop_module.system_domain

                # El escritorio puede instalar sus propias acciones de shell
                # (Cinnamon instala las de Nemo, GNOME las de Nautilus, etc.)
                if hasattr(desktop_module, 'ensure_shell_actions'):
                    self.ensure_shell_actions = desktop_module.ensure_shell_actions

            except ImportError:
                # Si el módulo del escritorio no existe, se usan las funciones del SO base
                pass

        # ----------------------------------------------------------
        # 5. FUNCIONES DE CÁLCULO AGNÓSTICAS
        # ----------------------------------------------------------
        # Estas funciones no dependen del SO ni del escritorio.
        # Son cálculos matemáticos puros (geometría, escalado).
        # ----------------------------------------------------------

        from monitor_manager import scale_monitors_to_area, get_total_canvas_geometry
        self.scale_monitors_to_area = scale_monitors_to_area
        self.get_total_canvas_geometry = get_total_canvas_geometry

    def _ensure_platform_config(self, applet_root=None):
        """
        Lee o genera el archivo settings_core.ini y devuelve un
        diccionario con la configuración de plataforma.
        Delega toda la detección del entorno en los módulos de SO y escritorio.
        """
        import sys
        config_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings_core.ini')
        self._config_path = config_path

        # 1. Intentar leer el .ini existente
        config = _read_ini(config_path)
        if config:
            self._ini_was_generated = False  # El .ini ya existía, no es el primer arranque
            return config

        # 2. Si no existe, detectar el entorno delegando en los módulos

        # --- Plataforma (SO) ---
        raw_platform = sys.platform
        try:
            so_module = importlib.import_module(f'.{raw_platform}', package='wmm_platform')
            platform = so_module.normalize_platform(raw_platform)
            paths = so_module.get_system_paths()
            data_base = paths.get('data_base')
            cache_base = paths.get('cache_base')
            locale_dir = paths.get('locale_dir')
            desktop = so_module.detect_desktop()
            if hasattr(so_module, 'normalize_desktop'):
                desktop = so_module.normalize_desktop(desktop)
        except ImportError:
            platform = raw_platform
            data_base = None
            cache_base = None
            locale_dir = None
            desktop = 'generic'

        # --- Dominio de la app ---
        if applet_root is None:
            applet_root = os.path.dirname(os.path.dirname(__file__))
        app_domain = os.path.basename(applet_root)

        # --- Ruta de instalación (delegada al escritorio) ---
        try:
            desktop_module = importlib.import_module(f'.{desktop}', package='wmm_platform')
            applet_dir = desktop_module.get_install_path(data_base, app_domain)
        except ImportError:
            applet_dir = os.path.join(data_base or '', app_domain)

        # --- Ruta de caché ---
        cache_dir = os.path.join(cache_base or '', 'wmm')

        # 3. Construir el diccionario y guardarlo
        config = {
            'platform': platform,
            'desktop': desktop,
            'app_domain': app_domain,
            'applet_dir': applet_dir,
            'data_base': data_base or '',
            'cache_base': cache_base or '',
            'locale_dir': locale_dir or '',
            'cache_dir': cache_dir,
        }

        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        _write_ini(config_path, config)
        self._ini_was_generated = True  # Marcar que el .ini se generó en esta sesión

        return config

    def save_ini(self, config):
        """Persiste el diccionario de configuración en el archivo .ini."""
        _write_ini(self._config_path, config)
