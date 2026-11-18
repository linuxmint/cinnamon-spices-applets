"""Native Cinnamon rows with view-dependent visibility and live editing.

Copyright (C) 2026 rasmarc
SPDX-License-Identifier: GPL-2.0-or-later
"""

import importlib.util
import json
import gettext
import locale
import math
import os
import re
from pathlib import Path

_ = gettext.translation("supermenu@rasmarc",
    str(Path.home() / ".local/share/locale"), fallback=True).gettext

from gi.repository import Gdk, GdkPixbuf, Gio, GLib, Gtk, Pango, XApp
from xapp.SettingsWidgets import SettingsWidget, SettingsSection
from JsonSettingsWidgets import (
    JSONSettingsSpinButton,
    JSONSettingsSwitch,
    JSONSettingsKeybinding,
)

_content_spec = importlib.util.spec_from_file_location("supermenu_content_dialog",
    os.path.join(os.path.dirname(__file__), "content_dialog.py"))
_content_dialog = importlib.util.module_from_spec(_content_spec)
_content_spec.loader.exec_module(_content_dialog)


def _stabilize_settings_window(widget, *args):
    # Wrap wide row labels to fit; only vertical overflow should scroll.
    # NEVER/NEVER would also force the host to grow with the page's height.
    outer = None
    pages = None
    parent = widget.get_parent()
    while parent is not None:
        if isinstance(parent, Gtk.ScrolledWindow):
            outer = parent
        if pages is None and isinstance(parent, Gtk.Stack) and parent.get_child_by_name("behavior") is not None:
            pages = parent
        parent = parent.get_parent()
    if outer is not None:
        outer.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        outer.set_propagate_natural_width(False)
        outer.set_propagate_natural_height(False)
        if pages is not None:
            _watch_page_tabs(pages, outer)


def _watch_page_tabs(pages, scroller):
    # Cinnamon puts its named page stack inside one shared outer scroller.
    # All named pages share this scroller; start each newly selected page at top.
    if getattr(pages, "_pm_page_scroll_signal", 0):
        return

    def reset_position(stack, *args):
        adjustment = scroller.get_vadjustment()
        adjustment.set_value(adjustment.get_lower())

    def stop_watching(stack):
        stack.disconnect(stack._pm_page_scroll_signal)
        stack._pm_page_scroll_signal = 0

    pages._pm_page_scroll_signal = pages.connect("notify::visible-child-name", reset_position)
    pages.connect("destroy", stop_watching)
    reset_position(pages)


def _keep_window_size(widget):
    widget.connect("hierarchy-changed", _stabilize_settings_window)
    widget.connect("map", _stabilize_settings_window)


def _scroll_settings_page(widget, event):
    parent = widget.get_parent()
    while parent is not None and not isinstance(parent, Gtk.ScrolledWindow):
        parent = parent.get_parent()
    if parent is not None:
        Gtk.propagate_event(parent, event)
    return True


def _settings_label(text):
    """Keep long translations and larger fonts inside the settings page."""
    label = Gtk.Label(label=text, xalign=0)
    label.set_line_wrap(True)
    label.set_max_width_chars(40)
    return label


class _DependentRow:
    def _setup_dependency(self, properties, settings):
        self._dependency_margin = self.get_margin_start()
        self.set_margin_start(self._dependency_margin + properties.get("indent", 18))
        self._settings = settings
        self._conditions = properties["sensitive-keys"]
        self._alternatives = properties.get("sensitive-any", [{}])
        self._visible_conditions = properties.get("visible-keys", {})
        self._visible_alternatives = properties.get("visible-any", [{}])
        _keep_window_size(self)
        self.connect("hierarchy-changed", self._dependency_changed)
        alternative_keys = {key for conditions in self._alternatives for key in conditions}
        alternative_keys |= {key for conditions in self._visible_alternatives for key in conditions}
        for key in set(self._conditions) | set(self._visible_conditions) | alternative_keys:
            settings.listen(key, self._dependency_changed)
        self._dependency_changed(None, None)

    def _matches(self, conditions):
        return all((self._settings.get_value(name) in expected if isinstance(expected, list)
                    else self._settings.get_value(name) == expected)
                   for name, expected in conditions.items())

    def _dependency_changed(self, *args):
        sensitive = self._matches(self._conditions) and any(
            self._matches(conditions) for conditions in self._alternatives)
        self.set_sensitive(sensitive)
        if not sensitive:
            choice = getattr(self, "content_widget", None)
            popover = getattr(self, "popover", None) or getattr(choice, "popover", None)
            if popover is not None:
                popover.popdown()
            dialog = getattr(self, "_icon_dialog", None)
            if dialog is not None:
                dialog.response(Gtk.ResponseType.CANCEL)
        visible = self._matches(self._visible_conditions) and any(
            self._matches(conditions) for conditions in self._visible_alternatives)
        # Hide the complete native row, including its separator. no-show-all
        # prevents later section construction from revealing inactive views.
        target, section = self, self.get_parent()
        while section is not None and not isinstance(section, SettingsSection):
            section = section.get_parent()
        if section is not None:
            while target.get_parent() is not section.box:
                target = target.get_parent()
        if target is not self:
            self.set_no_show_all(False)
            self.set_visible(True)
        target.set_no_show_all(not visible)
        if visible:
            # GTK creates widgets hidden. A wrapper skipped by the initial
            # window.show_all() still contains hidden list boxes, rows and
            # controls. Showing just the wrapper cannot reveal that subtree.
            target.show_all()
        else:
            target.hide()


EDITOR_PATH = "/org/rasmarc/SuperMenu/Editor"
EDITOR_INTERFACE = "org.rasmarc.SuperMenu.Editor"


