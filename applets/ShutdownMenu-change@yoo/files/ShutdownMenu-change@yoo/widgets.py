#!/usr/bin/python3
import os
import re
import sys
import json
import gettext
import gi

gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gio, Gtk

from JsonSettingsWidgets import SettingsWidget

UUID = 'ShutdownMenu-change@yoo'
SCENES_DIR = os.path.join(GLib.get_user_data_dir(), 'ShutdownMenu-change@yoo')
SCENES_FILE = os.path.join(SCENES_DIR, 'scenes.json')
gettext.install(UUID, GLib.get_user_data_dir() + '/locale')


# 首次运行时注入的默认自定义项（与 applet.js 的 DEFAULT_CUSTOM_ITEM 保持一致）
DEFAULT_CUSTOM_ITEM = {
    'name': 'Neofetch',
    'icon': 'linuxmint-logo-badge-symbolic',
    'command': "x-terminal-emulator -e bash -c 'neofetch; exec bash'",
    'type': 'command',
}

# 虚拟"Default"场景使用的默认快照（与 settings-schema.json 中的 default 值保持一致）
DEFAULT_SNAPSHOT = {
    'panel_icon': 'system-shutdown-symbolic',
    'icon_size': 24,
    'scroll_switch': False,
    'middle_click_action': 'nothing',
    'quit': True,
    'quit_icon': 'system-shutdown',
    'quit_cmd': 'cinnamon-session-quit --power-off',
    'show_separator': True,
    'log_out': True,
    'log_out_icon': 'system-log-out',
    'log_out_cmd': 'cinnamon-session-quit --logout',
    'screen_lock': True,
    'screen_lock_icon': 'system-lock-screen',
    'screen_lock_cmd': 'cinnamon-screensaver-command --lock',
    'custom_items': [dict(DEFAULT_CUSTOM_ITEM)],
    'custom_position': 0,
    'show_custom_separator': True,
    'menu_text_size': 0,
    'menu_icon_size': 24,
    'custom_grid_mode': False,
    'custom_grid_hide_builtin': False,
    'custom_grid_columns': 3,
    'custom_grid_cell_width': 0,
    'custom_grid_cell_height': 0,
    'custom_grid_show_label': False,
    'custom_grid_icon_size': 40,
    'custom_grid_label_spacing': 6,
}


def parse_desktop_file(path):
    """解析 .desktop 文件，返回 {name, icon, command, type}；失败返回 None。"""
    kf = GLib.KeyFile()
    try:
        kf.load_from_file(path, GLib.KeyFileFlags.NONE)
    except GLib.Error:
        return None

    def get(key):
        # 优先本地化名称（Name[zh_CN]），回退到 Name
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
    # 去掉 Exec 中的 %u %U %f %F 等占位符
    command = re.sub(r'\s+%[uUfFiIcCkK]', '', command).strip()
    command = re.sub(r'%[uUfFiIcCkK]', '', command).strip()

    if not name or not command:
        return None
    return {'name': name, 'icon': icon, 'command': command, 'type': 'command'}


def make_gicon(icon_str):
    """把图标字符串转成 GIcon，供 Gtk.TreeView / Gtk.Image 使用。"""
    if not icon_str:
        return Gio.ThemedIcon.new('application-x-executable')
    if icon_str.startswith('/') and os.path.isfile(icon_str):
        return Gio.FileIcon.new(Gio.File.new_for_path(icon_str))
    return Gio.ThemedIcon.new(icon_str)


# ============================================================
#  内置项图标选择器
#  输入框 + 文件选择按钮 + 预览图，数据写到对应的非 widget 键
# ============================================================

