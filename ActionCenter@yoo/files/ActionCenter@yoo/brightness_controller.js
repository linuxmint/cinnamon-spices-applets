const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Slider = imports.ui.slider;
const Pango = imports.gi.Pango;
const C = require('./constants');
const { UUID, _, MENU_CONTENT_WIDTH } = C;

function BrightnessController(applet) {
    this._applet = applet;
}

    // 亮度：内屏走 brightnessctl，外屏走 ddcutil（慢，写操作 250ms 防抖合并）。
    BrightnessController.prototype = {
    // 探测并返回可用显示器列表。若 brightnessctl 和 ddcutil
    // 两种依赖都不可用（没有内屏也没有外屏能力），返回空数组，
    // 调用方据此隐藏亮度滑块。
    detectAllDisplays: function() {
        let displays = [];

        let hasBrightnessctl = false;
        let hasDdcutil = false;

        try {
            let r = GLib.spawn_command_line_sync("sh -c 'ls /sys/class/backlight/ 2>/dev/null'");
            if (r[1] && r[1].toString().trim().length > 0) {
                let t = GLib.spawn_command_line_sync('brightnessctl max');
                if (t[3] === 0 && parseInt(t[1].toString().trim()) > 0) {
                    hasBrightnessctl = true;
                    displays.push({
                        id: 'internal', type: 'internal',
                        name: _("Built-in Display"),
                        connector: null, num: null
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

        if (!hasBrightnessctl && !hasDdcutil) {
            global.log("QS brightness: neither brightnessctl nor ddcutil available, hiding slider");
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

                if (display.type === 'internal') {
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