class EditorHeader(SettingsWidget):
    """A transient live control in the native section heading, not JSON state."""
    def __init__(self, properties, key, settings):
        super().__init__()
        self.fill_row()
        self.proxy = None
        self._settings = settings
        settings.listen("pm-personal-enabled", self._sync_state)
        self._disposed = False
        self._attached = False
        self._syncing = False
        self._window = None
        self._window_signal = 0
        self._proxy_signal = 0
        self._separator_idle = 0
        self._heading_size_group = None
        self.checkbox = Gtk.CheckButton(label=properties["description"])
        self.checkbox.set_sensitive(False)
        self.pack_end(self.checkbox, False, False, 0)
        self.checkbox.connect("toggled", self._toggled)
        self.connect("hierarchy-changed", self._attach_header)
        self.connect("map", self._connect_proxy)
        self.connect("destroy", self._destroyed)
        _keep_window_size(self)

    def _attach_header(self, *args):
        self._attach_window()
        parent = self.get_parent()
        while parent is not None and not isinstance(parent, SettingsSection):
            parent = parent.get_parent()
        if parent is None or self._attached:
            return
        section = parent
        header = next((child for child in section.get_children() if child is not section.frame), None)
        if header is None or not header.get_children():
            return
        self._attached = True
        title = header.get_children()[0]
        header.remove(title)
        line = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=18)
        line.pack_start(title, True, True, 0)
        wrapper = self
        while wrapper.get_parent() is not section.box:
            wrapper = wrapper.get_parent()
        self.get_parent().remove(self)
        line.pack_end(self, False, False, 0)
        header.pack_start(line, False, False, 0)
        header.reorder_child(line, 0)
        wrapper.destroy()
        # The removed placeholder was the first row. Its successor needs no
        # leading separator, regardless of when hierarchy-changed was emitted.
        self._separator_idle = GLib.idle_add(self._remove_first_separator, section)
        line.show_all()
        self._attach_window()

    def _attach_window(self):
        window = self.get_toplevel()
        if self._window is None and isinstance(window, Gtk.Window):
            self._window = window
            self._window_signal = window.connect("destroy", self._window_closed)

    def _remove_first_separator(self, section):
        self._separator_idle = 0
        if not self._disposed:
            rows = section.box.get_children()
            if rows:
                for child in rows[0].get_children():
                    if isinstance(child, Gtk.Separator):
                        child.destroy()
            self._align_headings()
        return False

    def _align_headings(self):
        # Use GTK's natural height rather than a fixed number of pixels. The
        # checkbox line and ordinary section titles then have identical space
        # above their frames, at every font size and display scale.
        root = self.get_toplevel()
        group = Gtk.SizeGroup(mode=Gtk.SizeGroupMode.VERTICAL)

        def visit(widget):
            if isinstance(widget, SettingsSection):
                header = next((child for child in widget.get_children()
                               if child is not widget.frame), None)
                if header is not None and header.get_children():
                    group.add_widget(header.get_children()[0])
            if isinstance(widget, Gtk.Container):
                for child in widget.get_children():
                    visit(child)

        visit(root)
        self._heading_size_group = group

    def _connect_proxy(self, *args):
        self._attach_window()
        if self._disposed or self.proxy is not None or getattr(self, "_connecting", False):
            return
        self._connecting = True
        Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.DO_NOT_AUTO_START,
            None, "org.Cinnamon", EDITOR_PATH, EDITOR_INTERFACE, None, self._proxy_ready)

    def _proxy_ready(self, source, result, *args):
        self._connecting = False
        try:
            proxy = Gio.DBusProxy.new_for_bus_finish(result)
        except GLib.Error:
            return
        if self._disposed:
            return
        self.proxy = proxy
        self._proxy_signal = proxy.connect("g-properties-changed", self._sync_state)
        self._sync_state()

    def _sync_state(self, *args):
        if self._disposed or self.proxy is None:
            return
        state = self.proxy.get_cached_property("Enabled")
        self.checkbox.set_sensitive(self._settings.get_value("pm-personal-enabled") and
                                    state is not None and bool(self.proxy.get_name_owner()))
        if state is not None:
            self._syncing = True
            self.checkbox.set_active(state.unpack())
            self._syncing = False

    def _toggled(self, button):
        if self._syncing or self._disposed or self.proxy is None or not self._settings.get_value("pm-personal-enabled"):
            return
        self.proxy.call("SetEnabled", GLib.Variant("(b)", (button.get_active(),)),
            Gio.DBusCallFlags.NONE, 1000, None, self._call_finished)

    def _call_finished(self, proxy, result, *args):
        try:
            proxy.call_finish(result)
        except GLib.Error:
            self._sync_state()

    def _window_closed(self, *args):
        # The settings process exits its GTK loop immediately after destroy.
        # Complete this short local call before that loop disappears.
        if getattr(self, "_closed_sent", False):
            return
        self._closed_sent = True
        if self.proxy is not None and self.proxy.get_name_owner():
            try:
                self.proxy.call_sync("SetEnabled", GLib.Variant("(b)", (False,)),
                    Gio.DBusCallFlags.NONE, 1000, None)
            except GLib.Error:
                pass

    def _destroyed(self, *args):
        if self._disposed:
            return
        self._window_closed()
        self._disposed = True
        if self._separator_idle:
            GLib.source_remove(self._separator_idle)
            self._separator_idle = 0
        if self._window is not None and self._window_signal:
            self._window.disconnect(self._window_signal)
        if self.proxy is not None and self._proxy_signal:
            self.proxy.disconnect(self._proxy_signal)
        self._window_signal = self._proxy_signal = 0


