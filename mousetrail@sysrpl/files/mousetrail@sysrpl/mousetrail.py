#!/usr/bin/env python3
"""mousetrail - a screen-recording mouse and keyboard highlighter.

Draws a translucent white circle that follows the pointer everywhere. On a
mouse click the circle turns hollow and swells out to a larger ring, so
viewers of a screen recording can see exactly where you clicked. Keys you
press appear briefly as large key-caps along the bottom of the screen:
typing "About" shows [A][b][o][u][t].

The overlay is click-through: it never intercepts input.
Requires X11 (Linux Mint / Cinnamon default), GTK 3 and python-xlib.
"""

import math
import argparse
import fcntl
import hashlib
import json
import os
import signal
import sys
import tempfile
import threading
import time

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, Gio, GLib, Gtk  # noqa: E402

import cairo  # noqa: E402
from Xlib import X, XK, display as xdisplay  # noqa: E402
from Xlib.ext import record  # noqa: E402
from Xlib.protocol import rq  # noqa: E402

# --- Cursor circle ---------------------------------------------------------
IDLE_DIAMETER = 75       # px, resting filled circle
CLICK_DIAMETER = 125     # px, peak of the click swell
STROKE = 5               # px, ring thickness while clicking
OPACITY = 0.30           # 30% visible
COLOR = (1.0, 1.0, 1.0)  # white
CLICK_DURATION = 0.5     # seconds the click flash lasts

# --- Keystroke display -----------------------------------------------------
KEY_DURATION = 2.0       # seconds each key-cap stays on screen
KEY_FADE = 0.12          # seconds of fade-out at the end of that life
KEY_FONT_SIZE = 44       # px, big enough to read in a compressed video
KEY_PAD_X = 16
KEY_PAD_Y = 10
KEY_GAP = 8
KEY_BOTTOM_MARGIN = 70   # px above the bottom edge of the primary monitor
KEY_CORNER = 10
KEY_BG = (0.0, 0.0, 0.0, 0.70)
KEY_FG = (1.0, 1.0, 1.0, 1.0)
KEY_BORDER = (1.0, 1.0, 1.0, 0.85)
KEY_BORDER_WIDTH = 2
MAX_KEYS = 24            # cap the row so a key-repeat storm can't overflow

# --- Behaviour -------------------------------------------------------------
FPS = 60
IGNORE_SCROLL = True     # don't flash on wheel scroll (buttons 4-7)
SHOW_KEYS = True         # set False for a mouse-only overlay
TOGGLE_KEY = "grave"     # the ` key: hides/shows the overlay, never drawn

# Half-width of the area repainted around the cursor each frame.
DAMAGE = CLICK_DIAMETER // 2 + STROKE + 2

# Keys that have no printable character get a spelled-out cap instead.
SPECIAL_KEYS = {
    "Return": "ENTER", "KP_Enter": "ENTER",
    "space": "SPACE", "BackSpace": "BKSP", "Tab": "TAB", "Escape": "ESC",
    "Control_L": "CTRL", "Control_R": "CTRL",
    "Alt_L": "ALT", "Alt_R": "ALT", "ISO_Level3_Shift": "ALTGR",
    "Super_L": "SUPER", "Super_R": "SUPER",
    "Shift_L": "SHIFT", "Shift_R": "SHIFT", "Caps_Lock": "CAPS",
    "Delete": "DEL", "Insert": "INS", "Home": "HOME", "End": "END",
    "Page_Up": "PGUP", "Page_Down": "PGDN",
    "Up": "↑", "Down": "↓", "Left": "←", "Right": "→",
    "Print": "PRTSC", "Menu": "MENU", "Num_Lock": "NUMLK",
    "Scroll_Lock": "SCRLK", "Pause": "PAUSE",
}
for _i in range(1, 13):
    SPECIAL_KEYS["F%d" % _i] = "F%d" % _i

TOGGLE_KEYSYM = XK.string_to_keysym(TOGGLE_KEY)
TOGGLE_MODIFIERS = 0

SETTING_DEFAULTS = {
    "idle-diameter": IDLE_DIAMETER,
    "click-diameter": CLICK_DIAMETER,
    "stroke": STROKE,
    "opacity": OPACITY,
    "color": "#ffffff",
    "click-duration": CLICK_DURATION,
    "key-duration": KEY_DURATION,
    "key-fade": KEY_FADE,
    "key-font-size": KEY_FONT_SIZE,
    "key-bottom-margin": KEY_BOTTOM_MARGIN,
    "show-keys": SHOW_KEYS,
    "ignore-scroll": IGNORE_SCROLL,
    "toggle-key": TOGGLE_KEY,
}

