"""Native Cinnamon settings row with an automatic radeontop bus placeholder."""

from __future__ import annotations

import gettext
import re
from pathlib import Path

from gi.repository import Gio, GLib, Gtk
from xapp.SettingsWidgets import SettingsWidget


_ = gettext.translation(
    "system-monitor@oss-singularity",
    localedir=str(Path.home() / ".local/share/locale"),
    fallback=True,
).gettext


class GpuBusSetting(SettingsWidget):
    """Show the detected radeontop bus without saving it as a manual value."""

    _SETTING_KEY = "gpu-bus"

    def __init__(self, _info, _key, settings):
        super().__init__()
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(8)
        self._automatic_bus = None
        self._detecting = True
        self._process = None
        self._timeout = 0
        self._closed = False
        self._click_gesture = None
        self._click_handler = 0

        row = Gtk.Grid(column_spacing=16)
        label = Gtk.Label(
            label=settings.get_property(self._SETTING_KEY, "description"),
            xalign=0,
        )
        entry = Gtk.Entry(hexpand=True, width_chars=10)
        entry.get_accessible().set_name(label.get_text())
        entry.set_tooltip_text(settings.get_property(self._SETTING_KEY, "tooltip"))
        row.attach(label, 0, 0, 1, 1)
        row.attach(entry, 1, 0, 1, 1)
        self.pack_start(row, False, False, 0)

        settings.bind(self._SETTING_KEY, entry, "text", Gio.SettingsBindFlags.DEFAULT)
        entry.connect("focus-in-event", self._focus_changed, True)
        entry.connect("focus-out-event", self._focus_changed, False)
        self.entry = entry

        self.connect("hierarchy-changed", self._hierarchy_changed)
        self.connect("destroy", self._destroyed)
        self._set_placeholder()
        self._detect_automatic_bus()

    def _focus_changed(self, _entry, _event, focused):
        self._set_placeholder(focused=focused)
        return False

    def _hierarchy_changed(self, *_args):
        self._disconnect_click_gesture()
        window = self.get_toplevel()
        if self._closed or not isinstance(window, Gtk.Window):
            return
        # Capture before child controls consume clicks, including non-focusable
        # labels and empty areas. Leave the event available to its normal target.
        self._click_gesture = Gtk.GestureMultiPress.new(window)
        self._click_gesture.set_button(0)
        self._click_gesture.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
        self._click_handler = self._click_gesture.connect("pressed", self._window_pressed)

    def _window_pressed(self, gesture, _count, x, y):
        window = gesture.get_widget()
        entry = window.get_focus()
        if self._closed or entry is not self.entry:
            return
        position = entry.translate_coordinates(window, 0, 0)
        if position is None:
            return
        left, top = position
        if not (left <= x < left + entry.get_allocated_width() and top <= y < top + entry.get_allocated_height()):
            window.set_focus(None)

    def _disconnect_click_gesture(self):
        if self._click_gesture is not None:
            self._click_gesture.disconnect(self._click_handler)
            self._click_gesture.set_propagation_phase(Gtk.PropagationPhase.NONE)
            self._click_gesture.reset()
            self._click_gesture = None
            self._click_handler = 0

    def _set_placeholder(self, focused=None):
        if focused is None:
            focused = self.entry.has_focus()
        if focused:
            self.entry.set_placeholder_text(None)
        elif self._detecting:
            self.entry.set_placeholder_text(_("Detecting automatic bus…"))
        else:
            self.entry.set_placeholder_text(self._automatic_bus or _("No automatic bus found"))

    def _detect_automatic_bus(self):
        if self._closed or self._process is not None:
            return
        try:
            process = Gio.Subprocess.new(
                ["radeontop", "-l", "1", "-d", "-"],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
            )
            self._process = process
            self._timeout = GLib.timeout_add_seconds(5, self._timed_out)
            process.communicate_utf8_async(None, None, self._checked)
        except GLib.Error:
            self._finish_detection(None)

    def _checked(self, process, result):
        bus = None
        try:
            ok, stdout, _stderr = process.communicate_utf8_finish(result)
            if ok and process.get_successful():
                match = re.search(r"\bbus\s+([0-9a-fA-F]{2})\b", stdout or "")
                if match:
                    bus = match.group(1).upper()
        except (GLib.Error, TypeError):
            pass
        self._finish_detection(bus)

    def _finish_detection(self, bus):
        self._process = None
        if self._timeout:
            GLib.source_remove(self._timeout)
            self._timeout = 0
        if self._closed:
            return
        self._detecting = False
        self._automatic_bus = bus
        self._set_placeholder()

    def _timed_out(self):
        self._timeout = 0
        process = self._process
        self._process = None
        if process:
            process.force_exit()
        self._detecting = False
        self._set_placeholder()
        return GLib.SOURCE_REMOVE

    def _destroyed(self, *_args):
        self._closed = True
        self._disconnect_click_gesture()
        if self._timeout:
            GLib.source_remove(self._timeout)
            self._timeout = 0
        if self._process:
            self._process.force_exit()
            self._process = None