class ImportControl(SettingsWidget):
    """Content-only JSON import/export with a native confirming file dialog."""
    exporting = False
    last_folder = None

    def __init__(self, properties, key, settings):
        super().__init__()
        self._settings = settings
        self.proxy = None
        self._disposed = False
        self._busy = False
        self._proxy_signal = 0
        self._window = None
        self._window_signal = 0
        if not self.exporting:
            self._reset_replace()
        _keep_window_size(self)
        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        line = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        self.label = _settings_label(properties["description"])
        line.pack_start(self.label, True, True, 0)
        self.choose = Gtk.Button(label=_("Export…") if self.exporting else _("Import…"))
        self.choose.set_sensitive(False)
        line.pack_end(self.choose, False, False, 0)
        content.pack_start(line, False, False, 0)
        self.status = Gtk.Label(xalign=0)
        self.status.set_line_wrap(True)
        self.status.set_max_width_chars(60)
        self.status.set_no_show_all(True)
        content.pack_start(self.status, False, False, 0)
        self.pack_start(content, True, True, 0)
        self.choose.connect("clicked", self._choose_file)
        self.connect("map", self._connect_proxy)
        self.connect("hierarchy-changed", self._attach_window)
        self.connect("destroy", self._destroyed)

    def _reset_replace(self):
        if not self.exporting and self._settings.get_value("pm-import-replace") is True:
            self._settings.set_value("pm-import-replace", False)

    def _attach_window(self, *args):
        if self.exporting or self._disposed:
            return
        window = self.get_toplevel()
        if self._window is None and isinstance(window, Gtk.Window):
            self._window = window
            self._window_signal = window.connect("destroy", self._window_closed)

    def _window_closed(self, *args):
        self._reset_replace()

    def _connect_proxy(self, *args):
        self._attach_window()
        if self._disposed or self.proxy is not None or getattr(self, "_connecting", False):
            return
        self._connecting = True
        Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.DO_NOT_AUTO_START,
            None, "org.Cinnamon", EDITOR_PATH, EDITOR_INTERFACE, None, self._proxy_ready)

    def _proxy_ready(self, source, result, *args):
        self._connecting = False
        try:
            proxy = Gio.DBusProxy.new_for_bus_finish(result)
        except GLib.Error:
            return
        if self._disposed:
            return
        self.proxy = proxy
        self._proxy_signal = proxy.connect("notify::g-name-owner", self._sync_buttons)
        self._sync_buttons()

    def _sync_buttons(self, *args):
        enabled = not self._disposed and not self._busy and self.proxy is not None and bool(self.proxy.get_name_owner())
        self.choose.set_sensitive(enabled)

    def _choose_file(self, *args):
        if self._disposed or self._busy or self.proxy is None:
            return
        replacing = not self.exporting and self._settings.get_value("pm-import-replace") is True
        path = _content_dialog.choose_content_file(self.get_toplevel(), self.exporting,
            replacing, ImportControl.last_folder)
        if path:
            ImportControl.last_folder = os.path.dirname(path)
            self._import(path, replacing)

    def _import(self, path, replacing=None):
        if self._disposed or self._busy or self.proxy is None or not path:
            return
        if replacing is None:
            replacing = self._settings.get_value("pm-import-replace") is True
        self._replacing = replacing and not self.exporting
        self._busy = True
        self._sync_buttons()
        self.status.set_text(_("Saving backup…") if self.exporting else _("Reading import…"))
        self.status.set_visible(True)
        method = "ExportMenu" if self.exporting else "ImportMenu"
        parameters = GLib.Variant("(s)", (path,)) if self.exporting else GLib.Variant("(sb)", (path, self._replacing))
        self.proxy.call(method, parameters,
            Gio.DBusCallFlags.NONE, 15000, None, self._import_finished)

    def _import_finished(self, proxy, result, *args):
        try:
            data = json.loads(proxy.call_finish(result).unpack()[0])
            if not data.get("ok"):
                message = (_("Export failed: %s") if self.exporting else _("Import failed: %s")) % data.get("message", _("Unknown error"))
            elif self.exporting:
                message = _("Exported — entries: %d; categories: %d.") % (data["entries"], data["categories"])
            else:
                message = (_("Content replaced — entries: %d; categories: %d.") if data.get("replaced") else
                    _("Imported — entries: %d; new categories: %d.")) % (data["added"], data["created"])
                if data.get("separators"):
                    message += " " + _("Separators included: %d.") % data["separators"]
                if data.get("unavailable"):
                    message += " " + _("Unavailable applications: %d. Their entries remain saved.") % data["unavailable"]
                if data.get("ignored"):
                    message += " " + _("Inactive entries or separators skipped: %d.") % data["ignored"]
        except (GLib.Error, ValueError, KeyError, TypeError) as error:
            message = (_("Export failed: %s") if self.exporting else _("Import failed: %s")) % str(error)
        if self._disposed:
            return
        self._busy = False
        # The choice is for one completed attempt, including a reported error.
        # Late replies after window destruction must not affect a new window.
        self._reset_replace()
        self.status.set_text(message)
        self._sync_buttons()

    def _destroyed(self, *args):
        if self._disposed:
            return
        self._reset_replace()
        self._disposed = True
        if self._window is not None and self._window_signal:
            self._window.disconnect(self._window_signal)
        self._window_signal = 0
        if self.proxy is not None and self._proxy_signal:
            self.proxy.disconnect(self._proxy_signal)
        self._proxy_signal = 0


class ExportControl(ImportControl):
    exporting = True


