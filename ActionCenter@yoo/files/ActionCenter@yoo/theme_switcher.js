const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

function ThemeSwitcher(applet) {
    this._applet = applet;
    // Gio.Settings 建一次复用：创建背后是 D-Bus 开销，别每次现建
    this._desktopSettings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.interface' });
    this._colorSettings = new Gio.Settings({ schema_id: 'org.cinnamon.settings-daemon.plugins.color' });
    try {
        this._cinnamonSettings = new Gio.Settings({ schema_id: 'org.cinnamon.theme' });
    } catch (e) {
        this._cinnamonSettings = null;
    }
    // xapp 门户 Dark mode（系统设置→主题→设置里的同款开关，老系统可能没有该 schema）
    try {
        this._portalSettings = new Gio.Settings({ schema_id: 'org.x.apps.portal' });
    } catch (e) {
        this._portalSettings = null;
    }
}

ThemeSwitcher.prototype = {
    // 主题/夜灯走 gsettings 信号即时刷新（12 秒轮询只当兜底）。
    // 外部改主题（lxappearance/别的小工具）也能立刻反映到开关上。
    watchSettings: function() {
        if (this._themeWatches) return;
        this._themeWatches = [];
        let self = this;
        let watch = function(obj, key, fn) {
            try {
                self._themeWatches.push([obj, obj.connect('changed::' + key, fn)]);
            } catch (e) {
                global.logError("QS theme watch: " + e.message);
            }
        };
        watch(this._desktopSettings, 'gtk-theme', function() {
            self.updateDarkModeState();
            // 同 applet theme-set：延迟等新样式落定再实测
            Mainloop.timeout_add(500, function() {
                try { self._applet._applyMenuTheme(); } catch (e) {}
                return false;
            });
        });
        watch(this._desktopSettings, 'icon-theme', function() { self.updateDarkModeState(); });
        watch(this._colorSettings, 'night-light-enabled', function() { self.updateNightLightState(); });
    },

    destroy: function() {
        if (this._themeWatches) {
            for (let i = 0; i < this._themeWatches.length; i++) {
                try { this._themeWatches[i][0].disconnect(this._themeWatches[i][1]); } catch (e) {}
            }
            this._themeWatches = null;
        }
    },

    _isDarkNow: function() {
        // 深色整套含 gtk + cinnamon 两项，只看 gtk 会在两者配得不一样时误判
        //（如 gtk=Nebula-Dark-Studio 而配置深色 GTK=Nebula-Dark）。
        // 两项投票：深色命中多判暗，浅色命中多判亮，打平/都没命中回退名启发式。
        try {
            let appletSettings = this._applet._settings;
            let darkGtk = appletSettings ? appletSettings.getValue('dark-gtk-theme') : '';
            let lightGtk = appletSettings ? appletSettings.getValue('light-gtk-theme') : '';
            let darkCin = appletSettings ? appletSettings.getValue('dark-cinnamon-theme') : '';
            let lightCin = appletSettings ? appletSettings.getValue('light-cinnamon-theme') : '';
            let curGtk = this._desktopSettings.get_string('gtk-theme');
            let curCin = '';
            try {
                if (this._cinnamonSettings) curCin = this._cinnamonSettings.get_string('name');
            } catch (e2) {}
            let darkHit = 0, lightHit = 0;
            if (darkGtk && curGtk === darkGtk) darkHit++;
            if (darkCin && curCin === darkCin) darkHit++;
            if (lightGtk && curGtk === lightGtk) lightHit++;
            if (lightCin && curCin === lightCin) lightHit++;
            if (darkHit !== lightHit) return darkHit > lightHit;
            // 回退：名启发式，gtk 和 cinnamon 任一含 Dark 即判暗
            if (/[Dd]ark/.test(curGtk || '')) return true;
            if (/[Dd]ark/.test(curCin || '')) return true;
            return false;
        } catch(e) {
            return false;
        }
    },

    toggleDarkMode: function() {
        try {
            let goingDark = !this._isDarkNow();
            this.applyDarkStyleTheme(goingDark);
        } catch (e) { global.logError("QS toggleDarkMode: " + e.message); }
        let self = this;
        Mainloop.timeout_add(500, function() { self.updateDarkModeState(); return false; });
    },

    updateDarkModeState: function() {
        try {
            this._applet._toggleMgr.setToggleState('darkmode', this._isDarkNow());
        } catch (e) { global.logError("QS updateDarkModeState: " + e.message); }
    },

    toggleNightLight: function() {
        try {
            let newState = !this._colorSettings.get_boolean('night-light-enabled');
            this._colorSettings.set_boolean('night-light-enabled', newState);
        } catch (e) { global.logError("QS toggleNightLight: " + e.message); }
        let self = this;
        Mainloop.timeout_add(500, function() { self.updateNightLightState(); return false; });
    },

    updateNightLightState: function() {
        try {
            this._applet._toggleMgr.setToggleState('nightlight', this._colorSettings.get_boolean('night-light-enabled'));
        } catch (e) { global.logError("QS updateNightLightState: " + e.message); }
    },

    applyDarkStyleTheme: function(isDark) {
        let appletSettings = this._applet._settings;
        if (!appletSettings) return;
        let prefix = isDark ? 'dark' : 'light';
        // 先备份，写一半抛异常就地回滚，不留"GTK 变了图标没变"的脏状态
        let backup = {};
        try {
            backup.gtk = this._desktopSettings.get_string('gtk-theme');
            backup.icon = this._desktopSettings.get_string('icon-theme');
            backup.cursor = this._desktopSettings.get_string('cursor-theme');
            if (this._cinnamonSettings) backup.cinnamon = this._cinnamonSettings.get_string('name');
            if (this._portalSettings) backup.portal = this._portalSettings.get_string('color-scheme');
        } catch (e0) {}
        try {
            let s = this._desktopSettings;
            let gtkTheme = appletSettings.getValue(prefix + '-gtk-theme')
                        || this._guessVariant(s.get_string('gtk-theme'), isDark, 'gtk');
            if (gtkTheme) {
                s.set_string('gtk-theme', gtkTheme);
            }
            let iconTheme = appletSettings.getValue(prefix + '-icon-theme')
                         || this._guessVariant(s.get_string('icon-theme'), isDark, 'icon');
            if (iconTheme) {
                s.set_string('icon-theme', iconTheme);
            }
            let cursorTheme = appletSettings.getValue(prefix + '-cursor-theme')
                           || this._guessVariant(s.get_string('cursor-theme'), isDark, 'cursor');
            if (cursorTheme) {
                s.set_string('cursor-theme', cursorTheme);
            }
            // 桌面主题（系统设置→主题→桌面同款）：整桌深浅跟随，未配置按规则猜
            try {
                if (this._cinnamonSettings) {
                    let curCinnamon = this._cinnamonSettings.get_string('name');
                    let cinnamonTheme = appletSettings.getValue(prefix + '-cinnamon-theme')
                                     || this._guessVariant(curCinnamon, isDark, 'cinnamon');
                    if (cinnamonTheme) {
                        this._cinnamonSettings.set_string('name', cinnamonTheme);
                    }
                }
            } catch (e3) {
                global.logError("QS cinnamon theme: " + e3.message);
            }
            // Libadwaita/xapp 类应用不跟 GTK 主题，只认门户 color-scheme：
            // 深色→prefer-dark，浅色→恢复系统默认（let applications decide）
            try {
                if (this._portalSettings) {
                    this._portalSettings.set_string('color-scheme', isDark ? 'prefer-dark' : 'default');
                }
            } catch (e2) {
                global.logError("QS portal color-scheme: " + e2.message);
            }
        } catch (e) {
            global.logError("QS _applyDarkStyleTheme: " + e.message);
            // 回滚已写入的部分
            try {
                if (backup.gtk !== undefined) this._desktopSettings.set_string('gtk-theme', backup.gtk);
                if (backup.icon !== undefined) this._desktopSettings.set_string('icon-theme', backup.icon);
                if (backup.cursor !== undefined) this._desktopSettings.set_string('cursor-theme', backup.cursor);
                if (backup.cinnamon !== undefined && this._cinnamonSettings) {
                    this._cinnamonSettings.set_string('name', backup.cinnamon);
                }
                if (backup.portal !== undefined && this._portalSettings) {
                    this._portalSettings.set_string('color-scheme', backup.portal);
                }
            } catch (e4) {
                global.logError("QS theme rollback: " + e4.message);
            }
        }
    },

    // 未配置主题名时按规则猜变体：dark 加 -Dark/-dark 后缀找存在的，
    // light 去后缀找存在的。存在性用各类型标志目录校验，找不到返回 ''。
    // kind: gtk（gtk-3.0）/ icon（index.theme）/ cursor（cursors）/ cinnamon（cinnamon）
    _guessVariant: function(cur, wantDark, kind) {
        try {
            if (!cur) return '';
            let dirs = (kind === 'gtk' || kind === 'cinnamon')
                ? ["/usr/share/themes", GLib.get_home_dir() + "/.themes"]
                : ["/usr/share/icons", GLib.get_home_dir() + "/.icons"];
            let ok = function(name) {
                for (let i = 0; i < dirs.length; i++) {
                    let base = dirs[i] + "/" + name;
                    if (kind === 'gtk' && GLib.file_test(base + "/gtk-3.0", GLib.FileTest.IS_DIR)) return name;
                    if (kind === 'icon' && GLib.file_test(base + "/index.theme", GLib.FileTest.EXISTS)) return name;
                    if (kind === 'cursor' && GLib.file_test(base + "/cursors", GLib.FileTest.IS_DIR)) return name;
                    if (kind === 'cinnamon' && GLib.file_test(base + "/cinnamon", GLib.FileTest.IS_DIR)) return name;
                }
                return '';
            };
            if (wantDark) {
                // 已是深色直接用；Mint-Y-Blue → Mint-Y-Dark-Blue 这类中缀也试
                if (/[Dd]ark/.test(cur)) return cur;
                let infix = cur.replace(/^(Mint-Y)(?!-Dark)/, '$1-Dark');
                if (infix !== cur) { let hit = ok(infix); if (hit) return hit; }
                let hit = ok(cur + '-Dark') || ok(cur + '-dark');
                if (hit) return hit;
                return '';
            }
            let stripped = cur.replace(/-Dark$/, '').replace(/-dark$/, '')
                              .replace(/^(Mint-Y)-Dark/, '$1');
            if (stripped !== cur) {
                let hit = ok(stripped);
                if (hit) return hit;
            }
            return '';
        } catch (e) {
            return '';
        }
    },

    toggleAirplaneMode: function() {
        let applet = this._applet;
        let newState = !applet._cachedAirplane;
        GLib.spawn_command_line_async(newState ? 'rfkill block all' : 'rfkill unblock all');
        applet._cachedAirplane = newState;
        applet._toggleMgr.setToggleState('airplane', newState);
        let self = this;
        Mainloop.timeout_add(1000, function() {
            self.updateAirplaneStateAsync();
            return false;
        });
    },

    updateAirplaneStateAsync: function() {
        let applet = this._applet;
        if (applet._hasRfkill === false) return;
        // rfkill list 格式：
        //   1: phy1: Wireless LAN
        //       Soft blocked: yes
        //       Hard blocked: no
        // 设备类型在标题行第三段，没有独立的 "type:" 行
        applet._runCmd(['rfkill', 'list'], function(out) {
            let lines = out.split('\n');
            let hasWifi = false;
            let wifiUnblocked = false;
            let hasBt = false;
            let btUnblocked = false;
            let curWireless = false;
            let curBt = false;
            let curBlocked = false;
            let commit = function() {
                if (curWireless) {
                    hasWifi = true;
                    if (!curBlocked) wifiUnblocked = true;
                } else if (curBt) {
                    hasBt = true;
                    if (!curBlocked) btUnblocked = true;
                }
            };
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let hm = line.match(/^\d+:\s+\S+:\s+(.+?)\s*$/);
                if (hm) {
                    commit();
                    let t = hm[1].toLowerCase();
                    curWireless = (t.indexOf('wireless') !== -1 || t.indexOf('wlan') !== -1 ||
                                   t.indexOf('wifi') !== -1 || t.indexOf('wwan') !== -1 ||
                                   t.indexOf('wimax') !== -1);
                    curBt = (!curWireless && t.indexOf('bluetooth') !== -1);
                    curBlocked = false;
                    continue;
                }
                let bm = line.match(/Soft blocked:\s+(\S+)/);
                if (bm) {
                    curBlocked = (bm[1] === 'yes');
                    commit();
                    curWireless = false;
                    curBt = false;
                    curBlocked = false;
                }
            }
            commit();

            let hasRadio = hasWifi || hasBt;
            if (!hasRadio) {
                // 无任何无线硬件：禁用开关并提示，而不是卡在"关"态
                applet._cachedAirplane = false;
                applet._toggleMgr.setToggleState('airplane', false);
                applet._toggleMgr.setRowEnabled('airplane', false, _("No device"));
                return;
            }
            applet._toggleMgr.setRowEnabled('airplane', true, "");
            let airplane = !wifiUnblocked && !btUnblocked;
            applet._cachedAirplane = airplane;
            applet._toggleMgr.setToggleState('airplane', airplane);
        });
    },

    togglePerformanceMode: function() {
        let applet = this._applet;
        let self = this;
        if (applet._hasPpTool === false) return;
        applet._runCmd(['powerprofilesctl', 'get'], function(out) {
            let cur = out.trim();
            let next = (cur === 'performance') ? 'balanced' : 'performance';
            GLib.spawn_command_line_async('powerprofilesctl set ' + next);
            Mainloop.timeout_add(800, function() {
                self.updatePerformanceStateAsync();
                return false;
            });
        });
    },

    updatePerformanceStateAsync: function() {
        let applet = this._applet;
        if (applet._hasPpTool === false) {
            applet._toggleMgr.setToggleState('performance', false);
            return;
        }
        applet._runCmd(['powerprofilesctl', 'get'], function(out) {
            let cur = out.trim();
            applet._toggleMgr.setToggleState('performance', cur === 'performance');
        });
    }
};
module.exports = ThemeSwitcher;