class IconPickerRow(SettingsWidget):
    # widget key → 实际存储值的 settings key
    _KEY_MAP = {
        'quit_icon_widget':        'quit_icon',
        'log_out_icon_widget':     'log_out_icon',
        'screen_lock_icon_widget': 'screen_lock_icon',
    }

    def __init__(self, info, key, settings):
        super().__init__()
        self.widget_key = key
        self.settings = settings
        self.info = info
        self.data_key = self._KEY_MAP.get(key, key)
        # 防止"读设置 → 改 entry → 写设置"的回环
        self._updating = False

        self.set_orientation(Gtk.Orientation.HORIZONTAL)
        self.set_spacing(6)

        # 左侧标签（描述文本左对齐）
        label_text = ''
        if info and info.get('description'):
            label_text = info.get('description', '')
        self.label = Gtk.Label(label=label_text)
        self.label.set_halign(Gtk.Align.START)
        self.label.set_valign(Gtk.Align.CENTER)
        self.label.set_xalign(0.0)
        self.label.set_width_chars(min(len(label_text) + 1, 28))
        self.pack_start(self.label, False, False, 0)

        # 输入框：初始值延后到 idle 读取，避免打开设置面板时同步阻塞
        self.entry = Gtk.Entry()
        self.entry.set_hexpand(True)
        self.entry.connect('changed', self._on_entry_changed)
        self.pack_start(self.entry, True, True, 0)

        # 预览图：尺寸固定 24×24，延迟到 idle 填充
        self.preview = Gtk.Image()
        self.preview.set_size_request(24, 24)
        self.pack_start(self.preview, False, False, 0)

        # 文件选择按钮
        self.button = Gtk.Button()
        self.button.set_tooltip_text(_('Choose icon file'))
        img = Gtk.Image.new_from_icon_name('document-open-symbolic',
                                           Gtk.IconSize.BUTTON)
        self.button.set_image(img)
        self.button.connect('clicked', self._on_button_clicked)
        self.pack_start(self.button, False, False, 0)

        # 监听设置变更，外部改动时同步刷新输入框
        try:
            self.settings.listen(self.data_key, self._on_setting_changed)
        except Exception:
            pass

        self.show_all()

        # 延迟初始化：先显示面板，再填值 + 加载预览
        GLib.idle_add(self._init_from_settings)

    def _init_from_settings(self):
        # 若 Cinnamon 已通过 set_value 填过值，不再覆盖
        if not self.entry.get_text().strip():
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
        self._refresh_preview()
        return GLib.SOURCE_REMOVE

    def set_value(self, value):
        # custom key 无实际存储值，Cinnamon 用空值调用；此处不应覆盖 entry
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
        self._refresh_preview()

    def _on_entry_changed(self, *args):
        if self._updating:
            return
        try:
            self.settings.set_value(self.data_key,
                                    self.entry.get_text().strip())
        except Exception:
            pass
        self._refresh_preview()

    def _on_button_clicked(self, *args):
        current = self.entry.get_text().strip()
        chosen = self._choose_file(current)
        if chosen and chosen != current:
            self.entry.set_text(chosen)

    def _refresh_preview(self):
        """根据当前输入值刷新预览图；无效或为空时清空。"""
        name = self.entry.get_text().strip()
        if not name:
            self.preview.clear()
            return
        if name.startswith('/'):
            if not os.path.isfile(name):
                self.preview.clear()
                return
            gicon = Gio.FileIcon.new(Gio.File.new_for_path(name))
        else:
            theme = Gtk.IconTheme.get_default()
            if theme.lookup_icon(name, 24, Gtk.IconLookupFlags.FORCE_SIZE) is None:
                self.preview.clear()
                return
            gicon = Gio.ThemedIcon.new(name)
        try:
            self.preview.set_from_gicon(gicon, Gtk.IconSize.BUTTON)
        except Exception:
            self.preview.clear()

    def _parent_window(self):
        try:
            p = self.get_toplevel()
            if isinstance(p, Gtk.Window):
                return p
        except Exception:
            pass
        return None

    def _choose_file(self, current):
        """打开文件选择器；若当前值是绝对路径，定位到其所在目录。"""
        try:
            dlg = Gtk.FileChooserDialog(
                title=_('Choose icon file'),
                transient_for=self._parent_window(),
                action=Gtk.FileChooserAction.OPEN)
            dlg.add_buttons(_('Cancel'), Gtk.ResponseType.CANCEL,
                            _('Open'), Gtk.ResponseType.OK)
            dlg.set_default_size(720, 520)

            # 图片过滤器
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
#  自定义菜单项的编辑对话框
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

        # 名称
        grid.attach(Gtk.Label(label=_('Name'), halign=Gtk.Align.START), 0, 0, 1, 1)
        self.name_entry = Gtk.Entry(text=name, hexpand=True)
        grid.attach(self.name_entry, 1, 0, 1, 1)

        # 图标（输入框 + 实时预览 + 浏览按钮）
        grid.attach(Gtk.Label(label=_('Icon'), halign=Gtk.Align.START), 0, 1, 1, 1)
        icon_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        self.icon_entry = Gtk.Entry(text=icon, hexpand=True)
        self.icon_entry.connect('changed', self._on_icon_changed)
        icon_box.pack_start(self.icon_entry, True, True, 0)
        self.icon_preview = Gtk.Image()
        icon_box.pack_start(self.icon_preview, False, False, 0)
        browse_btn = Gtk.Button.new_from_icon_name('document-open-symbolic',
                                                    Gtk.IconSize.BUTTON)
        browse_btn.set_tooltip_text(_('Choose icon file'))
        browse_btn.connect('clicked', self._on_icon_browse)
        icon_box.pack_start(browse_btn, False, False, 0)
        grid.attach(icon_box, 1, 1, 1, 1)

        # 命令
        grid.attach(Gtk.Label(label=_('Command'), halign=Gtk.Align.START), 0, 2, 1, 1)
        self.command_entry = Gtk.Entry(text=command, hexpand=True)
        grid.attach(self.command_entry, 1, 2, 1, 1)

        self.show_all()
        self._refresh_preview()

    def _on_icon_changed(self, *args):
        self._refresh_preview()

    def _on_icon_browse(self, *args):
        dlg = Gtk.FileChooserDialog(
            title=_('Choose icon file'),
            transient_for=self.get_toplevel(),
            action=Gtk.FileChooserAction.OPEN)
        dlg.add_buttons(_('Cancel'), Gtk.ResponseType.CANCEL,
                        _('Open'), Gtk.ResponseType.OK)
        for p in ['/usr/share/icons', '/usr/share/pixmaps',
                  os.path.expanduser('~/.local/share/icons'),
                  os.path.expanduser('~/.icons')]:
            if os.path.isdir(p):
                dlg.set_current_folder(p)
                break
        if dlg.run() == Gtk.ResponseType.OK:
            self.icon_entry.set_text(dlg.get_filename())
        dlg.destroy()

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
        }


