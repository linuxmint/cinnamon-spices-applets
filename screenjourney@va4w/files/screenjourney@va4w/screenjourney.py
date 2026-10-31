#!/usr/bin/env python3
"""ScreenJourney capture helper.

Shows a selection overlay and captures a region or the whole screen as a PNG
screenshot or as a video recording (ffmpeg / x11grab). While recording, this
process stays alive as the ffmpeg parent; `screenjourney.py stop` (or SIGTERM)
finishes the recording cleanly.
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime

import gi

gi.require_version("Gdk", "3.0")
gi.require_version("Gtk", "3.0")
gi.require_version("PangoCairo", "1.0")
import cairo  # noqa: E402
from gi.repository import Gdk, GLib, Gtk, Pango, PangoCairo  # noqa: E402

try:
    gi.require_version("GLibUnix", "2.0")
    from gi.repository import GLibUnix  # noqa: E402
    signal_add = GLibUnix.signal_add
except (ImportError, ValueError):
    signal_add = GLib.unix_signal_add

APP = "ScreenJourney"
RUNTIME = os.path.join(GLib.get_user_runtime_dir(), "screenjourney")
STATE = os.path.join(GLib.get_user_state_dir(), "screenjourney")
RECORDING = os.path.join(RUNTIME, "recording.json")
LAST = os.path.join(RUNTIME, "last.json")
OVERLAY_PID = os.path.join(RUNTIME, "overlay.pid")
FFMPEG_LOG = os.path.join(RUNTIME, "ffmpeg.log")
PREFS = os.path.join(STATE, "overlay.json")

ACCENT = (0.21, 0.52, 0.89)
RECORD = (0.88, 0.11, 0.14)
AUDIO_LABELS = {"none": "No audio", "mic": "Microphone", "desktop": "Desktop audio"}
AUDIO_ICONS = {"none": "audio-volume-muted-symbolic", "mic": "audio-input-microphone-symbolic",
               "desktop": "audio-volume-high-symbolic"}
DELAYS = [0, 3, 5, 10]

CSS = b"""
.sj-toolbar {
    background-color: rgba(28, 28, 30, 0.94);
    border-radius: 14px;
    padding: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
}
.sj-toolbar button {
    background: none;
    border: none;
    box-shadow: none;
    color: #eeeeee;
    border-radius: 9px;
    padding: 6px 12px;
    min-height: 0;
    text-shadow: none;
    -gtk-icon-shadow: none;
}
.sj-toolbar button:hover { background-color: rgba(255, 255, 255, 0.10); }
.sj-toolbar button:checked { background-color: rgba(255, 255, 255, 0.20); color: #ffffff; }
.sj-toolbar button.sj-go { background-color: #3584e4; color: #ffffff; font-weight: bold; }
.sj-toolbar button.sj-go:hover { background-color: #4a92e8; }
.sj-toolbar button.sj-go.sj-rec { background-color: #e01b24; }
.sj-toolbar button.sj-go.sj-rec:hover { background-color: #ea3a42; }
.sj-toolbar button.sj-go:disabled { background-color: rgba(255, 255, 255, 0.08); color: #888888; }
.sj-toolbar separator { background-color: rgba(255, 255, 255, 0.15); min-width: 1px; margin: 6px 4px; }
"""


# ---------------------------------------------------------------- helpers

def read_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, path)


def remove(path):
    try:
        os.unlink(path)
    except OSError:
        pass


def pid_alive(pid):
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, ValueError, TypeError):
        return False


def active_recording():
    rec = read_json(RECORDING)
    if rec and pid_alive(rec.get("pid")):
        return rec
    remove(RECORDING)
    return None


def resolve_dir(value, special, sub):
    if value:
        if value.startswith("file://"):
            value = urllib.parse.unquote(value[7:])
        value = os.path.expanduser(value)
    else:
        base = GLib.get_user_special_dir(special) or os.path.expanduser("~")
        value = os.path.join(base, sub)
    os.makedirs(value, exist_ok=True)
    return value


def new_path(directory, prefix, ext):
    stamp = datetime.now().strftime("%Y-%m-%d %H-%M-%S")
    path = os.path.join(directory, f"{prefix} {stamp}.{ext}")
    n = 2
    while os.path.exists(path):
        path = os.path.join(directory, f"{prefix} {stamp} ({n}).{ext}")
        n += 1
    return path


def notify(opts, title, body, path=None, icon=None, urgent=False):
    if not opts.notify and not urgent:
        return
    cmd = ["notify-send", "-a", APP, "-i", icon or "camera-photo", title, body]
    if path:
        # Wait for an action in a detached shell so this process can exit.
        script = ('a=$(notify-send -w -a "$1" -i "$2" --action=open=Open --action=folder="Show in folder" "$3" "$4");'
                  ' case "$a" in open) xdg-open "$5";; folder) xdg-open "$6";; esac')
        cmd = ["sh", "-c", script, "sh", APP, icon or path, title, body, path, os.path.dirname(path)]
    subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, start_new_session=True)


def monitors():
    display = Gdk.Display.get_default()
    return [display.get_monitor(i) for i in range(display.get_n_monitors())]


def screen_bounds():
    geos = [m.get_geometry() for m in monitors()]
    x0 = min(g.x for g in geos)
    y0 = min(g.y for g in geos)
    x1 = max(g.x + g.width for g in geos)
    y1 = max(g.y + g.height for g in geos)
    return x0, y0, x1 - x0, y1 - y0


def scale_factor():
    return max(m.get_scale_factor() for m in monitors())


def to_device(rect, scale, even=False):
    x, y, w, h = (int(round(v * scale)) for v in rect)
    if even:
        w -= w % 2
        h -= h % 2
    return x, y, max(w, 2), max(h, 2)


def x11_input(rect):
    x, y, w, h = rect
    return ["-video_size", f"{w}x{h}", "-i", f"{os.environ.get('DISPLAY', ':0')}+{x},{y}"]


# ---------------------------------------------------------------- capture

def take_screenshot(opts, rect):
    """rect is in device pixels."""
    path = new_path(opts.image_dir, "Screenshot", "png")
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "x11grab", "-draw_mouse", "0",
           *x11_input(rect), "-frames:v", "1", "-update", "1", "-y", path]
    result = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if result.returncode != 0 or not os.path.exists(path):
        notify(opts, "Screenshot failed", result.stderr.strip()[-300:] or "ffmpeg error", icon="dialog-error",
               urgent=True)
        return None
    if opts.clipboard:
        try:
            subprocess.Popen(["xclip", "-selection", "clipboard", "-t", "image/png", "-i", path],
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
        except OSError:
            pass
    write_json(LAST, {"file": path, "kind": "image", "time": time.time()})
    body = os.path.basename(path) + (" · copied to clipboard" if opts.clipboard else "")
    notify(opts, "Screenshot saved", body, path=path, icon=path)
    return path


_encoders = None


def encoders():
    global _encoders
    if _encoders is None:
        try:
            out = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
        except OSError:
            out = ""
        _encoders = {line.split()[1] for line in out.splitlines() if len(line.split()) > 1 and line.startswith(" ")}
    return _encoders


def video_codec(fmt, rect, fps):
    """Return (extension, video args, audio args) for the best available encoder."""
    enc = encoders()
    aac = ["-c:a", "aac", "-b:a", "160k"]
    if fmt == "mp4":
        if "libx264" in enc:
            return "mp4", ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"], aac
        if "libopenh264" in enc:
            rate = max(2_000_000, int(rect[2] * rect[3] * fps * 0.12))
            return "mp4", ["-c:v", "libopenh264", "-b:v", str(rate)], aac
    opus = ["-c:a", "libopus", "-b:a", "128k"]
    if "libvpx-vp9" in enc:
        return "webm", ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1",
                        "-crf", "32", "-b:v", "0"], opus
    if "libvpx" in enc:
        return "webm", ["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-crf", "10",
                        "-b:v", "8M"], opus
    return "mkv", ["-c:v", "mpeg4", "-q:v", "3"], aac


def audio_source(kind):
    if kind == "mic":
        return "default"
    if kind == "desktop":
        try:
            sink = subprocess.run(["pactl", "get-default-sink"], capture_output=True, text=True).stdout.strip()
        except OSError:
            sink = ""
        return f"{sink}.monitor" if sink else "default"
    return None


class Border:
    """Thin click-through frame drawn just outside the recorded area."""

    def __init__(self, rect):
        x, y, w, h = rect
        bx, by, bw, bh = screen_bounds()
        t, gap = 3, 2
        sides = [(x - gap - t, y - gap - t, w + 2 * (gap + t), t),
                 (x - gap - t, y + h + gap, w + 2 * (gap + t), t),
                 (x - gap - t, y - gap, t, h + 2 * gap),
                 (x + w + gap, y - gap, t, h + 2 * gap)]
        self.windows = []
        for sx, sy, sw, sh in sides:
            if sx < bx or sy < by or sx + sw > bx + bw or sy + sh > by + bh:
                continue
            win = Gtk.Window(type=Gtk.WindowType.POPUP)
            win.set_app_paintable(True)
            win.move(sx, sy)
            win.resize(sw, sh)
            win.connect("draw", self._draw)
            win.show()
            win.get_window().input_shape_combine_region(cairo.Region(), 0, 0)
            self.windows.append(win)

    @staticmethod
    def _draw(_widget, cr):
        cr.set_source_rgb(*RECORD)
        cr.paint()
        return True

    def destroy(self):
        for win in self.windows:
            win.destroy()
        self.windows = []


class Recorder:
    def __init__(self, opts, on_done):
        self.opts = opts
        self.on_done = on_done
        self.proc = None
        self.border = None
        self.exited = False
        self.stopping = False

    def start(self, rect, logical=None):
        """rect is in device pixels (even size); logical is the same area in GDK coordinates."""
        opts = self.opts
        ext, vargs, aargs = video_codec(opts.format, rect, opts.fps)
        self.path = new_path(opts.video_dir, "Recording", ext)
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "warning",
               "-thread_queue_size", "1024", "-f", "x11grab", "-framerate", str(opts.fps),
               "-draw_mouse", "1" if opts.pointer else "0", *x11_input(rect)]
        source = audio_source(opts.audio)
        if source:
            cmd += ["-thread_queue_size", "1024", "-f", "pulse", "-i", source]
        cmd += vargs + (aargs if source else []) + ["-pix_fmt", "yuv420p"]
        if ext == "mp4":
            cmd += ["-movflags", "+faststart"]
        cmd += ["-y", self.path]

        os.makedirs(RUNTIME, exist_ok=True)
        with open(FFMPEG_LOG, "wb") as log:
            log.write((" ".join(cmd) + "\n").encode())
            log.flush()
            self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=log)
        self.started = time.time()
        write_json(RECORDING, {"pid": os.getpid(), "file": self.path, "started": self.started,
                               "region": list(rect), "audio": opts.audio})
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, self.proc.pid, self._exited)
        for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
            signal_add(GLib.PRIORITY_HIGH, sig, self.stop)
        if logical and opts.border:
            self.border = Border(logical)

    def stop(self, *_args):
        if not self.stopping and not self.exited:
            self.stopping = True
            try:
                self.proc.stdin.write(b"q")
                self.proc.stdin.flush()
                self.proc.stdin.close()
            except OSError:
                pass
            GLib.timeout_add_seconds(8, self._force, signal.SIGINT)
        return GLib.SOURCE_CONTINUE

    def _force(self, sig):
        if not self.exited:
            os.kill(self.proc.pid, sig)
            if sig != signal.SIGKILL:
                GLib.timeout_add_seconds(5, self._force, signal.SIGKILL)
        return GLib.SOURCE_REMOVE

    def _exited(self, _pid, status):
        self.exited = True
        remove(RECORDING)
        if self.border:
            self.border.destroy()
        duration = time.time() - self.started
        if os.path.exists(self.path) and os.path.getsize(self.path) > 1024:
            write_json(LAST, {"file": self.path, "kind": "video", "time": time.time()})
            mins, secs = divmod(int(round(duration)), 60)
            notify(self.opts, "Recording saved", f"{os.path.basename(self.path)} · {mins}:{secs:02d}",
                   path=self.path, icon="camera-video")
        else:
            remove(self.path)
            try:
                with open(FFMPEG_LOG, errors="replace") as f:
                    tail = f.read().strip().splitlines()[-3:]
            except OSError:
                tail = []
            notify(self.opts, "Recording failed", "\n".join(tail) or f"ffmpeg exited with status {status}",
                   icon="dialog-error", urgent=True)
        self.on_done()


# ---------------------------------------------------------------- overlay

def norm(x0, y0, x1, y1):
    return min(x0, x1), min(y0, y1), abs(x1 - x0), abs(y1 - y0)


def overlaps(a, b):
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


class Overlay(Gtk.Window):
    HANDLE = 5
    GRAB = 12

    def __init__(self, opts, on_done):
        super().__init__(type=Gtk.WindowType.POPUP)
        self.opts = opts
        self.on_done = on_done
        self.prefs = read_json(PREFS) or {}
        self.mode = opts.mode or self.prefs.get("mode", "image")
        self.delay = opts.delay
        self.audio = opts.audio
        self.pointer = opts.pointer
        self.counting = None
        self.drag = None
        self.recorder = None
        self.scale = scale_factor()

        x0, y0, w, h = screen_bounds()
        self.origin = (x0, y0)
        self.size = (w, h)
        self.mons = [(g.x - x0, g.y - y0, g.width, g.height) for g in (m.get_geometry() for m in monitors())]
        self.move(x0, y0)
        self.set_default_size(w, h)
        self.resize(w, h)
        self.set_app_paintable(True)

        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        self.backdrop = None
        if visual is not None and screen.is_composited():
            self.set_visual(visual)
        else:
            self.backdrop = Gdk.pixbuf_get_from_window(Gdk.get_default_root_window(), x0, y0, w, h)

        self.sel = None
        last = self.prefs.get("region")
        if opts.remember and last and len(last) == 4:
            lx, ly, lw, lh = last
            if lw > 4 and lh > 4 and lx >= 0 and ly >= 0 and lx + lw <= w and ly + lh <= h:
                self.sel = tuple(last)

        provider = Gtk.CssProvider()
        provider.load_from_data(CSS)
        Gtk.StyleContext.add_provider_for_screen(screen, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

        self.area = Gtk.DrawingArea()
        self.area.add_events(Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.BUTTON_RELEASE_MASK
                             | Gdk.EventMask.POINTER_MOTION_MASK)
        self.area.connect("draw", self._draw)
        self.area.connect("button-press-event", self._press)
        self.area.connect("button-release-event", self._release)
        self.area.connect("motion-notify-event", self._motion)

        overlay = Gtk.Overlay()
        overlay.add(self.area)
        self.toolbar = self._build_toolbar()
        overlay.add_overlay(self.toolbar)
        self.add(overlay)

        self.connect("key-press-event", self._key)
        self.connect("map-event", lambda *_: GLib.timeout_add(30, self._grab, 0))

        self.show_all()
        self._sync_toolbar()
        self.area.get_window().set_cursor(Gdk.Cursor.new_from_name(self.get_display(), "crosshair"))

    # -- toolbar

    def _button(self, label, icon, toggle=False, tip=None):
        btn = Gtk.ToggleButton() if toggle else Gtk.Button()
        box = Gtk.Box(spacing=6)
        img = Gtk.Image.new_from_icon_name(icon, Gtk.IconSize.BUTTON)
        box.pack_start(img, False, False, 0)
        lbl = Gtk.Label(label=label or "")
        if label is not None:
            box.pack_start(lbl, False, False, 0)
        btn.add(box)
        btn.set_can_focus(False)
        btn.img, btn.lbl = img, lbl
        if tip:
            btn.set_tooltip_text(tip)
        return btn

    def _build_toolbar(self):
        bar = Gtk.Box(spacing=2)
        bar.get_style_context().add_class("sj-toolbar")
        bar.set_halign(Gtk.Align.START)
        bar.set_valign(Gtk.Align.START)

        self.btn_image = self._button("Screenshot", "camera-photo-symbolic", True, "Take a screenshot (S)")
        self.btn_video = self._button("Record", "camera-video-symbolic", True, "Record a video (R)")
        self.btn_image.connect("clicked", lambda b: self._set_mode("image", b))
        self.btn_video.connect("clicked", lambda b: self._set_mode("video", b))

        full = self._button("Full screen", "view-fullscreen-symbolic", tip="Select the current screen (F)")
        full.connect("clicked", lambda *_: self._select_monitor())
        self.btn_all = self._button("All screens", "video-display-symbolic", tip="Select every screen (A)")
        self.btn_all.connect("clicked", lambda *_: self._select_all())

        self.btn_delay = self._button("", "alarm-symbolic", tip="Delay before capturing (D)")
        self.btn_delay.connect("clicked", lambda *_: self._cycle_delay())
        self.btn_pointer = self._button("Pointer", "input-mouse-symbolic", True, "Show the mouse pointer (P)")
        self.btn_pointer.set_active(self.pointer)
        self.btn_pointer.connect("toggled", lambda b: setattr(self, "pointer", b.get_active()))
        self.btn_audio = self._button("", AUDIO_ICONS["none"], tip="Audio source (M)")
        self.btn_audio.connect("clicked", lambda *_: self._cycle_audio())

        self.btn_go = self._button("Capture", "camera-photo-symbolic", tip="Enter")
        self.btn_go.get_style_context().add_class("sj-go")
        self.btn_go.connect("clicked", lambda *_: self.capture())
        close = self._button(None, "window-close-symbolic", tip="Cancel (Esc)")
        close.connect("clicked", lambda *_: self.cancel())

        for w in (self.btn_image, self.btn_video, Gtk.Separator(), full, self.btn_all, Gtk.Separator(),
                  self.btn_delay, self.btn_pointer, self.btn_audio, Gtk.Separator(), self.btn_go, close):
            bar.pack_start(w, False, False, 0)
        self.video_only = [self.btn_pointer, self.btn_audio]
        for w in self.video_only + [self.btn_all]:
            w.get_child().show_all()
            w.set_no_show_all(True)
        self.btn_all.set_visible(len(self.mons) > 1)
        return bar

    def _set_mode(self, mode, button=None):
        if getattr(self, "_syncing", False):
            return
        self.mode = mode
        self._sync_toolbar()

    def _cycle_delay(self):
        later = [d for d in DELAYS if d > self.delay]
        self.delay = later[0] if later else 0
        self._sync_toolbar()

    def _cycle_audio(self):
        keys = list(AUDIO_LABELS)
        self.audio = keys[(keys.index(self.audio) + 1) % len(keys)]
        self._sync_toolbar()

    def _sync_toolbar(self):
        self._syncing = True
        video = self.mode == "video"
        self.btn_image.set_active(not video)
        self.btn_video.set_active(video)
        self._syncing = False
        for w in self.video_only:
            w.set_visible(video)
        self.btn_delay.lbl.set_text(f"{self.delay} s" if self.delay else "No delay")
        self.btn_audio.lbl.set_text(AUDIO_LABELS[self.audio])
        self.btn_audio.img.set_from_icon_name(AUDIO_ICONS[self.audio], Gtk.IconSize.BUTTON)
        self.btn_go.lbl.set_text("Record" if video else "Capture")
        self.btn_go.img.set_from_icon_name("media-record-symbolic" if video else "camera-photo-symbolic",
                                           Gtk.IconSize.BUTTON)
        ctx = self.btn_go.get_style_context()
        (ctx.add_class if video else ctx.remove_class)("sj-rec")
        self.btn_go.set_sensitive(self.sel is not None)
        self._place_toolbar()
        self.area.queue_draw()

    def _place_toolbar(self):
        _, nat = self.toolbar.get_preferred_size()
        tw, th = nat.width, nat.height
        mx, my, mw, mh = self._monitor_for(self._focus_point())
        x = mx + (mw - tw) // 2
        rect = (x, my + mh - th - 48, tw, th)
        if self.sel and overlaps(rect, self.sel):
            rect = (x, my + 48, tw, th)
            if overlaps(rect, self.sel):
                rect = (x, my + mh - th - 12, tw, th)
        self.toolbar.set_margin_start(max(0, rect[0]))
        self.toolbar.set_margin_top(max(0, rect[1]))

    # -- geometry

    def _pointer(self):
        _, x, y = self.get_display().get_default_seat().get_pointer().get_position()
        return x - self.origin[0], y - self.origin[1]

    def _focus_point(self):
        if self.sel:
            x, y, w, h = self.sel
            return x + w / 2, y + h / 2
        return self._pointer()

    def _monitor_for(self, point):
        px, py = point
        for m in self.mons:
            if m[0] <= px < m[0] + m[2] and m[1] <= py < m[1] + m[3]:
                return m
        return self.mons[0]

    def _select_monitor(self, point=None):
        self.sel = self._monitor_for(point or self._pointer())
        self._sync_toolbar()

    def _select_all(self):
        self.sel = (0, 0, *self.size)
        self._sync_toolbar()

    def _handles(self):
        x, y, w, h = self.sel
        cx, cy, r, b = x + w / 2, y + h / 2, x + w, y + h
        return {"nw": (x, y), "n": (cx, y), "ne": (r, y), "e": (r, cy),
                "se": (r, b), "s": (cx, b), "sw": (x, b), "w": (x, cy)}

    def _hit(self, px, py):
        if not self.sel:
            return None
        for name, (hx, hy) in self._handles().items():
            if abs(px - hx) <= self.GRAB and abs(py - hy) <= self.GRAB:
                return name
        x, y, w, h = self.sel
        if x <= px <= x + w and y <= py <= y + h:
            return "move"
        return None

    def _clamp(self, x, y):
        return min(max(x, 0), self.size[0]), min(max(y, 0), self.size[1])

    # -- input

    def _press(self, _widget, event):
        if self.counting is not None:
            return True
        if event.button == 3:
            if self.sel:
                self.sel = None
                self._sync_toolbar()
            else:
                self.cancel()
            return True
        if event.button != 1:
            return True
        if event.type == Gdk.EventType._2BUTTON_PRESS and self._hit(event.x, event.y) == "move":
            self.capture()
            return True
        hit = self._hit(event.x, event.y)
        if hit == "move":
            self.drag = ("move", event.x - self.sel[0], event.y - self.sel[1])
        elif hit:
            x, y, w, h = self.sel
            self.drag = ("resize", hit, [x, y, x + w, y + h])
        else:
            self.drag = ("new", event.x, event.y)
            self.sel = None
        self.toolbar.set_visible(hit is not None)
        return True

    def _motion(self, _widget, event):
        if self.counting is not None:
            return True
        px, py = self._clamp(event.x, event.y)
        if not self.drag:
            names = {"move": "move", "nw": "nw-resize", "n": "n-resize", "ne": "ne-resize", "e": "e-resize",
                     "se": "se-resize", "s": "s-resize", "sw": "sw-resize", "w": "w-resize"}
            cursor = names.get(self._hit(event.x, event.y), "crosshair")
            if cursor != getattr(self, "_cursor", None):
                self._cursor = cursor
                self.area.get_window().set_cursor(Gdk.Cursor.new_from_name(self.get_display(), cursor))
            if not self.sel:
                self._place_toolbar()
            return True
        kind = self.drag[0]
        if kind == "new":
            self.sel = norm(self.drag[1], self.drag[2], px, py)
        elif kind == "move":
            w, h = self.sel[2], self.sel[3]
            x = min(max(px - self.drag[1], 0), self.size[0] - w)
            y = min(max(py - self.drag[2], 0), self.size[1] - h)
            self.sel = (x, y, w, h)
        else:
            handle, (l, t, r, b) = self.drag[1], self.drag[2]
            if "w" in handle:
                l = px
            if "e" in handle:
                r = px
            if "n" in handle:
                t = py
            if "s" in handle:
                b = py
            self.sel = norm(l, t, r, b)
        self.area.queue_draw()
        return True

    def _release(self, _widget, event):
        if event.button != 1 or not self.drag:
            return True
        if self.drag[0] == "new" and (not self.sel or (self.sel[2] < 4 and self.sel[3] < 4)):
            self._select_monitor((event.x, event.y))
        elif self.sel and (self.sel[2] < 2 or self.sel[3] < 2):
            self.sel = None
        if self.sel:
            self.sel = tuple(int(round(v)) for v in self.sel)
        self.drag = None
        self.toolbar.show()
        self._sync_toolbar()
        return True

    def _key(self, _widget, event):
        key = Gdk.keyval_name(event.keyval) or ""
        lower = key.lower()
        if key == "Escape":
            self.cancel()
        elif self.counting is not None:
            pass
        elif key in ("Return", "KP_Enter", "space"):
            self.capture()
        elif lower == "s":
            self._set_mode("image")
        elif lower in ("r", "v"):
            self._set_mode("video")
        elif lower == "f":
            self._select_monitor()
        elif lower == "a":
            self._select_all()
        elif lower == "d":
            self._cycle_delay()
        elif lower == "p" and self.mode == "video":
            self.btn_pointer.set_active(not self.btn_pointer.get_active())
        elif lower == "m" and self.mode == "video":
            self._cycle_audio()
        elif key in ("Left", "Right", "Up", "Down") and self.sel:
            step = 10 if event.state & Gdk.ModifierType.SHIFT_MASK else 1
            dx = {"Left": -step, "Right": step}.get(key, 0)
            dy = {"Up": -step, "Down": step}.get(key, 0)
            x, y, w, h = self.sel
            if event.state & Gdk.ModifierType.CONTROL_MASK:
                self.sel = (x, y, max(4, min(w + dx, self.size[0] - x)), max(4, min(h + dy, self.size[1] - y)))
            else:
                self.sel = (min(max(x + dx, 0), self.size[0] - w), min(max(y + dy, 0), self.size[1] - h), w, h)
            self._sync_toolbar()
        return True

    def _grab(self, attempt):
        seat = self.get_display().get_default_seat()
        status = seat.grab(self.get_window(), Gdk.SeatCapabilities.KEYBOARD, False, None, None, None, None)
        if status != Gdk.GrabStatus.SUCCESS and attempt < 40:
            GLib.timeout_add(50, self._grab, attempt + 1)
        return GLib.SOURCE_REMOVE

    def _ungrab(self):
        self.get_display().get_default_seat().ungrab()

    # -- drawing

    def _draw(self, _widget, cr):
        w, h = self.size
        cr.set_operator(cairo.OPERATOR_SOURCE)
        if self.backdrop:
            cr.save()
            cr.scale(w / self.backdrop.get_width(), h / self.backdrop.get_height())
            Gdk.cairo_set_source_pixbuf(cr, self.backdrop, 0, 0)
            cr.paint()
            cr.restore()
        else:
            cr.set_source_rgba(0, 0, 0, 0)
            cr.paint()
        cr.set_operator(cairo.OPERATOR_OVER)
        color = RECORD if self.mode == "video" else ACCENT

        if self.counting is not None:
            x, y, sw, sh = self.sel
            cr.set_source_rgba(*color, 0.9)
            cr.set_line_width(2)
            cr.set_dash([8, 6])
            cr.rectangle(x - 1, y - 1, sw + 2, sh + 2)
            cr.stroke()
            cr.set_dash([])
            cx, cy = x + sw / 2, y + sh / 2
            cr.arc(cx, cy, 56, 0, 6.2832)
            cr.set_source_rgba(0.1, 0.1, 0.1, 0.8)
            cr.fill()
            self._text(cr, str(self.counting), cx, cy, "Sans Bold 44", (1, 1, 1))
            return True

        cr.set_source_rgba(0, 0, 0, 0.45)
        cr.rectangle(0, 0, w, h)
        if self.sel:
            cr.rectangle(*self.sel)
            cr.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
        cr.fill()
        cr.set_fill_rule(cairo.FILL_RULE_WINDING)

        if not self.sel:
            mx, my, mw, mh = self._monitor_for(self._pointer())
            self._text(cr, "Drag to select an area · click for the whole screen",
                       mx + mw / 2, my + mh / 2 - 14, "Sans Bold 15", (1, 1, 1), pill=True)
            self._text(cr, "Enter to capture · Esc to cancel", mx + mw / 2, my + mh / 2 + 22,
                       "Sans 11", (0.85, 0.85, 0.85))
            return True

        x, y, sw, sh = self.sel
        cr.set_source_rgb(*color)
        cr.set_line_width(2)
        cr.rectangle(x - 1, y - 1, sw + 2, sh + 2)
        cr.stroke()
        if not self.drag or self.drag[0] != "move":
            for hx, hy in self._handles().values():
                cr.rectangle(hx - self.HANDLE, hy - self.HANDLE, 2 * self.HANDLE, 2 * self.HANDLE)
                cr.set_source_rgb(1, 1, 1)
                cr.fill_preserve()
                cr.set_source_rgb(*color)
                cr.set_line_width(1.5)
                cr.stroke()

        dw, dh = to_device(self.sel, self.scale, even=self.mode == "video")[2:]
        label = f"{dw} × {dh}"
        ly = y - 22 if y > 34 else y + 22
        self._text(cr, label, x + sw / 2, ly, "Sans Bold 10", (1, 1, 1), pill=True, bg=(*color, 0.95))
        return True

    def _text(self, cr, text, cx, cy, font, rgb, pill=False, bg=(0.1, 0.1, 0.1, 0.8)):
        layout = PangoCairo.create_layout(cr)
        layout.set_font_description(Pango.FontDescription.from_string(font))
        layout.set_text(text, -1)
        tw, th = (v / Pango.SCALE for v in layout.get_size())
        if pill:
            px, py = 14, 7
            x, y, w, h = cx - tw / 2 - px, cy - th / 2 - py, tw + 2 * px, th + 2 * py
            r = h / 2
            cr.new_sub_path()
            cr.arc(x + w - r, y + r, r, -1.5708, 1.5708)
            cr.arc(x + r, y + r, r, 1.5708, 4.7124)
            cr.close_path()
            cr.set_source_rgba(*bg)
            cr.fill()
        cr.move_to(cx - tw / 2, cy - th / 2)
        cr.set_source_rgb(*rgb)
        PangoCairo.show_layout(cr, layout)

    # -- actions

    def _save_prefs(self):
        self.prefs.update({"mode": self.mode, "region": list(self.sel) if self.sel else None})
        write_json(PREFS, self.prefs)

    def capture(self):
        if not self.sel or self.counting is not None:
            return
        self._save_prefs()
        if self.delay:
            self.counting = self.delay
            self.toolbar.hide()
            self.get_window().input_shape_combine_region(cairo.Region(), 0, 0)
            self.area.queue_draw()
            GLib.timeout_add(1000, self._tick)
        else:
            self._shoot()

    def _tick(self):
        if self.counting is None:
            return GLib.SOURCE_REMOVE
        self.counting -= 1
        if self.counting <= 0:
            self._shoot()
            return GLib.SOURCE_REMOVE
        self.area.queue_draw()
        return GLib.SOURCE_CONTINUE

    def _shoot(self):
        sel = self.sel
        logical = (sel[0] + self.origin[0], sel[1] + self.origin[1], sel[2], sel[3])
        device = to_device(logical, self.scale, even=self.mode == "video")
        self._ungrab()
        self.hide()
        # Give the compositor a moment to repaint without the overlay.
        GLib.timeout_add(220, self._after_hide, device, logical)

    def _after_hide(self, device, logical):
        if self.mode == "image":
            take_screenshot(self.opts, device)
            self.finish()
        else:
            self.opts.audio = self.audio
            self.opts.pointer = self.pointer
            full = device[2] >= self.size[0] * self.scale - 1 and device[3] >= self.size[1] * self.scale - 1
            self.recorder = Recorder(self.opts, self.on_done)
            self.recorder.start(device, None if full else logical)
            remove(OVERLAY_PID)
            self.destroy()
        return GLib.SOURCE_REMOVE

    def cancel(self):
        self.counting = None
        self._ungrab()
        self.finish()

    def finish(self):
        remove(OVERLAY_PID)
        self.destroy()
        self.on_done()


# ---------------------------------------------------------------- commands

def add_capture_options(p):
    p.add_argument("--image-dir", default="")
    p.add_argument("--video-dir", default="")
    p.add_argument("--format", choices=["mp4", "webm"], default="mp4")
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--audio", choices=list(AUDIO_LABELS), default="none")
    p.add_argument("--pointer", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--delay", type=int, default=0)
    p.add_argument("--clipboard", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--notify", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--border", action=argparse.BooleanOptionalAction, default=True,
                   help="frame the recorded area while recording")
    p.add_argument("--remember", action=argparse.BooleanOptionalAction, default=True,
                   help="preselect the last used area")


def prepare(opts):
    opts.image_dir = resolve_dir(opts.image_dir, GLib.UserDirectory.DIRECTORY_PICTURES, "Screenshots")
    opts.video_dir = resolve_dir(opts.video_dir, GLib.UserDirectory.DIRECTORY_VIDEOS, "Screencasts")
    opts.fps = min(max(opts.fps, 1), 120)
    opts.delay = min(max(opts.delay, 0), 60)
    if opts.delay not in DELAYS:
        DELAYS.append(opts.delay)
        DELAYS.sort()
    os.makedirs(RUNTIME, exist_ok=True)


def cmd_overlay(opts):
    if active_recording():
        print("A recording is in progress; stop it first.", file=sys.stderr)
        return 1
    other = read_json(OVERLAY_PID)
    if other and pid_alive(other.get("pid")):
        return 0
    prepare(opts)
    write_json(OVERLAY_PID, {"pid": os.getpid()})
    overlay = Overlay(opts, Gtk.main_quit)
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal_add(GLib.PRIORITY_HIGH, sig, lambda *_: overlay.recorder.stop() if overlay.recorder else overlay.cancel())
    Gtk.main()
    remove(OVERLAY_PID)
    return 0


def cmd_capture(opts):
    if opts.mode == "video" and active_recording():
        print("A recording is in progress; stop it first.", file=sys.stderr)
        return 1
    prepare(opts)
    x, y, w, h = screen_bounds()
    device = to_device((x, y, w, h), scale_factor(), even=opts.mode == "video")

    def go():
        if opts.mode == "image":
            take_screenshot(opts, device)
            Gtk.main_quit()
        else:
            Recorder(opts, Gtk.main_quit).start(device)
        return GLib.SOURCE_REMOVE

    GLib.timeout_add(max(opts.delay * 1000, 150), go)
    Gtk.main()
    return 0


def cmd_stop(_opts):
    rec = active_recording()
    if not rec:
        print("Not recording.", file=sys.stderr)
        return 1
    os.kill(int(rec["pid"]), signal.SIGTERM)
    return 0


def cmd_status(_opts):
    rec = active_recording()
    print(json.dumps({"recording": rec, "last": read_json(LAST)}, indent=2))
    return 0


def main():
    parser = argparse.ArgumentParser(description="Screenshots and screen recordings for Cinnamon.")
    sub = parser.add_subparsers(dest="cmd", required=True)
    overlay = sub.add_parser("overlay", help="select an area interactively")
    add_capture_options(overlay)
    overlay.add_argument("--mode", choices=["image", "video"], help="initial mode (default: last used)")
    capture = sub.add_parser("capture", help="capture the whole screen without the overlay")
    add_capture_options(capture)
    capture.add_argument("--mode", choices=["image", "video"], required=True)
    sub.add_parser("stop", help="stop the running recording")
    sub.add_parser("status", help="print the recording state as JSON")
    opts = parser.parse_args()

    if opts.cmd in ("overlay", "capture"):
        Gtk.init(None)
    return {"overlay": cmd_overlay, "capture": cmd_capture, "stop": cmd_stop, "status": cmd_status}[opts.cmd](opts)


if __name__ == "__main__":
    sys.exit(main())
