#!/usr/bin/env python3

import os
import gettext

import gi


gi.require_version('Gtk', '3.0')

from gi.repository import Gtk, Gdk, GdkPixbuf

# --- Display server detection ---
IS_WAYLAND = os.environ.get('XDG_SESSION_TYPE', 'x11').lower() == 'wayland'

HAS_WNCK = False
if not IS_WAYLAND:
    try:
        gi.require_version('Wnck', '3.0')
        from gi.repository import Wnck
        HAS_WNCK = True
    except (ValueError, ImportError):
        pass

# --- i18n ---
UUID = "mint-screenshot@khumnath"
APPLET_DIR = os.path.dirname(os.path.realpath(__file__))
LOCALE_DIR = os.path.join(APPLET_DIR, "locale")


gettext.bindtextdomain(UUID, LOCALE_DIR)
gettext.textdomain(UUID)
_ = gettext.gettext


try:
    import dbus
    from dbus.mainloop.glib import DBusGMainLoop
    HAS_DBUS = True
except ImportError:
    HAS_DBUS = False



class AppState:
    """Which phase the UI is in."""
    SELECTING = 1
    ANNOTATING = 2


# --- Global Assets ---
APP_ICON_PIXBUF = None
try:
    icon_path = os.path.join(APPLET_DIR, "assets", "mint-screenshot.png")
    if os.path.exists(icon_path):
        # Scale down to 64x64 for X11 compatibility; 1024x1024 is too large for window properties
        full_pb = GdkPixbuf.Pixbuf.new_from_file(icon_path)
        APP_ICON_PIXBUF = full_pb.scale_simple(64, 64, GdkPixbuf.InterpType.BILINEAR)
except Exception:
    pass


