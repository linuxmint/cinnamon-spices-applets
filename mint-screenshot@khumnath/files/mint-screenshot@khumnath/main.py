#!/usr/bin/env python3

# ──────────────────────────────────────────────────────────────────────────────
# SYSTEM IMPORTS AND DEPENDENCIES
# ──────────────────────────────────────────────────────────────────────────────
import sys
import os
import math
import time
import json
import secrets
import gettext
import locale
import gi

# We strictly require GTK 3.0 and PangoCairo for our high-performance UI and 
# text rendering.
gi.require_version('Gtk', '3.0')
gi.require_version('PangoCairo', '1.0')

from gi.repository import Gtk, Gdk, GdkPixbuf, GLib, Pango, PangoCairo, Gio
import cairo

# ──────────────────────────────────────────────────────────────────────────────
# ENVIRONMENT DETECTION (WAYLAND VS X11)
# ──────────────────────────────────────────────────────────────────────────────

# We detect the display server early to choose the correct capture backend.
# Wayland requires Desktop Portals via D-Bus, while X11 allows direct pixel access.
IS_WAYLAND = os.environ.get('XDG_SESSION_TYPE', 'x11').lower() == 'wayland'

# libwnck is used for window-level detection, but it only works on X11.
HAS_WNCK = False
if not IS_WAYLAND:
    try:
        gi.require_version('Wnck', '3.0')
        from gi.repository import Wnck
        HAS_WNCK = True
    except (ValueError, ImportError):
        pass

# ──────────────────────────────────────────────────────────────────────────────
# INTERNATIONALIZATION (I18N) SETUP
# ──────────────────────────────────────────────────────────────────────────────

# We use the UUID as the translation domain to match Cinnamon's standard.
UUID = "mint-screenshot@khumnath"
APPLET_DIR = os.path.dirname(os.path.realpath(__file__))
LOCALE_DIR = os.path.join(APPLET_DIR, "locale")

# Initialize Gettext. Fallback to English if no translation is found.
gettext.bindtextdomain(UUID, LOCALE_DIR)
gettext.textdomain(UUID)
_ = gettext.gettext

# D-Bus is essential for communicating with xdg-desktop-portal on Wayland.
try:
    import dbus
    from dbus.mainloop.glib import DBusGMainLoop
    HAS_DBUS = True
except ImportError:
    HAS_DBUS = False

# Load our specialized annotation objects and shared utility functions.
from annotations import Annotation
from utils import create_tool_icon, create_color_icon, load_settings, save_settings

# ──────────────────────────────────────────────────────────────────────────────
# APPLICATION STATE DEFINITIONS
# ──────────────────────────────────────────────────────────────────────────────

class AppState:
    """Simple enumeration to track if we are in the process of defining the capture 
    area or if we are actively drawing on a captured image."""
    SELECTING = 1
    ANNOTATING = 2

# ──────────────────────────────────────────────────────────────────────────────
# MAIN APPLICATION OVERLAY CLASS
# ──────────────────────────────────────────────────────────────────────────────

