"""
Módulo de plataforma para macOS.
Contiene funciones comunes a macOS (independientes del escritorio).
"""
import os
import subprocess
import fcntl

system_domain = None
CACHE_DIR = None

def get_cache_dir(app_name="wmm"):
    # TODO: Usar ~/Library/Caches cuando se implemente macOS
    # return os.path.join(os.path.expanduser("~/Library/Caches"), app_name)
    return None

def lock_file(f):
    """
    Bloquea el archivo para escritura exclusiva usando fcntl.flock.
    Disponible en macOS por ser un sistema Unix.

    Args:
        f: Objeto de archivo abierto.
    """
    fcntl.flock(f, fcntl.LOCK_EX)

def unlock_file(f):
    """
    Desbloquea el archivo previamente bloqueado con lock_file.

    Args:
        f: Objeto de archivo abierto.
    """
    fcntl.flock(f, fcntl.LOCK_UN)

def open_file(path):
    """
    Abre un archivo o directorio con la aplicación predeterminada en macOS.
    """
    subprocess.run(['open', path], check=False)

def setup_translations():
    """
    Configura el sistema de traducciones para macOS.
    """
    # TODO: Implementar según la estructura de macOS
    pass

def _(text):
    """
    Función de traducción para macOS.
    Por ahora, devuelve el texto original.
    """
    # TODO: Implementar gettext para macOS
    return text

def send_notification(title, message, level="info"):
    """
    Envía una notificación en macOS.
    """
    # TODO: Implementar usando osascript o PyObjC
    print(f"[NOTIFICACIÓN] {title}: {message}")

def _force_desktop_settings(config_handler):
    """
    Fuerza los ajustes del sistema necesarios para que WMM funcione
    correctamente en macOS:
      - Modo de aspecto  = 'spanned'  (no deformar el lienzo)
      - Slideshow        = desactivado (evitar interferencias)
      - Tipo de fondo    = 'solid'    (evitar mezclas de color)

    En macOS, estos ajustes se controlan mediante comandos 'defaults'
    o mediante la API de Cocoa (NSWorkspace). Se debe verificar cada
    ajuste y notificar al usuario si alguno no se aplicó.

    TODO: Implementar usando subprocess.run con defaults o PyObjC.
    """
    pass

def ensure_shell_actions(applet_root):
    """
    Instala las acciones de shell necesarias para macOS (p. ej., servicios del Finder).
    TODO: Implementar cuando se añada soporte para macOS.
    """
    pass
