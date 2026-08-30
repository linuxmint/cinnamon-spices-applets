from typing import Any

from gettext import gettext as _  # For linter
from gi.repository import Gio, Gtk

from JsonSettingsWidgets import SettingsWidget, JSONSettingsHandler

class Entry(SettingsWidget):
    def __init__(
        self,
        info: dict[str, Any],
        key: str,
        settings: JSONSettingsHandler,
        dep_key=None
    ):
        super().__init__(dep_key=dep_key)

        entry = Gtk.Entry()
        entry.set_sensitive(False)
        # entry.set_can_focus(False)
        # entry.set_editable(False)

        description = _(info['description'])
        label = Gtk.Label(label=description, halign=Gtk.Align.START)

        self.pack_start(label, False, False, 0)
        self.pack_end(entry, False, False, 0)

        settings.bind(key, entry, 'text', Gio.SettingsBindFlags.DEFAULT)

        self.set_tooltip_text(_(info['tooltip']) if 'tooltip' in info else "")
