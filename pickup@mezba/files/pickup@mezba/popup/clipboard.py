# -*- coding: utf-8 -*-
"""Clipboard helpers for Pickup.

GTK3's Python binding cannot publish ``text/uri-list`` through Gtk.Clipboard:
``gtk_clipboard_set_with_owner`` is not introspectable and ``set_uris()`` is a
GTK4 API. Copying a *file* therefore uses GTK3's older, still supported selection
API (``Gtk.selection_owner_set`` + ``selection_add_target`` + a
``selection-get`` handler), which is exactly what GTK's own widgets use when they
serve non-text targets.

Text copies go through Gtk.Clipboard, which handles them perfectly.

The owner object must stay alive while it owns the selection, so the module keeps
a reference to the current owner.
"""

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GObject, Gtk  # noqa: E402

URI_TARGET = "text/uri-list"
TEXT_TARGETS = ("UTF8_STRING", "text/plain;charset=utf-8", "text/plain", "STRING")

_current_owner = None


def _uris_payload(uris):
    """text/uri-list wire format: CRLF-separated lines, trailing newline."""
    return ("\r\n".join(uris) + "\r\n").encode("utf-8")


class FileClipboardOwner:
    """Owns CLIPBOARD and serves text/uri-list for a list of file URIs.

    Kept as a plain object (not a GObject) because the selection machinery only
    needs the handlers; it must not be collected while it owns the selection.
    """

    def __init__(self, uris):
        self._uris = [u for u in uris if u]
        self._window = None
        self._handler_id = 0

    def take(self):
        widget = Gtk.Invisible()
        display = Gdk.Display.get_default()
        owner = getattr(Gtk, "selection_owner_set", None)
        if owner is None:
            return False
        if not owner(widget, Gdk.SELECTION_CLIPBOARD, Gdk.CURRENT_TIME):
            return False
        self._widget = widget
        self._atom_uri = Gdk.atom_intern(URI_TARGET, False)
        # Targets are announced in preference order; the info value is what the
        # selection-get handler receives back.
        Gtk.selection_add_target(widget, Gdk.SELECTION_CLIPBOARD, self._atom_uri, 0)
        for index, name in enumerate(TEXT_TARGETS, start=1):
            Gtk.selection_add_target(
                widget,
                Gdk.SELECTION_CLIPBOARD,
                Gdk.atom_intern(name, False),
                index,
            )
        self._handler_id = widget.connect("selection-get", self._on_selection_get)
        widget.realize()
        return True

    def _on_selection_get(self, widget, selection_data, info, time):
        # GTK passes the target info chosen from the TARGETS we advertised.
        if info == 0:
            selection_data.set(
                self._atom_uri, 8, _uris_payload(self._uris)
            )
        else:
            selection_data.set_text("\n".join(self._uris), -1)

    def close(self):
        if getattr(self, "_widget", None) is not None:
            try:
                if self._handler_id:
                    self._widget.disconnect(self._handler_id)
            except Exception:
                pass
            try:
                self._widget.destroy()
            except Exception:
                pass
            self._widget = None


def copy_uris(uris):
    """Publish file URIs on CLIPBOARD. Returns True on success."""
    global _current_owner
    uris = [u for u in uris if u]
    if not uris:
        return False
    owner = FileClipboardOwner(uris)
    try:
        if not owner.take():
            return False
    except Exception as exc:
        print("pickup: could not own clipboard: %s" % exc)
        return False
    previous = _current_owner
    _current_owner = owner
    if previous is not None:
        try:
            previous.close()
        except Exception:
            pass
    return True


def copy_text(text):
    """Plain text copy through Gtk.Clipboard."""
    global _current_owner
    clipboard = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
    clipboard.set_text(text or "", -1)
    try:
        clipboard.store()
    except Exception:
        pass
    if _current_owner is not None:
        try:
            _current_owner.close()
        except Exception:
            pass
        _current_owner = None
    return True
