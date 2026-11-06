#!/usr/bin/python3
import os
import traceback
from typing import Dict, Any

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gio, Gtk, GdkPixbuf

try:
    from xapp.SettingsWidgets import SettingsWidget
except Exception:
    class SettingsWidget(Gtk.Box):
        def __init__(self, *args, **kwargs):
            Gtk.Box.__init__(self, orientation=Gtk.Orientation.VERTICAL, spacing=6)

IMAGE_PREVIEW_SIZE = 256
IMAGE_CHOOSER_PREVIEW_SIZE = 128


class ImageChooser(SettingsWidget):
    def __init__(self, info: Dict[str, Any], key: str, settings: Gio.Settings):
        try:
            super().__init__()
        except TypeError:
            Gtk.Box.__init__(self, orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.info = info or {}
        self.key = key
        self.settings = settings
        try:
            self._build_ui()
        except Exception as exc:
            self._show_error(exc)

    def _show_error(self, exc: Exception):
        try:
            box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            title = Gtk.Label(label="Le sélecteur d'image n'a pas pu se charger.", xalign=0)
            title.set_line_wrap(True)
            detail = Gtk.Label(label=str(exc), xalign=0)
            detail.set_line_wrap(True)
            box.pack_start(title, False, False, 0)
            box.pack_start(detail, False, False, 0)
            self.pack_start(box, True, True, 0)
            print("[creature@AIapplet] ImageChooser error:")
            traceback.print_exc()
        except Exception:
            pass

    def _build_ui(self):
        image_filename = self._safe_get_value(self.settings.get_value(self.key))
        image_filename = os.path.expanduser(image_filename) if image_filename else ""

        preview_image_container = Gtk.Box(spacing=6)
        self.preview_image = Gtk.Image()
        pixbuf = self._create_pixbuf_from_file(image_filename, IMAGE_PREVIEW_SIZE)
        if pixbuf is not None:
            self.preview_image.set_from_pixbuf(pixbuf)
        preview_image_container.pack_start(self.preview_image, False, False, 0)

        chooser_container = Gtk.Box(spacing=6)
        chooser_label = Gtk.Label(label="Fichier", xalign=0)
        chooser_container.pack_start(chooser_label, False, False, 0)

        self.image_chooser = Gtk.FileChooserButton.new(title="Sélectionner une animation", action=Gtk.FileChooserAction.OPEN)
        file_filter = Gtk.FileFilter()
        file_filter.set_name("Images")
        file_filter.add_pixbuf_formats()
        self.image_chooser.add_filter(file_filter)
        self.image_chooser.set_filter(file_filter)

        chooser_preview = Gtk.Image.new()
        self.image_chooser.set_preview_widget(chooser_preview)
        self.image_chooser.connect("update-preview", self._on_chooser_preview_update, chooser_preview)
        if image_filename and os.path.exists(image_filename):
            self.image_chooser.set_filename(image_filename)
        self.image_chooser.connect("selection-changed", self._on_image_value_changed)
        chooser_container.pack_end(self.image_chooser, False, False, 0)

        main_container = Gtk.Box(visible=True, can_focus=True, orientation=Gtk.Orientation.VERTICAL, spacing=6)
        main_container.pack_start(preview_image_container, True, True, 0)
        main_container.pack_start(chooser_container, True, True, 0)
        main_container.set_tooltip_text(self.info.get("tooltip", ""))
        self.pack_start(main_container, True, True, 0)

    def _safe_get_value(self, value):
        return value.unpack() if hasattr(value, "unpack") else value

    def _set_string_value(self, value: str):
        value = "" if value is None else str(value)
        if hasattr(self.settings, "set_string"):
            self.settings.set_string(self.key, value)
        else:
            self.settings.set_value(self.key, value)

    def _on_chooser_preview_update(self, image_chooser, chooser_preview):
        filename = image_chooser.get_preview_filename()
        pixbuf = self._create_pixbuf_from_file(filename, IMAGE_CHOOSER_PREVIEW_SIZE) if filename else None
        chooser_preview.set_from_pixbuf(pixbuf)
        image_chooser.set_preview_widget_active(pixbuf is not None)

    def _on_image_value_changed(self, image_chooser):
        filename = image_chooser.get_filename()
        if not filename:
            return
        pixbuf = self._create_pixbuf_from_file(filename, IMAGE_PREVIEW_SIZE)
        if pixbuf is not None:
            self.preview_image.set_from_pixbuf(pixbuf)
        self._set_string_value(filename)

    def _create_pixbuf_from_file(self, filename: str, size: int):
        try:
            if not filename or not os.path.exists(filename):
                return None
            try:
                scale_factor = self.get_scale_factor()
            except Exception:
                scale_factor = 1
            if scale_factor < 1:
                scale_factor = 1
            return GdkPixbuf.Pixbuf.new_from_file_at_scale(filename, size * scale_factor, size * scale_factor, True)
        except Exception as e:
            print(f"[creature@AIapplet] Erreur chargement image {filename}: {e}")
            return None
