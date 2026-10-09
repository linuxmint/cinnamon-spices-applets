# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 random.kiapps
"""Native applet settings controls and explanatory notes."""

import gettext
import os
from html import escape

from gi.repository import Gio, GLib, Gtk
from JsonSettingsWidgets import SettingsWidget


DOMAIN = "easy-effects-selector@random.kiapps"
gettext.bindtextdomain(DOMAIN, os.path.expanduser("~/.local/share/locale"))


def _(text):
    return gettext.dgettext(DOMAIN, text)


class QuickPresetChooser(SettingsWidget):
    """Keep occupied presets visible, using GTK's native insensitive rows."""

    def __init__(self, info, key, settings):
        super().__init__()
        self._key = info["setting-key"]
        self._keys = info["preset-keys"]
        self._settings = settings
        self._syncing = False
        self._destroyed = False
        self._rows = None
        self._refresh_timeout = 0

        self.label = Gtk.Label(label=_(info["description"]), xalign=0)
        self.label.set_line_wrap(True)
        self.pack_start(self.label, False, False, 0)
        self.content_widget = Gtk.ComboBox(valign=Gtk.Align.CENTER)
        renderer = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer, True)
        self.content_widget.add_attribute(renderer, "text", 1)
        self.content_widget.add_attribute(renderer, "sensitive", 2)
        self.pack_end(self.content_widget, False, False, 0)
        self.content_widget.connect("changed", self._on_changed)
        self.content_widget.connect("popup", self._on_popup)

        self._listener = self._on_value_changed
        for setting_key in self._keys:
            settings.listen(setting_key, self._listener)
        self._monitor = settings.file_obj.monitor_file(Gio.FileMonitorFlags.SEND_MOVED, None)
        self._monitor.connect("changed", self._queue_refresh)
        self.connect("destroy", self._on_destroy)
        self._refresh()

    def _refresh(self):
        if self._destroyed:
            return
        current = self._settings.get_value(self._key)
        occupied = {self._settings.get_value(key) for key in self._keys if key != self._key}
        options = self._settings.get_property(self._key, "options")
        rows = [(value, label, not value or value == current or value not in occupied)
                for label, value in options.items()]
        if current and not any(value == current for value, _, _ in rows):
            rows.append((current, _("%s (no longer available)") % current, True))
        self._syncing = True
        try:
            if rows != self._rows:
                self._rows = rows
                self.model = Gtk.ListStore(str, str, bool)
                self._iter_by_value = {}
                for row in rows:
                    self._iter_by_value[row[0]] = self.model.append(row)
                self.content_widget.set_model(self.model)
                self.content_widget.set_id_column(0)
            self.content_widget.set_active_iter(self._iter_by_value.get(current))
        finally:
            self._syncing = False

    def _on_popup(self, *args):
        if self._destroyed:
            return
        # Options-only file updates do not trigger Cinnamon's value listeners.
        self._refresh_from_disk()

    def _queue_refresh(self, *args):
        if not self._destroyed and not self._refresh_timeout:
            self._refresh_timeout = GLib.timeout_add(100, self._refresh_from_disk)

    def _refresh_from_disk(self):
        if self._refresh_timeout:
            GLib.source_remove(self._refresh_timeout)
            self._refresh_timeout = 0
        if self._destroyed:
            return False
        try:
            self._settings.check_settings()
        except Exception:
            # Cinnamon replaces the JSON file when saving. Retain the last valid
            # list if a monitor event arrives before that write is complete.
            return False
        self._refresh()
        return False

    def _on_changed(self, combo):
        if self._syncing or self._destroyed:
            return
        tree_iter = combo.get_active_iter()
        if tree_iter is None:
            return
        value = self.model[tree_iter][0]
        current = self._settings.get_value(self._key)
        occupied = {self._settings.get_value(key) for key in self._keys if key != self._key}
        if value and value != current and value in occupied:
            self._refresh()
            return
        self._settings.set_value(self._key, value)

    def _on_value_changed(self, *args):
        self._refresh()

    def _on_destroy(self, *args):
        self._destroyed = True
        self._monitor.cancel()
        if self._refresh_timeout:
            GLib.source_remove(self._refresh_timeout)
            self._refresh_timeout = 0
        for key in self._keys:
            listeners = self._settings.listeners.get(key, [])
            if self._listener in listeners:
                listeners.remove(self._listener)


