"""
Módulo de plataforma para Cinnamon (Linux).
Contiene solo las implementaciones específicas de este entorno.
"""
import os
import glob
import hashlib
import subprocess
import time

from debug_logger import log_event
from i18n import _

def get_install_path(data_base, app_domain):
    """Devuelve la ruta de instalación para Cinnamon."""
    return os.path.join(data_base, 'cinnamon', 'applets', app_domain)

def get_physical_edid_hashes():
    """
    Escanea el sistema en busca de todos los monitores con estado 'connected'
    y genera sus hashes reales de hardware.
    Retorna un diccionario {conector: hash}.
    """
    hashes = {}
    for status_path in glob.glob("/sys/class/drm/card*-*/status"):
        try:
            with open(status_path, 'r') as f:
                if "connected" in f.read():
                    edid_path = status_path.replace("status", "edid")
                    connector_full = os.path.basename(os.path.dirname(status_path))
                    connector = connector_full.split('-', 1)[-1] if '-' in connector_full else connector_full
                    if os.path.exists(edid_path):
                        with open(edid_path, "rb") as e:
                            data = e.read(128)
                            if len(data) >= 128:
                                h = hashlib.shake_128(data).hexdigest(4)
                                hashes[connector] = h
        except:
            continue
    return hashes

def get_monitors():
    """
    Devuelve un diccionario con la geometría de todos los monitores activos usando Gdk.
    """
    import gi
    gi.require_version('Gdk', '3.0')
    from gi.repository import Gdk
    from monitor_manager import calculate_inches

    display = Gdk.Display.get_default()
    if display:
        display.sync()

    monitors_data = {}
    n_monitors = display.get_n_monitors()
    physical_hashes = get_physical_edid_hashes()

    for i in range(n_monitors):
        monitor = display.get_monitor(i)
        geometry = monitor.get_geometry()
        connector = monitor.get_model() or "Unknown"
        manufacturer = monitor.get_manufacturer()
        w_mm = monitor.get_width_mm()
        h_mm = monitor.get_height_mm()
        is_primary = monitor.is_primary()

        m_hash = physical_hashes.get(connector)
        if not m_hash:
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
    correctamente en Cinnamon:
      - picture-options     = 'spanned'  (no deformar el lienzo)
      - slideshow           = false      (evitar interferencias)
      - color-shading-type  = 'solid'    (evitar mezclas de color)
    Verifica cada ajuste y notifica al usuario si alguno no se aplicó.
    """
    try:
        subprocess.run(
            ["gsettings", "set", "org.cinnamon.desktop.background", "picture-options", "spanned"],
            check=False
        )
        log_event("Forzando picture-options a 'spanned'", origin="DESKTOP", level="DEBUG", reason="HARDWARE")

        subprocess.run(
            ["gsettings", "set", "org.cinnamon.desktop.background.slideshow", "slideshow-enabled", "false"],
            check=False
        )
        log_event("Forzando slideshow a 'false'", origin="DESKTOP", level="DEBUG", reason="HARDWARE")

        subprocess.run(
            ["gsettings", "set", "org.cinnamon.desktop.background", "color-shading-type", "solid"],
            check=False
        )
        log_event("Forzando color-shading-type a 'solid'", origin="DESKTOP", level="DEBUG", reason="HARDWARE")

        issues = []

        result = subprocess.run(
            ["gsettings", "get", "org.cinnamon.desktop.background", "picture-options"],
            capture_output=True, text=True
        )
        if result.stdout.strip().lower().replace("'", "") != "spanned":
            issues.append("Picture aspect")

        result = subprocess.run(
            ["gsettings", "get", "org.cinnamon.desktop.background.slideshow", "slideshow-enabled"],
            capture_output=True, text=True
        )
        if result.stdout.strip().lower() != "false":
            issues.append("Slideshow")

        result = subprocess.run(
            ["gsettings", "get", "org.cinnamon.desktop.background", "color-shading-type"],
            capture_output=True, text=True
        )
        if result.stdout.strip().lower().replace("'", "") != "solid":
            issues.append("Background color type")

        if issues:
            log_event(
                f"No se pudieron forzar algunos ajustes: {', '.join(issues)}. Notificando al usuario.",
                origin="DESKTOP", level="WARN", reason="HARDWARE"
            )
            config_handler._send_notification(
                reason="WMM: " + _("Configuration issue"),
                detail_msg=_("For WMM to function correctly, please check the following settings in 'System Settings > Backgrounds':")
                + "\n" + "\n".join(f"• {issue}" for issue in issues),
                level="warn"
            )
        else:
            log_event("Todos los ajustes del sistema forzados correctamente", origin="DESKTOP", level="DEBUG", reason="HARDWARE")

    except Exception as e:
        log_event(f"Error al forzar ajustes de Cinnamon: {e}", origin="DESKTOP", level="ERROR", reason="NOTIFY")

def set_wallpaper(final_path, config_handler):
    """
    Aplica el fondo de pantalla usando gsettings (Cinnamon).
    Fuerza los ajustes del sistema y aplica una transición suave.
    """
    from PIL import Image

    _force_desktop_settings(config_handler)

    try:
        settings = config_handler.load_json("settings").get("global", {})
        sl_mode = settings.get("slideshow_mode", "sync")

        if sl_mode == "sync":
            from gi.repository import Gdk
            result_color = subprocess.run(
                ["gsettings", "get", "org.cinnamon.desktop.background", "primary-color"],
                capture_output=True, text=True
            )
            color_str = result_color.stdout.strip().lower().replace("'", "")
            rgba = Gdk.RGBA()
            if rgba.parse(color_str):
                r = int(rgba.red * 255)
                g = int(rgba.green * 255)
                b = int(rgba.blue * 255)
            else:
                r, g, b = 0, 0, 0
            fade_color_path = os.path.join(config_handler.cache_dir, "fade_color.png")
            Image.new('RGB', (1, 1), (r, g, b)).save(fade_color_path)

            os.system(f"gsettings set org.cinnamon.desktop.background picture-uri 'file://{fade_color_path}'")
            time.sleep(1.5)
            os.system(f"gsettings set org.cinnamon.desktop.background picture-uri 'file://{final_path}'")
            log_event("Transición Cine aplicada (sync)", origin="DESKTOP", level="INFO", reason="LIBRARY")
        else:
            os.system(f"gsettings set org.cinnamon.desktop.background picture-uri 'file://{final_path}'")
            log_event("Transicion Crossfade aplicada (async)", origin="DESKTOP", level="INFO", reason="LIBRARY")

    except Exception as e:
        log_event(f"Cinnamon no respondió: {e}", origin="DESKTOP", level="ERROR", reason="NOTIFY")

# --- BLOQUE DE AUTODIAGNÓSTICO ---
if __name__ == "__main__":
    print("\n" + "═" * 50)
    print("  WMM PLATFORM DIAGNOSTIC - CINNAMON")
    print("═" * 50)

    active = get_monitors()
    if active:
        from monitor_manager import get_total_canvas_geometry
        canvas_w, canvas_h = get_total_canvas_geometry(active)

        print(f"\n[MONITORES]")
        for m_hash, data in active.items():
            print(f"  ID: {m_hash} | {data['width']}x{data['height']} en ({data['x']},{data['y']}) | {data['orientation']}")

        print(f"\n[LIENZO]")
        print(f"  Lienzo Maestro Requerido: {canvas_w}x{canvas_h}")
    else:
        print("\n[!] No se detectaron monitores.")

    print("\n" + "═" * 50)
    print("  Diagnóstico completado.")
    print("═" * 50 + "\n")
