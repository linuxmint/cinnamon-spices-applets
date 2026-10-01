#!/usr/bin/env python3
"""
Snippitor GUI editor.

Copyright (C) 2026  FOSSCharlie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.

USE AT YOUR OWN RISK: this software is provided "as is", without
warranty of any kind, express or implied. See the LICENSE file
included with this applet for the full text.

---

Simple GTK3 editor for the Snippitor applet's trigger -> expansion list.
Saves to <this applet's folder>/data/expansions.json, which the background
daemon polls and reloads automatically.

Changes save automatically as you edit - there's no separate Save step.

Only one editor window is ever open at a time: this uses Gtk.Application
with a fixed application ID, so launching it again while a window is
already open just brings that existing window to the front instead of
opening a second one.
"""

import json
import os

import gi

gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, Gio, Gdk

CONFIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CONFIG_FILE = os.path.join(CONFIG_DIR, "expansions.json")

# One-time migration from the old ~/.config location used by earlier
# versions of this applet, so upgrading doesn't lose existing triggers.
_OLD_CONFIG_FILE = os.path.expanduser("~/.config/snippitor/expansions.json")

DEFAULT_EXPANSIONS = {
    "tel#": "01234567890",
}


def _restrict_permissions():
    """Data here can include personal info (phone numbers, addresses,
    etc, given what people naturally store trigger phrases for) - keep it
    private to the owner rather than the default umask, which is often
    world-readable (644/755) on many systems."""
    try:
        os.chmod(CONFIG_DIR, 0o700)
    except OSError:
        pass
    try:
        os.chmod(CONFIG_FILE, 0o600)
    except OSError:
        pass


def ensure_config():
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if not os.path.exists(CONFIG_FILE):
        if os.path.exists(_OLD_CONFIG_FILE):
            try:
                with open(_OLD_CONFIG_FILE, "r") as f:
                    old_data = json.load(f)
                if isinstance(old_data, dict) and old_data:
                    with open(CONFIG_FILE, "w") as f:
                        json.dump(old_data, f, indent=2)
                    _restrict_permissions()
                    return
            except Exception:
                pass
        with open(CONFIG_FILE, "w") as f:
            json.dump(DEFAULT_EXPANSIONS, f, indent=2)
    _restrict_permissions()


def load_expansions():
    ensure_config()
    try:
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return {
                k: v for k, v in data.items()
                if isinstance(k, str) and isinstance(v, str)
            }
    except Exception:
        pass
    return dict(DEFAULT_EXPANSIONS)


def save_expansions(data):
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=2)
    _restrict_permissions()


