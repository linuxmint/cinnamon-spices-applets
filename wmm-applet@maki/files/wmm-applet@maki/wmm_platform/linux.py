"""
Módulo de plataforma para Linux.
Contiene funciones comunes a todos los escritorios de Linux.
"""
import os
import subprocess
import fcntl
import shutil

from debug_logger import log_event

def ensure_shell_actions(applet_root, data_base):
    """
    Detecta qué gestores de archivos (Nemo, Nautilus, Dolphin) están realmente
    instalados en el SO y copia sus scripts de integración correspondientes.
    Opera de forma agnóstica al escritorio activo.
    """
    source_dir = os.path.join(applet_root, "wmm_platform", "shell", "file_manager")
    if not os.path.isdir(source_dir):
        return

    # --- 1. LIMPIEZA DE DIRECTORIOS ANTIGUOS EN EL APPLET ---
    legacy_dirs = [
        os.path.join(applet_root, "wmm_platform", "shell", "nemo"),
        os.path.join(applet_root, "wmm_platform", "shell", "nautilus")
    ]
    for old_dir in legacy_dirs:
        if os.path.isdir(old_dir):
            try:
                shutil.rmtree(old_dir)
                log_event(f"Directorio legacy eliminado: {old_dir}", origin="LINUX", level="INFO", reason="SETTINGS")
            except Exception as e:
                log_event(f"No se pudo eliminar {old_dir}: {e}", origin="LINUX", level="WARN", reason="SETTINGS")

    # --- 2. DEFINICIÓN DE GESTORES Y SUS RUTAS ---
    # Mapeo: binario -> (directorio_destino, extensiones_a_copiar)
    managers = {
        "nemo": (os.path.join(data_base, "nemo", "actions"), (".nemo_action", ".sh")),
        "nautilus": (os.path.join(data_base, "nautilus", "scripts"), (".sh",)),
        "dolphin": (os.path.join(data_base, "kio", "servicemenus"), (".desktop", ".sh"))
    }

    # --- 3. DETECCIÓN Y COPIA ---
    for binary, (target_dir, extensions) in managers.items():
        # Comprobación real: ¿El gestor está instalado en el SO?
        if not shutil.which(binary):
            continue

        # Si el gestor está instalado pero la carpeta de scripts del usuario no existe,
        # la creamos para asegurarnos de que la integración funciona.
        os.makedirs(target_dir, exist_ok=True)

        # Copiar solo los archivos que corresponden a este gestor
        for action_file in os.listdir(source_dir):
            if action_file.endswith(extensions):
                src = os.path.join(source_dir, action_file)
                dst = os.path.join(target_dir, action_file)
                try:
                    shutil.copy2(src, dst)
                    # Dar permisos de ejecución si es un script .sh
                    if action_file.endswith(".sh"):
                        os.chmod(dst, 0o755)
                except Exception as e:
                    log_event(f"Error copiando {action_file} a {target_dir}: {e}", origin="LINUX", level="WARN", reason="SETTINGS")

        log_event(f"Integración con {binary.capitalize()} verificada/instalada en {target_dir}", origin="LINUX", level="INFO", reason="SETTINGS")

def normalize_platform(raw_platform):
    """
    Normaliza el valor de sys.platform al nombre canónico del SO.
    Ej: 'linux2' -> 'linux'.
    """
    if raw_platform.startswith('linux'):
        return 'linux'
    return raw_platform

def normalize_desktop(desktop):
    """
    Normaliza variantes de escritorio a su nombre canónico.
    Ej: 'x-cinnamon' -> 'cinnamon', 'ubuntu:GNOME' -> 'gnome'.
    """
    desktop = desktop.lower()
    if desktop.startswith('x-cinnamon') or desktop == 'cinnamon2d':
        return 'cinnamon'
    if 'gnome' in desktop:
        return 'gnome'
    if 'plasma' in desktop:
        return 'kde'
    return desktop

def detect_desktop():
    """
    Detecta el escritorio actual en Linux usando variables de entorno.
    """
    desktop = os.environ.get('XDG_CURRENT_DESKTOP',
                             os.environ.get('DESKTOP_SESSION', 'unknown'))
    return desktop.lower()

def get_system_paths():
    """
    Devuelve las rutas base del sistema para Linux (XDG).
    La ruta de caché se construye añadiendo 'wmm' a cache_base.
    """
    data_base = os.environ.get('XDG_DATA_HOME',
                               os.path.expanduser('~/.local/share'))
    cache_base = os.environ.get('XDG_CACHE_HOME',
                                os.path.expanduser('~/.cache'))
    locale_dir = os.path.join(data_base, 'locale')
    cache_dir = os.path.join(cache_base, 'wmm')
    return {
        'data_base': data_base,
        'cache_base': cache_base,
        'locale_dir': locale_dir,
        'cache_dir': cache_dir,
    }

def lock_file(f):
    """
    Bloquea el archivo para escritura exclusiva usando fcntl.flock.
    """
    fcntl.flock(f, fcntl.LOCK_EX)

def unlock_file(f):
    """
    Desbloquea el archivo previamente bloqueado con lock_file.
    """
    fcntl.flock(f, fcntl.LOCK_UN)

def open_file(path):
    """
    Abre un archivo o directorio con la aplicación predeterminada en Linux.
    """
    subprocess.run(['xdg-open', path], check=False)

def compile_translations(applet_root, locale_dir, app_domain):
    """
    Compila los archivos .po a .mo en la ruta de traducciones indicada.
    Recibe locale_dir como argumento (obtenido de PlatformManager).
    """
    po_dir = os.path.join(applet_root, "po")
    if not os.path.isdir(po_dir):
        return

    for po_file in os.listdir(po_dir):
        if not po_file.endswith(".po"):
            continue
        lang = os.path.splitext(po_file)[0]
        mo_dir = os.path.join(locale_dir, lang, "LC_MESSAGES")
        mo_file = os.path.join(mo_dir, f"{app_domain}.mo")
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
            "-a", "WMM"
        ], check=False)
    except Exception as e:
        print(f" [!] Error en notificación: {e}")
