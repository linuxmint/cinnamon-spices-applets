"""The little edge tab Pickup collapses into.

A tiny always-on-top window docked to the left or right edge of the screen
(whichever is nearer the popup). It shows an arrow pointing into the screen and
the item count. Click it -> the popup expands again. Hover a file/text drag over
it for a moment -> the popup expands so you can drop into it.

It is a separate window from the popup, so collapsing never touches the shelf's
state: the popup is merely hidden while the tab is shown.
"""

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GLib, Gtk  # noqa: E402

import theme  # noqa: E402

TAB_WIDTH = 22
TAB_HEIGHT = 76
RADIUS = 9
EDGE_MARGIN = 4          # keep clear of the panel / screen corners
DRAG_DWELL_MS = 250      # how long a drag must hover before we expand


def _rgba(spec):
    color = Gdk.RGBA()
    if not color.parse(spec):
        color.parse("rgba(128,128,128,0.8)")
    return color


class EdgeTab(Gtk.Window):
    def __init__(self, dark, on_expand, on_drag_expand):
        super().__init__(type=Gtk.WindowType.TOPLEVEL)
        self.dark = dark
        self._on_expand = on_expand
        self._on_drag_expand = on_drag_expand
        self.edge = "right"
        self.count = 0
        self._hover = False
        self._dwell = 0

        self.set_decorated(False)
        self.set_resizable(False)
        self.set_keep_above(True)
        self.set_skip_taskbar_hint(True)
        self.set_skip_pager_hint(True)
        self.set_accept_focus(False)
        self.set_type_hint(Gdk.WindowTypeHint.UTILITY)
        self.set_app_paintable(True)
        self.set_title("Pickup tab")
        self.set_default_size(TAB_WIDTH, TAB_HEIGHT)
        self.set_size_request(TAB_WIDTH, TAB_HEIGHT)

        visual = self.get_screen().get_rgba_visual()
        if visual is not None:
            self.set_visual(visual)

        self.add_events(
            Gdk.EventMask.BUTTON_PRESS_MASK
            | Gdk.EventMask.ENTER_NOTIFY_MASK
            | Gdk.EventMask.LEAVE_NOTIFY_MASK
        )
        self.connect("draw", self._on_draw)
        self.connect("button-press-event", self._on_press)
        self.connect("enter-notify-event", self._on_enter)
        self.connect("leave-notify-event", self._on_leave)

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
        self.set_tooltip_text("Open Pickup")

    # ------------------------------------------------------------ public --
    def set_dark(self, dark):
        self.dark = dark
        self.queue_draw()

    def set_count(self, count):
        self.count = max(0, int(count))
        self.queue_draw()

    def place_near(self, center_x, center_y):
        """Dock to the nearer left/right edge of the work area, level with
        (center_x, center_y), and show."""
        display = Gdk.Display.get_default()
        monitor = display.get_monitor_at_point(int(center_x), int(center_y))
        work = monitor.get_workarea()
        mid = work.x + work.width / 2.0
        self.edge = "left" if center_x < mid else "right"
        x = work.x if self.edge == "left" else work.x + work.width - TAB_WIDTH
        y = int(center_y - TAB_HEIGHT / 2)
        y = max(work.y + EDGE_MARGIN, min(y, work.y + work.height - TAB_HEIGHT - EDGE_MARGIN))
        self.move(x, y)
        self.show()
        self.move(x, y)  # some WMs only honour the position once mapped
        self.queue_draw()

    # ----------------------------------------------------------- drawing --
    def _on_draw(self, widget, cr):
        pal = theme.palette(self.dark)
        width, height = float(TAB_WIDTH), float(TAB_HEIGHT)

        # Clear to transparent.
        cr.set_operator(0)  # CAIRO_OPERATOR_CLEAR
        cr.paint()
        cr.set_operator(2)  # CAIRO_OPERATOR_OVER

        # Rounded on the side that faces the screen, flat against the edge.
        r = RADIUS
        if self.edge == "right":
            cr.move_to(width, 0)
            cr.line_to(r, 0)
            cr.arc_negative(r, r, r, -1.5708, 3.14159)      # top-left corner
            cr.line_to(0, height - r)
            cr.arc_negative(r, height - r, r, 3.14159, 1.5708)  # bottom-left
            cr.line_to(width, height)
        else:
            cr.move_to(0, 0)
            cr.line_to(width - r, 0)
            cr.arc(width - r, r, r, -1.5708, 0)
            cr.line_to(width, height - r)
            cr.arc(width - r, height - r, r, 0, 1.5708)
            cr.line_to(0, height)
        cr.close_path()

        fill = _rgba(pal["menu_bg"])
        cr.set_source_rgba(fill.red, fill.green, fill.blue, 0.96 if self._hover else 0.88)
        cr.fill_preserve()
        border = _rgba(pal["menu_border"])
        cr.set_source_rgba(border.red, border.green, border.blue, border.alpha)
        cr.set_line_width(1.0)
        cr.stroke()

        accent = _rgba(pal["accent"])
        # Arrow pointing into the screen (the direction the popup opens).
        cx = width / 2.0
        cy = height / 2.0 - (6.0 if self.count else 0.0)
        direction = -1.0 if self.edge == "right" else 1.0
        cr.set_source_rgba(accent.red, accent.green, accent.blue, 1.0)
        cr.set_line_width(2.2)
        cr.set_line_cap(1)   # round
        cr.set_line_join(1)  # round
        cr.move_to(cx - direction * 2.6, cy - 5.0)
        cr.line_to(cx + direction * 2.6, cy)
        cr.line_to(cx - direction * 2.6, cy + 5.0)
        cr.stroke()

        if self.count:
            text = str(self.count) if self.count < 100 else "99+"
            cr.select_font_face("Sans", 0, 1)
            cr.set_font_size(9.5)
            extents = cr.text_extents(text)
            text_color = _rgba(pal["text_dim"])
            cr.set_source_rgba(text_color.red, text_color.green, text_color.blue, 1.0)
            cr.move_to(cx - extents.width / 2.0 - extents.x_bearing, height - 13.0)
            cr.show_text(text)
        return False

    # ------------------------------------------------------------ events --
    def _on_press(self, widget, event):
        if event.button == 1:
            self._cancel_dwell()
            GLib.idle_add(self._fire, self._on_expand)
        return True

    def _on_enter(self, widget, event):
        self._hover = True
        self.queue_draw()
        return False

    def _on_leave(self, widget, event):
        self._hover = False
        self.queue_draw()
        return False

    def _on_drag_motion(self, widget, context, x, y, time):
        try:
            if Gtk.drag_get_source_widget(context) is not None:
                Gdk.drag_status(context, 0, time)  # our own card: not a drop
                return True
        except Exception:
            pass
        Gdk.drag_status(context, Gdk.DragAction.COPY, time)
        if not self._dwell:
            self._dwell = GLib.timeout_add(DRAG_DWELL_MS, self._dwell_done)
        return True

    def _on_drag_leave(self, widget, context, time):
        self._cancel_dwell()

    def _dwell_done(self):
        self._dwell = 0
        GLib.idle_add(self._fire, self._on_drag_expand)
        return False

    def _cancel_dwell(self):
        if self._dwell:
            GLib.source_remove(self._dwell)
            self._dwell = 0

    @staticmethod
    def _fire(callback):
        try:
            callback()
        except Exception:
            import logging

            logging.getLogger("pickup").exception("edge tab callback failed")
        return False
