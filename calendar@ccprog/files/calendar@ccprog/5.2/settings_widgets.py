#!/usr/bin/python3

from JsonSettingsWidgets import JSONSettingsList
from xapp.SettingsWidgets import ComboBox, Entry
import pytz
from gi.repository import Gtk
import gettext
from pathlib import Path

# i18n
gettext.install("calendar@ccprog", str(Path.home()) + "/.local/share/locale")

TZ_NO_REGION = 'Etc'

def list_edit_factory(params):
    is_combo = 'options' in params

    kwargs = { 'label': _(params['title']) }
    if is_combo:
        widget_type = ComboBox

        kwargs['valtype'] = str
        kwargs['options'] = params['options']
    else:
        widget_type = Entry

    class Widget(widget_type):
        def __init__(self, **kwargs):
            super(Widget, self).__init__(**kwargs)
            self.bind_object = self.content_widget
            if is_combo:
                self.connect_widget_handlers()

        def get_value(self):
            if hasattr(self, "widget_value"):
                return self.widget_value
            else:
                return None

        def set_value(self, value):
            self.widget_value = value

        def set_widget_value(self, value):
            if is_combo:
                self.widget_value = value
                self.on_setting_changed()
            else:
                self.bind_object.set_property(self.bind_prop, value)

        def get_widget_value(self):
            if is_combo:
                return self.get_value()
            else:
                return self.bind_object.get_property(self.bind_prop)

    return Widget(**kwargs)

class ClocksList(JSONSettingsList):
    def __init__(self, info, key, settings):
        self.region_map = {}
        self.region_list = []
        for tz in pytz.common_timezones:
            region, city = self.split_tz(tz)

            if region not in self.region_map:
                self.region_map[region] = []
                self.region_list.append((region, _(region)))
            self.region_map[region].append((city, _(city)))

        JSONSettingsList.__init__(self, key, settings, info)

        self.last_region = 'Europe'
        self.last_city = None
        if len(info['value']):
            self.last_region, self.last_city = self.split_tz(info['value'][0]['timezone'])

    def split_tz(self, tz):
        try:
            region, city = tz.split('/', maxsplit=1)
        except ValueError:
            region = TZ_NO_REGION
            city = tz
        return region, city

    def join_tz(self, region, city):
        if region == TZ_NO_REGION:
            tz = city
        else:
            tz = '/'.join([region, city])
        return tz

    def open_add_edit_dialog(self, info=None):
        if info is None:
            data = { "label": None, "region": self.last_region, "city": self.last_city }
            title = _("Add new entry")
        else:
            r, c = self.split_tz(info[1])
            data = { "label": info[0], "region": r, "city": c }
            title = _("Edit entry")

        dialog = Gtk.Dialog(title, self.get_toplevel(), Gtk.DialogFlags.MODAL,
                            (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                             Gtk.STOCK_OK, Gtk.ResponseType.OK))

        content_area = dialog.get_content_area()
        content_area.set_margin_right(30)
        content_area.set_margin_left(30)
        content_area.set_margin_top(20)
        content_area.set_margin_bottom(20)

        frame = Gtk.Frame()
        frame.set_shadow_type(Gtk.ShadowType.IN)
        frame_style = frame.get_style_context()
        frame_style.add_class("view")
        content_area.add(frame)

        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        frame.add(content)

        columns = [
            self.settings.get_property('worldclocks', 'columns')[0],
            {"id": "region", "title": _("Region"), "options": self.region_list},
            {"id": "city", "title": _("City"), "options": self.region_map[data['region']]}
        ]

        widgets = {}

        def on_widget_changed(bind_object):
            missing = [not widget.get_widget_value() for widget in widgets.values()]
            dialog.set_response_sensitive(Gtk.ResponseType.OK, not(True in missing))

        def on_region_changed(bind_object):
            region = bind_object.get_active_id()
            widgets['city'].set_options(self.region_map[region])
            widgets['city'].set_widget_value(None)

        for col in columns:
            if len(widgets) != 0:
                content.add(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

            widget = list_edit_factory(col)
            widget.bind_object.connect('changed', on_widget_changed)

            widgets[col['id']] = widget

            settings_box = Gtk.ListBox()
            settings_box.set_selection_mode(Gtk.SelectionMode.NONE)

            content.pack_start(settings_box, True, True, 0)
            settings_box.add(widget)

            if data[col['id']] is not None:
                widget.set_widget_value(data[col['id']])
            if col['id'] == 'region':
                widget.bind_object.connect('changed', on_region_changed)

        content_area.show_all()
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            label = widgets['label'].get_widget_value()
            self.last_region = widgets['region'].get_widget_value()
            self.last_city = widgets['city'].get_widget_value()

            timezone = self.join_tz(self.last_region, self.last_city)

            dialog.destroy()
            return [label, timezone]

        dialog.destroy()
        return None
