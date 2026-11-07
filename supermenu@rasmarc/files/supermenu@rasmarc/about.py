#!/usr/bin/python3
"""Use Cinnamon's About dialog with SuperMenu's theme-colored SVG logo.

Copyright (C) 2026 rasmarc
SPDX-License-Identifier: GPL-2.0-or-later
"""

import json
from pathlib import Path
import runpy


def main():
    # Reuse the installed dialog and its metadata handling; only replace its
    # fixed PNG logo with a symbolic icon rendered by GTK in the text color.
    native = runpy.run_path("/usr/bin/xlet-about-dialog", run_name="supermenu_native_about")
    Gtk = native["Gtk"]

    class AboutDialog(native["AboutDialog"]):
        def set_icon(self):
            super().set_icon()
            Gtk.IconTheme.get_default().append_search_path(self.metadata["path"])
            self.set_logo_icon_name("supermenu-logo-about-symbolic")
            # AboutDialog otherwise expands scalable named logos to 128 px.
            self.get_template_child(Gtk.AboutDialog, "logo_image").set_pixel_size(48)

    root = Path(__file__).resolve().parent
    with (root / "metadata.json").open(encoding="utf-8") as source:
        metadata = json.load(source)
    metadata.update(path=str(root), type="applets")
    AboutDialog(metadata, "applets")
    Gtk.main()


if __name__ == "__main__":
    main()
