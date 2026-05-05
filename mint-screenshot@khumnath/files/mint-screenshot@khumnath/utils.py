import gi
gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
gi.require_version('GdkPixbuf', '2.0')
from gi.repository import Gtk, Gdk, GdkPixbuf
import cairo
import logging
import math
import os
import json

import functools


@functools.lru_cache(maxsize=64)
def create_tool_icon(tool_type, size=24, color=(1, 1, 1), active=False):
    """Renders a toolbar icon. Loads from assets/icons/ if available,
    otherwise falls back to a simple dot placeholder.
    Results are cached by (tool_type, size, color, active)."""
    if active:
        color = (0.2, 0.6, 1.0)

    surface = cairo.ImageSurface(cairo.Format.ARGB32, size, size)
    cr = cairo.Context(surface)

    # Try loading the PNG icon from the assets directory
    icon_path = os.path.join(os.path.dirname(__file__), "assets", "icons", f"{tool_type}.png")
    if os.path.exists(icon_path):
        try:
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(icon_path, size, size)
            icon_surface = cairo.ImageSurface(cairo.Format.ARGB32, size, size)
            icon_cr = cairo.Context(icon_surface)
            Gdk.cairo_set_source_pixbuf(icon_cr, pixbuf, 0, 0)
            icon_cr.paint()

            # Use the icon alpha channel as a mask, tinted with `color`
            cr.set_source_rgb(*color)
            cr.mask_surface(icon_surface, 0, 0)

            result = Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size)
            icon_surface.finish()
            surface.finish()
            return result
        except Exception as e:
            logging.getLogger(__name__).debug("Couldn't load icon '%s': %s", tool_type, e)

    # Fallback: plain circle dot
    cr.scale(size, size)
    cr.set_source_rgb(*color)
    cr.set_line_width(0.08)
    cr.set_line_cap(cairo.LineCap.ROUND)
    cr.arc(0.5, 0.5, 0.15, 0, 2 * math.pi)
    cr.fill()

    result = Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size)
    surface.finish()
    return result


def create_color_icon(r, g, b, size=24):
    """Draws a small colored circle swatch for the palette toolbar."""
    surface = cairo.ImageSurface(cairo.Format.ARGB32, size, size)
    cr = cairo.Context(surface)
    cr.arc(size / 2, size / 2, (size / 2) - 4, 0, 2 * math.pi)
    cr.set_source_rgb(r, g, b)
    cr.fill()
    # White ring outline
    cr.arc(size / 2, size / 2, (size / 2) - 4, 0, 2 * math.pi)
    cr.set_source_rgb(1, 1, 1)
    cr.set_line_width(1)
    cr.stroke()
    result = Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size)
    surface.finish()
    return result


def load_settings(defaults):
    """Reads ~/.config/mint-screenshot.json, merged over `defaults`."""
    conf_path = os.path.expanduser("~/.config/mint-screenshot.json")
    settings = defaults.copy()
    if os.path.exists(conf_path):
        try:
            with open(conf_path, 'r') as f:
                settings.update(json.load(f))
        except (json.JSONDecodeError, IOError):
            pass
    return settings


def save_settings(settings):
    """Writes current settings to ~/.config/mint-screenshot.json."""
    conf_path = os.path.expanduser("~/.config/mint-screenshot.json")
    try:
        with open(conf_path, 'w') as f:
            json.dump(settings, f)
    except IOError:
        pass
