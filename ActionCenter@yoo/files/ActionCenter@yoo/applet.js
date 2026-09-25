const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Cvc = imports.gi.Cvc;
const Slider = imports.ui.slider;
const Main = imports.ui.main;
const ByteArray = imports.byteArray;
const Settings = imports.ui.settings;
const GdkPixbuf = imports.gi.GdkPixbuf;

const MprisController = require('./mpris_controller');
const BrightnessController = require('./brightness_controller');
const VolumeController = require('./volume_controller');
const ToggleManager = require('./toggle_manager');
const SystemState = require('./system_state');
const PowerMenuMod = require('./power_menu');
const ThemeSwitcherMod = require('./theme_switcher');
const ContextMenuMod = require('./context_menu');
const C = require('./constants');
const { UUID, _, TOGGLE_WIDTH, TOGGLE_HEIGHT, ARROW_WIDTH,
        MENU_CONTENT_WIDTH, MPRIS_CONTENT_WIDTH, CHOOSER_CONTENT_WIDTH,
        PLAYER_CONTENT_WIDTH, POLL_INTERVAL_SEC } = C;

// 调试开关：true 时输出 QS icon 等高频诊断日志，默认关闭
const DEBUG = false;
function dbg(msg) { if (DEBUG) global.log(msg); }

const IGNORE_CLOSE_MS = 500;

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