class DependentKeybinding(_DependentRow, JSONSettingsKeybinding):
    def __init__(self, properties, key, settings):
        super().__init__(properties["setting-key"], settings, properties)
        self._setup_dependency(properties, settings)


class DependentSwitch(_DependentRow, JSONSettingsSwitch):
    def __init__(self, properties, key, settings):
        super().__init__(properties["setting-key"], settings, properties)
        self._setup_dependency(properties, settings)


class DependentSpinButton(_DependentRow, JSONSettingsSpinButton):
    def __init__(self, properties, key, settings):
        super().__init__(properties["setting-key"], settings, properties)
        # Native binding skips an equal numeric value. A new Gtk.SpinButton
        # can therefore retain empty text when the initial setting is zero.
        if not self.content_widget.get_text():
            self.content_widget.set_text(format(settings.get_value(properties["setting-key"]), "g"))
        self._setup_dependency(properties, settings)
        self.content_widget.connect("scroll-event", _scroll_settings_page)


class SteppedNumberControl(_DependentRow, SettingsWidget):
    """Free entry and one step per press, independent of wheel and key repeat."""
    def __init__(self, properties, key, settings):
        super().__init__()
        self._key = properties["setting-key"]
        self._settings = settings
        self._lower, self._upper = properties["min"], properties["max"]
        self._step = properties["step"]
        self._integer = properties.get("integer", False)
        self._held_arrows = set()
        label = _settings_label(properties["description"])
        self.pack_start(label, True, True, 0)
        controls = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0,
            valign=Gtk.Align.CENTER)
        controls.get_style_context().add_class("linked")
        minus, plus = Gtk.Button(label="−"), Gtk.Button(label="+")
        self.entry = Gtk.Entry()
        self.entry.set_width_chars(5)
        self.entry.set_alignment(1)
        for control in [minus, self.entry, plus]:
            controls.pack_start(control, False, False, 0)
        if properties.get("units"):
            self.pack_end(Gtk.Label(label=properties["units"]), False, False, 6)
        self.pack_end(controls, False, False, 0)
        self.entry.connect("activate", lambda _entry: self._commit())
        self.entry.connect("key-press-event", self._key_pressed)
        for button, direction in [(minus, -1), (plus, 1)]:
            button.connect("key-press-event", self._key_pressed, direction)
        for control in [minus, self.entry, plus]:
            control.connect("focus-out-event", self._focus_left)
            control.connect("key-release-event", self._key_released)
            control.connect("scroll-event", _scroll_settings_page)
        # The native pressed signal fires on mouse-down, without a repeat timer.
        minus.connect("pressed", lambda _button: self._advance(-1))
        plus.connect("pressed", lambda _button: self._advance(1))
        settings.listen(self._key, self._setting_changed)
        self._setting_changed(self._key, settings.get_value(self._key))
        self._setup_dependency(properties, settings)

    def _read_entry(self):
        try:
            value = float(self.entry.get_text().strip().replace(",", "."))
            if not math.isfinite(value):
                raise ValueError("A finite number is required")
            return max(self._lower, min(self._upper, value))
        except ValueError:
            return self._settings.get_value(self._key)

    def _store(self, value):
        value = max(self._lower, min(self._upper, value))
        if self._integer:
            value = int(math.floor(value + 0.5))
        if self._settings.get_value(self._key) != value:
            self._settings.set_value(self._key, value)
        self.entry.set_text(locale.format_string("%g", value, grouping=False))

    def _commit(self):
        self._store(self._read_entry())

    def _advance(self, direction):
        value = self._read_entry() / self._step
        multiple = math.floor(value) + 1 if direction > 0 else math.ceil(value) - 1
        self._store(multiple * self._step)

    def _focus_left(self, _entry, _event):
        self._held_arrows.clear()
        self._commit()
        return False

    def _key_pressed(self, _control, event, direction=None):
        if event.keyval in [Gdk.KEY_Up, Gdk.KEY_Down]:
            direction = 1 if event.keyval == Gdk.KEY_Up else -1
        elif direction is None or event.keyval not in [Gdk.KEY_space, Gdk.KEY_Return, Gdk.KEY_KP_Enter]:
            return False
        if event.keyval not in self._held_arrows:
            self._held_arrows.add(event.keyval)
            self._advance(direction)
        return True

    def _key_released(self, _entry, event):
        self._held_arrows.discard(event.keyval)
        return event.keyval in [Gdk.KEY_Up, Gdk.KEY_Down, Gdk.KEY_space, Gdk.KEY_Return, Gdk.KEY_KP_Enter]

    def _setting_changed(self, key, value):
        self._store(value)


class GridWidthControl(SteppedNumberControl):
    pass


class RecentLimitControl(SteppedNumberControl):
    def __init__(self, properties, key, settings):
        self._recent_indent = properties.get("indent", 36)
        super().__init__({**properties, "integer": True}, key, settings)

    def _dependency_changed(self, *args):
        super()._dependency_changed(*args)
        self.set_margin_start(self._dependency_margin + self._recent_indent +
            (18 if self._settings.get_value("pm-personal-drawer-mode") == "single" else 0))


