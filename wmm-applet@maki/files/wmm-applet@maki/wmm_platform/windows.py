"""
Módulo de plataforma para Windows.
Contiene funciones comunes a Windows (independientes del escritorio).
"""
import os
import sys
import subprocess

system_domain = None
CACHE_DIR = None

def get_cache_dir(app_name="wmm"):
    # TODO: Usar %LOCALAPPDATA% o similar cuando se implemente Windows
    # return os.path.join(os.environ.get('LOCALAPPDATA', '.'), app_name)
    return None

def lock_file(f):
    """
    Bloquea el archivo para escritura exclusiva usando msvcrt.locking.

    Args:
        f: Objeto de archivo abierto en modo binario.

    Nota:
        msvcrt.locking requiere que el archivo se abra en modo binario.
        Si se usa con archivos de texto, puede ser necesario ajustar
        el modo de apertura en debug_logger.py según sys.platform.
    """
    import msvcrt
    msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)

def unlock_file(f):
    """
    Desbloquea el archivo previamente bloqueado con lock_file.

    Args:
        f: Objeto de archivo abierto.
    """
    import msvcrt
    msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)

def open_file(path):
    """
    Abre un archivo o directorio con la aplicación predeterminada en Windows.
    """
    os.startfile(path)

def setup_translations():
    """
    Configura el sistema de traducciones para Windows.
    """
    # TODO: Implementar gettext para Windows con rutas locales
    pass

def _(text):
    """
    Función de traducción para Windows.
    Por ahora, devuelve el texto original.
    """
    # TODO: Implementar gettext para Windows
    return text

def send_notification(title, message, level="info"):
    """
    Envía una notificación en Windows.
    """
    # TODO: Implementar usando win32api o toasts
    print(f"[NOTIFICACIÓN] {title}: {message}")

def _force_desktop_settings(config_handler):
    """
    Fuerza los ajustes del sistema necesarios para que WMM funcione
    correctamente en Windows:
      - Modo de aspecto  = 'spanned'  (no deformar el lienzo)
      - Slideshow        = desactivado (evitar interferencias)
      - Tipo de fondo    = 'solid'    (evitar mezclas de color)

    En Windows, estos ajustes se controlan mediante la API de Win32
    (SystemParametersInfo) o mediante el registro de Windows. Se debe
    verificar cada ajuste y notificar al usuario si alguno no se aplicó.

    TODO: Implementar usando ctypes o pywin32.
    """
    pass

def ensure_shell_actions(applet_root):
    """
    Instala las acciones de shell necesarias para Windows (p. ej., menús contextuales del Explorador).
    TODO: Implementar cuando se añada soporte para Windows.
    """
    pass