SPECIAL_BY_KEYSYM = {}
for _name, _label in SPECIAL_KEYS.items():
    _ks = XK.string_to_keysym(_name)
    if _ks:
        SPECIAL_BY_KEYSYM[_ks] = _label


def ease_in_out_sine(x):
    """Standard easeInOutSine: slow at both ends, quickest in the middle."""
    return (1 - math.cos(math.pi * x)) / 2


def acquire_instance_lock(timeout=5.0):
    """Allow one overlay per user and X display, including during restarts."""
    display_name = os.environ.get("DISPLAY", "")
    display_id = hashlib.sha256(display_name.encode()).hexdigest()[:16]
    runtime_dir = os.environ.get("XDG_RUNTIME_DIR") or tempfile.gettempdir()
    path = os.path.join(runtime_dir,
                        "mousetrail-%d-%s.lock" % (os.getuid(), display_id))
    flags = os.O_CREAT | os.O_RDWR
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    fd = os.open(path, flags, 0o600)
    deadline = time.monotonic() + timeout
    while True:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return fd
        except BlockingIOError:
            if time.monotonic() >= deadline:
                os.close(fd)
                return None
            time.sleep(0.1)


def applet_is_enabled(settings, instance_id):
    suffix = ":mousetrail@sysrpl:%s" % instance_id
    return any(item.endswith(suffix)
               for item in settings.get_strv("enabled-applets"))