class ScreenshotOverlay(Gtk.Window):
    """The core of Mint Screenshot. This window manages the entire workflow: 
    from the initial launcher screen to the final annotation and save process."""
    
    def _on_size_changed(self, scale):
        """Updates the stroke width for the active tool and any currently selected 
        annotation whenever the size slider is moved."""
        self.line_width = int(scale.get_value())
        if self.selected_ann:
            self.selected_ann.width = self.line_width
            self.queue_draw()

    def _on_reset_clicked(self, widget):
        """Discards all current work, clears state, and returns the user to the 
        starting launcher screen after a confirmation prompt."""
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=Gtk.DialogFlags.MODAL,
            message_type=Gtk.MessageType.WARNING,
            buttons=Gtk.ButtonsType.OK_CANCEL,
            text=_("Reset Everything?")
        )
        dialog.format_secondary_text(_("This will clear all your annotations and return to the launcher screen."))
        response = dialog.run()
        dialog.destroy()
        
        if response == Gtk.ResponseType.OK:
            self.rect = None
            self.annotations = []
            self.selection_start = None
            self.selection_end = None
            self.state = None
            self.hide()
            if self.toolbar_box: 
                self.toolbar_box.hide()
                # We completely remove the toolbar so it resets its visual state 
                # (like tool labels) if settings changed.
                self.overlay.remove(self.toolbar_box)
                self.toolbar_box = None
            self._show_launcher()

    def _set_tool_if_active(self, btn, tool):
        """Switches the active drawing tool (e.g., Rectangle, Arrow) when its 
        respective toolbar button is toggled."""
        if btn.get_active():
            self.current_tool = tool
            self.selected_ann = None
            self.queue_draw()

    def _set_color_if_active(self, btn, color):
        """Changes the drawing color for new annotations and applies it immediately 
        to any currently selected object."""
        if btn.get_active():
            self.current_color = color
            if self.selected_ann:
                self.selected_ann.color = color
                self.queue_draw()

    # ──────────────────────────────────────────────────────────────────────────
    # INITIALIZATION AND STARTUP
    # ──────────────────────────────────────────────────────────────────────────

    def __init__(self, screenshot_path=None):
        """Initializes the application window, detects display geometry, 
        loads user preferences, and prepares the internal drawing state."""
        super().__init__(type=Gtk.WindowType.TOPLEVEL)
        self.screenshot_path = screenshot_path
        self.state = None
        self.timer_expanded = False
        self.is_wayland = IS_WAYLAND
        
        # Internal state for mouse tracking and selection geometry.
        self.selection_start = None
        self.selection_end = None
        self.rect = None
        self.annotations = []
        self.current_ann = None
        self.selected_ann = None 
        self.hovered_ann = None 
        self.edit_mode = None
        self.current_tool = 'select' 
        self.current_color = (0.2, 0.6, 1.0)
        self.line_width = 3
        self.mouse_pos = (0, 0)
        self.hovered_window = None
        self.is_full_capture = False
        
        # Load user preferences from ~/.config/mint-screenshot.json.
        self.settings = load_settings({
            'format': 'png',
            'quality': 'original',
            'save_path': os.path.expanduser("~/Pictures"),
            'show_labels': False
        })

        # Load project metadata from metadata.json for versioning and about info.
        self.metadata = self._load_project_metadata()

        # We detect the primary monitor to determine the window size.
        # On Wayland, this can sometimes fail initially, so we have fallbacks.
        display = Gdk.Display.get_default()
        monitor = display.get_primary_monitor()
        if monitor is None:
            monitor = display.get_monitor(0) if display.get_n_monitors() > 0 else None
        
        if monitor:
            geom = monitor.get_geometry()
            self.width = geom.width
            self.height = geom.height
        else:
            screen = Gdk.Screen.get_default()
            self.width = screen.get_width()
            self.height = screen.get_height()

        # HiDPI support: capture the scale factor early for correct surface scaling.
        self.scale = self.get_scale_factor()

        # Initialize the application backend and launcher.
        self._init_dbus()

    def _load_project_metadata(self):
        """Loads project metadata from metadata.json to ensure consistent versioning."""
        try:
            # Assuming metadata.json is in the same directory as main.py
            dir_path = os.path.dirname(os.path.realpath(__file__))
            meta_path = os.path.join(dir_path, "metadata.json")
            if os.path.exists(meta_path):
                with open(meta_path, 'r') as f:
                    return json.load(f)
        except Exception:
            pass
        return {
            "version": "1.2.0",
            "name": "Mint Screenshot",
            "author": "Khumnath CG",
            "website": "https://github.com/khumnath/mint-screenshot"
        }

    def _init_dbus(self):
        """Initialize D-Bus loop for Wayland portal callbacks."""
        if self.is_wayland and HAS_DBUS:
            DBusGMainLoop(set_as_default=True)
            
        self.full_pixbuf = None
        self._show_launcher()



    # ──────────────────────────────────────────────────────────────────────────
    # ERROR HANDLING AND FEEDBACK
    # ──────────────────────────────────────────────────────────────────────────

    def _show_wayland_error(self, message):
        """Displays a critical error dialog when the Wayland Desktop Portal 
        communication fails. This is usually due to missing permissions or 
        unsupported portal versions."""
        dialog = Gtk.MessageDialog(
            message_type=Gtk.MessageType.ERROR,
            buttons=Gtk.ButtonsType.OK,
            text=_("Mint Screenshot — Wayland Error")
        )
        dialog.format_secondary_text(message)
        dialog.run()
        dialog.destroy()

    # ──────────────────────────────────────────────────────────────────────────
    # LAUNCHER INTERFACE (START SCREEN)
    # ──────────────────────────────────────────────────────────────────────────

    def _show_launcher(self):
        """Creates and displays the initial entry-point window where the user 
        chooses their capture mode (Fullscreen, Area, or Timed)."""
        self.launcher = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
        self.launcher.set_decorated(True)
        self.launcher.set_title("Mint Screenshot")
        self.launcher.set_position(Gtk.WindowPosition.CENTER)
        self.launcher.set_resizable(False)

        # We use a Gtk.HeaderBar to match modern Linux desktop aesthetics.
        hb = Gtk.HeaderBar()
        hb.set_show_close_button(True)
        hb.set_title("Mint Screenshot")
        self.launcher.set_titlebar(hb)

        # The Hamburger menu contains all application settings to keep the 
        # main interface clean and focused.
        menu_btn = Gtk.MenuButton()
        menu_btn.set_image(Gtk.Image.new_from_icon_name("open-menu-symbolic", Gtk.IconSize.BUTTON))
        
        menu = Gtk.Menu()
        self._populate_settings_menu(menu)
        menu_btn.set_popup(menu)
        hb.pack_end(menu_btn)

        # Custom CSS for the premium 'Mint Dark' look.
        style_provider = Gtk.CssProvider()
        style_provider.load_from_data(b"""
            window {
                background: #1a1a2e;
            }
            .launcher-title {
                color: white;
                font-size: 18px;
                font-weight: bold;
            }
            .launcher-subtitle {
                color: rgba(255,255,255,0.5);
                font-size: 11px;
            }
            .launcher-btn {
                background: #16213e;
                color: white;
                border: 1px solid rgba(52, 152, 219, 0.5);
                border-radius: 10px;
                padding: 14px 20px;
                font-size: 14px;
                font-weight: bold;
            }
            .launcher-btn:hover {
                background: #1a2744;
                border-color: rgba(52, 152, 219, 0.9);
            }
            .timer-spin {
                background: #16213e;
                color: white;
                border: 1px solid rgba(52, 152, 219, 0.4);
                border-radius: 6px;
                padding: 4px;
            }
        """)
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(), style_provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        vbox.set_margin_top(15)
        vbox.set_margin_bottom(24)
        vbox.set_margin_start(24)
        vbox.set_margin_end(24)

        # Application title and server-mode indicator.
        title = Gtk.Label(label=_("Mint Screenshot"))
        title.get_style_context().add_class("launcher-title")
        vbox.pack_start(title, False, False, 0)

        subtitle_text = _("Wayland Mode — Capture via Desktop Portal") if self.is_wayland else _("X11 Mode — Instant Pixel Capture")
        subtitle = Gtk.Label(label=subtitle_text)
        subtitle.get_style_context().add_class("launcher-subtitle")
        vbox.pack_start(subtitle, False, False, 4)

        vbox.pack_start(Gtk.Separator(), False, False, 8)

        # Action Buttons
        btn_full = Gtk.Button(label=_("📸  Capture Fullscreen"))
        btn_full.get_style_context().add_class("launcher-btn")
        btn_full.connect("clicked", lambda b: self._capture(interactive=False))
        vbox.pack_start(btn_full, False, False, 0)

        btn_area = Gtk.Button(label=_("✂️  Select Area"))
        btn_area.get_style_context().add_class("launcher-btn")
        btn_area.connect("clicked", lambda b: self._capture(interactive=True))
        vbox.pack_start(btn_area, False, False, 0)

        # Timed capture controls
        timer_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        btn_timer = Gtk.Button(label=_("⏱  Timed Capture"))
        btn_timer.get_style_context().add_class("launcher-btn")
        btn_timer.set_hexpand(True)
        self._wayland_timer_spin = Gtk.SpinButton.new_with_range(1, 60, 1)
        self._wayland_timer_spin.set_value(3)
        self._wayland_timer_spin.get_style_context().add_class("timer-spin")
        sec_label = Gtk.Label(label=_("sec"))
        sec_label.set_markup(f'<span foreground="white">{_("sec")}</span>')
        timer_box.pack_start(btn_timer, True, True, 0)
        timer_box.pack_start(self._wayland_timer_spin, False, False, 0)
        timer_box.pack_start(sec_label, False, False, 0)
        btn_timer.connect("clicked", lambda b: self._timed_capture(
            int(self._wayland_timer_spin.get_value())))
        vbox.pack_start(timer_box, False, False, 0)

        vbox.pack_start(Gtk.Separator(), False, False, 4)

        btn_close = Gtk.Button(label=_("Close"))
        btn_close.connect("clicked", lambda b: Gtk.main_quit())
        vbox.pack_start(btn_close, False, False, 0)

        self.launcher.add(vbox)
        self.launcher.connect("key-press-event", lambda w, e: Gtk.main_quit() if e.keyval == Gdk.KEY_Escape else None)
        self.launcher.connect("destroy", lambda w: Gtk.main_quit())
        self.launcher.show_all()

    # ──────────────────────────────────────────────────────────────────────────
    # CAPTURE BACKENDS (WAYLAND PORTAL & X11)
    # ──────────────────────────────────────────────────────────────────────────

    def _capture(self, interactive=False):
        """Dispatches the screenshot request to the appropriate backend based 
        on the current display server (Wayland Portals or X11 Pixel Read)."""
        if hasattr(self, 'launcher') and self.launcher:
            self.launcher.hide()
            
        self._wants_selection = interactive
        self.is_full_capture = not interactive
        
        if self.is_wayland:
            # Short delay to ensure the launcher window is hidden before the 
            # compositor freezes the screen for the portal.
            GLib.timeout_add(200, lambda: self._portal_screenshot(interactive=False))
        else:
            GLib.timeout_add(200, self._x11_screenshot)

    def _timed_capture(self, seconds):
        """Starts a countdown timer for a delayed screenshot capture."""
        if hasattr(self, 'launcher') and self.launcher:
            self.launcher.hide()
        self._countdown_remaining = seconds
        self._countdown_win = self._create_countdown_window(seconds)
        self._countdown_win.show_all()
        GLib.timeout_add(1000, self._tick_countdown_launcher)

    def _tick_countdown_launcher(self):
        """Updates the visual countdown indicator every second until it reaches zero."""
        self._countdown_remaining -= 1
        if self._countdown_remaining <= 0:
            if self._countdown_win:
                self._countdown_win.destroy()
                self._countdown_win = None
                
            self._wants_selection = False
            
            if self.is_wayland:
                GLib.timeout_add(250, lambda: self._portal_screenshot(interactive=False))
            else:
                GLib.timeout_add(250, self._x11_screenshot)
            return False
            
        if self._countdown_win:
            self._countdown_win.queue_draw()
        return True

    def _x11_screenshot(self):
        """Captures the screen pixels directly from the X11 root window. 
        This is instant and doesn't require any permissions."""
        display = Gdk.Display.get_default()
        monitor = display.get_primary_monitor()
        geom = monitor.get_geometry()
        window = Gdk.get_default_root_window()
        self.full_pixbuf = Gdk.pixbuf_get_from_window(window, geom.x, geom.y, window.get_width(), window.get_height())
        self._open_annotator()
        return False

    def _portal_screenshot(self, interactive=False):
        """Communicates with org.freedesktop.portal.Screenshot to securely 
        capture the screen on Wayland-based desktops."""
        try:
            bus = dbus.SessionBus()
            token = secrets.token_hex(8)
            sender = bus.get_unique_name().replace('.', '_').replace(':', '')
            request_path = f"/org/freedesktop/portal/desktop/request/{sender}/{token}"

            # We must listen for the response signal BEFORE making the request.
            bus.add_signal_receiver(
                self._on_portal_response,
                signal_name="Response",
                dbus_interface="org.freedesktop.portal.Request",
                path=request_path
            )

            obj = bus.get_object(
                "org.freedesktop.portal.Desktop",
                "/org/freedesktop/portal/desktop"
            )
            iface = dbus.Interface(obj, "org.freedesktop.portal.Screenshot")

            options = dbus.Dictionary({
                "handle_token": dbus.String(token),
                "interactive": dbus.Boolean(interactive),
            }, signature="sv")

            iface.Screenshot("", options)
        except Exception as e:
            self._show_wayland_error(f"Portal screenshot failed:\n{e}")
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
        return False

    def _on_portal_response(self, response, results):
        """Handles the async signal sent back by the desktop portal once 
        the user has completed the screenshot capture."""
        if response != 0:
            # Re-show the launcher if the user cancelled the portal dialog.
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
            return

        uri = str(results.get("uri", ""))
        if not uri:
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
            return

        # Translate the portal's URI into a standard filesystem path.
        gfile = Gio.File.new_for_uri(uri)
        path = gfile.get_path()

        if not path or not os.path.exists(path):
            # Sometimes there's a slight race condition between file writing 
            # and the signal; we retry once to be safe.
            GLib.timeout_add(300, self._try_load_portal_capture, uri)
            return

        self._load_portal_image(path)

    def _try_load_portal_capture(self, uri):
        """Retries loading a portal capture if the file wasn't ready immediately."""
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
        """Loads the image file saved by the portal into our annotation engine."""
        try:
            self.full_pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
        except Exception as e:
            self._show_wayland_error(f"Failed to load captured screenshot:\n{e}")
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
            return

        # Set rect to full image size
        self.rect = (0, 0, self.full_pixbuf.get_width(), self.full_pixbuf.get_height())
        self.width = self.full_pixbuf.get_width()
        self.height = self.full_pixbuf.get_height()

        # Transition to annotation mode in a regular window
        self._open_annotator()

    def _load_portal_image(self, path):
        """Loads the image file saved by the portal into our internal buffer 
        and switches the application state to the annotation editor."""
        try:
            self.full_pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
        except Exception as e:
            self._show_wayland_error(f"Failed to load captured screenshot:\n{e}")
            if hasattr(self, 'launcher') and self.launcher:
                self.launcher.show()
            return

        # Initialize the capture rectangle to match the full image dimensions.
        self.rect = (0, 0, self.full_pixbuf.get_width(), self.full_pixbuf.get_height())
        self.width = self.full_pixbuf.get_width()
        self.height = self.full_pixbuf.get_height()

        # We now transition from the 'captured' file to the interactive editor.
        self._open_annotator()

    # ──────────────────────────────────────────────────────────────────────────
    # ANNOTATOR LIFECYCLE (EDITOR SETUP)
    # ──────────────────────────────────────────────────────────────────────────

    def _open_annotator(self):
        """Prepares the fullscreen interactive overlay window where the user 
        can select areas and draw annotations."""
        # Determine if we start in 'Area Selection' or 'Direct Annotation' mode.
        self.state = AppState.SELECTING if getattr(self, '_wants_selection', False) else AppState.ANNOTATING

        # We want a borderless, always-on-top window that spans the entire screen.
        self.set_decorated(False)
        self.set_keep_above(True)
        self.set_type_hint(Gdk.WindowTypeHint.UTILITY)
        
        # Enable alpha support for the blured background effect.
        self.set_app_paintable(True)
        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        if visual:
            self.set_visual(visual)
            
        self.fullscreen_on_monitor(screen, 0)
        
        # Clean up any residual widgets (like the launcher) before building the editor UI.
        for child in self.get_children():
            self.remove(child)

        # We use an Overlay to place the toolbar and hints on top of the drawing area.
        self.overlay = Gtk.Overlay()
        self.add(self.overlay)
        
        # The EventBox acts as our canvas, receiving all mouse interactions.
        self.draw_area = Gtk.EventBox()
        self.draw_area.set_app_paintable(True)
        self.draw_area.connect("draw", self.on_draw)
        self.overlay.add(self.draw_area)

        # Listen for clicks and drags.
        self.draw_area.add_events(Gdk.EventMask.BUTTON_PRESS_MASK |
                        Gdk.EventMask.BUTTON_RELEASE_MASK |
                        Gdk.EventMask.POINTER_MOTION_MASK)
        
        self.draw_area.connect("button-press-event", self.on_button_press)
        self.draw_area.connect("button-release-event", self.on_button_release)
        self.draw_area.connect("motion-notify-event", self.on_motion_notify)
        
        # Keyboard shortcuts (like ESC or Ctrl+Z) are handled at the window level.
        self.add_events(Gdk.EventMask.KEY_PRESS_MASK)
        try:
            self.disconnect_by_func(self.on_key_press)
        except Exception:
            pass
        self.connect("key-press-event", self.on_key_press)

        # Initialize and display the annotation toolbar.
        self.toolbar_box = None
        self._show_toolbar()
        self.rect = None
        
        if self.state == AppState.ANNOTATING:
            self.rect = (0, 0, self.width, self.height)

        self.show_all()

    # ──────────────────────────────────────────────────────────────────────────
    # DELAYED CAPTURE AND TIMERS
    # ──────────────────────────────────────────────────────────────────────────

    def _on_timer_clicked(self, seconds):
        """Hides the editor so the user can see their desktop, then starts 
        the countdown for a new capture."""
        self.timer_expanded = False
        self.hide()
        self._countdown_remaining = seconds
        self._countdown_win = self._create_countdown_window(seconds)
        self._countdown_win.show_all()
        GLib.timeout_add(1000, self._tick_countdown)

    def _prompt_custom_timer(self):
        """Displays a dialog allowing the user to enter a precise delay in seconds."""
        dialog = Gtk.Dialog(
            title="Custom Timer",
            transient_for=self,
            modal=True
        )
        dialog.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                           Gtk.STOCK_OK, Gtk.ResponseType.OK)
        dialog.set_default_response(Gtk.ResponseType.OK)

        box = dialog.get_content_area()
        box.set_spacing(10)
        box.set_margin_start(15)
        box.set_margin_end(15)
        box.set_margin_top(10)

        label = Gtk.Label(label="Enter delay in seconds:")
        box.add(label)

        spin = Gtk.SpinButton.new_with_range(1, 999, 1)
        spin.set_value(5)
        spin.set_activates_default(True)
        box.add(spin)

        dialog.show_all()
        response = dialog.run()
        seconds = int(spin.get_value())
        dialog.destroy()

        if response == Gtk.ResponseType.OK and seconds > 0:
            self._on_timer_clicked(seconds)

    def _create_countdown_window(self, seconds):
        """Creates a small, semi-transparent overlay 'pill' that shows the 
        remaining time on top of all other windows."""
        # On Wayland, we must use TOPLEVEL with UTILITY hints to ensure 
        # the window manager allows us to stay on top.
        if self.is_wayland:
            win = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
            win.set_type_hint(Gdk.WindowTypeHint.UTILITY)
        else:
            win = Gtk.Window(type=Gtk.WindowType.POPUP)
        win.set_keep_above(True)
        win.set_decorated(False)
        win.set_app_paintable(True)
        win.set_accept_focus(False)

        # Transparency
        screen = win.get_screen()
        visual = screen.get_rgba_visual()
        if visual:
            win.set_visual(visual)

        # Size and position (top-center)
        pill_w, pill_h = 180, 60
        display = Gdk.Display.get_default()
        monitor = display.get_primary_monitor()
        if not monitor: monitor = display.get_monitor(0)
        
        if monitor:
            geom = monitor.get_geometry()
            win.set_size_request(pill_w, pill_h)
            win.move(geom.x + geom.width // 2 - pill_w // 2, geom.y + 30)
        else:
            win.set_size_request(pill_w, pill_h)

        # Use a DrawingArea instead of drawing directly on the Window.
        # This is strictly required for Wayland to actually map and render the transparent window!
        da = Gtk.DrawingArea()
        da.connect("draw", self._draw_countdown)
        win.add(da)
        
        return win

    def _draw_countdown(self, widget, cr):
        """Renders the countdown pill UI using Cairo. This includes the 
        rounded background, the blue border, a camera icon, and the time text."""
        w = widget.get_allocated_width()
        h = widget.get_allocated_height()
        r = 16  # Corner radius for the pill.

        # We start by clearing the surface to be fully transparent.
        cr.set_operator(cairo.Operator.SOURCE)
        cr.set_source_rgba(0, 0, 0, 0)
        cr.paint()
        cr.set_operator(cairo.Operator.OVER)

        # Draw the main rounded rectangle pill background.
        cr.new_sub_path()
        cr.arc(w - r, r, r, -math.pi/2, 0)
        cr.arc(w - r, h - r, r, 0, math.pi/2)
        cr.arc(r, h - r, r, math.pi/2, math.pi)
        cr.arc(r, r, r, math.pi, 3*math.pi/2)
        cr.close_path()
        
        # Fill with a semi-transparent dark gray and add a Mint Blue border.
        cr.set_source_rgba(0.1, 0.1, 0.1, 0.85)
        cr.fill_preserve()
        cr.set_source_rgba(52/255, 152/255, 219/255, 0.8)
        cr.set_line_width(2)
        cr.stroke()

        # Draw a simple stylized camera icon on the left.
        cr.set_source_rgba(1, 1, 1, 0.7)
        cr.set_line_width(1.5)
        cr.rectangle(15, h/2 - 8, 20, 16)
        cr.stroke()
        cr.arc(25, h/2, 5, 0, 2*math.pi)
        cr.stroke()

        # Render the large 'Seconds Remaining' text.
        secs = getattr(self, '_countdown_remaining', 0)
        cr.set_source_rgb(1, 1, 1)
        cr.select_font_face("Sans", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
        cr.set_font_size(28)
        text = f"{secs}s"
        ext = cr.text_extents(text)
        cr.move_to(55, h/2 + ext.height/2)
        cr.show_text(text)

        # Add a smaller 'capturing...' status label.
        cr.set_source_rgba(1, 1, 1, 0.5)
        cr.set_font_size(11)
        label = "capturing..."
        lext = cr.text_extents(label)
        cr.move_to(w - lext.width - 14, h/2 + lext.height/2)
        cr.show_text(label)

    def _tick_countdown(self):
        """Invoked every 1000ms by the GLib timer to decrement the countdown. 
        When it hits zero, it triggers the actual screen capture."""
        self._countdown_remaining -= 1
        if self._countdown_remaining <= 0:
            # We destroy the pill window first to ensure it's not in the screenshot.
            if self._countdown_win:
                self._countdown_win.destroy()
                self._countdown_win = None
            # A 250ms pause gives the window manager enough time to hide the pill.
            GLib.timeout_add(250, self._take_delayed_screenshot)
            return False
        
        if self._countdown_win:
            self._countdown_win.queue_draw()
        return True

    def _take_delayed_screenshot(self):
        """Executed once the timer reaches zero. Finalizes the capture and 
        enters the annotation editor."""
        if getattr(self, 'is_wayland', False):
            self._wants_selection = False
            self.is_full_capture = True
            self._portal_screenshot(interactive=False)
            return False

        # X11 Direct Capture fallback for timed screenshots.
        display = Gdk.Display.get_default()
        monitor = display.get_primary_monitor()
        geom = monitor.get_geometry()
        window = Gdk.get_default_root_window()
        self.full_pixbuf = Gdk.pixbuf_get_from_window(window, geom.x, geom.y, window.get_width(), window.get_height())
        self.rect = (0, 0, self.width, self.height)
        self.is_full_capture = True
        self.state = AppState.ANNOTATING
        self.show()
        if self.toolbar_box: self.toolbar_box.show_all()
        self.queue_draw()
        return False

    # ──────────────────────────────────────────────────────────────────────────
    # CORE RENDERING ENGINE (CAIRO)
    # ──────────────────────────────────────────────────────────────────────────

    def on_draw(self, widget, cr):
        """The main paint routine. It handles drawing the frozen screen background, 
        area selection UI, and all interactive annotations."""
        allocation = widget.get_allocation()
        
        # We start with a black void and then paint the frozen screen buffer on top.
        cr.set_source_rgb(0, 0, 0)
        cr.paint()
        
        if self.full_pixbuf:
            # We create a Cairo surface from our pixbuf, respecting the scale factor.
            surface = Gdk.cairo_surface_create_from_pixbuf(self.full_pixbuf, self.scale, self.get_window())
            cr.set_source_surface(surface, 0, 0)
            cr.paint()

        if self.state == AppState.SELECTING:
            # In selection mode, we dim the entire screen slightly to make 
            # the 'active' area pop out.
            cr.set_source_rgba(0, 0, 0, 0.5)
            cr.paint()

            if self.selection_start and self.selection_end:
                # The selected area reveals the underlying frozen snapshot 
                # in full brightness.
                x, y, w, h = self._get_rect(self.selection_start, self.selection_end)
                
                cr.save()
                cr.rectangle(x, y, w, h)
                cr.clip()
                cr.set_source_surface(surface, 0, 0)
                cr.paint()
                cr.restore()
                
                # Draw a highlight border around the selection.
                cr.set_source_rgba(52/255.0, 152/255.0, 219/255.0, 0.8)
                cr.set_line_width(1)
                cr.rectangle(x, y, w, h)
                cr.stroke()
            else:
                # If no selection is active, show the 'Click and Drag' hint.
                cr.set_font_size(20)
                hint = "Click and Drag to select area"
                ext = cr.text_extents(hint)
                cr.move_to(allocation.width/2 - ext.width/2, 110)
                
                # Draw a subtle blue outline to ensure visibility on light backgrounds.
                cr.text_path(hint)
                cr.set_source_rgba(52/255.0, 152/255.0, 219/255.0, 0.8)
                cr.set_line_width(0.8)
                cr.stroke_preserve()
                
                cr.set_source_rgba(1, 1, 1, 1)
                cr.fill()
        
        elif self.state == AppState.ANNOTATING:
            x, y, w, h = self.rect
            # We use the 'Even-Odd' fill rule to dim everything *except* 
            # our capture rectangle.
            cr.save()
            cr.set_fill_rule(cairo.FillRule.EVEN_ODD)
            cr.set_source_rgba(0, 0, 0, 0.4)
            cr.rectangle(0, 0, allocation.width, allocation.height)
            cr.rectangle(x, y, w, h)
            cr.fill()
            cr.restore()
            
            # Draw the definitive capture frame.
            cr.set_source_rgb(0, 0.6, 1.0)
            cr.set_line_width(1)
            cr.rectangle(x, y, w, h)
            cr.stroke()
            
            # Helper to render the small squares at the corners of the capture area.
            def draw_handle(hx, hy):
                cr.rectangle(hx - 4, hy - 4, 8, 8)
                cr.fill()
                cr.set_source_rgb(0, 0.6, 1.0)
                cr.set_line_width(1)
                cr.rectangle(hx - 4, hy - 4, 8, 8)
                cr.stroke()
                cr.set_source_rgb(1, 1, 1) # Reset to white for next handle
            
            cr.set_source_rgb(1, 1, 1)
            draw_handle(x, y)
            draw_handle(x + w/2, y)
            draw_handle(x + w, y)
            draw_handle(x, y + h/2)
            draw_handle(x + w, y + h/2)
            draw_handle(x, y + h)
            draw_handle(x + w/2, y + h)
            draw_handle(x + w, y + h)

            # Finally, render all annotations (shapes, text, arrows).
            for ann in self.annotations:
                self._draw_annotation(cr, ann)
            
            # If the user is currently dragging/drawing, show the live preview.
            if self.current_ann:
                self._draw_annotation(cr, self.current_ann)

    def _draw_launcher_btn(self, cr, bx, by, bw, bh, text, is_primary=True, icon=None):
        mx, my = getattr(self, 'mouse_pos', (0, 0))
        is_hover = (bx <= mx <= bx + bw and by <= my <= by + bh)
        
        # Shadow
        cr.set_source_rgba(0, 0, 0, 0.4)
        cr.rectangle(bx+3, by+4, bw, bh); cr.fill()
        
        # Body
        if is_hover:
            color = (80, 80, 80) if is_primary else (60, 60, 60)
        else:
            color = (40, 40, 40) if is_primary else (30, 30, 30)
        cr.set_source_rgba(color[0]/255.0, color[1]/255.0, color[2]/255.0, 0.95)
        cr.rectangle(bx, by, bw, bh); cr.fill()
        
        # Border
        accent = (52, 152, 219) if is_primary else (150, 150, 150)
        cr.set_source_rgba(accent[0]/255.0, accent[1]/255.0, accent[2]/255.0, 0.8 if is_hover else 0.5)
        cr.set_line_width(2)
        cr.rectangle(bx, by, bw, bh); cr.stroke()
        
        # Icon or Text
        if icon:
            pix = create_tool_icon(icon, size=32)
            cr.save()
            Gdk.cairo_set_source_pixbuf(cr, pix, bx + (bw-32)/2, by + (bh-32)/2)
            cr.paint()
            cr.restore()
        elif text:
            cr.set_source_rgb(1, 1, 1)
            cr.select_font_face("Sans", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
            cr.set_font_size(22)
            ext = cr.text_extents(text)
            cr.move_to(bx + bw/2 - ext.width/2, by + bh/2 + 8)
            cr.show_text(text)

    # ──────────────────────────────────────────────────────────────────────────
    # GEOMETRY AND HIT DETECTION
    # ──────────────────────────────────────────────────────────────────────────

    def _get_rect(self, start, end, force_square=False, ann=None):
        """Calculates a normalized (x, y, width, height) rectangle from two 
        points. Can optionally force the shape to be a perfect square."""
        x1, y1 = start
        x2, y2 = end
        
        # Text annotations determine their size based on the rendered Pango layout.
        if ann and ann.type == 'text':
            layout = self.create_pango_layout(ann.text)
            font_size = 10 + (ann.width * 3)
            font = Pango.FontDescription(f"Sans Bold {font_size}")
            layout.set_font_description(font)
            width, height = layout.get_pixel_size()
            return (x1, y1, width, height)

        # Calculate standard bounding box.
        x = min(x1, x2)
        y = min(y1, y2)
        w = abs(x1 - x2)
        h = abs(y1 - y2)
        
        # Square constraints are useful for perfect circles or squares during creation.
        if force_square:
            size = max(w, h)
            w = size
            h = size
            
        return (x, y, w, h)

    def _undo(self):
        """Removes the most recently added annotation from the stack."""
        if self.annotations:
            self.annotations.pop()
            self.queue_draw()

    def _find_ann_at(self, x, y):
        """Iterates through the annotation stack to find which object (if any) 
        is located at the given coordinates. Returns the topmost object found."""
        for ann in reversed(self.annotations):
            ax, ay, aw, ah = self._get_rect(ann.start, ann.end, force_square=False, ann=ann)
            # We add a 15px 'grace' margin to make selecting thin lines much easier.
            if ax - 15 <= x <= ax + aw + 15 and ay - 15 <= y <= ay + ah + 15:
                return ann
        return None

    def _get_crop_handle_at(self, x, y):
        """Identifies if the mouse is hovering over one of the eight resizing 
        handles of the capture rectangle."""
        if not self.rect: return None
        rx, ry, rw, rh = self.rect
        margin = 15 # The area around the handle where we accept a click.
        
        # Prioritize corners.
        if abs(x - rx) <= margin and abs(y - ry) <= margin: return 'nw'
        if abs(x - (rx + rw)) <= margin and abs(y - ry) <= margin: return 'ne'
        if abs(x - rx) <= margin and abs(y - (ry + rh)) <= margin: return 'sw'
        if abs(x - (rx + rw)) <= margin and abs(y - (ry + rh)) <= margin: return 'se'
        
        # Check edges.
        if ry - margin <= y <= ry + margin and rx <= x <= rx + rw: return 'n'
        if (ry + rh) - margin <= y <= (ry + rh) + margin and rx <= x <= rx + rw: return 's'
        if rx - margin <= x <= rx + margin and ry <= y <= ry + rh: return 'w'
        if (rx + rw) - margin <= x <= (rx + rw) + margin and ry <= y <= ry + rh: return 'e'
        
        return None

    def _update_cursor(self):
        """Updates the system mouse cursor to provide visual feedback for 
        resizing or moving actions."""
        window = self.get_window()
        if not window: return
        display = window.get_display()
        cursor_name = "default"
        
        handle = getattr(self, 'hovered_crop_handle', None)
        outside = getattr(self, 'hovered_crop_outside', False)
        
        # Map our internal handle names to standard XDG cursor names.
        if handle:
            if handle in ['nw', 'se']: cursor_name = "nwse-resize"
            elif handle in ['ne', 'sw']: cursor_name = "nesw-resize"
            elif handle in ['n', 's']: cursor_name = "ns-resize"
            elif handle in ['e', 'w']: cursor_name = "ew-resize"
        elif outside:
            cursor_name = "move"
        
        cursor = Gdk.Cursor.new_from_name(display, cursor_name)
        window.set_cursor(cursor)

    def _draw_context_toolbar(self, cr, ann):
        ax, ay, aw, ah = self._get_rect(ann.start, ann.end, force_square=False, ann=ann)
        cx = ax + aw/2
        ty = ay - 45
        
        # Two buttons for everything now (Text: Pen/Rot, Shapes: Res/Rot)
        is_text = (ann.type == 'text')
        
        # Draw background bubble
        cr.save()
        cr.identity_matrix()
        width = 75
        cr.set_source_rgba(0.1, 0.1, 0.1, 0.95)
    # ──────────────────────────────────────────────────────────────────────────
    # CONTEXT TOOLBAR (FLOATING OBJECT CONTROLS)
    # ──────────────────────────────────────────────────────────────────────────

    def _draw_context_toolbar(self, cr, ann):
        """Renders the small floating toolbar above a selected annotation, 
        providing quick access to Resize, Rotate, or Edit tools."""
        ax, ay, aw, ah = self._get_rect(ann.start, ann.end, force_square=False, ann=ann)
        cx = ax + aw/2
        ty = ay - 45 # Position the toolbar 45px above the object.
        
        is_text = (ann.type == 'text')
        
        cr.save()
        cr.identity_matrix() # Ensure the toolbar itself isn't rotated with the object.
        
        # Draw the semi-transparent dark bubble.
        width = 75
        cr.set_source_rgba(0.1, 0.1, 0.1, 0.95)
        cr.rectangle(cx - width/2, ty, width, 32)
        cr.fill()
        
        # Add a Mint Blue accent border.
        cr.set_source_rgba(52/255.0, 152/255.0, 219/255.0, 0.8)
        cr.set_line_width(1.5)
        cr.rectangle(cx - width/2, ty, width, 32)
        cr.stroke()
        
        # Render the icons based on the object type.
        if is_text:
            self._draw_mini_icon(cr, cx - 18, ty + 16, 'edit', self.edit_mode == 'edit')
            self._draw_mini_icon(cr, cx + 18, ty + 16, 'rotate', self.edit_mode == 'rotate')
        else:
            self._draw_mini_icon(cr, cx - 18, ty + 16, 'resize', self.edit_mode == 'resize')
            self._draw_mini_icon(cr, cx + 18, ty + 16, 'rotate', self.edit_mode == 'rotate')
        cr.restore()

    def _draw_mini_icon(self, cr, x, y, type, active):
        """Helper to paint a single small tool icon within the context toolbar."""
        pix = create_tool_icon(type, size=20, active=active)
        cr.save()
        Gdk.cairo_set_source_pixbuf(cr, pix, x-10, y-10)
        cr.paint()
        cr.restore()

    def _get_context_btn_at(self, ann, x, y):
        """Identifies if the user clicked one of the buttons in the floating 
        context toolbar."""
        ax, ay, aw, ah = self._get_rect(ann.start, ann.end, force_square=False, ann=ann)
        cx = ax + aw/2
        ty = ay - 45
        
        if ty <= y <= ty + 32:
            if cx - 38 <= x <= cx:
                return 'edit' if ann.type == 'text' else 'resize'
            if cx <= x <= cx + 38:
                return 'rotate'
        return None

    # ──────────────────────────────────────────────────────────────────────────
    # ANNOTATION RENDERING
    # ──────────────────────────────────────────────────────────────────────────

    def _draw_annotation(self, cr, ann):
        """Renders a single annotation object, handling its rotation, 
        highlights, and specialized drawing logic for its type."""
        ax, ay, aw, ah = self._get_rect(ann.start, ann.end, force_square=False, ann=ann)
        cx = ax + aw/2
        cy = ay + ah/2

        # Draw a faint blue glow when the mouse hovers over an object.
        if ann == self.hovered_ann and ann != self.selected_ann:
            cr.save()
            cr.translate(cx, cy)
            cr.rotate(ann.angle)
            cr.translate(-cx, -cy)
            cr.set_source_rgba(52, 152, 219, 0.15)
            cr.set_line_width(ann.width + 6)
            if ann.type == 'rect': cr.rectangle(ax, ay, aw, ah)
            elif ann.type == 'ellipse':
                cr.save()
                cr.translate(ax + aw/2, ay + ah/2)
                cr.scale(aw/2, ah/2)
                cr.arc(0, 0, 1, 0, 2*math.pi)
                cr.restore()
            cr.stroke()
            cr.restore()

        # If the object is selected, we draw the context toolbar and 
        # a dashed selection border around it.
        if ann == self.selected_ann:
            self._draw_context_toolbar(cr, ann)
            
            cr.save()
            cr.translate(cx, cy)
            cr.rotate(ann.angle)
            cr.translate(-cx, -cy)
            
            # Subtle background tint for the selected area.
            cr.set_source_rgba(0.2, 0.6, 1.0, 0.1)
            cr.rectangle(ax-4, ay-4, aw+8, ah+8)
            cr.fill()
            
            # Dashed highlight border.
            cr.set_source_rgba(0.2, 0.6, 1.0, 0.8)
            cr.set_dash([4, 4])
            cr.set_line_width(1.5)
            cr.rectangle(ax-4, ay-4, aw+8, ah+8)
            cr.stroke()
            cr.restore()

        # Finally, perform the actual drawing of the shape or text.
        cr.save()
        cr.translate(cx, cy)
        cr.rotate(ann.angle)
        cr.translate(-cx, -cy)
        
        cr.set_source_rgb(*ann.color)
        cr.set_line_width(ann.width)
        
        # Use local rect for drawing
        if ann.type == 'rect':
            cr.rectangle(ax, ay, aw, ah)
            cr.stroke()
        elif ann.type == 'arrow':
            self._draw_arrow(cr, ann.start[0], ann.start[1], ann.end[0], ann.end[1])
        elif ann.type == 'ellipse':
            cr.save()
            cr.translate(ax + aw/2, ay + ah/2)
            cr.scale(aw/2, ah/2)
            cr.arc(0, 0, 1, 0, 2*math.pi)
            cr.restore()
            cr.stroke()
        elif ann.type == 'text':
            if hasattr(ann, 'text'):
                layout = self.create_pango_layout(ann.text)
                font_size = 10 + (ann.width * 3)
                font = Pango.FontDescription(f"Sans Bold {font_size}")
                layout.set_font_description(font)
                cr.move_to(ax, ay)
                PangoCairo.show_layout(cr, layout)
        cr.restore()

    # ──────────────────────────────────────────────────────────────────────────
    # ANNOTATION UTILITIES
    # ──────────────────────────────────────────────────────────────────────────

    def _draw_arrow(self, cr, x1, y1, x2, y2):
        """Renders a directional arrow with a pointed tip. The tip's rotation 
        is calculated dynamically based on the line's angle."""
        angle = math.atan2(y2 - y1, x2 - x1)
        arrow_size = 15 # The length of the arrow head wings.
        
        # Draw the main shaft of the arrow.
        cr.move_to(x1, y1)
        cr.line_to(x2, y2)
        cr.stroke()
        
        # Draw the solid triangle head.
        cr.save()
        cr.translate(x2, y2)
        cr.rotate(angle)
        cr.move_to(0, 0)
        cr.line_to(-arrow_size, arrow_size/2)
        cr.line_to(-arrow_size, -arrow_size/2)
        cr.close_path()
        cr.fill()
        cr.restore()

    def _prompt_text(self, x, y, ann=None):
        """Displays a dialog for entering or editing annotation text. For new 
        text, it calculates an 'adaptive' font size based on the total 
        screen resolution."""
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=0,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.OK_CANCEL,
            text="Edit Text:" if ann else "Enter text to insert:"
        )
        entry = Gtk.Entry()
        if ann: entry.set_text(ann.text)
        entry.set_activates_default(True)
        dialog.get_content_area().add(entry)
        dialog.show_all()
        
        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            text = entry.get_text()
            if text:
                if ann:
                    ann.text = text
                else:
                    if self.state == AppState.ANNOTATING:
                        # We calculate a font size that feels natural relative 
                        # to the screenshot's dimensions.
                        sw, sh = self.rect[2], self.rect[3]
                        diag = math.sqrt(sw*sw + sh*sh)
                        adaptive_size = max(3, int(diag / 150))
                        
                        new_ann = Annotation('text', (x, y), (x+10, y+10), self.current_color, adaptive_size)
                        new_ann.text = text
                        self.annotations.append(new_ann)
                self.queue_draw()
        dialog.destroy()

    # ──────────────────────────────────────────────────────────────────────────
    # MOUSE INTERACTION HANDLERS
    # ──────────────────────────────────────────────────────────────────────────

    def on_button_press(self, widget, event):
        """Handles the initial mouse click. This is the 'brain' of the 
        interaction, deciding whether to start a selection, move an object, 
        resize a frame, or start a new drawing."""
        if event.button != 1: return # We only care about left-clicks.

        # If we are in the initial 'Select Area' phase, just record the start point.
        if self.state == AppState.SELECTING:
            self.selection_start = (event.x, event.y)
            return

        # In the annotation phase, we have multiple possible targets for a click.
        if self.state == AppState.ANNOTATING:
            # First, check if the user is clicking on a resize handle of the 
            # main capture frame.
            handle = getattr(self, 'hovered_crop_handle', None)
            outside = getattr(self, 'hovered_crop_outside', False)
            
            if handle and not self.selected_ann:
                self.active_crop_handle = handle
                self.crop_drag_start_rect = self.rect
                self.crop_drag_start_pos = (event.x, event.y)
                return
            elif outside and not self.selected_ann:
                # Clicking outside the crop area allows moving the entire frame.
                self.active_crop_handle = 'move'
                self.crop_drag_start_rect = self.rect
                self.crop_drag_start_pos = (event.x, event.y)
                return
                
            # Second, check if they are clicking a button on the floating 
            # object toolbar (for Resizing, Rotating, or Editing text).
            if self.selected_ann:
                btn = self._get_context_btn_at(self.selected_ann, event.x, event.y)
                if btn:
                    if btn == 'edit' and self.selected_ann.type == 'text':
                        self._prompt_text(event.x, event.y, ann=self.selected_ann)
                    elif btn == 'resize':
                        self.active_handle = 'resize_icon'
                    elif btn == 'rotate':
                        self.active_handle = 'rot'
                    
                    self.drag_start_pos = (event.x, event.y)
                    self.ann_original_pos = (self.selected_ann.start, self.selected_ann.end)
                    self.queue_draw()
                    return

            # Third, check if they are clicking directly on an existing annotation 
            # to select it or start moving it.
            found = self._find_ann_at(event.x, event.y)
            if found:
                self.selected_ann = found
                self.active_handle = 'move'
                self.drag_start_pos = (event.x, event.y)
                self.ann_original_pos = (found.start, found.end)
                self.queue_draw()
                return
            else:
                self.selected_ann = None

            # Finally, if nothing was clicked, start a new drawing or a new area 
            # selection based on the active tool.
            if self.current_tool == 'select':
                if not self.is_full_capture:
                    self.selection_start = (event.x, event.y)
                    if self.toolbar_box: self.toolbar_box.hide()
                return # In full capture mode, select tool only selects/moves objects
            elif self.current_tool == 'text':
                self._prompt_text(event.x, event.y)
            else:
                self.current_ann = Annotation(self.current_tool, (event.x, event.y), (event.x, event.y), self.current_color, self.line_width)
            
            self.queue_draw()
            return



    def on_button_release(self, widget, event):
        """Finalizes any active drag, resize, or drawing operation."""
        if event.button == 1:
            # Reset all temporary drag states.
            if getattr(self, 'active_crop_handle', None):
                self.active_crop_handle = None
                self.crop_drag_start_rect = None
                self.crop_drag_start_pos = None
                self.queue_draw()
                return
                
            if hasattr(self, 'active_handle'):
                delattr(self, 'active_handle')
                delattr(self, 'drag_start_pos')
                return
            if hasattr(self, 'drag_start_pos'):
                delattr(self, 'drag_start_pos')
                return
                
            # If we were dragging a selection area, finalize the capture rectangle.
            if self.state == AppState.SELECTING or (self.state == AppState.ANNOTATING and self.current_tool == 'select' and self.selection_start):
                if self.selection_start:
                    x, y, w, h = self._get_rect(self.selection_start, (event.x, event.y))
                    self.rect = (x, y, max(w, 1), max(h, 1))
                
                # If the selection is large enough, we transition to annotation mode.
                if self.rect and self.rect[2] > 20 and self.rect[3] > 20:
                    self.state = AppState.ANNOTATING
                    # We clear old annotations if the user chooses to re-select 
                    # a new area entirely.
                    self.annotations = [] 
                    if self.toolbar_box: self.toolbar_box.show_all()
                else:
                    # If it was just a tiny click, stay in selection mode.
                    self.state = AppState.SELECTING
                    self.rect = None

                self.selection_start = None
                self.queue_draw()
            elif self.state == AppState.ANNOTATING:
                # Commit the 'current' drawing to the permanent list.
                if self.current_ann:
                    self.annotations.append(self.current_ann)
                    self.current_ann = None
                    self.queue_draw()

    def on_motion_notify(self, widget, event):
        """Updates the geometry of active objects while the mouse is moving. 
        This provides 'live' feedback during drags and resizing."""
        self.mouse_pos = (event.x, event.y)
        
        # Priority 1: Resizing or moving the main capture rectangle.
        if getattr(self, 'active_crop_handle', None):
            dx = event.x - self.crop_drag_start_pos[0]
            dy = event.y - self.crop_drag_start_pos[1]
            rx, ry, rw, rh = self.crop_drag_start_rect
            
            h = self.active_crop_handle
            
            if h == 'move':
                new_rx = max(0, min(self.width - rw, rx + dx))
                new_ry = max(0, min(self.height - rh, ry + dy))
                self.rect = (new_rx, new_ry, rw, rh)
                self.queue_draw()
                return

            new_rx, new_ry, new_rw, new_rh = rx, ry, rw, rh
            
            min_size = 50 # Prevent the rectangle from collapsing to zero.
            if 'n' in h:
                new_ry = min(ry + dy, ry + rh - min_size)
                new_rh = ry + rh - new_ry
            if 's' in h:
                new_rh = max(rh + dy, min_size)
            if 'w' in h:
                new_rx = min(rx + dx, rx + rw - min_size)
                new_rw = rx + rw - new_rx
            if 'e' in h:
                new_rw = max(rw + dx, min_size)
                
            self.rect = (new_rx, new_ry, new_rw, new_rh)
            self.queue_draw()
            return
        
        # Priority 2: Manipulating an existing annotation (Moving, Resizing, Rotating).
        if self.selected_ann and hasattr(self, 'active_handle'):
            if self.active_handle == 'rot':
                ax, ay, aw, ah = self._get_rect(self.selected_ann.start, self.selected_ann.end, force_square=False, ann=self.selected_ann)
                cx, cy = ax + aw/2, ay + ah/2
                # Calculate the angle between the center of the object and the mouse.
                self.selected_ann.angle = math.atan2(event.y - cy, event.x - cx) + math.pi/2
                self.queue_draw()
                return
            
            if self.active_handle == 'resize_icon':
                dx = event.x - self.drag_start_pos[0]
                dy = event.y - self.drag_start_pos[1]
                (s_old, e_old) = self.ann_original_pos
                self.selected_ann.end = (e_old[0] + dx, e_old[1] + dy)
                self.queue_draw()
                return

            # Default to moving the object.
            dx = event.x - self.drag_start_pos[0]
            dy = event.y - self.drag_start_pos[1]
            (s_old, e_old) = self.ann_original_pos
            self.selected_ann.start = (s_old[0] + dx, s_old[1] + dy)
            self.selected_ann.end = (e_old[0] + dx, e_old[1] + dy)
            self.queue_draw()
            return

        # Priority 3: Visualizing a new selection or a new drawing.
        if self.state == AppState.SELECTING or (self.state == AppState.ANNOTATING and self.current_tool == 'select' and self.selection_start):
            if self.selection_start:
                self.selection_end = (event.x, event.y)
                if self.state == AppState.ANNOTATING:
                    self.rect = self._get_rect(self.selection_start, self.selection_end)
            self.queue_draw()
            return

        if getattr(self, 'current_ann', None):
            self.current_ann.end = (event.x, event.y)
            self.queue_draw()
            return

        # Priority 4: Hover detection to provide feedback before a click.
        if self.state == AppState.ANNOTATING:
            new_hover = self._find_ann_at(event.x, event.y)
            if new_hover != self.hovered_ann:
                self.hovered_ann = new_hover
            
            # Update cursors and highlight handles only if we aren't already 
            # busy with a drag.
            if not getattr(self, 'current_ann', None) and not hasattr(self, 'active_handle') and not hasattr(self, 'drag_start_pos') and not getattr(self, 'active_crop_handle', None):
                if not new_hover:
                    handle = self._get_crop_handle_at(event.x, event.y)
                    if handle != getattr(self, 'hovered_crop_handle', None):
                        self.hovered_crop_handle = handle
                        self.hovered_crop_outside = False
                        self._update_cursor()
                    elif not handle:
                        # Detect if the mouse is outside the active crop area.
                        rx, ry, rw, rh = self.rect
                        margin = 15
                        is_outside = not (rx - margin <= event.x <= rx + rw + margin and ry - margin <= event.y <= ry + rh + margin)
                        if is_outside != getattr(self, 'hovered_crop_outside', False):
                            self.hovered_crop_outside = is_outside
                            self._update_cursor()
                else:
                    # Clear crop handles if we are hovering over an annotation.
                    if getattr(self, 'hovered_crop_handle', None) or getattr(self, 'hovered_crop_outside', False):
                        self.hovered_crop_handle = None
                        self.hovered_crop_outside = False
                        self._update_cursor()
        
        self.queue_draw()

    # ──────────────────────────────────────────────────────────────────────────
    # TOOLBAR CONSTRUCTION
    # ──────────────────────────────────────────────────────────────────────────

    def _show_toolbar(self):
        """Builds and displays the floating annotation toolbar. Includes logic 
        for adaptive scaling to ensure usability on both small laptops and 
        large HiDPI monitors."""
        if self.toolbar_box: return 
        
        # Adaptive Scaling: Adjust icon and spacing based on screen width.
        screen_w = self.width
        if screen_w < 1400:
            icon_px, color_px, margin = 24, 18, "2px"
        else:
            icon_px, color_px, margin = 28, 22, "4px"

        # The main toolbar container.
        self.toolbar_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)
        self.toolbar_box.set_name("toolbar-box")
        self.toolbar_box.set_halign(Gtk.Align.CENTER)
        self.toolbar_box.set_valign(Gtk.Align.START)
        self.toolbar_box.set_margin_top(15)
        
        # We use Gtk.CssProvider to give the toolbar a premium 'Mint' look 
        # with semi-transparent backgrounds and smooth rounded corners.
        style_provider = Gtk.CssProvider()
        style_provider.load_from_data(f"""
            #toolbar-box {{ 
                background: rgba(25, 25, 25, 0.95);
                border-radius: 12px;
                padding: 6px;
                border: 2px solid rgba(52, 152, 219, 0.5);
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            }}
            button {{
                background: transparent;
                border: 1px solid transparent;
                border-radius: 8px;
                padding: 4px;
                margin: 0 {margin};
                color: white;
            }}
            button image {{ color: white; }}
            button:hover {{ background: rgba(255, 255, 255, 0.1); }}
            button:checked {{
                background: rgba(52, 152, 219, 0.4);
                border-color: rgba(52, 152, 219, 0.6);
            }}
            separator {{ background: rgba(255, 255, 255, 0.1); margin: 0 8px; }}
        """.encode())
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), style_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        
        # Section 1: Drawing Tools (Rect, Arrow, Text, etc.)
        show_labels = self.settings.get('show_labels', False)
        tools = [
            ('select', _('Pointer')), 
            ('rect', _('Rectangle')), 
            ('ellipse', _('Ellipse')), 
            ('arrow', _('Arrow')), 
            ('text', _('Text Tool'))
        ]
        self.tool_buttons = {}
        last_btn = None
        for tool, label in tools:
            btn = Gtk.RadioButton.new_from_widget(last_btn)
            btn.set_mode(False) # Make RadioButton look like a normal button.
            
            box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
            icon_pb = create_tool_icon(tool, size=icon_px)
            box.pack_start(Gtk.Image.new_from_pixbuf(icon_pb), False, False, 0)
            
            # Show text labels next to icons if enabled in settings.
            if show_labels:
                lbl = Gtk.Label(label=label)
                lbl.set_markup(f'<span foreground="white">{label}</span>')
                box.pack_start(lbl, False, False, 0)
            btn.add(box)
            
            btn.set_tooltip_text(label)
            btn.connect("toggled", lambda b, t=tool: self._set_tool_if_active(b, t))
            self.toolbar_box.add(btn)
            self.tool_buttons[tool] = btn
            if tool == self.current_tool: btn.set_active(True)
            last_btn = btn
        
        self.toolbar_box.add(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL))

        # Section 2: Color Palette
        colors = [
            (0.2, 0.6, 1.0, _("Blue")), 
            (0.9, 0.3, 0.3, _("Red")), 
            (0.3, 0.8, 0.4, _("Green")), 
            (0.9, 0.8, 0.2, _("Yellow")), 
            (1.0, 1.0, 1.0, _("White"))
        ]
        last_color_btn = None
        for r, g, b, name in colors:
            cbtn = Gtk.RadioButton.new_from_widget(last_color_btn)
            cbtn.set_mode(False)
            pb = create_color_icon(r, g, b, size=color_px)
            cbtn.set_image(Gtk.Image.new_from_pixbuf(pb))
            cbtn.set_tooltip_text(name)
            cbtn.connect("toggled", lambda b, color=(r,g,b): self._set_color_if_active(b, color))
            self.toolbar_box.add(cbtn)
            if (r,g,b) == self.current_color: cbtn.set_active(True)
            last_color_btn = cbtn

        self.toolbar_box.add(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL))

        # Section 3: Line Thickness Slider
        size_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        size_label = Gtk.Label(label=_("Size"))
        size_box.pack_start(size_label, False, False, 0)
        self.size_scale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 1, 20, 1)
        self.size_scale.set_value(self.line_width)
        self.size_scale.set_size_request(70 if screen_w < 1400 else 90, -1)
        self.size_scale.connect("value-changed", self._on_size_changed)
        size_box.pack_start(self.size_scale, False, False, 0)
        self.toolbar_box.add(size_box)

        self.toolbar_box.add(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL))

        # Actions
        for tool, hint, func in [
            ("reset", _("Reset All"), self._on_reset_clicked),
            ("undo", _("Undo"), lambda b: self._undo()),
            ("copy", _("Copy"), lambda b: self._save_screenshot(only_clipboard=True)),
            ("save", _("Save"), lambda b: self._save_screenshot(show_dialog=True)),
            ("settings", _("Settings"), self._on_settings_clicked),
            ("close", _("Close"), lambda b: Gtk.main_quit())
        ]:
            btn = Gtk.Button()
            box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
            if tool == "undo":
                img = Gtk.Image.new_from_icon_name("edit-undo-symbolic", Gtk.IconSize.BUTTON)
                img.set_pixel_size(icon_px)
                box.pack_start(img, False, False, 0)
            else:
                pix = create_tool_icon(tool, size=icon_px)
                box.pack_start(Gtk.Image.new_from_pixbuf(pix), False, False, 0)
            
            if show_labels:
                lbl = Gtk.Label(label=hint)
                lbl.set_markup(f'<span foreground="white">{hint}</span>')
                box.pack_start(lbl, False, False, 0)
            btn.add(box)
            
            btn.set_tooltip_text(hint)
            btn.connect("clicked", func)
            self.toolbar_box.add(btn)

        self.overlay.add_overlay(self.toolbar_box)
            
        self.toolbar_box.show_all()

    # ──────────────────────────────────────────────────────────────────────────
    # SETTINGS AND MENU MANAGEMENT
    # ──────────────────────────────────────────────────────────────────────────

    def _on_settings_clicked(self, btn):
        """Displays the quick-settings menu aligned to the settings button."""
        menu = Gtk.Menu()
        self._populate_settings_menu(menu)
        menu.popup_at_widget(btn, Gdk.Gravity.SOUTH, Gdk.Gravity.NORTH, None)

    def _populate_settings_menu(self, menu):
        """Dynamically populates the settings menu with options for file 
        format, quality, and toolbar customization."""
        
        # Save Format Submenu (PNG, JPG, GIF).
        format_item = Gtk.MenuItem(label=_("Save Format"))
        format_menu = Gtk.Menu()
        last_fmt_item = None
        for fmt in ['png', 'jpg', 'gif']:
            item = Gtk.RadioMenuItem.new_with_label_from_widget(last_fmt_item, fmt.upper())
            if self.settings['format'] == fmt: item.set_active(True)
            item.connect("activate", lambda i, f=fmt: self._set_setting('format', f))
            format_menu.append(item)
            last_fmt_item = item
        format_item.set_submenu(format_menu)
        menu.append(format_item)

        # Image Quality / Compression Submenu.
        quality_item = Gtk.MenuItem(label=_("Image Quality"))
        quality_menu = Gtk.Menu()
        last_q_item = None
        for q in ['original', 'medium', 'small']:
            if q == 'small':
                label = _("Space Saver (Small)")
            elif q == 'medium':
                label = _("Medium")
            else:
                label = _("Original")
            item = Gtk.RadioMenuItem.new_with_label_from_widget(last_q_item, label)
            if self.settings['quality'] == q: item.set_active(True)
            item.connect("activate", lambda i, val=q: self._set_setting('quality', val))
            quality_menu.append(item)
            last_q_item = item
        quality_item.set_submenu(quality_menu)
        menu.append(quality_item)

        # Default Save Directory Picker.
        folder_name = os.path.basename(self.settings['save_path'])
        path_item = Gtk.MenuItem(label=_("Save Folder: {}...").format(folder_name))
        path_item.connect("activate", self._choose_save_path)
        menu.append(path_item)
        
        # Toggle for showing text labels on the toolbar buttons.
        labels_item = Gtk.CheckMenuItem(label=_("Show Toolbar Labels"))
        labels_item.set_active(self.settings.get('show_labels', False))
        labels_item.connect("toggled", lambda i: self._set_setting('show_labels', i.get_active()))
        menu.append(labels_item)

        menu.append(Gtk.SeparatorMenuItem())
        
        # Information about the application.
        about_item = Gtk.MenuItem(label=_("About Mint Screenshot"))
        about_item.connect("activate", self._show_about)
        menu.append(about_item)
        menu.show_all()

    def _set_setting(self, key, val):
        """Updates a configuration value and persists it to the config file 
        immediately."""
        if self.settings.get(key) != val:
            self.settings[key] = val
            save_settings(self.settings)
            
            # If the toolbar layout changed (e.g., toggled labels), we force 
            # a refresh of the toolbar UI.
            if key == 'show_labels' and hasattr(self, 'toolbar_box') and self.toolbar_box:
                self.overlay.remove(self.toolbar_box)
                self.toolbar_box = None
                self._show_toolbar()
                self.toolbar_box.show_all()

    def _choose_save_path(self, widget):
        """Opens a standard GTK Folder Chooser to set the default export path."""
        dialog = Gtk.FileChooserDialog(
            title=_("Select Default Save Folder"),
            parent=None,
            action=Gtk.FileChooserAction.SELECT_FOLDER
        )
        dialog.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, _("Select"), Gtk.ResponseType.OK)
        dialog.set_default_size(600, 400)
        dialog.set_transient_for(self)
        dialog.set_current_folder(self.settings['save_path'])
        if dialog.run() == Gtk.ResponseType.OK:
            self.settings['save_path'] = dialog.get_filename()
            save_settings(self.settings)
        dialog.destroy()

    def _show_about(self, widget):
        """Displays the standard About dialog with version and credits."""
        meta = self.metadata
        about = Gtk.AboutDialog()
        
        # Find the correct parent window to center the about dialog.
        parent = self
        if hasattr(self, 'launcher') and self.launcher and self.launcher.get_visible():
            parent = self.launcher
            
        about.set_transient_for(parent)
        about.set_keep_above(True) # Ensure it stays on top of the fullscreen overlay.
        about.set_modal(True)
        about.set_position(Gtk.WindowPosition.CENTER)
        
        # Dynamically set properties from metadata.json.
        about.set_program_name(meta.get("name", _("Mint Screenshot")))
        about.set_version(meta.get("version", "1.2.0"))
        about.set_comments(meta.get("description", _("Screenshot & Annotation Tool for Cinnamon\nCapture, annotate, and share with ease.")))
        about.set_website(meta.get("url") or meta.get("website", "https://github.com/khumnath/mint-screenshot"))
        about.set_website_label(_("Project on GitHub"))
        about.set_logo_icon_name(meta.get("icon", "applets-screenshooter-symbolic"))
        about.set_license_type(Gtk.License.GPL_3_0)
        about.set_copyright(f"© 2024-{time.strftime('%Y')} {meta.get('author', 'Khumnath CG')}")
        
        authors = meta.get("contributors", meta.get("author", "Khumnath CG"))
        if isinstance(authors, str): authors = [authors]
        about.set_authors(authors)
        
        # Confirmation before leaving
        def on_link_clicked(dialog, uri):
            # 1. Create confirmation dialog
            confirm = Gtk.MessageDialog(
                transient_for=dialog,
                modal=True,
                message_type=Gtk.MessageType.QUESTION,
                buttons=Gtk.ButtonsType.YES_NO,
                text=_("Open External Website?")
            )
            confirm.set_keep_above(True)
            confirm.format_secondary_text(_("This will exit the current screenshot process. Do you want to continue?"))
            
            response = confirm.run()
            confirm.destroy()
            
            if response == Gtk.ResponseType.YES:
                import os, sys
                # Launch browser in a detached process so it survives our exit
                os.system(f"xdg-open '{uri}' &")
                sys.exit(0)
            else:
                return True # Stay in tool
        about.connect("activate-link", on_link_clicked)
        
        about.run()
        about.destroy()
        

    # ──────────────────────────────────────────────────────────────────────────
    # EXPORT AND KEYBOARD HANDLERS
    # ──────────────────────────────────────────────────────────────────────────

    def on_key_press(self, widget, event):
        """Global key listener for convenience shortcuts like Undo (Ctrl+Z) 
        and Exit (Esc)."""
        if event.keyval == Gdk.KEY_Escape:
            Gtk.main_quit()
        elif event.keyval == Gdk.KEY_z and (event.state & Gdk.ModifierType.CONTROL_MASK):
            # Trigger the undo action.
            if self.annotations:
                self.annotations.pop()
                self.queue_draw()

    def _save_screenshot(self, show_dialog=False, only_clipboard=False):
        """Compiles the final image by compositing the annotations over the 
        original capture, then saves to disk or copies to clipboard."""
        if self.state == AppState.SELECTING or not getattr(self, 'rect', None):
            return
            
        x, y, w, h = self.rect
        
        # Create a Cairo surface of the exact capture size.
        surface = cairo.ImageSurface(cairo.Format.ARGB32, int(w), int(h))
        cr = cairo.Context(surface)
        
        # Draw the base screenshot, cropped to the selection area.
        Gdk.cairo_set_source_pixbuf(cr, self.full_pixbuf, -x, -y)
        cr.paint()
        
        # Overlay all user annotations.
        for ann in self.annotations:
            self._draw_annotation(cr, ann)
            
        # --- Stage 1: Clipboard Handover ---
        # We always push a high-quality copy to the clipboard.
        timestamp = int(time.time())
        temp_path = f"/tmp/mint-screenshot-{timestamp}.png"
        surface.write_to_png(temp_path)
        clipboard = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
        pixbuf = GdkPixbuf.Pixbuf.new_from_file(temp_path)
        clipboard.set_image(pixbuf)
        clipboard.store()
        
        if only_clipboard:
            # On Wayland, clipboard ownership is tied to the process life.
            # If we quit immediately, the data vanishes. We hide the UI 
            # but wait 1 second before exiting to ensure handover.
            self.hide()
            if self.toolbar_box: self.toolbar_box.hide()
            GLib.timeout_add(1000, Gtk.main_quit)
            return

        # --- Stage 2: Quality and Compression ---
        final_pixbuf = pixbuf
        quality_val = "100"
        if self.settings['quality'] == 'medium':
            quality_val = "75"
        elif self.settings['quality'] == 'small':
            quality_val = "50"
            # For the 'Small' setting, we also downscale the physical dimensions.
            final_pixbuf = pixbuf.scale_simple(w/2, h/2, GdkPixbuf.InterpType.BILINEAR)

        # --- Stage 3: Disk Save ---
        fmt = self.settings['format']
        ext = f".{fmt}"
        filename = f"Screenshot_{int(time.time())}{ext}"
        save_path = None
        
        if show_dialog:
            # User explicitly requested a Save-As dialog.
            self.hide()
            if self.toolbar_box: self.toolbar_box.hide()
            
            dialog = Gtk.FileChooserDialog(
                title=_("Save Screenshot"), parent=None,
                action=Gtk.FileChooserAction.SAVE,
                buttons=(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                         Gtk.STOCK_SAVE, Gtk.ResponseType.ACCEPT)
            )
            dialog.set_do_overwrite_confirmation(True)
            dialog.set_default_size(600, 400)
            dialog.set_current_folder(self.settings['save_path'])
            dialog.set_current_name(filename)
            
            if dialog.run() == Gtk.ResponseType.ACCEPT:
                save_path = dialog.get_filename()
            dialog.destroy()
            
            if not save_path:
                # If canceled, return to editing.
                self.show_all()
                if self.toolbar_box: self.toolbar_box.show_all()
                return
        else:
            # Auto-save to the default directory.
            folder = self.settings['save_path']
            if not os.path.exists(folder): os.makedirs(folder)
            save_path = os.path.join(folder, filename)

        if save_path:
            # Final export with specific format/quality parameters.
            if fmt == 'png':
                final_pixbuf.savev(save_path, "png", [], [])
            elif fmt == 'jpg':
                final_pixbuf.savev(save_path, "jpeg", ["quality"], [quality_val])
            elif fmt == 'gif':
                final_pixbuf.savev(save_path, "gif", [], [])
            Gtk.main_quit()

