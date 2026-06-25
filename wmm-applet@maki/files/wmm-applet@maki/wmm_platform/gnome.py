"""
Módulo de plataforma para GNOME (Linux).
Contiene solo las implementaciones específicas de este entorno.
"""
import os
import subprocess

from debug_logger import log_event
from i18n import _

def get_install_path(data_base, app_domain):
    """Devuelve la ruta de instalación para GNOME."""
    return os.path.join(data_base, 'gnome-shell', 'extensions', app_domain)

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

def _force_desktop_settings(config_handler):
    """
    Fuerza los ajustes del sistema necesarios para que WMM funcione
    correctamente en GNOME:
      - picture-options     = 'spanned'  (no deformar el lienzo)
      - slideshow           = false      (evitar interferencias)
      - color-shading-type  = 'solid'    (evitar mezclas de color)
    """
    try:
        subprocess.run(
            ["gsettings", "set", "org.gnome.desktop.background", "picture-options", "spanned"],
            check=False
        )
        log_event("Forzando picture-options a 'spanned'", origin="GNOME", level="DEBUG", reason="HARDWARE")

        subprocess.run(
            ["gsettings", "set", "org.gnome.desktop.background", "picture-uri", ""],
            check=False
        )
        log_event("Desactivando slideshow", origin="GNOME", level="DEBUG", reason="HARDWARE")

        subprocess.run(
            ["gsettings", "set", "org.gnome.desktop.background", "color-shading-type", "solid"],
            check=False
        )
        log_event("Forzando color-shading-type a 'solid'", origin="GNOME", level="DEBUG", reason="HARDWARE")

        issues = []

        result = subprocess.run(
            ["gsettings", "get", "org.gnome.desktop.background", "picture-options"],
            capture_output=True, text=True
        )
        if result.stdout.strip().lower().replace("'", "") != "spanned":
            issues.append("Picture aspect")

        result = subprocess.run(
            ["gsettings", "get", "org.gnome.desktop.background", "color-shading-type"],
            capture_output=True, text=True
        )
        if result.stdout.strip().lower().replace("'", "") != "solid":
            issues.append("Background color type")

        if issues:
            log_event(
                f"No se pudieron forzar algunos ajustes: {', '.join(issues)}. Notificando al usuario.",
                origin="GNOME", level="WARN", reason="HARDWARE"
            )
            config_handler._send_notification(
                reason="WMM: " + _("Configuration issue"),
                detail_msg=_("For WMM to function correctly, please check the following settings in 'Settings > Background':")
                + "\n" + "\n".join(f"• {issue}" for issue in issues),
                level="warn"
            )
        else:
            log_event("Todos los ajustes del sistema forzados correctamente", origin="GNOME", level="DEBUG", reason="HARDWARE")

    except Exception as e:
        log_event(f"Error al forzar ajustes de GNOME: {e}", origin="GNOME", level="ERROR", reason="NOTIFY")

def set_wallpaper(path, config_handler=None):
    """Aplica el fondo de pantalla usando gsettings (GNOME)."""
    if config_handler:
        _force_desktop_settings(config_handler)
    subprocess.run(
        ["gsettings", "set", "org.gnome.desktop.background", "picture-uri", f"file://{path}"],
        check=False
    )
    # Aplicar también el fondo oscuro si la clave existe (GNOME 42+)
    try:
        result = subprocess.run(
            ["gsettings", "list-keys", "org.gnome.desktop.background"],
            capture_output=True, text=True, check=False
        )
        if "picture-uri-dark" in result.stdout:
            subprocess.run(
                ["gsettings", "set", "org.gnome.desktop.background", "picture-uri-dark", f"file://{path}"],
                check=False
            )
    except Exception:
        pass  # Si falla la verificación, simplemente no se aplica el fondo oscuro
    log_event("Fondo aplicado en GNOME", origin="GNOME", level="INFO", reason="LIBRARY")
