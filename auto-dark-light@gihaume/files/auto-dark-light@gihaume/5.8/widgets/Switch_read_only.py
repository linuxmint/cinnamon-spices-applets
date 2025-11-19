from typing import Any

from gettext import gettext as _  # For linter
from gi.repository import Gio, Gtk

from JsonSettingsWidgets import SettingsWidget, JSONSettingsHandler

class Switch(SettingsWidget):
    def __init__(
        self,
        info: dict[str, Any],
        key: str,
        settings: JSONSettingsHandler,
        dep_key=None
    ):
        super().__init__(dep_key=dep_key)

        toggle = Gtk.Switch()
        toggle.set_sensitive(False)

        description = _(info['description'])
        label = Gtk.Label(label=description, halign=Gtk.Align.START)

        self.pack_start(label, False, False, 0)
        self.pack_end(toggle, False, False, 0)

        settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT)

        self.set_tooltip_text(_(info['tooltip']) if 'tooltip' in info else "")
