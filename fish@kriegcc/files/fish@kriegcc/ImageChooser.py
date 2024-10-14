#!/usr/bin/python3
from typing import Dict, Any
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, GLib, GdkPixbuf
from xapp.SettingsWidgets import SettingsWidget
from xapp.GSettingsWidgets import PXGSettingsBackend

# TODO: Maybe automatically detect proper size based on box's dimensions?
IMAGE_PREVIEW_SIZE = 256 # preview in settings window (max width or height in px)
IMAGE_CHOOSER_PREVIEW_SIZE = 128 # preview in dialog (max width or height in px)

# The image chooser setting widget is like the file chooser but allows only to select images.
# Furthermore, it has a preview of the selected file inside the dialog itself as well as above the chooser button.
class ImageChooser(SettingsWidget):
    bind_dir = None

    def __init__(self, info: Dict[str, Any], key: str, settings: Gio.Settings):
        SettingsWidget.__init__(self)

        self.info: Dict[str, Any] = info # value of the key (json object)
        self.key: str = key # key in settings-schema.json (here: keyAnimationImageCustomWidget)
        self.settings: Gio.Settings = settings # entire settings object

        tooltip: str = info["tooltip"]
        image_filename: str = self.settings.get_value(self.key) # shouldn't be the return type actually a "GLib.Variant"?
    
        # Layout:
        # main_container (vertical box)
        #   preview_image_container (horizontal box)
        #       preview_image
        #   image_chooser_container (horizontal box)
        #       image_label
        #       image_chooser

        # -------------------------------------------------------------------------------------------------------
        # preview_image_container
        # -------------------------------------------------------------------------------------------------------
        preview_image_container = Gtk.Box(spacing=6)

        # preview_image
        preview_image = Gtk.Image()
        pixbuf = self._create_pixbuf_from_file(image_filename, IMAGE_PREVIEW_SIZE)
        preview_image.set_from_pixbuf(pixbuf)

        preview_image_container.pack_start(preview_image, expand=False, fill=False, padding=0)
        # -------------------------------------------------------------------------------------------------------


        # -------------------------------------------------------------------------------------------------------
        # image_chooser_container
        # -------------------------------------------------------------------------------------------------------
        image_chooser_container = Gtk.Box(spacing=6)
        
        # label
        image_label = Gtk.Label(_("File"))
        image_chooser_container.pack_start(image_label, expand=False, fill=False, padding=0)
        
        # image chooser
        image_chooser = Gtk.FileChooserButton.new(
            title=_("Select an animation"), 
            action=Gtk.FileChooserAction.OPEN
        )
        # allow only images
        filter = Gtk.FileFilter()
        filter.set_name(_("Images"))
        filter.add_pixbuf_formats()
        image_chooser.add_filter(filter)
        image_chooser.set_filter(filter)
        # image_chooser_preview -> image preview inside the file chooser dialog on right side
        image_chooser_preview = Gtk.Image.new()
        image_chooser.set_preview_widget(image_chooser_preview)
        image_chooser.connect("update-preview", self._on_chooser_preview_update, image_chooser_preview)
        # callback on selecting a new file
        image_chooser.set_filename(image_filename)
        image_chooser.connect("selection-changed", self._on_image_value_changed, preview_image)      
        image_chooser_container.pack_end(image_chooser, expand=False, fill=False, padding=0)
        # -------------------------------------------------------------------------------------------------------


        # -------------------------------------------------------------------------------------------------------
        # main_container
        # -------------------------------------------------------------------------------------------------------
        main_container = Gtk.Box(visible=True, can_focus=True, orientation=Gtk.Orientation.VERTICAL, spacing=6)
        main_container.pack_start(preview_image_container, expand=True, fill=True, padding=0)
        main_container.pack_start(image_chooser_container, expand=True, fill=True, padding=0)
        main_container.set_tooltip_text(tooltip)
        # -------------------------------------------------------------------------------------------------------

        self.pack_start(main_container, expand=True, fill=True, padding=0)

    
    def _on_chooser_preview_update(self, image_chooser: Gtk.FileChooserButton, image_chooser_preview: Gtk.Image) -> None:
        filename = image_chooser.get_preview_filename()
        if filename is None:
            return
        
        # update preview inside the dialog
        pixbuf = self._create_pixbuf_from_file(filename, IMAGE_CHOOSER_PREVIEW_SIZE)
        have_preview = pixbuf is not None

        image_chooser_preview.set_from_pixbuf(pixbuf)
        image_chooser.set_preview_widget_active(have_preview)
        

    # arg "preview_image" is a reference to the Gtk.Image element in the settings window
    def _on_image_value_changed(self, image_chooser: Gtk.FileChooserButton, preview_image: Gtk.Image) -> None:
        filename = image_chooser.get_filename()
        if filename is None:
            return

        # update preview in settings window
        pixbuf = self._create_pixbuf_from_file(filename, IMAGE_PREVIEW_SIZE)
        preview_image.set_from_pixbuf(pixbuf)

        # actually apply image path (js applet code is handling it through a binding)
        self.settings.set_value(self.key, filename)


    # using pixbuf enables to limit the dimensions of the image shown in the preview
    # without pixbuf but original size: Gtk.Image().set_from_file(filename)
    def _create_pixbuf_from_file(self, filename: str, size: int) -> GdkPixbuf.Pixbuf | None:
        try:
            # Scale up the image on HiDPI screens. It does not support fractional scaling.
            # See method get_scale_factor on GTK.Widget.
            scale_factor: int = self.get_scale_factor()
            return GdkPixbuf.Pixbuf.new_from_file_at_size(filename, size * scale_factor, size * scale_factor)
        except GLib.Error as e:
            print("Could not load image file '%s': %s" % (filename, e.message))
        return None


# # TODO: does not work! Is JSONSettingsBackend needed instead?
# # See: cinnamon repo, JsonSettingsWidget.py 
# #
# # Make widget available to "backend" such that in applet code, a callback can be registered 
# # for the settings key just like for any other widget types.
# # settings.bind(key, internalProp, cb)
# # See: python3-xapp repo, GSettingsWidget.py
# #      cinnamon repo, SettingsWidget.py
# # settings_objects = {}
# def g_settings_factory(subclass):
#     class NewClass(globals()[subclass], PXGSettingsBackend):
#         def __init__(self, label, schema, key, *args, **kwargs):
#             self.key = key
#             if schema not in settings_objects:
#                 settings_objects[schema] = Gio.Settings.new(schema)
#             self.settings = settings_objects[schema]

#             if "map_get" in kwargs:
#                 self.map_get = kwargs["map_get"]
#                 del kwargs["map_get"]
#             if "map_set" in kwargs:
#                 self.map_set = kwargs["map_set"]
#                 del kwargs["map_set"]

#             super(NewClass, self).__init__(label, *args, **kwargs)
#             self.bind_settings()
#     return NewClass

# globals()["GSettingsImageChooser"] = g_settings_factory("ImageChooser")