// 模块地图（实现见同目录各 controller/manager 文件，applet.js 只做编排）：
//   mpris_controller    播放器 UI + daemon 启停/看门狗
//   brightness_controller 显示器探测 + 亮度读写
//   volume_controller   Cvc 音量读写换算
//   toggle_manager      开关网格构建 + 可见性/使能
//   system_state        电池/网络/蓝牙轮询 → 开关 UI
//   power_menu          关机二级菜单（两种模式）
//   theme_switcher      暗色/夜灯/飞行/性能
//   context_menu        面板图标右键菜单
//   constants           UUID/宽度/路径唯一真相源
MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        // 三个参数必须全部透传，否则基类拿不到 instance_id，
        // this.panel 无法同步赋值（_getPanelInfo 被迫延迟）
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instanceId);

        this._appletMetadata = metadata;

        try {
            this.set_applet_icon_symbolic_name("preferences-system-symbolic");
            this.set_applet_tooltip(_("ActionCenter"));
        } catch (e) { global.logError("QS icon: " + e.message); }

        this._origSetStyle = this._setStyle.bind(this);
        let self = this;
        this._setStyle = function() {
            if (self._customIconActive) return;
            self._origSetStyle();
        };

        try {
            this._panelSettings = new Gio.Settings({ schema_id: 'org.cinnamon' });
            this._applyPanelIconSize();
            try {
                this._panelZoneSizeId = this._panelSettings.connect('changed::panel-zone-symbolic-icon-sizes', function() {
                    self._applyPanelIconSize();
                });
            } catch (e) { global.logError("QS panelSettings connect: " + e.message); }
        } catch (e) {
            this._panelSettings = null;
        }

        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
        } catch (e) {
            global.logError("QS menu: " + e.message + "\n" + e.stack);
            return;
        }

        this._updateSettingsSchema();

        try {
            this._settings = new Settings.AppletSettings(this, UUID, instanceId);
            this._bindSettings();
            this._applyPanelIcon();
        } catch (e) {
            global.logError("QS settings: " + e.message);
            this._settings = null;
        }

        this._ignoreClose = false;
        try {
            let origClose = this.menu.close.bind(this.menu);
            this.menu.close = function() {
                if (self._ignoreClose) {
                    return;
                }
                origClose();
            };
        } catch (e) {
            global.logError("QS wrap menu.close: " + e.message);
        }

        this._powerMenuVisible = false;
        this._brightnessVisible = false;
        this._updatingVolume = false;
        this._updatingBrightness = false;

        this._cachedNetwork = { hasWired: false, hasWifi: false, wifiEnabled: false,
            hasWiredDevice: false, wifiDevice: false, wwanDevice: false, wiredIface: '', signal: null };
        this._cachedBluetooth = { powered: false, connected: false };
        this._cachedAirplane = false;
        this._networkQueryInFlight = false;
        this._bluetoothQueryInFlight = false;

        try {
            this._control = new Cvc.MixerControl({ name: 'ActionCenter Volume' });
            let volumeCtrl = new VolumeController(this);
            this._volumeCtrl = volumeCtrl;
            this._controlStateId = this._control.connect('state-changed', function() { volumeCtrl.onControlStateChanged(); });
            this._control.open();
            this._volumeMax = 65536;
        } catch (e) {
            global.logError("QS cvc: " + e.message);
            this._control = null;
        }

        this._displays = [];
        this._brightnessCache = {};
        this._brightnessDebounce = {};
        this._primaryDisplay = null;
        this._primarySlider = null;
        this._brightnessSection = null;
        this._brightnessCtrl = new BrightnessController(this);

        this._toggleMgr = new ToggleManager(this);
        this._sysState = new SystemState(this);
        this._powerMenu = new PowerMenuMod(this);
        this._themeSwitcher = new ThemeSwitcherMod(this);
        try { this._themeSwitcher.watchSettings(); } catch (e) { global.logError("QS theme watch: " + e.message); }
        try { this._contextMenu = new ContextMenuMod(this); this._contextMenu.build(); }
        catch (e) { global.logError("QS context menu: " + e.message + "\n" + e.stack); }

        // 构建顺序即菜单从上到下顺序；轮询/MPRIS 放最后，前面的 UI 先出来
        try { this._buildStatusRow(); }  catch (e) { global.logError("QS _buildStatusRow: " + e.message + "\n" + e.stack); }
        try { this._powerMenu.buildPowerMenu(); }  catch (e) { global.logError("QS _buildPowerMenu: " + e.message + "\n" + e.stack); }
        try { this._buildSliders(); }    catch (e) { global.logError("QS _buildSliders: " + e.message + "\n" + e.stack); }
        try { this._toggleMgr.buildToggleGrid(); } catch (e) { global.logError("QS _buildToggleGrid: " + e.message + "\n" + e.stack); }
        try { this._toggleMgr.applyToggleVisibility(); } catch (e) { global.logError("QS applyToggleVisibility: " + e.message); }
        try { this._sysState.initPolling(); } catch (e) { global.logError("QS _initStatePolling: " + e.message + "\n" + e.stack); }
        try { this._initMpris(); }      catch (e) { global.logError("QS _initMpris: " + e.message + "\n" + e.stack); }

        global.log("QS init done");
    },

    _bindSettings: function() {
        if (!this._settings) return;
        // 存 handler id，移除时逐个断开，防止重载累积
        this._settingsIds = this._settingsIds || [];
        let on = function(signal, fn) {
            try { this._settingsIds.push(this._settings.connect(signal, fn)); } catch(e) {}
        }.bind(this);

        on('changed::panel-icon', function() {
            this._applyPanelIcon();
        }.bind(this));
        on('changed::panel-icon-height', function() {
            this._applyPanelIcon();
        }.bind(this));

        // 初始化面板图标：若 settings 为空或存了相对路径，
        // 转为绝对路径写回，保证设置面板文件选择器打开时
        // 默认定位到 applet 目录下的 icons/ 文件夹，
        // 而不是跳回用户主目录或上次选过的绝对路径。
        this._ensurePanelIconDefault();

        // 截图命令 / 自动跟随都按需现读，无需变更回调
        on('changed::show-player', function() {
            this._applyShowPlayer();
        }.bind(this));

        let toggles = ['network', 'bluetooth', 'performance', 'nightlight', 'darkmode', 'airplane'];
        for (let i = 0; i < toggles.length; i++) {
            on('changed::show-toggle-' + toggles[i], function() {
                this._toggleMgr.applyToggleVisibility();
            }.bind(this));
        }

        on('changed::power-mode', function() {
            let val = this._settings.getValue('power-mode');
            this._powerMenu.rebuildPowerMenu();
        }.bind(this));

        // 右键菜单显隐
        let ctxKeys = ['show-context-sound', 'show-context-mute-output', 'show-context-mute-input',
                       'show-context-network',
                       'show-context-wired', 'show-context-wireless', 'show-context-wwan',
                       'show-context-printer', 'show-context-sink-single'];
        for (let i = 0; i < ctxKeys.length; i++) {
            on('changed::' + ctxKeys[i], function() {
                if (this._contextMenu) this._contextMenu.applyVisibility();
            }.bind(this));
        }
    },

    _applyShowPlayer: function() {
        if (!this._settings) return;
        let show = this._settings.getValue('show-player');
        if (this._mprisController) {
            if (show) {
                // poll 定时器已在跑就别再 init（否则泄漏叠加）；停了才重建
                if (!this._mprisController._pollId) {
                    this._mprisController.init();
                }
                this._updateMprisUI();
            } else {
                this._mprisController.destroy();
                if (this._mprisController._playerWrapper) {
                    try {
                        if (this._mprisController._playerWrapper.actor.get_parent()) {
                            this._mprisController._playerWrapper.actor.get_parent().remove_child(this._mprisController._playerWrapper.actor);
                        }
                    } catch(e) {}
                    this._mprisController._playerWrapper = null;
                }
                if (this._mprisController._chooserWrapper) {
                    try {
                        if (this._mprisController._chooserWrapper.actor.get_parent()) {
                            this._mprisController._chooserWrapper.actor.get_parent().remove_child(this._mprisController._chooserWrapper.actor);
                        }
                    } catch(e) {}
                    this._mprisController._chooserWrapper = null;
                }
            }
        }
    },

    _updateSettingsSchema: function() {
        try {
            let schemaDir = Gio.File.new_for_path(this._appletMetadata.path);
            try {
                let info = schemaDir.query_info('access::can-write', Gio.FileQueryInfoFlags.NONE, null);
                if (!info.get_attribute_boolean('access::can-write')) {
                    global.log("QS _updateSettingsSchema: read-only install dir, skipping");
                    return;
                }
            } catch (e) { return; }

            let themeFile = Gio.File.new_for_path(C.THEMES_CACHE_FILE);
            if (!themeFile.query_exists(null)) {
                // 缓存缺失（如首次安装/手动清过）：当场扫一次再继续，
                // 否则六个主题下拉永远停在 schema 静态值（深色项只有 None）。
                // 只缺失时跑，平时不增加启动开销。
                try {
                    GLib.spawn_sync(null,
                        ['python3', this._appletMetadata.path + '/scripts/scan_themes.py'],
                        null, GLib.SpawnFlags.SEARCH_PATH, null);
                } catch (e) {
                    global.logError("QS scan themes: " + e.message);
                }
                if (!themeFile.query_exists(null)) {
                    global.log("QS _updateSettingsSchema: theme file not found");
                    return;
                }
            }
            let [ok, content] = themeFile.load_contents(null);
            if (!ok || !content) {
                global.log("QS _updateSettingsSchema: failed to read theme file");
                return;
            }
            let themes = JSON.parse(ByteArray.toString(content));

            let schemaFile = Gio.File.new_for_path(this._appletMetadata.path + '/settings-schema.json');
            if (!schemaFile.query_exists(null)) {
                global.log("QS _updateSettingsSchema: schema file not found");
                return;
            }
            let [sok, scontent] = schemaFile.load_contents(null);
            if (!sok || !scontent) {
                global.log("QS _updateSettingsSchema: failed to read schema file");
                return;
            }
            let schema = JSON.parse(ByteArray.toString(scontent));

            let themeKeys = {
                'dark-gtk-theme': themes.gtk,
                'light-gtk-theme': themes.gtk,
                'dark-icon-theme': themes.icon,
                'light-icon-theme': themes.icon,
                'dark-cursor-theme': themes.cursor,
                'light-cursor-theme': themes.cursor
            };

            let changed = false;
            for (let key in themeKeys) {
                if (schema[key] && schema[key].type === 'combobox') {
                    let opts = { '(None)': '' };
                    let list = themeKeys[key];
                    for (let i = 0; i < list.length; i++) {
                        opts[list[i]] = list[i];
                    }
                    // 无变化不写盘：避免每次打开设置都改安装文件
                    if (JSON.stringify(schema[key].options) !== JSON.stringify(opts)) {
                        schema[key].options = opts;
                        changed = true;
                    }
                }
            }
            if (!changed) return;

            let tmp = schemaFile.get_path() + '.tmp';
            let f = Gio.File.new_for_path(tmp);
            let out = f.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            out.write(JSON.stringify(schema, null, 4), null);
            out.close(null);
            GLib.rename(tmp, schemaFile.get_path());
        } catch (e) {
            global.logError("QS _updateSettingsSchema: " + e.message);
        }
    },

    // 判断本 applet 所在 panelId 与区域（left/center/right），
    // 读取「面板设置 → 左/中/右区域符号图标大小」对应值作为默认图标尺寸
    // 用基类现成的 this.panel / this._panelLocation 直接判定，不爬 actor 树
    _getZoneIconSize: function() {
        try {
            if (!this._panelSettings) return 0;
            let panel = this.panel;
            if (!panel) {
                dbg("QS icon: this.panel not ready");
                return 0;
            }
            let leftBox = panel._leftBox, centerBox = panel._centerBox, rightBox = panel._rightBox;
            if (!leftBox || !centerBox || !rightBox) return 0;
            let zone = null;
            if (this._panelLocation) {
                if (this._panelLocation === leftBox) zone = 'left';
                else if (this._panelLocation === centerBox) zone = 'center';
                else if (this._panelLocation === rightBox) zone = 'right';
            }
            // _panelLocation 还没就绪（如 _init 阶段）：返回 0，
            // 等 on_applet_added_to_panel 时重算
            if (!zone) {
                dbg("QS icon: panelId=" + panel.panelId + " zone=<pending>");
                return 0;
            }
            dbg("QS icon: panelId=" + panel.panelId + " zone=" + zone);

            let zones = JSON.parse(this._panelSettings.get_string('panel-zone-symbolic-icon-sizes'));
            if (!zones || zones.length === 0) return 0;
            // 先找本 panel，再回退到第一个 panel
            let entry = null;
            for (let i = 0; i < zones.length; i++) {
                if (zones[i].panelId === panel.panelId) { entry = zones[i]; break; }
            }
            if (!entry) entry = zones[0];
            let size = parseInt(entry[zone]) || 0;
            if (size <= 0) size = parseInt(entry.left || entry.center || entry.right) || 0;
            return size;
        } catch(e) {
            return 0;
        }
    },

    _applyPanelIcon: function() {
        if (!this._settings) { dbg("QS icon: no settings obj"); return; }
        let filename = this._settings.getValue('panel-icon');
        dbg("QS icon: getValue panel-icon = " + JSON.stringify(filename));
        if (!filename) return;

        let height = parseInt(this._settings.getValue('panel-icon-height')) || 0;
        dbg("QS icon: height=" + height + " panelSettings=" + (this._panelSettings ? "ok" : "null"));
        if (height <= 0) {
            // 默认值 = 本 applet 所在 panel 区域的符号图标大小（不要面板高度）
            height = this._getZoneIconSize();
            dbg("QS icon: zone size=" + height);
        }
        if (height <= 0) height = 22;

        let path = filename;
        if (!GLib.path_is_absolute(path)) {
            let appletDir = (this._appletMetadata && this._appletMetadata.path)
                ? this._appletMetadata.path
                : GLib.get_user_data_dir() + "/cinnamon/applets/" + UUID;
            path = appletDir + "/" + filename;
        }

        dbg("QS icon: resolved path=" + path + " exists=" + GLib.file_test(path, GLib.FileTest.EXISTS));
        if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
            this.set_applet_icon_symbolic_name('preferences-system');
            this._customIconActive = false;
            return;
        }

        let ratio = 1;
        try {
            let pb = GdkPixbuf.Pixbuf.new_from_file(path);
            if (pb) {
                let origW = pb.get_width();
                let origH = pb.get_height();
                if (origH > 0) ratio = origW / origH;
                dbg("QS icon: orig=" + origW + "x" + origH + " ratio=" + ratio);
            }
        } catch(e) { global.logError("QS icon pixbuf", e); }

        let scaledW = Math.round(height * ratio);
        this._customIconActive = true;

        if (!this._customIconWidget) {
            this._customIconWidget = new St.Bin({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: false,
                y_expand: false
            });
        }

        this._customIconWidget.set_width(scaledW);
        this._customIconWidget.set_height(height);

        let cache = St.TextureCache.get_default();
        cache.load_image_from_file_async(path, scaledW, height, function(c, handle, actor) {
            if (actor) {
                actor.set_size(scaledW, height);
                this._customIconWidget.set_child(actor);
            }
        }.bind(this));

        this._applet_icon_box.set_child(this._customIconWidget);
        this._applet_icon_box.set_fill(false, false);
        this._applet_icon_box.set_alignment(St.Align.MIDDLE, St.Align.MIDDLE);
    },

    // 若 settings 未存过图标或存的是相对路径，写入绝对路径。
    // 这样设置面板的 iconfilechooser 打开时默认定位到
    // applet 目录下的 icons/，而不是 ~/.local/share/cinnamon
    // 或上次选过的绝对路径。
    _ensurePanelIconDefault: function() {
        try {
            let filename = this._settings.getValue('panel-icon');
            if (filename && GLib.path_is_absolute(filename)) return;
            let appletDir = (this._appletMetadata && this._appletMetadata.path)
                ? this._appletMetadata.path
                : GLib.get_user_data_dir() + "/cinnamon/applets/" + UUID;
            let defaultFile = appletDir + "/icons/panel-icon-dark.png";
            if (GLib.file_test(defaultFile, GLib.FileTest.EXISTS)) {
                this._settings.setValue('panel-icon', defaultFile);
                dbg("QS icon: ensured panel-icon default = " + defaultFile);
            }
        } catch (e) {
            global.logError("QS _ensurePanelIconDefault: " + e.message);
        }
    },

    _startIgnoreClose: function() {
        this._ignoreClose = true;
        let self = this;
        Mainloop.timeout_add(IGNORE_CLOSE_MS, function() {
            self._ignoreClose = false;
            return false;
        });
    },

    // 动画总开关（设置 → 基础 → 平滑菜单）：读不到设置时默认开
    _smoothOn: function() {
        try { return !this._settings || this._settings.getValue('smooth-animation'); }
        catch(e) { return true; }
    },

    // 二级菜单展开/收起动画：淡入 + 下滑。只碰 opacity/translation，不碰 height
    //（height tween 会和布局管理器打架、把内容卡死在 0 高，已实锤弃用）。
    _animateSubmenu: function(box, show) {
        if (!box) return;
        if (!this._smoothOn()) {
            try { show ? box.show() : box.hide(); } catch(e2) {}
            return;
        }
        try {
            box.remove_all_transitions();
            if (show) {
                box.show();
                box.opacity = 0;
                box.translation_y = 6;
                box.ease({
                    opacity: 255, translation_y: 0,
                    duration: 250, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: function() {
                        box.opacity = 255;
                        box.translation_y = 0;
                    }
                });
            } else {
                if (!box.visible) return;
                box.ease({
                    opacity: 0,
                    duration: 180, mode: Clutter.AnimationMode.EASE_IN_QUAD,
                    onComplete: function() {
                        box.hide();
                        box.opacity = 255;
                        box.translation_y = 0;
                    }
                });
            }
        } catch (e) {
            // 动画失败就退回直接显隐（并复位透明度，防止半隐身）
            try { box.opacity = 255; box.translation_y = 0; show ? box.show() : box.hide(); } catch(e2) {}
        }
    },

    _wrapCentered: function(child) {
        let bin = new St.Bin({
            x_expand: true,
            x_fill: false,
            x_align: Clutter.ActorAlign.CENTER
        });
        bin.set_child(child);
        return bin;
    },

    _addSliderTooltip: function(slider, suffix) {
        let tooltip = new St.Label({
            style: 'padding: 2px 8px; border-radius: 4px; background-color: rgba(0,0,0,0.8); color: #fff; font-size: 12px;',
            visible: false
        });
        Main.uiGroup.add_child(tooltip);
        // 登记，移除时统一销毁，防止 Main.uiGroup 上的幽灵 actor
        this._floatingTips = this._floatingTips || [];
        this._floatingTips.push(tooltip);

        let updateTooltip = function(s, v) {
            let pct = Math.round(v * 100);
            tooltip.set_text(pct + suffix);
            let sliderWidth = slider.actor.get_width();
            let x = Math.round(v * sliderWidth) - 20;
            let [sx, sy] = slider.actor.get_transformed_position();
            tooltip.set_position(sx + x, sy - 30);
        };

        slider.connect('drag-begin', function() { tooltip.show(); updateTooltip(slider, slider._value); });
        slider.connect('value-changed', updateTooltip);
        slider.connect('drag-end', function() { tooltip.hide(); });
    },

    // 10 秒超时：子进程挂死时强制回调空串，避免 _networkQueryInFlight 等标志永久卡死
    _runCmd: function(argv, callback, timeoutMs) {
        let done = false;
        let timerId = 0;
        let proc = null;
        let finish = function(stdout) {
            if (done) return;
            done = true;
            if (timerId) { Mainloop.source_remove(timerId); timerId = 0; }
            callback(stdout);
        };
        timerId = Mainloop.timeout_add(timeoutMs || 10000, function() {
            timerId = 0;
            try { if (proc) proc.force_exit(); } catch(e) {}
            global.logError("QS _runCmd timeout: " + argv.join(' '));
            finish('');
            return false;
        });
        try {
            proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            proc.communicate_utf8_async(null, null, function(p, res) {
                if (timerId) { Mainloop.source_remove(timerId); timerId = 0; }
                let stdout = '';
                try {
                    let [, out] = p.communicate_utf8_finish(res);
                    stdout = out || '';
                } catch (e) {
                    global.logError("QS _runCmd finish: " + e.message);
                }
                finish(stdout);
            });
        } catch (e) {
            if (timerId) { Mainloop.source_remove(timerId); timerId = 0; }
            global.logError("QS _runCmd spawn: " + e.message);
            finish('');
        }
    },

    _spawnDetached: function(argv) {
        try {
            let parts = [];
            for (let i = 0; i < argv.length; i++) {
                let a = String(argv[i]).replace(/'/g, "'\\''");
                parts.push("'" + a + "'");
            }
            let cmd = parts.join(' ') + ' >/dev/null 2>&1 < /dev/null &';
            Util.spawn(['sh', '-c', cmd]);
            return true;
        } catch (e) {
            global.logError("QS _spawnDetached: " + e.message);
            return false;
        }
    },

    _applyPanelIconSize: function() {
        try {
            if (this._customIconActive) return;
            if (!this._panelSettings) return;
            let size = this._getZoneIconSize() || 24;
            if (size > 0 && this._applet_icon) {
                this._applet_icon.set_icon_size(size);
            }
        } catch (e) {}
    },

    _buildStatusRow: function() {
        let outer = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 6px; padding: 2px 0;'
        });
        outer.set_width(MENU_CONTENT_WIDTH);

        let batteryPill = new St.BoxLayout({
            vertical: false, style: 'spacing: 6px; padding: 5px 12px;'
        });
        batteryPill.add_style_class_name('quick-settings-pill');

        this._batteryIcon = new St.Icon({
            icon_name: "battery-full-symbolic", icon_size: 16,
            style: 'color: #ffffff;'
        });
        batteryPill.add_child(this._batteryIcon);

        this._batteryLabel = new St.Label({
            text: "...", y_align: Clutter.ActorAlign.CENTER
        });
        batteryPill.add_child(this._batteryLabel);
        outer.add_child(batteryPill);

        outer.add_child(new St.Widget({ x_expand: true }));

        let self = this;
        let buttons = [
            { icon: "camera-photo-symbolic",       label: _("Screenshot"), cb: function() { self._takeScreenshot(); } },
            { icon: "preferences-system-symbolic", label: _("Settings"),   cb: function() { self._openSettings(); } },
            { icon: "system-lock-screen-symbolic", label: _("Lock"),       cb: function() { self._lockScreen(); } },
            { icon: "system-shutdown-symbolic",    label: _("Power"),      cb: function() { self._powerMenu.togglePowerMenu(); } }
        ];
        buttons.forEach(function(b) {
            let btn = new St.Button({
                style_class: "quick-settings-icon-button",
                reactive: true, can_focus: true
            });
            btn.set_child(new St.Icon({
                icon_name: b.icon, icon_size: 16,
                style: 'color: #ffffff;'
            }));
            btn.connect('clicked', b.cb);

            let tip = new St.Label({
                style: 'padding: 2px 8px; border-radius: 4px; background-color: rgba(0,0,0,0.8); color: #fff; font-size: 12px;',
                text: b.label, visible: false
            });
            Main.uiGroup.add_child(tip);
            self._floatingTips = self._floatingTips || [];
            self._floatingTips.push(tip);
            btn.connect('enter-event', function() {
                let [bx, by] = btn.get_transformed_position();
                tip.set_position(bx + btn.get_width() / 2 - tip.get_width() / 2, by + btn.get_height() + 4);
                tip.show();
            });
            btn.connect('leave-event', function() { tip.hide(); });

            outer.add_child(btn);
        });

        let item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        item.addActor(this._wrapCentered(outer), { span: -1, expand: true });
        this.menu.addMenuItem(item);
        this._statusItem = item;
    },

    // 菜单从上到下固定顺序（全量存在时）：
    //   0 状态行 / 1 关机二级(隐藏) / 2 选择器 / 3 播放器 / 4 音量 / 5 亮度 / 6 亮度二级(隐藏) / 7 开关网格
    // 亮度和 MPRIS 都是异步后插的，必须按 rank 算位置显式插入，不能用 append
    // 碰运气（谁后初始化谁沉底），否则时序一变就错位、每次重建跳一次。
    _menuPosOf: function(refItem) {
        try {
            if (!refItem) return -1;
            let items = this.menu._getMenuItems();
            for (let i = 0; i < items.length; i++) {
                if (items[i] === refItem) return i;
            }
        } catch (e) {}
        return -1;
    },

    _rankOf: function(key) {
        let order = ['status', 'power', 'chooser', 'player', 'volume',
                     'brightness', 'brightnessSection', 'toggle'];
        for (let i = 0; i < order.length; i++) {
            if (order[i] === key) return i;
        }
        return -1;
    },

    // 目标 key 应该排第几个 = 统计 rank 更小的、当前已在菜单里的项有几个。
    // 这样无论谁先谁后插入，最终收敛到同一顺序；重建时先销毁旧项再调同样收敛。
    _posForKey: function(key) {
        let want = this._rankOf(key);
        let refs = [
            ['status', this._statusItem],
            ['power', this._powerSection],
            ['chooser', this._mprisController ? this._mprisController._chooserWrapper : null],
            ['player', this._mprisController ? this._mprisController._playerWrapper : null],
            ['volume', this._volumeItem],
            ['brightness', this._briItem],
            ['brightnessSection', this._brightnessSection],
            ['toggle', this._toggleItem]
        ];
        let pos = 0;
        for (let i = 0; i < refs.length; i++) {
            if (this._rankOf(refs[i][0]) < want && this._menuPosOf(refs[i][1]) >= 0) {
                pos++;
            }
        }
        return pos;
    },

    _insertOrdered: function(key, menuItem) {
        let pos = this._posForKey(key);
        try {
            let n = this.menu._getMenuItems().length;
            if (pos < 0 || pos >= n) this.menu.addMenuItem(menuItem);
            else this.menu.addMenuItem(menuItem, pos);
        } catch (e) {
            this.menu.addMenuItem(menuItem);
        }
    },

    _buildSliders: function() {
        let self = this;

        // Volume
        let volItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        volItem.actor.add_style_class_name('quick-settings-slider-item');

        let volBox = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 10px; padding: 4px 0;'
        });
        volBox.set_width(MENU_CONTENT_WIDTH);

        this._volumeIcon = new St.Icon({
            icon_name: "audio-volume-medium-symbolic",
            icon_size: 16, style: 'color: #ffffff;'
        });
        this._volumeIconBtn = new St.Button({
            style_class: 'quick-settings-icon-inline-btn',
            reactive: true, can_focus: true
        });
        this._volumeIconBtn.set_child(this._volumeIcon);
        this._volumeIconBtn.connect('clicked', function() { self._volumeCtrl.toggleMute(); });
        volBox.add_child(this._volumeIconBtn);

        this._volumeSlider = new Slider.Slider(0.5);
        this._volumeSlider.actor.x_expand = true;
        volBox.add_child(this._volumeSlider.actor);

        volItem.addActor(this._wrapCentered(volBox), { span: -1, expand: true });
        this._insertOrdered('volume', volItem);
        this._volumeItem = volItem;
        this._volumeSlider.connect('value-changed', function(s, v) { self._volumeCtrl.onVolumeChanged(v); });
        this._addSliderTooltip(this._volumeSlider, '%');

        // 亮度探测（ddcutil 可达秒级）扔后台，主菜单先出来；
        // 亮度行晚一拍插入，用户打开菜单时大概率已就绪。
        // detectAllDisplays 内部已检查依赖，不可用时返回空数组，
        // 此处直接传结果，避免重复探测。
        Mainloop.idle_add(function() {
            try {
                self._displays = self._brightnessCtrl.detectAllDisplays();
                if (self._displays.length === 0) {
                    global.log("QS _buildSliders: no displays usable, skipping");
                    return false;
                }
                self._buildBrightnessUI(self._displays);
            }
            catch (e) { global.logError("QS _buildBrightnessUI: " + e.message + "\n" + e.stack); }
            return false;
        });
    },

     _buildBrightnessUI: function(displays) {
        let self = this;
        // Brightness
        this._displays = displays || this._brightnessCtrl.detectAllDisplays();
        if (this._displays.length === 0) {
            this._primarySlider = null;
            this._brightnessSection = null;
            return;
        }

        this._primaryDisplay = this._brightnessCtrl.findPrimaryDisplay(this._displays);
        for (let d of this._displays) {
            this._brightnessCache[d.id] = 0.5;
        }

        let briItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        briItem.actor.add_style_class_name('quick-settings-slider-item');

        let briBox = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 10px; padding: 4px 0;'
        });
        briBox.set_width(MENU_CONTENT_WIDTH);

        this._brightnessIconBtn = new St.Button({
            style_class: 'quick-settings-icon-inline-btn',
            reactive: true, can_focus: true
        });
        this._brightnessIconBtn.set_child(new St.Icon({
            icon_name: "display-brightness-symbolic",
            icon_size: 16, style: 'color: #ffffff;'
        }));
        this._brightnessIconBtn.connect('clicked', function() { self._brightnessCtrl.toggleBrightnessMenu(); });
        briBox.add_child(this._brightnessIconBtn);

        this._primarySlider = new Slider.Slider(0.5);
        this._primarySlider.actor.x_expand = true;
        briBox.add_child(this._primarySlider.actor);
        this._primarySlider.connect('value-changed', function(s, v) {
            self._brightnessCtrl.onDisplayBrightnessChanged(self._primaryDisplay, v);
            if (self._primaryDisplay.slider) {
                self._updatingBrightness = true;
                try { self._primaryDisplay.slider.setValue(v); } catch (e) {}
                self._updatingBrightness = false;
            }
        });

        this._addSliderTooltip(this._primarySlider, '%');
        briItem.addActor(this._wrapCentered(briBox), { span: -1, expand: true });
        // 定点插入：播放器之后、开关网格之前。idle 异步执行时开关网格/MPRIS
        // 可能已经在菜单里了，直接 append 就会掉到最下方。
        this._insertOrdered('brightness', briItem);
        this._briItem = briItem;

        // 亮度二级菜单：内联盒子模式（同选择器/关机菜单，不撑主菜单）
        let briBox2 = new St.BoxLayout({
            vertical: true,
            style: 'margin: 4px 6px; padding: 4px; border-radius: 10px; background-color: rgba(255,255,255,0.07); width: 336px; max-width: 336px;'
        });
        this._brightnessBox = briBox2;
        for (let d of this._displays) {
            this._brightnessCtrl.buildDisplayRow(d);
        }
        let briWrapper = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        briWrapper.addActor(briBox2, { span: -1 });
        briWrapper.actor.hide();
        // 二级菜单紧跟亮度滑块行后面（同样不能 append，否则跑到开关网格下面）
        this._insertOrdered('brightnessSection', briWrapper);
        this._brightnessSection = briWrapper;

        Mainloop.timeout_add(800, function() {
            self._brightnessCtrl.refreshAllBrightnessAsync();
            return false;
        });
    },

    _initMpris: function() {
        this._mprisController = new MprisController(this);
        this._mprisController.init();
    },

    _updateMprisUI: function() {
        let ctrl = this._mprisController;
        if (!ctrl) return;

        if (ctrl._playerWrapper) {
            try {
                let pw = ctrl._playerWrapper;
                if (pw.actor.get_parent()) pw.actor.get_parent().remove_child(pw.actor);
                pw.destroy();
            } catch(e) {}
            ctrl._playerWrapper = null;
        }

        if (ctrl._chooserWrapper) {
            try {
                let cw = ctrl._chooserWrapper;
                if (cw.actor.get_parent()) cw.actor.get_parent().remove_child(cw.actor);
                cw.destroy();
            } catch(e) {}
            ctrl._chooserWrapper = null;
        }
        ctrl._chooserBox = null;

        if (ctrl._players.length === 0) return;

        // MPRIS 定点插入：关机二级之后、音量之前（选择器 2、播放器 3）。
        // 用 rank 算位置而不用写死数字：缺项（单播放器无选择器、无亮度等）
        // 时自动前移；每次重建走同一算法，位置稳定不跳。
        if (ctrl._players.length > 1) {
            let chooserBox = ctrl._buildChooserBox();
            ctrl._refreshChooser();
            let chooserWrapper = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            chooserWrapper.addActor(chooserBox, { span: -1 });
            this._insertOrdered('chooser', chooserWrapper);
            ctrl._chooserWrapper = chooserWrapper;
        }

        let actor = ctrl._buildPlayerActor();
        if (actor) {
            ctrl._playerWrapper = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            ctrl._playerWrapper.addActor(actor, { span: -1 });
            actor.show();
            this._insertOrdered('player', ctrl._playerWrapper);
        }
    },

    onNetworkClick: function() {
        let enabled = this._cachedNetwork.wifiEnabled;
        GLib.spawn_command_line_async('nmcli radio wifi ' + (enabled ? 'off' : 'on'));
        this._cachedNetwork.wifiEnabled = !enabled;
        if (enabled) {
            // 正在关闭：立刻清除陈旧的 wifi 连接状态，UI 马上给出"已关闭"反馈
            //（有线连接不受影响，仍正常显示）
            this._cachedNetwork.hasWifi = false;
        }
        this._sysState.applyNetworkButtonUI();
        let self = this;
        // 延时重查一次：等 NM 状态落定后校准（点击时已做乐观更新）
        Mainloop.timeout_add(2000, function() {
            self._sysState.queryNetworkAsync(function() { self._sysState.applyNetworkButtonUI(); });
            return false;
        });
    },

    onBluetoothClick: function() {
        let powered = this._cachedBluetooth.powered;
        let self = this;
        if (powered) {
            GLib.spawn_command_line_async('bluetoothctl power off');
            this._cachedBluetooth.powered = false;
            this._cachedBluetooth.connected = false;
            this._sysState.applyBluetoothButtonUI();
            // 蓝牙协议栈反应慢：关 1 秒、开 3 秒后再重查校准（点击时已做乐观更新）
            Mainloop.timeout_add(1000, function() {
                self._sysState.queryBluetoothAsync(function() { self._sysState.applyBluetoothButtonUI(); });
                return false;
            });
        } else {
            // 先解 rfkill 再开电：经 _runCmd 串行，不拼 shell 字符串
            this._runCmd(['rfkill', 'unblock', 'bluetooth'], function() {
                self._spawnDetached(['bluetoothctl', 'power', 'on']);
            });
            this._cachedBluetooth.powered = true;
            this._cachedBluetooth.connected = false;
            this._sysState.applyBluetoothButtonUI();
            Mainloop.timeout_add(3000, function() {
                self._sysState.queryBluetoothAsync(function() { self._sysState.applyBluetoothButtonUI(); });
                return false;
            });
        }
    },

    openWifiSettings: function() {
        this._ignoreClose = false;
        this.menu.close();
        let self = this;
        Mainloop.timeout_add(300, function() {
            // 打开网络设置面板，可选择连接哪个网络
            self._spawnDetached(['cinnamon-settings', 'network']);
            return false;
        });
    },

    openBluetoothSettings: function() {
        this._ignoreClose = false;
        this.menu.close();
        let self = this;
        Mainloop.timeout_add(300, function() {
            self._spawnDetached(['blueman-manager']);
            return false;
        });
    },

    _takeScreenshot: function() {
        this._ignoreClose = false;
        let cmd = 'gnome-screenshot';
        if (this._settings) cmd = this._settings.getValue('screenshot-command') || cmd;
        try {
            let [ok, argv] = GLib.shell_parse_argv(cmd);
            if (ok && argv.length > 0) {
                GLib.spawn_async(null, argv, null,
                    GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
            }
        } catch (e) {
            global.logError("QS screenshot: " + e.message);
        }
        this.menu.close();
    },
    _openSettings: function() {
        this._ignoreClose = false;
        try {
            // 同步扫描主题列表：实测约 20ms，用户无感知；扫完再开设置，保证下拉项最新。
            // argv 形式：applet 路径含空格也不会被 shell 切碎。
            GLib.spawn_sync(null,
                ['python3', this._appletMetadata.path + '/scripts/scan_themes.py'],
                null, GLib.SpawnFlags.SEARCH_PATH, null);
            this._updateSettingsSchema();
        } catch(e) {
            global.logError("QS scan themes: " + e.message);
        }
        this._spawnDetached(['cinnamon-settings']);
        this.menu.close();
    },
    _lockScreen: function() {
        this._ignoreClose = false;
        this._spawnDetached(['cinnamon-screensaver-command', '--lock']);
        this.menu.close();
    },

    on_applet_added_to_panel: function() {
        // 此时 actor 已挂到 panel 上，才能定位所在区域 → 重算默认图标尺寸
        try { this._applyPanelIcon(); } catch(e) {}
    },

    on_panel_height_changed: function() {
        this._applyPanelIcon();
    },

    on_applet_clicked: function() {
        this._ignoreClose = false;
        if (this._powerSection && this._powerMenuVisible) {
            this._powerMenuVisible = false;
            this._powerSection.actor.hide();
        }
        if (this._brightnessSection && this._brightnessVisible) {
            this._brightnessVisible = false;
            this._brightnessSection.actor.hide();
        }
        if (this._mprisController) this._mprisController._collapseChooser();
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
        // 销毁挂在 Main.uiGroup 上的悬浮提示框
        if (this._floatingTips) {
            for (let i = 0; i < this._floatingTips.length; i++) {
                try { this._floatingTips[i].destroy(); } catch(e) {}
            }
            this._floatingTips = [];
        }
        if (this._contextMenu) {
            try { this._contextMenu.destroy(); } catch(e) {}
            this._contextMenu = null;
        }
        // 断开本模块所有信号：settings 变更、panel 尺寸、Cvc，防重载累积
        if (this._settings && this._settingsIds) {
            for (let i = 0; i < this._settingsIds.length; i++) {
                try { this._settings.disconnect(this._settingsIds[i]); } catch(e) {}
            }
            this._settingsIds = [];
        }
        if (this._panelSettings && this._panelZoneSizeId) {
            try { this._panelSettings.disconnect(this._panelZoneSizeId); } catch(e) {}
            this._panelZoneSizeId = 0;
        }
        if (this._volumeCtrl) {
            try { this._volumeCtrl.detachAll(); } catch(e) {}
        }
        if (this._sysState) {
            // destroy 内含 poll 定时器 + UPower/BlueZ/NM 信号订阅的清理
            try { this._sysState.destroy(); } catch(e) {}
            this._sysState = null;
        }
        if (this._themeSwitcher) {
            try { this._themeSwitcher.destroy(); } catch(e) {}
            this._themeSwitcher = null;
        }
        if (this._mprisController) {
            this._mprisController.destroy();
            this._mprisController = null;
        }
        for (let k in this._brightnessDebounce) {
            if (this._brightnessDebounce[k]) {
                try { GLib.source_remove(this._brightnessDebounce[k]); } catch (e) {}
            }
        }
        if (this._control) {
            if (this._controlStateId) {
                try { this._control.disconnect(this._controlStateId); } catch(e) {}
                this._controlStateId = 0;
            }
            try { this._control.close(); } catch (e) {}
        }
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    return new MyApplet(metadata, orientation, panel_height, instanceId);
}