class _PanelIconTile(Gtk.DrawingArea):
    """A solid Cinnamon panel swatch with a scale-aware themed icon."""
    def __init__(self):
        super().__init__()
        self.set_size_request(16, 16)
        self._preview = None
        self._pixbuf = None
        self.connect("draw", self._draw)
        self.connect("notify::scale-factor", self.invalidate)

    def set_preview(self, icon, background, foreground, height, size, theme_color=False):
        preview = (icon, tuple(background), tuple(foreground), height, size, theme_color)
        if preview != self._preview:
            self._preview = preview
            self.set_size_request(height, height)
            self.invalidate()

    def invalidate(self, *args):
        self._pixbuf = None
        self.queue_draw()

    def _draw(self, widget, context):
        if self._preview is None:
            return False
        icon, background, foreground, _height, size, theme_color = self._preview
        width, height = self.get_allocated_width(), self.get_allocated_height()
        context.set_source_rgba(*background)
        context.rectangle(0, 0, width, height)
        context.fill()
        scale = self.get_scale_factor()
        if self._pixbuf is None:
            color = Gdk.RGBA()
            color.red, color.green, color.blue, color.alpha = foreground
            theme = Gtk.IconTheme.get_default()
            try:
                if theme_color:
                    with open(icon, encoding="utf-8") as source:
                        svg = source.read()
                    css = "rgba(%d,%d,%d,%s)" % (*[round(value * 255) for value in foreground[:3]], foreground[3])
                    svg = re.sub(r'(<svg\b[^>]*\bcolor=)"[^"]*"',
                        lambda match: match[1] + '"' + css + '"', svg, count=1)
                    loader = GdkPixbuf.PixbufLoader.new_with_type("svg")
                    loader.set_size(size * scale, size * scale)
                    loader.write(svg.encode("utf-8"))
                    loader.close()
                    self._pixbuf = loader.get_pixbuf()
                else:
                    info = theme.lookup_by_gicon_for_scale(Gio.icon_new_for_string(icon),
                        size, scale, Gtk.IconLookupFlags.FORCE_SIZE)
                    if info is not None:
                        self._pixbuf, _symbolic = info.load_symbolic(color, None, None, None)
            except (GLib.Error, OSError):
                pass
        if self._pixbuf is not None:
            context.save()
            context.translate(width / 2, height / 2)
            context.scale(1 / scale, 1 / scale)
            Gdk.cairo_set_source_pixbuf(context, self._pixbuf,
                -self._pixbuf.get_width() / 2, -self._pixbuf.get_height() / 2)
            context.paint()
            context.restore()
        return False