# ============================================================
#  自定义菜单项列表编辑器
#  工具栏 + 树状列表；数据写到非 widget 键 "custom_items"
# ============================================================

class CustomAppList(SettingsWidget):
    def __init__(self, info, key, settings):
        super().__init__()
        self.key = "custom_items"
        self.settings = settings
        self.info = info
        # 防止"自己写入 → listen 回调 → 重新加载"造成的循环
        self._saving = False

        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(6)
        self.set_margin_start(8)
        self.set_margin_end(8)
        self.set_margin_top(8)
        self.set_margin_bottom(8)

        # 工具栏
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

        # Gio.Icon 按需渲染，比 Pixbuf 模型启动更快
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
        # 记住当前选中位置，重新加载后尝试恢复
        idx = -1
        model, it = self.tree_view.get_selection().get_selected()
        if it is not None:
            idx = model.get_path(it).get_indices()[0]
        self._load()
        if 0 <= idx < len(self.store):
            self.tree_view.get_selection().select_iter(self.store.get_iter(idx))
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
        """从 /usr/share/applications 选择 .desktop 文件并添加到列表。"""
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
        """手动输入名称/图标/命令添加一项。"""
        dlg = EditDialog(self.get_toplevel())
        if dlg.run() == Gtk.ResponseType.OK:
            data = dlg.get_values()
            dlg.destroy()
            # 名称为 "-" 视为分隔线
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