class SnippitorWindow(Gtk.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title="Snippitor - Edit Expansions")
        self.set_default_size(480, 400)
        self.set_border_width(10)

        # Removes the maximize button in effectively all window managers,
        # since a non-resizable window has nothing to maximize into.
        self.set_resizable(False)

        # Best-effort hint asking the window manager to only draw a plain
        # title bar and border - no minimize/maximize controls or system
        # menu. Most X11 window managers (including Cinnamon's Muffin)
        # respect this, but it isn't a universal guarantee the way
        # set_resizable() above is. Our own Close button below always
        # works regardless of what the window manager honors here.
        self.connect("realize", self._on_realize)

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        self.add(vbox)

        info = Gtk.Label(
            label="Type the trigger, then a space/enter/punctuation to fire it.\nChanges save automatically.",
            xalign=0,
        )
        vbox.pack_start(info, False, False, 0)

        # trigger, expansion
        self.store = Gtk.ListStore(str, str)
        for trigger, expansion in load_expansions().items():
            self.store.append([trigger, expansion])

        self.treeview = Gtk.TreeView(model=self.store)
        # GTK's default "type to search" popup on TreeView is more
        # confusing than useful here - it steals focus into a floating
        # search box the moment you type anything with the list focused
        # (not actually editing a cell), and since Snippitor's own daemon
        # runs system-wide, typing a real trigger into that popup gets
        # expanded right there too. Disable it entirely.
        self.treeview.set_enable_search(False)
        self.treeview.set_search_column(-1)

        renderer_trigger = Gtk.CellRendererText()
        renderer_trigger.set_property("editable", True)
        renderer_trigger.connect("edited", self.on_trigger_edited)
        renderer_trigger.connect("editing-started", self._on_editing_started)
        renderer_trigger.connect("editing-canceled", self._on_editing_ended)
        col_trigger = Gtk.TreeViewColumn("Trigger", renderer_trigger, text=0)
        col_trigger.set_min_width(140)
        self.treeview.append_column(col_trigger)

        renderer_expansion = Gtk.CellRendererText()
        renderer_expansion.set_property("editable", True)
        renderer_expansion.connect("edited", self.on_expansion_edited)
        renderer_expansion.connect("editing-started", self._on_editing_started)
        renderer_expansion.connect("editing-canceled", self._on_editing_ended)
        col_expansion = Gtk.TreeViewColumn("Expands to", renderer_expansion, text=1)
        col_expansion.set_expand(True)
        self.treeview.append_column(col_expansion)

        scroller = Gtk.ScrolledWindow()
        scroller.set_vexpand(True)
        scroller.add(self.treeview)
        vbox.pack_start(scroller, True, True, 0)

        button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        vbox.pack_start(button_box, False, False, 0)

        add_btn = Gtk.Button(label="Add")
        add_btn.connect("clicked", self.on_add)
        button_box.pack_start(add_btn, False, False, 0)

        remove_btn = Gtk.Button(label="Remove Selected")
        remove_btn.connect("clicked", self.on_remove)
        button_box.pack_start(remove_btn, False, False, 0)

        export_btn = Gtk.Button(label="Export...")
        export_btn.connect("clicked", self.on_export)
        button_box.pack_start(export_btn, False, False, 0)

        import_btn = Gtk.Button(label="Import...")
        import_btn.connect("clicked", self.on_import)
        button_box.pack_start(import_btn, False, False, 0)

        button_box.pack_start(Gtk.Box(), True, True, 0)  # spacer

        close_btn = Gtk.Button(label="Close")
        close_btn.connect("clicked", lambda w: self.close())
        button_box.pack_start(close_btn, False, False, 0)

        self.status = Gtk.Label(label="", xalign=0)
        vbox.pack_start(self.status, False, False, 0)

        self._active_editable = None
        self.connect("delete-event", self._on_delete_event)

        self.show_all()

    def _on_editing_started(self, renderer, editable, path):
        self._active_editable = editable

    def _on_editing_ended(self, renderer):
        self._active_editable = None

    def _on_delete_event(self, widget, event):
        # If a cell is still being actively edited (typed into but not yet
        # committed via Enter/Tab/clicking away) when the window is closed,
        # force that edit to commit first so it isn't silently lost.
        if self._active_editable is not None:
            try:
                self._active_editable.editing_done()
            except Exception:
                pass
        return False  # allow the window to close normally

    def _on_realize(self, widget):
        gdkwin = self.get_window()
        if gdkwin is not None:
            try:
                gdkwin.set_decorations(Gdk.WMDecoration.TITLE | Gdk.WMDecoration.BORDER)
            except Exception:
                pass

    def _save(self):
        data = {}
        for row in self.store:
            trigger = row[0].strip()
            expansion = row[1]
            if trigger:
                data[trigger] = expansion
        save_expansions(data)
        self.status.set_text("Saved automatically.")

    def on_trigger_edited(self, widget, path, text):
        new_trigger = text.strip()
        for i, row in enumerate(self.store):
            if str(i) != path and row[0].strip() == new_trigger and new_trigger != "":
                self.status.set_text(
                    "'{}' is already used by another row - not changed.".format(new_trigger)
                )
                return
        self.store[path][0] = text
        self._save()

    def on_expansion_edited(self, widget, path, text):
        self.store[path][1] = text
        self._save()

    def on_add(self, widget):
        existing_triggers = {row[0] for row in self.store}
        candidate = "new_trigger"
        n = 2
        while candidate in existing_triggers:
            candidate = "new_trigger_{}".format(n)
            n += 1
        self.store.append([candidate, "new expansion"])
        self._save()

    def on_remove(self, widget):
        selection = self.treeview.get_selection()
        model, treeiter = selection.get_selected()
        if treeiter is not None:
            model.remove(treeiter)
            self._save()

    def on_export(self, widget):
        dialog = Gtk.FileChooserDialog(
            title="Export Expansions",
            parent=self,
            action=Gtk.FileChooserAction.SAVE,
        )
        dialog.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            Gtk.STOCK_SAVE, Gtk.ResponseType.OK,
        )
        dialog.set_current_name("snippitor-expansions.json")
        dialog.set_do_overwrite_confirmation(True)

        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            path = dialog.get_filename()
            data = {}
            for row in self.store:
                trigger = row[0].strip()
                if trigger:
                    data[trigger] = row[1]
            try:
                with open(path, "w") as f:
                    json.dump(data, f, indent=2)
                try:
                    os.chmod(path, 0o600)
                except OSError:
                    pass
                self.status.set_text("Exported to " + path)
            except Exception as e:
                self.status.set_text("Export failed: " + str(e))
        dialog.destroy()

    def on_import(self, widget):
        dialog = Gtk.FileChooserDialog(
            title="Import Expansions",
            parent=self,
            action=Gtk.FileChooserAction.OPEN,
        )
        dialog.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            Gtk.STOCK_OPEN, Gtk.ResponseType.OK,
        )

        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            path = dialog.get_filename()
            try:
                with open(path, "r") as f:
                    imported = json.load(f)
                if not isinstance(imported, dict):
                    raise ValueError("file does not contain a trigger list")

                # Merge into the current list: existing rows for the same
                # trigger get updated in place, new triggers are appended -
                # nothing already configured is silently discarded.
                existing_rows = {row[0]: row.iter for row in self.store}
                added, updated, skipped = 0, 0, 0
                for trigger, expansion in imported.items():
                    if not isinstance(trigger, str) or not isinstance(expansion, str):
                        # Malformed entry (e.g. a nested object or number
                        # instead of plain text) - skip rather than
                        # importing something that could later break
                        # expansion, and don't silently coerce it either.
                        skipped += 1
                        continue
                    if trigger in existing_rows:
                        self.store[existing_rows[trigger]][1] = expansion
                        updated += 1
                    else:
                        self.store.append([trigger, expansion])
                        added += 1
                self._save()
                status = "Imported: {} added, {} updated.".format(added, updated)
                if skipped:
                    status += " {} skipped (not plain text).".format(skipped)
                self.status.set_text(status)
            except Exception as e:
                self.status.set_text("Import failed: " + str(e))
        dialog.destroy()


class SnippitorGuiApp(Gtk.Application):
    def __init__(self):
        super().__init__(
            application_id="org.fosscharlie.snippitor.editor",
            flags=Gio.ApplicationFlags.FLAGS_NONE,
        )
        self.window = None

    def do_activate(self):
        # Gtk.Application registers this application_id with the session
        # (over D-Bus). If an instance is already running, launching this
        # script again doesn't create a new process's window at all - it
        # just re-triggers do_activate on the EXISTING instance, which
        # re-presents the same window. That's what enforces "only one
        # editor window at a time".
        if not self.window:
            self.window = SnippitorWindow(self)
        self.window.present()


if __name__ == "__main__":
    app = SnippitorGuiApp()
    app.run(None)
