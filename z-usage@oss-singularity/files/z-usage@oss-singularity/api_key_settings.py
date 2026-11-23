#!/usr/bin/python3
"""API key entry with an inline Z.ai API keys page launcher.

Native xlet settings entries keep keyboard focus when the click lands on
a non-focusable area (labels, empty space). This widget captures window
presses before the entry consumes them and releases focus when the press
lands outside the entry, matching normal desktop text field behavior.

The visible control edits the native hidden "api-key" entry through its
"setting-key", so the applet-side binder sees a valid settings type. A
configured key is never shown or exported in plain text: the field renders
masked and its copy/cut actions are swallowed before the clipboard. A
small flat button left of the field opens the Z.ai API key management
page (the schema no longer spends a separate row on it).
"""

import os

from gi.repository import Gio, Gtk

from JsonSettingsWidgets import JSONSettingsEntry

API_KEYS_URL = "https://z.ai/manage-apikey/apikey-list"


class ApiKeyEntryWidget(JSONSettingsEntry):
    def __init__(self, info, _key, settings):
        JSONSettingsEntry.__init__(self, info["setting-key"], settings, info)
        self.content_widget.set_visibility(False)
        self.content_widget.set_invisible_char("•")
        self.content_widget.connect("copy-clipboard", self._block_clipboard)
        self.content_widget.connect("cut-clipboard", self._block_clipboard)
        self._key_button = Gtk.Button()
        self._key_button.set_relief(Gtk.ReliefStyle.NONE)
        self._key_button.set_tooltip_text("Open the Z.ai API keys page")
        self._key_button.add(
            Gtk.Image.new_from_gicon(
                Gio.FileIcon.new(
                    Gio.File.new_for_path(
                        os.path.join(
                            os.path.dirname(os.path.abspath(__file__)),
                            "icons",
                            "web-browser-symbolic.svg",
                        )
                    )
                ),
                Gtk.IconSize.BUTTON,
            )
        )
        self._key_button.connect("clicked", self._open_api_keys_page)
        # End-packed after the entry, the button lands between the label
        # and the masked field - in the row's free space, not its own row.
        self.pack_end(self._key_button, False, False, 0)
        self._closed = False
        self._click_gesture = None
        self._click_handler = 0
        self.connect("hierarchy-changed", self._hierarchy_changed)
        self.connect("destroy", self._on_destroy)

    def _open_api_keys_page(self, *_args):
        """Open the fixed Z.ai API key management page in the browser."""
        Gtk.show_uri(None, API_KEYS_URL, Gtk.get_current_event_time())

    def _block_clipboard(self, *_args):
        """Swallow copy/cut so the masked value cannot leave the field."""
        return True

    def _hierarchy_changed(self, *_args):
        self._disconnect_click_gesture()
        window = self.get_toplevel()
        if self._closed or not isinstance(window, Gtk.Window):
            return
        # Capture before the entry consumes clicks, including presses on
        # non-focusable labels and empty areas. The event stays available
        # to its normal target.
        self._click_gesture = Gtk.GestureMultiPress.new(window)
        self._click_gesture.set_button(0)
        self._click_gesture.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
        self._click_handler = self._click_gesture.connect("pressed", self._window_pressed)

    def _window_pressed(self, gesture, _count, x, y):
        window = gesture.get_widget()
        entry = window.get_focus()
        if self._closed or not self._is_text_input(entry):
            return
        position = entry.translate_coordinates(window, 0, 0)
        if position is None:
            return
        left, top = position
        if not (left <= x < left + entry.get_allocated_width() and top <= y < top + entry.get_allocated_height()):
            window.set_focus(None)

    @staticmethod
    def _is_text_input(widget):
        """Release focus from native settings inputs when clicking blank UI."""
        return isinstance(widget, (Gtk.Entry, Gtk.SpinButton, Gtk.TextView))

    def _disconnect_click_gesture(self):
        if self._click_gesture is not None:
            if self._click_handler:
                self._click_gesture.disconnect(self._click_handler)
            self._click_gesture.set_propagation_phase(Gtk.PropagationPhase.NONE)
            self._click_gesture.reset()
            self._click_gesture = None
        self._click_handler = 0

    def _on_destroy(self, *_args):
        self._closed = True
        self._disconnect_click_gesture()
