#!/usr/bin/python3
import os
import re
import sys
import gettext
import gi

gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gio, Gtk

from JsonSettingsWidgets import SettingsWidget

UUID = 'ShutdownMenu-change@yoo'
gettext.install(UUID, GLib.get_user_data_dir() + '/locale')


# ============================================================
#  桌面文件解析
# ============================================================
def parse_desktop_file(path):
    kf = GLib.KeyFile()
    try:
        kf.load_from_file(path, GLib.KeyFileFlags.NONE)
    except GLib.Error:
        return None

    def get(key):
        try:
            return kf.get_locale_string('Desktop Entry', key, None)
        except GLib.Error:
            try:
                return kf.get_string('Desktop Entry', key)
            except GLib.Error:
                return ''

    name = get('Name')
    icon = get('Icon') or 'application-x-executable'
    command = get('Exec')
    command = re.sub(r'\s+%[uUfFiIcCkK]', '', command).strip()
    command = re.sub(r'%[uUfFiIcCkK]', '', command).strip()

    if not name or not command:
        return None
    return {'name': name, 'icon': icon, 'command': command, 'type': 'command'}


# ============================================================
#  图标 -> Gio.Icon
# ============================================================
def make_gicon(icon_str):
    if not icon_str:
        return Gio.ThemedIcon.new('application-x-executable')
    if icon_str.startswith('/') and os.path.isfile(icon_str):
        return Gio.FileIcon.new(Gio.File.new_for_path(icon_str))
    return Gio.ThemedIcon.new(icon_str)


# ============================================================
#  IconPickerRow
# ============================================================
class IconPickerRow(SettingsWidget):
    _KEY_MAP = {
        'quit_icon_widget':        'quit_icon',
        'log_out_icon_widget':     'log_out_icon',
        'screen_lock_icon_widget': 'screen_lock_icon',
        'quit_icon':               'quit_icon',
        'log_out_icon':            'log_out_icon',
        'screen_lock_icon':        'screen_lock_icon',
    }

    def __init__(self, info, key, settings):
        super().__init__()
        self.widget_key = key
        self.settings = settings
        self.info = info
        self.data_key = self._KEY_MAP.get(key, key)
        self._updating = False

        self.set_orientation(Gtk.Orientation.HORIZONTAL)
        self.set_spacing(6)

        # ---- 左侧标签 ----
        label_text = ''
        if info and info.get('description'):
            label_text = info.get('description', '')
        self.label = Gtk.Label(label=label_text)
        self.label.set_halign(Gtk.Align.START)
        self.label.set_valign(Gtk.Align.CENTER)
        self.label.set_xalign(0.0)
        self.label.set_width_chars(min(len(label_text) + 1, 28))
        self.pack_start(self.label, False, False, 0)

        # ---- 输入框（不在此处读设置，延迟到 idle）----
        self.entry = Gtk.Entry()
        self.entry.set_hexpand(True)
        self.entry.connect('changed', self._on_entry_changed)
        self.pack_start(self.entry, True, True, 0)

        # ---- 选择按钮 ----
        self.button = Gtk.Button()
        self.button.set_tooltip_text(_('Choose icon file'))
        img = Gtk.Image.new_from_icon_name('document-open-symbolic',
                                           Gtk.IconSize.BUTTON)
        self.button.set_image(img)
        self.button.connect('clicked', self._on_button_clicked)
        self.pack_start(self.button, False, False, 0)

        # 监听外部设置变更
        try:
            self.settings.listen(self.data_key, self._on_setting_changed)
        except Exception:
            pass

        self.show_all()

        # ★ 延迟读取初始值，避免打开设置面板时同步阻塞
        GLib.idle_add(self._init_from_settings)

    def _init_from_settings(self):
        # 若 Cinnamon 已经通过 set_value 填过值，就不再覆盖
        if self.entry.get_text().strip():
            return GLib.SOURCE_REMOVE
        try:
            v = self.settings.get_value(self.data_key) or ''
        except Exception:
            v = ''
        if not v and self.info:
            v = self.info.get('default', '')
        if v:
            self._updating = True
            try:
                self.entry.set_text(v)
            finally:
                self._updating = False
        return GLib.SOURCE_REMOVE

    def set_value(self, value):
        # custom key 没有实际存储值，Cinnamon 会用空值调用，
        # 此时不应覆盖 entry 里从 data_key 读到的内容。
        if value:
            try:
                self.entry.set_text(value)
            except Exception:
                pass

    def _on_setting_changed(self, key, value):
        if self._updating:
            return
        try:
            current = self.entry.get_text().strip()
            new_val = value or ''
            if current != new_val:
                self._updating = True
                self.entry.set_text(new_val)
        except Exception:
            pass
        finally:
            self._updating = False

    def _on_entry_changed(self, *args):
        if self._updating:
            return
        try:
            self.settings.set_value(self.data_key,
                                    self.entry.get_text().strip())
        except Exception:
            pass

    def _on_button_clicked(self, *args):
        current = self.entry.get_text().strip()
        chosen = self._choose_file(current)
        if chosen and chosen != current:
            self.entry.set_text(chosen)

    def _parent_window(self):
        try:
            p = self.get_toplevel()
            if isinstance(p, Gtk.Window):
                return p
        except Exception:
            pass
        return None

    def _choose_file(self, current):
        try:
            dlg = Gtk.FileChooserDialog(
                title=_('Choose icon file'),
                transient_for=self._parent_window(),
                action=Gtk.FileChooserAction.OPEN)
            dlg.add_buttons(_('Cancel'), Gtk.ResponseType.CANCEL,
                            _('Open'), Gtk.ResponseType.OK)
            dlg.set_default_size(720, 520)

            f_img = Gtk.FileFilter()
            f_img.set_name(_('Image files'))
            for mime in ('image/png', 'image/svg+xml', 'image/x-icon',
                         'image/x-xpixmap', 'image/jpeg', 'image/gif',
                         'image/webp'):
                f_img.add_mime_type(mime)
            for pat in ('*.png', '*.svg', '*.xpm', '*.ico',
                        '*.jpg', '*.jpeg', '*.gif', '*.webp'):
                f_img.add_pattern(pat)
            dlg.add_filter(f_img)

            f_all = Gtk.FileFilter()
            f_all.set_name(_('All files'))
            f_all.add_pattern('*')
            dlg.add_filter(f_all)

            if current and current.startswith('/'):
                d = os.path.dirname(current)
                if os.path.isdir(d):
                    dlg.set_current_folder(d)
            else:
                for p in ['/usr/share/icons',
                          '/usr/share/pixmaps',
                          os.path.expanduser('~/.local/share/icons'),
                          os.path.expanduser('~/.icons')]:
                    if os.path.isdir(p):
                        dlg.set_current_folder(p)
                        break

            path = None
            if dlg.run() == Gtk.ResponseType.OK:
                path = dlg.get_filename()
            dlg.destroy()
            return path or current
        except Exception as e:
            print('IconPickerRow file chooser error:', e, file=sys.stderr)
            return current


