const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

function ThemeSwitcher(applet) {
    this._applet = applet;
    // Gio.Settings 建一次复用：创建背后是 D-Bus 开销，别每次现建
    this._desktopSettings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.interface' });
    this._colorSettings = new Gio.Settings({ schema_id: 'org.cinnamon.settings-daemon.plugins.color' });
}

ThemeSwitcher.prototype = {
    _isDarkNow: function() {
        // 已配置暗/亮主题时按配置判断，否则回退到名称启发式
        try {
            let appletSettings = this._applet._settings;
            let darkGtk = appletSettings ? appletSettings.getValue('dark-gtk-theme') : '';
            let cur = this._desktopSettings.get_string('gtk-theme');
            if (darkGtk) return cur === darkGtk;
            return cur.indexOf('Dark') !== -1;
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
        try {
            let s = this._desktopSettings;
            let gtkTheme = appletSettings.getValue(prefix + '-gtk-theme');
            if (gtkTheme) {
                s.set_string('gtk-theme', gtkTheme);
            }
            let iconTheme = appletSettings.getValue(prefix + '-icon-theme');
            if (iconTheme) {
                s.set_string('icon-theme', iconTheme);
            }
            let cursorTheme = appletSettings.getValue(prefix + '-cursor-theme');
            if (cursorTheme) {
                s.set_string('cursor-theme', cursorTheme);
            }
        } catch (e) {
            global.logError("QS _applyDarkStyleTheme: " + e.message);
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
        applet._runCmd(['powerprofilesctl', 'get'], function(out) {
            let cur = out.trim();
            applet._toggleMgr.setToggleState('performance', cur === 'performance');
        });
    }
};
module.exports = ThemeSwitcher;
