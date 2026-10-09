# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 random.kiapps
"""Native applet settings controls and explanatory notes."""

import gettext
import os
from html import escape

from gi.repository import Gtk
from JsonSettingsWidgets import SettingsWidget


DOMAIN = "easy-effects-selector@random.kiapps"
gettext.bindtextdomain(DOMAIN, os.path.expanduser("~/.local/share/locale"))


def _(text):
    return gettext.dgettext(DOMAIN, text)


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


class MenuControls(SettingsWidget):
    def __init__(self, info, key, settings):
        super().__init__()
        self._launch_key = info["launch-key"]
        self._bypass_key = info["bypass-key"]
        self._keep_key = info["keep-open-key"]
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

        self._keep_row = Gtk.Box(spacing=20)
        self._keep_row.set_margin_start(56)
        self._keep_label = Gtk.Label(label=_("Keep menu open after preset selection when bypass is active"), xalign=0)
        self._keep_label.set_line_wrap(True)
        self._keep_row.pack_start(self._keep_label, True, True, 0)
        self._keep_switch = Gtk.Switch(valign=Gtk.Align.CENTER)
        self._keep_switch.connect("notify::active", self._on_keep_toggled)
        self._keep_row.pack_end(self._keep_switch, False, False, 0)
        self.content_widget.pack_start(self._keep_row, False, False, 0)

        explanation = Gtk.Label(
            label=_("Clicking \"Easy Effects\" launches Easy Effects. Active bypass is always shown; it can be toggled when menu control is enabled."),
            xalign=0,
        )
        explanation.set_line_wrap(True)
        explanation.set_max_width_chars(58)
        explanation.get_style_context().add_class("dim-label")
        self.content_widget.pack_start(explanation, False, False, 0)

        self._on_value_changed(None, None)
        self._listener = self._on_value_changed
        settings.listen(self._launch_key, self._listener)
        settings.listen(self._bypass_key, self._listener)
        settings.listen(self._keep_key, self._listener)
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
        if self._syncing or self._destroyed:
            return
        if (self._settings.get_value(self._launch_key) is not True
                or self._settings.get_value(self._bypass_key) is not True):
            self._on_value_changed(None, None)
            return
        self._settings.set_value(self._keep_key, button.get_active())

    def _on_value_changed(self, key, value):
        if self._destroyed:
            return
        launch = self._settings.get_value(self._launch_key) is True
        bypass = self._settings.get_value(self._bypass_key) is True
        keep = self._settings.get_value(self._keep_key) is True
        self._syncing = True
        try:
            self._launch_switch.set_active(launch)
            self._bypass_switch.set_active(bypass)
            self._bypass_row.set_sensitive(launch)
            self._keep_switch.set_active(keep)
            self._keep_row.set_sensitive(launch and bypass)
        finally:
            self._syncing = False

    def _on_destroy(self, *args):
        self._destroyed = True
        for key in [self._launch_key, self._bypass_key, self._keep_key]:
            listeners = self._settings.listeners.get(key, [])
            if self._listener in listeners:
                listeners.remove(self._listener)
