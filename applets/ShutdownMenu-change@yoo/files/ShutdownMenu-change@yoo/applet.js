// name： ShutdownMenu-change
// description： Offers a shutdown menu with scroll workspace switching, middle-click actions, custom menu items, grid layout, and scene presets — unlocking more ways to play.
// version: 1.4.5 (16-09-2026)
// License: GPLv3
// Copyright © 2026 yoo


const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Pango = imports.gi.Pango;
const Util = imports.misc.util;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;

const UUID = "ShutdownMenu-change@yoo";

// 默认图标
const DEFAULT_PANEL_ICON = "system-shutdown";
const DEFAULT_PANEL_ICON_SYMBOLIC = "system-shutdown-symbolic";
const DEFAULT_CUSTOM_ICON = "application-x-executable";
const FALLBACK_ICON = "image-missing";
// 自定义项名称为此值且命令为空时，渲染为分隔线
const SEPARATOR_ROW_NAME = "-";
// 场景文件路径（相对用户数据目录）
const SCENES_REL_PATH = '/ShutdownMenu-change@yoo/scenes.json';
// 面板符号图标大小读取失败时的兜底值
const FALLBACK_PANEL_ICON_SIZE = 16;
// 自定义项超过此数量时启用滚动容器
const CUSTOM_LIST_SCROLL_THRESHOLD = 20;
// 名称截断的兜底值（设置未绑定时使用）
const DEFAULT_MENU_LABEL_MAX_CHARS = 30;
const DEFAULT_GRID_LABEL_MAX_CHARS = 12;

// 首次运行时注入的默认自定义项（用户可随时删除）
const DEFAULT_CUSTOM_ITEM = {
    name: "Neofetch",
    icon: "linuxmint-logo-badge-symbolic",
    command: "x-terminal-emulator -e bash -c 'neofetch; exec bash'",
    type: "command",
    pinned: true
};

// 与 widgets.py 的 DEFAULT_SNAPSHOT 保持一致；应用"默认场景"时使用
const DEFAULT_SNAPSHOT = {
    'panel_icon': 'system-shutdown-symbolic',
    'icon_size': 0,
    'scroll_switch': false,
    'middle_click_action': 'nothing',
    'quit': true,
    'quit_icon': 'system-shutdown',
    'quit_cmd': 'cinnamon-session-quit --power-off',
    'show_separator': true,
    'log_out': true,
    'log_out_icon': 'system-log-out',
    'log_out_cmd': 'cinnamon-session-quit --logout',
    'screen_lock': true,
    'screen_lock_icon': 'system-lock-screen',
    'screen_lock_cmd': 'cinnamon-screensaver-command --lock',
    'custom_items': [Object.assign({}, DEFAULT_CUSTOM_ITEM)],
    'custom_position': 0,
    'show_custom_separator': true,
    'menu_text_size': 0,
    'menu_icon_size': 24,
    'menu_label_max_chars': 16,
    'grid_label_max_chars': 12,
    'custom_grid_mode': false,
    'custom_grid_hide_builtin': false,
    'custom_grid_columns': 3,
    'custom_grid_cell_width': 0,
    'custom_grid_cell_height': 0,
    'custom_grid_show_label': false,
    'custom_grid_icon_size': 40,
    'custom_grid_label_spacing': 6,
};

// 国际化：翻译文件位于 ~/.local/share/locale/<lang>/LC_MESSAGES/<UUID>.mo
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");
function _(str) {
    return Gettext.dgettext(UUID, str);
}

