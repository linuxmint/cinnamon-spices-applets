# -*- coding: utf-8 -*-
"""Pickup popup: a frosted shelf for file references and text.

Process model
-------------
Default (RESIDENT_MODE = False below): this process is started by the applet on
click and exits completely when the window closes. Nothing of Pickup stays
resident, so the shelf costs 0 MB RAM and 0 % CPU while it is closed. State is
not lost because it lives in ~/.config/pickup/state.json.

A second launch (double-clicking the panel icon) is not possible: the process
claims org.pickup.Popup on the session bus with DBUS_NAME_FLAG_DO_NOT_QUEUE
*before* it builds any UI. If the name is already taken, this instance asks the
running one to present itself and exits immediately.

Drop handling
-------------
One window-level Gtk drop target, not one per card. Cards are Gtk.EventBox
instances with no window of their own, so the toplevel receives drag events over
them anyway; a single target also catches drops on the header, scrollbar and the
empty state, which is what "drag stuff into the popup" should mean.

Drag-out is armed per card (so the drag icon is the item) but the payload is
resolved at drag time from the live selection, which is how a multi-selection
drags as one operation.

The window closes only on the cross button: no Escape handler, no focus-out
handler, and drops/drags never close it.
"""

import faulthandler
import logging
import os
import sys

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("Gio", "2.0")
from gi.repository import Gdk, Gio, GLib, Gtk  # noqa: E402

import cards  # noqa: E402
import clipboard as clipboard_mod  # noqa: E402
import menu  # noqa: E402
import store as store_mod  # noqa: E402
import tab as tab_mod  # noqa: E402
import theme  # noqa: E402
from dbus_service import BUS_NAME, INTERFACE, OBJECT_PATH, XML  # noqa: E402

log = logging.getLogger("pickup")


def _setup_logging():
    """Write errors and hard crashes to ~/.config/pickup/pickup.log."""
    try:
        os.makedirs(store_mod.CONFIG_DIR, exist_ok=True)
        path = os.path.join(store_mod.CONFIG_DIR, "pickup.log")
        if os.path.exists(path) and os.path.getsize(path) > 256 * 1024:
            os.replace(path, path + ".old")
        logging.basicConfig(
            filename=path, level=logging.WARNING,
            format="%(asctime)s %(levelname)s %(message)s",
        )
        # A segfault inside GTK leaves a Python traceback here.
        faulthandler.enable(open(path, "a"))
    except Exception:
        pass


# Set True to keep a process alive after the window is closed (resident mode).
# Left False so a click-spawned process fully exits -- this is the lightweight
# default. In resident mode you would also want a session autostart entry.
RESIDENT_MODE = False

# --- sizing ----------------------------------------------------------------
MIN_WIDTH, MIN_HEIGHT = 380, 300
MAX_WIDTH, MAX_HEIGHT = 1100, 1000
DEFAULT_WIDTH, DEFAULT_HEIGHT = 566, 548
RESIZE_GRIP = 14

TOAST_MS = 1500


def _clamp(value, low, high):
    return max(low, min(high, value))


