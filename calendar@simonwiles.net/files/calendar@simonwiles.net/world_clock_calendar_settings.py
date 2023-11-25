#!/usr/bin/env python3
#-*- coding:utf-8 -*-

""" Settings Dialogue for World Clock Calendar Applet """

__program_name__ = 'Settings Dialogue for World Clock Calendar Applet'
__author__ = 'Simon Wiles'
__email__ = 'simonjwiles@gmail.com'
__copyright__ = 'Copyright 2012, Simon Wiles'
__license__ = 'GPL http://www.gnu.org/licenses/gpl.txt'
__date__ = '2012-2013'

import argparse
import collections
import io
import os
import subprocess

import gi
gi.require_version('Gtk', '3.0')

from gi.repository import Gtk, GLib  # pylint: disable-msg=E0611

# prefer simplejson if available (it's faster), and fallback to json
#  (included in the standard library for Python >= 2.6) if not.
try:
    import simplejson as json
    JSONDecodeError = json.JSONDecodeError
except ImportError:
    import json
    class JSONDecodeError(Exception):
        pass

APPLET_DIR = os.path.dirname(os.path.abspath(__file__))

# i18n
#from gettext import gettext as _
import gettext
home = os.path.expanduser("~")
gettext.install("calendar@simonwiles.net", home + "/.local/share/locale")

