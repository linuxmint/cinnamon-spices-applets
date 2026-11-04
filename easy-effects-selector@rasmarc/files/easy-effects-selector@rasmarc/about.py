#!/usr/bin/python3
"""Native Cinnamon About dialog with a theme-colored applet logo."""

import json
from pathlib import Path
import runpy


LOGO_NAME = "easy-effects-selector-logo-about-symbolic"
XLET_TYPE = "applets"


def main():
    # Reuse the installed dialog for title, translations, version and credits.
    native = runpy.run_path("/usr/bin/xlet-about-dialog", run_name="app_native_about")
    Gtk = native["Gtk"]

    class AboutDialog(native["AboutDialog"]):
        def set_icon(self):
            super().set_icon()
            Gtk.IconTheme.get_default().append_search_path(self.metadata["path"])
            self.set_logo_icon_name(LOGO_NAME)
            # GTK 3 otherwise expands scalable named About logos to 128 px.
            self.get_template_child(Gtk.AboutDialog, "logo_image").set_pixel_size(48)

    root = Path(__file__).resolve().parent
    with (root / "metadata.json").open(encoding="utf-8") as source:
        metadata = json.load(source)
    metadata.update(path=str(root), type=XLET_TYPE)
    AboutDialog(metadata, XLET_TYPE)
    Gtk.main()


if __name__ == "__main__":
    main()