class PickupWindow(Gtk.Window):
    def __init__(self, store, connection, dbus_registered=False):
        super().__init__(type=Gtk.WindowType.TOPLEVEL)
        self.store = store
        self.cards = []
        self.drag_in_progress = False
        self._exiting = False
        self._dbus_connection = connection
        self._dbus_registered = False
        self._toast_timer = None
        self._resizing = False
        self._collapsed = False
        self._tab = None
        self._expanded_pos = None
        self._expanded_size = None
        self._opened_by_drag = False   # expanded from the tab by a drag-hover
        self._auto_collapse_timer = 0

        self.set_decorated(False)
        self.set_resizable(True)
        self.set_keep_above(True)
        self.set_skip_taskbar_hint(True)
        self.set_skip_pager_hint(True)
        self.set_type_hint(Gdk.WindowTypeHint.UTILITY)
        self.set_app_paintable(True)
        self.set_title("Pickup")
        self.get_style_context().add_class("pickup-window")

        # An RGBA visual plus the transparent #pickup-root gives real rounded
        # corners on any compositing WM without a fake blur pass.
        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        if visual is not None:
            self.set_visual(visual)

        saved_theme = self.store.prefs.get("theme")
        if saved_theme in ("dark", "light"):
            self.dark = saved_theme == "dark"
        else:
            self.dark = theme.system_prefers_dark()
        self._menu = None
        self._css_provider = theme.install_css(screen, self.dark)

        self.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
        self.connect("button-press-event", self._on_window_press)
        self.connect("key-press-event", lambda *_: (self._user_touched(), False)[1])
        self.connect("draw", self._on_draw)
        self.connect("delete-event", self._on_delete)
        self.connect("destroy", self._on_destroy)
        self.connect("configure-event", self._on_configure)

        width, height = self._restore_size()
        self.set_default_size(width, height)
        self.set_size_request(MIN_WIDTH, MIN_HEIGHT)

        self._build_ui()
        self._setup_drop_target()
        self._setup_accels()
        self._restore_position()

        # Prune + missing check happen exactly once, when the popup opens.
        self.store.prune()
        self.store.check_missing()
        self.refresh_items()
        self._refresh_layout_button()

        self.show_all()
        # Must come after show_all(): Gtk.Stack ignores a request to show a
        # child that is not visible yet, which left a saved "list" layout
        # staring at the empty grid page on startup.
        self.stack.set_visible_child_name(self._layout_name())
        self._sync_empty_and_toast()

        if dbus_registered:
            self._export_dbus()

        self.present()

    # ------------------------------------------------------------------ UI --
    def _build_ui(self):
        # Outer margin is what makes the drop shadow visible; it also gives the
        # pointer a resize band around the frosted panel.
        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        outer.set_margin_top(10)
        outer.set_margin_bottom(10)
        outer.set_margin_start(10)
        outer.set_margin_end(10)

        self.root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.root.set_name("pickup-root")
        outer.pack_start(self.root, True, True, 0)
        self.add(outer)

        self.root.pack_start(self._build_header(), False, False, 0)
        self._build_body()
        self._build_overlays()

    def _build_header(self):
        header = Gtk.EventBox()
        header.set_visible_window(False)
        header.set_name("pickup-header")
        header.connect("button-press-event", self._on_header_press)
        header.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)

        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        row.set_margin_top(1)
        row.set_margin_bottom(1)
        header.add(row)

        title = Gtk.Label(label="PICKUP")
        title.set_name("pickup-title")
        title.set_valign(Gtk.Align.CENTER)
        title.set_margin_start(4)
        row.pack_start(title, False, False, 0)

        self.count_label = Gtk.Label(label="")
        self.count_label.set_name("pickup-count")
        self.count_label.set_valign(Gtk.Align.CENTER)
        row.pack_start(self.count_label, False, False, 0)

        # Right-hand controls. pack_end order: close is right-most.
        self.close_button = self._icon_button("window-close-symbolic", "Close", self.quit)
        row.pack_end(self.close_button, False, False, 0)

        # Minimize: shrink into a small tab on the nearest screen edge.
        self.collapse_button = Gtk.Button(label="\u2013")
        self.collapse_button.get_style_context().add_class("pickup-icon-button")
        self.collapse_button.set_relief(Gtk.ReliefStyle.NONE)
        self.collapse_button.set_can_focus(False)
        self.collapse_button.set_valign(Gtk.Align.CENTER)
        self.collapse_button.set_tooltip_text("Minimize to the screen edge")
        self.collapse_button.connect("clicked", lambda _b: self._collapse())
        row.pack_end(self.collapse_button, False, False, 0)

        self.layout_button = self._icon_button(
            "view-list-symbolic", "Grid or list layout", self._show_layout_menu
        )
        row.pack_end(self.layout_button, False, False, 0)

        # Dark / light switch. Shows the mode it switches *to*.
        self.theme_button = Gtk.Button()
        self.theme_button.get_style_context().add_class("pickup-icon-button")
        self.theme_button.set_relief(Gtk.ReliefStyle.NONE)
        self.theme_button.set_can_focus(False)
        self.theme_button.set_valign(Gtk.Align.CENTER)
        self.theme_button.connect("clicked", lambda _b: self._toggle_theme())
        self._refresh_theme_button()
        row.pack_end(self.theme_button, False, False, 0)

        self.select_all_button = Gtk.Button(label="Select all")
        self.select_all_button.get_style_context().add_class("pickup-pill")
        self.select_all_button.set_can_focus(False)
        self.select_all_button.set_valign(Gtk.Align.CENTER)
        self.select_all_button.set_tooltip_text("Select every item")
        self.select_all_button.connect("clicked", lambda _b: self._on_select_all())
        row.pack_end(self.select_all_button, False, False, 2)

        self._header = header
        self._header_row = row
        return header

    def _icon_button(self, icon_name, tooltip, callback):
        button = Gtk.Button()
        button.get_style_context().add_class("pickup-icon-button")
        button.set_relief(Gtk.ReliefStyle.NONE)
        button.set_can_focus(False)
        button.set_tooltip_text(tooltip)
        button.set_valign(Gtk.Align.CENTER)
        button.add(Gtk.Image.new_from_icon_name(icon_name, Gtk.IconSize.BUTTON))
        button.connect("clicked", lambda _button: callback())
        return button

    def _build_body(self):
        self.scroll = Gtk.ScrolledWindow()
        self.scroll.set_name("pickup-scroll")
        self.scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        self.scroll.set_overlay_scrolling(True)

        self.flow = Gtk.FlowBox()
        self.flow.set_name("pickup-flow")
        self.flow.set_selection_mode(Gtk.SelectionMode.NONE)
        self.flow.set_homogeneous(True)
        self.flow.set_row_spacing(6)
        self.flow.set_column_spacing(6)
        self.flow.set_valign(Gtk.Align.START)
        self.flow.set_halign(Gtk.Align.FILL)
        self.flow.set_max_children_per_line(12)
        self.flow.set_min_children_per_line(2)

        self.listbox = Gtk.ListBox()
        self.listbox.set_name("pickup-list")
        self.listbox.set_selection_mode(Gtk.SelectionMode.NONE)
        self.listbox.set_valign(Gtk.Align.START)

        # Both layouts live in a Stack permanently. Swapping a ScrolledWindow's
        # direct child at runtime trips a GtkViewport assertion in GTK 3.24, and
        # a stack keeps each layout's scroll position while switching.
        self.stack = Gtk.Stack()
        self.stack.set_transition_type(Gtk.StackTransitionType.NONE)
        self.stack.add_named(self.flow, "grid")
        self.stack.add_named(self.listbox, "list")
        self.stack.set_visible_child_name(self._layout_name())
        self.scroll.add(self.stack)
        return self.scroll

    def _build_overlays(self):
        """Overlay for the empty state, the drop hint, the toast and the grip.

        Built once, directly in the root box, so there is no reparenting after
        the widget tree is shown (which GTK dislikes).
        """
        self.overlay = Gtk.Overlay()
        self.root.pack_start(self.overlay, True, True, 0)
        self.overlay.add(self.scroll)

        self.empty_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=9)
        self.empty_box.set_valign(Gtk.Align.CENTER)
        self.empty_box.set_halign(Gtk.Align.CENTER)
        empty_icon = Gtk.Image.new_from_icon_name(
            "document-save-symbolic", Gtk.IconSize.DIALOG
        )
        empty_icon.set_name("pickup-empty-icon")
        self.empty_box.pack_start(empty_icon, False, False, 0)
        empty_label = Gtk.Label(label="Drag files or selected text here")
        empty_label.set_name("pickup-empty")
        self.empty_box.pack_start(empty_label, False, False, 0)
        self.overlay.add_overlay(self.empty_box)

        self.drop_hint = Gtk.Label(label="Drop to add to Pickup")
        self.drop_hint.set_name("pickup-drop-hint")
        # show_all() must not reveal it: it only appears while something is
        # being dragged over an empty shelf.
        self.drop_hint.set_no_show_all(True)
        self.drop_hint.hide()
        self.drop_hint.set_halign(Gtk.Align.CENTER)
        self.drop_hint.set_valign(Gtk.Align.CENTER)
        self.overlay.add_overlay(self.drop_hint)

        self.toast = Gtk.Label()
        self.toast.set_name("pickup-toast")
        self.toast.set_halign(Gtk.Align.CENTER)
        self.toast.set_valign(Gtk.Align.END)
        self.toast.set_margin_bottom(16)
        self.overlay.add_overlay(self.toast)

        # Bottom-right resize grip: an undecorated window has no frame, so a
        # small corner acts as one.
        self.grip = Gtk.EventBox()
        self.grip.set_visible_window(False)
        self.grip.set_size_request(RESIZE_GRIP, RESIZE_GRIP)
        self.grip.set_halign(Gtk.Align.END)
        self.grip.set_valign(Gtk.Align.END)
        grip_icon = "window-resize-symbolic"
        if Gtk.IconTheme.get_default().lookup_icon(grip_icon, 16, 0) is None:
            grip_icon = "pan-end-symbolic"
        grip_image = Gtk.Image.new_from_icon_name(grip_icon, Gtk.IconSize.MENU)
        grip_image.set_opacity(0.3)
        self.grip.add(grip_image)
        self.grip.connect("button-press-event", self._on_grip_press)
        self.overlay.add_overlay(self.grip)

        # Overlays must not swallow drags or clicks meant for the shelf.
        self.overlay.set_overlay_pass_through(self.drop_hint, True)
        self.overlay.set_overlay_pass_through(self.toast, True)
        self.overlay.set_overlay_pass_through(self.empty_box, True)

    # -------------------------------------------------------------- theme --
    def _on_draw(self, window, cr):
        # Keep the toplevel itself fully transparent. The visible surface is
        # #pickup-root, so the rounded corners are genuinely cut out.
        cr.set_source_rgba(0, 0, 0, 0)
        cr.set_operator(1)  # CAIRO_OPERATOR_SOURCE
        cr.paint()
        cr.set_operator(2)  # CAIRO_OPERATOR_OVER
        return False

    # ------------------------------------------------------------ geometry --
    def _restore_size(self):
        prefs = self.store.prefs
        try:
            width = _clamp(int(prefs.get("width") or DEFAULT_WIDTH), MIN_WIDTH, MAX_WIDTH)
            height = _clamp(int(prefs.get("height") or DEFAULT_HEIGHT), MIN_HEIGHT, MAX_HEIGHT)
        except (TypeError, ValueError):
            width, height = DEFAULT_WIDTH, DEFAULT_HEIGHT
        return width, height

    def _restore_position(self):
        saved = self.store.prefs.get("position")
        if isinstance(saved, list) and len(saved) == 2:
            try:
                x, y = int(saved[0]), int(saved[1])
            except (TypeError, ValueError):
                x = y = None
            if x is not None and self._position_visible(x, y):
                self.move(x, y)
                return
        self._position_near_pointer()

    def _position_visible(self, x, y):
        display = Gdk.Display.get_default()
        for index in range(display.get_n_monitors()):
            geo = display.get_monitor(index).get_geometry()
            if geo.x <= x < geo.x + geo.width - 40 and geo.y <= y < geo.y + geo.height - 40:
                return True
        return False

    def _position_near_pointer(self):
        """Open under the panel icon/pointer, clamped to the work area."""
        try:
            display = Gdk.Display.get_default()
            pointer = display.get_default_seat().get_pointer()
            _screen, x, y = pointer.get_position()
        except Exception:
            return
        width, height = self._restore_size()
        monitor = display.get_monitor_at_point(x, y)
        work = monitor.get_workarea()
        target_x = x - width // 2
        target_y = y + 24
        if target_y + height > work.y + work.height - 6:
            target_y = y - height - 24
        target_x = _clamp(target_x, work.x + 4, work.x + work.width - width - 4)
        target_y = _clamp(target_y, work.y + 4, work.y + work.height - height - 4)
        self.move(target_x, target_y)

    def _on_configure(self, widget, event):
        # Remember the latest size however it changed (grip, window edge,
        # keyboard). Only kept in memory here; it is written once on close.
        if self.get_realized() and event.width >= MIN_WIDTH and event.height >= MIN_HEIGHT:
            self._last_size = (event.width, event.height)
        return False

    def _save_size(self):
        try:
            if self._collapsed and self._expanded_size:
                width, height = self._expanded_size
            else:
                width, height = getattr(self, "_last_size", None) or self.get_size()
            if width >= MIN_WIDTH and height >= MIN_HEIGHT:
                self.store.prefs["width"] = _clamp(int(width), MIN_WIDTH, MAX_WIDTH)
                self.store.prefs["height"] = _clamp(int(height), MIN_HEIGHT, MAX_HEIGHT)
        except Exception:
            pass

    def _on_grip_press(self, widget, event):
        if event.button != 1:
            return False
        self._resizing = True  # from now on configure-events are saved as the size
        self.begin_resize_drag(
            Gdk.WindowEdge.SOUTH_EAST,
            event.button,
            int(event.x_root),
            int(event.y_root),
            event.time,
        )
        return True

    # ------------------------------------------------------- drag handle --
    def _on_header_press(self, widget, event):
        if event.button != 1:
            return False
        if self._press_on_control(event):
            return False
        self.begin_move_drag(
            event.button, int(event.x_root), int(event.y_root), event.time
        )
        return True

    def _press_on_control(self, event):
        for control in (
            self.close_button,
            self.collapse_button,
            self.layout_button,
            self.theme_button,
            self.select_all_button,
        ):
            try:
                allocation = control.get_allocation()
                ok, x, y = control.translate_coordinates(
                    self._header, int(event.x), int(event.y)
                )
                if (
                    ok
                    and allocation.x <= x <= allocation.x + allocation.width
                    and allocation.y <= y <= allocation.y + allocation.height
                ):
                    return True
            except Exception:
                continue
        return False

    # ---------------------------------------------------- minimize to tab --
    def _on_window_press(self, widget, event):
        self._close_menu()
        self._user_touched()
        return False

    def _user_touched(self):
        """The person is using the popup: never auto-collapse it under them."""
        self._opened_by_drag = False
        self._cancel_auto_collapse()

    def _cancel_auto_collapse(self):
        if self._auto_collapse_timer:
            GLib.source_remove(self._auto_collapse_timer)
            self._auto_collapse_timer = 0

    def _schedule_auto_collapse(self, delay_ms):
        self._cancel_auto_collapse()
        if self._opened_by_drag and not self._collapsed and not self._exiting:
            self._auto_collapse_timer = GLib.timeout_add(delay_ms, self._auto_collapse_fire)

    def _auto_collapse_fire(self):
        self._auto_collapse_timer = 0
        if self._opened_by_drag and not self._collapsed and not self._exiting:
            self._collapse()
        return False

    def _ensure_tab(self):
        if self._tab is None:
            self._tab = tab_mod.EdgeTab(self.dark, self._expand, self._expand_from_drag)
        self._tab.set_dark(self.dark)
        self._tab.set_count(len(self.store.items))
        return self._tab

    def _collapse(self):
        if self._collapsed or self._exiting:
            return
        self._cancel_auto_collapse()
        self._opened_by_drag = False
        self._close_menu()
        try:
            self._expanded_pos = tuple(self.get_position())
            self._expanded_size = tuple(self.get_size())
        except Exception:
            self._expanded_pos = self._expanded_size = None
        x, y = self._expanded_pos or (0, 0)
        width, height = self._expanded_size or self._restore_size()
        self._collapsed = True
        self.hide()
        self._ensure_tab().place_near(x + width / 2.0, y + height / 2.0)

    def _expand(self):
        if not self._collapsed:
            self.present()
            return
        self._collapsed = False
        if self._tab is not None:
            self._tab.hide()
        if self._expanded_size:
            self.resize(*self._expanded_size)
        if self._expanded_pos:
            self.move(*self._expanded_pos)
        self.show()
        self.present()

    def _expand_from_drag(self):
        """A drag hovered the tab: open so the drop can land, then fold back."""
        if not self._collapsed:
            return
        self._expand()
        self._opened_by_drag = True
        # If the drag never reaches the popup (cancelled, dropped elsewhere),
        # fold back after a while. Cancelled as soon as the drag enters it.
        self._schedule_auto_collapse(3000)

    def _sync_tab_count(self):
        if self._tab is not None:
            self._tab.set_count(len(self.store.items))

    # --------------------------------------------------------- drag: in --
    def _setup_drop_target(self):
        targets = [
            Gtk.TargetEntry.new("text/uri-list", 0, 0),
            Gtk.TargetEntry.new("text/plain;charset=utf-8", 0, 1),
            Gtk.TargetEntry.new("text/plain", 0, 2),
            Gtk.TargetEntry.new("UTF8_STRING", 0, 3),
        ]
        self.drag_dest_set(Gtk.DestDefaults.MOTION, targets, Gdk.DragAction.COPY)
        self.drag_dest_set_target_list(targets)
        self.connect("drag-motion", self._on_drag_motion)
        self.connect("drag-leave", self._on_drag_leave)
        self.connect("drag-drop", self._on_drag_drop)
        self.connect("drag-data-received", self._on_drag_data_received)

    @staticmethod
    def _is_own_drag(context):
        """True when the drag started on one of our own cards."""
        try:
            return Gtk.drag_get_source_widget(context) is not None
        except Exception:
            return False

    def _on_drag_motion(self, widget, context, x, y, time):
        if self._is_own_drag(context):
            # Dragging a card back over our own window is never a drop. Accepting
            # it would rebuild (destroy) the very card that is being dragged.
            Gdk.drag_status(context, 0, time)
            return True
        self.drag_in_progress = True
        self._cancel_auto_collapse()   # the drag reached us; wait for the drop
        self._set_drop_highlight(True)
        Gdk.drag_status(context, Gdk.DragAction.COPY, time)
        return True

    def _on_drag_leave(self, widget, context, time):
        self.drag_in_progress = False
        self._set_drop_highlight(False)
        # GTK emits drag-leave just before drag-drop, so give a real drop time
        # to cancel this; a drag that truly left folds back shortly after.
        self._schedule_auto_collapse(900)

    def _on_drag_drop(self, widget, context, x, y, time):
        if self._is_own_drag(context):
            Gtk.drag_finish(context, False, False, time)
            return True
        self._cancel_auto_collapse()
        target = self.drag_dest_find_target(context, None)
        if target is None:
            return False
        self.drag_get_data(context, target, time)
        return True

    def _on_drag_data_received(self, widget, context, x, y, selection, info, time):
        self.drag_in_progress = False
        self._set_drop_highlight(False)

        added_files = 0
        added_text = False

        # The target the source actually negotiated. Do not rely on `info`:
        # some apps advertise text/plain and hand over a uri-list body anyway,
        # and GTK picks the target it negotiated, not the one we prefer.
        uri_atom = Gdk.Atom.intern("text/uri-list", False)
        is_uri_target = selection.get_data_type() == uri_atom or info == 0

        raw = selection.get_data()
        text = None
        if raw:
            try:
                text = raw.decode("utf-8", "replace")
            except Exception:
                text = None
        if text is None:
            text = selection.get_text()

        uris = []
        if is_uri_target:
            try:
                uris = selection.get_uris() or []
            except Exception:
                uris = []
        if not uris and text:
            # Fall back to parsing the body: a uri-list payload that arrived on
            # text/plain still has one URI per line.
            uris = [line.strip() for line in text.replace("\r\n", "\n").split("\n")]

        file_uris = [uri for uri in uris if uri.startswith("file://")]
        if file_uris:
            added_files = self._add_uris(file_uris)
            # A uri-list body that resolved to files is never also a text item.
            text = None
        elif text and text.strip():
            _item, added_text = self.store.add_text(text)

        self._after_drop(added_files, added_text, had_payload=bool(file_uris or (text and text.strip())))
        if context is not None:
            try:
                Gtk.drag_finish(context, True, False, time)
            except Exception:
                pass

    def _after_drop(self, added_files, added_text, had_payload=True):
        self.refresh_items()
        self._broadcast()
        # Opened from the tab by a drag: let the toast show, then fold back
        # unless the person clicks or types in the meantime.
        self._schedule_auto_collapse(1400)
        if added_files:
            self._show_toast(
                "Added %d file%s" % (added_files, "" if added_files == 1 else "s")
            )
        elif added_text:
            self._show_toast("Added text")
        elif had_payload:
            self._show_toast("Already in Pickup")

    def _add_uris(self, uris):
        paths = []
        for uri in uris:
            path = store_mod.uri_to_path(uri)
            if path and os.path.exists(path):
                paths.append(path)
        if not paths:
            return 0
        return self.store.add_files(paths)

    def _set_drop_highlight(self, active):
        context = self.root.get_style_context()
        if getattr(self, "_drop_watchdog", 0):
            GLib.source_remove(self._drop_watchdog)
            self._drop_watchdog = 0
        if active:
            context.add_class("pickup-drop")
            # The words only help on an empty shelf; with items present the
            # highlighted border alone is enough.
            if self.store.items:
                self.drop_hint.hide()
            else:
                self.drop_hint.show()
            # If a drag-leave is ever missed, don't leave the highlight stuck.
            self._drop_watchdog = GLib.timeout_add(2000, self._drop_watchdog_fire)
        else:
            context.remove_class("pickup-drop")
            self.drop_hint.hide()

    def _drop_watchdog_fire(self):
        self._drop_watchdog = 0
        self.drag_in_progress = False
        self._set_drop_highlight(False)
        return False

    # -------------------------------------------------------- drag: out --
    def _drag_payload(self, item):
        """(uris, text) for a drag that started on ``item``'s card.

        If several items are selected, all of them travel together. Otherwise
        only the dragged item moves, which matches the spec.
        """
        selected = [card for card in self.cards if card.selected]
        dragged_card = next(
            (c for c in self.cards if c.item.get("id") == item.get("id")), None
        )
        if dragged_card is not None and dragged_card.selected and len(selected) > 1:
            uris = []
            texts = []
            for card in selected:
                card_uris, card_text = cards.drag_payload(card.item, self.store)
                uris.extend(card_uris)
                if card.item.get("kind") == store_mod.KIND_TEXT:
                    texts.append(card_text)
            text = "\n".join(texts) if texts else "\n".join(uris)
            return uris, text
        return cards.drag_payload(item, self.store)

    # --------------------------------------------------------- rendering --
    def _layout_name(self):
        return "list" if self.store.prefs.get("layout") == "list" else "grid"

    def _active_container(self):
        return self.listbox if self.store.prefs.get("layout") == "list" else self.flow

    def refresh_items(self):
        self._render_items()
        self._update_count()
        self._sync_empty_and_toast()

    def _render_items(self):
        for child in list(self.flow.get_children()):
            self.flow.remove(child)
        for child in list(self.listbox.get_children()):
            self.listbox.remove(child)
        self.cards = []

        use_grid = self.store.prefs.get("layout") != "list"
        for item in self.store.items:
            try:
                card = (
                    cards.GridCard(item, self.store, self._show_item_menu, self._on_card_toggled)
                    if use_grid
                    else cards.ListRow(item, self.store, self._show_item_menu, self._on_card_toggled)
                )
                card.enable_drag(self._drag_payload)
            except Exception:
                # One broken item must never blank the whole shelf.
                log.exception("could not build card for %r", item.get("id"))
                continue
            self.cards.append(card)
            if use_grid:
                self.flow.add(card.widget)
            else:
                self.listbox.add(card.widget)

        if use_grid:
            for child in self.flow.get_children():
                child.set_can_focus(False)

        self.flow.show_all()
        self.listbox.show_all()
        self._update_selection_ui()

    def _update_count(self):
        self._sync_tab_count()
        count = len(self.store.items)
        self.count_label.set_text(
            "" if count == 0 else "%d item%s" % (count, "" if count == 1 else "s")
        )

    def _sync_empty_and_toast(self):
        has_items = bool(self.store.items)
        if has_items:
            self.empty_box.hide()
        else:
            self.empty_box.show()
        if not hasattr(self, "_toast_timer") or not self._toast_timer:
            self.toast.hide()

    # --------------------------------------------------------- selection --
    def _on_card_toggled(self, card, selected):
        self._update_selection_ui()

    def _update_selection_ui(self):
        total = len(self.cards)
        selected = sum(1 for card in self.cards if card.selected)
        self.select_all_button.set_sensitive(total > 0)
        if total and selected == total:
            self.select_all_button.set_label("Deselect all")
        elif selected:
            self.select_all_button.set_label("Select all (%d)" % selected)
        else:
            self.select_all_button.set_label("Select all")

    def _on_select_all(self):
        total = len(self.cards)
        selected = sum(1 for card in self.cards if card.selected)
        target = not (total and selected == total)
        for card in self.cards:
            card.set_selected(target)
        self._update_selection_ui()

    # ------------------------------------------------------------- menus --
    def _close_menu(self):
        """Never let two menus stack up."""
        menu_widget, self._menu = self._menu, None
        if menu_widget is not None:
            try:
                menu_widget.popdown()
                menu_widget.destroy()
            except Exception:
                pass

    def _open_menu(self, menu_widget):
        self._close_menu()
        self._menu = menu_widget
        menu_widget.connect("closed", lambda _m: setattr(self, "_menu", None) if self._menu is _m else None)
        menu_widget.show_all()
        menu_widget.popup()

    def _can_open_folder(self, card):
        item = card.item
        if item.get("kind") != store_mod.KIND_FILE:
            return False
        # Several items selected -> the option is ambiguous, so hide it.
        selected = [c for c in self.cards if c.selected]
        if len(selected) > 1 and card.selected:
            return False
        path = item.get("path") or ""
        target = path if item.get("is_dir") else os.path.dirname(path)
        return bool(target) and os.path.isdir(target)

    def _show_item_menu(self, card, event=None):
        many = len(self._targets(card))
        actions = {
            "copy": lambda: self._copy_item(card),
            "clear_label": "Clear %d selected" % many if many > 1 else "Clear",
            "clear": lambda: self._clear_item(card),
            "clear_all": self._clear_all,
            "toggle_pin": lambda: self._toggle_pin(card),
            "open_folder": lambda: self._open_folder(card),
        }
        popup = menu.ItemMenu(card, actions, show_open_folder=self._can_open_folder(card))
        if event is not None:
            try:
                rect = Gdk.Rectangle()
                # event coords are relative to the card; the popover is anchored to it
                rect.x, rect.y, rect.width, rect.height = int(event.x), int(event.y), 1, 1
                popup.set_pointing_to(rect)
            except Exception:
                pass
        self._open_menu(popup)

    def _show_layout_menu(self):
        """One click flips Grid <-> List (no menu any more)."""
        self._close_menu()
        current = self.store.prefs.get("layout") or "grid"
        self._set_layout("grid" if current == "list" else "list")

    def _refresh_layout_button(self):
        # The icon shows the layout that is active right now.
        layout = self.store.prefs.get("layout") or "grid"
        icon_name = "view-list-symbolic" if layout == "list" else "view-grid-symbolic"
        self.layout_button.set_tooltip_text(
            "Switch to grid view" if layout == "list" else "Switch to list view"
        )
        image = self.layout_button.get_child()
        if isinstance(image, Gtk.Image):
            image.set_from_icon_name(icon_name, Gtk.IconSize.BUTTON)

    def _set_layout(self, layout):
        if layout not in ("grid", "list"):
            return
        if self.store.prefs.get("layout") == layout:
            return
        self.store.set_pref("layout", layout)
        self.stack.set_visible_child_name(self._layout_name())
        self._refresh_layout_button()
        # Rebuild after the menu's own click handler has fully returned;
        # destroying widgets inside that call chain is what GTK dislikes.
        GLib.idle_add(self._deferred_render)

    def _deferred_render(self):
        try:
            self._render_items()
        except Exception:
            log.exception("render after layout switch failed")
        return False

    # ------------------------------------------------------------- actions --
    def _copy_item(self, card):
        item = card.item
        if item.get("kind") == store_mod.KIND_TEXT:
            clipboard_mod.copy_text(self.store.get_text(item))
            self._show_toast("Copied text")
            return
        uri = item.get("uri") or store_mod.path_to_uri(item.get("path") or "")
        # Gtk.Clipboard cannot publish text/uri-list, so file copies go through
        # a small hand-written selection owner (see clipboard.py).
        if clipboard_mod.copy_uris([uri]):
            self._show_toast("Copied file")
        else:
            # Last resort: the path as text, better than losing the copy.
            clipboard_mod.copy_text(uri)
            self._show_toast("Copied path")

    def _targets(self, card):
        """Cards an action should apply to: every selected card when the one
        right-clicked is part of a multi-selection, otherwise just that card."""
        selected = [c for c in self.cards if c.selected]
        if card.selected and len(selected) > 1:
            return selected
        return [card]

    def _clear_item(self, card):
        targets = self._targets(card)
        removed = 0
        for target in targets:
            if self.store.remove(target.item.get("id")):
                removed += 1
        self.refresh_items()
        self._broadcast()
        if removed > 1:
            self._show_toast("Cleared %d items" % removed)

    def _clear_all(self):
        removed = self.store.clear_all()
        self.refresh_items()
        self._broadcast()
        if removed:
            self._show_toast("Cleared %d item%s" % (removed, "" if removed == 1 else "s"))
        else:
            self._show_toast("Nothing to clear")

    def _toggle_pin(self, card):
        pinned = self.store.toggle_pin(card.item.get("id"))
        if pinned is None:
            return
        card.item["pinned"] = bool(pinned)
        card.refresh()
        self._show_toast("Pinned" if pinned else "Unpinned")

    def _open_folder(self, card):
        item = card.item
        path = item.get("path") or ""
        folder = path if item.get("is_dir") else os.path.dirname(path)
        if not os.path.isdir(folder):
            self._show_toast("Folder is gone")
            return
        # For a file, ask the file manager to show it highlighted; fall back
        # to just opening the containing folder.
        if not item.get("is_dir") and os.path.exists(path):
            try:
                bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
                bus.call_sync(
                    "org.freedesktop.FileManager1", "/org/freedesktop/FileManager1",
                    "org.freedesktop.FileManager1", "ShowItems",
                    GLib.Variant("(ass)", ([store_mod.path_to_uri(path)], "pickup")),
                    None, Gio.DBusCallFlags.NONE, 1500, None,
                )
                return
            except Exception:
                pass
        try:
            Gio.AppInfo.launch_default_for_uri(store_mod.path_to_uri(folder), None)
        except Exception as exc:
            print("pickup: could not open folder: %s" % exc)
            self._show_toast("Could not open folder")

    # ------------------------------------------------------------- theme --
    def _refresh_theme_button(self):
        self.theme_button.set_label("\u2600" if self.dark else "\u263e")
        self.theme_button.set_tooltip_text("Switch to light" if self.dark else "Switch to dark")

    def _toggle_theme(self):
        self.dark = not self.dark
        self._css_provider = theme.swap_css(self.get_screen(), self._css_provider, self.dark)
        self.store.set_pref("theme", "dark" if self.dark else "light")
        if self._tab is not None:
            self._tab.set_dark(self.dark)
        self._refresh_theme_button()

    # -------------------------------------------------------------- toast --
    def _show_toast(self, text):
        self.toast.set_text(text)
        self.toast.show()
        if self._toast_timer:
            GLib.source_remove(self._toast_timer)
        self._toast_timer = GLib.timeout_add(TOAST_MS, self._hide_toast)

    def _hide_toast(self):
        self._toast_timer = None
        self.toast.hide()
        return False

    # ------------------------------------------------------------ accels --
    def _setup_accels(self):
        # Ctrl+A selects all. Deliberately no Escape binding: the window closes
        # only with the cross button.
        accel = Gtk.AccelGroup()
        self.add_accel_group(accel)
        accel.connect(
            Gdk.KEY_a,
            Gdk.ModifierType.CONTROL_MASK,
            0,
            lambda *_: (self._on_select_all(), True)[1],
        )

    # ----------------------------------------------------------- lifetime --
    def _on_delete(self, widget, event):
        # Only reachable from the cross button / WM close request; never from a
        # drop, a drag ending, Escape or focus loss.
        self.quit()
        return True

    def quit(self):
        if self._exiting:
            return
        self._exiting = True
        self._cancel_auto_collapse()
        self._save_size()
        self._save_position()
        self.store.save()
        GLib.idle_add(self._finish)

    def _finish(self):
        if RESIDENT_MODE:
            # Resident mode: stay alive, just hide the window.
            self.hide()
            self._exiting = False
            return False
        self._unexport_dbus()
        if self._tab is not None:
            self._tab.destroy()
            self._tab = None
        Gtk.main_quit()
        return False

    def _on_destroy(self, widget):
        self._unexport_dbus()

    def _save_position(self):
        try:
            if self._collapsed and self._expanded_pos:
                x, y = self._expanded_pos
            else:
                x, y = self.get_position()
            self.store.set_pref("position", [int(x), int(y)])
        except Exception:
            pass

    # -------------------------------------------------------------- D-Bus --
    def _export_dbus(self):
        try:
            node = Gio.DBusNodeInfo.new_for_xml(XML)
        except Exception as exc:
            print("pickup: invalid D-Bus XML: %s" % exc)
            return
        self._dbus_interface = node.interfaces[0]
        try:
            self._dbus_connection.register_object(
                OBJECT_PATH,
                self._dbus_interface,
                self._on_method_call,
                self._on_get_property,
                None,
            )
            self._dbus_registered = True
            self._broadcast()
        except Exception as exc:
            print("pickup: could not export D-Bus object: %s" % exc)

    def _unexport_dbus(self):
        if getattr(self, "_dbus_registered", False):
            try:
                self._dbus_connection.unregister_object(OBJECT_PATH)
            except Exception:
                pass
            self._dbus_registered = False

    def _on_method_call(self, conn, sender, path, interface, method, params, invocation):
        if method == "Toggle":
            # Applet click while Pickup is running (open *or* collapsed to
            # the tab): close it completely. Clicking again starts it fresh.
            invocation.return_value(None)
            self.quit()
        elif method == "Show":
            if self._collapsed:
                self._expand()
            else:
                self.present()
            invocation.return_value(None)
        elif method == "Count":
            invocation.return_value(GLib.Variant("(i)", (len(self.store.items),)))
        elif method == "Quit":
            invocation.return_value(None)
            self.quit()
        else:
            invocation.return_value(None)

    def _on_get_property(self, conn, sender, path, interface, name):
        return None

    def _broadcast(self):
        if not getattr(self, "_dbus_registered", False):
            return
        try:
            self._dbus_connection.emit_signal(
                None,
                OBJECT_PATH,
                INTERFACE,
                "StateChanged",
                GLib.Variant("(i)", (len(self.store.items),)),
            )
        except Exception:
            pass


