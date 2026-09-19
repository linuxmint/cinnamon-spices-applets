#!/usr/bin/python3
"""API key entry that blurs on clicks outside the field.

Native xlet settings entries keep keyboard focus when the click lands on
a non-focusable area (labels, empty space). This widget captures window
presses before the entry consumes them and releases focus when the press
lands outside the entry, matching normal desktop text field behavior.

The visible control edits the native hidden "api-key" entry through its
"setting-key", so the applet-side binder sees a valid settings type. A
configured key is never shown or exported in plain text: the field renders
masked and its copy/cut actions are swallowed before the clipboard.
"""

from gi.repository import Gtk

from JsonSettingsWidgets import JSONSettingsEntry


class ApiKeyEntryWidget(JSONSettingsEntry):
    def __init__(self, info, _key, settings):
        JSONSettingsEntry.__init__(self, info["setting-key"], settings, info)
        self.content_widget.set_visibility(False)
        self.content_widget.set_invisible_char("•")
        self.content_widget.connect("copy-clipboard", self._block_clipboard)
        self.content_widget.connect("cut-clipboard", self._block_clipboard)
        self._closed = False
        self._click_gesture = None
        self._click_handler = 0
        self.connect("hierarchy-changed", self._hierarchy_changed)
        self.connect("destroy", self._on_destroy)

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
