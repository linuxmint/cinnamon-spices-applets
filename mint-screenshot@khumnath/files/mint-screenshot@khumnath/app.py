import os
import json
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, Pango
try:
    import dbus
    from dbus.mainloop.glib import DBusGMainLoop
except ImportError:
    pass

from config import IS_WAYLAND, HAS_DBUS, APP_ICON_PIXBUF, _
from utils import load_settings
from launcher import LauncherMixin
from capture import CaptureMixin
from editor import EditorMixin
from canvas import CanvasMixin

class ScreenshotOverlay(Gtk.Window, LauncherMixin, CaptureMixin, EditorMixin, CanvasMixin):
    def _on_size_changed(self, scale):
        """Slider callback: update stroke width."""
        self.line_width = int(scale.get_value())
        if self.selected_ann:
            self.selected_ann.width = self.line_width
            if self.selected_ann.type == 'text':
                self._update_text_bounds(self.selected_ann)
            self.queue_draw()

    def _update_text_bounds(self, ann):
        """Recalculate the end coordinate for a text annotation based on current font size,
        while preserving any manual scaling applied by the user."""
        if ann.type != 'text': return
        layout = self.create_pango_layout(ann.text)
        # Base font size calculation
        fs = 10 + (ann.width * 3)
        layout.set_font_description(Pango.FontDescription(f"Sans Bold {fs}"))
        tw, th = layout.get_pixel_size()
        
        # Apply the stored scaling factors to the new natural size
        ann.end = (ann.start[0] + (tw * ann.sx), ann.start[1] + (th * ann.sy))

    def _on_reset_clicked(self, widget):
        """Clear everything and go back to the launcher."""
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=Gtk.DialogFlags.MODAL,
            message_type=Gtk.MessageType.WARNING,
            buttons=Gtk.ButtonsType.OK_CANCEL,
            text=_("Reset Everything?")
        )
        dialog.format_secondary_text(_("This will clear all annotations and return to the launcher."))
        response = dialog.run()
        dialog.destroy()
        
        if response == Gtk.ResponseType.OK:
            self.rect = None
            self.annotations = []
            self.redo_stack = []
            self.selection_start = None
            self.selection_end = None
            self.current_ann = None
            self.selected_ann = None
            self.hovered_ann = None
            self.edit_mode = None
            self.hovered_crop_handle = None
            self.hovered_crop_outside = False
            self._toolbar_at_bottom = False
            self.state = None
            self.full_pixbuf = None
            self._invalidate_bg_cache()
            self.hide()
            if self.toolbar_box: 
                self.toolbar_box.hide()
                # Remove entirely so it rebuilds fresh on re-entry
                self.overlay.remove(self.toolbar_box)
                self.toolbar_box = None
            self._show_launcher()

    def _set_tool_if_active(self, btn, tool):
        """Radio-button callback: switch the active drawing tool."""
        if btn.get_active():
            self.current_tool = tool
            self.selected_ann = None
            # Reset to base size when picking a new tool
            self.line_width = self.base_line_width
            if hasattr(self, 'size_scale'):
                self.size_scale.set_value(self.line_width)
            self.queue_draw()

    def _set_color_if_active(self, btn, color):
        """Radio-button callback: switch drawing color."""
        if btn.get_active():
            self.current_color = color
            if self.selected_ann:
                self.selected_ann.color = color
                self.queue_draw()

    # --- Init ---

    def __init__(self, save_dir_override=None):
        super().__init__(type=Gtk.WindowType.TOPLEVEL)
        self.set_role("mint-screenshot-tool")
        if APP_ICON_PIXBUF:
            self.set_icon(APP_ICON_PIXBUF)
        else:
            self.set_icon_name("applets-screenshooter-symbolic")
        self.state = None
        self.timer_expanded = False
        self.is_wayland = IS_WAYLAND
        

        self.selection_start = None
        self.selection_end = None
        self.rect = None
        self.annotations = []
        self.redo_stack = []
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
        
        # User prefs (format, quality, save path)
        self.settings = load_settings({
            'format': 'png',
            'quality': 'original',
            'save_path': os.path.expanduser("~/Pictures"),
            'show_labels': False,
            'delay': 0,
            'mode': 'area'
        })
        
        self.base_line_width = 3

        # Override save path if the applet passed a directory via argv
        if save_dir_override and os.path.isdir(save_dir_override):
            self.settings['save_path'] = save_dir_override


        self.metadata = self._load_project_metadata()

        # Desktop size (multi-monitor total)
        screen = Gdk.Screen.get_default()
        self.width = screen.get_width()
        self.height = screen.get_height()

        # HiDPI scale factor (initial; updated after realize for accuracy)
        self.scale = self.get_scale_factor()
        self.connect("realize", lambda w: setattr(self, 'scale', self.get_scale_factor()))

        self._init_dbus()

    def _load_project_metadata(self):
        try:

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
        if self.is_wayland and HAS_DBUS:
            DBusGMainLoop(set_as_default=True)
            
        self.full_pixbuf = None
        self._show_launcher()



    # --- Error dialogs ---

    def _show_wayland_error(self, message):
        """Show a Wayland-specific error dialog."""
        dialog = Gtk.MessageDialog(
            message_type=Gtk.MessageType.ERROR,
            buttons=Gtk.ButtonsType.OK,
            text=_("Mint Screenshot — Wayland Error")
        )
        dialog.format_secondary_text(message)
        dialog.run()
        dialog.destroy()