# ============================================================
#  场景预设管理器（列表版）
#  列表第一项是虚拟的"Default"（不写入文件，应用时恢复默认值）
#  提供：应用 / 覆盖保存当前 / 复制 / 重命名 / 上移 / 下移 / 删除
# ============================================================

class SceneManager(SettingsWidget):
    # 参与快照的设置键
    SETTINGS_TO_SAVE = [
        'panel_icon', 'icon_size',
        'scroll_switch', 'middle_click_action',
        'quit', 'quit_icon', 'quit_cmd', 'show_separator',
        'log_out', 'log_out_icon', 'log_out_cmd',
        'screen_lock', 'screen_lock_icon', 'screen_lock_cmd',
        'custom_items', 'custom_position', 'show_custom_separator',
        'menu_text_size', 'menu_icon_size',
        'custom_grid_mode', 'custom_grid_hide_builtin',
        'custom_grid_columns', 'custom_grid_cell_width',
        'custom_grid_cell_height', 'custom_grid_show_label',
        'custom_grid_icon_size', 'custom_grid_label_spacing',
    ]

    def __init__(self, info, key, settings):
        super().__init__()
        self.settings = settings
        self.info = info
        self._saving = False

        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(6)
        self.set_margin_start(8)
        self.set_margin_end(8)
        self.set_margin_top(8)
        self.set_margin_bottom(8)

        # 顶部：名称输入 + 保存为新场景
        row2 = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        self.pack_start(row2, False, False, 0)

        self.entry = Gtk.Entry()
        self.entry.set_placeholder_text(_('Scene name'))
        self.entry.set_hexpand(True)
        self.entry.connect('activate', self._on_save)
        row2.pack_start(self.entry, True, True, 0)

        self.save_btn = Gtk.Button(label=_('Save as new'))
        self.save_btn.connect('clicked', self._on_save)
        row2.pack_start(self.save_btn, False, False, 0)

        # 工具栏
        toolbar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        self.pack_start(toolbar, False, False, 0)

        def add_tool_button(icon_name, tooltip, callback):
            btn = Gtk.Button.new_from_icon_name(icon_name, Gtk.IconSize.BUTTON)
            btn.set_tooltip_text(tooltip)
            btn.connect('clicked', callback)
            toolbar.pack_start(btn, False, False, 0)
            return btn

        self.apply_btn = add_tool_button('emblem-ok-symbolic',
            _('Apply selected scene'), self._on_apply)
        self.save_current_btn = add_tool_button('document-save-symbolic',
            _('Save current scene'), self._on_save_current)
        self.duplicate_btn = add_tool_button('edit-copy-symbolic',
            _('Duplicate'), self._on_duplicate)
        self.rename_btn = add_tool_button('document-edit-symbolic',
            _('Rename'), self._on_rename)
        self.up_btn = add_tool_button('go-up-symbolic',
            _('Move up'), self._on_move_up)
        self.down_btn = add_tool_button('go-down-symbolic',
            _('Move down'), self._on_move_down)
        self.delete_btn = add_tool_button('list-remove-symbolic',
            _('Delete'), self._on_delete)

        # 列表
        self.store = Gtk.ListStore(str)
        self.tree_view = Gtk.TreeView(model=self.store)
        self.tree_view.set_headers_visible(False)

        renderer_name = Gtk.CellRendererText()
        column_name = Gtk.TreeViewColumn(_('Scene name'), renderer_name, text=0)
        self.tree_view.append_column(column_name)

        selection = self.tree_view.get_selection()
        selection.set_mode(Gtk.SelectionMode.SINGLE)
        selection.connect('changed', self._update_buttons)
        self.tree_view.connect('row-activated', lambda *a: self._on_apply())

        scroll = Gtk.ScrolledWindow()
        scroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        scroll.set_min_content_height(200)
        scroll.set_shadow_type(Gtk.ShadowType.IN)
        scroll.add(self.tree_view)
        self.pack_start(scroll, True, True, 0)

        # 说明文字
        hint = Gtk.Label(label=_(
            'Save the current settings as a scene, or apply a saved scene. '
            'Scenes include the panel icon, interaction behavior, built-in items, '
            'custom items, and grid options.'))
        hint.set_halign(Gtk.Align.START)
        hint.set_xalign(0.0)
        hint.set_line_wrap(True)
        self.pack_start(hint, False, False, 0)

        self._refresh()

    # ---------- 数据 ----------

    def _get_presets(self):
        try:
            if os.path.isfile(SCENES_FILE):
                with open(SCENES_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data if isinstance(data, list) else []
        except Exception:
            pass
        return []

    def _set_presets(self, presets):
        """原子写入：先写临时文件再 rename，避免中途崩溃损坏文件；
        同时收紧目录和文件权限，防止同机其他用户读取。"""
        try:
            os.makedirs(SCENES_DIR, exist_ok=True)
            try:
                os.chmod(SCENES_DIR, 0o700)
            except Exception:
                pass
            tmp = SCENES_FILE + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(presets, f, ensure_ascii=False, indent=2)
            try:
                os.chmod(tmp, 0o600)
            except Exception:
                pass
            os.replace(tmp, SCENES_FILE)
        except Exception:
            pass

    def _refresh(self, select_index=0):
        """select_index: -1 = 选中 Default；>= 0 = 第 select_index 个实际场景。"""
        self._saving = True
        try:
            self.store.clear()
            self.store.append([_('Default')])
            presets = self._get_presets()
            for p in presets:
                if isinstance(p, dict) and p.get('name'):
                    self.store.append([p['name']])
        finally:
            self._saving = False

        n_presets = len(self.store) - 1
        if select_index < 0 or n_presets == 0:
            row = 0
        else:
            row = min(select_index, n_presets - 1) + 1
        try:
            self.tree_view.get_selection().select_iter(self.store.get_iter(row))
        except Exception:
            pass
        self._update_buttons()

    def _selected_row(self):
        """返回 store 行号：0 = Default，>0 = 实际场景；-1 = 无选中。"""
        model, it = self.tree_view.get_selection().get_selected()
        if it is None:
            return -1
        return model.get_path(it).get_indices()[0]

    def _update_buttons(self, *args):
        if self._saving:
            return
        row = self._selected_row()
        n_presets = len(self.store) - 1
        has_selection = row >= 0
        is_real = row > 0

        self.apply_btn.set_sensitive(has_selection)
        self.save_current_btn.set_sensitive(is_real)
        self.duplicate_btn.set_sensitive(has_selection)
        self.rename_btn.set_sensitive(is_real)
        self.up_btn.set_sensitive(is_real and row > 1)
        self.down_btn.set_sensitive(is_real and row < n_presets)
        self.delete_btn.set_sensitive(is_real)

    # ---------- 回调 ----------

    def _on_save(self, *args):
        """保存为新场景（同名覆盖）。"""
        name = self.entry.get_text().strip()
        if not name:
            return
        snapshot = {}
        for k in self.SETTINGS_TO_SAVE:
            try:
                snapshot[k] = self.settings.get_value(k)
            except Exception:
                pass
        try:
            data = json.dumps(snapshot)
        except Exception:
            return

        presets = self._get_presets()
        for i, p in enumerate(presets):
            if isinstance(p, dict) and p.get('name') == name:
                p['data'] = data
                self._set_presets(presets)
                self.entry.set_text('')
                self._refresh(i)
                return

        presets.append({'name': name, 'data': data})
        self._set_presets(presets)
        self.entry.set_text('')
        self._refresh(len(presets) - 1)

    def _on_apply(self, *args):
        """应用选中场景。选中 Default 时恢复所有默认值。"""
        row = self._selected_row()
        if row < 0:
            return
        if row == 0:
            for k, v in DEFAULT_SNAPSHOT.items():
                try:
                    self.settings.set_value(k, v)
                except Exception:
                    pass
            return
        idx = row - 1
        presets = self._get_presets()
        if idx >= len(presets):
            return
        p = presets[idx]
        if not isinstance(p, dict):
            return
        try:
            snapshot = json.loads(p.get('data') or '{}')
        except Exception:
            return
        for k, v in snapshot.items():
            try:
                self.settings.set_value(k, v)
            except Exception:
                pass

    def _on_save_current(self, *args):
        """把当前设置覆盖保存到选中的场景。"""
        row = self._selected_row()
        if row <= 0:
            return
        idx = row - 1
        presets = self._get_presets()
        if idx >= len(presets):
            return
        snapshot = {}
        for k in self.SETTINGS_TO_SAVE:
            try:
                snapshot[k] = self.settings.get_value(k)
            except Exception:
                pass
        try:
            data = json.dumps(snapshot)
        except Exception:
            return
        presets[idx]['data'] = data
        self._set_presets(presets)
        self._refresh(idx)

    def _on_duplicate(self, *args):
        """复制选中场景（Default 也可复制，得到一份默认快照）。"""
        row = self._selected_row()
        if row < 0:
            return
        if row == 0:
            data = json.dumps(DEFAULT_SNAPSHOT)
            base_name = _('Default')
        else:
            idx = row - 1
            presets = self._get_presets()
            if idx >= len(presets):
                return
            p = presets[idx]
            if not isinstance(p, dict):
                return
            data = p.get('data', '{}')
            base_name = p.get('name', _('Scene'))

        presets = self._get_presets()
        existing = set()
        for p in presets:
            if isinstance(p, dict) and p.get('name'):
                existing.add(p['name'])

        # 生成不冲突的副本名
        new_name = base_name + ' (copy)'
        counter = 2
        while new_name in existing:
            new_name = '%s (copy %d)' % (base_name, counter)
            counter += 1

        presets.append({'name': new_name, 'data': data})
        self._set_presets(presets)
        self._refresh(len(presets) - 1)

    def _on_delete(self, *args):
        row = self._selected_row()
        if row <= 0:
            return
        idx = row - 1
        presets = self._get_presets()
        if idx >= len(presets):
            return
        del presets[idx]
        self._set_presets(presets)
        self._refresh(idx)

    def _on_rename(self, *args):
        row = self._selected_row()
        if row <= 0:
            return
        idx = row - 1
        presets = self._get_presets()
        if idx >= len(presets):
            return
        old_name = presets[idx].get('name', '')

        # 简易重命名对话框
        dlg = Gtk.Dialog(title=_('Rename scene'),
                         transient_for=self.get_toplevel(), modal=True)
        dlg.add_buttons(_('Cancel'), Gtk.ResponseType.CANCEL,
                        _('OK'), Gtk.ResponseType.OK)
        entry = Gtk.Entry(text=old_name, hexpand=True)
        entry.set_margin_start(12)
        entry.set_margin_end(12)
        entry.set_margin_top(12)
        entry.set_margin_bottom(12)
        dlg.get_content_area().add(entry)
        dlg.show_all()

        result = dlg.run()
        new_name = entry.get_text().strip()
        dlg.destroy()

        if result != Gtk.ResponseType.OK:
            return
        if not new_name or new_name == old_name:
            return
        # 名字冲突时放弃
        if any(isinstance(p, dict) and p.get('name') == new_name for p in presets):
            return
        presets[idx]['name'] = new_name
        self._set_presets(presets)
        self._refresh(idx)

    def _on_move_up(self, *args):
        row = self._selected_row()
        if row <= 1:
            return
        idx = row - 1
        presets = self._get_presets()
        if idx >= len(presets):
            return
        presets[idx - 1], presets[idx] = presets[idx], presets[idx - 1]
        self._set_presets(presets)
        self._refresh(idx - 1)

    def _on_move_down(self, *args):
        row = self._selected_row()
        if row <= 0:
            return
        idx = row - 1
        presets = self._get_presets()
        if idx >= len(presets) - 1:
            return
        presets[idx], presets[idx + 1] = presets[idx + 1], presets[idx]
        self._set_presets(presets)
        self._refresh(idx + 1)