#!/usr/bin/python3

import cgi
import json
import subprocess
import os.path
import sys
import gettext
import gi

gi.require_version("Gtk", "3.0")

from gi.repository import Gtk, GLib, Gio, GObject, GdkPixbuf


# The application ID is also used as the daemon name.
APPLICATION_ID = "org.Cinnamon.Applets.WallChanger.Daemon"
SCHEMA_NAME = "org.cinnamon.applets.0dyseus@WallpaperChangerApplet"
SCHEMA_PATH = "/org/cinnamon/applets/0dyseus@WallpaperChangerApplet/"

CINNAMON_VERSION = GLib.getenv("CINNAMON_VERSION")
HOME = os.path.expanduser("~")
APPLET_DIR = os.path.dirname(os.path.abspath(__file__))
APPLET_UUID = str(os.path.basename(APPLET_DIR))
TRANSLATIONS = {}


def _(string):
    # check for a translation for this xlet
    if APPLET_UUID not in TRANSLATIONS:
        try:
            TRANSLATIONS[APPLET_UUID] = gettext.translation(
                APPLET_UUID, HOME + "/.local/share/locale").gettext
        except IOError:
            try:
                TRANSLATIONS[APPLET_UUID] = gettext.translation(
                    APPLET_UUID, "/usr/share/locale").gettext
            except IOError:
                TRANSLATIONS[APPLET_UUID] = None

    # do not translate white spaces
    if not string.strip():
        return string

    if TRANSLATIONS[APPLET_UUID]:
        result = TRANSLATIONS[APPLET_UUID](string)

        try:
            result = result.decode("utf-8")
        except:
            result = result

        if result != string:
            return result

    return gettext.gettext(string)


# TO TRANSLATORS: This is the applet name.
APPLET_NAME = _("Wallpaper Changer")


class Settings(object):

    """ Get settings values using gsettings """

    _settings = None

    def __new__(cls, *p, **k):
        """ Implementation of the borg pattern
        This way we make sure that all instances share the same state
        and that the schema is read from file only once.
        """
        if "_the_instance" not in cls.__dict__:
            cls._the_instance = object.__new__(cls)
        return cls._the_instance

    def set_settings(self, schema_name):
        """ Get settings values from corresponding schema file """

        # Try to get schema from local installation directory
        schemas_dir = "%s/schemas" % APPLET_DIR
        if os.path.isfile("%s/gschemas.compiled" % schemas_dir):
            schema_source = Gio.SettingsSchemaSource.new_from_directory(
                schemas_dir, Gio.SettingsSchemaSource.get_default(), False)
            schema = schema_source.lookup(schema_name, False)
            self._settings = Gio.Settings.new_full(schema, None, None)
        # Schema is installed system-wide
        else:
            self._settings = Gio.Settings.new(schema_name)

    def get_settings(self):
        return self._settings

    def settings_has_key(self, key):
        return key in self.get_settings().list_keys()


class BaseGrid(Gtk.Grid):

    def __init__(self, tooltip="", orientation=Gtk.Orientation.VERTICAL):
        Gtk.Grid.__init__(self)
        self.set_orientation(orientation)
        self.set_tooltip_text(tooltip)

    def set_spacing(self, col, row):
        self.set_column_spacing(col)
        self.set_row_spacing(row)


class SettingsLabel(Gtk.Label):

    def __init__(self, text=None, markup=None):
        Gtk.Label.__init__(self)
        if text:
            self.set_label(text)

        if markup:
            self.set_markup(markup)

        self.set_alignment(0.0, 0.5)
        # self.set_line_wrap(True)

    def set_label_text(self, text):
        self.set_label(text)

    def set_label_markup(self, markup):
        self.set_markup(markup)


class IconChooser(BaseGrid):

    ''' IconChooser widget '''

    def __init__(self, key, label, tooltip=""):
        BaseGrid.__init__(self, tooltip)
        self.set_spacing(10, 10)

        self._key = key
        valid, self.width, self.height = Gtk.icon_size_lookup(Gtk.IconSize.BUTTON)

        self.label = SettingsLabel(label)
        self.entry = Gtk.Entry()
        self.entry.set_property("hexpand", True)
        self.button = Gtk.Button()

        self.preview = Gtk.Image.new()
        self.button.set_image(self.preview)

        self.entry.set_text(Settings().get_settings().get_string(self._key))
        self.button.connect("clicked", self.on_button_pressed)
        self.handler = self.entry.connect("changed", self.set_icon)

        self.attach(self.label, 0, 1, 1, 1)
        self.attach(self.entry, 1, 1, 1, 1)
        self.attach(self.button, 2, 1, 1, 1)

        self.set_icon()

    def set_icon(self, *args):
        val = self.entry.get_text()
        if os.path.exists(val) and not os.path.isdir(val):
            img = GdkPixbuf.Pixbuf.new_from_file_at_size(val, self.width, self.height)
            self.preview.set_from_pixbuf(img)
        else:
            self.preview.set_from_icon_name(val, Gtk.IconSize.BUTTON)

        Settings().get_settings().set_string(self._key, val)

    def on_button_pressed(self, widget):
        dialog = Gtk.FileChooserDialog(title=_("Choose an Icon"),
                                       action=Gtk.FileChooserAction.OPEN,
                                       transient_for=self.get_toplevel(),
                                       buttons=(_("_Cancel"), Gtk.ResponseType.CANCEL,
                                                _("_Open"), Gtk.ResponseType.OK))

        filter_text = Gtk.FileFilter()
        filter_text.set_name(_("Image files"))
        filter_text.add_mime_type("image/*")
        dialog.add_filter(filter_text)

        preview = Gtk.Image()
        dialog.set_preview_widget(preview)
        dialog.connect("update-preview", self.update_icon_preview_cb, preview)

        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            filename = dialog.get_filename()
            self.entry.set_text(filename)
            Settings().get_settings().set_string(self._key, filename)

        dialog.destroy()

    def update_icon_preview_cb(self, dialog, preview):
        filename = dialog.get_preview_filename()
        dialog.set_preview_widget_active(False)
        if filename is not None:
            if os.path.isfile(filename):
                pixbuf = GdkPixbuf.Pixbuf.new_from_file(filename)
                if pixbuf is not None:
                    if pixbuf.get_width() > 128:
                        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(filename, 128, -1)
                    elif pixbuf.get_height() > 128:
                        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(filename, -1, 128)
                    preview.set_from_pixbuf(pixbuf)
                    dialog.set_preview_widget_active(True)