class Overlay(Gtk.Window):
    """A full-screen, click-through, always-on-top canvas.

    The window itself never moves; only its contents do. Moving a small
    window every frame makes the compositor flicker, so instead we repaint
    just the patches of a stationary window that actually changed.
    """

    def __init__(self, status_path=None):
        super().__init__(type=Gtk.WindowType.POPUP)
        self.status_path = status_path

        self.set_app_paintable(True)
        self.set_decorated(False)
        self.set_keep_above(True)
        self.set_accept_focus(False)
        self.set_focus_on_map(False)
        self.set_skip_taskbar_hint(True)
        self.set_skip_pager_hint(True)

        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        if visual is None:
            sys.exit("error: no compositing / RGBA visual available; "
                     "turn on compositing in Cinnamon and try again.")
        self.set_visual(visual)

        # Click-through. Setting the empty region on the *widget* (not the
        # GdkWindow) lets GTK re-apply it across realize and resize, so the
        # overlay can never start swallowing clicks.
        self.input_shape_combine_region(cairo.Region())

        self.origin = (0, 0)
        self.strip = (0, 0, 0, 0)
        self.apply_geometry()
        screen.connect("size-changed", lambda *_: self.apply_geometry())
        screen.connect("monitors-changed", lambda *_: self.apply_geometry())

        self.connect("draw", self.on_draw)
        self.connect("destroy", Gtk.main_quit)

        self.pointer = Gdk.Display.get_default().get_default_seat().get_pointer()
        self.center = (-9999, -9999)   # circle position, widget-relative
        self.click_elapsed = None      # seconds into the flash, None when idle
        self.keys = []                 # [label, pressed_at] for live key-caps
        self.enabled = True            # toggled by TOGGLE_KEY

        self.show_all()
        self.stick()                   # visible on every workspace
        self.write_status()
        GLib.timeout_add(int(1000 / FPS), self.tick)

    def write_status(self):
        if self.status_path:
            directory = os.path.dirname(self.status_path) or "."
            fd, temporary = tempfile.mkstemp(
                prefix=os.path.basename(self.status_path) + ".",
                suffix=".tmp", dir=directory)
            try:
                with os.fdopen(fd, "w", encoding="ascii") as stream:
                    stream.write("active" if self.enabled else "inactive")
                os.replace(temporary, self.status_path)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)

    def apply_geometry(self):
        """Cover every monitor, as one window spanning the whole desktop."""
        display = Gdk.Display.get_default()
        left = top = right = bottom = None
        for i in range(display.get_n_monitors()):
            r = display.get_monitor(i).get_geometry()
            left = r.x if left is None else min(left, r.x)
            top = r.y if top is None else min(top, r.y)
            right = r.x + r.width if right is None else max(right, r.x + r.width)
            bottom = r.y + r.height if bottom is None else max(bottom, r.y + r.height)

        self.origin = (left, top)
        self.move(left, top)
        self.resize(right - left, bottom - top)

        # Key-caps sit on the primary monitor, not out in the virtual desktop.
        monitor = display.get_primary_monitor() or display.get_monitor(0)
        m = monitor.get_geometry()
        height = KEY_FONT_SIZE + 2 * KEY_PAD_Y + 2 * KEY_BORDER_WIDTH
        self.strip = (m.x - left,
                      m.y - top + m.height - KEY_BOTTOM_MARGIN - height,
                      m.width,
                      height)

    # -- events -------------------------------------------------------------
    def toggle(self):
        """Show or hide everything, without stopping the program."""
        self.enabled = not self.enabled
        self.write_status()
        self.click_elapsed = None
        self.keys = []
        self.damage_circle(self.center)   # erase, or repaint on the way back
        self.damage_strip()

    def flash(self):
        if not self.enabled:
            return
        self.click_elapsed = 0.0
        self.damage_circle(self.center)

    def add_key(self, label):
        if not self.enabled:
            return
        self.keys.append([label, time.monotonic()])
        del self.keys[:-MAX_KEYS]
        self.damage_strip()

    # -- damage -------------------------------------------------------------
    def damage_circle(self, center):
        cx, cy = center
        self.queue_draw_area(int(cx) - DAMAGE, int(cy) - DAMAGE,
                             DAMAGE * 2, DAMAGE * 2)

    def damage_strip(self):
        x, y, w, h = self.strip
        self.queue_draw_area(int(x), int(y), int(w), int(h))

    def tick(self):
        _screen, x, y = self.pointer.get_position()
        center = (x - self.origin[0], y - self.origin[1])

        if not self.enabled:
            self.center = center      # keep tracking so it reappears in place
            return True

        moved = center != self.center
        if moved:
            self.damage_circle(self.center)   # erase where it was
            self.center = center

        if self.click_elapsed is not None:
            self.click_elapsed += 1.0 / FPS
            if self.click_elapsed >= CLICK_DURATION:
                self.click_elapsed = None
            self.damage_circle(center)
        elif moved:
            self.damage_circle(center)

        if self.keys:
            now = time.monotonic()
            live = [k for k in self.keys if now - k[1] < KEY_DURATION]
            fading = any(now - k[1] > KEY_DURATION - KEY_FADE for k in live)
            if len(live) != len(self.keys):
                self.keys = live
                self.damage_strip()        # a cap just expired; erase it
            elif fading:
                self.damage_strip()        # mid fade-out, keep repainting

        return True

    # -- drawing ------------------------------------------------------------
    def on_draw(self, _widget, cr):
        # Clear only the damaged patch cairo has already clipped us to.
        cr.set_operator(cairo.OPERATOR_SOURCE)
        cr.set_source_rgba(0, 0, 0, 0)
        cr.paint()
        cr.set_operator(cairo.OPERATOR_OVER)

        if not self.enabled:
            return False

        self.draw_circle(cr)
        if self.keys:
            self.draw_keys(cr)
        return False

    def draw_circle(self, cr):
        cx, cy = self.center
        r, g, b = COLOR
        cr.set_source_rgba(r, g, b, OPACITY)

        if self.click_elapsed is None:
            cr.arc(cx, cy, IDLE_DIAMETER / 2, 0, 2 * math.pi)
            cr.fill()
        else:
            t = self.click_elapsed / CLICK_DURATION
            # Out over the first half, back over the second, each half eased.
            phase = t * 2 if t < 0.5 else (1 - t) * 2
            swell = ease_in_out_sine(phase)
            diameter = IDLE_DIAMETER + (CLICK_DIAMETER - IDLE_DIAMETER) * swell
            cr.set_line_width(STROKE)
            cr.arc(cx, cy, (diameter - STROKE) / 2, 0, 2 * math.pi)
            cr.stroke()

    def draw_keys(self, cr):
        cr.select_font_face("Sans", cairo.FONT_SLANT_NORMAL,
                            cairo.FONT_WEIGHT_BOLD)
        cr.set_font_size(KEY_FONT_SIZE)
        ascent, descent = cr.font_extents()[0], cr.font_extents()[1]

        now = time.monotonic()
        caps = []
        for label, pressed_at in self.keys:
            extents = cr.text_extents(label)
            width = max(extents.x_advance + 2 * KEY_PAD_X,
                        KEY_FONT_SIZE + KEY_PAD_X)
            caps.append((label, extents, width, now - pressed_at))

        strip_x, strip_y, strip_w, strip_h = self.strip
        total = sum(c[2] for c in caps) + KEY_GAP * (len(caps) - 1)
        x = strip_x + (strip_w - total) / 2

        for label, extents, width, age in caps:
            # Hold full opacity, then fade over the last KEY_FADE seconds.
            remaining = KEY_DURATION - age
            alpha = min(1.0, max(0.0, remaining / KEY_FADE)) if KEY_FADE else 1.0

            self.rounded_rect(cr, x, strip_y, width, strip_h, KEY_CORNER)
            cr.set_source_rgba(KEY_BG[0], KEY_BG[1], KEY_BG[2], KEY_BG[3] * alpha)
            cr.fill_preserve()
            cr.set_source_rgba(KEY_BORDER[0], KEY_BORDER[1], KEY_BORDER[2],
                               KEY_BORDER[3] * alpha)
            cr.set_line_width(KEY_BORDER_WIDTH)
            cr.stroke()

            cr.set_source_rgba(KEY_FG[0], KEY_FG[1], KEY_FG[2], KEY_FG[3] * alpha)
            # Baseline from the font, not the glyph, so caps don't jitter.
            text_x = x + (width - extents.width) / 2 - extents.x_bearing
            text_y = strip_y + (strip_h + ascent - descent) / 2
            cr.move_to(text_x, text_y)
            cr.show_text(label)

            x += width + KEY_GAP

    @staticmethod
    def rounded_rect(cr, x, y, w, h, r):
        cr.new_sub_path()
        cr.arc(x + w - r, y + r, r, -math.pi / 2, 0)
        cr.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
        cr.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
        cr.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
        cr.close_path()


