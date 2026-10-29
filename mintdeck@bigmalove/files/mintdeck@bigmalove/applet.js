// applet.js —— MintDeck 入口
//
// 生命周期：Cinnamon 加载本文件 → main() 返回实例 → on_applet_added_to_panel 里挂浮层。
// 浮层用 Main.layoutManager.addChrome()（官方 API），它负责：
//   · 把 actor 放到 chrome 层（普通窗口之上）
//   · 把它加进 stage 输入区域（所以只有它自己的矩形会吃掉点击）
//   · 全屏时按所在显示器自动隐藏（visibleInFullscreen）
// 详见 /usr/share/cinnamon/js/ui/layout.js:543-560 与 :833-864。
'use strict';

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Extension = imports.ui.extension;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const UUID = 'mintdeck@bigmalove';

// gettext 域与 Cinnamon 的惯例一致：Spices 安装时会把 po 编成 .mo 放到 ~/.local/share/locale。
// 悬浮岛/面板的文案不走 gettext（自绘 UI 需要「换语言立即生效」，见 lib/core/i18n.js），
// 但设置窗口与「小程序」列表由 xlet-settings 用 gettext 渲染，域必须是 uuid。
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

// 本 applet 的目录：优先问 Cinnamon（支持任意安装位置），退回用户目录
let BASE = null;
try {
    const ext = Extension.getExtension(UUID);
    if (ext && ext.meta && ext.meta.path) BASE = ext.meta.path;
} catch (e) { /* Extension 在极早期可能还没就绪 */ }
if (!BASE) BASE = GLib.build_filenamev([GLib.get_user_data_dir(), 'cinnamon', 'applets', UUID]);
imports.searchPath.unshift(BASE);

const I18n = imports.lib.core.i18n;
const I18nData = imports.lib.core.i18nData;

const IslandMod = imports.lib.deck.island;
const PanelMod = imports.lib.deck.panel;
const Store = imports.lib.deck.store;
const Data = imports.lib.deck.data;
const Live = imports.lib.deck.live;

// 界面文案：msgid 是中文原文，t() 按当前 locale 查词典（词典在构造函数里注入）
const _ = I18n.t;

let Themes = null;
try { Themes = imports.lib.core.theme; } catch (e) { Themes = null; }

// 尺寸档位表在这里：档位 → 七个收起尺寸值
let Geo = null;
try { Geo = imports.lib.core.geometry; } catch (e) { Geo = null; }

class MintDeckApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._instanceId = instance_id;
        this._chrome = [];          // 已挂到 chrome 的 actor
        this._openTimer = 0;
        this._closeTimer = 0;
        this._clockTimer = 0;
        this._refreshTimer = 0;
        this._hoverOpen = false;
        this._liveStops = [];

        // ---- 设置 -------------------------------------------------------
        this._settings = new Settings.AppletSettings(this, UUID, instance_id);
        const s = this._settings;
        s.bind('language', 'v_language', () => this._applyLanguage());
        s.bind('style', 'v_style', () => this._reload());
        s.bind('animations', 'v_animations', () => this._reload());
        s.bind('animationDuration', 'v_animDuration', () => this._reload());
        s.bind('panelTheme', 'v_theme', () => this._reloadTheme());
        s.bind('clockStyle', 'v_clockStyle', () => this._reload());
        s.bind('clock24Hour', 'v_clock24', () => this._tick());
        s.bind('showQuotaRing', 'v_showRing', () => this._reload());
        s.bind('showClock', 'v_showClock', () => this._reload());
        s.bind('showMonitor', 'v_showMonitor', () => this._reload());
        // 收起尺寸：默认 auto（按当前画出来的段数自动缩放），也可以钉死成小/标准/大三档。
        // 像素级微调只改表面不改内容，已经收进 geometry 的预设表。
        s.bind('collapsedSize', 'v_collapsedSize', () => this._reload());
        s.bind('openDelay', 'v_openDelay', () => {});
        s.bind('closeDelay', 'v_closeDelay', () => {});
        s.bind('defaultPage', 'v_defaultPage', () => this._panel.setPage(this.v_defaultPage));
        s.bind('monitor', 'v_monitor', () => this._reload());
        s.bind('showPanelIcon', 'v_showPanelIcon', () => this._applyPanelIcon());
        s.bind('hideInFullscreen', 'v_hideFullscreen', () => this._rebuildChrome());
        // 三个数据源开关连点时会连续触发，合并成一次刷新（每次刷新要枚举 ~240 个目录）
        s.bind('sourceClaude', 'v_sourceClaude', () => this._scheduleRefresh(120));
        s.bind('sourceDsh', 'v_sourceDsh', () => this._scheduleRefresh(120));
        s.bind('sourceWorkbuddy', 'v_sourceWorkbuddy', () => this._scheduleRefresh(120));

        // ---- 多语言 -----------------------------------------------------
        // 必须在 bind 之后：v_language 是 bind 时才用 defineProperty 挂到 this 上的，
        // 在 bind 之前读永远是 undefined（会被当成 auto → 跟随系统）。
        // 词典先注入，否则下面建菜单/画岛时 t() 只能拿到中文原文。
        I18n.setCatalog(I18nData && I18nData.CATALOG);
        I18n.setLocale(this._requestedLocale());

        // ---- 主题 -------------------------------------------------------
        this._themeStore = new Store.ThemeStore(BASE, Themes);
        this._theme = this._themeStore.get(this.v_theme);

        // ---- UI ---------------------------------------------------------
        this._island = new IslandMod.Island({ style: this.v_style, theme: this._theme });
        this._island.onContentChanged = () => this._layout();   // 内容变宽/变窄时重算形状
        this._panel = new PanelMod.Panel();
        this._panel.setSize(720, 268);
        this._panel.onAction = (action) => this._onPanelAction(action);
        this._panel.setTheme(this._theme);
        this._panel.setPage(this.v_defaultPage || 'usage');

        this._buildMenu();
        this._wireEvents();
        this._rebuildChrome();
        this._reload();
        this._startClock();

        this.set_applet_tooltip('MintDeck');
        this._applyPanelIcon();

        // 首次读取延后 1.2s：DSH 要起 zstd 子进程，别拖慢 shell 启动
        Data.schedule(this, 1200);
        this._startLive();
    }

    // ------------------------------------------------------------ 面板图标

    // 面板上的小图标只是入口，默认隐藏；设置里勾上才显示。
    // 隐藏后用 is_visible 判断不成立，所以以设置值为准（Cinnamon 重排面板时可能把 actor show 回来，
    // on_applet_added_to_panel 里会再收一次）。
    _applyPanelIcon() {
        if (!this.actor) return;
        if (this.v_showPanelIcon) {
            this._ensurePanelIconActor();
            this.actor.show();
            this.set_applet_tooltip('MintDeck');
        } else {
            if (this._applet_tooltip) this._applet_tooltip.hide();
            this.actor.hide();
        }
    }

    // 这个 applet 本身没有面板图标，需要自己往 actor 里放一个（icon.png）
    _ensurePanelIconActor() {
        if (this._panelIconActor) return;
        let size = 24;
        try { size = this.getPanelIconSize(St.IconType.FULLCOLOR) || size; } catch (e) { /* 老版本没有 */ }
        const icon = new St.Icon({ icon_size: size, style_class: 'applet-icon' });
        try {
            icon.set_gicon(new Gio.FileIcon({
                file: Gio.file_new_for_path(GLib.build_filenamev([BASE, 'icon.png']))
            }));
        } catch (e) { global.logError(e); }
        this.actor.add(icon, { y_align: St.Align.MIDDLE, y_fill: false });
        this._panelIconActor = icon;
    }

    // ------------------------------------------------------------ 浮层挂载

    _rebuildChrome() {
        for (const actor of this._chrome) {
            try { Main.layoutManager.removeChrome(actor); } catch (e) { /* 已移除 */ }
        }
        this._chrome = [];

        const params = {
            visibleInFullscreen: !this.v_hideFullscreen,
            affectsStruts: false,
            affectsInputRegion: true
        };
        Main.layoutManager.addChrome(this._island.actor, params);
        Main.layoutManager.addChrome(this._panel.actor, params);
        this._chrome.push(this._island.actor, this._panel.actor);
        // addChrome 会把 actor 纳入 chrome 的显示管理，这里显式收一次，保证「默认收起」
        this._panel.actor.hide();
        this._reload();
    }

    _removeChrome() {
        for (const actor of this._chrome) {
            try { Main.layoutManager.removeChrome(actor); } catch (e) { /* ignore */ }
        }
        this._chrome = [];
    }

    // ------------------------------------------------------------ 布局

    _pickMonitor() {
        const lm = Main.layoutManager;
        if (this.v_monitor === 'cursor' && lm.currentMonitor) return lm.currentMonitor;
        return lm.primaryMonitor || lm.monitors[0];
    }

    // 工作区顶部：顶部面板占据的区域要避开，否则刘海会和面板图标叠在一起
    _workArea(monitor) {
        const box = Main.layoutManager.panelBox;
        let top = monitor.y;
        if (box && box.visible && box.y < monitor.y + monitor.height / 2) {
            top = Math.max(top, box.y + box.height);
        }
        return {
            x: monitor.x,
            y: top,
            width: monitor.width,
            height: Math.max(40, monitor.y + monitor.height - top)
        };
    }

    _scaleFactor() {
        try {
            return St.ThemeContext.get_for_stage(global.stage).scale_factor || 1;
        } catch (e) {
            return 1;
        }
    }

    _currentSettings(units) {
        // 档位 → 七个尺寸值（标准档与上游默认逐值一致）。lineTop 不属于档位，保持 4。
        // auto 档这里按「当前画出来的段数」现算，所以内容一变整套尺寸就跟着变。
        const preset = (Geo && Geo.presetSettings) ? Geo.presetSettings(this.v_collapsedSize, units) : {};
        preset.lineTop = 4;
        return preset;
    }

    _layout() {
        const monitor = this._pickMonitor();
        if (!monitor) return;
        const work = this._workArea(monitor);
        const style = this.v_style || 'notch';
        // 自动宽度：把内容想要的宽度交给 geometry（上游 NotchAutoWidth / CapsuleAutoWidth 的同一套算法）。
        // 内容宽度按「当前档位」估，而不是按上一帧 shape 的 scale —— 切档时不会先窄后宽地跳一下。
        // auto 档还要把段数传下去：段数决定高度与内容缩放（1 段 24 高 … 5 段 40 高）。
        const units = (this._island && this._island.contentUnits) ? this._island.contentUnits() : 0;
        const k = (Geo && Geo.contentScale) ? Geo.contentScale(this.v_collapsedSize, style, units) : 1;
        const wanted = this._island.contentWidthEstimate(k);
        const shape = IslandMod.Island.computeShape(
            this._currentSettings(units), style, monitor, work, this._scaleFactor(), wanted);
        this._island.applyShape(shape);
        this._panel.place(shape, monitor);   // 尺寸由 panel 自己按页决定（_autosize）
        this._shape = shape;
    }

    _reload() {
        this._theme = this._themeStore.get(this.v_theme);
        this._island.setTheme(this._theme);
        this._panel.setTheme(this._theme);
        this._island.setClockStyle(this.v_clockStyle);
        this._layout();
        // 收起态内容开关
        if (this.v_showClock) this._tick(); else this._island.setClockText('');
        if (!this.v_showRing) this._island.setQuotas([]);
        return false;
    }

    _reloadTheme() {
        this._reload();
    }

    // ------------------------------------------------------------ 时钟

    _startClock() {
        this._tick();
        if (this._clockTimer) GLib.source_remove(this._clockTimer);
        this._clockTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._tick();
            return true;
        });
    }

    _tick() {
        if (!this.v_showClock) { this._island.setClockText(''); return false; }
        const now = new Date();
        let h = now.getHours();
        const m = ('0' + now.getMinutes()).slice(-2);
        let suffix = '';
        if (!this.v_clock24) {
            suffix = h >= 12 ? ' PM' : ' AM';
            h = h % 12 || 12;
        } else {
            h = ('0' + h).slice(-2);
        }
        this._island.setClockText(h + ':' + m + suffix);
        return false;
    }

    // ------------------------------------------------------------ 交互

    _wireEvents() {
        const islandActor = this._island.actor;

        islandActor.connect('enter-event', () => {
            this._hoverOpen = true;
            this._cancelClose();
            this._scheduleOpen();
            return false;
        });
        islandActor.connect('leave-event', () => {
            this._hoverOpen = false;
            this._scheduleClose();
            return false;
        });
        islandActor.connect('button-release-event', (actor, event) => {
            if (event.get_button() !== 1) return false;
            if (this._panel.actor.visible) this._closePanel(); else this._openPanel();
            return true;
        });

        this._panel.actor.connect('enter-event', () => {
            this._cancelClose();
            return false;
        });
        this._panel.actor.connect('leave-event', () => {
            this._scheduleClose();
            return false;
        });
    }

    _scheduleOpen() {
        this._cancelOpen();
        const delay = this.v_openDelay || 0;
        if (delay <= 0) { this._openPanel(); return; }
        this._openTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this._openTimer = 0;
            if (this._hoverOpen) this._openPanel();
            return false;
        });
    }

    _cancelOpen() {
        if (this._openTimer) { GLib.source_remove(this._openTimer); this._openTimer = 0; }
    }

    _scheduleClose() {
        this._cancelClose();
        const delay = this.v_closeDelay === undefined ? 260 : this.v_closeDelay;
        this._closeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(0, delay), () => {
            this._closeTimer = 0;
            // 指针可能已经回到岛或面板上
            if (this._island.actor.hover || this._panel.actor.hover) return false;
            this._closePanel();
            return false;
        });
    }

    _cancelClose() {
        if (this._closeTimer) { GLib.source_remove(this._closeTimer); this._closeTimer = 0; }
    }

    _openPanel() {
        this._cancelOpen();
        this._panel.setPage(this._panel.page || this.v_defaultPage || 'usage');
        this._panel.show(this.v_animations, this.v_animDuration);
    }

    _closePanel() {
        this._cancelClose();
        this._panel.hide(this.v_animations, Math.round((this.v_animDuration || 360) * 0.6));
    }

    // ------------------------------------------------------------ 语言

    // 设置的 language：'auto' 跟随系统（GLib.get_language_names() 的顺序就是优先级）
    _requestedLocale() {
        const want = this.v_language;
        if (want && want !== 'auto') return want;
        let names = [];
        try { names = GLib.get_language_names() || []; } catch (e) { names = []; }
        return I18n.pickLocale(names);
    }

    // 换语言：菜单要重建（菜单项是建菜单时写死的文字），画布上的字靠重画，
    // 面板里的列是 data.js 生成的字符串，所以还要重新读一遍数据。
    _applyLanguage() {
        I18n.setLocale(this._requestedLocale());
        // 构造早期（UI 还没建完）只换 locale，剩下的交给构造流程用新语言画一遍
        if (!this._panel || !this._menu) return false;
        this._rebuildMenu();
        this._tick();
        // 下拉框连点会连着触发几次，合并掉：列文字要重算，但不能每次都全量扫一遍磁盘
        this._scheduleRefresh(120);
        this._panel.actor.queue_repaint();
        return false;
    }

    // 合并短时间内的多次刷新请求（延迟 0 = 下一拍就刷）
    _scheduleRefresh(delayMs) {
        if (this._refreshTimer) { GLib.source_remove(this._refreshTimer); this._refreshTimer = 0; }
        this._refreshTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(0, delayMs || 0), () => {
            this._refreshTimer = 0;
            this._refreshData();
            return false;
        });
    }

    // ------------------------------------------------------------ 菜单

    _buildMenu() {
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new Applet.AppletPopupMenu(this, this.orientation);
        this._menuManager.addMenu(this._menu);
        this._fillMenu();
    }

    // 重建而不是每次新建：换语言时只需换掉菜单项，菜单对象与 manager 保留
    _rebuildMenu() {
        if (!this._menu) { this._buildMenu(); return; }
        this._menu.removeAll();
        this._fillMenu();
    }

    _fillMenu() {
        this._menu.addAction(_('设置…'), () => this.configureApplet());
        this._menu.addAction(_('重新读取数据'), () => this._refreshData());
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._menu.addAction(_('关于 MintDeck'), () => {
            Main.notify('MintDeck', _('基于 BrimDeck（Apache-2.0）的 Cinnamon 复刻。'));
        });
    }

    // M1 接入真实数据；在此之前是空实现，避免菜单点了没反应
    _onPanelAction(action) {
        if (action === 'refresh') { this._refreshData(); return; }
        if (action === 'settings') { this.configureApplet(); return; }
        const music = this._liveStops.find(s => typeof s.playPause === 'function');
        if (!music) return;
        if (action === 'music:playpause') music.playPause();
        else if (action === 'music:next') music.next();
        else if (action === 'music:prev') music.previous();
    }

    _startLive() {
        this._stopLive();
        try {
            this._liveStops.push(Live.startMusic(this, (info) => {
                this._panel.setNowPlaying(info);
                this._island.setNowPlaying(info);
            }));
        } catch (e) { global.logError(e); }
        try {
            this._liveStops.push(Live.startMonitor(this, (sample) => {
                this._panel.setMonitor(sample);
                this._island.setMonitor(sample, this.v_showMonitor !== false);
            }));
        } catch (e) { global.logError(e); }
    }

    _stopLive() {
        for (const stop of this._liveStops) { try { stop(); } catch (e) { } }
        this._liveStops = [];
    }

    _refreshData() {
        try {
            Data.refresh(this);
        } catch (e) {
            Main.notify('MintDeck', _('读取失败：%s', e.message));
        }
    }

    // ------------------------------------------------------------ 生命周期

    on_applet_clicked() {
        if (this._panel.actor.visible) this._closePanel(); else this._openPanel();
    }

    on_applet_added_to_panel() {
        this._rebuildChrome();
        this._startClock();
        this._reload();
        this._applyPanelIcon();
        this._startLive();     // 构造期 session bus 可能未就绪，这里兜一次（_startLive 会先停旧的）
    }

    on_applet_removed_from_panel() {
        this._cancelOpen();
        this._cancelClose();
        if (this._clockTimer) { GLib.source_remove(this._clockTimer); this._clockTimer = 0; }
        if (this._refreshTimer) { GLib.source_remove(this._refreshTimer); this._refreshTimer = 0; }
        this._stopLive();
        this._removeChrome();
        try { this._menu.destroy(); } catch (e) { /* ignore */ }
        try { this._island.destroy(); } catch (e) { /* ignore */ }
        try { this._panel.destroy(); } catch (e) { /* ignore */ }
        try { this._settings.finalize(); } catch (e) { /* ignore */ }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MintDeckApplet(metadata, orientation, panel_height, instance_id);
}
