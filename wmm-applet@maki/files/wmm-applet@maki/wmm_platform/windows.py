"""
Módulo de plataforma para Windows.
Contiene funciones comunes a Windows (independientes del escritorio).
"""
import os
import sys
import subprocess

def normalize_platform(raw_platform):
    """Normaliza el valor de sys.platform al nombre canónico del SO."""
    return raw_platform

def detect_desktop():
    """Detecta el escritorio actual (esqueleto)."""
    return 'generic'

def get_system_paths():
    """
    Devuelve las rutas base del sistema para Windows.
    TODO: Implementar usando %LOCALAPPDATA%, %APPDATA%, etc.
    Por ahora, devuelve None para usar fallbacks genéricos.
    """
    return {
        'data_base': None,
        'cache_base': None,
        'locale_dir': None,
        'cache_dir': None,
    }

def get_install_path(data_base, app_domain):
    """Devuelve la ruta de instalación (esqueleto)."""
    if data_base:
        return os.path.join(data_base, app_domain)
    return app_domain

def lock_file(f):
    """
    Bloquea el archivo para escritura exclusiva usando msvcrt.locking.
    """
    import msvcrt
    msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)

def unlock_file(f):
    """
    Desbloquea el archivo previamente bloqueado con lock_file.
    """
    import msvcrt
    msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)

def open_file(path):
    """
    Abre un archivo o directorio con la aplicación predeterminada en Windows.
    """
    os.startfile(path)

def send_notification(title, message, level="info"):
    """
    Envía una notificación en Windows.
    """
    # TODO: Implementar usando win32api o toasts
    print(f"[NOTIFICACIÓN] {title}: {message}")

def _force_desktop_settings(config_handler):
    """
    Fuerza los ajustes del sistema necesarios para que WMM funcione
    correctamente en Windows.
    TODO: Implementar usando ctypes o pywin32.
    """
    pass

def ensure_shell_actions(applet_root, data_base):
    """
    Instala las acciones de shell necesarias para Windows
    (p. ej., menús contextuales del Explorador).
    TODO: Implementar cuando se añada soporte para Windows.
    """
    pass
