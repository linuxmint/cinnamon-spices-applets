from typing import Any

from gettext import gettext as _  # For linter
from gi.repository import Gio, Gtk

from JsonSettingsWidgets import SettingsWidget, JSONSettingsHandler

class Spin_button(SettingsWidget):
    def __init__(
        self,
        info: dict[str, Any],
        key: str,
        settings: JSONSettingsHandler,
        dep_key=None
    ):
        super().__init__(dep_key=dep_key)

        spinbutton = Gtk.SpinButton.new_with_range(
            info['min'], info['max'], info['step']
        )
        spinbutton.set_sensitive(False)

        description = _(info['description'])
        units = info.get('units')
        if units is not None:
            description += f" ({_(units)})"
        label = Gtk.Label(label=description, halign=Gtk.Align.START)

        self.pack_start(label, False, False, 0)
        self.pack_end(spinbutton, False, False, 0)

        settings.bind(key, spinbutton, 'value', Gio.SettingsBindFlags.DEFAULT)

        self.set_tooltip_text(_(info['tooltip']) if 'tooltip' in info else '')