class TooltipControls(SettingsWidget):
    def __init__(self, info, key, settings):
        super().__init__()
        self._settings = settings
        self._master_key = info["toggle-key"]
        self._destroyed = False
        self._syncing = False
        self._switches = {}
        self._detail_rows = []
        self.content_widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.content_widget.set_hexpand(True)
        self.pack_start(self.content_widget, True, True, 0)

        entries = [
            (self._master_key, _(info["description"])),
            ("tooltip-preset", _("Preset name")),
            ("tooltip-quick-position", _("Quick-selection position")),
            ("tooltip-settings-changed", _("Changed settings")),
            ("tooltip-bypass", _("Bypass status")),
            ("tooltip-comparison-error", _("Comparison errors")),
        ]
        for index, (setting_key, label) in enumerate(entries):
            row = Gtk.Box(spacing=20)
            if index:
                row.set_margin_start(28)
                self._detail_rows.append(row)
            text = Gtk.Label(label=label, xalign=0)
            text.set_line_wrap(True)
            row.pack_start(text, True, True, 0)
            switch = Gtk.Switch(valign=Gtk.Align.CENTER)
            switch.connect("notify::active", lambda button, *args, k=setting_key: self._on_toggled(button, k))
            row.pack_end(switch, False, False, 0)
            self._switches[setting_key] = switch
            self.content_widget.pack_start(row, False, False, 0)

        self._listener = self._on_value_changed
        for setting_key in self._switches:
            settings.listen(setting_key, self._listener)
        self.connect("destroy", self._on_destroy)
        self._on_value_changed()

    def _on_toggled(self, switch, key):
        if self._syncing or self._destroyed:
            return
        if key != self._master_key and self._settings.get_value(self._master_key) is not True:
            self._on_value_changed()
            return
        self._settings.set_value(key, switch.get_active())

    def _on_value_changed(self, *args):
        if self._destroyed:
            return
        enabled = self._settings.get_value(self._master_key) is True
        self._syncing = True
        try:
            for key, switch in self._switches.items():
                switch.set_active(self._settings.get_value(key) is True)
            for row in self._detail_rows:
                row.set_sensitive(enabled)
        finally:
            self._syncing = False

    def _on_destroy(self, *args):
        self._destroyed = True
        for key in self._switches:
            listeners = self._settings.listeners.get(key, [])
            if self._listener in listeners:
                listeners.remove(self._listener)


class ReferenceNote(SettingsWidget):
    def __init__(self, info, key, settings):
        super().__init__()
        text = _(info["description"])
        self.content_widget = Gtk.Label(label=text, xalign=0)
        before, opening, rest = text.partition("<b>")
        action, closing, after = rest.partition("</b>")
        if info.get("emphasize-action") and opening and closing:
            # Dim the explanation only; the action keeps the theme's text color.
            self.content_widget.set_markup(
                '<span alpha="55%">{}</span><b>{}</b><span alpha="55%">{}</span>'.format(
                    escape(before), escape(action), escape(after)
                )
            )
        else:
            self.content_widget.get_style_context().add_class("dim-label")
        self.content_widget.set_line_wrap(True)
        self.content_widget.set_max_width_chars(58)
        self.pack_start(self.content_widget, True, True, 0)
        self.connect("map", self._hide_upper_separator)

    def _hide_upper_separator(self, *args):
        # Xapp wraps each settings row with its preceding separator. Restrict
        # this change to the note's own wrapper; the next row keeps its line.
        row = self.get_ancestor(Gtk.ListBoxRow)
        if row is None:
            return
        list_box = row.get_parent()
        if not isinstance(list_box, Gtk.ListBox):
            return
        wrapper = list_box.get_parent()
        if not isinstance(wrapper, Gtk.Box):
            return
        for child in wrapper.get_children():
            if child is list_box:
                break
            if isinstance(child, Gtk.Separator):
                child.set_no_show_all(True)
                child.hide()