# ============================================================
#  自定义菜单项编辑对话框
# ============================================================
class EditDialog(Gtk.Dialog):
    def __init__(self, parent, name='', icon='', command=''):
        super().__init__(title=_('Edit item'),
                         transient_for=parent, modal=True)
        self.add_buttons(_('Cancel'), Gtk.ResponseType.CANCEL,
                         _('OK'), Gtk.ResponseType.OK)
        self.set_default_size(420, -1)

        box = self.get_content_area()
        box.set_spacing(8)
        box.set_margin_start(12)
        box.set_margin_end(12)
        box.set_margin_top(12)
        box.set_margin_bottom(12)

        grid = Gtk.Grid(column_spacing=8, row_spacing=8)
        box.add(grid)

        grid.attach(Gtk.Label(label=_('Name'), halign=Gtk.Align.START), 0, 0, 1, 1)
        self.name_entry = Gtk.Entry(text=name, hexpand=True)
        grid.attach(self.name_entry, 1, 0, 1, 1)

        grid.attach(Gtk.Label(label=_('Icon'), halign=Gtk.Align.START), 0, 1, 1, 1)
        icon_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        self.icon_entry = Gtk.Entry(text=icon, hexpand=True)
        self.icon_entry.connect('changed', self._on_icon_changed)
        icon_box.pack_start(self.icon_entry, True, True, 0)
        self.icon_preview = Gtk.Image()
        icon_box.pack_start(self.icon_preview, False, False, 0)
        grid.attach(icon_box, 1, 1, 1, 1)

        grid.attach(Gtk.Label(label=_('Command'), halign=Gtk.Align.START), 0, 2, 1, 1)
        self.command_entry = Gtk.Entry(text=command, hexpand=True)
        grid.attach(self.command_entry, 1, 2, 1, 1)

        self.show_all()
        self._refresh_preview()

    def _on_icon_changed(self, *args):
        self._refresh_preview()

    def _refresh_preview(self):
        name = self.icon_entry.get_text().strip()
        gicon = make_gicon(name or 'application-x-executable')
        try:
            self.icon_preview.set_from_gicon(gicon, Gtk.IconSize.LARGE_TOOLBAR)
        except Exception:
            self.icon_preview.clear()

    def get_values(self):
        return {
            'name': self.name_entry.get_text().strip(),
            'icon': self.icon_entry.get_text().strip() or 'application-x-executable',
            'command': self.command_entry.get_text().strip(),
            'type': 'command',
        }