class PanelIconChooser(_DependentRow, SettingsWidget):
    """Panel-sized icon previews and the native XApp symbol/image picker."""
    def __init__(self, properties, key, settings):
        super().__init__()
        self._key = properties["setting-key"]
        self._menu = self._key.split("-")[1]
        self._icon_key = "pm-" + self._menu + "-icon"
        self._ids = list(properties["options"].values())
        self._settings = settings
        self._description = properties["description"]
        self._proxy = None
        self._connecting = False
        self._disposed = False
        self._proxy_signals = []
        self._choices = {}
        self._buttons = {}
        self._palette = None
        self._height = 16
        self._syncing = False
        self._hover_style = Gtk.CssProvider()
        self._hover_context = None
        self._hover_css = None
        self._hover_signal = 0
        self.pack_start(_settings_label(self._description), True, True, 0)
        self.button = Gtk.MenuButton(valign=Gtk.Align.CENTER)
        # Gtk.MenuButton disables this by default. Restore focus to this visible
        # button when its popover closes, rather than scrolling to an older row.
        self.button.set_focus_on_click(True)
        self.tile = _PanelIconTile()
        self.button.add(self.tile)
        self.popover = Gtk.Popover.new(self.button)
        self.strip = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6, margin=8)
        self.scroller = Gtk.ScrolledWindow()
        self.scroller.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.NEVER)
        self.scroller.set_propagate_natural_width(True)
        self.scroller.add(self.strip)
        self.popover.add(self.scroller)
        self.popover.connect("show", self._fit_popover)
        self.button.set_popover(self.popover)
        self.button.set_sensitive(False)
        self.button.connect("scroll-event", _scroll_settings_page)
        self.button.get_accessible().set_name(self._description)
        self.pack_end(self.button, False, False, 0)
        settings.listen(self._key, self._value_changed)
        settings.listen(self._icon_key, self._value_changed)
        self._theme = Gtk.IconTheme.get_default()
        self._theme_signal = self._theme.connect("changed", self._icons_changed)
        self.connect("map", self._connect_proxy)
        self.connect("destroy", self._destroyed)
        self._setup_dependency(properties, settings)

    def _selected(self, button, ident):
        if self._disposed or self._syncing or self._palette is None:
            return
        self.popover.popdown()
        if self._choices[ident].get("choose"):
            self._choose_icon()
        elif self._settings.get_value(self._key) != ident:
            self._settings.set_value(self._key, ident)
        self._value_changed()
        self.button.grab_focus()

    def _choose_icon(self):
        dialog = XApp.IconChooserDialog()
        self._icon_dialog = dialog
        dialog.set_title(_("Choose a custom icon or image"))
        dialog.set_transient_for(self.get_toplevel())
        dialog.set_modal(True)
        dialog.set_destroy_with_parent(True)
        if self._settings.has_property(self._icon_key, "icon_categories"):
            for category in self._settings.get_property(self._icon_key, "icon_categories"):
                dialog.add_custom_category(category["name"], category["icons"])
        try:
            if dialog.run_with_category("Linux Mint") == Gtk.ResponseType.OK and self._matches(self._conditions):
                icon = dialog.get_icon_string()
                if icon:
                    self._settings.set_value(self._icon_key, icon)
                    self._settings.set_value(self._key, "user-icon")
        finally:
            self._icon_dialog = None
            dialog.destroy()

    def _fit_popover(self, *args):
        if self._hover_context is None:
            # GTK's Foreign Drawing example: resolve a native menu item's style
            # in this container without creating another visible widget.
            parent = self.strip.get_style_context()
            path = parent.get_path().copy()
            position = path.append_type(Gtk.ModelButton.__gtype__)
            path.iter_set_object_name(position, "modelbutton")
            path.iter_add_class(position, "flat")
            path.iter_set_state(position, Gtk.StateFlags.PRELIGHT)
            self._hover_context = Gtk.StyleContext()
            self._hover_context.set_path(path)
            self._hover_context.set_parent(parent)
            self._hover_context.set_state(Gtk.StateFlags.PRELIGHT)
            self._hover_signal = self._hover_context.connect("changed", self._update_hover_style)
        self._update_hover_style()
        width = max(1, self.get_toplevel().get_allocated_width() - 48)
        natural = len(self._buttons) * (self._height + 20) + 6 * max(0, len(self._buttons) - 1) + 16
        self.scroller.set_min_content_width(min(width, natural))
        self.scroller.set_max_content_width(width)

    def _update_hover_style(self, *args):
        if self._disposed:
            return
        color = self._hover_context.get_property("background-color", Gtk.StateFlags.PRELIGHT).to_string()
        # Reuse the menu hover color; suppress the generic button's brightening.
        # Paint only, with the existing sizes and persistent checked treatment.
        css = ("""button:hover:not(:checked) {
            background-image: none; background-color: %s; border-color: %s;
            box-shadow: none; outline: 1px solid %s; outline-offset: -1px;
            transition: none;
        }""" % (color, color, color)).encode("utf-8")
        if css != self._hover_css:
            self._hover_css = css
            self._hover_style.load_from_data(css)

    def _value_changed(self, *args):
        if self._disposed or self._palette is None:
            return
        value = self._settings.get_value(self._key)
        selected = self._choices.get(value)
        if selected is None:
            return
        icon, name = selected["icon"], selected["name"]
        if selected.get("choose"):
            icon = self._settings.get_value(self._icon_key) or icon
        self.tile.set_preview(icon, *self._palette, self._height, selected["size"], selected.get("themeColor", False))
        self.button.set_tooltip_text(name)
        self.button.get_accessible().set_name(self._description + ": " + name)
        self._syncing = True
        try:
            for ident, (button, tile) in self._buttons.items():
                button.set_active(ident == value)
        finally:
            self._syncing = False

    def _icons_changed(self, *args):
        self.tile.invalidate()
        for button, tile in self._buttons.values():
            tile.invalidate()

    def _connect_proxy(self, *args):
        if self._disposed or self._proxy is not None or self._connecting:
            return
        self._connecting = True
        Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.DO_NOT_AUTO_START,
            None, "org.Cinnamon", EDITOR_PATH, EDITOR_INTERFACE, None, self._proxy_ready)

    def _proxy_ready(self, source, result, *args):
        self._connecting = False
        try:
            proxy = Gio.DBusProxy.new_for_bus_finish(result)
        except GLib.Error:
            return
        if self._disposed:
            return
        self._proxy = proxy
        for name in ["g-properties-changed", "notify::g-name-owner"]:
            self._proxy_signals.append(proxy.connect(name, self._preview_changed))
        self._preview_changed()

    def _preview_changed(self, *args):
        if self._disposed:
            return
        try:
            variant = self._proxy.get_cached_property("PanelIconPreview") if self._proxy.get_name_owner() else None
            data = json.loads(variant.unpack()) if variant is not None else {}
            menu = data.get(self._menu, {})
            palette = [data.get("background"), menu.get("foreground")]
            height = data.get("height")
            valid = all(isinstance(color, list) and len(color) == 4 and
                all(type(value) in [float, int] and math.isfinite(value) and 0 <= value <= 1
                    for value in color) for color in palette)
            valid = valid and type(height) is int and 0 < height <= 4096
            choices = menu.get("icons", [])
            valid = valid and isinstance(choices, list) and len(choices) == len(self._ids) and all(
                isinstance(item, dict) and item.get("id") == ident and
                isinstance(item.get("name"), str) and isinstance(item.get("icon"), str) and
                type(item.get("themeColor", False)) is bool and
                type(item.get("size")) is int and 0 < item["size"] <= height
                for item, ident in zip(choices, self._ids))
            if not valid:
                self._palette = None
                self.button.set_sensitive(False)
                self.popover.popdown()
                return
            self._palette = palette
            self._height = height
            self._choices = {item["id"]: item for item in choices}
            for item in choices:
                ident = item["id"]
                if ident not in self._buttons:
                    button = Gtk.ToggleButton()
                    button.get_style_context().add_provider(self._hover_style,
                        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
                    tile = _PanelIconTile()
                    button.add(tile)
                    button.set_tooltip_text(item["name"])
                    button.get_accessible().set_name(item["name"])
                    button.connect("clicked", self._selected, ident)
                    self.strip.pack_start(button, False, False, 0)
                    self._buttons[ident] = button, tile
                self._buttons[ident][1].set_preview(item["icon"], *self._palette, height, item["size"], item.get("themeColor", False))
            self.scroller.show_all()
            self.strip.show_all()
            self.button.set_sensitive(True)
            self._value_changed()
        except (GLib.Error, ValueError, TypeError, AttributeError):
            self._palette = None
            self.button.set_sensitive(False)
            self.popover.popdown()

    def _destroyed(self, *args):
        self._disposed = True
        if self._proxy is not None:
            for signal in self._proxy_signals:
                self._proxy.disconnect(signal)
        self._proxy_signals = []
        if self._hover_context is not None:
            self._hover_context.disconnect(self._hover_signal)
            self._hover_context.set_parent(None)
            self._hover_context = None
            self._hover_signal = 0
        self._theme.disconnect(self._theme_signal)
        self.popover.destroy()


class _PopoverChoice(Gtk.MenuButton):
    """A text choice in an anchored, scrollable native GTK popover."""
    def __init__(self, selected):
        super().__init__(valign=Gtk.Align.CENTER)
        self.set_focus_on_click(True)
        self._selected = selected
        self._value = None
        self._choices = []
        self._buttons = []
        self.label = Gtk.Label(xalign=0)
        self.label.set_max_width_chars(32)
        self.label.set_ellipsize(Pango.EllipsizeMode.END)
        face = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        face.pack_start(self.label, True, True, 0)
        face.pack_end(Gtk.Image.new_from_icon_name("pan-down-symbolic", Gtk.IconSize.MENU), False, False, 0)
        self.add(face)
        self.popover = Gtk.Popover.new(self)
        self.popover.set_position(Gtk.PositionType.BOTTOM)
        self.popover.get_style_context().add_class("menu")
        self.rows = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0, margin=6)
        self.scroller = Gtk.ScrolledWindow()
        self.scroller.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.scroller.set_propagate_natural_width(True)
        self.scroller.set_propagate_natural_height(True)
        self.scroller.add(self.rows)
        self.popover.add(self.scroller)
        self.set_popover(self.popover)
        self.popover.connect("show", self._opened)
        self.popover.connect("key-press-event", self._key_pressed)
        self.connect("scroll-event", _scroll_settings_page)
        self.connect("destroy", lambda *_args: self.popover.destroy())

    def set_choices(self, choices):
        for button in self._buttons:
            button.destroy()
        self._choices = list(choices)
        self._buttons = []
        for value, text in self._choices:
            button = Gtk.ModelButton(text=text.replace("_", "__"), role=Gtk.ButtonRole.RADIO)
            button.set_tooltip_text(text)
            button.connect("clicked", self._chosen, value)
            self.rows.pack_start(button, False, True, 0)
            self._buttons.append(button)
        self.scroller.show_all()
        self.set_sensitive(bool(self._choices))
        self.set_value(self._value)

    def set_value(self, value):
        self._value = value
        text = ""
        for (candidate, label), button in zip(self._choices, self._buttons):
            button.props.active = candidate == value
            if candidate == value:
                text = label
        self.label.set_text(text)
        self.set_tooltip_text(text)
        self.get_accessible().set_name(text)

    def _chosen(self, button, value):
        self.popover.popdown()
        self._selected(value)
        self.grab_focus()

    def _opened(self, *args):
        window = self.get_toplevel()
        width = max(1, window.get_allocated_width() - 48)
        self.scroller.set_min_content_width(min(width, self.get_allocated_width()))
        self.scroller.set_max_content_width(width)
        self.scroller.set_max_content_height(max(1, min(320, window.get_allocated_height() // 2)))
        for (value, _text), button in zip(self._choices, self._buttons):
            if value == self._value:
                button.grab_focus()
                return
        if self._buttons:
            self._buttons[0].grab_focus()

    def _key_pressed(self, widget, event):
        if not self._buttons or event.keyval not in [Gdk.KEY_Up, Gdk.KEY_Down, Gdk.KEY_Home, Gdk.KEY_End]:
            return False
        index = next((i for i, button in enumerate(self._buttons) if button.has_focus()), 0)
        if event.keyval == Gdk.KEY_Home:
            index = 0
        elif event.keyval == Gdk.KEY_End:
            index = len(self._buttons) - 1
        else:
            index = max(0, min(len(self._buttons) - 1, index + (1 if event.keyval == Gdk.KEY_Down else -1)))
        self._buttons[index].grab_focus()
        return True


class CategoryComboBox(_DependentRow, SettingsWidget):
    """Live category choices; a missing category never overwrites the saved ID."""
    def __init__(self, properties, key, settings):
        super().__init__()
        self._key = properties["setting-key"]
        self._settings = settings
        self._proxy = None
        self._disposed = False
        self._connecting = False
        self._signals = []
        self._choices = [{"id": "", "name": _("None")}]
        self.pack_start(_settings_label(properties["description"]), True, True, 0)
        self.combo = _PopoverChoice(self._selected)
        self.pack_end(self.combo, False, False, 0)
        settings.listen(self._key, self._value_changed)
        self.connect("map", self._connect_proxy)
        self.connect("destroy", self._destroyed)
        self._setup_dependency(properties, settings)
        self._fill()

    def _fill(self):
        if self._disposed:
            return
        self.combo.set_choices((choice["id"], choice["name"]) for choice in self._choices)
        value = self._settings.get_value(self._key)
        self.combo.set_value(value if any(item["id"] == value for item in self._choices) else "")

    def _selected(self, value):
        if not self._disposed and self._settings.get_value(self._key) != value:
            self._settings.set_value(self._key, value)

    def _value_changed(self, *args):
        self._fill()

    def _connect_proxy(self, *args):
        if self._disposed or self._proxy is not None or self._connecting:
            return
        self._connecting = True
        Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.DO_NOT_AUTO_START,
            None, "org.Cinnamon", EDITOR_PATH, EDITOR_INTERFACE, None, self._proxy_ready)

    def _proxy_ready(self, source, result, *args):
        self._connecting = False
        try:
            proxy = Gio.DBusProxy.new_for_bus_finish(result)
        except GLib.Error:
            return
        if self._disposed:
            return
        self._proxy = proxy
        for name in ["g-properties-changed", "notify::g-name-owner"]:
            self._signals.append(proxy.connect(name, self._categories_changed))
        self._categories_changed()

    def _categories_changed(self, *args):
        try:
            value = self._proxy.get_cached_property("Categories") if self._proxy.get_name_owner() else None
            choices = json.loads(value.unpack()) if value is not None else []
            if not isinstance(choices, list) or any(not isinstance(item, dict) or
                    not isinstance(item.get("id"), str) or not isinstance(item.get("name"), str) for item in choices):
                return
            self._choices = [{"id": "", "name": _("None")}] + [item for item in choices if item["id"]]
            self._fill()
        except (GLib.Error, ValueError, TypeError):
            return

    def _destroyed(self, *args):
        self._disposed = True
        if self._proxy is not None:
            for signal in self._signals:
                self._proxy.disconnect(signal)
        self._signals = []


class DependentComboBox(_DependentRow, SettingsWidget):
    def __init__(self, properties, key, settings):
        super().__init__()
        self.key = properties["setting-key"]
        self.settings = settings
        self.pack_start(_settings_label(properties["description"]), True, True, 0)
        self.content_widget = _PopoverChoice(self.set_value)
        self.content_widget.set_choices((value, label) for label, value in properties["options"].items())
        self.pack_end(self.content_widget, False, False, 0)
        settings.listen(self.key, self._value_changed)
        self._value_changed()
        self._setup_dependency(properties, settings)

    def set_value(self, value):
        if self.settings.get_value(self.key) != value:
            self.settings.set_value(self.key, value)

    def _value_changed(self, *args):
        self.content_widget.set_value(self.settings.get_value(self.key))


class SpacingSideComboBox(DependentComboBox):
    def set_value(self, value):
        previous = self.settings.get_value(self.key)
        percent = self.settings.get_value("pm-spacing-percent")
        super().set_value(value)
        # The popover calls this on a user selection. Programmatic updates/reset have
        # already stored their side, so the equality check prevents conversion.
        if previous != value:
            previous_sides = 2 if previous == "both" else 1
            sides = 2 if value == "both" else 1
            self.settings.set_value("pm-spacing-percent", percent * previous_sides / sides)


def next_spacing_value(value, direction, lower=0, upper=300):
    value = max(lower, min(upper, value))
    target = (math.floor(value / 5) + 1) * 5 if direction > 0 else (math.ceil(value / 5) - 1) * 5
    return max(lower, min(upper, target))


class SpacingControl(_DependentRow, SettingsWidget):
    """Free numeric entry; +/- advance to the next multiple of five."""
    def __init__(self, properties, key, settings):
        super().__init__()
        self._key = properties["setting-key"]
        self._settings = settings
        self._lower = properties["min"]
        self._both_upper = properties["max"]
        self._single_upper = properties["single-max"]
        self._side_key = properties["side-key"]
        label = _settings_label(properties["description"])
        self.pack_start(label, True, True, 0)
        controls = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=0)
        controls.get_style_context().add_class("linked")
        minus = Gtk.Button(label="−")
        plus = Gtk.Button(label="+")
        self.entry = Gtk.Entry()
        self.entry.set_width_chars(5)
        self.entry.set_alignment(1)
        for control in [minus, self.entry, plus]:
            controls.pack_start(control, False, False, 0)
            control.connect("scroll-event", _scroll_settings_page)
        self.pack_end(controls, False, False, 0)
        self.entry.connect("activate", lambda _entry: self._commit())
        self.entry.connect("focus-out-event", self._focus_left)
        self.entry.connect("key-press-event", self._key_pressed)
        minus.connect("clicked", lambda _button: self._advance(-1))
        plus.connect("clicked", lambda _button: self._advance(1))
        settings.listen(self._key, self._setting_changed)
        settings.listen(self._side_key, self._side_changed)
        self._side_changed()
        self._setup_dependency(properties, settings)
        if properties.get("tooltip"):
            self.set_tooltip_text(properties["tooltip"])

    def _read_entry(self):
        try:
            value = float(self.entry.get_text().strip().replace(",", "."))
            if not math.isfinite(value):
                raise ValueError("A finite spacing value is required")
            return max(self._lower, min(self._upper, value))
        except ValueError:
            return self._settings.get_value(self._key)

    def _store(self, value):
        value = max(self._lower, min(self._upper, value))
        if self._settings.get_value(self._key) != value:
            self._settings.set_value(self._key, value)
        self.entry.set_text(locale.format_string("%g", value, grouping=False))

    def _commit(self):
        self._store(self._read_entry())

    def _advance(self, direction):
        self._store(next_spacing_value(self._read_entry(), direction, self._lower, self._upper))

    def _focus_left(self, _entry, _event):
        self._commit()
        return False

    def _key_pressed(self, _entry, event):
        if event.keyval in [Gdk.KEY_Up, Gdk.KEY_Down]:
            self._advance(1 if event.keyval == Gdk.KEY_Up else -1)
            return True
        return False

    def _setting_changed(self, key, value):
        self._store(value)

    def _side_changed(self, *args):
        self._upper = self._both_upper if self._settings.get_value(self._side_key) == "both" else self._single_upper
        # The side selector converts the value immediately after changing the
        # side. Do not clamp that still unconverted value in between the writes.
        self.entry.set_text(locale.format_string("%g", self._settings.get_value(self._key), grouping=False))


class ResetSettingsButton(SettingsWidget):
    def __init__(self, properties, key, settings):
        super().__init__()
        _keep_window_size(self)
        button = Gtk.Button(label=properties["description"])
        if properties.get("tooltip"):
            button.set_tooltip_text(properties["tooltip"])
        button.connect("clicked", lambda _button: settings.reset_to_defaults())
        self.pack_start(button, True, True, 0)