# ──────────────────────────────────────────────────────────────────────────────
# BOOTSTRAPPING AND SYSTEM CHECKS
# ──────────────────────────────────────────────────────────────────────────────

def _check_dependencies(force=False):
    """Verifies that all required system packages are installed. To avoid 
    startup lag, we cache the success result in the user's config file."""
    config_path = os.path.expanduser("~/.config/mint-screenshot.json")
    config = {}
    if os.path.exists(config_path):
        try:
            with open(config_path) as f:
                config = json.load(f)
        except Exception: pass

    if config.get('deps_ok') and not force:
        return True

    import subprocess
    required = {
        'python3-gi': 'Python GObject Introspection',
        'python3-gi-cairo': 'Python GObject Cairo bindings',
        'python3-cairo': 'Python Cairo library',
    }
    
    # Check for backend-specific dependencies.
    if IS_WAYLAND:
        required['python3-dbus'] = 'D-Bus Python bindings (Wayland portal)'
    else:
        required['gir1.2-wnck-3.0'] = 'Window detection support'
        
    missing = []
    for pkg, desc in required.items():
        result = subprocess.run(['dpkg', '-s', pkg], capture_output=True)
        if result.returncode != 0:
            missing.append((pkg, desc))

    if missing:
        # Show a friendly warning with the exact 'apt' command to fix it.
        pkg_list = '\n'.join(f'  \u2022 {pkg}  ({desc})' for pkg, desc in missing)
        pkg_names = ' '.join(pkg for pkg, _ in missing)
        msg = (_("The following packages are missing:\n\n{}\n\nInstall with:\n  sudo apt install {}")
               .format(pkg_list, pkg_names))

        dialog = Gtk.MessageDialog(
            message_type=Gtk.MessageType.WARNING,
            buttons=Gtk.ButtonsType.OK,
            text=_("Mint Screenshot \u2014 Missing Dependencies")
        )
        dialog.format_secondary_text(msg)
        dialog.set_keep_above(True)
        dialog.run()
        dialog.destroy()
        return False

    # Mark as OK and persist for future starts.
    config['deps_ok'] = True
    try:
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
    except Exception: pass
    return True

def _cleanup_tmp_files():
    """Housekeeping: Delete temporary screenshot files older than 1 hour to 
    keep /tmp clean."""
    try:
        import glob
        now = time.time()
        for f in glob.glob("/tmp/mint-screenshot-*.png"):
            if os.path.exists(f) and now - os.path.getmtime(f) > 3600:
                os.remove(f)
    except Exception: pass

if __name__ == "__main__":
    # 1. Housekeeping.
    _cleanup_tmp_files()
    
    # 2. Dependency Check.
    _check_dependencies()
    
    # 3. Application Start.
    try:
        path = sys.argv[1] if len(sys.argv) > 1 else None
        overlay = ScreenshotOverlay(path)
        Gtk.main()
    except Exception as e:
        # If the app crashes on start, re-verify deps as a safety measure.
        _check_dependencies(force=True)
        raise
