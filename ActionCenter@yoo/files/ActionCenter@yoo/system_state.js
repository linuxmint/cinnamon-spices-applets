const Mainloop = imports.mainloop;
const C = require('./constants');
const { UUID, _, POLL_INTERVAL_SEC } = C;

// 系统状态轮询：电池 / 网络 / 蓝牙，查到结果后推给开关 UI
function SystemState(applet) {
    this._applet = applet;
    this._pollTimeoutId = 0;
}

SystemState.prototype = {
    initPolling: function() {
        let self = this;
        Mainloop.timeout_add_seconds(1, function() {
            self.pollUpdate();
            self._pollTimeoutId = Mainloop.timeout_add_seconds(POLL_INTERVAL_SEC, function() {
                self.pollUpdate();
                return true;
            });
            return false;
        });
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

    batteryIconFor: function(percent, info) {
        let isCharging = /state:\s+charging\b/.test(info) ||
                         /state:\s+fully-charged\b/.test(info);
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
                    if (parts[2] === 'connected') { s.hasWired = true; s.wiredIface = parts[0]; }
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
