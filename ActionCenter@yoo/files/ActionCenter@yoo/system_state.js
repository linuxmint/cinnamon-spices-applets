const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const C = require('./constants');
const { UUID, _, POLL_INTERVAL_SEC } = C;

// UPower 事件源（同官方 power applet 思路）：
// DisplayDevice 代替原来每 12 秒一次的 upower -d 文本解析。
const UPOWER_BUS = 'org.freedesktop.UPower';
const UPOWER_PATH = '/org/freedesktop/UPower';
const UPOWER_IFACE = 'org.freedesktop.UPower';
const UPOWER_DEVICE_IFACE = 'org.freedesktop.UPower.Device';
const UPOWER_DISPLAY_PATH = '/org/freedesktop/UPower/devices/DisplayDevice';
const PROPS_IFACE = 'org.freedesktop.DBus.Properties';
// UPower DeviceState：1 Charging / 4 Fully charged（其余见 upower 枚举）
const UP_STATE_CHARGING = 1;
const UP_STATE_FULLY_CHARGED = 4;

// 系统状态轮询：电池 / 网络 / 蓝牙，查到结果后推给开关 UI
function SystemState(applet) {
    this._applet = applet;
    this._pollTimeoutId = 0;
}

SystemState.prototype = {
    initPolling: function() {
        let self = this;
        // 电池走事件驱动（即时），12 秒大循环只当兜底（网络/蓝牙/主题仍需它）
        try { this._initUpowerEvents(); } catch (e) {
            global.logError("QS upower events init: " + e.message);
        }
        // 蓝牙/网络走系统信号即时刷新，轮询只当兜底；查询函数自带在途保护，信号风暴会自动合并
        try { this._initBluezEvents(); } catch (e) {
            global.logError("QS bluez events init: " + e.message);
        }
        try { this._initNetworkEvents(); } catch (e) {
            global.logError("QS NM events init: " + e.message);
        }
        Mainloop.timeout_add_seconds(1, function() {
            self.pollUpdate();
            self._pollTimeoutId = Mainloop.timeout_add_seconds(POLL_INTERVAL_SEC, function() {
                self.pollUpdate();
                return true;
            });
            return false;
        });
    },

    // 订阅 UPower 信号：设备增减/变化 + DisplayDevice 属性变化 → 即时刷电池。
    // daemon 重启（name owner 变化）时重订 + 重查，防止订阅静默失效。
    _initUpowerEvents: function() {
        if (this._upowerSubs && this._upowerSubs.length > 0) return;
        this._upowerSubs = [];
        let self = this;
        let refresh = function() {
            try { self.updateBatteryAsync(); } catch (e) {
                global.logError("QS battery refresh: " + e.message);
            }
        };
        try {
            let sys = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
            this._upowerSubs.push(sys.signal_subscribe(UPOWER_BUS, UPOWER_IFACE, null,
                UPOWER_PATH, null, Gio.DBusSignalFlags.NONE, refresh));
            this._upowerSubs.push(sys.signal_subscribe(UPOWER_BUS, UPOWER_DEVICE_IFACE, 'Changed',
                UPOWER_DISPLAY_PATH, null, Gio.DBusSignalFlags.NONE, refresh));
            this._upowerSubs.push(sys.signal_subscribe(UPOWER_BUS, PROPS_IFACE, 'PropertiesChanged',
                UPOWER_DISPLAY_PATH, null, Gio.DBusSignalFlags.NONE, refresh));
        } catch (e) {
            global.logError("QS upower events: " + e.message);
        }
        try {
            this._upowerWatchId = Gio.bus_watch_name(Gio.BusType.SYSTEM, UPOWER_BUS,
                Gio.BusNameWatcherFlags.NONE,
                function() { // appeared（初建也会触发一次，已订阅则直接返回）
                    if (self._upowerSubs && self._upowerSubs.length > 0) return;
                    self._initUpowerEvents();
                    refresh();
                },
                function() { self._dropUpowerSubs(); }); // vanished
        } catch (e) {
            global.logError("QS upower watch: " + e.message);
        }
    },

    _dropUpowerSubs: function() {
        try {
            if (this._upowerSubs && this._upowerSubs.length > 0) {
                let sys = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
                for (let i = 0; i < this._upowerSubs.length; i++) {
                    try { sys.signal_unsubscribe(this._upowerSubs[i]); } catch (e) {}
                }
            }
        } catch (e) {}
        this._upowerSubs = [];
    },

    destroy: function() {
        this._dropUpowerSubs();
        if (this._upowerWatchId) {
            try { Gio.bus_unwatch_name(this._upowerWatchId); } catch (e) {}
            this._upowerWatchId = 0;
        }
        this._dropBluezSubs();
        this._dropNetworkEvents();
        if (this._pollTimeoutId) {
            try { Mainloop.source_remove(this._pollTimeoutId); } catch (e) {}
            this._pollTimeoutId = 0;
        }
    },

    // 蓝牙走 BlueZ 信号：Adapter 开关/设备连断即时刷新（官方 power applet 同思路）。
    // 路径命名空间覆盖适配器和设备；query 自带在途保护，风暴自动合并。
    _initBluezEvents: function() {
        if (this._bluezSubs && this._bluezSubs.length > 0) return;
        this._bluezSubs = [];
        let self = this;
        try {
            let sys = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
            this._bluezSubs.push(sys.signal_subscribe('org.bluez',
                'org.freedesktop.DBus.Properties', 'PropertiesChanged',
                '/org/bluez', null, Gio.DBusSignalFlags.NONE,
                function() {
                    try {
                        self.queryBluetoothAsync(function() { self.applyBluetoothButtonUI(); });
                    } catch (e) {}
                }));
        } catch (e) {
            global.logError("QS bluez events: " + e.message);
        }
    },

    _dropBluezSubs: function() {
        try {
            if (this._bluezSubs && this._bluezSubs.length > 0) {
                let sys = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
                for (let i = 0; i < this._bluezSubs.length; i++) {
                    try { sys.signal_unsubscribe(this._bluezSubs[i]); } catch (e) {}
                }
            }
        } catch (e) {}
        this._bluezSubs = [];
    },

    // 网络走 NM.Client 信号（官方 network applet 同款）：射频开关/设备增减/
    // 连接增减/设备状态变化即时重查。查询函数复用现有 nmcli 解析，不动逻辑。
    _initNetworkEvents: function() {
        if (this._nmClient) return;
        let NM = imports.gi.NM;
        let client = NM.Client.new(null);
        if (!client) return;
        this._nmClient = client;
        this._nmIds = [];
        this._nmDevHooked = [];
        let self = this;
        let refresh = function() {
            try {
                self.queryNetworkAsync(function() { self.applyNetworkButtonUI(); });
            } catch (e) {}
        };
        let hookDevices = function() {
            try {
                let devs = client.get_devices() || [];
                for (let i = 0; i < devs.length; i++) {
                    let d = devs[i];
                    if (d._qsHooked) continue;
                    d._qsHooked = true;
                    self._nmDevHooked.push(d);
                    self._nmIds.push([d, d.connect('state-changed', refresh)]);
                }
            } catch (e) {}
        };
        hookDevices();
        let on = function(sig, fn) {
            try { self._nmIds.push([client, client.connect(sig, fn)]); } catch (e) {}
        };
        on('notify::wireless-enabled', refresh);
        on('notify::wwan-enabled', refresh);
        on('device-added', function(c, d) {
            try { d._qsHooked = true; self._nmDevHooked.push(d); self._nmIds.push([d, d.connect('state-changed', refresh)]); } catch (e) {}
            refresh();
        });
        on('device-removed', refresh);
        on('active-connection-added', refresh);
        on('active-connection-removed', refresh);
    },

    _dropNetworkEvents: function() {
        if (this._nmIds) {
            for (let i = 0; i < this._nmIds.length; i++) {
                try { this._nmIds[i][0].disconnect(this._nmIds[i][1]); } catch (e) {}
            }
            this._nmIds = [];
        }
        if (this._nmDevHooked) {
            for (let i = 0; i < this._nmDevHooked.length; i++) {
                // 设备信号 id 已在 _nmIds 里随 client 一起断开，这里只清标记
                try { this._nmDevHooked[i]._qsHooked = false; } catch (e) {}
            }
            this._nmDevHooked = [];
        }
        this._nmClient = null;
    },

    pollUpdate: function() {
        let applet = this._applet;
        this.updateBatteryAsync();
        this.queryNetworkAsync(function() { applet._sysState.applyNetworkButtonUI(); });
        this.queryBluetoothAsync(function() { applet._sysState.applyBluetoothButtonUI(); });
        if (applet._themeSwitcher) {
            applet._themeSwitcher.updateDarkModeState();
            applet._themeSwitcher.updateNightLightState();
            applet._themeSwitcher.updateAirplaneStateAsync();
            applet._themeSwitcher.updatePerformanceStateAsync();
        }
        if (applet._mprisController) applet._mprisController._poll();
    },

    updateBatteryAsync: function() {
        // 首选 D-Bus 结构化读（无子进程），失败回退 upower 文本解析
        try {
            if (this._updateBatteryFromDbus()) return;
        } catch (e) {
            global.logError("QS battery dbus: " + e.message);
        }
        let applet = this._applet;
        let self = this;
        // 一次 dump 全量解析（原来 -e 枚举 + -i 详情两次调用）。
        // 真电池：Device 路径带 battery_ 且是供电设备（键鼠外设电池不是 power supply）。
        applet._runCmd(['upower', '-d'], function(out) {
            let blk = null;
            let blocks = out.split(/^Device: /m);
            for (let i = 0; i < blocks.length; i++) {
                let b = blocks[i];
                let nl = b.indexOf('\n');
                let header = nl === -1 ? b : b.substring(0, nl);
                if (header.indexOf('/battery_') !== -1 && /power supply:\s+yes/.test(b)) {
                    blk = b;
                    break;
                }
            }
            if (!blk) {
                self.setBatteryText(_("No Battery"), 'battery-missing-symbolic');
                return;
            }
            if (/(^|\n)\s*present:\s+no\b/.test(blk)) {
                self.setBatteryText(_("No Battery"), 'battery-missing-symbolic');
                return;
            }
            let m = blk.match(/percentage:\s+(\d+)%/);
            if (!m) {
                self.setBatteryText(_("No Battery"), 'battery-missing-symbolic');
                return;
            }
            let percent = parseInt(m[1]);
            self.setBatteryText(percent + "%", self.batteryIconFor(percent, blk));
        });
    },

    // D-Bus 读电池：先枚举确认有真电池（路径含 /battery_，沿用文本版语义，
    // 外设电池/UPS 不计入），再读 DisplayDevice 聚合值。返回 true = 已处理。
    _updateBatteryFromDbus: function() {
        let conn = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
        let daemon = Gio.DBusProxy.new_sync(conn,
            Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES | Gio.DBusProxyFlags.DO_NOT_CONNECT_SIGNALS,
            null, UPOWER_BUS, UPOWER_PATH, UPOWER_IFACE, null);
        let devRes = daemon.call_sync('EnumerateDevices', null,
            Gio.DBusCallFlags.NONE, 2000, null);
        if (!devRes) return false;
        let paths = devRes.deep_unpack()[0] || [];
        let hasBattery = false;
        for (let i = 0; i < paths.length; i++) {
            if (paths[i].indexOf('/battery_') !== -1) { hasBattery = true; break; }
        }
        if (!hasBattery) {
            this.setBatteryText(_("No Battery"), 'battery-missing-symbolic');
            return true;
        }
        let propsProxy = Gio.DBusProxy.new_sync(conn,
            Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES | Gio.DBusProxyFlags.DO_NOT_CONNECT_SIGNALS,
            null, UPOWER_BUS, UPOWER_DISPLAY_PATH, PROPS_IFACE, null);
        let res = propsProxy.call_sync('GetAll',
            new GLib.Variant('(s)', [UPOWER_DEVICE_IFACE]),
            Gio.DBusCallFlags.NONE, 2000, null);
        if (!res) return false;
        let props = res.deep_unpack()[0];
        if (!props) return false;
        if (props['IsPresent'] === false) {
            this.setBatteryText(_("No Battery"), 'battery-missing-symbolic');
            return true;
        }
        let percent = Math.round(props['Percentage']);
        if (isNaN(percent)) return false;
        let state = props['State'];
        let isCharging = (state === UP_STATE_CHARGING || state === UP_STATE_FULLY_CHARGED);
        this.setBatteryText(percent + "%", this._batteryIconForState(percent, isCharging));
        return true;
    },

    batteryIconFor: function(percent, info) {
        let isCharging = /state:\s+charging\b/.test(info) ||
                         /state:\s+fully-charged\b/.test(info);
        return this._batteryIconForState(percent, isCharging);
    },

    _batteryIconForState: function(percent, isCharging) {
        if (isCharging) {
            return percent >= 90 ? 'battery-full-charging-symbolic'
                 : percent >= 60 ? 'battery-good-charging-symbolic'
                 : percent >= 30 ? 'battery-low-charging-symbolic'
                 : 'battery-caution-charging-symbolic';
        }
        if (percent <= 5)  return 'battery-empty-symbolic';
        if (percent <= 15) return 'battery-caution-symbolic';
        if (percent <= 40) return 'battery-low-symbolic';
        if (percent <= 75) return 'battery-good-symbolic';
        return 'battery-full-symbolic';
    },

    setBatteryText: function(text, iconName) {
        let applet = this._applet;
        if (applet._batteryLabel) applet._batteryLabel.set_text(text);
        if (applet._batteryIcon && iconName) {
            applet._batteryIcon.set_icon_name(iconName);
        }
    },

    queryNetworkAsync: function(callback) {
        let applet = this._applet;
        // 在途保护：nmcli 偶发卡住时丢掉并发查询（_runCmd 10 秒超时兜底后标志位会释放）
        if (applet._networkQueryInFlight) return;
        applet._networkQueryInFlight = true;
        applet._runCmd(['nmcli', '-t', '-f', 'DEVICE,TYPE,STATE', 'device'], function(out1) {
            let s = { hasWired: false, hasWifi: false, wifiEnabled: false,
                      hasWiredDevice: false, wifiDevice: false, wwanDevice: false, wiredIface: '' };
            let lines = out1.split('\n');
            for (let i = 0; i < lines.length; i++) {
                let parts = lines[i].split(':');
                if (parts.length < 3) continue;
                if (parts[1] === 'ethernet') {
                    s.hasWiredDevice = true;
                    // 接口名见牌就记（不管连没连上），否则断开后名字丢失就再也打不开了；
                    // 已连接的优先，没有已连接时留第一个
                    if (parts[2] === 'connected') { s.hasWired = true; s.wiredIface = parts[0]; }
                    else if (!s.wiredIface) s.wiredIface = parts[0];
                } else if (parts[1] === 'wifi') {
                    s.wifiDevice = true;
                    if (parts[2] === 'connected') s.hasWifi = true;
                } else if (parts[1] === 'wwan') {
                    s.wwanDevice = true;
                }
            }
            applet._runCmd(['nmcli', '-t', '-f', 'WIFI', 'g'], function(out2) {
                s.wifiEnabled = out2.trim() === 'enabled';
                if (!s.hasWifi || !s.wifiEnabled) {
                    s.signal = null;
                    applet._cachedNetwork = s;
                    applet._networkQueryInFlight = false;
                    if (callback) callback(s);
                    return;
                }
                // 已连 WiFi：读取当前连接的信号强度（0-100）
                applet._runCmd(['nmcli', '-t', '-f', 'IN-USE,SIGNAL', 'device', 'wifi'], function(out3) {
                    s.signal = null;
                    let wlines = out3.split('\n');
                    for (let i = 0; i < wlines.length; i++) {
                        let wp = wlines[i].split(':');
                        // terse 下在用行首列为 '*'（老版本为 'yes'）
                        if ((wp[0] === '*' || wp[0] === 'yes') && wp.length >= 2) {
                            let sig = parseInt(wp[1]);
                            if (!isNaN(sig)) s.signal = Math.max(0, Math.min(100, sig));
                            break;
                        }
                    }
                    applet._cachedNetwork = s;
                    applet._networkQueryInFlight = false;
                    if (callback) callback(s);
                });
            });
        });
    },

    applyNetworkButtonUI: function() {
        let applet = this._applet;
        let btn = applet._toggleButtons ? applet._toggleButtons['network'] : null;
        if (!btn) return;
        let s = applet._cachedNetwork;

        let iconName, nameText, statusText, active;
        if (s.hasWired) {
            iconName = 'network-wired-symbolic';
            nameText = _("Wired");
            statusText = _("Connected");
            active = true;
        } else if (s.hasWifi) {
            nameText = _("Wi-Fi");
            active = true;
            if (s.signal !== null && s.signal !== undefined) {
                // 按信号强度换图标 + 显示百分比
                iconName = s.signal >= 75 ? 'network-wireless-signal-excellent-symbolic'
                         : s.signal >= 50 ? 'network-wireless-signal-good-symbolic'
                         : s.signal >= 25 ? 'network-wireless-signal-ok-symbolic'
                         : 'network-wireless-signal-weak-symbolic';
                statusText = s.signal === 0 ? _("No signal") : _("Connected") + " · " + s.signal + "%";
            } else {
                iconName = 'network-wireless-symbolic';
                statusText = _("Connected");
            }
        } else if (s.wifiEnabled) {
            iconName = 'network-wireless-symbolic';
            nameText = _("Wi-Fi");
            statusText = _("Not connected");
            active = false;
        } else {
            iconName = 'network-offline-symbolic';
            nameText = _("Network");
            statusText = _("Off");
            active = false;
        }

        if (btn._icon) btn._icon.set_icon_name(iconName);
        if (btn._nameLabel) btn._nameLabel.set_text(nameText);
        if (btn._statusLabel) {
            btn._statusLabel.set_text(statusText);
            btn._statusLabel.visible = (statusText !== '');
        }
        applet._toggleMgr.setToggleState('network', active);
    },

    queryBluetoothAsync: function(callback) {
        let applet = this._applet;
        if (applet._bluetoothQueryInFlight) return;
        applet._bluetoothQueryInFlight = true;
        applet._runCmd(['bluetoothctl', 'show'], function(out1) {
            // 无适配器时输出 "No default controller available"，无 Controller MAC 行
            let hasAdapter = /Controller\s+[0-9A-Fa-f:]{17}/.test(out1);
            let s = { powered: out1.indexOf('Powered: yes') !== -1, connected: false, hasAdapter: hasAdapter };
            if (!s.powered) {
                applet._cachedBluetooth = s;
                applet._bluetoothQueryInFlight = false;
                if (callback) callback(s);
                return;
            }
            applet._runCmd(['bluetoothctl', 'devices', 'Connected'], function(out2) {
                let trimmed = out2.trim();
                s.connected = trimmed.length > 0 && trimmed.indexOf('Device') === 0;
                applet._cachedBluetooth = s;
                applet._bluetoothQueryInFlight = false;
                if (callback) callback(s);
            });
        });
    },

    applyBluetoothButtonUI: function() {
        let applet = this._applet;
        let btn = applet._toggleButtons ? applet._toggleButtons['bluetooth'] : null;
        if (!btn) return;
        let s = applet._cachedBluetooth;

        if (s.hasAdapter === false) {
            // 无蓝牙硬件：禁用开关并提示
            if (btn._icon) btn._icon.set_icon_name('bluetooth-symbolic');
            if (btn._nameLabel) btn._nameLabel.set_text(_("Bluetooth"));
            applet._toggleMgr.setToggleState('bluetooth', false);
            applet._toggleMgr.setRowEnabled('bluetooth', false, _("No adapter"));
            return;
        }
        applet._toggleMgr.setRowEnabled('bluetooth', true, "");

        let iconName = 'bluetooth-symbolic';
        let nameText = _("Bluetooth");
        let statusText, active;
        if (!s.powered) {
            statusText = _("Off");
            active = false;
        } else if (s.connected) {
            statusText = _("Connected");
            active = true;
        } else {
            statusText = _("Not connected");
            active = true;
        }

        if (btn._icon) btn._icon.set_icon_name(iconName);
        if (btn._nameLabel) btn._nameLabel.set_text(nameText);
        if (btn._statusLabel) {
            btn._statusLabel.set_text(statusText);
            btn._statusLabel.visible = (statusText !== '');
        }
        applet._toggleMgr.setToggleState('bluetooth', active);
    }
};
module.exports = SystemState;
