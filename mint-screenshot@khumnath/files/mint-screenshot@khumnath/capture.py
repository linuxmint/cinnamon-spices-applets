import logging
import os
import secrets
import tempfile
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib, Gio, GdkPixbuf
try:
    import dbus
except ImportError:
    pass
from config import HAS_DBUS, _

class CaptureMixin:
    def _x11_screenshot(self):
        """Grab pixels from the X11 root window. Supports single-monitor selection."""
        screen = Gdk.Screen.get_default()
        display = Gdk.Display.get_default()
        window = Gdk.get_default_root_window()
        
        m_idx = getattr(self, '_target_monitor', -1)
        if m_idx >= 0:
            # Capture a specific monitor
            monitor = display.get_monitor(m_idx)
            geom = monitor.get_geometry()
            x, y, w, h = geom.x, geom.y, geom.width, geom.height
        else:
            # Capture all monitors (full screen)
            x, y, w, h = 0, 0, screen.get_width(), screen.get_height()
            
        # Grab the requested region
        # Capture physical pixels (Logical * Scale)
        ps = self.scale
        self.full_pixbuf = Gdk.pixbuf_get_from_window(window, int(x * ps), int(y * ps), int(w * ps), int(h * ps))
        self._invalidate_bg_cache()

        if self.full_pixbuf is None:
            logging.getLogger(__name__).error("Failed to capture screen (pixbuf is None)")
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
            return False

        self.width = w
        self.height = h
        self.rect = (0, 0, self.width, self.height)
        
        self._open_annotator()
        return False

    def _portal_screenshot(self, interactive=False):
        """Wayland capture: try the Shell API first, fall back to XDG portal."""
        if not HAS_DBUS:
            self._show_wayland_error(_("D-Bus is required for Wayland support."))
            return False

        # Try the GNOME/Cinnamon Shell API first (no portal dialog needed)
        try:
            bus = dbus.SessionBus()
            obj = bus.get_object("org.gnome.Shell.Screenshot", "/org/gnome/Shell/Screenshot")
            iface = dbus.Interface(obj, "org.gnome.Shell.Screenshot")
            
            fd, temp_path = tempfile.mkstemp(prefix='mint-screenshot-', suffix='.png')
            os.close(fd)
            # Screenshot(include_frame, flash, filename)
            iface.Screenshot(True, False, temp_path)
            
            GLib.timeout_add(300, self._load_from_path, temp_path)
            return False
        except Exception:
            pass # Fallback to Portal

        # Fall back to XDG Desktop Portal
        try:
            bus = dbus.SessionBus()
            token = secrets.token_hex(8)
            sender = bus.get_unique_name().replace('.', '_').replace(':', '')
            request_path = f"/org/freedesktop/portal/desktop/request/{sender}/{token}"

            self._portal_signal_match = bus.add_signal_receiver(
                self._on_portal_response,
                signal_name="Response",
                dbus_interface="org.freedesktop.portal.Request",
                path=request_path
            )

            obj = bus.get_object("org.freedesktop.portal.Desktop", "/org/freedesktop/portal/desktop")
            iface = dbus.Interface(obj, "org.freedesktop.portal.Screenshot")

            options = dbus.Dictionary({
                "handle_token": dbus.String(token),
                "interactive": dbus.Boolean(interactive),
            }, signature="sv")

            iface.Screenshot("", options)
        except Exception as e:
            self._show_wayland_error(f"Capture failed:\n{e}")
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
        return False

    def _load_from_path(self, path):
        """Load a screenshot from a file path, then open the annotator."""
        if not os.path.exists(path):
            return False  # file never showed up, give up
            
        self.full_pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
        self._invalidate_bg_cache()
        self.width = self.full_pixbuf.get_width() / self.scale
        self.height = self.full_pixbuf.get_height() / self.scale
        self.rect = (0, 0, self.width, self.height)
        
        # Clean up the temp file now that it's loaded into memory
        try:
            os.remove(path)
        except OSError:
            pass
        
        self._open_annotator()
        return False

    def _on_portal_response(self, response, results):
        """D-Bus callback when the portal finishes capturing."""
        # Disconnect the signal receiver to prevent stale callbacks
        if getattr(self, '_portal_signal_match', None):
            self._portal_signal_match.remove()
            self._portal_signal_match = None

        if response != 0:
            # User cancelled
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
            return

        uri = str(results.get("uri", ""))
        if not uri:
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
            return

        # Convert portal URI to filesystem path
        gfile = Gio.File.new_for_uri(uri)
        path = gfile.get_path()

        if not path or not os.path.exists(path):
            # File might not be flushed yet — retry once after a short delay
            GLib.timeout_add(300, self._try_load_portal_capture, uri)
            return

        self._load_portal_image(path)

    def _try_load_portal_capture(self, uri):
        """Retry loading if the portal file wasn't ready on first attempt."""
        gfile = Gio.File.new_for_uri(uri)
        path = gfile.get_path()

        if not path or not os.path.exists(path):
            self._show_wayland_error(f"Screenshot file not found:\n{uri}")
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
            return False

        self._load_portal_image(path)
        return False

    def _load_portal_image(self, path):
        """Load a portal-captured image and open the editor."""
        try:
            self.full_pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
            self._invalidate_bg_cache()
        except Exception as e:
            self._show_wayland_error(_("Failed to load captured screenshot:\n{}").format(e))
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
            return

        # Portal images are at physical resolution; convert to logical coords
        s = self.scale
        self.width = self.full_pixbuf.get_width() / s
        self.height = self.full_pixbuf.get_height() / s
        

        self.rect = (0, 0, self.width, self.height)


        self._open_annotator()

    # --- Editor setup ---