class InputWatcher(threading.Thread):
    """Watches global clicks and key presses through the X RECORD extension."""

    daemon = True

    def __init__(self, on_click, on_key, on_toggle):
        super().__init__()
        self.on_click = on_click
        self.on_key = on_key
        self.on_toggle = on_toggle
        self.held = set()   # keycodes currently down, to drop auto-repeat
        self.record_display = xdisplay.Display()
        if not self.record_display.has_extension("RECORD"):
            sys.exit("error: X RECORD extension missing; cannot watch input.")

    def run(self):
        ctx = self.record_display.record_create_context(
            0,
            [record.AllClients],
            [{
                "core_requests": (0, 0),
                "core_replies": (0, 0),
                "ext_requests": (0, 0, 0, 0),
                "ext_replies": (0, 0, 0, 0),
                "delivered_events": (0, 0),
                # KeyPress .. ButtonPress covers key down, key up and clicks.
                "device_events": (X.KeyPress, X.ButtonPress),
                "errors": (0, 0),
                "client_started": False,
                "client_died": False,
            }],
        )
        self.record_display.record_enable_context(ctx, self.handle)
        self.record_display.record_free_context(ctx)

    def handle(self, reply):
        if reply.category != record.FromServer or reply.client_swapped:
            return
        if not len(reply.data) or reply.data[0] < 2:
            return
        data = reply.data
        while len(data):
            event, data = rq.EventField(None).parse_binary_value(
                data, self.record_display.display, None, None)

            if event.type == X.ButtonPress:
                if IGNORE_SCROLL and event.detail in (4, 5, 6, 7):
                    continue
                GLib.idle_add(self.on_click)

            elif event.type == X.KeyRelease:
                self.held.discard(event.detail)

            elif event.type == X.KeyPress:
                if event.detail in self.held:
                    continue          # auto-repeat while held down
                self.held.add(event.detail)

                keysym = self.record_display.keycode_to_keysym(event.detail, 0)
                # Shift is excluded so ~ still types and shows normally.
                modifier_mask = (X.ShiftMask | X.ControlMask | X.Mod1Mask |
                                 X.Mod4Mask)
                if (TOGGLE_KEYSYM and keysym == TOGGLE_KEYSYM and
                        event.state & modifier_mask == TOGGLE_MODIFIERS):
                    GLib.idle_add(self.on_toggle)
                    continue          # the toggle key never shows a key-cap

                if SHOW_KEYS:
                    label = self.label_for(event.detail, event.state)
                    if label:
                        GLib.idle_add(self.on_key, label)

    def label_for(self, keycode, state):
        """Turn a keycode plus modifier state into the text on the key-cap."""
        plain = self.record_display.keycode_to_keysym(keycode, 0)
        shifted = self.record_display.keycode_to_keysym(keycode, 1)

        if plain in SPECIAL_BY_KEYSYM:
            return SPECIAL_BY_KEYSYM[plain]

        shift = bool(state & X.ShiftMask)
        # Caps Lock flips the case of letters only, and cancels out with Shift.
        letter = XK.keysym_to_string(plain) or ""
        if letter.isalpha() and state & X.LockMask:
            shift = not shift

        keysym = shifted if shift else plain
        char = XK.keysym_to_string(keysym)
        if char and char.isprintable():
            return char
        return SPECIAL_BY_KEYSYM.get(keysym)


