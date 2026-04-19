import gi
gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
gi.require_version('GdkPixbuf', '2.0')
from gi.repository import Gtk, Gdk, GdkPixbuf
import cairo
import math
import os
import json

def create_tool_icon(tool_type, size=24, color=(1, 1, 1), active=False):
    if active:
        color = (0.2, 0.6, 1.0) # Mint blue for active tool
        
    surface = cairo.ImageSurface(cairo.Format.ARGB32, size, size)
    cr = cairo.Context(surface)
    
    # 1. Try loading from assets/icons
    icon_path = os.path.join(os.path.dirname(__file__), "assets", "icons", f"{tool_type}.png")
    if os.path.exists(icon_path):
        try:
            # Load and scale
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(icon_path, size, size)
            # Create a temporary surface to hold the icon
            icon_surface = cairo.ImageSurface(cairo.Format.ARGB32, size, size)
            icon_cr = cairo.Context(icon_surface)
            Gdk.cairo_set_source_pixbuf(icon_cr, pixbuf, 0, 0)
            icon_cr.paint()
            
            # Use icon as mask to apply color
            cr.set_source_rgb(*color)
            cr.mask_surface(icon_surface, 0, 0)
            
            return Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size)
        except Exception as e:
            print(f"Error loading icon {tool_type}: {e}")

    # 2. Fallback: simple placeholder (all icons should be PNGs in assets/icons/)
    cr.scale(size, size)
    cr.set_source_rgb(*color)
    cr.set_line_width(0.08)
    cr.set_line_cap(cairo.LineCap.ROUND)
    cr.arc(0.5, 0.5, 0.15, 0, 2*math.pi)
    cr.fill()

    pixbuf = Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size)
    return pixbuf

def create_color_icon(r, g, b, size=24):
    surface = cairo.ImageSurface(cairo.Format.ARGB32, size, size)
    cr = cairo.Context(surface)
    cr.arc(size/2, size/2, (size/2)-4, 0, 2*math.pi)
    cr.set_source_rgb(r, g, b)
    cr.fill()
    cr.arc(size/2, size/2, (size/2)-4, 0, 2*math.pi)
    cr.set_source_rgb(1, 1, 1)
    cr.set_line_width(1)
    cr.stroke()
    return Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size)

def load_settings(defaults):
    conf_path = os.path.expanduser("~/.config/mint-screenshot.json")
    settings = defaults.copy()
    if os.path.exists(conf_path):
        try:
            with open(conf_path, 'r') as f:
                settings.update(json.load(f))
        except: pass
    return settings

def save_settings(settings):
    conf_path = os.path.expanduser("~/.config/mint-screenshot.json")
    try:
        with open(conf_path, 'w') as f:
            json.dump(settings, f)
    except: pass
