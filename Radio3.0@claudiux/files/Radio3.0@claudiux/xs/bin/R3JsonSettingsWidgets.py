#!/usr/bin/python3

from os import environ
import sys
from gi.repository import Gio, GObject
from xapp.SettingsWidgets import *

sys.path.append("/usr/share/cinnamon/cinnamon-settings/bin")

#from SettingsWidgets import SoundFileChooser, DateChooser, TimeChooser, Keybinding
from SettingsWidgets import DateChooser, TimeChooser, Keybinding
from xapp.GSettingsWidgets import CAN_BACKEND as px_can_backend
from SettingsWidgets import CAN_BACKEND as c_can_backend
from R3TreeListWidgets import List
import os
import collections
import json
import operator

can_backend = px_can_backend + c_can_backend
can_backend.append('List')

JSON_SETTINGS_PROPERTIES_MAP = {
    "description"      : "label",
    "min"              : "mini",
    "max"              : "maxi",
    "step"             : "step",
    "units"            : "units",
    "show-value"       : "show_value",
    "select-dir"       : "dir_select",
    "height"           : "height",
    "tooltip"          : "tooltip",
    "possible"         : "possible",
    "expand-width"     : "expand_width",
    "columns"          : "columns",
    "event-sounds"     : "event_sounds",
    "default_icon"     : "default_icon",
    "icon_categories"  : "icon_categories",
    "default_category" : "default_category",
    "show-seconds"     : "show_seconds",
    "show-buttons"     : "show_buttons",
    "reorderable"      : "reorderable"
}

OPERATIONS = ['<=', '>=', '<', '>', '!=', '=']

OPERATIONS_MAP = {'<': operator.lt, '<=': operator.le, '>': operator.gt, '>=': operator.ge, '!=': operator.ne, '=': operator.eq}

UPDATE_OPTIONS_FILE = environ["XDG_RUNTIME_DIR"] + "/radio_update_options.txt"

