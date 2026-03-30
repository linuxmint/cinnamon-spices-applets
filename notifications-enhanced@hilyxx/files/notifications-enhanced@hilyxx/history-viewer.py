#!/usr/bin/env python3
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Pango, GLib
import os, json, sys
from datetime import datetime

PAGE_SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 20
HISTORY_DIR = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser("~/.notifications-enhanced-applet/history")
APPLET_DIR = os.path.dirname(os.path.abspath(__file__))


def load_all():
    items = []
    if not os.path.isdir(HISTORY_DIR):
        return items
    for fname in sorted(os.listdir(HISTORY_DIR), reverse=True):
        if not fname.endswith(".jsonl"):
            continue
        path = os.path.join(HISTORY_DIR, fname)
        with open(path, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip()]
        for line in reversed(lines):
            try:
                items.append(json.loads(line))
            except Exception:
                pass
    return items


def fmt_time(ts):
    try:
        return datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ""


class NotificationRow(Gtk.ListBoxRow):
    def __init__(self, item):
        super().__init__()

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        box.set_margin_top(10)
        box.set_margin_bottom(10)
        box.set_margin_start(14)
        box.set_margin_end(14)

        # Title + app
        header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        title_text = GLib.markup_escape_text(item.get("title") or "(no title)")
        title = Gtk.Label()
        title.set_markup(f"<b>{title_text}</b>")
        title.set_halign(Gtk.Align.START)
        header.pack_start(title, False, False, 0)

        if item.get("app"):
            app_text = GLib.markup_escape_text(item["app"])
            app_label = Gtk.Label()
            app_label.set_markup(f"<i><span foreground='#888'>— {app_text}</span></i>")
            header.pack_start(app_label, False, False, 0)

        box.pack_start(header, False, False, 0)

        # Body
        if item.get("body"):
            body = Gtk.Label(label=item["body"])
            body.set_halign(Gtk.Align.START)
            body.set_xalign(0)
            body.set_line_wrap(True)
            body.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR)
            box.pack_start(body, False, False, 0)

        # Timestamp
        time_label = Gtk.Label(label=fmt_time(item.get("ts", 0)))
        time_label.set_halign(Gtk.Align.START)
        time_label.get_style_context().add_class("dim-label")
        box.pack_start(time_label, False, False, 0)

        self.add(box)


class HistoryWindow(Gtk.Window):
    def __init__(self):
        super().__init__(title="Notification History")
        self.set_default_size(620, 700)
        self.connect("destroy", Gtk.main_quit)
        icon_path = os.path.join(APPLET_DIR, "icon.svg")
        if os.path.exists(icon_path):
            self.set_icon_from_file(icon_path)

        self.items = load_all()
        self.total = len(self.items)
        self.page = 0
        self.total_pages = max(1, (self.total + PAGE_SIZE - 1) // PAGE_SIZE)

        self._build_ui()
        self._render()
        self.show_all()

    def _build_ui(self):
        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.add(outer)

        scroll = Gtk.ScrolledWindow()
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        self.listbox = Gtk.ListBox()
        self.listbox.set_selection_mode(Gtk.SelectionMode.NONE)
        scroll.add(self.listbox)
        outer.pack_start(scroll, True, True, 0)

        outer.pack_start(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL), False, False, 0)

        bar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        bar.set_margin_top(8)
        bar.set_margin_bottom(8)
        bar.set_margin_start(12)
        bar.set_margin_end(12)

        self.prev_btn = Gtk.Button(label="◀  Previous")
        self.prev_btn.connect("clicked", lambda _: self._go(-1))
        bar.pack_start(self.prev_btn, False, False, 0)

        self.page_label = Gtk.Label()
        bar.set_center_widget(self.page_label)

        self.next_btn = Gtk.Button(label="Next  ▶")
        self.next_btn.connect("clicked", lambda _: self._go(1))
        bar.pack_end(self.next_btn, False, False, 0)

        outer.pack_start(bar, False, False, 0)

    def _render(self):
        for row in self.listbox.get_children():
            self.listbox.remove(row)

        page_items = self.items[self.page * PAGE_SIZE:(self.page + 1) * PAGE_SIZE]

        if not page_items:
            row = Gtk.ListBoxRow()
            lbl = Gtk.Label(label="No notifications in history.")
            lbl.set_margin_top(24)
            lbl.set_margin_bottom(24)
            row.add(lbl)
            self.listbox.add(row)
        else:
            for item in page_items:
                self.listbox.add(NotificationRow(item))

        self.listbox.show_all()

        if self.total_pages > 1:
            self.page_label.set_text(f"Page {self.page + 1} of {self.total_pages}  ({self.total} total)")
        else:
            self.page_label.set_text(f"{self.total} notification{'s' if self.total != 1 else ''}")

        self.prev_btn.set_sensitive(self.page > 0)
        self.next_btn.set_sensitive(self.page < self.total_pages - 1)

    def _go(self, delta):
        self.page = max(0, min(self.total_pages - 1, self.page + delta))
        self._render()


HistoryWindow()
Gtk.main()
