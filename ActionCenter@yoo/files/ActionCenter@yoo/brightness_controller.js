const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Slider = imports.ui.slider;
const Pango = imports.gi.Pango;
const C = require('./constants');
const { UUID, _, MENU_CONTENT_WIDTH } = C;

// CSD 背光接口（同官方 power applet）：免 root、走系统背光驱动，笔记本内屏首选
const CSD_SCREEN_BUS = 'org.cinnamon.SettingsDaemon.Power.Screen';
const CSD_SCREEN_PATH = '/org/cinnamon/SettingsDaemon/Power';
const CSD_SCREEN_IFACE = 'org.cinnamon.SettingsDaemon.Power.Screen';
// 写后回验容差（百分点）：Set 回值/重读与目标差超此值视为未生效，换后端
const VERIFY_TOLERANCE = 6;

function BrightnessController(applet) {
    this._applet = applet;
    this._csdChecked = false;
    this._csdProxyObj = null;
}

// 亮度三后端：内屏走 CSD D-Bus（首选）→ brightnessctl（兜底），外屏走 ddcutil。
// 写操作 250ms 防抖合并；内屏写后回读校验，未生效自动换后端（最多 fallback 一次）。
BrightnessController.prototype = {
// CSD Screen 代理（懒初始化 + 能力探针）：GetPercentage 能读即本机有背光。
// 结果缓存，会话内只探一次；无背光的机器（如台式机）这里返回 null。
_csdProxy: function() {
    if (this._csdChecked) return this._csdProxyObj;
    this._csdChecked = true;
    try {
        let conn = Gio.bus_get_sync(Gio.BusType.SESSION, null);
        let proxy = Gio.DBusProxy.new_sync(conn,
            Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES | Gio.DBusProxyFlags.DO_NOT_CONNECT_SIGNALS,
            null, CSD_SCREEN_BUS, CSD_SCREEN_PATH, CSD_SCREEN_IFACE, null);
        let res = proxy.call_sync('GetPercentage', null,
            Gio.DBusCallFlags.NONE, 2000, null);
        if (res) {
            this._csdProxyObj = proxy;
            global.log("QS brightness: CSD Screen backend available");
        }
    } catch (e) {
        global.log("QS brightness: CSD Screen unavailable: " + e.message);
    }
    return this._csdProxyObj;
},

// CSD 读（0..1），失败返回 null
_csdGet: function() {
    try {
        let proxy = this._csdProxy();
        if (!proxy) return null;
        let res = proxy.call_sync('GetPercentage', null,
            Gio.DBusCallFlags.NONE, 2000, null);
        if (!res) return null;
        let v = res.deep_unpack()[0];
        if (typeof v !== 'number') return null;
        return Math.max(0, Math.min(1, v / 100));
    } catch (e) {
        return null;
    }
},

// CSD 写（1..100），返回系统实际接受的值，失败返回 null
_csdSet: function(pct) {
    try {
        let proxy = this._csdProxy();
        if (!proxy) return null;
        let res = proxy.call_sync('SetPercentage',
            new GLib.Variant('(u)', [pct]),
            Gio.DBusCallFlags.NONE, 2000, null);
        if (!res) return null;
        return res.deep_unpack()[0];
    } catch (e) {
        global.logError("QS brightness CSD set: " + e.message);
        return null;
    }
},

// 内屏当前该用哪个后端：CSD 优先，失败粘滞降级到 brightnessctl
_backendOf: function(display) {
    if (display.type !== 'internal') return 'ddcutil';
    if (display._csdFailed) return 'brightnessctl';
    return this._csdProxy() ? 'csd' : 'brightnessctl';
},
// 探测并返回可用显示器列表。若三种后端都不可用，返回空数组，
// 调用方据此隐藏亮度滑块。
detectAllDisplays: function() {
    let displays = [];

    let hasCsd = false;
    let hasBrightnessctl = false;
    let hasDdcutil = false;

    try {
        let r = GLib.spawn_command_line_sync("sh -c 'ls /sys/class/backlight/ 2>/dev/null'");
        if (r[1] && r[1].toString().trim().length > 0) {
            hasCsd = !!this._csdProxy();
            let t = GLib.spawn_command_line_sync('brightnessctl max');
            if (t[3] === 0 && parseInt(t[1].toString().trim()) > 0) {
                hasBrightnessctl = true;
            }
            if (hasCsd || hasBrightnessctl) {
                displays.push({
                    id: 'internal', type: 'internal',
                    name: _("Built-in Display"),
                    connector: null, num: null,
                    backend: hasCsd ? 'csd' : 'brightnessctl',
                    _csdFailed: false
                });
            }
        }
    } catch (e) { global.logError("QS detect internal display: " + e.message); }

        try {
            let r = GLib.spawn_command_line_sync('ddcutil detect --brief');
            if (r[3] === 0 && r[1]) {
                hasDdcutil = true;
                let lines = r[1].toString().split('\n');
                let current = null;
                for (let li = 0; li < lines.length; li++) {
                    let line = lines[li];
                    let dm = line.match(/^Display\s+(\d+)/);
                    if (dm) {
                        if (current) displays.push(current);
                        current = {
                            id: 'ddc-' + dm[1], type: 'ddcutil',
                            num: parseInt(dm[1]),
                            name: 'Display ' + dm[1], connector: null
                        };
                    } else if (current) {
                        let cm = line.match(/DRM connector:\s+(\S+)/);
                        if (cm) current.connector = cm[1].replace(/^card\d+-/, '');
                        let mm = line.match(/Monitor:\s+(.+)/);
                        if (mm) {
                            let parts = mm[1].split(':');
                            if (parts.length >= 2 && parts[1].trim()) {
                                current.name = parts[1].trim();
                            }
                        }
                    }
                }
                if (current) displays.push(current);
            }
        } catch (e) {
            global.logError("QS _detectAllDisplays ddcutil: " + e.message);
        }

    if (!hasCsd && !hasBrightnessctl && !hasDdcutil) {
        global.log("QS brightness: no backend available (CSD/brightnessctl/ddcutil), hiding slider");
    }

    return displays;
},

    getPrimaryConnector: function() {
        try {
            let r = GLib.spawn_command_line_sync(
                "sh -c \"xrandr --query | grep ' primary'\"");
            if (r[1]) {
                let m = r[1].toString().match(/^(\S+)\s+connected\s+primary/);
                if (m) return m[1];
            }
        } catch (e) { global.logError("QS getPrimaryConnector: " + e.message); }
        return null;
    },

    findPrimaryDisplay: function(displays) {
        let primaryConn = this.getPrimaryConnector();
        if (primaryConn) {
            for (let i = 0; i < displays.length; i++) {
                let d = displays[i];
                if (d.type === 'ddcutil' && d.connector === primaryConn) return d;
            }
            if (primaryConn.match(/^(eDP|LVDS|DSI)/)) {
                for (let i = 0; i < displays.length; i++) {
                    if (displays[i].type === 'internal') return displays[i];
                }
            }
        }
        for (let i = 0; i < displays.length; i++) {
            if (displays[i].type === 'internal') return displays[i];
        }
        return displays[0];
    },

    buildDisplayRow: function(display) {
        let applet = this._applet;
        // 内联滑块行（同选择器模式）：固定 320px
        let box = new St.BoxLayout({
            vertical: false, x_expand: true,
            style: 'spacing: 8px; padding: 8px 12px; width: 312px; max-width: 312px;'
        });

        box.add_child(new St.Icon({
            icon_name: display.type === 'internal'
                ? 'computer-symbolic' : 'video-display-symbolic',
            icon_size: 14, style: 'color: #ffffff;',
            y_align: Clutter.ActorAlign.CENTER
        }));

        let nameLabel = new St.Label({
            text: display.name,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'color: #ffffff;'
        });
        nameLabel.set_width(100);
        try {
            if (nameLabel.clutter_text) {
                nameLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            }
        } catch (e) {}
        box.add_child(nameLabel);

        let slider = new Slider.Slider(applet._brightnessCache[display.id] || 0.5);
        slider.actor.x_expand = true;
        slider.actor.style = 'min-width: 100px;';
        box.add_child(slider.actor);
        slider.connect('value-changed', function(s, v) {
            applet._brightnessCtrl.onDisplayBrightnessChanged(display, v);
            if (display === applet._primaryDisplay && applet._primarySlider) {
                applet._updatingBrightness = true;
                try { applet._primarySlider.setValue(v); } catch (e) {}
                applet._updatingBrightness = false;
            }
        });
        display.slider = slider;

        applet._brightnessBox.add_child(box);
    },

    toggleBrightnessMenu: function() {
        let applet = this._applet;
        if (!applet._brightnessSection) return;

        applet._startIgnoreClose();

        applet._brightnessVisible = !applet._brightnessVisible;
        if (applet._brightnessVisible) {
            if (applet._powerMenuVisible && applet._powerSection) {
                applet._powerMenuVisible = false;
                applet._powerSection.actor.hide();
            }
            if (applet._mprisController) applet._mprisController._collapseChooser();
            applet._animateSubmenu(applet._brightnessSection.actor, true);
            Mainloop.timeout_add(200, function() {
                applet._brightnessCtrl.refreshAllBrightnessAsync();
                return false;
            });
        } else {
            applet._animateSubmenu(applet._brightnessSection.actor, false);
        }
    },

    readBrightness: function(display) {
        if (display.type === 'internal') {
            // CSD 优先：读失败就地降级，下次直接走 brightnessctl
            if (this._backendOf(display) === 'csd') {
                let v = this._csdGet();
                if (v !== null) return v;
                display._csdFailed = true;
                global.log("QS brightness: CSD read failed, fallback to brightnessctl");
            }
            try {
                let r1 = GLib.spawn_command_line_sync('brightnessctl get');
                let r2 = GLib.spawn_command_line_sync('brightnessctl max');
                if (r1[1] && r2[1]) {
                    let cur = parseInt(r1[1].toString().trim());
                    let max = parseInt(r2[1].toString().trim());
                    if (max > 0) return cur / max;
                }
            } catch (e) { global.logError("QS readBrightness internal: " + e.message); }
        } else if (display.type === 'ddcutil') {
            try {
                let r = GLib.spawn_command_line_sync(
                    'ddcutil --display ' + display.num +
                    ' --sleep-multiplier .1 getvcp 10');
                if (r[1]) {
                    let m = r[1].toString().match(
                        /current value\s*=\s*(\d+).*?max value\s*=\s*(\d+)/);
                    if (m) {
                        let cur = parseInt(m[1]), max = parseInt(m[2]);
                        if (max > 0) return cur / max;
                    }
                }
            } catch (e) { global.logError("QS readBrightness ddcutil: " + e.message); }
        }
        // 读取失败返回 null（调用方跳过，不拿 0.5 假值污染 UI）
        return null;
    },

    onDisplayBrightnessChanged: function(display, v) {
        let applet = this._applet;
        if (applet._updatingBrightness) return;
        if (!display) return;
        let self = this;

        applet._brightnessCache[display.id] = v;

        if (applet._brightnessDebounce[display.id]) {
            GLib.source_remove(applet._brightnessDebounce[display.id]);
        }
        applet._brightnessDebounce[display.id] = GLib.timeout_add(
            // 250ms 防抖：ddcutil 一次写回要几百毫秒，拖动时合并为最终值写一次
            GLib.PRIORITY_DEFAULT, 250, function() {
                applet._brightnessDebounce[display.id] = 0;
                let pct = Math.round(v * 100);
                if (pct < 1) pct = 1;
                if (pct > 100) pct = 100;

                if (display.type === 'internal' && self._backendOf(display) === 'csd') {
                    // CSD 写：回值即系统接受值，先比一次
                    let ret = self._csdSet(pct);
                    if (ret !== null && Math.abs(ret - pct) <= VERIFY_TOLERANCE) return GLib.SOURCE_REMOVE;
                    if (ret === null || !display._csdFailed) {
                        // 回值不符或写入失败：350ms 后重读确认，避免背光渐变中的误判
                        Mainloop.timeout_add(350, function() {
                            if (display._csdFailed) return false;
                            let cur = self._csdGet();
                            let ok = cur !== null && Math.abs(cur * 100 - pct) <= VERIFY_TOLERANCE;
                            if (!ok) {
                                display._csdFailed = true;
                                display.backend = 'brightnessctl';
                                global.log("QS brightness: CSD set unverified (want " + pct +
                                    "%, got " + (cur === null ? "n/a" : Math.round(cur * 100) + "%") +
                                    "), fallback to brightnessctl");
                                GLib.spawn_command_line_async('brightnessctl set ' + pct + '%');
                            }
                            return false;
                        });
                        if (ret !== null) return GLib.SOURCE_REMOVE;
                    }
                    // CSD 彻底不可用（异常）：直接 brightnessctl
                    display._csdFailed = true;
                    display.backend = 'brightnessctl';
                    GLib.spawn_command_line_async('brightnessctl set ' + pct + '%');
                } else if (display.type === 'internal') {
                    GLib.spawn_command_line_async('brightnessctl set ' + pct + '%');
                } else {
                    GLib.spawn_command_line_async(
                        'ddcutil --display ' + display.num +
                        ' --sleep-multiplier .1 setvcp 10 ' + pct);
                }
                return GLib.SOURCE_REMOVE;
            });
    },

    refreshAllBrightnessAsync: function() {
        let applet = this._applet;
        let idx = 0;
        let displays = applet._displays;
        let self = this;
        let step = function() {
            if (idx >= displays.length) return false;
            let d = displays[idx++];
            try {
                let v = self.readBrightness(d);
                // 读失败就跳过本项（不写缓存不碰 UI），继续后面的显示器
                if (v !== null && v !== undefined) {
                    applet._brightnessCache[d.id] = v;
                    self.applyBrightnessToUI(d, v);
                }
            } catch (e) { global.logError("QS refreshBrightness: " + e.message); }
            if (idx < displays.length) {
                Mainloop.timeout_add(80, step);
            }
            return false;
        };
        step();
    },

    applyBrightnessToUI: function(d, v) {
        let applet = this._applet;
        if (d.slider) {
            applet._updatingBrightness = true;
            try { d.slider.setValue(v); } catch (e) {}
            applet._updatingBrightness = false;
        }
        if (d === applet._primaryDisplay && applet._primarySlider) {
            applet._updatingBrightness = true;
            try { applet._primarySlider.setValue(v); } catch (e) {}
            applet._updatingBrightness = false;
        }
    }
};
module.exports = BrightnessController;
