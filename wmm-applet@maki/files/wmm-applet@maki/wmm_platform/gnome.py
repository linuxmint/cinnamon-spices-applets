"""
Módulo de plataforma para GNOME (Linux).
Contiene solo las implementaciones específicas de este entorno.
"""

system_domain = "gnome-shell"

# TODO: Implementar get_monitors usando GNOME Shell/Mutter
def get_monitors():
    # En GNOME, se podría usar la misma API de Gdk que en Cinnamon,
    # o bien consultar directamente a Mutter vía D-Bus.
    # Por ahora, delegamos en la implementación genérica de Linux (Gdk).
    from wmm_platform.linux import _generic_get_monitors
    return _generic_get_monitors()

def _force_desktop_settings(config_handler):
    """
    Fuerza los ajustes del sistema necesarios para que WMM funcione
    correctamente en GNOME:
      - picture-options     = 'spanned'  (no deformar el lienzo)
      - slideshow           = false      (evitar interferencias)
      - color-shading-type  = 'solid'    (evitar mezclas de color)

    En GNOME, estos ajustes se controlan mediante gsettings con el
    esquema 'org.gnome.desktop.background'. Se debe verificar cada
    ajuste y notificar al usuario si alguno no se aplicó.

    TODO: Implementar usando subprocess.run con gsettings.
    """
    pass

def set_wallpaper(path, config_handler=None):
    # GNOME usa gsettings con esquema 'org.gnome.desktop.background'
    import os
    os.system(f"gsettings set org.gnome.desktop.background picture-uri 'file://{path}'")

def ensure_shell_actions(applet_root):
    """
    Instala las acciones de shell necesarias para GNOME (p. ej., scripts de Nautilus).
    TODO: Implementar cuando se añada soporte para GNOME.
    """
    pass