class JSONSettingsHandler(object):
    def __init__(self, filepath, notify_callback=None):
        super(JSONSettingsHandler, self).__init__()

        self.resume_timeout = None
        self.notify_callback = notify_callback

        self.filepath = filepath
        self.file_obj = Gio.File.new_for_path(self.filepath)
        self.file_monitor = self.file_obj.monitor_file(Gio.FileMonitorFlags.WATCH_MOVES, None)
        #self.file_monitor = self.file_obj.monitor_file(Gio.FileMonitorFlags.NONE, None)
        self.file_monitor.connect("changed", self.check_settings)

        self.bindings = {}
        self.listeners = {}
        self.deps = {}

        self.settings = self.get_settings()

    def bind(self, key, obj, prop, direction, map_get=None, map_set=None):
        if direction & (Gio.SettingsBindFlags.SET | Gio.SettingsBindFlags.GET) == 0:
            direction |= Gio.SettingsBindFlags.SET | Gio.SettingsBindFlags.GET

        binding_info = {"obj": obj, "prop": prop, "dir": direction, "map_get": map_get, "map_set": map_set}
        if key not in self.bindings:
            self.bindings[key] = []
        self.bindings[key].append(binding_info)

        if direction & Gio.SettingsBindFlags.GET != 0:
            self.set_object_value(binding_info, self.get_value(key))
        if direction & Gio.SettingsBindFlags.SET != 0:
            binding_info["oid"] = obj.connect("notify::"+prop, self.object_value_changed, key)

    def listen(self, key, callback):
        if key not in self.listeners:
            self.listeners[key] = []
        self.listeners[key].append(callback)

    def get_value(self, key):
        return self.get_property(key, "value")

    def set_value(self, key, value):
        if value != self.settings[key]["value"]:
            self.settings[key]["value"] = value
            self.save_settings()
            if self.notify_callback:
                self.notify_callback(self, key, value)

            if key in self.bindings:
                for info in self.bindings[key]:
                    self.set_object_value(info, value)

            if key in self.listeners:
                for callback in self.listeners[key]:
                    callback(key, value)

    def get_property(self, key, prop):
        props = self.settings[key]
        return props[prop]

    def has_property(self, key, prop):
        return prop in self.settings[key]

    def has_key(self, key):
        return key in self.settings

    def object_value_changed(self, obj, value, key):
        for info in self.bindings[key]:
            if obj == info["obj"]:
                value = info["obj"].get_property(info["prop"])
                if "map_set" in info and info["map_set"] != None:
                    value = info["map_set"](value)

        for info in self.bindings[key]:
            if obj != info["obj"]:
                self.set_object_value(info, value)
        self.set_value(key, value)

        if key in self.listeners:
            for callback in self.listeners[key]:
                callback(key, value)

    def set_object_value(self, info, value):
        if info["dir"] & Gio.SettingsBindFlags.GET == 0:
            return

        with info["obj"].freeze_notify():
            if "map_get" in info and info["map_get"] != None:
                value = info["map_get"](value)
            if value != info["obj"].get_property(info["prop"]) and value != None:
                info["obj"].set_property(info["prop"], value)

    def check_settings(self, *args):
        old_settings = self.settings
        self.settings = self.get_settings()

        for key in self.bindings:
            new_value = self.settings[key]["value"]
            if new_value != old_settings[key]["value"]:
                for info in self.bindings[key]:
                    self.set_object_value(info, new_value)

        for key, callback_list in self.listeners.items():
            new_value = self.settings[key]["value"]
            if new_value != old_settings[key]["value"]:
                for callback in callback_list:
                    callback(key, new_value)
            if "options" in self.settings[key]:
                print(key, "has options")

    def get_settings(self):
        file = open(self.filepath)
        raw_data = file.read()
        file.close()
        try:
            settings = json.loads(raw_data, object_pairs_hook=collections.OrderedDict)
        except:
            raise Exception("Failed to parse settings JSON data for file %s" % (self.filepath))
        return settings

    def save_settings(self):
        self.pause_monitor()
        if os.path.exists(self.filepath):
            os.remove(self.filepath)
        raw_data = json.dumps(self.settings, indent=4)
        new_file = open(self.filepath, 'w+')
        new_file.write(raw_data)
        new_file.close()
        self.resume_monitor()

    def pause_monitor(self):
        self.file_monitor.cancel()
        self.handler = None

    def resume_monitor(self):
        if self.resume_timeout:
            GLib.source_remove(self.resume_timeout)
        self.resume_timeout = GLib.timeout_add(2000, self.do_resume)

    def do_resume(self):
        self.file_monitor = self.file_obj.monitor_file(Gio.FileMonitorFlags.WATCH_MOVES, None)
        self.handler = self.file_monitor.connect("changed", self.check_settings)
        self.resume_timeout = None
        return False

    def reset_to_defaults(self):
        for key in self.settings:
            if "value" in self.settings[key]:
                self.settings[key]["value"] = self.settings[key]["default"]
                self.do_key_update(key)

        self.save_settings()

    def do_key_update(self, key):
        if key in self.bindings:
            for info in self.bindings[key]:
                self.set_object_value(info, self.settings[key]["value"])

        if key in self.listeners:
            for callback in self.listeners[key]:
                callback(key, self.settings[key]["value"])

    def load_from_file(self, filepath):
        file = open(filepath)
        raw_data = file.read()
        file.close()
        try:
            settings = json.loads(raw_data, encoding=None, object_pairs_hook=collections.OrderedDict)
        except:
            raise Exception("Failed to parse settings JSON data for file %s" % (self.filepath))

        for key in self.settings:
            if "value" not in self.settings[key]:
                continue
            if key in settings and "value" in self.settings[key]:
                self.settings[key]["value"] = settings[key]["value"]
                self.do_key_update(key)
            else:
                print("Skipping key %s: the key does not exist in %s or has no value" % (key, filepath))
        self.save_settings()

    def save_to_file(self, filepath):
        if os.path.exists(filepath):
            os.remove(filepath)
        raw_data = json.dumps(self.settings, indent=4)
        new_file = open(filepath, 'w+')
        new_file.write(raw_data)
        new_file.close()

class JSONSettingsRevealer(Gtk.Revealer):
    def __init__(self, settings, key):
        super(JSONSettingsRevealer, self).__init__()
        self.settings = settings

        self.key = None
        self.op = None
        self.value = None
        for op in OPERATIONS:
            if op in key:
                self.op = op
                self.key, self.value = key.split(op)
                break

        if self.key is None:
            if key[:1] == '!':
                self.invert = True
                self.key = key[1:]
            else:
                self.invert = False
                self.key = key

        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)
        Gtk.Revealer.add(self, self.box)

        self.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
        self.set_transition_duration(150)

        self.settings.listen(self.key, self.key_changed)
        self.key_changed(self.key, self.settings.get_value(self.key))

    def add(self, widget):
        self.box.pack_start(widget, False, True, 0)

    def key_changed(self, key, value):
        if self.op != None:
            val_type = type(value)
            self.set_reveal_child(OPERATIONS_MAP[self.op](value, val_type(self.value)))
        elif value != self.invert:
            self.set_reveal_child(True)
        else:
            self.set_reveal_child(False)

