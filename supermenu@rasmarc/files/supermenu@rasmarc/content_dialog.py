#!/usr/bin/env python3
"""Native file chooser for settings and the menu's template action.

Copyright (C) 2026 rasmarc
SPDX-License-Identifier: GPL-2.0-or-later
"""

import json
import gettext
import sys
from pathlib import Path

_ = gettext.translation("supermenu@rasmarc",
    str(Path.home() / ".local/share/locale"), fallback=True).gettext

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gio, GLib, Gtk


def choose_content_file(parent=None, exporting=False, replacing=False, folder=None, accept_label=None):
    dialog = Gtk.FileChooserDialog(title=_("Back up content") if exporting else _("Load content"),
        transient_for=parent, modal=True, destroy_with_parent=True,
        action=Gtk.FileChooserAction.SAVE if exporting else Gtk.FileChooserAction.OPEN)
    try:
        confirm = accept_label or (_("Save") if exporting else _("Replace") if replacing else _("Import"))
        dialog.add_buttons(_("Cancel"), Gtk.ResponseType.CANCEL, confirm, Gtk.ResponseType.OK)
        file_filter = Gtk.FileFilter()
        file_filter.set_name(_("Supported files (*.json)"))
        file_filter.add_pattern("*.json")
        dialog.add_filter(file_filter)
        all_files = Gtk.FileFilter()
        all_files.set_name(_("All files (*)"))
        all_files.add_pattern("*")
        dialog.add_filter(all_files)
        dialog.set_filter(file_filter)
        dialog.set_current_folder(folder or GLib.get_home_dir())
        if exporting:
            dialog.set_current_name("SuperMenu.json")
            dialog.set_do_overwrite_confirmation(True)
        elif parent is None:
            dialog.set_position(Gtk.WindowPosition.CENTER)
        while True:
            response = dialog.run()
            path = dialog.get_filename() if response == Gtk.ResponseType.OK else None
            if not path:
                return None
            if exporting and not path.lower().endswith(".json"):
                path += ".json"
                dialog.set_filename(path)
                if Gio.file_new_for_path(path).query_exists(None):
                    continue
            return path
    finally:
        dialog.destroy()


def main():
    try:
        GLib.set_prgname("supermenu-content-dialog")
        Gtk.Window.set_default_icon_name("folder")
        replacing = "--replace" in sys.argv[1:]
        path = choose_content_file(replacing=replacing,
            folder=str(Path(__file__).resolve().parent / "templates"),
            accept_label=None if replacing else _("Load"))
        reply = {"ok": True, "path": path} if path else {"ok": True, "cancelled": True}
    except Exception as error:
        reply = {"ok": False, "message": str(error)}
    print(json.dumps(reply, ensure_ascii=False))


if __name__ == "__main__":
    main()