class SettingsWindow(Gtk.Window):
    """ Build settings panel window """

    def __init__(self, args):
        metadata = json.load(io.open(
            os.path.join(APPLET_DIR, 'metadata.json'), 'r', encoding='utf8'))

        self.settings = AppletSettings(metadata['uuid'], args.instance_id)
        Gtk.Window.__init__(self, title=_(metadata['name']))

        self.set_size_request(400, 300)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.connect('delete-event', self._exit_application)
        self.connect('destroy', self._exit_application)

        frame = Gtk.Box(
            orientation=Gtk.Orientation.VERTICAL, border_width=10, spacing=10)

        hbox = Gtk.Box(
            orientation=Gtk.Orientation.HORIZONTAL, border_width=0, spacing=10)

        scrolled_window = Gtk.ScrolledWindow()
        scrolled_window.set_policy(
            Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        self.liststore_worldclocks = Gtk.ListStore(str, str)

        for item in self.settings.get('worldclocks'):
            self.liststore_worldclocks.append(item.split('|'))

        self.treeview = Gtk.TreeView(model=self.liststore_worldclocks)

        # Labels column
        cellrenderertext = Gtk.CellRendererText()
        cellrenderertext.set_property('editable', True)
        cellrenderertext.connect('edited', self._on_label_edited)
        col = Gtk.TreeViewColumn(_('Display Name'), cellrenderertext, text=0)
        col.set_property('resizable', True)
        col.set_expand(True)
        self.treeview.append_column(col)

        # Timezones column
        timezones = self._get_timezones()

        cellrendererautocomplete = CellRendererAutoComplete(
            timezones, match_anywhere=True, force_match=True)
        cellrendererautocomplete.set_property('editable', True)
        cellrendererautocomplete.connect('edited', self._on_tz_edited)
        col = Gtk.TreeViewColumn(_('Timezone'), cellrendererautocomplete, text=1)
        col.set_expand(True)
        self.treeview.append_column(col)

        # Allow enable drag and drop of rows including row move
        self.treeview.set_reorderable(True)

        scrolled_window.add(self.treeview)
        self.treeview.show()

        # right-hand buttons
        hbox.pack_start(scrolled_window, True, True, 0)
        align = Gtk.Alignment()
        align.set(0.5, 0.5, 0, 0)
        vbox = Gtk.VBox()

        buttons = (
            ('top', Gtk.STOCK_GOTO_TOP),
            ('up', Gtk.STOCK_GO_UP),
            ('down', Gtk.STOCK_GO_DOWN),
            ('bottom', Gtk.STOCK_GOTO_BOTTOM),
        )

        for button in buttons:
            img = Gtk.Image()
            img.set_from_stock(button[1], Gtk.IconSize.BUTTON)
            btn = Gtk.Button(image=img)
            btn.connect('clicked', self._reorder, button[0])
            vbox.pack_start(btn, False, False, 0)

        align.add(vbox)
        hbox.pack_end(align, False, False, 0)

        frame.pack_start(hbox, True, True, 0)

        # time format for World Clocks
        time_format = self.settings.get('worldclocks-timeformat')
        hbox = Gtk.HBox()
        label = Gtk.Label(_('Time format for World Clocks'))
        self.entry_timeformat = Gtk.Entry()
        hbox.pack_start(label, False, False, 5)
        hbox.add(self.entry_timeformat)
        self.entry_timeformat.set_text(time_format)
        frame.pack_start(hbox, False, False, 0)

        link_button = Gtk.LinkButton(
            'http://timezonedb.com/time-zones',
            _('Browse valid timezone values by country (online)')
        )
        frame.pack_start(link_button, False, False, 0)

        # bottom buttons
        box_buttons = Gtk.Box(
            orientation=Gtk.Orientation.HORIZONTAL, border_width=0, spacing=10)

        btn_add = Gtk.Button(stock=Gtk.STOCK_ADD)
        btn_add.connect('clicked', self._add_entry)
        box_buttons.pack_start(btn_add, False, False, 0)

        btn_remove = Gtk.Button(stock=Gtk.STOCK_REMOVE)
        btn_remove.connect('clicked', self._remove_entry)
        box_buttons.pack_start(btn_remove, False, False, 0)

        btn_close = Gtk.Button(stock=Gtk.STOCK_CLOSE)
        btn_close.connect('clicked', self._exit_application)
        box_buttons.pack_end(btn_close, False, False, 0)

        btn_clear = Gtk.Button(stock=Gtk.STOCK_CLEAR)
        btn_clear.connect('clicked', self._clear_entries)
        box_buttons.pack_end(btn_clear, False, False, 0)

        frame.pack_end(box_buttons, False, False, 0)

        frame.show_all()
        self.add(frame)
        self.show_all()

    @staticmethod
    def _get_timezones():
        """ load list of timezones that the system is aware of """

        timezones_tab = '/usr/share/zoneinfo/zone.tab'
        if not os.path.exists(timezones_tab):
            timezones_tab = '/usr/share/lib/zoneinfo/tab/zone_sun.tab'

        if not os.path.exists(timezones_tab):
            return []

        timezones = subprocess.check_output(
            ['/usr/bin/awk', '!/#/ {print $3}', timezones_tab])
        timezones = sorted(timezones.decode('utf-8').strip('\n').split('\n'))

        # https://github.com/simonwiles/cinnamon_applets/issues/7
        timezones.append('UTC')

        return timezones

    def _reorder(self, widget, action):
        tsel = self.treeview.get_selection()
        liststore, treeiter = tsel.get_selected()
        if treeiter is None:
            return
        if action == 'top':
            liststore.move_after(treeiter, None)
        if action == 'up' and liststore.get_string_from_iter(treeiter) != '0':
            liststore.move_before(treeiter, liststore.iter_previous(treeiter))
        if action == 'down' and \
           int(liststore.get_string_from_iter(treeiter)) + 1 != len(liststore):
            liststore.move_after(treeiter, liststore.iter_next(treeiter))
        if action == 'bottom':
            liststore.move_before(treeiter, None)

    def _on_label_edited(self, widget, path, new_value):
        self.liststore_worldclocks[path][0] = new_value
        return

    def _on_tz_edited(self, widget, path, new_value):
        self.liststore_worldclocks[path][1] = new_value
        return

    def _clear_entries(self, widget):
        self.liststore_worldclocks.clear()

    def _add_entry(self, widget):
        self.liststore_worldclocks.insert(
            len(self.liststore_worldclocks),
            (_('Coordinated Universal Time'), 'UTC')
        )

    def _remove_entry(self, widget):
        self.liststore_worldclocks.remove(
            self.treeview.get_selection().get_selected()[1])

    def _save_settings(self):
        self.settings.set(
            'worldclocks',
            ['|'.join(row) for row in self.liststore_worldclocks]
        )
        self.settings.set(
            'worldclocks-timeformat',
            self.entry_timeformat.get_text()
        )
        self.settings.save()

    def _exit_application(self, *args):
        try:
            self._save_settings()
        except:
            pass
        Gtk.main_quit()


class AppletSettings(object):

    def __init__(self, uuid, instance_id):

        _fn_basename = instance_id if instance_id is not None else uuid
        self.settings_json = os.path.join(GLib.get_user_config_dir(),
            'cinnamon', 'spices', uuid, '{}.json'.format(_fn_basename))
        if not os.path.exists(self.settings_json):
            #try old path for config files instead
            self.settings_json = os.path.expanduser(os.path.join(
                '~', '.cinnamon', 'configs', uuid, '{}.json'.format(_fn_basename)))

        try:
            with io.open(self.settings_json, 'r', encoding='utf8') as handle:
                self.settings = json.loads(
                    handle.read(), object_pairs_hook=collections.OrderedDict)
        except (IOError, ValueError, JSONDecodeError) as excptn:
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


class CellRendererAutoComplete(Gtk.CellRendererText):

    """ Text entry cell which binds a Gtk.EntryCompletion object """

    __gtype_name__ = 'CellRendererAutoComplete'

    def __init__(
            self, completion_entries, match_anywhere=False, force_match=False):

        self.completion_entries = completion_entries
        self.force_match = force_match

        self._liststore = Gtk.ListStore(str)
        for item in self.completion_entries:
            self._liststore.append((item,))

        self.completion = Gtk.EntryCompletion()
        self.completion.set_model(self._liststore)
        self.completion.set_text_column(0)

        if match_anywhere:
            def completion_match_func(completion, key, path, userdata):
                return key in self._liststore[path][0].lower()
            self.completion.set_match_func(completion_match_func, 0)

        Gtk.CellRendererText.__init__(self)

    def do_start_editing(
            self, event, treeview, path, background_area, cell_area, flags):
        if not self.get_property('editable'):
            return
        saved_text = self.get_property('text')

        entry = Gtk.Entry()
        entry.set_completion(self.completion)
        entry.set_text(saved_text)
        #entry.connect('editing-done', self.editing_done, path)
        entry.connect('focus-out-event', self.focus_out, path)

        entry.show()
        entry.grab_focus()
        return entry

    def focus_out(self, entry, event, path):
        """ to ensure that changes are saved when the dialogue is closed with
            the widget still focussed, I'm emitting 'edited' on this event
            instead of 'editing-done'. This is probably not the correct way,
            but it works very nicely :) """
        new_value = entry.get_text()
        if self.force_match and new_value not in self.completion_entries:
            return
        self.emit('edited', path, new_value)


def main():

    parser = argparse.ArgumentParser(description=__program_name__)

    parser.add_argument(
        '-i', '--instance-id', action='store', default=None,
        help='applet instance-id')

    SettingsWindow(parser.parse_args())
    Gtk.main()



if __name__ == "__main__":
    main()