class OperationControls(SettingsWidget):
    def __init__(self, info, key, settings):
        super().__init__()
        self._launch_key = info["launch-key"]
        self._bypass_key = info["bypass-key"]
        self._middle_key = info["middle-click-key"]
        self._keep_key = info["keep-open-key"]
        self._scroll_key = info["scroll-key"]
        self._settings = settings
        self._syncing = True
        self._destroyed = False

        self.content_widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.content_widget.set_hexpand(True)
        self.pack_start(self.content_widget, True, True, 0)

        self._launch_row = Gtk.Box(spacing=20)
        self._launch_label = Gtk.Label(label=_(info["description"]), xalign=0)
        self._launch_label.set_line_wrap(True)
        self._launch_row.pack_start(self._launch_label, True, True, 0)
        self._launch_switch = Gtk.Switch(valign=Gtk.Align.CENTER)
        self._launch_switch.connect("notify::active", self._on_launch_toggled)
        self._launch_row.pack_end(self._launch_switch, False, False, 0)
        self.content_widget.pack_start(self._launch_row, False, False, 0)

        self._bypass_row = Gtk.Box(spacing=20)
        self._bypass_row.set_margin_start(28)
        self._bypass_label = Gtk.Label(label=_("Toggle bypass in menu"), xalign=0)
        self._bypass_label.set_line_wrap(True)
        self._bypass_row.pack_start(self._bypass_label, True, True, 0)
        self._bypass_switch = Gtk.Switch(valign=Gtk.Align.CENTER)
        self._bypass_switch.connect("notify::active", self._on_bypass_toggled)
        self._bypass_row.pack_end(self._bypass_switch, False, False, 0)
        self.content_widget.pack_start(self._bypass_row, False, False, 0)

        self._middle_row = Gtk.Box(spacing=20)
        self._middle_label = Gtk.Label(label=_("Toggle bypass with middle click"), xalign=0)
        self._middle_label.set_line_wrap(True)
        self._middle_row.pack_start(self._middle_label, True, True, 0)
        self._middle_switch = Gtk.Switch(valign=Gtk.Align.CENTER)
        self._middle_switch.connect("notify::active", self._on_middle_toggled)
        self._middle_row.pack_end(self._middle_switch, False, False, 0)
        self.content_widget.pack_start(self._middle_row, False, False, 0)

        self._keep_row = Gtk.Box(spacing=20)
        self._keep_label = Gtk.Label(label=_("Keep menu open after preset selection when bypass is active"), xalign=0)
        self._keep_label.set_line_wrap(True)
        self._keep_row.pack_start(self._keep_label, True, True, 0)
        self._keep_switch = Gtk.Switch(valign=Gtk.Align.CENTER)
        self._keep_switch.connect("notify::active", self._on_keep_toggled)
        self._keep_row.pack_end(self._keep_switch, False, False, 0)
        self.content_widget.pack_start(self._keep_row, False, False, 0)

        self._scroll_row = Gtk.Box(spacing=20)
        self._scroll_label = Gtk.Label(label=_("Switch presets with mouse wheel"), xalign=0)
        self._scroll_label.set_line_wrap(True)
        self._scroll_row.pack_start(self._scroll_label, True, True, 0)
        self._scroll_switch = Gtk.Switch(valign=Gtk.Align.CENTER)
        self._scroll_switch.connect("notify::active", self._on_scroll_toggled)
        self._scroll_row.pack_end(self._scroll_switch, False, False, 0)
        self.content_widget.pack_start(self._scroll_row, False, False, 0)

        self._on_value_changed(None, None)
        self._listener = self._on_value_changed
        settings.listen(self._launch_key, self._listener)
        settings.listen(self._bypass_key, self._listener)
        settings.listen(self._middle_key, self._listener)
        settings.listen(self._keep_key, self._listener)
        settings.listen(self._scroll_key, self._listener)
        self.connect("destroy", self._on_destroy)

    def _on_launch_toggled(self, button, *args):
        if not self._syncing and not self._destroyed:
            self._settings.set_value(self._launch_key, button.get_active())

    def _on_bypass_toggled(self, button, *args):
        if self._syncing or self._destroyed:
            return
        if self._settings.get_value(self._launch_key) is not True:
            self._on_value_changed(None, None)
            return
        self._settings.set_value(self._bypass_key, button.get_active())

    def _on_keep_toggled(self, button, *args):
        if not self._syncing and not self._destroyed:
            self._settings.set_value(self._keep_key, button.get_active())

    def _on_middle_toggled(self, button, *args):
        if not self._syncing and not self._destroyed:
            self._settings.set_value(self._middle_key, button.get_active())

    def _on_scroll_toggled(self, button, *args):
        if not self._syncing and not self._destroyed:
            self._settings.set_value(self._scroll_key, button.get_active())

    def _on_value_changed(self, key, value):
        if self._destroyed:
            return
        launch = self._settings.get_value(self._launch_key) is True
        bypass = self._settings.get_value(self._bypass_key) is True
        middle = self._settings.get_value(self._middle_key) is True
        keep = self._settings.get_value(self._keep_key) is True
        scroll = self._settings.get_value(self._scroll_key) is True
        self._syncing = True
        try:
            self._launch_switch.set_active(launch)
            self._bypass_switch.set_active(bypass)
            self._bypass_row.set_sensitive(launch)
            self._middle_switch.set_active(middle)
            self._keep_switch.set_active(keep)
            self._scroll_switch.set_active(scroll)
        finally:
            self._syncing = False

    def _on_destroy(self, *args):
        self._destroyed = True
        for key in [self._launch_key, self._bypass_key, self._middle_key, self._keep_key, self._scroll_key]:
            listeners = self._settings.listeners.get(key, [])
            if self._listener in listeners:
                listeners.remove(self._listener)
