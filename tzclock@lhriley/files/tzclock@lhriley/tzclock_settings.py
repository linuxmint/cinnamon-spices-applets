#!/usr/bin/env python3
"""Settings Dialogue for Timezone Clock Applet."""
# -*- coding:utf-8 -*-

# Modified from original source in the Cinnamon project:
# https://github.com/linuxmint/cinnamon/blob/92b5c87c937212a96bd2e367df5f3c3d15b19e8b/files/usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py

# Additional code modified from calendar@simonwiles.net:
# https://github.com/linuxmint/cinnamon-spices-applets/tree/d172c5008c324212e258952964f28e3607bc90f5/calendar%40simonwiles.net

__program_name__ = 'Settings Dialogue for Timezone Clock Applet'
__author__ = 'l.h. riley'
__email__ = 'liam.h.riley@gmail.com'
__copyright__ = 'Copyright 2020, l.h. riley'
__license__ = 'GPL http://www.gnu.org/licenses/gpl.txt'
__date__ = '2020'

import argparse
import collections
import io
import os
import json
import pytz

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('TimezoneMap', '1.0')
from gi.repository import Gio, Gtk, GLib, TimezoneMap  # pylint: disable-msg=E0611

from xapp.GSettingsWidgets import *

APPLET_DIR = os.path.dirname(os.path.abspath(__file__))

# i18n
import gettext
home = os.path.expanduser("~")
gettext.install("tzclock@lhriley", home + "/.local/share/locale")