// 把过长的名称截断到 maxChars 个字符
// 无效的 maxChars 会回退到 defaultLimit
function truncateLabel(text, maxChars, defaultLimit) {
    if (!text) return '';
    let limit = parseInt(maxChars, 10);
    if (isNaN(limit) || limit <= 0) {
        limit = defaultLimit || DEFAULT_MENU_LABEL_MAX_CHARS;
    }
    let s = String(text);
    if (s.length <= limit) return s;
    return s.substring(0, limit - 1) + '…';
}

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            // 菜单重建防抖计时器 ID；0 表示无待执行任务
            this._rebuildMenuId = 0;
            // 图标主题查询结果缓存，切换主题时整体清空
            this._iconThemeCache = {};
            // 场景文件缓存 {mtime, data}，避免每次打开右键菜单都读盘
            this._scenesCache = null;
            // 面板符号图标大小的内存缓存；0 表示需要重新读取
            this._panelIconSizeCache = 0;

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.settings = new Settings.AppletSettings(this, UUID, instanceId);
            this._initSceneMenu();
            this.bindSettings();

            // 绑定完成后才能安全读取设置，此时决定是否注入默认自定义项
            this._initCustomItems();

            // 主题变化时清空缓存，避免旧结果被复用
            this._iconTheme = Gtk.IconTheme.get_default();
            this._iconTheme.connect('changed', () => {
                this._iconThemeCache = {};
            });

            // 读取 Cinnamon 面板设置，用于 icon_size=0 时自动跟随面板图标大小
            try {
                this._panelSettings = new Gio.Settings({ schema_id: 'org.cinnamon' });
                this._panelSettings.connect('changed::panel-symbolic-icon-size', () => {
                    this._panelIconSizeCache = 0;
                    let s = parseInt(this.icon_size, 10);
                    if (isNaN(s) || s <= 0) {
                        this._updateIconSize();
                    }
                });
            } catch (e) {
                this._panelSettings = null;
            }

            this._updatePanelIcon();
            this.set_applet_tooltip(_("Shutdown Menu"));

            this.createMenu();

            this.actor.connect('scroll-event', this._on_scroll_event.bind(this));
        }
        catch (e) {
            global.logError(e);
        }
    },

    // 从面板移除时清理资源（防泄漏）
    on_applet_removed_from_panel: function() {
        if (this._rebuildMenuId) {
            try { GLib.source_remove(this._rebuildMenuId); } catch (e) {}
            this._rebuildMenuId = 0;
        }
        if (this._sceneSubmenu) {
            try { this._sceneSubmenu.destroy(); } catch (e) {}
            this._sceneSubmenu = null;
        }
    },

    // 绑定所有设置项
    // menuBound 里的项：变更后触发 _rebuildMenu（防抖）
    // 其余项：变更后各自调用专门的回调，或不回调
    bindSettings: function() {
        let menuBound = [
            ["quit", "quit_enable"],
            ["quit_icon", "quit_icon"],
            ["quit_cmd", "quit_cmd"],
            ["show_separator", "show_separator"],
            ["log_out", "log_out_enable"],
            ["log_out_icon", "log_out_icon"],
            ["log_out_cmd", "log_out_cmd"],
            ["screen_lock", "screen_lock_enable"],
            ["screen_lock_icon", "screen_lock_icon"],
            ["screen_lock_cmd", "screen_lock_cmd"],
            ["custom_items", "custom_items"],
            ["custom_position", "custom_position"],
            ["show_custom_separator", "show_custom_separator"],
            ["custom_list_scroll_enable", "custom_list_scroll_enable"],
            ["custom_list_max_height", "custom_list_max_height"],
            ["menu_text_size", "menu_text_size"],
            ["menu_icon_size", "menu_icon_size"],
            ["menu_label_max_chars", "menu_label_max_chars"],
            ["grid_label_max_chars", "grid_label_max_chars"],
            ["custom_grid_mode", "custom_grid_mode"],
            ["custom_grid_columns", "custom_grid_columns"],
            ["custom_grid_show_label", "custom_grid_show_label"],
            ["custom_grid_icon_size", "custom_grid_icon_size"],
            ["custom_grid_hide_builtin", "custom_grid_hide_builtin"],
            ["custom_grid_label_spacing", "custom_grid_label_spacing"],
            ["custom_grid_cell_width", "custom_grid_cell_width"],
            ["custom_grid_cell_height", "custom_grid_cell_height"],
        ];
        menuBound.forEach(([key, prop]) => {
            this.settings.bindProperty(Settings.BindingDirection.IN, key, prop, this._rebuildMenu, null);
        });

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "panel_icon", "panel_icon", this._updatePanelIcon, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "icon_size", "icon_size", this._updateIconSize, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "scroll_switch", "scroll_switch", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "middle_click_action", "middle_click_action", null, null);

        // 这两个只作数据存储，不需要回调
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "custom_items_initialized", "custom_items_initialized", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "show_default_in_context", "show_default_in_context", null, null);
    },

    // 首次运行时把默认的 Neofetch 项写入 custom_items
    // 用 custom_items_initialized 标记已初始化，用户删除后不会再自动加回
    _initCustomItems: function() {
        if (this.custom_items_initialized) return;

        // 老用户升级上来的情况：已有自定义项就不动
        if (this.custom_items && this.custom_items.length > 0) {
            this.custom_items_initialized = true;
            this.settings.setValue("custom_items_initialized", true);
            return;
        }

        let defaults = [Object.assign({}, DEFAULT_CUSTOM_ITEM)];
        this.custom_items = defaults;
        this.settings.setValue("custom_items", defaults);
        this.custom_items_initialized = true;
        this.settings.setValue("custom_items_initialized", true);
    },

    // 同步检查文件是否存在（仅用于本地图标路径，代价可接受）
    _fileExists: function(path) {
        try {
            Gio.file_new_for_path(path).query_info(
                'standard::*', Gio.FileQueryInfoFlags.NONE, null);
            return true;
        } catch (e) {
            return false;
        }
    },

    // 根据图标名或路径构造 GIcon，供 St.Icon 使用
    _resolveGIcon: function(iconName) {
        if (!iconName) return null;
        if (GLib.path_is_absolute(iconName)) {
            if (!this._fileExists(iconName)) return null;
            return new Gio.FileIcon({ file: Gio.file_new_for_path(iconName) });
        }
        return new Gio.ThemedIcon({ name: iconName });
    },

    // 更新面板图标：支持空字符串（隐藏）、图标名、绝对路径、symbolic 变体
    _updatePanelIcon: function() {
        let iconName = this.panel_icon || DEFAULT_PANEL_ICON;
        if (iconName === '') {
            this._applet_icon_box.hide();
            return;
        }
        this._applet_icon_box.show();

        this._setPanelIcon(iconName);
        this._updateIconSize();
    },

    _setPanelIcon: function(iconName) {
        let isPath = GLib.path_is_absolute(iconName);
        let isSymbolic = iconName.includes('-symbolic');
        let exists = isPath ? this._fileExists(iconName) : this._iconThemeHasIcon(iconName);

        if (!exists) {
            this.set_applet_icon_symbolic_name(DEFAULT_PANEL_ICON_SYMBOLIC);
            return;
        }

        if (isPath) {
            if (isSymbolic) this.set_applet_icon_symbolic_path(iconName);
            else this.set_applet_icon_path(iconName);
        } else {
            if (isSymbolic) this.set_applet_icon_symbolic_name(iconName);
            else this.set_applet_icon_name(iconName);
        }
    },

    // 带缓存的图标主题查询
    _iconThemeHasIcon: function(iconName) {
        if (Object.prototype.hasOwnProperty.call(this._iconThemeCache, iconName)) {
            return this._iconThemeCache[iconName];
        }
        let iconInfo = this._iconTheme.lookup_icon(iconName, 24, Gtk.IconLookupFlags.FORCE_SIZE);
        let exists = iconInfo !== null;
        this._iconThemeCache[iconName] = exists;
        return exists;
    },

    // 应用图标大小：
    // - icon_size > 0：使用用户指定值
    // - icon_size == 0：跟随 Cinnamon 面板的"符号图标大小"
    _updateIconSize: function() {
        let size = parseInt(this.icon_size, 10);
        if (isNaN(size) || size <= 0) {
            size = this._getPanelSymbolicIconSize();
        }
        if (size > 0) {
            this._applet_icon.set_icon_size(size);
        }
    },

    // 读取 Cinnamon 面板的符号图标大小；读取失败时回退到默认值
    _getPanelSymbolicIconSize: function() {
        if (this._panelIconSizeCache > 0) {
            return this._panelIconSizeCache;
        }
        let size = FALLBACK_PANEL_ICON_SIZE;
        try {
            if (!this._panelSettings) {
                this._panelSettings = new Gio.Settings({ schema_id: 'org.cinnamon' });
            }
            let v = this._panelSettings.get_int('panel-symbolic-icon-size');
            if (v > 0) size = v;
        } catch (e) {}
        this._panelIconSizeCache = size;
        return size;
    },

    // 构建主菜单
    // 结构： [自定义项] [分隔线] [内置项] [分隔线] [自定义项]
    // 自定义项可在内置项之上或之下，由 custom_position 决定
    createMenu: function() {
        if (!this.menu) return;
        this.menu.removeAll();

        let hasCustom = this.custom_items && this.custom_items.some(
            item => item && item.name && item.pinned !== false &&
            (item.name === SEPARATOR_ROW_NAME ? !item.command : item.command)
        );
        let hideBuiltin = this.custom_grid_mode && this.custom_grid_hide_builtin;
        let hasBuiltin = !hideBuiltin &&
            (this.quit_enable || this.log_out_enable || this.screen_lock_enable);
        let customAbove = (this.custom_position === 0);

        if (hasCustom && customAbove) {
            this._addCustomItems();
            this._addSeparatorIf(this.show_custom_separator && hasBuiltin);
        }

        if (!hideBuiltin) {
            this._addBuiltinItems();
        }

        if (hasCustom && !customAbove) {
            this._addSeparatorIf(this.show_custom_separator && hasBuiltin);
            this._addCustomItems();
        }
    },

    _addSeparatorIf: function(condition) {
        if (condition) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }
    },

    _addBuiltinItems: function() {
        if (this.quit_enable) {
            this._createMenuItem(_("Quit"), this.quit_icon, this.quit_cmd);
            this._addSeparatorIf(this.show_separator);
        }
        if (this.log_out_enable) {
            this._createMenuItem(_("Log out"), this.log_out_icon, this.log_out_cmd);
        }
        if (this.screen_lock_enable) {
            this._createMenuItem(_("Screen Lock"), this.screen_lock_icon, this.screen_lock_cmd);
        }
    },

    _addCustomItems: function() {
        if (this.custom_grid_mode) {
            this._addCustomItemsGrid();
        } else {
            this._addCustomItemsList();
        }
    },

    // ============================================================
    // 列表模式
    // ============================================================

    // 列表模式入口：按数量分流到普通列表或滚动容器
    _addCustomItemsList: function() {
        let visibleItems = this.custom_items.filter(item =>
            item && item.name && item.pinned !== false &&
            (item.name === SEPARATOR_ROW_NAME ? !item.command : item.command)
        );

        let enableScroll = this.custom_list_scroll_enable !== false;
        if (enableScroll && visibleItems.length > CUSTOM_LIST_SCROLL_THRESHOLD) {
            this._addCustomItemsListScroll(visibleItems);
        } else {
            this._addCustomItemsListPlain(visibleItems);
        }
    },

    // 普通列表：标准菜单项，支持键盘导航
    _addCustomItemsListPlain: function(items) {
        items.forEach(item => {
            if (!item || !item.name) return;
            if (item.pinned === false) return;

            if (item.name === SEPARATOR_ROW_NAME && !item.command) {
                this._addSeparatorIf(true);
                return;
            }

            if (item.command) {
                this._createMenuItem(item.name, item.icon || DEFAULT_CUSTOM_ICON, item.command);
            }
        });
    },

    // 滚动列表（参考 Cinnamenu 的 AppsView 结构）
    _addCustomItemsListScroll: function(items) {
        try {
            let maxHeight = parseInt(this.custom_list_max_height, 10);
            if (isNaN(maxHeight) || maxHeight < 100) maxHeight = 400;

            let iconSize = this.menu_icon_size || 24;
            let textSize = parseInt(this.menu_text_size, 10);
            let labelLimit = this.menu_label_max_chars;

            // 内部 BoxLayout：装所有自定义项
            let innerBox = new St.BoxLayout({ vertical: true });

            items.forEach(item => {
                // 分隔线
                if (item.name === SEPARATOR_ROW_NAME && !item.command) {
                    let sep = new St.Widget({
                        style_class: 'popup-separator-menu-item',
                        x_expand: true
                    });
                    innerBox.add(sep, { x_fill: true });
                    return;
                }
                if (!item.command) return;
                if (item.pinned === false) return;

                // 每项：带 popup-menu-item 样式的 Button
                // x_align: FILL + x_expand: true 保证按钮横跨整行
                let button = new St.Button({
                    style_class: 'popup-menu-item',
                    can_focus: true,
                    x_expand: true,
                    x_align: Clutter.ActorAlign.FILL
                });

                let hbox = new St.BoxLayout({
                    x_expand: true,
                    style: 'spacing: 8px; padding: 4px 8px;'
                });

                // 图标
                let gicon = this._resolveGIcon(item.icon || DEFAULT_CUSTOM_ICON);
                let icon = gicon
                    ? new St.Icon({ gicon: gicon, icon_size: iconSize })
                    : new St.Icon({ icon_name: FALLBACK_ICON, icon_size: iconSize });
                hbox.add_child(icon);

                // 文字：截断过长名称 + 启用省略号
                let label = new St.Label({
                    text: truncateLabel(item.name, labelLimit,
                                        DEFAULT_MENU_LABEL_MAX_CHARS),
                    y_align: Clutter.ActorAlign.CENTER,
                    x_expand: true
                });
                try {
                    label.get_clutter_text().set_ellipsize(Pango.EllipsizeMode.END);
                } catch (e) {}
                if (!isNaN(textSize) && textSize > 0) {
                    label.set_style('font-size: ' + textSize + 'px;');
                }
                hbox.add_child(label);

                button.set_child(hbox);
                button.connect('clicked', () => {
                    Util.trySpawnCommandLine(item.command);
                    this.menu.close();
                });

                // 悬停高亮
                button.connect('enter-event', () => {
                    if (!button.has_style_pseudo_class('active')) {
                        button.add_style_pseudo_class('active');
                    }
                });
                button.connect('leave-event', () => {
                    if (button.has_style_pseudo_class('active')) {
                        button.remove_style_pseudo_class('active');
                    }
                });

                // x_fill: true 让按钮撑满 innerBox 的整行宽度，左对齐
                innerBox.add(button, { x_fill: true });
            });

            // ScrollView 包装
            let scrollView = new St.ScrollView({
                style_class: 'vfade',
                x_expand: true,
                y_expand: false
            });
            scrollView.add_actor(innerBox);
            scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
            scrollView.set_clip_to_allocation(true);
            scrollView.set_mouse_scrolling(true);

            // 监听滚动条事件，避免菜单拦截滚动
            try {
                let vscroll = scrollView.get_vscroll_bar();
                vscroll.connect('scroll-start', () => { this.menu.passEvents = true; });
                vscroll.connect('scroll-stop', () => { this.menu.passEvents = false; });
            } catch (e) {}

            // 固定高度
            scrollView.height = maxHeight;

            // 用 PopupMenuSection 承载
            let section = new PopupMenu.PopupMenuSection();
            section.actor.add_actor(scrollView);
            this.menu.addMenuItem(section);
        } catch (e) {
            global.logError('ShutdownMenu-change list scroll error: ' + e.message);
            this._addCustomItemsListPlain(items);
        }
    },

    // ============================================================
    // 网格模式
    // ============================================================

    // 网格模式：图标 + 可选文字，用 Clutter.GridLayout 布局
    // 网格模式忽略分隔线
    // 只有"项数超过阈值 且 启用了滚动"时才包 ScrollView
    _addCustomItemsGrid: function() {
        let items = this.custom_items.filter(item =>
            item && item.name && item.command && item.pinned !== false
        );
        if (items.length === 0) return;

        try {
            let cols = this.custom_grid_columns || 4;
            let showLabel = this.custom_grid_show_label;
            let iconSize = this.custom_grid_icon_size || this.menu_icon_size || 32;
            let textSize = parseInt(this.menu_text_size, 10);
            let labelLimit = this.grid_label_max_chars;

            // 0 表示自适应（由内容决定尺寸）
            let cellWidth = parseInt(this.custom_grid_cell_width, 10);
            if (isNaN(cellWidth) || cellWidth < 0) cellWidth = 0;
            let cellHeight = parseInt(this.custom_grid_cell_height, 10);
            if (isNaN(cellHeight) || cellHeight < 0) cellHeight = 0;

            let spacing = parseInt(this.custom_grid_label_spacing, 10);
            if (isNaN(spacing) || spacing < 0) spacing = 6;

            // ---- 网格本体 ----
            let gridBox = new St.Bin({
                style_class: 'menu-applications-grid-box',
                x_fill: true,
                y_fill: true
            });
            // column_homogeneous: 所有列等宽，末行自动对齐
            let gridLayout = new Clutter.Actor({
                layout_manager: new Clutter.GridLayout({
                    column_homogeneous: true,
                    row_homogeneous: false
                })
            });
            gridBox.set_child(gridLayout);
            let gridMgr = gridLayout.layout_manager;

            let column = 0;
            let rownum = 0;

            items.forEach((item) => {
                let button = new St.Button({
                    style_class: 'popup-menu-item',
                    can_focus: true,
                    x_expand: true,
                    y_expand: true
                });
                if (cellWidth > 0) button.set_width(cellWidth);
                if (cellHeight > 0) button.set_height(cellHeight);

                let vbox = new St.BoxLayout({
                    vertical: true,
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: 'padding: 4px; spacing: ' + spacing + 'px;'
                });

                let gicon = this._resolveGIcon(item.icon || DEFAULT_CUSTOM_ICON);
                let icon = gicon
                    ? new St.Icon({ gicon: gicon, icon_size: iconSize })
                    : new St.Icon({ icon_name: FALLBACK_ICON, icon_size: iconSize });
                vbox.add_child(icon);

                if (showLabel) {
                    let label = new St.Label({
                        text: truncateLabel(item.name, labelLimit,
                                            DEFAULT_GRID_LABEL_MAX_CHARS),
                        x_align: Clutter.ActorAlign.CENTER
                    });
                    try {
                        label.get_clutter_text().set_ellipsize(Pango.EllipsizeMode.END);
                    } catch (e) {}
                    if (!isNaN(textSize) && textSize > 0) {
                        label.set_style('font-size: ' + textSize + 'px;');
                    }
                    vbox.add_child(label);
                }

                button.set_child(vbox);

                button.connect('clicked', () => {
                    Util.trySpawnCommandLine(item.command);
                    this.menu.close();
                });

                // Cinnamon 菜单项的悬停高亮用 active 伪类（非 hover）
                button.connect('enter-event', () => {
                    if (!button.has_style_pseudo_class('active')) {
                        button.add_style_pseudo_class('active');
                    }
                });
                button.connect('leave-event', () => {
                    if (button.has_style_pseudo_class('active')) {
                        button.remove_style_pseudo_class('active');
                    }
                });

                gridMgr.attach(button, column, rownum, 1, 1);

                column++;
                if (column >= cols) {
                    column = 0;
                    rownum++;
                }
            });

            // ---- 判断是否需要滚动 ----
            let enableScroll = this.custom_list_scroll_enable !== false;
            let needsScroll = enableScroll && items.length > CUSTOM_LIST_SCROLL_THRESHOLD;

            let section = new PopupMenu.PopupMenuSection();

            if (needsScroll) {
                // 需要滚动：包 ScrollView
                // 结构：ScrollView → bugfixBox → wrapperBox → gridBox
                let maxHeight = parseInt(this.custom_list_max_height, 10);
                if (isNaN(maxHeight) || maxHeight < 100) maxHeight = 400;

                // 布局参数（x_fill 等）只能传给 add/add_actor，
                // 不能写在 St.BoxLayout 的构造函数里
                let wrapperBox = new St.BoxLayout({ vertical: true });
                wrapperBox.add(gridBox, { x_fill: true, y_fill: true });

                // 外层：bugfixBox（规避 GitHub issue #11760）
                let bugfixBox = new St.BoxLayout({
                    style: 'padding: 0px; margin: 0px; spacing: 0px;'
                });
                bugfixBox.add_actor(wrapperBox);

                let scrollView = new St.ScrollView({
                    style_class: 'vfade menu-applications-scrollbox'
                });
                scrollView.add_actor(bugfixBox);
                scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
                scrollView.set_clip_to_allocation(true);
                scrollView.set_mouse_scrolling(true);
                scrollView.height = maxHeight;

                // 监听滚动条事件，避免菜单拦截滚动
                try {
                    let vscroll = scrollView.get_vscroll_bar();
                    vscroll.connect('scroll-start', () => { this.menu.passEvents = true; });
                    vscroll.connect('scroll-stop', () => { this.menu.passEvents = false; });
                } catch (e) {}

                section.actor.add_actor(scrollView);
            } else {
                // 不需要滚动：直接显示网格
                section.actor.add_actor(gridBox);
            }

            this.menu.addMenuItem(section);
        } catch (e) {
            global.logError('ShutdownMenu-change grid error: ' + e.message);
            this._addCustomItemsList();
        }
    },

    // ============================================================
    // 通用菜单项
    // ============================================================

    // 通用菜单项：图标 + 文字 + 命令
    // 文字过长时截断并加省略号
    _createMenuItem: function(displayName, iconName, command) {
        let menuItem = new PopupMenu.PopupBaseMenuItem();
        let size = this.menu_icon_size || 24;

        let gicon = this._resolveGIcon(iconName);
        let icon = gicon
            ? new St.Icon({ gicon: gicon, icon_size: size })
            : new St.Icon({ icon_name: FALLBACK_ICON, icon_size: size });
        menuItem.addActor(icon);

        let label = new St.Label({
            text: truncateLabel(displayName, this.menu_label_max_chars,
                                DEFAULT_MENU_LABEL_MAX_CHARS),
            y_align: Clutter.ActorAlign.CENTER
        });
        // 强制使用省略号（防止字体不支持 '…' 时显示异常）
        try {
            label.get_clutter_text().set_ellipsize(Pango.EllipsizeMode.END);
        } catch (e) {}
        let textSize = parseInt(this.menu_text_size, 10);
        if (!isNaN(textSize) && textSize > 0) {
            label.set_style('font-size: ' + textSize + 'px;');
        }
        menuItem.addActor(label, { expand: true });

        menuItem._command = command;
        menuItem.connect("activate", function() {
            Util.trySpawnCommandLine(command);
        });
        this.menu.addMenuItem(menuItem);
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    on_applet_middle_clicked: function(event) {
        let action = this.middle_click_action || "nothing";
        this._performAction(action);
    },

    _performAction: function(action) {
        let actions = {
            "show_desktop": () => {
                global.workspace_manager.toggle_desktop(global.get_current_time());
            },
            "show_expo": () => {
                if (Main.expo && !Main.expo.animationInProgress) Main.expo.toggle();
            },
            "show_scale": () => {
                if (Main.overview && !Main.overview.animationInProgress) Main.overview.toggle();
            },
            "toggle_desktop_icons": () => this._toggleDesktopIcons(),
        };
        let fn = actions[action];
        if (fn) fn();
    },

    // 通过 gsettings 切换 Nemo 桌面图标显示
    _toggleDesktopIcons: function() {
        let nemoSettings = new Gio.Settings({ schema_id: 'org.nemo.desktop' });
        let current = nemoSettings.get_boolean('show-desktop-icons');
        nemoSettings.set_boolean('show-desktop-icons', !current);
    },

    // 滚轮事件：悬停时切换工作区（需 scroll_switch 开启）
    _on_scroll_event: function(actor, event) {
        if (!this.scroll_switch) {
            return true;
        }

        let direction = event.get_scroll_direction();
        // 忽略触摸板的平滑滚动
        if (direction == Clutter.ScrollDirection.SMOOTH) {
            return true;
        }

        let wsManager = global.workspace_manager;
        let current_index = wsManager.get_active_workspace_index();
        let n_workspaces = wsManager.n_workspaces;

        if (n_workspaces < 2) {
            return true;
        }

        if (direction == Clutter.ScrollDirection.UP) {
            let target_index = (current_index - 1 + n_workspaces) % n_workspaces;
            wsManager.get_workspace_by_index(target_index).activate(global.get_current_time());
        }
        else if (direction == Clutter.ScrollDirection.DOWN) {
            let target_index = (current_index + 1) % n_workspaces;
            wsManager.get_workspace_by_index(target_index).activate(global.get_current_time());
        }
        return true;
    },

    // ============================================================
    // 场景预设（右键菜单）
    // ============================================================

    // 注册右键菜单的 open 事件，每次展开时重建 Scenes 子菜单
    // 这样无需依赖 DBus 通知，也能看到最新保存的场景
    _initSceneMenu: function() {
        this._applet_context_menu.connect('open-state-changed', (menu, open) => {
            if (open) this._buildSceneSubmenu();
        });

        this._buildSceneSubmenu();
    },

    // 从 ~/.local/share/ShutdownMenu-change@yoo/scenes.json 读取场景
    // 带 mtime 缓存，文件未变时直接返回上次的解析结果
    _readScenesFile: function() {
        try {
            let path = GLib.get_user_data_dir() + SCENES_REL_PATH;
            let file = Gio.file_new_for_path(path);
            if (!file.query_exists(null)) {
                this._scenesCache = { mtime: 0, data: [] };
                return [];
            }
            let info = file.query_info('time::modified',
                Gio.FileQueryInfoFlags.NONE, null);
            let mtime = info.get_attribute_uint64('time::modified');
            if (this._scenesCache && this._scenesCache.mtime === mtime) {
                return this._scenesCache.data;
            }
            let [ok, contents] = file.load_contents(null);
            if (!ok) return [];
            let text = '';
            try {
                text = new TextDecoder('utf-8').decode(contents);
            } catch (e) {
                text = imports.byteArray.ByteArray.toString(contents);
            }
            let data = JSON.parse(text);
            if (!Array.isArray(data)) data = [];
            this._scenesCache = { mtime: mtime, data: data };
            return data;
        } catch (e) {
            return [];
        }
    },

    // 销毁旧子菜单并重建
    // 必须先 removeMenuItem 再 destroy，否则 menuItems 数组会残留引用
    // 子菜单内容 = [默认场景（可选）] + 已保存的场景
    _buildSceneSubmenu: function() {
        if (this._sceneSubmenu) {
            try { this._applet_context_menu.removeMenuItem(this._sceneSubmenu); }
            catch (e) {}
            try { this._sceneSubmenu.destroy(); }
            catch (e) {}
            this._sceneSubmenu = null;
        }

        let presets = this._readScenesFile();

        this._sceneSubmenu = new PopupMenu.PopupSubMenuMenuItem(_("Scenes"));

        let entries = [];
        // 默认场景项（可用设置关闭）
        if (this.show_default_in_context !== false) {
            entries.push({ name: _("Default"), _isDefault: true });
        }
        presets.forEach(p => {
            if (p && p.name) entries.push(p);
        });

        if (entries.length === 0) {
            let item = new PopupMenu.PopupMenuItem(_("No scenes saved"));
            item.setSensitive(false);
            this._sceneSubmenu.menu.addMenuItem(item);
        } else {
            entries.forEach(p => {
                let item = new PopupMenu.PopupMenuItem(p.name);
                item.connect('activate', () => this._applyScene(p));
                this._sceneSubmenu.menu.addMenuItem(item);
            });
        }

        // 位置 0 = 最顶；不支持位置参数时回退到末尾
        try {
            this._applet_context_menu.addMenuItem(this._sceneSubmenu, 0);
        } catch (e) {
            this._applet_context_menu.addMenuItem(this._sceneSubmenu);
        }
    },

    // 应用场景：
    // - preset._isDefault 为真 → 使用内置的 DEFAULT_SNAPSHOT
    // - 否则从 preset.data 反序列化
    // 先更新类属性（IN 方向不会自动同步），再写盘，最后立即重建菜单
    _applyScene: function(preset) {
        let snapshot;
        if (preset && preset._isDefault) {
            snapshot = DEFAULT_SNAPSHOT;
        } else {
            try {
                snapshot = JSON.parse(preset.data || '{}');
            } catch (e) {
                return;
            }
        }

        let propMap = {
            'quit': 'quit_enable',
            'quit_icon': 'quit_icon',
            'quit_cmd': 'quit_cmd',
            'show_separator': 'show_separator',
            'log_out': 'log_out_enable',
            'log_out_icon': 'log_out_icon',
            'log_out_cmd': 'log_out_cmd',
            'screen_lock': 'screen_lock_enable',
            'screen_lock_icon': 'screen_lock_icon',
            'screen_lock_cmd': 'screen_lock_cmd',
            'custom_items': 'custom_items',
            'custom_position': 'custom_position',
            'show_custom_separator': 'show_custom_separator',
            'menu_text_size': 'menu_text_size',
            'menu_icon_size': 'menu_icon_size',
            'menu_label_max_chars': 'menu_label_max_chars',
            'grid_label_max_chars': 'grid_label_max_chars',
            'custom_grid_mode': 'custom_grid_mode',
            'custom_grid_columns': 'custom_grid_columns',
            'custom_grid_show_label': 'custom_grid_show_label',
            'custom_grid_icon_size': 'custom_grid_icon_size',
            'custom_grid_hide_builtin': 'custom_grid_hide_builtin',
            'custom_grid_label_spacing': 'custom_grid_label_spacing',
            'custom_grid_cell_width': 'custom_grid_cell_width',
            'custom_grid_cell_height': 'custom_grid_cell_height',
            'scroll_switch': 'scroll_switch',
            'middle_click_action': 'middle_click_action',
            'panel_icon': 'panel_icon',
            'icon_size': 'icon_size',
        };

        for (let key in snapshot) {
            let prop = propMap[key];
            if (prop) {
                this[prop] = snapshot[key];
            }
            try {
                this.settings.setValue(key, snapshot[key]);
            } catch (e) {
            }
        }

        // icon_size 可能变了，清缓存防止旧值生效
        if ('icon_size' in snapshot) {
            this._panelIconSizeCache = 0;
        }

        this._updatePanelIcon();

        // 立即重建，不走防抖，让用户感觉是即时切换
        this.createMenu();
    },

    // 菜单重建防抖：80ms 内的多次调用合并为一次
    // 场景应用时会有多个设置同时变更，避免重复构建菜单
    _rebuildMenu: function() {
        if (this._rebuildMenuId) {
            GLib.source_remove(this._rebuildMenuId);
            this._rebuildMenuId = 0;
        }
        this._rebuildMenuId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            this._rebuildMenuId = 0;
            this.createMenu();
            return GLib.SOURCE_REMOVE;
        });
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    var myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}