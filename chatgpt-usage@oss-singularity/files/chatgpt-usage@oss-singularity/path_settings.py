"""Native Cinnamon settings rows with read-only automatic-path placeholders."""

import gettext
import json
import sys
from pathlib import Path


from gi.repository import Gio, GLib, Gtk
from xapp.SettingsWidgets import SettingsWidget

_ = gettext.translation(
    "chatgpt-usage@oss-singularity", localedir=str(Path.home() / ".local/share/locale"), fallback=True
).gettext


class InstallationPaths(SettingsWidget):
    def __init__(self, _info, _key, settings):
        super().__init__()
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(8)
        self._paths = {}
        self._process = None
        self._timeout = 0
        self._closed = False
        self.entries = {}
        self.content_widget = Gtk.Grid(column_spacing=16, row_spacing=8)
        self.pack_start(self.content_widget, False, False, 0)
        for row, (key, label) in enumerate(
            [("codex-path", _("codex-cli path (optional)")), ("chatgpt-app-path", _("ChatGPT path (optional)"))]
        ):
            title = Gtk.Label(label=label, xalign=0)
            entry = Gtk.Entry(hexpand=True, width_chars=30)
            entry.get_accessible().set_name(label)
            entry.set_tooltip_text(settings.get_property(key, "tooltip"))
            self.content_widget.attach(title, 0, row, 1, 1)
            self.content_widget.attach(entry, 1, row, 1, 1)
            settings.bind(key, entry, "text", Gio.SettingsBindFlags.DEFAULT)
            entry.connect("focus-in-event", self._focus_changed, key, True)
            entry.connect("focus-out-event", self._focus_changed, key, False)
            self.entries[key] = entry
        footer = Gtk.Box(spacing=12)
        self.status = Gtk.Label(label=_("Checking automatic paths…"), xalign=0, wrap=True)
        self.status.set_hexpand(True)
        footer.pack_start(self.status, True, True, 0)
        self.recheck_button = Gtk.Button(label=_("Recheck"))
        self.recheck_button.set_tooltip_text(_("Find automatic paths again without changing your entries."))
        self.recheck_button.connect("clicked", self.recheck)
        footer.pack_end(self.recheck_button, False, False, 0)
        self.pack_start(footer, False, False, 0)
        self.connect("destroy", self._destroyed)
        self.recheck()

    def _focus_changed(self, _entry, _event, key, focused):
        self._set_placeholder(key, focused=focused)
        return False

    def _set_placeholder(self, key, focused=None):
        entry = self.entries[key]
        if focused is None:
            focused = entry.has_focus()
        entry.set_placeholder_text(None if focused else self._paths.get(key) or _("No automatic path found"))

    def recheck(self, *_args):
        if self._closed or self._process is not None:
            return
        self.recheck_button.set_sensitive(False)
        self.status.set_text(_("Checking automatic paths…"))
        try:
            process = Gio.Subprocess.new(
                [sys.executable, str(Path(__file__).with_name("chatgpt_usage.py")), "--detect-paths"],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
            )
            self._process = process
            self._timeout = GLib.timeout_add_seconds(5, self._timed_out)
            process.communicate_utf8_async(None, None, self._checked)
        except GLib.Error:
            self._finish_check(None)

    def _checked(self, process, result):
        paths = None
        try:
            ok, stdout, _stderr = process.communicate_utf8_finish(result)
            if ok and process.get_successful():
                paths = json.loads(stdout)
        except (GLib.Error, ValueError):
            pass
        self._finish_check(paths)

    def _finish_check(self, paths):
        self._process = None
        if self._timeout:
            GLib.source_remove(self._timeout)
            self._timeout = 0
        if self._closed:
            return
        if isinstance(paths, dict):
            self._paths = {"codex-path": paths.get("codex"), "chatgpt-app-path": paths.get("chatgpt")}
            self.status.set_text(_("Automatic paths checked. Your manual entries are unchanged."))
        else:
            self._paths = {}
            self.status.set_text(_("Could not check automatic paths. Try Recheck."))
        for key in self.entries:
            self._set_placeholder(key)
        self.recheck_button.set_sensitive(True)

    def _timed_out(self):
        self._timeout = 0
        if self._process:
            self._process.force_exit()
        return GLib.SOURCE_REMOVE

    def _destroyed(self, *_args):
        self._closed = True
        if self._timeout:
            GLib.source_remove(self._timeout)
            self._timeout = 0
        if self._process:
            self._process.force_exit()