class JSONSettingsBackend(object):
    def attach(self):
        self._saving = False

        if hasattr(self, "set_rounding") and self.settings.has_property(self.key, "round"):
            self.set_rounding(self.settings.get_property(self.key, "round"))
        if hasattr(self, "bind_object"):
            bind_object = self.bind_object
        else:
            bind_object = self.content_widget
        if self.bind_dir != None:
            self.settings.bind(self.key, bind_object, self.bind_prop, self.bind_dir,
                               self.map_get if hasattr(self, "map_get") else None,
                               self.map_set if hasattr(self, "map_set") else None)
        else:
            self.settings.listen(self.key, self._settings_changed_callback)
            self.on_setting_changed()
            self.connect_widget_handlers()

    def set_value(self, value):
        self._saving = True
        self.settings.set_value(self.key, value)
        self._saving = False

    def get_value(self):
        return self.settings.get_value(self.key)

    def get_range(self):
        min = self.settings.get_property(self.key, "min")
        max = self.settings.get_property(self.key, "max")
        return [min, max]

    def _settings_changed_callback(self, *args):
        if not self._saving:
            self.on_setting_changed(*args)

    def on_setting_changed(self, *args):
        raise NotImplementedError("SettingsWidget class must implement on_setting_changed().")

    def connect_widget_handlers(self, *args):
        if self.bind_dir == None:
            raise NotImplementedError("SettingsWidget classes with no .bind_dir must implement connect_widget_handlers().")

class TextView(SettingsWidget):
    bind_prop = "text"
    bind_dir = Gio.SettingsBindFlags.DEFAULT

    def __init__(self, label, height=200, dep_key=None, tooltip=""):
        super(TextView, self).__init__(dep_key=dep_key)

        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(8)

        self.label = Gtk.Label.new(label)
        self.label.set_halign(Gtk.Align.CENTER)

        self.scrolledwindow = Gtk.ScrolledWindow(hadjustment=None, vadjustment=None)
        self.scrolledwindow.set_size_request(width=-1, height=height)
        self.scrolledwindow.set_policy(hscrollbar_policy=Gtk.PolicyType.AUTOMATIC,
                                       vscrollbar_policy=Gtk.PolicyType.AUTOMATIC)
        self.scrolledwindow.set_shadow_type(type=Gtk.ShadowType.ETCHED_IN)
        self.content_widget = Gtk.TextView()
        self.content_widget.set_border_width(3)
        self.content_widget.set_wrap_mode(wrap_mode=Gtk.WrapMode.WORD_CHAR)
        self.content_widget.set_editable(False)
        self.bind_object = self.content_widget.get_buffer()

        self.pack_start(self.label, False, False, 0)
        self.add(self.scrolledwindow)
        self.scrolledwindow.add(self.content_widget)
        self._value_changed_timer = None