class ConfigWatcher:
    """Apply Cinnamon's settings file without restarting the overlay."""

    def __init__(self, path, overlay):
        self.path = path
        self.overlay = overlay
        self.mtime = None
        self.last_error = None

    def check(self):
        try:
            mtime = os.stat(self.path).st_mtime_ns
            if mtime == self.mtime:
                return True
            with open(self.path, encoding="utf-8") as stream:
                data = json.load(stream)
            values = {key: data.get(key, {}).get("value", default)
                      for key, default in SETTING_DEFAULTS.items()}
            self.apply(values)
            self.mtime = mtime
            self.last_error = None
        except (OSError, ValueError, TypeError, AttributeError) as exc:
            message = str(exc)
            if message != self.last_error:
                print("mousetrail: cannot read settings: %s" % exc,
                      file=sys.stderr)
                self.last_error = message
        return True

    def apply(self, values):
        global IDLE_DIAMETER, CLICK_DIAMETER, STROKE, OPACITY, COLOR
        global CLICK_DURATION, KEY_DURATION, KEY_FADE, KEY_FONT_SIZE
        global KEY_BOTTOM_MARGIN, SHOW_KEYS, IGNORE_SCROLL, DAMAGE
        global TOGGLE_KEYSYM, TOGGLE_MODIFIERS

        self.overlay.damage_circle(self.overlay.center)
        self.overlay.damage_strip()
        IDLE_DIAMETER = max(1, int(values["idle-diameter"]))
        CLICK_DIAMETER = max(IDLE_DIAMETER, int(values["click-diameter"]))
        STROKE = max(1, int(values["stroke"]))
        OPACITY = min(1.0, max(0.0, float(values["opacity"])))
        color = Gdk.RGBA()
        if color.parse(values["color"]):
            COLOR = (color.red, color.green, color.blue)
        CLICK_DURATION = max(0.05, float(values["click-duration"]))
        KEY_DURATION = max(0.05, float(values["key-duration"]))
        KEY_FADE = min(KEY_DURATION, max(0.0, float(values["key-fade"])))
        KEY_FONT_SIZE = max(1, int(values["key-font-size"]))
        KEY_BOTTOM_MARGIN = max(0, int(values["key-bottom-margin"]))
        SHOW_KEYS = bool(values["show-keys"])
        if not SHOW_KEYS:
            self.overlay.keys = []
        IGNORE_SCROLL = bool(values["ignore-scroll"])
        DAMAGE = CLICK_DIAMETER // 2 + STROKE + 2

        keyval, modifiers = Gtk.accelerator_parse(values["toggle-key"])
        TOGGLE_KEYSYM = keyval
        TOGGLE_MODIFIERS = 0
        for gdk_mask, x_mask in ((Gdk.ModifierType.SHIFT_MASK, X.ShiftMask),
                                 (Gdk.ModifierType.CONTROL_MASK, X.ControlMask),
                                 (Gdk.ModifierType.MOD1_MASK, X.Mod1Mask),
                                 (Gdk.ModifierType.MOD4_MASK, X.Mod4Mask)):
            if modifiers & gdk_mask:
                TOGGLE_MODIFIERS |= x_mask
        self.overlay.apply_geometry()
        self.overlay.damage_circle(self.overlay.center)
        self.overlay.damage_strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", help="Cinnamon applet settings JSON")
    parser.add_argument("--status", help="file reporting active/inactive state")
    parser.add_argument("--instance-id", help="Cinnamon applet instance ID")
    args = parser.parse_args()
    lock_fd = acquire_instance_lock()
    if lock_fd is None:
        print("mousetrail: an overlay is already running on this display",
              file=sys.stderr)
        return
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    try:
        overlay = Overlay(args.status)
        if args.config:
            config = ConfigWatcher(args.config, overlay)
            config.check()
            GLib.timeout_add(250, config.check)
        if args.status:
            # Cinnamon may restart without invoking the applet removal callback.
            # In that case the old overlay must leave before a new one is started.
            parent_pid = os.getppid()
            cinnamon_settings = (Gio.Settings.new("org.cinnamon")
                                 if args.instance_id else None)

            def check_parent():
                if (os.getppid() != parent_pid or
                        (cinnamon_settings is not None and not
                         applet_is_enabled(cinnamon_settings, args.instance_id))):
                    Gtk.main_quit()
                    return False
                return True

            GLib.timeout_add_seconds(1, check_parent)
        InputWatcher(overlay.flash, overlay.add_key, overlay.toggle).start()
        Gtk.main()
    finally:
        os.close(lock_fd)


if __name__ == "__main__":
    main()
