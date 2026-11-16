# -*- coding: utf-8 -*-
"""Custom frosted context menus.

Gtk.Menu follows the system theme and is hard to restyle consistently, so the
Pickup menus are Gtk.Popover instances with the ``pickup-menu`` class. In GTK3 a
popover's CSS node already carries the ``background`` class, which is why
theme.py targets ``popover.background.pickup-menu`` for both light and dark.

Behaviour that matters here:
  * Clicking a row runs the action and closes the menu.
  * Clicking outside closes the menu (normal popover behaviour) without touching
    the main popup window.
  * The popup window never closes because of a menu; only the cross button does
    that.
"""

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GLib, Gtk  # noqa: E402


class _Row(Gtk.Button):
    """One menu entry: optional icon, label, optional danger styling."""

    def __init__(self, label, icon_name=None, danger=False, css_class="popup-menu-item"):
        super().__init__()
        self.set_relief(Gtk.ReliefStyle.NONE)
        self.set_can_focus(False)
        context = self.get_style_context()
        context.add_class(css_class)
        if danger:
            context.add_class("pickup-danger")

        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=9)
        if icon_name:
            icon = Gtk.Image.new_from_icon_name(icon_name, Gtk.IconSize.MENU)
            icon.set_size_request(16, 16)
            box.pack_start(icon, False, False, 0)
        else:
            # Keeps labels aligned on rows without an icon.
            spacer = Gtk.Box()
            spacer.set_size_request(16, 1)
            box.pack_start(spacer, False, False, 0)
        text = Gtk.Label(label=label)
        text.set_xalign(0.0)
        box.pack_start(text, True, True, 0)
        self.add(box)


class _Separator(Gtk.Box):
    def __init__(self):
        super().__init__()
        self.get_style_context().add_class("pickup-menu-separator")
        self.set_size_request(-1, 1)


class PickupMenu(Gtk.Popover):
    """A small stack of actions attached to a widget."""

    def __init__(self, relative_to=None):
        super().__init__()
        if relative_to is not None:
            self.set_relative_to(relative_to)
        self.set_position(Gtk.PositionType.BOTTOM)
        self.set_modal(True)  # closes on any outside click
        self.set_constrain_to(Gtk.PopoverConstraint.NONE)
        context = self.get_style_context()
        # Declared explicitly: GTK3 normally adds it, and our CSS depends on it.
        context.add_class("background")
        context.add_class("pickup-menu")

        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.add(self.box)

    def add_heading(self, text):
        label = Gtk.Label(label=text)
        label.get_style_context().add_class("pickup-menu-heading")
        label.set_xalign(0.0)
        self.box.pack_start(label, False, False, 0)
        return label

    def add_item(self, label, callback, icon_name=None, danger=False):
        row = _Row(label, icon_name, danger)
        row.connect("clicked", lambda _row: self._run(callback))
        self.box.pack_start(row, False, False, 0)
        return row

    def add_separator(self):
        self.box.pack_start(_Separator(), False, False, 0)

    def _run(self, callback):
        self.popdown()
        if callback:
            # Deferred so an action that opens another window (file manager)
            # does not fight the popover for the pointer/keyboard grab.
            GLib.idle_add(lambda: (callback(), False)[1])

    def show_at_event(self, event, offset=(4, 4)):
        """Popup at the pointer, anchored to the widget in ``relative_to``."""
        try:
            rect = Gdk.Rectangle()
            rect.x = int(event.x) + offset[0]
            rect.y = int(event.y) + offset[1]
            rect.width = 1
            rect.height = 1
            self.set_pointing_to(rect)
        except Exception:
            pass
        self.show_all()
        self.popup()


class LayoutMenu(PickupMenu):
    """Grid / List switcher."""

    def __init__(self, relative_to, current, on_choose):
        super().__init__(relative_to)
        self.set_position(Gtk.PositionType.BOTTOM)
        for key, label, icon in (
            ("grid", "Grid", "view-grid-symbolic"),
            ("list", "List", "view-list-symbolic"),
        ):
            row = _Row(label, icon, css_class="popup-choice-item")
            if key == current:
                row.get_style_context().add_class("pickup-choice-active")
            row.connect("clicked", lambda _r, k=key: self._choose(k, on_choose))
            self.box.pack_start(row, False, False, 0)

    def _choose(self, key, callback):
        self.popdown()
        callback(key)


class ItemMenu(PickupMenu):
    """Right-click menu for a single item."""

    def __init__(self, card, actions, show_open_folder=False):
        super().__init__(card.widget)
        item = card.item
        name = card.name_label.get_text()
        self.add_heading(name)
        self.add_item("Copy", actions["copy"], "edit-copy-symbolic")
        if show_open_folder:
            self.add_item("Open folder", actions["open_folder"], "folder-open-symbolic")
        if item.get("pinned"):
            self.add_item("Unpin", actions["toggle_pin"], "view-pin-symbolic")
        else:
            self.add_item("Pin", actions["toggle_pin"], "view-pin-symbolic")
        self.add_separator()
        self.add_item("Clear", actions["clear"], "edit-delete-symbolic", danger=True)
        self.add_item(
            "Clear all", actions["clear_all"], "edit-clear-symbolic", danger=True
        )
