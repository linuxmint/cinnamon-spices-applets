"""
WMM - Platform Core
Lee settings_core.json, carga el módulo de plataforma adecuado
y expone sus funciones como propias.
"""
import os
import json
import importlib

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

        platform_name = config['platform']   # 'linux', 'windows', 'darwin'
        desktop = config.get('desktop', '')   # 'cinnamon', 'kde', 'gnome', etc.

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

        # Configurar el sistema de traducciones (rutas, dominios)
        self.setup_translations = so_module.setup_translations

        # Enviar notificaciones de escritorio nativas del SO
        self.send_notification = so_module.send_notification

        # Dominio del sistema para heredar traducciones (ej: 'cinnamon', 'gnome-shell')
        # Si el SO no define uno, se usa None (solo traducciones propias de WMM)
        if hasattr(so_module, 'system_domain'):
            self.system_domain = so_module.system_domain
        else:
            self.system_domain = None

        # Función de traducción _() proporcionada por el SO (si existe)
        # Normalmente se usa la de i18n.py, pero el SO puede sobrescribirla
        if hasattr(so_module, '_'):
            self._ = so_module._

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

        # Obtener la ruta de caché del sistema operativo
        if hasattr(so_module, 'get_cache_dir'):
            self.get_cache_dir = so_module.get_cache_dir
        else:
            self.get_cache_dir = None

        # ----------------------------------------------------------
        # 3. FUNCIONES CON VALOR POR DEFECTO
        # ----------------------------------------------------------
        # Algunas funciones solo tienen sentido en ciertos escritorios.
        # Se define un valor por defecto (normalmente no hacer nada)
        # que será sobrescrito si el escritorio lo implementa.

        # Instalar acciones de shell (menús contextuales de Nemo, Nautilus, etc.)
        # Por defecto, no hace nada. Solo Cinnamon lo implementa por ahora.
        self.ensure_shell_actions = lambda applet_root: None

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
        from monitor_manager import scale_monitors_to_area, get_total_canvas_geometry
        self.scale_monitors_to_area = scale_monitors_to_area
        self.get_total_canvas_geometry = get_total_canvas_geometry

    def _ensure_platform_config(self):
        """
        Genera el archivo settings_core.json si no existe y devuelve
        la configuración de plataforma. Garantiza que el archivo esté
        siempre disponible sin depender del instalador.
        """
        import sys
        config_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'settings_core.json')

        if not os.path.exists(config_path):
            from wmm_platform.setup_core import _detect_linux_desktop
            platform = sys.platform
            if platform.startswith('linux'):
                platform = 'linux'
            desktop = 'windows' if platform == 'win32' else 'macos' if platform == 'darwin' else _detect_linux_desktop()
            system_info = {"platform": platform, "desktop": desktop}
            os.makedirs(os.path.dirname(config_path), exist_ok=True)
            with open(config_path, 'w') as f:
                json.dump(system_info, f, indent=4)

        with open(config_path, 'r') as f:
            return json.load(f)
