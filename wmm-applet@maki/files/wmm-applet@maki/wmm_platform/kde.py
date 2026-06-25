"""
Módulo de plataforma para KDE Plasma (Linux).
Contiene solo las implementaciones específicas de este entorno.
"""
import os
import subprocess
import re

def get_install_path(data_base, app_domain):
    """Devuelve la ruta de instalación (esqueleto)."""
    return os.path.join(data_base, app_domain)

def get_monitors():
    """Devuelve un diccionario con la geometría de todos los monitores activos usando Gdk."""
    import gi, hashlib
    gi.require_version('Gdk', '3.0')
    from gi.repository import Gdk
    from monitor_manager import calculate_inches

    display = Gdk.Display.get_default()
    if display:
        display.sync()

    monitors_data = {}
    n_monitors = display.get_n_monitors()

    for i in range(n_monitors):
        monitor = display.get_monitor(i)
        geometry = monitor.get_geometry()
        connector = monitor.get_model() or "Unknown"
        manufacturer = monitor.get_manufacturer()
        w_mm = monitor.get_width_mm()
        h_mm = monitor.get_height_mm()
        is_primary = monitor.is_primary()

        m_hash = hashlib.shake_128(connector.encode()).hexdigest(4)
        orientation = "horizontal" if geometry.width >= geometry.height else "vertical"
        inches = calculate_inches(w_mm, h_mm)

        monitors_data[m_hash] = {
            "connector": connector,
            "manufacturer": manufacturer,
            "x": geometry.x,
            "y": geometry.y,
            "width": geometry.width,
            "height": geometry.height,
            "width_mm": w_mm,
            "height_mm": h_mm,
            "inches": inches,
            "orientation": orientation,
            "primary": is_primary,
        }

    return monitors_data

def set_wallpaper(path, config_handler=None):
    """Aplica el fondo de pantalla en KDE Plasma usando el complemento nativo."""
    import subprocess
    subprocess.run(["plasma-apply-wallpaperimage", path], check=False)