class ComboBox(SettingsWidget):
    bind_dir = None

    def __init__(self, label, options=[], valtype=None, separator=None, size_group=None, dep_key=None, tooltip=""):
        super(ComboBox, self).__init__(dep_key=dep_key)

        self.valtype = valtype
        self.separator = separator
        self.option_map = {}

        self.label_text = label
        self.label = SettingsLabel(label)

        self.content_widget = Gtk.ComboBox()
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)
        self.content_widget.set_valign(Gtk.Align.CENTER)

        self.set_options(options)

        if separator:
            self.content_widget.set_row_separator_func(self.is_separator_row)

        self.set_tooltip_text(tooltip)

        if size_group:
            self.add_to_size_group(size_group)

        if self.key in ["category-to-move", "sched-radio"]:
            self.file_options_changed = Gio.File.new_for_path(UPDATE_OPTIONS_FILE)
            self.file_options_changed_monitor = self.file_options_changed.monitor_file(Gio.FileMonitorFlags.WATCH_MOVES, None)
            self.file_options_changed_monitor.connect("changed", self.do_update_options)

    def on_my_value_changed(self, widget):
        print("self.key: ", self.key)
        if self.key in ["category-to-move", "sched-radio"]:
            print("\nComboBox: on_my_value_changed", self.key)

            #self.content_widget.emit('popdown')

            # ~ for k, v in widget.items():
                # ~ print(str(k)+": "+str(v))
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            self.value = self.model[tree_iter][0]
            self.set_value(self.value)
            print("value: "+self.value)

    def on_setting_changed(self, *args):
        if self.key in ["category-to-move", "sched-radio"]:
            print("\nComboBox: on_setting_changed", self.key)
            #print("len(args): "+str(len(args)))

            #if len(args) > 0:
            stgs = self.settings.get_settings()
            # ~ print("settings: "+self.settings.filepath)
            options = []
            for key, value in stgs[self.key]["options"].items():
                print(key, value)
                options.append([value, key])
            if len(options) > 0:
                self.set_options(options)

        self.value = self.get_value()
        try:
            self.content_widget.set_active_iter(self.option_map[self.value])
        except Exception:
            self.content_widget.set_active_iter(None)

    def _settings_changed_callback(self, *args):
        if not self._saving:
            self.on_setting_changed(*args)

    def connect_widget_handlers(self, *args):
        self.content_widget.connect('changed', self.on_my_value_changed)
        #self.content_widget.connect('popdown', self.do_update_options)

    def set_options(self, options):
        if self.key in ["category-to-move", "sched-radio"]:
            print("ComboBox: set_options", self.key)
            # ~ print("type: "+str(type(options)))
        if self.valtype != None:
            var_type = self.valtype
        else:
            # assume all keys are the same type (mixing types is going to cause an error somewhere)
            var_type = type(options[0][0])

        try:
            self.model.clear()
        except AttributeError:
            self.model = Gtk.ListStore(var_type, str)

        self.content_widget.clear()
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)
        self.content_widget.set_valign(Gtk.Align.CENTER)
        self.content_widget.set_model(self.model)

        self.option_map = {}
        for option in options:
            if self.key in ["category-to-move", "sched-radio"]:
                print(option[0], option[1])
            self.option_map[option[0]] = self.model.append([option[0], option[1]])

        self.content_widget.set_id_column(0)
        self.content_widget.emit('changed')

    def is_separator_row(self, model, tree_iter):
        if model[tree_iter][0] == self.separator:
            return True
        else:
            return False

    def do_update_options(self, *args):
        # ~ print("method handler for `update_options' called with parameters", args)
        self._settings_changed_callback(*args)

class FileChooser(SettingsWidget):
    bind_dir = None

    def __init__(self, label, dir_select=False, size_group=None, dep_key=None, tooltip=""):
        super(FileChooser, self).__init__(dep_key=dep_key)
        if dir_select:
            action = Gtk.FileChooserAction.SELECT_FOLDER
        else:
            action = Gtk.FileChooserAction.OPEN

        self.label = SettingsLabel(label)
        self.content_widget = Gtk.FileChooserButton(action=action)
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        #self.set_tooltip_text(tooltip)
        self.set_tooltip_text(self.get_value().replace("file://", ""))

        if size_group:
            self.add_to_size_group(size_group)

    def on_file_selected(self, *args):
        self.set_value(self.content_widget.get_uri())
        self.set_tooltip_text(self.get_value().replace("file://", ""))

    def on_setting_changed(self, *args):
        self.content_widget.set_uri(self.get_value())

    def connect_widget_handlers(self, *args):
        self.content_widget.connect("file-set", self.on_file_selected)


def json_settings_factory(subclass):
    class NewClass(globals()[subclass], JSONSettingsBackend):
        def __init__(self, key, settings, properties):
            self.key = key
            self.settings = settings

            kwargs = {}
            for prop in properties:
                if prop in JSON_SETTINGS_PROPERTIES_MAP:
                    kwargs[JSON_SETTINGS_PROPERTIES_MAP[prop]] = properties[prop]
                elif prop == "options":
                    kwargs["options"] = []
                    for value, label in properties[prop].items():
                        kwargs["options"].append((label, value))
            super(NewClass, self).__init__(**kwargs)
            self.attach()

    return NewClass

for widget in can_backend:
    if widget not in ["TweenChooser", "EffectChooser", "SoundFileChooser"]:
        globals()["JSONSettings"+widget] = json_settings_factory(widget)