class Switch(BaseGrid):

    """ Switch widget """

    def __init__(self, key, label, tooltip=""):
        BaseGrid.__init__(self, tooltip=tooltip, orientation=Gtk.Orientation.HORIZONTAL)
        self.set_spacing(10, 10)
        self.set_border_width(5)
        self.set_margin_left(15)
        self.set_margin_right(15)

        self.key = key
        self.label = SettingsLabel(label)
        self.label.set_property("hexpand", True)
        self.label.set_property("halign", Gtk.Align.START)
        self.switch = Gtk.Switch()
        self.switch.set_property("halign", Gtk.Align.END)
        self.switch.set_active(Settings().get_settings().get_boolean(key))
        self.switch.connect("notify::active", self._switch_change)
        self.attach(self.label, 0, 0, 1, 1)
        self.attach(self.switch, 1, 0, 1, 1)

    def clicked(self, *args):
        self.switch.set_active(not self.switch.get_active())

    def _switch_change(self, widget, notice):
        Settings().get_settings().set_boolean(self.key, self.switch.get_active())


class SectionContainer(Gtk.Frame):

    def __init__(self, title, warning_message=None):
        Gtk.Frame.__init__(self)
        self.set_shadow_type(Gtk.ShadowType.IN)

        self.box = BaseGrid()
        self.box.set_border_width(0)
        self.box.set_property("margin", 0)
        self.box.set_spacing(0, 0)
        self.add(self.box)

        toolbar = Gtk.Toolbar()
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(toolbar), "cs-header")

        label = Gtk.Label()
        label.set_markup("<b>%s</b>" % title)
        title_holder = Gtk.ToolItem()
        title_holder.add(label)
        toolbar.add(title_holder)

        dummy = BaseGrid()
        dummy.set_property("hexpand", True)
        dummy.set_property("vexpand", False)
        dummy_holder = Gtk.ToolItem()
        dummy_holder.set_expand(True)
        dummy_holder.add(dummy)
        toolbar.add(dummy_holder)

        if warning_message is not None:
            # Using set_image on button adds an un-removable padding.
            # Setting the image as argument doesn't. ¬¬
            button = Gtk.Button(image=Gtk.Image.new_from_icon_name(
                "dialog-warning-symbolic", Gtk.IconSize.BUTTON))
            button.get_style_context().add_class("cinnamon-tweaks-section-warning-button")
            button.set_relief(Gtk.ReliefStyle.NONE)
            button.set_tooltip_text(_("Warnings related to this specific section"))
            button.connect("clicked", display_warning_message, title, warning_message)
            button_holder = Gtk.ToolItem()
            button_holder.add(button)
            toolbar.add(button_holder)

        self.box.attach(toolbar, 0, 0, 2, 1)

        self.need_separator = False

    def add_row(self, widget, col_pos, row_pos, col_span, row_span, vexpand=False):
        list_box = Gtk.ListBox()
        list_box.set_selection_mode(Gtk.SelectionMode.NONE)
        list_box.set_property("vexpand", vexpand)
        row = Gtk.ListBoxRow()
        row.add(widget)

        if self.need_separator:
            list_box.add(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

        if isinstance(widget, Switch):
            list_box.connect("row-activated", widget.clicked)

        list_box.add(row)

        self.box.attach(list_box, col_pos, row_pos, col_span, row_span)

        self.need_separator = True


class WallChangerPrefs(BaseGrid):

    def __init__(self):
        BaseGrid.__init__(self)
        self.set_spacing(0, 0)
        self.set_border_width(0)
        self.set_margin_left(0)
        self.set_margin_right(0)
        self._initializing = True
        self._settings = Settings().get_settings()

        # Init settings holders
        self._settingsKeybind = []

        self.stack = app.window.stack
        self.stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT)
        self.stack.set_transition_duration(150)
        self.stack.set_property("margin", 0)
        self.stack.set_property("expand", True)

        self._initProfiles()
        self._initKeyboard()
        self._initMisc()
        self._load_profiles()
        self.show_all()
        self._initializing = False

    def get_custom_base_grid(self, tooltip=""):
        grid = BaseGrid(tooltip=tooltip)
        grid.set_spacing(10, 10)
        grid.set_border_width(5)
        grid.set_margin_left(15)
        grid.set_margin_right(15)
        return grid

    def replace_at_index(self, tup, index, val):
        return tup[:index] + (val,) + tup[index + 1:]

    def toggle_subfolders(self, widget, path):
        self._initializing = True
        iter = self._folders.get_iter_from_string(path)
        self._folders.set_value(iter, 1, not self._folders.get_value(iter, 1))
        profiles = self._settings.get_value("profiles").unpack()
        profiles[self.profiles_combo_box.get_active_text()][int(path)] = self.replace_at_index(
            profiles[self.profiles_combo_box.get_active_text()][int(path)], 1, bool(
                self._folders.get_value(iter, 1)))
        self._settings.set_value("profiles", GLib.Variant("a{sa(sb)}", profiles))
        self._load_profiles()
        self._initializing = False

    def on_current_profile_changed(self, widget, data=None):
        if not self._initializing:
            self._settings.set_string("current-profile", self._currentProfile.get_active_text())

    def _initMisc(self):
        main_box = BaseGrid()

        # Daemon settings
        section_container = SectionContainer(title=_("Daemon"))
        section_container.set_property("margin", 15)

        curr_prof_box = self.get_custom_base_grid(
            tooltip=_("This is the current profile that the daemon will load."))
        label = SettingsLabel(_("Current Profile"))
        label.set_property("expand", True)
        self._currentProfile = Gtk.ComboBoxText()
        self._currentProfile.connect("changed", self.on_current_profile_changed)
        curr_prof_box.attach(label, 0, 0, 1, 1)
        curr_prof_box.attach(self._currentProfile, 1, 0, 1, 1)
        section_container.add_row(curr_prof_box, 0, 1, 1, 1)

        # "Special" switch that initially takes its active state from "daemon-is-running"
        # setting but when toggled it switches the "toggle-daemon" setting.
        # The "toggle-daemon" setting is a "dummy" setting that will toggle the daemon status.
        # This was done to bypass my own inability to convert the "daemon handler" function
        # from JavaScript to Python.
        daemon_status_box = self.get_custom_base_grid(
            tooltip=_("Toggle and display the daemon status."))
        label = SettingsLabel(_("Daemon Status"))
        label.set_property("expand", True)
        self._switchDaemon = Gtk.Switch()
        self._switchDaemon.set_active(self._settings.get_boolean("daemon-is-running"))

        def on_notify_active(widget, data):
            self._settings.set_boolean(
                "toggle-daemon", not self._settings.get_boolean("toggle-daemon"))
            # self._daemon.toggle()

        self._switch_handler = self._switchDaemon.connect("notify::active", on_notify_active)

        def on_daemon_toggled(settings, key):
            if self._switch_handler:
                self._switchDaemon.disconnect(self._switch_handler)
                self._switch_handler = None

            self._switchDaemon.set_active(settings.get_boolean(key))  # key = "daemon-is-running"
            self._switch_handler = self._switchDaemon.connect("notify::active", on_notify_active)

        self._settings.connect("changed::daemon-is-running", on_daemon_toggled)

        daemon_status_box.attach(label, 0, 0, 1, 1)
        daemon_status_box.attach(self._switchDaemon, 1, 0, 1, 1)
        section_container.add_row(daemon_status_box, 0, 2, 1, 1)

        self._switchAutoStart = Switch(key="auto-start",
                                       label=_("Autostart Daemon"),
                                       tooltip=_("When enabled, the daemon will be automatically started when the applet is loaded. If it is already running or this is disabled, no action will be taken."))
        section_container.add_row(self._switchAutoStart, 0, 3, 1, 1)

        interval_box = self.get_custom_base_grid()
        label = SettingsLabel(_("Wallpaper Timer Interval (seconds)"))
        label.set_property("expand", True)
        self._interval = Gtk.SpinButton(adjustment=Gtk.Adjustment(lower=0.0,
                                                                  upper=84600.0,
                                                                  step_increment=1.0,
                                                                  page_increment=10.0,
                                                                  page_size=0.0))
        self._interval.set_value(self._settings.get_int("interval"))
        self._interval.update()
        button = Gtk.Button(label=_("Save"))

        button.connect("clicked", self.on_spin_save_button_clicked, self._interval, "interval")

        interval_box.attach(label, 0, 1, 1, 1)
        interval_box.attach(self._interval, 1, 1, 1, 1)
        interval_box.attach(button, 2, 1, 1, 1)
        section_container.add_row(interval_box, 0, 4, 1, 1)

        main_box.attach(section_container, 0, 1, 1, 1)

        section_container = SectionContainer(title=_("Manage keyboard shortcuts"))
        section_container.set_property("margin", 15)

        # Create the storage for the keybindings
        self.accel_model = Gtk.ListStore()
        self.accel_model.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_INT,
            GObject.TYPE_INT,
            GObject.TYPE_STRING
        ])

        row = self.accel_model.insert(-1)
        [key, mods] = Gtk.accelerator_parse(self._settings.get_strv("next-wallpaper-shortcut")[0])
        self.accel_model.set(row, [0, 1, 2, 3], [_("Next Wallpaper"),
                                                 mods, key, "next-wallpaper-shortcut"])
        row = self.accel_model.insert(-1)
        [key, mods] = Gtk.accelerator_parse(self._settings.get_strv("prev-wallpaper-shortcut")[0])
        self.accel_model.set(row, [0, 1, 2, 3], [_("Previous Wallpaper"),
                                                 mods, key, "prev-wallpaper-shortcut"])
        row = self.accel_model.insert(-1)
        [key, mods] = Gtk.accelerator_parse(self._settings.get_strv("toggle-menu-shortcut")[0])
        self.accel_model.set(row, [0, 1, 2, 3], [_("Open/Close Menu"),
                                                 mods, key, "toggle-menu-shortcut"])

        # Create the treeview to display keybindings
        treeview = Gtk.TreeView()
        treeview.props.has_tooltip = True
        treeview.connect("query-tooltip", self._on_keibinding_query_tooltip)
        treeview.set_property("hexpand", True)
        treeview.set_property("model", self.accel_model)
        treeview.set_property("margin", 0)
        treeview.set_hover_selection(True)
        treeview.set_activate_on_single_click(True)
        treeview.get_selection().set_mode(Gtk.SelectionMode.SINGLE)

        treeview.columns_autosize()
        treeview.set_grid_lines(Gtk.TreeViewGridLines.BOTH)
        treeview.set_enable_tree_lines(True)

        # Action text column
        cellrend = Gtk.CellRendererText()
        cellrend.set_property("xpad", 15)
        col = Gtk.TreeViewColumn()
        col.set_property("title", _("Shortcut action"))
        col.set_alignment(0.5)
        col.set_property("expand", True)
        col.pack_start(cellrend, True)
        col.add_attribute(cellrend, "text", 0)
        treeview.append_column(col)

        # keybinding column
        cellrend = Gtk.CellRendererAccel()
        cellrend.set_property("xpad", 15)
        cellrend.set_property("editable", True)
        cellrend.set_property("accel-mode", Gtk.CellRendererAccelMode.GTK)
        cellrend.connect("accel-edited", self.on_accel_edited)
        cellrend.connect("accel-cleared", self.on_accel_cleared)

        col = Gtk.TreeViewColumn()
        col.set_property("title", _("Shortcut"))
        col.set_alignment(0.5)
        col.pack_end(cellrend, False)
        col.add_attribute(cellrend, "accel-mods", 1)
        col.add_attribute(cellrend, "accel-key", 2)
        treeview.append_column(col)

        section_container.add_row(treeview, 0, 1, 1, 1, False)

        main_box.attach(section_container, 0, 2, 1, 1)

        self.stack.add_titled(main_box, "misc", _("Other"))

    def _initKeyboard(self):
        main_box = BaseGrid()

        # Applet settings
        section_container = SectionContainer(title=_("Applet"))
        section_container.set_property("margin", 15)

        icon_box = self.get_custom_base_grid()
        icon_chooser = IconChooser(key="custom-applet-icon",
                                   label=_("Custom icon"),
                                   tooltip=_("Select a custom icon for the applet."))
        icon_box.attach(icon_chooser, 0, 0, 1, 1)
        section_container.add_row(icon_box, 0, 1, 1, 1)

        label_box = self.get_custom_base_grid(tooltip=_("Enter custom text to show in the panel."))
        label_box.set_spacing(10, 10)

        label = SettingsLabel(_("Custom label"))
        label.set_property("hexpand", False)
        label.set_property("halign", Gtk.Align.START)

        def _entry_change(widget, key):
            self._settings.set_string(key, widget.get_text())

        entry = Gtk.Entry()
        entry.set_property("hexpand", True)
        entry.set_text(self._settings.get_string("custom-applet-label"))
        entry.connect("changed", _entry_change, "custom-applet-label")
        label_box.attach(label, 0, 0, 1, 1)
        label_box.attach(entry, 1, 0, 1, 1)
        section_container.add_row(label_box, 0, 2, 1, 1)

        img_width_box = self.get_custom_base_grid()
        label = SettingsLabel(_("Wallpaper Preview Width"))
        label.set_property("expand", True)
        img_width = Gtk.SpinButton(adjustment=Gtk.Adjustment(lower=128.0,
                                                             upper=1024.0,
                                                             step_increment=2.0,
                                                             page_increment=10.0,
                                                             page_size=0.0))
        img_width.set_value(self._settings.get_int("wallpaper-preview-width"))
        img_width.update()
        button = Gtk.Button(label=_("Save"))

        button.connect("clicked", self.on_spin_save_button_clicked,
                       img_width, "wallpaper-preview-width")

        img_width_box.attach(label, 0, 1, 1, 1)
        img_width_box.attach(img_width, 1, 1, 1, 1)
        img_width_box.attach(button, 2, 1, 1, 1)
        section_container.add_row(img_width_box, 0, 3, 1, 1)

        self._switchInvertItems = Switch(key="invert-menu-items-order",
                                         label=_("Invert Menu Items Order"),
                                         tooltip="")
        section_container.add_row(self._switchInvertItems, 0, 4, 1, 1)

        self._switchProfilesState = Switch(key="remember-profile-state",
                                           label=_("Remember Profiles State"),
                                           tooltip=_("When enabled, the daemon will remember its current and next wallpaper for the current profile when the profile is changed. This means returning back to the profile will restore the previous background plus the next in queue."))
        section_container.add_row(self._switchProfilesState, 0, 5, 1, 1)

        self._switchNotifications = Switch(key="notifications",
                                           label=_("Show Notifications"),
                                           tooltip=_("Display a notification each time an event happens with wallpaper changer. This does not stop the applet from reporting errors."))
        section_container.add_row(self._switchNotifications, 0, 6, 1, 1)

        self._switchLogging = Switch(key="logging-enabled",
                                     label=_("Enable Logging"),
                                     tooltip=_("It enables the ability to log the output of several functions used by the applet."))
        section_container.add_row(self._switchLogging, 0, 7, 1, 1)

        main_box.attach(section_container, 0, 0, 1, 1)

        self.stack.add_titled(main_box, "applet", _("Applet"))

    def _initProfiles(self):
        section_container = SectionContainer(title=_("Manage profiles"))
        section_container.set_property("margin", 15)
        self._folders = Gtk.ListStore()
        self._folders.set_column_types([GObject.TYPE_STRING, GObject.TYPE_BOOLEAN])

        prof_selector_hbox = BaseGrid(orientation=Gtk.Orientation.HORIZONTAL)
        prof_selector_hbox.set_spacing(10, 10)
        prof_selector_hbox.set_border_width(5)
        prof_selector_hbox.set_margin_left(15)
        prof_selector_hbox.set_margin_right(15)
        label = SettingsLabel(_("Profile"))
        label.set_property("expand", True)
        prof_selector_hbox.attach(label, 0, 0, 1, 1)
        self.profiles_combo_box = Gtk.ComboBoxText()

        self.profiles_combo_box.connect("changed", self.on_profiles_combo_changed)

        prof_selector_hbox.attach(self.profiles_combo_box, 1, 0, 1, 1)
        self.add_profile = Gtk.Button()
        self.add_profile.add(Gtk.Image.new_from_icon_name("list-add", Gtk.IconSize.MENU))
        self.add_profile.set_tooltip_text(_("Create a new profile"))
        self.add_profile.set_sensitive(True)

        self.add_profile.connect("clicked", self.on_add_profile_clicked)
        prof_selector_hbox.attach(self.add_profile, 2, 0, 1, 1)
        self.remove_profile = Gtk.Button()  # label=
        self.remove_profile.add(Gtk.Image.new_from_icon_name(
            "edit-delete-symbolic", Gtk.IconSize.MENU))
        self.remove_profile.set_tooltip_text(_("Remove profile"))

        self.remove_profile.connect("clicked", self.on_remove_profile_clicked)
        prof_selector_hbox.attach(self.remove_profile, 3, 0, 1, 1)
        section_container.add_row(prof_selector_hbox, 0, 1, 1, 1)

        self.profiles_hbox = BaseGrid()

        self.profiles = Gtk.TreeView()
        self.profiles.props.has_tooltip = True
        self.profiles.connect("query-tooltip", self._on_profiles_query_tooltip)

        # Gtk.ScrolledWindow is the most annoying crap that I have ever seen!!!
        # It doesn't expand when there is plenty of room and the only method that
        # could be useful (set_propagate_natural_height) was just introduced into GTK 3.22.
        # Setting a fixed height is absolutely lame!
        self.profiles_scrollbox = Gtk.ScrolledWindow(hadjustment=None, vadjustment=None)
        self.profiles_scrollbox.set_policy(hscrollbar_policy=Gtk.PolicyType.AUTOMATIC,
                                           vscrollbar_policy=Gtk.PolicyType.AUTOMATIC)
        self.profiles_scrollbox.set_size_request(-1, 200)
        self.profiles_scrollbox.set_valign = Gtk.Align.FILL
        self.profiles_scrollbox.set_vexpand = True
        self.profiles_scrollbox.add(self.profiles)
        self.profiles_hbox.attach(self.profiles_scrollbox, 0, 0, 1, 1)

        self.profiles.get_selection().set_mode(Gtk.SelectionMode.SINGLE)
        self.profiles.set_model(self._folders)
        self.profiles.set_property("hexpand", True)
        self.profiles.set_property("vexpand", False)

        renderer = Gtk.CellRendererText()
        renderer.set_property("editable", True)

        def on_renderer_text_edited(widget, path, new_text):
            iter = self._folders.get_iter_from_string(path)
            self._folders.set_value(iter, 0, new_text)
            self._save_profile()

        renderer.connect("edited", on_renderer_text_edited)
        column = Gtk.TreeViewColumn()
        column.set_property("title", _("Path"))
        column.set_property("expand", True)
        column.pack_start(renderer, True)
        column.add_attribute(renderer, "text", 0)
        self.profiles.append_column(column)

        renderer = Gtk.CellRendererToggle()
        renderer.connect("toggled", self.toggle_subfolders)
        column = Gtk.TreeViewColumn()
        column.set_property("title", _("Sub Folders"))
        column.set_property("expand", False)
        column.pack_start(renderer, False)
        column.add_attribute(renderer, "active", 1)
        self.profiles.append_column(column)

        section_container.add_row(self.profiles_hbox, 0, 2, 1, 1, True)

        def on_remove_clicked(widget):
            [list, iter] = self.profiles.get_selection().get_selected()

            path = list.get_path(iter)
            list.row_deleted(path)
            profiles = self._settings.get_value("profiles").unpack()
            index = path.get_indices()[0]
            # Original JavaScript code.
            # profiles[self.profiles_combo_box.get_active_text()].splice(path.get_indices(), 1)
            profiles[self.profiles_combo_box.get_active_text()] = profiles[self.profiles_combo_box.get_active_text()][
                :index] + profiles[self.profiles_combo_box.get_active_text()][index + 1:]
            self._settings.set_value("profiles", GLib.Variant("a{sa(sb)}", profiles))
            self.remove.set_sensitive(False)

        def on_profiles_cursor_changed(widget):
            self.remove.set_sensitive(True)

        self.profiles.connect("cursor_changed", on_profiles_cursor_changed)

        def on_add_image_clicked(widget):
            self._add_item(_("Add Image"), Gtk.FileChooserAction.OPEN)

        def on_add_folder_clicked(widget):
            self._add_item(_("Add Folder"), Gtk.FileChooserAction.SELECT_FOLDER)

        toolbar = Gtk.Toolbar()
        toolbar.set_property("hexpand", True)
        toolbar.set_icon_size(Gtk.IconSize.SMALL_TOOLBAR)
        # It adds a border that I don't like.
        # toolbar.get_style_context().add_class(Gtk.STYLE_CLASS_INLINE_TOOLBAR)

        toolbar_separator = Gtk.SeparatorToolItem()
        toolbar_separator.set_draw(False)
        toolbar_separator.set_expand(True)
        toolbar.add(toolbar_separator)

        self.remove = Gtk.ToolButton()
        self.remove.set_is_important(True)
        self.remove.set_icon_name("edit-delete-symbolic")
        self.remove.set_label(_("Remove"))
        self.remove.connect("clicked", on_remove_clicked)
        self.remove.set_sensitive(False)
        toolbar.add(self.remove)

        self.add_image = Gtk.ToolButton()
        self.add_image.set_icon_name("image-x-generic-symbolic")
        self.add_image.set_label(_("Add Image"))
        self.add_image.set_is_important(True)
        self.add_image.connect("clicked", on_add_image_clicked)
        toolbar.add(self.add_image)

        self.add_folder = Gtk.ToolButton()
        self.add_folder.set_icon_name("folder-symbolic")
        self.add_folder.set_label(_("Add Folder"))
        self.add_folder.set_is_important(True)
        self.add_folder.connect("clicked", on_add_folder_clicked)
        toolbar.add(self.add_folder)

        section_container.add_row(toolbar, 0, 3, 1, 1)

        self.stack.add_titled(section_container, "profiles", _("Profiles"))

    def on_spin_save_button_clicked(self, button, widget, key):
        self._settings.set_int(key, int(widget.get_value()))

    def _on_keibinding_query_tooltip(self, widget, x, y, keyboard_tip, tooltip):
        if not widget.get_tooltip_context(x, y, keyboard_tip):
            return False
        else:
            ctx = widget.get_tooltip_context(x, y, keyboard_tip)
            tooltip.set_text(_("Click to set a new hotkey."))
            widget.set_tooltip_cell(tooltip, ctx.path, widget.get_column(1), None)
            return True

    def _on_profiles_query_tooltip(self, widget, x, y, keyboard_tip, tooltip):
        if not widget.get_tooltip_context(x, y, keyboard_tip):
            return False
        else:
            ctx = widget.get_tooltip_context(x, y, keyboard_tip)
            tooltip.set_text(_("Whether or not to include images from sub-folders."))
            widget.set_tooltip_cell(tooltip, ctx.path, widget.get_column(1), None)
            return True

    def on_accel_edited(self, accel, path, key, mods, hardware_keycode):
        value = Gtk.accelerator_name(key, mods)

        iterator = self.accel_model.get_iter_from_string(path)

        if not iterator:
            raise Exception(_("Failed to update keybinding"))

        name = self.accel_model.get_value(iterator, 3)
        self.accel_model.set(iterator, [1, 2], [mods, key])
        self._settings.set_strv(name, [value])

    def on_accel_cleared(self, widget, iter):
        iterator = self.accel_model.get_iter_from_string(iter)

        if not iterator:
            raise Exception(_("Failed to update keybinding"))

        name = self.accel_model.get_value(iterator, 3)
        self.accel_model.set(iterator, [1, 2], [0, 0])
        self._settings.set_strv(name, [""])

    def on_remove_profile_clicked(self, widget):
        self._initializing = True
        profile = self.profiles_combo_box.get_active_text()
        dialog = Gtk.Dialog(transient_for=app.window,
                            title=_("Remove profile"))
        box = dialog.get_content_area()
        label = Gtk.Label(
            label=_("Are you sure you want to delete the profile »%s«?") % profile)
        box.pack_start(label, True, True, 10)
        box.show_all()
        dialog.add_button(_("Yes"), Gtk.ResponseType.YES)
        dialog.add_button(_("No"), Gtk.ResponseType.NO)
        response = dialog.run()

        # FIXME!!!
        if response == Gtk.ResponseType.YES:
            profiles = self._settings.get_value("profiles").unpack()
            # Original JavaScript code.
            # delete profiles[profile]
            profiles.remove(profile)
            self._settings.set_value("profiles", GLib.Variant("a{sa(sb)}", profiles))
            self._load_profiles()

        self._initializing = False
        dialog.destroy()

    def on_add_profile_clicked(self, widget):
        self._initializing = True
        dialog = Gtk.Dialog(transient_for=app.window,
                            title=_("Create a new profile"))
        mbox = dialog.get_content_area()
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        label = Gtk.Label(label=_("Profile Name"))
        box.pack_start(label, False, True, 10)
        input = Gtk.Entry()
        box.pack_end(input, True, True, 10)
        box.show_all()
        mbox.pack_start(box, True, True, 10)
        dialog.add_button(_("OK"), Gtk.ResponseType.OK)
        dialog.add_button(_("_Cancel"), Gtk.ResponseType.CANCEL)
        result = dialog.run()

        if result == Gtk.ResponseType.OK:
            profiles = self._settings.get_value("profiles").unpack()
            profiles[input.get_text()] = []
            self._settings.set_value("profiles", GLib.Variant("a{sa(sb)}", profiles))
            self._load_profiles()

        self._initializing = False
        dialog.destroy()

    def on_profiles_combo_changed(self, widget):
        profiles_pref = self._settings.get_value("profiles").unpack()

        for profile in profiles_pref:
            if profile == widget.get_active_text():
                self._folders.clear()

                for f in range(0, len(profiles_pref[profile])):
                    folder = [profiles_pref[profile][f][0],
                              profiles_pref[profile][f][1]]
                    self._folders.insert_with_valuesv(-1, [0, 1], folder)
                break

    def _add_item(self, title, action):
        self._initializing = True
        dialog = Gtk.FileChooserDialog(transient_for=app.window,
                                       title=title,
                                       action=action)
        if action != Gtk.FileChooserAction.SELECT_FOLDER:
            filter_image = Gtk.FileFilter()
            filter_image.set_name("Image files")
            filter_image.add_mime_type("image/*")
            dialog.add_filter(filter_image)

        dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL)
        dialog.add_button(Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
        dialog.set_select_multiple(True)
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            paths = dialog.get_uris()
            profiles = self._settings.get_value("profiles").unpack()
            profile = self.profiles_combo_box.get_active_text()

            for path in range(0, len(paths)):
                profiles[profile].append(tuple([paths[path], False]))

            self._settings.set_value("profiles", GLib.Variant("a{sa(sb)}", profiles))
            self._load_profiles()

        self._initializing = False
        dialog.destroy()

    def _load_profiles(self):
        active = self.profiles_combo_box.get_active()
        i = 0
        text = self.profiles_combo_box.get_active_text()
        self.profiles_combo_box.remove_all()
        self._currentProfile.remove_all()

        for profile in self._settings.get_value("profiles").unpack():
            self.profiles_combo_box.insert_text(i, profile)
            self._currentProfile.insert_text(i, profile)

            if (text == profile or (active == -1 and profile == self._settings.get_string("current-profile"))):
                active = i

            i += 1

        self.profiles_combo_box.set_active(active)
        self._currentProfile.set_active(active)

    def _save_profile(self):
        profile = []

        for row in self._folders:
            [zero, one] = row
            profile.append(tuple([zero, one]))

        # for [model, path, iter] in self._folders:
        # profile.append([model.get_value(iter, 0), model.get_value(iter, 1)])
        # self._folders.foreach(Lang.bind(profile, function(model, path, iter) {

        # }))
        profiles = self._settings.get_value("profiles").unpack()
        profiles[self.profiles_combo_box.get_active_text()] = profile
        self._settings.set_value("profiles", GLib.Variant("a{sa(sb)}", profiles))
        self.on_profiles_combo_changed(self.profiles_combo_box)
        # self.profiles_combo_box.do_changed()


class AboutDialog(Gtk.AboutDialog):

    def __init__(self):
        logo = GdkPixbuf.Pixbuf.new_from_file_at_size(
            os.path.join(APPLET_DIR, "icon.png"), 64, 64)

        Gtk.AboutDialog.__init__(self, transient_for=app.window)
        data = app.extension_meta

        try:
            contributors_translated = []
            contributors = data["contributors"]

            if isinstance(contributors, str):
                contributors = contributors.split(",")

            for contributor in contributors:
                contributors_translated.append(_(contributor.strip()))

            self.add_credit_section(_("Contributors/Mentions:"),
                                    sorted(contributors_translated, key=self.lowered))
        except:
            pass

        # TO TRANSLATORS:
        # Here goes the name/s of the author/s of the translations.
        # Only e-mail addresses and links to GitHub accounts are allowed. NOTHING MORE.
        self.set_translator_credits(_("translator-credits"))
        self.set_license_type(Gtk.License.GPL_3_0)
        self.set_wrap_license(True)
        self.set_version(data["version"])
        self.set_comments(_(data["description"]))
        self.set_website(data["website"])
        self.set_website_label(_(data["name"]))
        self.set_authors(["Odyseus https://github.com/Odyseus"])
        self.set_logo(logo)
        self.connect("response", self.on_response)

    def lowered(self, item):
        return item.lower()

    def on_response(self, dialog, response):
        self.destroy()


class AppletPrefsWindow(Gtk.ApplicationWindow):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.settings = Settings().get_settings()

        if (self.settings.get_boolean("window-remember-size")):
            width = self.settings.get_int("window-width")
            height = self.settings.get_int("window-height")
            self.set_default_size(width, height)
        else:
            self.set_default_size(720, 420)

        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_icon_from_file(os.path.join(APPLET_DIR, "icon.png"))

        self.stack = Gtk.Stack()

    def add_toolbar(self):
        toolbar = Gtk.Toolbar()
        toolbar.get_style_context().add_class("primary-toolbar")
        self.main_box.add(toolbar)

        toolitem = Gtk.ToolItem()
        toolitem.set_expand(True)
        toolbar.add(toolitem)

        self.toolbar_box = BaseGrid(orientation=Gtk.Orientation.HORIZONTAL)
        self.toolbar_box.set_spacing(0, 0)
        toolbar_box_scrolledwindow = Gtk.ScrolledWindow(hadjustment=None, vadjustment=None)
        toolbar_box_scrolledwindow.set_policy(hscrollbar_policy=Gtk.PolicyType.AUTOMATIC,
                                              vscrollbar_policy=Gtk.PolicyType.NEVER)
        toolbar_box_scrolledwindow.add(self.toolbar_box)
        toolitem.add(toolbar_box_scrolledwindow)

        stack_switcher = Gtk.StackSwitcher()
        stack_switcher.set_stack(self.stack)
        stack_switcher.set_halign(Gtk.Align.CENTER)
        stack_switcher.set_homogeneous(False)
        self.toolbar_box.attach(stack_switcher, 1, 0, 1, 1)

        dummy_grid_1 = BaseGrid(orientation=Gtk.Orientation.HORIZONTAL)
        dummy_grid_1.set_property("hexpand", True)
        self.toolbar_box.attach(dummy_grid_1, 0, 0, 1, 1)

        dummy_grid_2 = BaseGrid(orientation=Gtk.Orientation.HORIZONTAL)
        dummy_grid_2.set_property("hexpand", True)
        self.toolbar_box.attach(dummy_grid_2, 2, 0, 1, 1)

        menu_popup = Gtk.Menu()
        menu_popup.set_halign(Gtk.Align.END)
        menu_popup.append(self.createMenuItem(text=_("Reset settings to defaults"),
                                              callback=self._restore_default_values))
        menu_popup.append(self.createMenuItem(text=_("Import settings from a file"),
                                              callback=self._import_settings))
        menu_popup.append(self.createMenuItem(text=_("Export settings to a file"),
                                              callback=self._export_settings))
        menu_popup.append(Gtk.SeparatorMenuItem())

        rem_win_size_check = self.createCheckMenuItem(
            _("Remember window size"), key="window-remember-size")

        if rem_win_size_check is not None:
            menu_popup.append(rem_win_size_check)

        menu_popup.append(self.createMenuItem(text=_("Restart Cinnamon"),
                                              callback=self._restart_cinnamon))
        menu_popup.append(Gtk.SeparatorMenuItem())

        menu_popup.append(self.createMenuItem(text=_("Help"),
                                              callback=self.open_help_page))
        menu_popup.append(self.createMenuItem(text=_("About"),
                                              callback=self.open_about_dialog))

        menu_popup.show_all()
        menu_button = Gtk.MenuButton()
        menu_button.set_popup(menu_popup)
        menu_button.add(Gtk.Image.new_from_icon_name("open-menu-symbolic", Gtk.IconSize.MENU))
        menu_button.set_tooltip_text(_("Manage settings"))

        self.toolbar_box.attach(menu_button, 3, 0, 1, 1)

    def open_about_dialog(self, widget):
        if app.extension_meta is not None:
            aboutdialog = AboutDialog()
            aboutdialog.run()

    def open_help_page(self, widget):
        subprocess.call(("xdg-open", os.path.join(APPLET_DIR, "HELP.html")))

    def createCheckMenuItem(self, text, key=None, *args):
        if Settings().settings_has_key(key) is False:
            return None

        item = Gtk.CheckMenuItem(text)
        item.set_active(Settings().get_settings().get_boolean(key))
        item.connect("activate", self.on_check_menu_item, key)

        return item

    def on_check_menu_item(self, widget, key):
        is_active = widget.get_active()
        Settings().get_settings().set_boolean(key, is_active is True)

    # A million thanks to the """geniuses""" ($%&½€#&) at Gnome for
    # deprecating Gtk.ImageMenuItem!!! ¬¬
    def createMenuItem(self, text, callback):
        item = Gtk.MenuItem(text)

        if (callback is not None):
            item.connect("activate", callback)

        return item

    def _restore_default_values(self, widget):
        dialog = Gtk.MessageDialog(transient_for=app.window,
                                   modal=False,
                                   message_type=Gtk.MessageType.WARNING,
                                   buttons=Gtk.ButtonsType.YES_NO)
        # TO TRANSLATORS: Full sentence:
        # Warning: Trying to reset all AppletName settings!!!
        dialog.set_title(_("Warning: Trying to reset all %s settings!!!") % APPLET_NAME)

        # TO TRANSLATORS: Full sentence:
        # Reset all AppletName settings to default?
        esc = cgi.escape(_("Reset all %s settings to default?") % APPLET_NAME)
        dialog.set_markup(esc)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()

        if response == Gtk.ResponseType.YES:
            os.system("gsettings reset-recursively %s &" % SCHEMA_NAME)
            app.on_quit(self)

    def _import_settings(self, widget):
        self._import_export_settings(self, export=False)

    def _export_settings(self, widget):
        self._import_export_settings(self, export=True)

    def _import_export_settings(self, widget, export):
        if export:
            mode = Gtk.FileChooserAction.SAVE
            string = _("Select or enter file to export to")
            # TO TRANSLATORS: Could be left blank.
            btns = (_("_Cancel"), Gtk.ResponseType.CANCEL,
                    _("_Save"), Gtk.ResponseType.ACCEPT)
        else:
            mode = Gtk.FileChooserAction.OPEN
            string = _("Select a file to import")
            # TO TRANSLATORS: Could be left blank.
            btns = (_("_Cancel"), Gtk.ResponseType.CANCEL,
                    # TO TRANSLATORS: Could be left blank.
                    _("_Open"), Gtk.ResponseType.OK)

        dialog = Gtk.FileChooserDialog(parent=app.window,
                                       title=string,
                                       action=mode,
                                       buttons=btns)

        if export:
            dialog.set_do_overwrite_confirmation(True)

        filter_text = Gtk.FileFilter()
        filter_text.add_pattern("*.dconf")
        filter_text.set_name(_("DCONF files"))
        dialog.add_filter(filter_text)

        response = dialog.run()

        if export and response == Gtk.ResponseType.ACCEPT:
            filename = dialog.get_filename()

            if ".dconf" not in filename:
                filename = filename + ".dconf"

            os.system("dconf dump %s > %s &" % (SCHEMA_PATH, filename))

        if export is False and response == Gtk.ResponseType.OK:
            filename = dialog.get_filename()
            os.system("dconf load %s < %s" % (SCHEMA_PATH, filename))
            app.on_quit(self)

        dialog.destroy()

    def _restart_cinnamon(self, widget):
        os.system("nohup cinnamon --replace >/dev/null 2>&1&")


class AppletPrefsApplication(Gtk.Application):

    def __init__(self, *args, **kwargs):
        GLib.set_application_name(APPLET_NAME)
        super().__init__(*args,
                         application_id=APPLICATION_ID,
                         flags=Gio.ApplicationFlags.FLAGS_NONE,
                         **kwargs)

        if os.path.exists("%s/metadata.json" % APPLET_DIR):
            raw_data = open("%s/metadata.json" % APPLET_DIR).read()

            try:
                self.extension_meta = json.loads(raw_data)
            except:
                self.extension_meta = None
        else:
            self.extension_meta = None

        self.application = Gtk.Application()
        self.application.connect("activate", self.do_activate)
        self.application.connect("startup", self.do_startup)
        self.settings = Settings().get_settings()

    def do_activate(self, data=None):
        self.window.present()

    def do_startup(self, data=None):
        Gtk.Application.do_startup(self)
        self._buildUI()

    # The only way I found to get the correct window size when closing the window.
    def on_delete_event(self, widget, data=None):
        [width, height] = self.window.get_size()

        if (self.settings.get_boolean("window-remember-size")):
            self.settings.set_int("window-width", width)
            self.settings.set_int("window-height", height)

        return False

    def _buildUI(self):
        self.window = AppletPrefsWindow(
            # TO TRANSLATORS: Full sentence:
            # AppletName applet preferences
            application=self, title=_("%s applet preferences") % APPLET_NAME)

        self.window.connect("destroy", self.on_quit)
        self.window.connect("delete_event", self.on_delete_event)

        self.window.main_box = WallChangerPrefs()

        self.window.add_toolbar()
        self.window.main_box.attach(self.window.stack, 0, 1, 1, 1)

        self.window.add(self.window.main_box)

        self.window.show_all()

    def on_quit(self, action):
        self.quit()


def display_warning_message(widget, title, message):
    dialog = Gtk.MessageDialog(transient_for=app.window,
                               title=title,
                               modal=True,
                               message_type=Gtk.MessageType.WARNING,
                               buttons=Gtk.ButtonsType.OK)

    esc = message

    dialog.set_markup(esc)
    dialog.show_all()
    dialog.run()
    dialog.destroy()


def ui_error_message(msg, detail=None):
    dialog = Gtk.MessageDialog(transient_for=None,
                               modal=True,
                               message_type=Gtk.MessageType.ERROR,
                               buttons=Gtk.ButtonsType.OK)

    try:
        esc = cgi.escape(msg)
    except:
        esc = msg

    dialog.set_markup(esc)
    dialog.show_all()
    dialog.run()
    dialog.destroy()


def install_schema():
    file_path = os.path.join(APPLET_DIR, "schemas", SCHEMA_NAME + ".gschema.xml")
    if os.path.exists(file_path):
        # TO TRANSLATORS: Could be left blank.
        sentence = _("Please enter your password to install the required settings schema for %s") % (
            APPLET_UUID)

        if os.path.exists("/usr/bin/gksu") and os.path.exists("/usr/share/cinnamon/cinnamon-settings/bin/installSchema.py"):
            launcher = "gksu  --message \"<b>%s</b>\"" % sentence
            tool = "/usr/share/cinnamon/cinnamon-settings/bin/installSchema.py %s" % file_path
            command = "%s %s" % (launcher, tool)
            os.system(command)
        else:
            ui_error_message(
                # TO TRANSLATORS: Could be left blank.
                msg=_("Could not install the settings schema for %s.  You will have to perform this step yourself.") % (APPLET_UUID))


def remove_schema():
    file_name = SCHEMA_NAME + ".gschema.xml"
    # TO TRANSLATORS: Could be left blank.
    sentence = _("Please enter your password to remove the settings schema for %s") % (
        APPLET_UUID)

    if os.path.exists("/usr/bin/gksu") and os.path.exists("/usr/share/cinnamon/cinnamon-settings/bin/removeSchema.py"):
        launcher = "gksu  --message \"<b>%s</b>\"" % sentence
        tool = "/usr/share/cinnamon/cinnamon-settings/bin/removeSchema.py %s" % (file_name)
        command = "%s %s" % (launcher, tool)
        os.system(command)
    else:
        ui_error_message(
            # TO TRANSLATORS: Could be left blank.
            _("Could not remove the settings schema for %s.  You will have to perform this step yourself.  This is not a critical error.") % (APPLET_UUID))


if __name__ == "__main__":
    try:
        arg = sys.argv[1]
    except:
        arg = None

    # I don't think that this is needed.
    # Leaving it because it just don't hurt.
    if arg == "install-schema":
        install_schema()
    elif arg == "remove-schema":
        remove_schema()
    else:
        # Initialize and load gsettings values
        Settings().set_settings(SCHEMA_NAME)

        app = AppletPrefsApplication()
        app.run()
