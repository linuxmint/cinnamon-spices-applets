const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Cvc = imports.gi.Cvc;
const ByteArray = imports.byteArray;
const C = require('./constants');
const { UUID, _, WIFI_CACHE_FILE } = C;

// 右键菜单：声音 + 网络（静态骨架 init 时建，动态项每次打开时刷新）
function ContextMenu(applet) {
    this._applet = applet;
    this._muteOutItem = null;
    this._muteInItem = null;
    this._wifiSection = null;
}

ContextMenu.prototype = {
    build: function() {
        let applet = this._applet;
        let menu = applet._applet_context_menu;
        let self = this;

        // ---------- 声音 ----------
        this._muteOutItem = new PopupMenu.PopupSwitchIconMenuItem(
            _("Mute output"), false, "audio-volume-muted-symbolic", St.IconType.SYMBOLIC);
        this._muteOutItem.connect('toggled', function(item, state) {
            self._setOutputMuted(state);
        });
        menu.addMenuItem(this._muteOutItem);

        this._muteInItem = new PopupMenu.PopupSwitchIconMenuItem(
            _("Mute input"), false, "audio-input-microphone-symbolic", St.IconType.SYMBOLIC);
        this._muteInItem.connect('toggled', function(item, state) {
            self._setInputMuted(state);
        });
        menu.addMenuItem(this._muteInItem);

        // 输出设备选择（低频功能，收进右键；单设备时自动隐藏）
        this._sinkSubmenu = new PopupMenu.PopupSubMenuMenuItem(_("Output Device"));
        menu.addMenuItem(this._sinkSubmenu);
        this._sinkCount = 0;

        let soundSettings = new PopupMenu.PopupMenuItem(_("Sound Settings"));
        soundSettings.connect('activate', function() {
            applet._spawnDetached(['cinnamon-settings', 'sound']);
        });
        menu.addMenuItem(soundSettings);
        this._soundSettingsItem = soundSettings;

        this._sepSoundNet = new PopupMenu.PopupSeparatorMenuItem();
        menu.addMenuItem(this._sepSoundNet);

        // ---------- 网络：顺序参照 network 官方主菜单 ----------
        // Wired → Wireless → WiFi 列表 → Mobile broadband → 设置项
        this._wiredSwitch = new PopupMenu.PopupSwitchMenuItem(_("Wired"), false);
        this._wiredSwitch.connect('toggled', function(item, state) {
            self._setWired(state);
        });
        menu.addMenuItem(this._wiredSwitch);

        this._wirelessSwitch = new PopupMenu.PopupSwitchMenuItem(_("Wireless"), false);
        this._wirelessSwitch.connect('toggled', function(item, state) {
            self._setWireless(state);
        });
        menu.addMenuItem(this._wirelessSwitch);

        // WiFi 列表区（每次打开重建）
        this._wifiSection = new PopupMenu.PopupMenuSection();
        menu.addMenuItem(this._wifiSection);

        this._wwanSwitch = new PopupMenu.PopupSwitchMenuItem(_("Mobile broadband"), false);
        this._wwanSwitch.connect('toggled', function(item, state) {
            self._setWwan(state);
        });
        menu.addMenuItem(this._wwanSwitch);

        this._sepNetSettings = new PopupMenu.PopupSeparatorMenuItem();
        menu.addMenuItem(this._sepNetSettings);

        let netSettings = new PopupMenu.PopupMenuItem(_("Network Settings"));
        netSettings.connect('activate', function() {
            applet._spawnDetached(['cinnamon-settings', 'network']);
        });
        menu.addMenuItem(netSettings);
        this._netSettingsItem = netSettings;

        let netConnections = new PopupMenu.PopupMenuItem(_("Network Connections"));
        netConnections.connect('activate', function() {
            applet._spawnDetached(['nm-connection-editor']);
        });
        menu.addMenuItem(netConnections);
        this._netConnectionsItem = netConnections;

        // 每次打开右键菜单时刷新动态项
        this._openStateId = menu.connect('open-state-changed', function(m, open) {
            if (open) self.refresh();
        });

        // 面板启动时预取一份 WiFi 快照存文件，右键打开先显示缓存
        this.prefetchWifiCache();
    },

    destroy: function() {
        let menu = this._applet ? this._applet._applet_context_menu : null;
        if (this._openStateId && menu) {
            try { menu.disconnect(this._openStateId); } catch(e) {}
            this._openStateId = 0;
        }
    },

    // 启动时只写缓存，不碰 UI；同时后台真扫一次
    prefetchWifiCache: function() {
        let self = this;
        this._applet._runCmd(['nmcli', 'device', 'wifi', 'rescan'], function() {
            self._fetchWifiLive(function(rows) {
                self._saveWifiCache(rows);
            });
        });
    },

    refresh: function() {
        let applet = this._applet;
        let self = this;
        this.applyVisibility();
        this._refreshSound();
        this._refreshNetSwitches(); // 先用缓存画，不空等
        this._rebuildWifi();
        this._rebuildSinkList();
        // 后台触发一次真扫（不等结果），下次打开/重试时数据更新
        applet._runCmd(['nmcli', 'device', 'wifi', 'rescan'], function() {});
        // 系统设置里可能刚改过：现查一次，回来若菜单还开着就重绘开关
        if (applet._sysState) {
            applet._sysState.queryNetworkAsync(function() {
                applet._sysState.applyNetworkButtonUI();
                let m = applet._applet_context_menu;
                if (m && m.isOpen) self._refreshNetSwitches();
            });
        }
    },

    _getShow: function(key, def) {
        try {
            let s = this._applet._settings;
            if (!s) return def;
            return s.getValue(key);
        } catch(e) {
            return def;
        }
    },

    // 按工具设置控制右键菜单各项显隐（设置变更时由 applet 主动调用）
    applyVisibility: function() {
        if (!this._sinkSubmenu) return;
        let showSound = this._getShow('show-context-sound', true);
        let showMute = showSound && this._getShow('show-context-mute', true);
        let showNet = this._getShow('show-context-network', true);
        let showWired = showNet && this._getShow('show-context-wired', true);
        let showWireless = showNet && this._getShow('show-context-wireless', true);
        let showWwan = showNet && this._getShow('show-context-wwan', false);

        this._muteOutItem.actor.visible = showMute;
        this._muteInItem.actor.visible = showMute;
        this._sinkSubmenu.actor.visible = showSound && this._sinkVisible(this._sinkCount);
        this._soundSettingsItem.actor.visible = showSound;

        this._wiredSwitch.actor.visible = showWired;
        this._wirelessSwitch.actor.visible = showWireless;
        this._wifiSection.actor.visible = showWireless;
        this._wwanSwitch.actor.visible = showWwan;
        this._netSettingsItem.actor.visible = showNet;
        this._netConnectionsItem.actor.visible = showNet;

        let anyNetChild = showWired || showWireless || showWwan;
        this._sepSoundNet.actor.visible = showSound && (showNet && anyNetChild);
        this._sepNetSettings.actor.visible = showNet && anyNetChild;
    },

    // ==================== 声音 ====================
    _getInput: function() {
        try {
            let applet = this._applet;
            if (!applet._control) return null;
            if (applet._control.get_state() !== Cvc.MixerControlState.READY) return null;
            return applet._control.get_default_source();
        } catch(e) {
            return null;
        }
    },

    _refreshSound: function() {
        let applet = this._applet;
        // 输出
        if (applet._output) {
            this._muteOutItem.setToggleState(applet._output.is_muted);
            this._muteOutItem.actor.reactive = true;
        } else {
            this._muteOutItem.setToggleState(false);
            this._muteOutItem.actor.reactive = false;
        }
        // 输入（无麦克风时禁用）
        let input = this._getInput();
        if (input) {
            this._muteInItem.setToggleState(input.is_muted);
            this._muteInItem.actor.reactive = true;
            this._muteInItem.actor.show();
        } else {
            this._muteInItem.setToggleState(false);
            this._muteInItem.actor.reactive = false;
        }
    },

    _setOutputMuted: function(muted) {
        let applet = this._applet;
        if (!applet._output) return;
        try {
            applet._output.change_is_muted(muted);
        } catch(e) {}
    },

    _setInputMuted: function(muted) {
        let input = this._getInput();
        if (!input) return;
        try {
            input.change_is_muted(muted);
        } catch(e) {}
    },

    // 输出设备子菜单可见性：多设备必显；单设备看用户设置
    _sinkVisible: function(count) {
        if (count > 1) return true;
        if (count === 1) return this._getShow('show-context-sink-single', false);
        return false;
    },

    // 输出设备子菜单：单设备默认藏起整项（可设置强制显示）
    _rebuildSinkList: function() {
        let applet = this._applet;
        let self = this;
        this._sinkSubmenu.menu.removeAll();
        let rows = (applet._volumeCtrl && this._getShow('show-context-sound', true))
            ? applet._volumeCtrl.getSinkList() : [];
        this._sinkCount = rows.length;
        this._sinkSubmenu.actor.visible =
            this._getShow('show-context-sound', true) && this._sinkVisible(rows.length);
        if (rows.length === 0) return;
        for (let i = 0; i < rows.length; i++) {
            (function(r) {
                let label = r.desc + (r.muted ? "  ·  " + _("Muted") : "");
                if (r.active) {
                    // 当前默认：✓ 标识，不可点，白色字区别于置灰项
                    let it = new PopupMenu.PopupMenuItem("✓  " + label, { reactive: false });
                    it.label.set_style('color: #ffffff;');
                    self._sinkSubmenu.menu.addMenuItem(it);
                } else {
                    let it = new PopupMenu.PopupMenuItem("     " + label);
                    it.connect('activate', function() {
                        applet._volumeCtrl.setDefaultSink(r.sink);
                    });
                    self._sinkSubmenu.menu.addMenuItem(it);
                }
            })(rows[i]);
        }
    },

    // ==================== 网络开关（顺序同官方） ====================
    _refreshNetSwitches: function() {
        let applet = this._applet;
        let self = this;
        let net = applet._cachedNetwork;

        // 有线：无设备时禁用
        if (net.hasWiredDevice) {
            this._wiredSwitch.setToggleState(net.hasWired);
            this._wiredSwitch.actor.reactive = true;
        } else {
            this._wiredSwitch.setToggleState(false);
            this._wiredSwitch.actor.reactive = false;
        }

        // 无线：无设备时禁用
        if (net.wifiDevice) {
            this._wirelessSwitch.setToggleState(net.wifiEnabled);
            this._wirelessSwitch.actor.reactive = true;
        } else {
            this._wirelessSwitch.setToggleState(false);
            this._wirelessSwitch.actor.reactive = false;
        }

        // 移动宽带：现查 WWAN 射频状态；无设备时禁用
        applet._runCmd(['nmcli', '-t', '-f', 'WWAN', 'g'], function(out) {
            let enabled = out.trim() === 'enabled';
            if (net.wwanDevice) {
                self._wwanSwitch.setToggleState(enabled);
                self._wwanSwitch.actor.reactive = true;
            } else {
                self._wwanSwitch.setToggleState(false);
                self._wwanSwitch.actor.reactive = false;
            }
        });
    },

    _setWired: function(connected) {
        let applet = this._applet;
        let self = this;
        let iface = applet._cachedNetwork.wiredIface;
        if (!iface) return;
        if (connected) {
            applet._runCmd(['nmcli', 'device', 'connect', iface], function() {
                self._resyncMainNetwork();
            });
        } else {
            applet._runCmd(['nmcli', 'device', 'disconnect', iface], function() {
                self._resyncMainNetwork();
            });
        }
    },

    _setWireless: function(enabled) {
        let applet = this._applet;
        let self = this;
        // 乐观占位：关→立刻显示 Wi-Fi 已关闭；开→显示扫描中。不等 2 秒后的重同步。
        this._showWifiPlaceholder(enabled ? _("Scanning…") : _("Wi-Fi is off"));
        applet._runCmd(['nmcli', 'radio', 'wifi', enabled ? 'on' : 'off'], function() {
            self._resyncMainNetwork();
        });
    },

    // WiFi 列表占位行
    _showWifiPlaceholder: function(label) {
        this._wifiSection.removeAll();
        this._wifiSection.addMenuItem(new PopupMenu.PopupMenuItem(label, { reactive: false }));
    },

    _setWwan: function(enabled) {
        let applet = this._applet;
        let self = this;
        applet._runCmd(['nmcli', 'radio', 'wwan', enabled ? 'on' : 'off'], function() {
            Mainloop.timeout_add(1000, function() {
                self._refreshNetSwitches();
                return false;
            });
        });
    },

    // 同步主菜单的网络开关显示 + 重建 WiFi 列表（菜单保持展开）
    _resyncMainNetwork: function() {
        let applet = this._applet;
        let self = this;
        Mainloop.timeout_add(2000, function() {
            if (applet._sysState) {
                applet._sysState.queryNetworkAsync(function() {
                    applet._sysState.applyNetworkButtonUI();
                    self._refreshNetSwitches();
                    self._rebuildWifi();
                });
            }
            return false;
        });
    },
    // 先渲染缓存快照，活数据到了再原地重绘（只动 section 内容，菜单不收起）
    _rebuildWifi: function() {
        let self = this;
        let net = this._applet._cachedNetwork;
        // 有硬件但射频关着：直接占位，不跑扫描
        if (net && net.wifiDevice && !net.wifiEnabled) {
            this._showWifiPlaceholder(_("Wi-Fi is off"));
            return;
        }
        let cached = this._loadWifiCache();
        if (cached.rows.length > 0) {
            this._renderWifiRows(cached.rows);
        } else {
            this._wifiSection.removeAll();
            this._wifiSection.addMenuItem(
                new PopupMenu.PopupMenuItem(_("Scanning…"), { reactive: false }));
        }
        this._wifiRetries = 0;
        this._fetchAndRenderWifi();
    },

    // 拉活数据并渲染；空结果 + 菜单还开着 → 3 秒后重试（射频刚开扫描滞后），最多 4 次
    _fetchAndRenderWifi: function() {
        let self = this;
        this._fetchWifiLive(function(rows) {
            if (rows.length > 0) {
                self._wifiRetries = 0;
                self._saveWifiCache(rows);
                self._renderWifiRows(rows);
                return;
            }
            let menu = self._applet._applet_context_menu;
            if (self._wifiRetries < 4 && menu && menu.isOpen) {
                self._wifiRetries++;
                Mainloop.timeout_add(3000, function() {
                    let m2 = self._applet._applet_context_menu;
                    if (m2 && m2.isOpen) self._fetchAndRenderWifi();
                    return false;
                });
                return; // 保持 Scanning… 占位，不闪"未找到"
            }
            self._wifiRetries = 0;
            self._renderWifiRows(rows); // 重试完还是空才是真没网
        });
    },

    _loadWifiCache: function() {
        try {
            let file = Gio.File.new_for_path(WIFI_CACHE_FILE);
            if (!file.query_exists(null)) return { rows: [] };
            let [ok, content] = file.load_contents(null);
            if (!ok || !content) return { rows: [] };
            let data = JSON.parse(ByteArray.toString(content));
            return { rows: data.rows || [] };
        } catch(e) {
            return { rows: [] };
        }
    },

    _saveWifiCache: function(rows) {
        // 空结果不覆盖好缓存（射频刚开时扫描为空是正常的）
        if (!rows || rows.length === 0) return;
        try {
            let file = Gio.File.new_for_path(WIFI_CACHE_FILE);
            file.replace_contents(JSON.stringify({ rows: rows }),
                null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch(e) {}
    },

    // 活数据：当前扫描列表 + 独立查激活 WiFi 的 SSID（扫描的 * 标记不可靠）
    // 读上次扫描缓存（--rescan no）：快且稳，重扫中的空表不会污染显示
    _fetchWifiLive: function(callback) {
        let applet = this._applet;
        let self = this;
        applet._runCmd(['nmcli', '-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list', '--rescan', 'no'], function(out) {
            let rows = self._parseWifiList(out);
            // 独立查激活连接，避免扫描快照里的在用标记滞后/缺失
            applet._runCmd(['nmcli', '-t', '-f', 'NAME,TYPE', 'connection', 'show', '--active'], function(activeOut) {
                let profile = '';
                let alines = activeOut.split('\n');
                for (let i = 0; i < alines.length; i++) {
                    let line = alines[i];
                    if (!line.trim()) continue;
                    let tmp = line.replace(/\\:/g, '\x00');
                    let parts = tmp.split(':');
                    if (parts.length < 2) continue;
                    let type = parts[parts.length - 1].replace(/\x00/g, ':');
                    if (type.indexOf('802-11-wireless') === 0) {
                        profile = parts.slice(0, parts.length - 1).join(':').replace(/\x00/g, ':').trim();
                        break;
                    }
                }
                if (!profile) { callback(rows); return; }
                applet._runCmd(['nmcli', '-t', '-f', '802-11-wireless.ssid', 'connection', 'show', profile], function(ssidOut) {
                    let m = ssidOut.match(/^802-11-wireless\.ssid:(.*)$/m);
                    let activeSsid = m ? m[1].trim() : '';
                    if (activeSsid) {
                        // 以激活连接为准，覆盖扫描标记
                        for (let i = 0; i < rows.length; i++) {
                            rows[i].inUse = (rows[i].ssid === activeSsid);
                        }
                    }
                    callback(rows);
                });
            });
        });
    },

    _renderWifiRows: function(rows) {
        let self = this;
        let sectionActor = this._wifiSection.actor;
        this._wifiSection.removeAll();
        if (rows.length === 0) {
            this._wifiSection.addMenuItem(
                new PopupMenu.PopupMenuItem(_("No Wi-Fi networks found"), { reactive: false }));
        } else {
            // 已连接的置顶
            rows.sort(function(a, b) {
                if (a.inUse && !b.inUse) return -1;
                if (b.inUse && !a.inUse) return 1;
                return b.signal - a.signal;
            });
            // 最多显示 8 个
            let shown = rows.slice(0, 8);
            for (let i = 0; i < shown.length; i++) {
                (function(r) {
                    let label = r.ssid + (r.signal >= 0 ? "  ·  " + r.signal + "%" : "");
                    if (r.inUse) {
                        // 已连接：✓ + Connected 标识，不可点；文字保持白色（区别于置灰的禁用项）
                        let it = new PopupMenu.PopupMenuItem("✓  " + label + "  ·  " + _("Connected"), { reactive: false });
                        it.label.set_style('color: #ffffff;');
                        self._wifiSection.addMenuItem(it);
                    } else {
                        let it = new PopupMenu.PopupMenuItem("     " + label);
                        it.connect('activate', function() {
                            self._connectWifi(r);
                        });
                        self._wifiSection.addMenuItem(it);
                    }
                })(shown[i]);
            }
        }
        // 淡入 + 下滑（只碰 opacity/translation；height tween 会卡死，已弃用）。
        // 变化小/开关关掉则跳过。失败兜底保证不隐身。
        if (!this._applet._smoothOn || !this._applet._smoothOn()) return;
        try {
            sectionActor.remove_all_transitions();
            sectionActor.opacity = 0;
            sectionActor.translation_y = 6;
            sectionActor.ease({
                opacity: 255, translation_y: 0,
                duration: 250, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: function() {
                    sectionActor.opacity = 255;
                    sectionActor.translation_y = 0;
                }
            });
        } catch(e) {
            try { sectionActor.opacity = 255; sectionActor.translation_y = 0; } catch(e2) {}
        }
    },

    // 解析 nmcli terse 输出；SSID 中的冒号被转义为 \:，从右往左切分
    _parseWifiList: function(out) {
        let rows = [];
        let seen = {};
        let lines = out.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (!line.trim()) continue;
            // 临时替换转义冒号，切完再恢复
            let tmp = line.replace(/\\:/g, '\x00');
            let parts = tmp.split(':');
            if (parts.length < 4) continue;
            // terse 下 IN-USE 为 '*'（老版本为 'yes'），空表示未连接
            let inUse = (parts[0] === '*' || parts[0] === 'yes');
            let security = parts[parts.length - 1].replace(/\x00/g, ':').trim();
            let signal = parseInt(parts[parts.length - 2]);
            let ssid = parts.slice(1, parts.length - 2).join(':').replace(/\x00/g, ':');
            if (!ssid || seen[ssid]) continue;
            seen[ssid] = true;
            rows.push({
                ssid: ssid,
                inUse: inUse,
                signal: isNaN(signal) ? -1 : signal,
                security: security
            });
        }
        return rows;
    },

    // 统一直连：有保存配置 NM 会自动用；成功输出含 successfully activated，
    // 失败（如无保存的加密网络且无密码代理）才跳网络设置。
    // nmcli 输出跟随系统语言，必须 LC_ALL=C 锁定英文再匹配
    //（成功信息走 stdout，_runCmd 只回传 stdout，失败时自然无匹配）
    _connectWifi: function(row) {
        let applet = this._applet;
        applet._runCmd(['env', 'LC_ALL=C', 'nmcli', 'device', 'wifi', 'connect', row.ssid], function(out) {
            if (out.indexOf('successfully activated') === -1) {
                applet._spawnDetached(['cinnamon-settings', 'network']);
            }
        });
    }
};
module.exports = ContextMenu;