# --------------------------------------------------------------- startup --
def _request_name(connection):
    """Claim org.pickup.Popup. True if this process now owns it."""
    try:
        result = connection.call_sync(
            "org.freedesktop.DBus",
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus",
            "RequestName",
            GLib.Variant("(su)", (BUS_NAME, 0x4)),  # DO_NOT_QUEUE
            GLib.VariantType.new("(u)"),
            Gio.DBusCallFlags.NONE,
            1500,
            None,
        )
        code = result.unpack()[0]
        # 1 = primary owner, 4 = already owner.
        return code in (1, 4)
    except Exception as exc:
        print("pickup: RequestName failed: %s" % exc)
        # Without a bus we can still run, just without single-instance safety.
        return True


def _ask_existing_to_show(connection):
    # The owner claims the name before it exports its object, so a very quick
    # second launch may need to retry for a moment.
    import time

    for _attempt in range(12):
        try:
            connection.call_sync(
                BUS_NAME, OBJECT_PATH, INTERFACE, "Show",
                None, None, Gio.DBusCallFlags.NONE, 800, None,
            )
            return
        except Exception:
            time.sleep(0.15)


def parse_args(argv):
    import argparse

    parser = argparse.ArgumentParser(description="Pickup shelf popup")
    parser.add_argument("--state", default=None, help="State JSON path (testing)")
    parser.add_argument(
        "--allow-duplicate",
        action="store_true",
        help="Do not claim the D-Bus name (testing)",
    )
    parser.add_argument(
        "--theme", choices=["dark", "light"], default=None, help="Force a palette"
    )
    return parser.parse_args(argv)


def main(argv=None):
    _setup_logging()
    args = parse_args(sys.argv[1:] if argv is None else argv)

    if args.state:
        path = os.path.abspath(args.state)
        store = store_mod.Store(
            path=path, texts_dir=os.path.join(os.path.dirname(path), "texts")
        )
    else:
        store = store_mod.Store()

    if args.theme:
        theme.system_prefers_dark = lambda: args.theme == "dark"

    connection = None
    registered = False
    if not args.allow_duplicate:
        try:
            connection = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        except Exception:
            connection = None
        if connection is not None and not _request_name(connection):
            # Another popup is already up: raise it and leave.
            _ask_existing_to_show(connection)
            return 0
        registered = connection is not None

    PickupWindow(store, connection, dbus_registered=registered)
    Gtk.main()
    return 0


if __name__ == "__main__":
    sys.exit(main())
