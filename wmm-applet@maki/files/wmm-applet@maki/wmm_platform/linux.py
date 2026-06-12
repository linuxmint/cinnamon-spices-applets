"""
Módulo de plataforma para Linux.
Contiene funciones comunes a todos los escritorios de Linux.
"""
import os
import subprocess
import fcntl

# Dominio del sistema para traducciones (se hereda desde cinnamon.py, gnome.py, etc.)
system_domain = None

# Ruta de caché estándar en Linux (XDG)
CACHE_DIR = os.path.expanduser("~/.cache")

def get_cache_dir(app_name="wmm"):
    """
    Devuelve la ruta al directorio de caché para una aplicación (Linux).
    """
    return os.path.join(CACHE_DIR, app_name)

def lock_file(f):
    """
    Bloquea el archivo para escritura exclusiva usando fcntl.flock.
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
    Abre un archivo o directorio con la aplicación predeterminada en Linux.
    """
    subprocess.run(['xdg-open', path], check=False)

def setup_translations():
    """
    Configura el sistema de traducciones para Linux.
    """
    import gettext
    locale_dir = os.path.expanduser('~/.local/share/locale')
    gettext.bindtextdomain('wmm-applet@maki', locale_dir)

def _(text):
    """
    Función de traducción personalizada para Linux.
    Busca primero en el sistema, luego en nuestro dominio.
    """
    import gettext
    translated = gettext.dgettext('cinnamon', text)
    if translated != text:
        return translated
    return gettext.dgettext('wmm-applet@maki', text)

def compile_translations(applet_root):
    """
    Compila los archivos .po a .mo en la ruta de traducciones de Linux.
    Se llama desde el motor al iniciar, si la plataforma lo soporta.
    """
    po_dir = os.path.join(applet_root, "po")
    if not os.path.isdir(po_dir):
        return

    locale_base = os.path.expanduser("~/.local/share/locale")
    for po_file in os.listdir(po_dir):
        if not po_file.endswith(".po"):
            continue
        lang = os.path.splitext(po_file)[0]
        mo_dir = os.path.join(locale_base, lang, "LC_MESSAGES")
        mo_file = os.path.join(mo_dir, "wmm-applet@maki.mo")
        po_path = os.path.join(po_dir, po_file)

        if not os.path.exists(mo_file) or os.path.getmtime(po_path) > os.path.getmtime(mo_file):
            try:
                os.makedirs(mo_dir, exist_ok=True)
                subprocess.run(
                    ["msgfmt", po_path, "-o", mo_file],
                    check=False, capture_output=True
                )
            except Exception:
                pass  # Si falla, el motor usará inglés por defecto

def send_notification(title, message, level="info"):
    """
    Envía una notificación de escritorio en Linux usando notify-send.
    """
    icon_map = {
        "info": "dialog-information-symbolic",
        "warn": "dialog-warning-symbolic",
        "error": "dialog-error-symbolic"
    }
    selected_icon = icon_map.get(level, "dialog-information")
    try:
        subprocess.run([
            "notify-send",
            "-i", selected_icon,
            title,
            message,
            "-a", "WMM_DEBUG"
        ], check=False)
    except Exception as e:
        print(f" [!] Error en notificación: {e}")
