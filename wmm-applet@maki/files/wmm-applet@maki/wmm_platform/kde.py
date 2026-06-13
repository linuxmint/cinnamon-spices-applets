"""
Módulo de plataforma para KDE Plasma (Linux).
Contiene solo las implementaciones específicas de este entorno.
"""
system_domain = None

# TODO: Implementar get_monitors usando KWin/KDE API
def get_monitors():
    # En KDE, se podría usar PyKDE o consultar a KWin vía D-Bus.
    # Por ahora, delegamos en la implementación genérica de Linux (Gdk).
    from wmm_platform.linux import _generic_get_monitors
    return _generic_get_monitors()

def _force_desktop_settings(config_handler):
    """
    Fuerza los ajustes del sistema necesarios para que WMM funcione
    correctamente en KDE Plasma:
      - Modo de aspecto  = 'spanned'  (no deformar el lienzo)
      - Slideshow        = desactivado (evitar interferencias)
      - Tipo de fondo    = 'solid'    (evitar mezclas de color)

    En KDE Plasma, estos ajustes se controlan mediante comandos
    'plasma-apply-wallpaperimage' para aplicar fondos y 'kwriteconfig5'
    para ajustes de configuración. Se debe verificar cada ajuste y
    notificar al usuario si alguno no se aplicó.

    TODO: Implementar usando subprocess.run con kwriteconfig5.
    """
    pass

def set_wallpaper(path, config_handler=None):
    # KDE Plasma usa un script propio para cambiar el fondo
    import subprocess
    subprocess.run([
        "plasma-apply-wallpaperimage",
        path
    ], check=False)

def ensure_shell_actions(applet_root):
    """
    Instala las acciones de shell necesarias para KDE Plasma (p. ej., service menus de Dolphin).
    TODO: Implementar cuando se añada soporte para KDE.
    """
    pass
