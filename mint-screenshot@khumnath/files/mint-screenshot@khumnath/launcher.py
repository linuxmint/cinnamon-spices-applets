import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib
from config import APP_ICON_PIXBUF, _

class LauncherMixin:

    # --- Launcher (start screen) ---

    def _show_launcher(self):
        """Build the initial window where the user picks capture mode."""
        # Destroy any previous launcher to prevent stale signal handlers
        if hasattr(self, 'launcher') and self.launcher:
            # Prevent the destroy signal from calling Gtk.main_quit during rebuild
            self._rebuilding_launcher = True
            self.launcher.destroy()
            self._rebuilding_launcher = False
        self.launcher = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
        self.launcher.set_role("mint-screenshot-tool")
        if APP_ICON_PIXBUF:
            self.launcher.set_icon(APP_ICON_PIXBUF)
        else:
            self.launcher.set_icon_name("applets-screenshooter-symbolic")
        self.launcher.set_decorated(True)
        self.launcher.set_title("Mint Screenshot")
        self.launcher.set_position(Gtk.WindowPosition.CENTER)
        self.launcher.set_resizable(False)


        hb = Gtk.HeaderBar()
        hb.set_show_close_button(True)
        hb.set_title("Mint Screenshot")
        self.launcher.set_titlebar(hb)

        # Hamburger menu for settings
        menu_btn = Gtk.MenuButton()
        menu_btn.set_image(Gtk.Image.new_from_icon_name("open-menu-symbolic", Gtk.IconSize.BUTTON))
        
        menu = Gtk.Menu()
        self._populate_settings_menu(menu)
        menu_btn.set_popup(menu)
        hb.pack_end(menu_btn)

        # CSS for sizing only — colors inherit from the user's GTK theme
        # Track provider to prevent accumulation on repeated _show_launcher calls
        if hasattr(self, '_launcher_css_provider') and self._launcher_css_provider:
            Gtk.StyleContext.remove_provider_for_screen(
                Gdk.Screen.get_default(), self._launcher_css_provider
            )
        self._launcher_css_provider = Gtk.CssProvider()
        self._launcher_css_provider.load_from_data(b"""
            .launcher-title {
                font-size: 18px;
                font-weight: bold;
            }
            .launcher-subtitle {
                font-size: 11px;
                opacity: 0.6;
            }
            .launcher-btn {
                border-radius: 10px;
                padding: 14px 20px;
                font-size: 14px;
                font-weight: bold;
            }
        """)
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(), self._launcher_css_provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        vbox.set_margin_top(15)
        vbox.set_margin_bottom(24)
        vbox.set_margin_start(24)
        vbox.set_margin_end(24)


        title = Gtk.Label(label=_("Mint Screenshot"))
        title.get_style_context().add_class("launcher-title")
        vbox.pack_start(title, False, False, 0)

        subtitle_text = _("Wayland Mode — Capture via Desktop Portal") if self.is_wayland else _("X11 Mode — Instant Pixel Capture")
        subtitle = Gtk.Label(label=subtitle_text)
        subtitle.get_style_context().add_class("launcher-subtitle")
        vbox.pack_start(subtitle, False, False, 4)

        if self.is_wayland:
            hint_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
            hint_box.set_center_widget(Gtk.Label())
            hint_icon = Gtk.Image.new_from_icon_name("dialog-information-symbolic", Gtk.IconSize.MENU)
            hint_label = Gtk.Label(label=_("Hint: Pick 'Screen' in the portal to capture overlapping windows."))
            hint_label.get_style_context().add_class("launcher-subtitle")
            hint_box.pack_start(hint_icon, False, False, 0)
            hint_box.pack_start(hint_label, False, False, 0)
            vbox.pack_start(hint_box, False, False, 0)

        vbox.pack_start(Gtk.Separator(), False, False, 8)

        # Monitor picker (X11 multi-monitor only)
        if not self.is_wayland:
            display = Gdk.Display.get_default()
            n_monitors = display.get_n_monitors()
            if n_monitors > 1:
                vbox.pack_start(Gtk.Label(label=_("Select Monitor:")), False, False, 0)
                self.monitor_combo = Gtk.ComboBoxText()
                self.monitor_combo.append_text(_("All Monitors"))
                for i in range(n_monitors):
                    self.monitor_combo.append_text(_("Monitor {}").format(i + 1))
                self.monitor_combo.set_active(self.settings.get('monitor', 0))
                self.monitor_combo.connect("changed", lambda c: self._set_setting('monitor', c.get_active()))
                vbox.pack_start(self.monitor_combo, False, False, 0)

        # Capture buttons
        btn_full = Gtk.Button(label=_("📸  Capture Fullscreen"))
        btn_full.get_style_context().add_class("launcher-btn")
        btn_full.connect("clicked", lambda b: self._capture(interactive=False))
        vbox.pack_start(btn_full, False, False, 0)

        btn_area = Gtk.Button(label=_("✂️  Select Area"))
        btn_area.get_style_context().add_class("launcher-btn")
        btn_area.connect("clicked", lambda b: self._capture(interactive=True))
        vbox.pack_start(btn_area, False, False, 0)

        # Timer row
        timer_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        btn_timer = Gtk.Button(label=_("⏱  Timed Capture"))
        btn_timer.get_style_context().add_class("launcher-btn")
        btn_timer.set_hexpand(True)
        self._wayland_timer_spin = Gtk.SpinButton.new_with_range(1, 60, 1)
        self._wayland_timer_spin.set_value(self.settings.get('delay', 3))
        self._wayland_timer_spin.connect("value-changed", lambda s: self._set_setting('delay', int(s.get_value())))
        self._wayland_timer_spin.get_style_context().add_class("timer-spin")
        sec_label = Gtk.Label(label=_("sec"))
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
        self.launcher.connect("destroy", lambda w: Gtk.main_quit() if not getattr(self, '_rebuilding_launcher', False) else None)
        self.launcher.show_all()

    # --- Capture backends ---

    def _capture(self, interactive=False):
        """Dispatch to the right capture backend (Wayland portal or X11)."""
        selected_monitor = -1 # Default to 'All'
        if hasattr(self, 'monitor_combo'):
            selected_monitor = self.monitor_combo.get_active() - 1
            
        if hasattr(self, 'launcher') and self.launcher:
            self.launcher.hide()
            
        self._wants_selection = interactive
        self.is_full_capture = not interactive
        self._target_monitor = selected_monitor
        
        if self.is_wayland:
            GLib.timeout_add(200, lambda: self._portal_screenshot(interactive=False))
        else:
            GLib.timeout_add(200, self._x11_screenshot)

    def _timed_capture(self, seconds):
        """Start a countdown before capturing (reuses editor's tick/capture logic)."""
        if hasattr(self, 'launcher') and self.launcher:
            self.launcher.hide()
        self._countdown_remaining = seconds
        self._countdown_win = self._create_countdown_window(seconds)
        self._countdown_win.show_all()
        GLib.timeout_add(1000, self._tick_countdown)

