import os
import logging
import math
import subprocess
import sys
import time
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GdkPixbuf, GLib
import cairo
from config import AppState, APP_ICON_PIXBUF, _
from utils import create_tool_icon, create_color_icon, save_settings

logger = logging.getLogger(__name__)

class EditorMixin:
    def _open_annotator(self):
        """Set up the fullscreen overlay for selection and annotation."""
        self.state = AppState.SELECTING if getattr(self, '_wants_selection', False) else AppState.ANNOTATING
        self._toolbar_at_bottom = False

        # Borderless, always-on-top, fullscreen overlay
        self.set_decorated(False)
        self.set_keep_above(True)
        self.set_type_hint(Gdk.WindowTypeHint.NORMAL)
        
        # Alpha channel support for the dimmed overlay effect
        self.set_app_paintable(True)
        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        if visual:
            self.set_visual(visual)

        # CSS for toolbar contrast (ensures labels are white even on light themes)
        # Track provider to prevent accumulation on repeated _open_annotator calls
        if hasattr(self, '_label_css_provider') and self._label_css_provider:
            Gtk.StyleContext.remove_provider_for_screen(
                Gdk.Screen.get_default(), self._label_css_provider
            )
        self._label_css_provider = Gtk.CssProvider()
        self._label_css_provider.load_from_data(b"#toolbar-box label { color: white; }")
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), self._label_css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

        self.set_default_size(int(self.width), int(self.height))
        if not self.is_wayland:

            self.fullscreen()
        else:
            self.fullscreen_on_monitor(screen, 0)
        
        # Clear any leftover children from a previous session
        for child in self.get_children():
            self.remove(child)

        # Overlay lets us stack the toolbar on top of the drawing surface
        self.overlay = Gtk.Overlay()
        self.add(self.overlay)
        
        # Main canvas — receives all mouse events
        self.draw_area = Gtk.DrawingArea()
        self.draw_area.connect("draw", self.on_draw)
        self.overlay.add(self.draw_area)

        # Mouse events
        self.draw_area.add_events(Gdk.EventMask.BUTTON_PRESS_MASK |
                        Gdk.EventMask.BUTTON_RELEASE_MASK |
                        Gdk.EventMask.POINTER_MOTION_MASK)
        
        self.draw_area.connect("button-press-event", self.on_button_press)
        self.draw_area.connect("button-release-event", self.on_button_release)
        self.draw_area.connect("motion-notify-event", self.on_motion_notify)
        
        # Keyboard shortcuts
        self.add_events(Gdk.EventMask.KEY_PRESS_MASK)
        try:
            self.disconnect_by_func(self.on_key_press)
        except Exception:
            pass
        self.connect("key-press-event", self.on_key_press)

        # Build the toolbar
        self.toolbar_box = None
        self._show_toolbar()
        self.rect = None
        
        if self.state == AppState.ANNOTATING:
            self.rect = (0, 0, self.width, self.height)

        # Calculate base size for this capture area
        self.base_line_width = self._calculate_base_size()
        self.line_width = self.base_line_width
        
        self.show_all()

    def _calculate_base_size(self):
        """Calculate a proportional stroke width based on the capture area dimensions."""
        if not hasattr(self, 'rect') or not self.rect:
            return 3
        w, h = self.rect[2], self.rect[3]
        diag = math.sqrt(w*w + h*h)
        # Proportional scale: Aim for ~4px on 1080p, clamped between 2 and 7
        size = int(diag / 500)
        return max(2, min(7, size))

    # --- Timers ---

    def _on_timer_clicked(self, seconds):
        """Hide the editor window and start a countdown for a new capture."""
        self.timer_expanded = False
        self.hide()
        self._countdown_remaining = seconds
        self._countdown_win = self._create_countdown_window(seconds)
        self._countdown_win.show_all()
        GLib.timeout_add(1000, self._tick_countdown)

    def _prompt_custom_timer(self):
        """Let the user type a custom delay in seconds."""
        dialog = Gtk.Dialog(
            title=_("Custom Timer"),
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

        label = Gtk.Label(label=_("Enter delay in seconds:"))
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
        """Create the floating countdown pill indicator."""
        # Wayland needs TOPLEVEL+UTILITY; X11 can use POPUP
        if self.is_wayland:
            win = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
            win.set_type_hint(Gdk.WindowTypeHint.UTILITY)
        else:
            win = Gtk.Window(type=Gtk.WindowType.POPUP)
        win.set_keep_above(True)
        win.set_decorated(False)
        win.set_app_paintable(True)
        win.set_accept_focus(False)


        screen = win.get_screen()
        visual = screen.get_rgba_visual()
        if visual:
            win.set_visual(visual)

        # Position top-center of the primary monitor
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

        # DrawingArea is needed on Wayland to actually render a transparent window
        da = Gtk.DrawingArea()
        da.connect("draw", self._draw_countdown)
        win.add(da)
        
        return win

    def _draw_pill_bg(self, cr, w, h):
        """Draw the shared rounded-pill background with dark fill and blue border."""
        r = 16  # Corner radius for the pill.

        # Clear to transparent, then draw over
        cr.set_operator(cairo.Operator.SOURCE)
        cr.set_source_rgba(0, 0, 0, 0)
        cr.paint()
        cr.set_operator(cairo.Operator.OVER)

        # Rounded pill shape
        cr.new_sub_path()
        cr.arc(w - r, r, r, -math.pi/2, 0)
        cr.arc(w - r, h - r, r, 0, math.pi/2)
        cr.arc(r, h - r, r, math.pi/2, math.pi)
        cr.arc(r, r, r, math.pi, 3*math.pi/2)
        cr.close_path()
        
        # Fill dark + blue border
        cr.set_source_rgba(0.1, 0.1, 0.1, 0.85)
        cr.fill_preserve()
        cr.set_source_rgba(52/255, 152/255, 219/255, 0.8)
        cr.set_line_width(2)
        cr.stroke()

    def _draw_countdown(self, widget, cr):
        """Render the countdown pill: rounded bg, border, camera icon, timer text."""
        w = widget.get_allocated_width()
        h = widget.get_allocated_height()

        self._draw_pill_bg(cr, w, h)
        cr.set_source_rgba(1, 1, 1, 0.7)
        cr.set_line_width(1.5)
        cr.rectangle(15, h/2 - 8, 20, 16)
        cr.stroke()
        cr.arc(25, h/2, 5, 0, 2*math.pi)
        cr.stroke()

        # Timer text
        secs = getattr(self, '_countdown_remaining', 0)
        cr.set_source_rgb(1, 1, 1)
        cr.select_font_face("Sans", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
        cr.set_font_size(28)
        text = f"{secs}s"
        ext = cr.text_extents(text)
        cr.move_to(55, h/2 + ext.height/2)
        cr.show_text(text)

        # "capturing..." label
        cr.set_source_rgba(1, 1, 1, 0.5)
        cr.set_font_size(11)
        label = "capturing..."
        lext = cr.text_extents(label)
        cr.move_to(w - lext.width - 14, h/2 + lext.height/2)
        cr.show_text(label)

    def _tick_countdown(self):
        """Called every second. When it hits zero, take the screenshot."""
        self._countdown_remaining -= 1
        if self._countdown_remaining <= 0:
            # Destroy the pill first so it doesn't appear in the screenshot
            if self._countdown_win:
                self._countdown_win.destroy()
                self._countdown_win = None
            # Brief pause so the WM can finish hiding the pill
            GLib.timeout_add(250, self._take_delayed_screenshot)
            return False
        
        if self._countdown_win:
            self._countdown_win.queue_draw()
        return True

    def _take_delayed_screenshot(self):
        """Capture after the timer finishes."""
        if getattr(self, 'is_wayland', False):
            self._wants_selection = False
            self.is_full_capture = True
            self._portal_screenshot(interactive=False)
            return False

        # X11: capture the full root window for timed screenshots
        window = Gdk.get_default_root_window()
        screen = Gdk.Screen.get_default()
        ps = self.scale
        w, h = screen.get_width(), screen.get_height()
        self.full_pixbuf = Gdk.pixbuf_get_from_window(window, 0, 0, int(w * ps), int(h * ps))
        self._invalidate_bg_cache()

        if self.full_pixbuf is None:
            logger.error("Failed to capture screen (pixbuf is None). Is the screen locked?")
            return False
        
        self.width = w
        self.height = h
        self.rect = (0, 0, self.width, self.height)
        self.is_full_capture = True
        
        self._open_annotator()
        if self.toolbar_box: self.toolbar_box.show_all()
        self.queue_draw()
        return False

    # --- Feedback Overlay ---

    def _create_saving_window(self, text="Saving..."):
        """Create a floating indicator pill."""
        self._overlay_text = text
        if getattr(self, 'is_wayland', False):
            win = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
            win.set_type_hint(Gdk.WindowTypeHint.UTILITY)
        else:
            win = Gtk.Window(type=Gtk.WindowType.POPUP)
        win.set_keep_above(True)
        win.set_decorated(False)
        win.set_app_paintable(True)
        win.set_accept_focus(False)

        screen = win.get_screen()
        visual = screen.get_rgba_visual()
        if visual: win.set_visual(visual)

        pill_w, pill_h = 160, 50
        display = Gdk.Display.get_default()
        monitor = display.get_primary_monitor()
        if not monitor: monitor = display.get_monitor(0)
        
        if monitor:
            geom = monitor.get_geometry()
            win.set_size_request(pill_w, pill_h)
            # Position at top center
            win.move(geom.x + geom.width // 2 - pill_w // 2, geom.y + 40)
        else:
            win.set_size_request(pill_w, pill_h)

        da = Gtk.DrawingArea()
        da.connect("draw", self._draw_saving)
        win.add(da)
        return win

    def _draw_saving(self, widget, cr):
        """Draw the feedback pill."""
        w = widget.get_allocated_width()
        h = widget.get_allocated_height()

        self._draw_pill_bg(cr, w, h)

        cr.set_source_rgb(1, 1, 1)
        cr.select_font_face("Sans", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
        cr.set_font_size(16)
        
        text = getattr(self, '_overlay_text', _("Saving..."))
        is_copied = "Copied" in text
        
        # Draw text
        ext = cr.text_extents(text)
        
        if is_copied:
            # Draw text + icon
            script_dir = os.path.dirname(os.path.realpath(__file__))
            icon_path = os.path.join(script_dir, "assets", "icons", "done.png")
            icon_size = 24
            spacing = 8
            
            total_w = ext.width + spacing + icon_size
            start_x = w/2 - total_w/2
            
            cr.move_to(start_x, h/2 + ext.height/2)
            cr.show_text(text)
            
            if os.path.exists(icon_path):
                try:
                    pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(icon_path, icon_size, icon_size)
                    surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, 1, widget.get_window())
                    
                    # Position icon to the right of text
                    icon_x = start_x + ext.width + spacing
                    icon_y = h/2 - icon_size/2
                    
                    # Paint it white (using the icon as a mask)
                    cr.set_source_rgb(1, 1, 1)
                    cr.mask_surface(surface, icon_x, icon_y)
                except Exception:
                    pass
        else:
            cr.move_to(w/2 - ext.width/2, h/2 + ext.height/2)
            cr.show_text(text)

    def _send_notification(self, title, message):
        """Send a system-wide desktop notification."""
        try:
            subprocess.Popen(['notify-send', '-i', 'applets-screenshooter-symbolic', title, message])
        except FileNotFoundError:
            logger.debug("notify-send not found; skipping desktop notification")
        except Exception:
            logger.debug("Failed to send notification", exc_info=True)

    def _toggle_toolbar_position(self, btn):
        """Snap the toolbar between the top and bottom of the screen."""
        self._toolbar_at_bottom = not self._toolbar_at_bottom
        if self._toolbar_at_bottom:
            self.toolbar_box.set_valign(Gtk.Align.END)
            self.toolbar_box.set_margin_top(0)
            self.toolbar_box.set_margin_bottom(15)
            btn.get_image().set_from_icon_name("pan-up-symbolic", Gtk.IconSize.BUTTON)
        else:
            self.toolbar_box.set_valign(Gtk.Align.START)
            self.toolbar_box.set_margin_top(15)
            self.toolbar_box.set_margin_bottom(0)
            btn.get_image().set_from_icon_name("pan-down-symbolic", Gtk.IconSize.BUTTON)

    # --- Rendering ---

    def _show_toolbar(self):
        """Build the floating annotation toolbar with adaptive sizing."""
        if self.toolbar_box: return 
        
        # Smaller icons/spacing on screens under 1400px wide
        screen_w = self.width
        if screen_w < 1400:
            icon_px, color_px, margin = 24, 18, "2px"
        else:
            icon_px, color_px, margin = 28, 22, "4px"


        self.toolbar_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)
        self.toolbar_box.set_name("toolbar-box")
        self.toolbar_box.set_halign(Gtk.Align.CENTER)
        self.toolbar_box.set_valign(Gtk.Align.START)
        self.toolbar_box.set_margin_top(15)
        
        # Semi-transparent dark toolbar with rounded corners
        # Remove any previous toolbar CSS provider to prevent accumulation
        if hasattr(self, '_toolbar_css_provider') and self._toolbar_css_provider:
            Gtk.StyleContext.remove_provider_for_screen(
                Gdk.Screen.get_default(), self._toolbar_css_provider
            )
        self._toolbar_css_provider = Gtk.CssProvider()
        self._toolbar_css_provider.load_from_data(f"""
            #toolbar-box {{ 
                background: rgba(25, 25, 25, 0.95);
                border-radius: 12px;
                padding: 6px;
                border: 2px solid rgba(52, 152, 219, 0.5);
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            }}
            #toolbar-box button {{
                background: transparent;
                border: 1px solid transparent;
                border-radius: 8px;
                padding: 4px;
                margin: 0 {margin};
                color: white;
            }}
            #toolbar-box label {{ color: white; }}
            #toolbar-box button image {{ color: white; }}
            #toolbar-box button:hover {{ background: rgba(255, 255, 255, 0.1); }}
            #toolbar-box button:checked {{
                background: rgba(52, 152, 219, 0.4);
                border-color: rgba(52, 152, 219, 0.6);
            }}
            #toolbar-box separator {{ background: rgba(255, 255, 255, 0.1); margin: 0 8px; }}
        """.encode())
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), self._toolbar_css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        
        # Tool buttons
        show_labels = self.settings.get('show_labels', False)
        tools = [
            ('select', _('Pointer')), 
            ('rect', _('Rectangle')), 
            ('ellipse', _('Ellipse')), 
            ('arrow', _('Arrow')), 
            ('draw', _('Draw')),
            ('highlight', _('Highlight')),
            ('text', _('Text Tool'))
        ]
        self.tool_buttons = {}
        last_btn = None
        for tool, label in tools:
            btn = Gtk.RadioButton.new_from_widget(last_btn)
            btn.set_mode(False)  # looks like a normal button
            
            box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL if show_labels else Gtk.Orientation.HORIZONTAL, spacing=2)
            box.set_halign(Gtk.Align.CENTER)
            icon_pb = create_tool_icon(tool, size=icon_px)
            box.pack_start(Gtk.Image.new_from_pixbuf(icon_pb), True, True, 0)
            

            if show_labels:
                lbl = Gtk.Label()
                lbl.set_markup(f"<span size='x-small'>{label}</span>")
                box.pack_start(lbl, False, False, 0)
            btn.add(box)
            
            btn.set_tooltip_text(label)
            btn.connect("toggled", lambda b, t=tool: self._set_tool_if_active(b, t))
            # set cursor in toolbar buttons
            btn.connect("realize", lambda b: b.get_window().set_cursor(Gdk.Cursor.new_from_name(Gdk.Display.get_default(), "pointer")))
            self.toolbar_box.add(btn)
            self.tool_buttons[tool] = btn
            if tool == self.current_tool: btn.set_active(True)
            last_btn = btn
        
        self.toolbar_box.add(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL))

        # Color palette (2x3 grid)
        colors = [
            (0.2, 0.6, 1.0, _("Blue")), 
            (0.9, 0.3, 0.3, _("Red")), 
            (0.3, 0.8, 0.4, _("Green")), 
            (0.9, 0.8, 0.2, _("Yellow")), 
            (1.0, 1.0, 1.0, _("White")),
            (0.1, 0.1, 0.1, _("Black"))
        ]
        
        color_grid = Gtk.Grid(column_spacing=2, row_spacing=2)
        color_grid.set_valign(Gtk.Align.CENTER)
        self.toolbar_box.add(color_grid)
        
        last_color_btn = None
        for i, (r, g, b, name) in enumerate(colors):
            cbtn = Gtk.RadioButton.new_from_widget(last_color_btn)
            cbtn.set_mode(False)
            # Make color icons slightly smaller to fit 2 rows nicely
            pb = create_color_icon(r, g, b, size=color_px - 4)
            cbtn.set_image(Gtk.Image.new_from_pixbuf(pb))
            cbtn.set_tooltip_text(name)
            cbtn.connect("toggled", lambda btn, color=(r,g,b): self._set_color_if_active(btn, color))
            # set cursor in color buttons
            cbtn.connect("realize", lambda btn: btn.get_window().set_cursor(Gdk.Cursor.new_from_name(Gdk.Display.get_default(), "pointer")))
            
            col = i % 3
            row = i // 3
            color_grid.attach(cbtn, col, row, 1, 1)
            
            if (r,g,b) == self.current_color: cbtn.set_active(True)
            last_color_btn = cbtn

        self.toolbar_box.add(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL))

        # Line thickness slider
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

        # Action buttons
        for tool, hint, func in [
            ("reset", _("Reset All"), self._on_reset_clicked),
            ("undo", _("Undo"), lambda b: self._undo()),
            ("copy", _("Copy"), lambda b: self._save_screenshot(only_clipboard=True)),
            ("save", _("Save"), lambda b: self._save_screenshot(show_dialog=True)),
            ("settings", _("Settings"), self._on_settings_clicked),
            ("close", _("Close"), lambda b: Gtk.main_quit())
        ]:
            btn = Gtk.Button()
            box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL if show_labels else Gtk.Orientation.HORIZONTAL, spacing=2)
            box.set_halign(Gtk.Align.CENTER)
            if tool == "undo":
                img = Gtk.Image.new_from_icon_name("edit-undo-symbolic", Gtk.IconSize.BUTTON)
                img.set_pixel_size(icon_px)
                box.pack_start(img, True, True, 0)
            else:
                pix = create_tool_icon(tool, size=icon_px)
                box.pack_start(Gtk.Image.new_from_pixbuf(pix), True, True, 0)
            
            if show_labels:
                lbl = Gtk.Label()
                lbl.set_markup(f"<span size='x-small'>{hint}</span>")
                box.pack_start(lbl, False, False, 0)
            btn.add(box)
            
            btn.set_tooltip_text(hint)
            btn.connect("clicked", func)
            self.toolbar_box.add(btn)

        # Position Toggle Button (Snap to Top/Bottom)
        self.toolbar_box.add(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL))
        pos_btn = Gtk.Button()
        pos_btn.set_tooltip_text(_("Move Toolbar Top/Bottom"))
        pos_btn.set_image(Gtk.Image.new_from_icon_name("pan-down-symbolic", Gtk.IconSize.BUTTON))
        pos_btn.connect("clicked", self._toggle_toolbar_position)
        # set cursor in position button
        pos_btn.connect("realize", lambda b: b.get_window().set_cursor(Gdk.Cursor.new_from_name(Gdk.Display.get_default(), "pointer")))
        self.toolbar_box.add(pos_btn)

        self.overlay.add_overlay(self.toolbar_box)
            
        self.toolbar_box.show_all()

    # --- Settings ---

    def _on_settings_clicked(self, btn):
        """Pop up the settings menu below the settings button."""
        menu = Gtk.Menu()
        self._populate_settings_menu(menu)
        menu.popup_at_widget(btn, Gdk.Gravity.SOUTH, Gdk.Gravity.NORTH, None)

    def _populate_settings_menu(self, menu):
        """Build the settings menu: format, quality, save path, toolbar labels."""
        
        # Save format (PNG, JPG, GIF)
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

        # Image quality / compression
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

        # Save folder picker
        folder_name = os.path.basename(self.settings['save_path'])
        path_item = Gtk.MenuItem(label=_("Save Folder: {}...").format(folder_name))
        path_item.connect("activate", self._choose_save_path)
        menu.append(path_item)
        
        # Toggle toolbar labels
        labels_item = Gtk.CheckMenuItem(label=_("Show Toolbar Labels"))
        labels_item.set_active(self.settings.get('show_labels', False))
        labels_item.connect("toggled", lambda i: self._set_setting('show_labels', i.get_active()))
        menu.append(labels_item)

        menu.append(Gtk.SeparatorMenuItem())
        
        # About
        about_item = Gtk.MenuItem(label=_("About Mint Screenshot"))
        about_item.connect("activate", self._show_about)
        menu.append(about_item)
        menu.show_all()

    def _set_setting(self, key, val):
        """Update a setting and persist it."""
        if self.settings.get(key) != val:
            self.settings[key] = val
            save_settings(self.settings)
            
            # Rebuild toolbar if layout changed (e.g. labels toggled)
            if key == 'show_labels' and hasattr(self, 'toolbar_box') and self.toolbar_box:
                self.overlay.remove(self.toolbar_box)
                self.toolbar_box = None
                self._show_toolbar()
                self.toolbar_box.show_all()

    def _choose_save_path(self, widget):
        """Open a folder chooser to set the default save directory."""
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
        """Show the About dialog."""
        meta = self.metadata
        about = Gtk.AboutDialog()
        
        # Center on whichever window is currently visible
        parent = self
        if hasattr(self, 'launcher') and self.launcher and self.launcher.get_visible():
            parent = self.launcher
            
        about.set_transient_for(parent)

        about.set_modal(True)
        about.set_position(Gtk.WindowPosition.CENTER)
        
        # Pull info from metadata.json
        about.set_program_name(meta.get("name", _("Mint Screenshot")))
        about.set_version(meta.get("version", "1.2.0"))
        about.set_comments(meta.get("description", _("Screenshot & Annotation Tool\nCapture, annotate, and share with ease.")))
        about.set_website(meta.get("url") or meta.get("website", "https://github.com/khumnath/mint-screenshot"))
        about.set_website_label(_("Project on GitHub"))
        
        if APP_ICON_PIXBUF:
            about.set_logo(APP_ICON_PIXBUF)
        else:
            about.set_logo_icon_name("applets-screenshooter-symbolic")
            
        about.set_license_type(Gtk.License.GPL_3_0)
        about.set_copyright(f"© 2024-{time.strftime('%Y')} {meta.get('author', 'Khumnath CG')}")
        
        authors = meta.get("contributors", meta.get("author", "Khumnath CG"))
        if isinstance(authors, str): authors = [authors]
        about.set_authors(authors)
        
        # Warn before opening an external link (exits the screenshot tool)
        def on_link_clicked(dialog, uri):

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
                subprocess.Popen(['xdg-open', uri])
                sys.exit(0)
            else:
                return True  # stay in the tool
        about.connect("activate-link", on_link_clicked)
        
        about.run()
        about.destroy()
        

    # --- Export & keyboard ---

    def _save_screenshot(self, show_dialog=False, only_clipboard=False):
        """Composite annotations over the capture, then save to disk or clipboard."""
        if self.state == AppState.SELECTING or not getattr(self, 'rect', None) or not self.full_pixbuf:
            return
            
        x, y, w, h = self.rect
        w = max(w, 1)
        h = max(h, 1)
        s = self.scale
        
        # Grab window reference before hiding
        window = self.get_window()
        
        # 1. Hide the main window instantly
        self.hide()
        if self.toolbar_box: self.toolbar_box.hide()
        
        # 2. Determine save path (showing dialog if needed)
        save_path = None
        if not only_clipboard:
            fmt = self.settings['format']
            ext = f".{fmt}"
            filename = f"Screenshot_{int(time.time())}{ext}"
            
            if show_dialog:
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
                    self.show_all()
                    if self.toolbar_box: self.toolbar_box.show_all()
                    return
            else:
                folder = self.settings['save_path']
                try:
                    os.makedirs(folder, exist_ok=True)
                except OSError as e:
                    logger.error("Failed to create save directory %s: %s", folder, e)
                    self.show_all()
                    if self.toolbar_box: self.toolbar_box.show_all()
                    return
                save_path = os.path.join(folder, filename)

        # 3. Show feedback pill immediately
        overlay_msg = _("Copying...") if only_clipboard else _("Saving...")
        saving_win = self._create_saving_window(text=overlay_msg)
        saving_win.show_all()

        # Gather state for the render callback
        annotations_copy = list(self.annotations)
        full_pixbuf = self.full_pixbuf
        q_mode = self.settings['quality']
        fmt_val = self.settings.get('format', 'png') if not only_clipboard else 'png'

        def do_render():
            """Render and save on the main thread (GDK/GTK calls are not thread-safe)."""
            # 4. Cairo compositing — must stay on the main thread
            surface = cairo.ImageSurface(cairo.Format.ARGB32, int(w * s), int(h * s))
            cr = cairo.Context(surface)
            # Paint background at 1:1 physical pixels (no scaling yet)
            Gdk.cairo_set_source_pixbuf(cr, full_pixbuf, -int(x * s), -int(y * s))
            cr.paint()

            cr.save()
            cr.scale(s, s)
            cr.translate(-x, -y)
            for ann in annotations_copy:
                self._draw_annotation(cr, ann, is_export=True)
            cr.restore()

            pixbuf = Gdk.pixbuf_get_from_surface(surface, 0, 0, int(w * s), int(h * s))
            # Release native cairo memory immediately
            surface.finish()

            # 5. Apply Quality / Scaling settings
            final_pixbuf = pixbuf
            quality_val = "100"

            if q_mode == 'medium':
                quality_val = "85"
            elif q_mode == 'small':
                quality_val = "65"
                pw, ph = pixbuf.get_width(), pixbuf.get_height()
                if pw > 1200 or ph > 900:
                    final_pixbuf = pixbuf.scale_simple(int(pw * 0.75), int(ph * 0.75), GdkPixbuf.InterpType.BILINEAR)

            # 6. Disk save (if not clipboard-only)
            if not only_clipboard:
                if fmt_val == 'png':
                    final_pixbuf.savev(save_path, "png", ["compression"], ["9"])
                elif fmt_val == 'jpg':
                    final_pixbuf.savev(save_path, "jpeg", ["quality"], [quality_val])
                elif fmt_val == 'gif':
                    final_pixbuf.savev(save_path, "gif", [], [])

            # 7. Finalize — release large pixbuf from memory
            self.full_pixbuf = None
            self._invalidate_bg_cache()

            if only_clipboard:
                clipboard = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
                clipboard.set_image(final_pixbuf)
                clipboard.store()

                self._overlay_text = _("Copied")
                saving_win.queue_draw()

                def delayed_quit():
                    saving_win.destroy()
                    Gtk.main_quit()
                    return False
                GLib.timeout_add(800, delayed_quit)
            else:
                title = _("Screenshot Saved")
                msg = _("Saved to {}").format(save_path)
                self._send_notification(title, msg)

                saving_win.destroy()
                Gtk.main_quit()

            return False  # Don't repeat the idle callback

        # Deferred to next main-loop iteration so the feedback pill paints first
        GLib.idle_add(do_render)