# ============================================================
#  自定义菜单项列表编辑器
# ============================================================
class CustomAppList(SettingsWidget):
    def __init__(self, info, key, settings):
        super().__init__()
        self.key = "custom_items"
        self.settings = settings
        self.info = info
        self._saving = False

        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(6)
        self.set_margin_start(8)
        self.set_margin_end(8)
        self.set_margin_top(8)
        self.set_margin_bottom(8)

        toolbar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        self.pack_start(toolbar, False, False, 0)

        def add_tool_button(icon_name, tooltip, callback):
            btn = Gtk.Button.new_from_icon_name(icon_name, Gtk.IconSize.BUTTON)
            btn.set_tooltip_text(tooltip)
            btn.connect('clicked', callback)
            toolbar.pack_start(btn, False, False, 0)
            return btn

        self.add_app_btn = add_tool_button('list-add-symbolic',
            _('Add application from .desktop'), self.on_add_app)
        self.add_custom_btn = add_tool_button('insert-text-symbolic',
            _('Add custom command'), self.on_add_custom)
        self.edit_btn = add_tool_button('document-edit-symbolic',
            _('Edit selected'), self.on_edit)
        self.remove_btn = add_tool_button('list-remove-symbolic',
            _('Remove selected'), self.on_remove)
        self.up_btn = add_tool_button('go-up-symbolic',
            _('Move up'), self.on_move_up)
        self.down_btn = add_tool_button('go-down-symbolic',
            _('Move down'), self.on_move_down)

        # 使用 Gio.Icon 而非 Pixbuf，让 Gtk 按需渲染，提升启动速度
        self.store = Gtk.ListStore(Gio.Icon, str, str, str)

        self.tree_view = Gtk.TreeView(model=self.store)
        self.tree_view.set_headers_visible(True)

        renderer_icon = Gtk.CellRendererPixbuf()
        renderer_icon.set_property('stock-size', Gtk.IconSize.LARGE_TOOLBAR)
        column_icon = Gtk.TreeViewColumn(_('Icon'), renderer_icon, gicon=0)
        column_icon.set_min_width(40)
        self.tree_view.append_column(column_icon)

        renderer_name = Gtk.CellRendererText()
        column_name = Gtk.TreeViewColumn(_('Name'), renderer_name, text=1)
        column_name.set_expand(True)
        self.tree_view.append_column(column_name)

        renderer_cmd = Gtk.CellRendererText()
        column_cmd = Gtk.TreeViewColumn(_('Command'), renderer_cmd, text=3)
        column_cmd.set_expand(True)
        self.tree_view.append_column(column_cmd)

        selection = self.tree_view.get_selection()
        selection.set_mode(Gtk.SelectionMode.SINGLE)
        selection.connect('changed', self._update_buttons)

        scroll = Gtk.ScrolledWindow()
        scroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        scroll.set_min_content_height(260)
        scroll.set_shadow_type(Gtk.ShadowType.IN)
        scroll.add(self.tree_view)
        self.pack_start(scroll, True, True, 0)

        self._update_buttons()

        # 监听外部设置变更
        try:
            self.settings.listen(self.key, self._on_settings_changed)
        except Exception:
            pass

        # 延迟加载数据，让设置面板先显示出来
        GLib.idle_add(self._deferred_load)

    def _deferred_load(self):
        self._load()
        self._update_buttons()
        return GLib.SOURCE_REMOVE

    def _on_settings_changed(self, key, value):
        if self._saving:
            return
        self._load()
        self._update_buttons()

    def _load(self):
        self.store.clear()
        items = self.settings.get_value(self.key) or []
        for item in items:
            if not isinstance(item, dict):
                continue
            name = item.get('name', '')
            if name == '-':
                self.store.append([make_gicon('list-remove-symbolic'),
                                   '-', '-', item.get('command', '')])
                continue
            icon = item.get('icon') or 'application-x-executable'
            self.store.append([make_gicon(icon), name, icon,
                               item.get('command', '')])

    def _save(self):
        self._saving = True
        try:
            items = []
            for row in self.store:
                name = row[1] or ''
                if name == '-':
                    items.append({'name': '-', 'icon': '', 'command': ''})
                    continue
                items.append({
                    'name': name,
                    'icon': row[2] or '',
                    'command': row[3] or '',
                    'type': 'command',
                })
            self.settings.set_value(self.key, items)
        finally:
            self._saving = False

    def _selected_iter(self):
        model, it = self.tree_view.get_selection().get_selected()
        return it

    def _update_buttons(self, *args):
        has = self._selected_iter() is not None
        self.edit_btn.set_sensitive(has)
        self.remove_btn.set_sensitive(has)
        self.up_btn.set_sensitive(has)
        self.down_btn.set_sensitive(has)

    def on_add_app(self, *args):
        dialog = Gtk.FileChooserDialog(
            title=_('Select application'),
            transient_for=self.get_toplevel(),
            action=Gtk.FileChooserAction.OPEN)
        dialog.add_buttons(_('Cancel'), Gtk.ResponseType.CANCEL,
                           _('Open'), Gtk.ResponseType.OK)
        dialog.set_default_size(720, 520)

        f = Gtk.FileFilter()
        f.set_name(_('Desktop files (*.desktop)'))
        f.add_pattern('*.desktop')
        dialog.add_filter(f)

        for path in ['/usr/share/applications',
                     os.path.expanduser('~/.local/share/applications')]:
            if os.path.isdir(path):
                dialog.set_current_folder(path)
                break

        if dialog.run() == Gtk.ResponseType.OK:
            file_path = dialog.get_filename()
            dialog.destroy()
            data = parse_desktop_file(file_path)
            if data:
                self.store.append([make_gicon(data['icon']),
                                   data['name'], data['icon'], data['command']])
                self._save()
            else:
                md = Gtk.MessageDialog(
                    transient_for=self.get_toplevel(),
                    message_type=Gtk.MessageType.ERROR,
                    buttons=Gtk.ButtonsType.OK,
                    text=_('Invalid .desktop file'))
                md.run()
                md.destroy()
        else:
            dialog.destroy()

    def on_add_custom(self, *args):
        dlg = EditDialog(self.get_toplevel())
        if dlg.run() == Gtk.ResponseType.OK:
            data = dlg.get_values()
            dlg.destroy()
            is_sep = (data['name'] == '-')
            if data['name'] and (data['command'] or is_sep):
                if is_sep:
                    self.store.append([make_gicon('list-remove-symbolic'),
                                       '-', '-', ''])
                else:
                    self.store.append([make_gicon(data['icon']),
                                       data['name'], data['icon'],
                                       data['command']])
                self._save()
        else:
            dlg.destroy()

    def on_edit(self, *args):
        it = self._selected_iter()
        if it is None:
            return
        row = self.store[it]
        dlg = EditDialog(self.get_toplevel(),
                         name=row[1] or '',
                         icon=row[2] or '',
                         command=row[3] or '')
        if dlg.run() == Gtk.ResponseType.OK:
            data = dlg.get_values()
            dlg.destroy()
            is_sep = (data['name'] == '-')
            if data['name'] and (data['command'] or is_sep):
                if is_sep:
                    self.store[it] = [make_gicon('list-remove-symbolic'),
                                      '-', '-', '']
                else:
                    self.store[it] = [make_gicon(data['icon']),
                                      data['name'], data['icon'],
                                      data['command']]
                self._save()
        else:
            dlg.destroy()

    def on_remove(self, *args):
        it = self._selected_iter()
        if it is None:
            return
        self.store.remove(it)
        self._save()

    def on_move_up(self, *args):
        it = self._selected_iter()
        if it is None:
            return
        prev = self.store.iter_previous(it)
        if prev is not None:
            self.store.swap(it, prev)
            self._save()

    def on_move_down(self, *args):
        it = self._selected_iter()
        if it is None:
            return
        nxt = self.store.iter_next(it)
        if nxt is not None:
            self.store.swap(it, nxt)
            self._save()