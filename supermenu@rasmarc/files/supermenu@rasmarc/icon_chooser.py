#!/usr/bin/env python3
"""Cinnamon's native XApp symbol/file chooser, isolated from the shell process.

Copyright (C) 2026 rasmarc
SPDX-License-Identifier: GPL-2.0-or-later
"""

import json
import gettext
import sys
from pathlib import Path

_ = gettext.translation("supermenu@rasmarc",
    str(Path.home() / ".local/share/locale"), fallback=True).gettext


def choose_icon(request):
    import gi
    gi.require_version("Gtk", "3.0")
    gi.require_version("XApp", "1.0")
    from gi.repository import GLib, Gtk, XApp

    GLib.set_prgname("supermenu-icon-chooser")
    Gtk.Window.set_default_icon_name("image-x-generic")
    dialog = XApp.IconChooserDialog()
    dialog.set_title(_("Choose an icon – SuperMenu"))
    dialog.set_position(Gtk.WindowPosition.CENTER)
    dialog.set_default_icon(request["default"])
    try:
        response = dialog.run_with_icon(request["current"])
        if response != Gtk.ResponseType.OK:
            return {"ok": True, "cancelled": True}
        icon = dialog.get_icon_string()
        if not isinstance(icon, str) or not icon.strip():
            raise ValueError(_("No icon selected."))
        return {"ok": True, "icon": icon}
    finally:
        dialog.destroy()


def main():
    try:
        request = json.load(sys.stdin)
        if not isinstance(request, dict) or any(not isinstance(request.get(key), str) or
                not request[key] or "\0" in request[key] for key in ("current", "default")):
            raise ValueError(_("Invalid icon selection."))
        result = choose_icon(request)
    except Exception as error:
        result = {"ok": False, "message": _("Could not open the icon chooser: %s") % str(error)}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