class SettingsWindow(Gtk.Window):
    """Timezone Clock settings window."""

    def __init__(self, args):
        print("Loading Timezone Clock applet")
        metadata = json.load(io.open(
            os.path.join(APPLET_DIR, 'metadata.json'), 'r', encoding='utf8'))

        self.settings = AppletSettings(metadata['uuid'], args.instance_id)
        self.zone = self.settings.get('displayed-timezone')

        Gtk.Window.__init__(self, title=gettext.gettext(metadata['name']))

        self.set_size_request(400, 300)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.connect('delete-event', self._exit_application)
        self.connect('destroy', self._exit_application)

        frame = Gtk.Box(
            orientation=Gtk.Orientation.VERTICAL, border_width=10, spacing=10)

        scrolled_window = Gtk.ScrolledWindow()
        scrolled_window.set_policy(
            Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        frame_text = Gtk.Label(xalign=0.05, yalign=0)
        frame_text.set_text(gettext.gettext("Timezone"))
        frame.add(frame_text)

        widget = SettingsWidget()
        self.tz_map = TimezoneMap.TimezoneMap.new()
        self.tz_map.set_size_request(-1, 205)
        widget.pack_start(self.tz_map, True, True, 0)
        frame.pack_start(widget, False, False, 0)

        self.tz_selector = TimeZoneSelector()
        frame.add(self.tz_selector)

        # bottom buttons
        box_buttons = Gtk.Box(
            orientation=Gtk.Orientation.HORIZONTAL, border_width=0, spacing=10)

        btn_close = Gtk.Button.new_with_mnemonic('Close')
        btn_close.connect('clicked', self._exit_application)
        box_buttons.pack_end(btn_close, False, False, 0)

        frame.pack_end(box_buttons, False, False, 0)

        frame.show_all()
        self.add(frame)
        self.show_all()

        if os.path.exists('/usr/sbin/ntpd'):
            print('using csd backend')
            self.proxy_handler = CsdDBusProxyHandler(self._on_proxy_ready)
        else:
            print('using systemd backend')
            self.proxy_handler = SytemdDBusProxyHandler(self._on_proxy_ready)

    def _on_proxy_ready(self):
        if self.zone is None:
            self.zone = self.proxy_handler.get_timezone()

        mapzone = self.zone
        if mapzone.lower() == 'etc/utc':
            mapzone = 'Atlantic/Reykjavik'

        self.tz_map.set_timezone(mapzone)
        self.tz_map.connect('location-changed', self.on_map_location_changed)
        self.tz_selector.set_timezone(self.zone)
        self.tz_selector.connect('timezone-changed', self.on_selector_location_changed)

    def on_map_location_changed(self, *args):
        mapzone = self.tz_map.get_location().props.zone
        if mapzone == self.zone:
            return
        elif self.zone == 'Etc/UTC' and mapzone == 'Atlantic/Reykjavik':
            return

        self.set_timezone(mapzone)
        self.tz_selector.set_timezone(self.mapzone)

    def on_selector_location_changed(self, *args):
        zone = self.tz_selector.get_timezone()
        if zone == self.zone:
            return

        self.set_timezone(zone)
        self.tz_map.set_timezone(self.mapzone)

    def set_timezone(self, zone):
        self.zone = zone

        if self.zone == 'Etc/UTC':
            self.mapzone = 'Atlantic/Reykjavik'
        else:
            self.mapzone = self.zone

    def _save_settings(self):
        self.settings.set(
            'displayed-timezone',
            self.zone
        )
        self.settings.save()

    def _exit_application(self, *args):
        try:
            self._save_settings()
        except:
            pass
        Gtk.main_quit()


class SytemdDBusProxyHandler(object):
    def __init__(self, proxy_ready_callback):
        self.proxy_ready_callback = proxy_ready_callback
        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, None,
                                      'org.freedesktop.timedate1',
                                      '/org/freedesktop/timedate1',
                                      'org.freedesktop.timedate1',
                                      None, self._on_proxy_ready, None)

        except dbus.exceptions.DBusException as e:
            print(e)
            self._proxy = None

    def _on_proxy_ready(self, object, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        self.proxy_ready_callback()

    def get_timezone(self):
        if not self._proxy:
            return None
        return str(self._proxy.get_cached_property('Timezone')).lstrip('\'').rstrip('\'')


class CsdDBusProxyHandler(object):
    def __init__(self, proxy_ready_callback):
        self.proxy_ready_callback = proxy_ready_callback
        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, None,
                                      'org.cinnamon.SettingsDaemon.DateTimeMechanism',
                                      '/',
                                      'org.cinnamon.SettingsDaemon.DateTimeMechanism',
                                      None, self._on_proxy_ready, None)

        except dbus.exceptions.DBusException as e:
            print(e)
            self._proxy = None

    def _on_proxy_ready(self, object, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        self.proxy_ready_callback()

    def get_timezone(self):
        return self._proxy.GetTimezone()


class TimeZoneSelector(SettingsWidget):
    __gsignals__ = {
        'timezone-changed': (GObject.SignalFlags.RUN_FIRST, None, (str,))
    }

    def __init__(self):
        super(TimeZoneSelector, self).__init__()

        self.pack_start(Gtk.Label(label=gettext.gettext("Region")), False, False, 0)
        self.region_combo = Gtk.ComboBox()
        self.pack_start(self.region_combo, False, False, 0)
        self.pack_start(Gtk.Label(label=gettext.gettext("City")), False, False, 0)
        self.city_combo = Gtk.ComboBox()
        self.pack_start(self.city_combo, False, False, 0)
        self.region_combo.connect('changed', self.on_region_changed)
        self.city_combo.connect('changed', self.on_city_changed)

        self.region_list = Gtk.ListStore(str, str)
        self.region_combo.set_model(self.region_list)
        renderer_text = Gtk.CellRendererText()
        self.region_combo.pack_start(renderer_text, True)
        self.region_combo.add_attribute(renderer_text, "text", 1)
        self.region_combo.set_id_column(0)

        renderer_text = Gtk.CellRendererText()
        self.city_combo.pack_start(renderer_text, True)
        self.city_combo.add_attribute(renderer_text, "text", 1)
        self.city_combo.set_id_column(0)

        self.region_map = {}
        tz_list = pytz.common_timezones
        tz_list.insert(0, 'Etc/UTC')

        for tz in tz_list:
            try:
                region, city = tz.split('/', maxsplit=1)
            except:
                continue

            if region not in self.region_map:
                self.region_map[region] = Gtk.ListStore(str, str)
                self.region_list.append([region, gettext.gettext(region)])
            self.region_map[region].append([city, gettext.gettext(city)])

    def set_timezone(self, timezone):
        self.timezone = timezone
        region, city = timezone.split('/', maxsplit=1)
        self.region_combo.set_active_id(region)
        self.city_combo.set_model(self.region_map[region])
        self.city_combo.set_active_id(city)

    def on_region_changed(self, *args):
        region = self.region_combo.get_active_id()
        self.city_combo.set_model(self.region_map[region])

    def on_city_changed(self, *args):
        self.timezone = '/'.join([self.region_combo.get_active_id(), self.city_combo.get_active_id()])
        self.emit('timezone-changed', self.timezone)

    def get_timezone(self):
        return self.timezone


class AppletSettings(object):

    def __init__(self, uuid, instance_id):

        _fn_basename = instance_id if instance_id is not None else uuid
        self.settings_json = os.path.expanduser(os.path.join(
            '~', '.cinnamon', 'configs', uuid, '{}.json'.format(_fn_basename)))

        try:
            with io.open(self.settings_json, 'r', encoding='utf8') as handle:
                self.settings = json.loads(
                    handle.read(), object_pairs_hook=collections.OrderedDict)
        except (IOError, ValueError, json.JSONDecodeError) as excptn:
            default_schema = os.path.join(APPLET_DIR, 'settings-schema.json')
            with io.open(default_schema, 'r', encoding='utf8') as handle:
                self.settings = json.loads(
                    handle.read(), object_pairs_hook=collections.OrderedDict)

    def get(self, key):
        try:
            return self.settings[key]['value']

        except KeyError as excptn:
            return self.settings[key]['default']

    def set(self, key, value):
        self.settings[key]['value'] = value

    def save(self):
        with io.open(self.settings_json, 'w', encoding='utf-8') as handle:
            handle.write(str(json.dumps(
                self.settings, ensure_ascii=True, indent=2)))


# Source: https://github.com/linuxmint/cinnamon/blob/92b5c87c937212a96bd2e367df5f3c3d15b19e8b/files/usr/share/cinnamon/cinnamon-settings/bin/SettingsWidgets.py
class SettingsWidget(Gtk.Box):
    def __init__(self, dep_key=None):
        Gtk.Box.__init__(self)
        self.set_orientation(Gtk.Orientation.HORIZONTAL)
        self.set_spacing(20)
        self.set_border_width(5)
        self.set_margin_start(20)
        self.set_margin_end(20)


class SettingsSection(Gtk.Box):
    def __init__(self, title=None, subtitle=None):
        Gtk.Box.__init__(self, orientation=Gtk.Orientation.VERTICAL)
        self.set_spacing(10)

        self.always_show = False
        self.revealers = []

        if title or subtitle:
            header_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            header_box.set_spacing(5)
            self.add(header_box)

            if title:
                label = Gtk.Label()
                label.set_markup("<b>%s</b>" % title)
                label.set_alignment(0, 0.5)
                header_box.add(label)

            if subtitle:
                sub = Gtk.Label()
                sub.set_text(subtitle)
                sub.get_style_context().add_class("dim-label")
                sub.set_alignment(0, 0.5)
                header_box.add(sub)

        self.frame = Gtk.Frame()
        self.frame.set_no_show_all(True)
        self.frame.set_shadow_type(Gtk.ShadowType.IN)
        frame_style = self.frame.get_style_context()
        frame_style.add_class("view")
        self.size_group = Gtk.SizeGroup()
        self.size_group.set_mode(Gtk.SizeGroupMode.VERTICAL)

        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.frame.add(self.box)
        self.add(self.frame)

        self.need_separator = False

    def add_row(self, widget):
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        if self.need_separator:
            vbox.add(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))
        list_box = Gtk.ListBox()
        list_box.set_selection_mode(Gtk.SelectionMode.NONE)
        row = Gtk.ListBoxRow(can_focus=False)
        row.add(widget)
        if isinstance(widget, Switch):
            list_box.connect("row-activated", widget.clicked)
        list_box.add(row)
        vbox.add(list_box)
        self.box.add(vbox)

        self.update_always_show_state()

        self.need_separator = True

    def add_reveal_row(self, widget, schema=None, key=None, values=None, check_func=None, revealer=None):
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        if self.need_separator:
            vbox.add(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))
        list_box = Gtk.ListBox()
        list_box.set_selection_mode(Gtk.SelectionMode.NONE)
        row = Gtk.ListBoxRow(can_focus=False)
        row.add(widget)
        if isinstance(widget, Switch):
            list_box.connect("row-activated", widget.clicked)
        list_box.add(row)
        vbox.add(list_box)
        if revealer is None:
            revealer = SettingsRevealer(schema, key, values, check_func)
        widget.revealer = revealer
        revealer.add(vbox)
        self.box.add(revealer)

        self.need_separator = True

        self.revealers.append(revealer)
        if not self.always_show:
            revealer.notify_id = revealer.connect('notify::child-revealed', self.check_reveal_state)
            self.check_reveal_state()

        return revealer

    def add_note(self, text):
        label = Gtk.Label()
        label.set_alignment(0, 0.5)
        label.set_markup(text)
        label.set_line_wrap(True)
        self.add(label)
        return label

    def update_always_show_state(self):
        if self.always_show:
            return

        self.frame.set_no_show_all(False)
        self.frame.show_all()
        self.always_show = True

        for revealer in self.revealers:
            revealer.disconnect(revealer.notify_id)

    def check_reveal_state(self, *args):
        for revealer in self.revealers:
            if revealer.props.child_revealed:
                self.box.show_all()
                self.frame.show()
                return

        self.frame.hide()


def main():
    parser = argparse.ArgumentParser(description=__program_name__)

    parser.add_argument(
        '-i', '--instance-id', action='store', default=None,
        help='applet instance-id')

    SettingsWindow(parser.parse_args())
    Gtk.main()


if __name__ == "__main__":
    main()
