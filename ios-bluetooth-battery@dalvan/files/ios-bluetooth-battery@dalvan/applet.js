const Applet = imports.ui.applet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Cairo = imports.cairo;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;

let UPowerGlib = null;
try {
    UPowerGlib = imports.gi.UPowerGlib;
} catch (e) {
    UPowerGlib = null;
}

class IOSBluetoothBatteryApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.orientation = orientation;
        this.panel_height = panel_height || 28;
        this.instance_id = instance_id;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        // Default settings fallback
        this.panelDisplayMode = "rings_bt";
        this.hideWhenEmpty = false;
        this.updateInterval = 5;
        this.showDisconnectedPaired = true;
        this.showWirelessHid = true;
        this.showLaptopBattery = false;
        this.popoverLayout = "both";
        this.themeMode = "dark";
        this.accentStyle = "ios";
        this.enableLowBatteryNotify = true;
        this.lowBatteryThreshold = 20;

        // Runtime state
        this._timerId = 0;
        this._dbusSignalIds = [];
        this._queryInProgress = false;
        this._wpctlInProgress = false;
        this._notifiedLowMacs = new Set();

        this._bluezDevices = [];
        this._sysfsBatteries = [];
        this._audioSinks = {};
        this._mergedDevices = [];

        this._upowerClient = null;
        if (UPowerGlib) {
            try {
                this._upowerClient = UPowerGlib.Client.new();
            } catch (e) {
                this._upowerClient = null;
            }
        }

        this._hasWpctl = GLib.find_program_in_path("wpctl") !== null;
        this._hasPactl = GLib.find_program_in_path("pactl") !== null;

        // Custom Cairo Canvas for Panel Bar (Option 5: Multi-Rings with small Bluetooth symbol in center)
        this._panelCanvas = new St.DrawingArea({ reactive: false });
        this._panelCanvas.connect("repaint", (area) => this._onRepaintPanel(area));
        this.actor.add_actor(this._panelCanvas);

        this._initSettings();
        this._initMenu();
        this._subscribeDbusSignals();
        this._refreshAll();
        this._startLoop();
    }

    on_panel_height_changed() {
        this.panel_height = this._panelHeight || 28;
        this._updatePanelIndicator();
    }

    _initSettings() {
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, this.instance_id);
        const bind = (key, prop) => {
            this.settings.bind(key, prop, () => this._onSettingsChanged());
        };

        bind("panel-display-mode", "panelDisplayMode");
        bind("hide-when-empty", "hideWhenEmpty");
        bind("update-interval", "updateInterval");
        bind("show-disconnected-paired", "showDisconnectedPaired");
        bind("show-wireless-hid", "showWirelessHid");
        bind("show-laptop-battery", "showLaptopBattery");
        bind("popover-layout", "popoverLayout");
        bind("theme-mode", "themeMode");
        bind("accent-style", "accentStyle");
        bind("enable-low-battery-notify", "enableLowBatteryNotify");
        bind("low-battery-threshold", "lowBatteryThreshold");
    }

    _initMenu() {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        // Top iOS Rings Card inside PopupMenu
        this._ringsSection = new PopupMenu.PopupBaseMenuItem({ reactive: false, activate: false });
        this._ringsCanvas = new St.DrawingArea({ reactive: false });
        this._ringsCanvas.connect("repaint", (area) => this._onRepaintRings(area));
        this._ringsSection.addActor(this._ringsCanvas, { expand: true, span: -1 });
        this.menu.addMenuItem(this._ringsSection);

        this._listSeparator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._listSeparator);

        // Interactive Device List Container
        this._deviceListSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._deviceListSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Bottom Quick Actions
        let btSettingsItem = new PopupMenu.PopupIconMenuItem(
            "Configurações de Bluetooth",
            "preferences-system-bluetooth-symbolic",
            St.IconType.SYMBOLIC
        );
        btSettingsItem.connect("activate", () => {
            if (GLib.find_program_in_path("blueberry")) {
                Util.spawn(["blueberry"]);
            } else if (GLib.find_program_in_path("blueman-manager")) {
                Util.spawn(["blueman-manager"]);
            } else {
                Util.spawn(["cinnamon-settings", "bluetooth"]);
            }
        });
        this.menu.addMenuItem(btSettingsItem);

        let refreshItem = new PopupMenu.PopupIconMenuItem(
            "Sincronizar Dispositivos Agora",
            "view-refresh-symbolic",
            St.IconType.SYMBOLIC
        );
        refreshItem.connect("activate", () => this._refreshAll());
        this.menu.addMenuItem(refreshItem);
    }

    _subscribeDbusSignals() {
        try {
            let sysBus = Gio.DBus.system;
            // React immediately to BlueZ connection / battery changes
            let id1 = sysBus.signal_subscribe(
                "org.bluez",
                "org.freedesktop.DBus.Properties",
                "PropertiesChanged",
                null,
                null,
                Gio.DBusSignalFlags.NONE,
                () => this._refreshAll()
            );
            let id2 = sysBus.signal_subscribe(
                "org.bluez",
                "org.freedesktop.DBus.ObjectManager",
                "InterfacesAdded",
                null,
                null,
                Gio.DBusSignalFlags.NONE,
                () => this._refreshAll()
            );
            let id3 = sysBus.signal_subscribe(
                "org.bluez",
                "org.freedesktop.DBus.ObjectManager",
                "InterfacesRemoved",
                null,
                null,
                Gio.DBusSignalFlags.NONE,
                () => this._refreshAll()
            );
            // React immediately to UPower battery updates
            let id4 = sysBus.signal_subscribe(
                "org.freedesktop.UPower",
                "org.freedesktop.DBus.Properties",
                "PropertiesChanged",
                null,
                null,
                Gio.DBusSignalFlags.NONE,
                () => this._refreshAll()
            );
            this._dbusSignalIds.push(id1, id2, id3, id4);
        } catch (e) {}
    }

    _onSettingsChanged() {
        this._rebuildMergedDevices();
        this._startLoop();
    }

    _startLoop() {
        if (this._timerId !== 0) {
            Mainloop.source_remove(this._timerId);
            this._timerId = 0;
        }
        let intervalSec = Math.max(2, Math.round(this.updateInterval || 5));
        this._timerId = Mainloop.timeout_add_seconds(intervalSec, () => {
            this._refreshAll();
            return GLib.SOURCE_CONTINUE;
        });
    }

    on_applet_clicked() {
        this._refreshAll();
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this._timerId !== 0) {
            Mainloop.source_remove(this._timerId);
            this._timerId = 0;
        }
        try {
            let sysBus = Gio.DBus.system;
            for (let id of this._dbusSignalIds) {
                sysBus.signal_unsubscribe(id);
            }
        } catch (e) {}
        this._dbusSignalIds = [];
    }

    // =========================================================================
    // MULTI-BACKEND HIGH-COMPATIBILITY DISCOVERY (100% ASYNC)
    // =========================================================================

    _readFileAsync(path, callback) {
        let file = Gio.File.new_for_path(path);
        file.load_contents_async(null, (f, res) => {
            try {
                let [ok, bytes] = f.load_contents_finish(res);
                if (ok && bytes) {
                    callback(imports.byteArray.toString(bytes).trim());
                    return;
                }
            } catch (e) {}
            callback(null);
        });
    }

    _listDirAsync(path, callback) {
        let dir = Gio.File.new_for_path(path);
        dir.enumerate_children_async(
            "standard::name",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (d, res) => {
                let names = [];
                try {
                    let enumerator = d.enumerate_children_finish(res);
                    let collectNext = () => {
                        enumerator.next_files_async(64, GLib.PRIORITY_DEFAULT, null, (en, nextRes) => {
                            try {
                                let files = en.next_files_finish(nextRes);
                                if (files && files.length > 0) {
                                    for (let info of files) {
                                        names.push(info.get_name());
                                    }
                                    collectNext();
                                    return;
                                }
                            } catch (e) {}
                            try {
                                en.close_async(GLib.PRIORITY_DEFAULT, null, null);
                            } catch (e) {}
                            callback(names);
                        });
                    };
                    collectNext();
                } catch (e) {
                    callback([]);
                }
            }
        );
    }

    _refreshAll() {
        this._queryBluezAsync();
        this._querySysfsPowerSupplyAsync();
        this._queryAudioBatteryAsync();
        this._rebuildMergedDevices();
    }

    // Backend 1: BlueZ D-Bus ObjectManager (org.bluez.Device1 + org.bluez.Battery1)
    _queryBluezAsync() {
        if (this._queryInProgress) return;
        this._queryInProgress = true;

        try {
            Gio.DBus.system.call(
                "org.bluez",
                "/",
                "org.freedesktop.DBus.ObjectManager",
                "GetManagedObjects",
                null,
                new GLib.VariantType("(a{oa{sa{sv}}})"),
                Gio.DBusCallFlags.NONE,
                1500,
                null,
                (bus, res) => {
                    this._queryInProgress = false;
                    try {
                        let reply = bus.call_finish(res);
                        let [objects] = reply.deep_unpack();
                        let list = [];

                        for (let path in objects) {
                            let ifaces = objects[path];
                            let dev = ifaces["org.bluez.Device1"];
                            if (!dev) continue;

                            let address = dev.Address ? dev.Address.deep_unpack().toUpperCase() : "";
                            let connected = dev.Connected ? dev.Connected.deep_unpack() : false;
                            let paired = dev.Paired ? dev.Paired.deep_unpack() : false;
                            let alias = dev.Alias ? dev.Alias.deep_unpack() : (dev.Name ? dev.Name.deep_unpack() : "Bluetooth");
                            let iconName = dev.Icon ? dev.Icon.deep_unpack() : "";

                            let batIface = ifaces["org.bluez.Battery1"];
                            let pct = batIface && batIface.Percentage ? batIface.Percentage.deep_unpack() : null;

                            list.push({
                                id: path,
                                dbusPath: path,
                                mac: address,
                                name: alias,
                                shortName: this._shortenName(alias),
                                percentage: pct !== null ? Math.max(0, Math.min(100, pct)) : null,
                                hasBatteryLevel: pct !== null,
                                charging: false,
                                connected: connected,
                                paired: paired,
                                source: "BlueZ",
                                type: this._classifyDevice(iconName, alias, 0)
                            });
                        }

                        this._bluezDevices = list;
                        this._rebuildMergedDevices();
                    } catch (e) {}
                }
            );
        } catch (e) {
            this._queryInProgress = false;
        }
    }

    // Backend 3: Kernel /sys/class/power_supply/* (HID++, PlayStation/Xbox, Apple Magic, BLE HID)
    _querySysfsPowerSupplyAsync() {
        this._listDirAsync("/sys/class/power_supply", (entries) => {
            if (!entries || entries.length === 0) return;

            let results = [];
            let pending = entries.length;
            const onEntryDone = () => {
                pending--;
                if (pending <= 0) {
                    this._sysfsBatteries = results;
                    this._rebuildMergedDevices();
                }
            };

            for (let name of entries) {
                let lower = name.toLowerCase();
                // Skip AC adapters
                if (lower.startsWith("ac") || lower.includes("line") || lower.includes("ucsi")) {
                    onEntryDone();
                    continue;
                }
                let isLaptopBat = lower.startsWith("bat");
                if (isLaptopBat && !this.showLaptopBattery) {
                    onEntryDone();
                    continue;
                }

                let base = "/sys/class/power_supply/" + name;
                this._readFileAsync(base + "/capacity", (capRaw) => {
                    if (capRaw === null) {
                        onEntryDone();
                        return;
                    }
                    let pct = parseInt(capRaw, 10);
                    if (isNaN(pct)) {
                        onEntryDone();
                        return;
                    }
                    this._readFileAsync(base + "/model_name", (modelRaw) => {
                        this._readFileAsync(base + "/status", (statusRaw) => {
                            let status = (statusRaw || "").toLowerCase();
                            let charging = status.includes("charging") || status.includes("full");
                            let macMatch = name.match(/([0-9A-Fa-f]{2}[:_-]){5}[0-9A-Fa-f]{2}/);
                            let mac = macMatch ? macMatch[0].replace(/[_-]/g, ":").toUpperCase() : "";
                            let label = modelRaw || (isLaptopBat ? "Notebook" : name);

                            results.push({
                                id: "sysfs:" + name,
                                mac: mac,
                                name: label,
                                shortName: this._shortenName(label),
                                percentage: Math.max(0, Math.min(100, pct)),
                                hasBatteryLevel: true,
                                charging: charging,
                                connected: true,
                                isLaptop: isLaptopBat,
                                source: isLaptopBat ? "Sistema" : "Kernel HID",
                                type: isLaptopBat ? "laptop" : this._classifyDevice("", label, 0)
                            });
                            onEntryDone();
                        });
                    });
                });
            }
        });
    }

    // Backend 4: PipeWire / PulseAudio Bluetooth HFP/HSP battery properties via pactl
    _queryAudioBatteryAsync() {
        if (!this._hasPactl || this._wpctlInProgress) return;
        this._wpctlInProgress = true;

        try {
            let proc = Gio.Subprocess.new(
                ["pactl", "list", "cards"],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );
            proc.communicate_utf8_async(null, null, (p, res) => {
                this._wpctlInProgress = false;
                try {
                    let [ok, stdout] = p.communicate_utf8_finish(res);
                    if (!ok || !stdout) return;

                    let map = {};
                    let blocks = stdout.split(/Card #\d+/);
                    for (let block of blocks) {
                        if (!block.includes("bluez")) continue;
                        let macM = block.match(/api\.bluez5\.address\s*=\s*"([^"]+)"/i) ||
                                   block.match(/device\.string\s*=\s*"([0-9A-Fa-f:]{17})"/i);
                        let batM = block.match(/bluetooth\.battery\s*=\s*"(\d+)%?"/i) ||
                                   block.match(/bluez\.battery\s*=\s*"(\d+)%?"/i);
                        if (macM && batM) {
                            map[macM[1].toUpperCase()] = parseInt(batM[1], 10);
                        }
                    }
                    this._audioSinks = map;
                    this._rebuildMergedDevices();
                } catch (e) {}
            });
        } catch (e) {
            this._wpctlInProgress = false;
        }
    }

    // Merge all 4 backends (UPowerGlib + BlueZ + Kernel sysfs HID + PipeWire/PulseAudio)
    _rebuildMergedDevices() {
        let merged = [];
        let byMac = {};
        let seenIds = new Set();

        // 1. UPowerGlib devices (Wireless mice/keyboards/headsets/gamepads/laptop)
        if (this._upowerClient) {
            try {
                let upDevs = this._upowerClient.get_devices();
                for (let d of upDevs) {
                    if (d.kind === 1) continue; // Skip AC power
                    let nativePath = d.native_path || "";
                    let isLaptop = (d.kind === 2 && nativePath.toUpperCase().startsWith("BAT"));
                    if (isLaptop && !this.showLaptopBattery) continue;
                    if (!isLaptop && !this.showWirelessHid && !nativePath.toLowerCase().includes("bluez") && !nativePath.includes(":")) {
                        continue;
                    }

                    let macM = nativePath.match(/([0-9A-Fa-f]{2}[:_-]){5}[0-9A-Fa-f]{2}/);
                    let mac = macM ? macM[0].replace(/[_-]/g, ":").toUpperCase() : "";
                    let pct = Math.round(d.percentage || 0);
                    let charging = (d.state === 1 || d.state === 4 || d.state === 5);
                    let devType = isLaptop ? "laptop" : this._classifyDevice("", d.model || "", d.kind);
                    let fullName = isLaptop ? "Notebook" : (d.model || "Dispositivo Sem Fio");

                    let item = {
                        id: d.get_object_path(),
                        dbusPath: null,
                        mac: mac,
                        name: fullName,
                        shortName: this._shortenName(fullName),
                        percentage: Math.max(0, Math.min(100, pct)),
                        hasBatteryLevel: true,
                        charging: charging,
                        connected: true,
                        paired: true,
                        source: isLaptop ? "UPower" : (mac ? "Bluetooth" : "Sem Fio 2.4GHz"),
                        type: devType
                    };

                    merged.push(item);
                    seenIds.add(item.id);
                    if (mac) byMac[mac] = item;
                }
            } catch (e) {}
        }

        // 2. Kernel sysfs power_supply fallback (for HID devices not yet in UPower)
        for (let sysItem of this._sysfsBatteries) {
            if (sysItem.isLaptop && merged.some(m => m.type === "laptop")) continue;
            if (sysItem.mac && byMac[sysItem.mac]) {
                if (!byMac[sysItem.mac].hasBatteryLevel && sysItem.hasBatteryLevel) {
                    byMac[sysItem.mac].percentage = sysItem.percentage;
                    byMac[sysItem.mac].hasBatteryLevel = true;
                }
                continue;
            }
            if (!this.showWirelessHid && !sysItem.isLaptop && !sysItem.mac) continue;
            merged.push(sysItem);
            if (sysItem.mac) byMac[sysItem.mac] = sysItem;
        }

        // 3. BlueZ D-Bus devices (merges connection controls + Battery1 + PipeWire audio battery)
        for (let bz of this._bluezDevices) {
            let audioBat = (bz.mac && this._audioSinks[bz.mac] !== undefined) ? this._audioSinks[bz.mac] : null;
            let bestPct = bz.hasBatteryLevel ? bz.percentage : audioBat;

            if (bz.mac && byMac[bz.mac]) {
                // Enrich existing UPower/sysfs entry with BlueZ D-Bus path & alias
                let target = byMac[bz.mac];
                target.dbusPath = bz.dbusPath;
                target.name = bz.name || target.name;
                target.shortName = this._shortenName(target.name);
                target.connected = bz.connected;
                target.paired = bz.paired;
                target.source = "Bluetooth";
                if (!target.hasBatteryLevel && bestPct !== null) {
                    target.percentage = bestPct;
                    target.hasBatteryLevel = true;
                }
                continue;
            }

            if (!bz.connected && (!this.showDisconnectedPaired || !bz.paired)) {
                continue;
            }

            let entry = {
                id: bz.id,
                dbusPath: bz.dbusPath,
                mac: bz.mac,
                name: bz.name,
                shortName: bz.shortName,
                percentage: bestPct !== null ? bestPct : (bz.connected ? 100 : 0),
                hasBatteryLevel: bestPct !== null,
                charging: false,
                connected: bz.connected,
                paired: bz.paired,
                source: "Bluetooth",
                type: bz.type
            };
            merged.push(entry);
            if (bz.mac) byMac[bz.mac] = entry;
        }

        // Sort: connected first, then by lowest battery
        merged.sort((a, b) => {
            if (a.connected !== b.connected) return a.connected ? -1 : 1;
            return (a.percentage || 0) - (b.percentage || 0);
        });

        this._mergedDevices = merged;
        this._checkLowBatteryNotifications();
        this._updatePanelIndicator();
        this._rebuildPopoverUI();
    }

    _checkLowBatteryNotifications() {
        if (!this.enableLowBatteryNotify) return;
        let threshold = this.lowBatteryThreshold || 20;

        for (let d of this._mergedDevices) {
            if (!d.connected || !d.hasBatteryLevel || d.charging) continue;
            let key = d.mac || d.id;
            if (d.percentage <= threshold && d.percentage > 0) {
                if (!this._notifiedLowMacs.has(key)) {
                    this._notifiedLowMacs.add(key);
                    Main.notify(
                        "Bateria Bluetooth Baixa (" + d.percentage + "%)",
                        d.name + " está com apenas " + d.percentage + "% de carga."
                    );
                }
            } else if (d.percentage > threshold + 5) {
                this._notifiedLowMacs.delete(key);
            }
        }
    }

    // =========================================================================
    // PANEL BAR INDICATOR & POPOVER UI
    // =========================================================================

    _updatePanelIndicator() {
        let connected = this._mergedDevices.filter(d => d.connected);

        if (connected.length === 0) {
            if (this.hideWhenEmpty) {
                this.actor.hide();
                return;
            }
            this.actor.show();
            this.set_applet_tooltip("Nenhum dispositivo Bluetooth conectado");
        } else {
            this.actor.show();
            let tooltipLines = connected.map(d => {
                let batTxt = d.hasBatteryLevel ? (d.percentage + "%") : "Conectado";
                return "• " + d.name + ": " + batTxt;
            });
            this.set_applet_tooltip("Baterias Bluetooth Conectadas:\n" + tooltipLines.join("\n"));
        }

        let h = Math.max(22, this._panelHeight || this.panel_height || 28);
        let ringCount = Math.max(1, Math.min(3, connected.length));
        let ringDiam = Math.min(22, Math.max(16, h - 6));
        let gap = 5;
        let padX = 4;
        let showPctText = (this.panelDisplayMode === "rings_pct" && connected.length > 0);
        let textExtraW = showPctText ? 34 : 0;

        let w = padX * 2 + ringCount * ringDiam + (ringCount - 1) * gap + textExtraW;
        if (this._panelCanvas) {
            this._panelCanvas.set_size(w, h);
            this._panelCanvas.queue_repaint();
        }
    }

    _onRepaintPanel(area) {
        let cr = area.get_context();
        let [w, h] = area.get_surface_size();

        cr.save();
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.restore();

        cr.setAntialias(Cairo.Antialias.BEST);

        let connected = this._mergedDevices.filter(d => d.connected).slice(0, 3);
        let ringDiam = Math.min(22, Math.max(16, h - 6));
        let radius = (ringDiam - 3.2) / 2;
        let strokeW = 2.6;
        let gap = 5;
        let padX = 4;
        let cy = h / 2;

        if (connected.length === 0) {
            // Subtle offline ring with muted Bluetooth rune in center
            let cx = w / 2;
            cr.newPath();
            cr.arc(cx, cy, radius, 0, 2 * Math.PI);
            cr.setSourceRGBA(1.0, 1.0, 1.0, 0.22);
            cr.setLineWidth(strokeW);
            cr.stroke();

            this._drawVectorIcon(cr, "bluetooth", cx, cy, radius * 1.15, [1.0, 1.0, 1.0, 0.50]);
            cr.$dispose();
            return;
        }

        for (let i = 0; i < connected.length; i++) {
            let dev = connected[i];
            let cx = padX + ringDiam / 2 + i * (ringDiam + gap);

            // Track circle
            cr.newPath();
            cr.arc(cx, cy, radius, 0, 2 * Math.PI);
            cr.setSourceRGBA(1.0, 1.0, 1.0, 0.18);
            cr.setLineWidth(strokeW);
            cr.stroke();

            // Active battery arc
            let pct = dev.hasBatteryLevel ? dev.percentage : 100;
            let progress = Math.max(0.05, Math.min(1.0, pct / 100.0));
            let color = this._getBatteryRingColor(dev);

            cr.newPath();
            cr.setLineCap(Cairo.LineCap.ROUND);
            cr.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
            cr.setSourceRGBA(color[0], color[1], color[2], 0.98);
            cr.setLineWidth(strokeW);
            cr.stroke();

            // Small Bluetooth icon in the center (or device icon if selected in settings)
            let centerIcon = (this.panelDisplayMode === "rings_device") ? dev.type : "bluetooth";
            this._drawVectorIcon(cr, centerIcon, cx, cy, radius * 1.15, [1.0, 1.0, 1.0, 0.95]);
        }

        if (this.panelDisplayMode === "rings_pct") {
            let primary = connected[0];
            let txt = primary.hasBatteryLevel ? (primary.percentage + "%") : "";
            if (txt) {
                let textX = padX + connected.length * ringDiam + (connected.length - 1) * gap + 5;
                this._drawText(cr, txt, textX, cy - 6, {
                    size: 8.8,
                    weight: Pango.Weight.BOLD,
                    color: [0.98, 0.98, 1.0, 0.95],
                    align: "left"
                });
            }
        }

        cr.$dispose();
    }

    _rebuildPopoverUI() {
        let showRings = (this.popoverLayout === "both" || this.popoverLayout === "rings");
        let showList = (this.popoverLayout === "both" || this.popoverLayout === "list");

        this._ringsSection.actor.visible = showRings;
        this._listSeparator.actor.visible = (showRings && showList);
        this._deviceListSection.actor.visible = showList;

        if (showRings) {
            let dims = this._calculateRingsDimensions();
            this._ringsCanvas.set_size(dims.width, dims.height);
            this._ringsCanvas.queue_repaint();
        }

        if (showList) {
            this._deviceListSection.removeAll();
            if (this._mergedDevices.length === 0) {
                let emptyItem = new PopupMenu.PopupMenuItem("Nenhum dispositivo Bluetooth encontrado", { reactive: false });
                this._deviceListSection.addMenuItem(emptyItem);
            } else {
                for (let dev of this._mergedDevices) {
                    let row = this._createDeviceListRow(dev);
                    this._deviceListSection.addMenuItem(row);
                }
            }
        }
    }

    _createDeviceListRow(dev) {
        let item = new PopupMenu.PopupBaseMenuItem({ reactive: !!dev.dbusPath });
        let rowBox = new St.BoxLayout({ style_class: "ios-bt-device-row", vertical: false });

        let icon = new St.Icon({
            icon_name: this._getSymbolicIconName(dev.type),
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 20,
            style: "margin-right: 10px;"
        });
        rowBox.add_actor(icon);

        let textBox = new St.BoxLayout({ vertical: true });
        let titleLabel = new St.Label({
            text: dev.name,
            style_class: "ios-bt-device-title"
        });
        let subText = dev.connected
            ? (dev.hasBatteryLevel ? (dev.source + " • Bateria em " + dev.percentage + "%") : (dev.source + " • Conectado"))
            : "Pareado • Clique para conectar";
        let subLabel = new St.Label({
            text: subText,
            style_class: "ios-bt-device-subtitle"
        });
        textBox.add_actor(titleLabel);
        textBox.add_actor(subLabel);
        rowBox.add(textBox, { expand: true });

        let badgeText = dev.connected
            ? (dev.hasBatteryLevel ? (dev.percentage + "%") : "Ativo")
            : "Conectar";
        let badge = new St.Label({
            text: badgeText,
            style_class: dev.connected ? "ios-bt-pill-connected" : "ios-bt-pill-disconnected",
            y_align: St.Align.MIDDLE
        });
        rowBox.add_actor(badge);

        item.addActor(rowBox, { expand: true, span: -1 });

        if (dev.dbusPath) {
            item.connect("activate", () => {
                this._toggleBluezConnection(dev);
            });
        }

        return item;
    }

    _toggleBluezConnection(dev) {
        if (!dev.dbusPath) return;
        let method = dev.connected ? "Disconnect" : "Connect";
        try {
            Gio.DBus.system.call(
                "org.bluez",
                dev.dbusPath,
                "org.bluez.Device1",
                method,
                null,
                null,
                Gio.DBusCallFlags.NONE,
                8000,
                null,
                (bus, res) => {
                    try {
                        bus.call_finish(res);
                    } catch (e) {}
                    this._refreshAll();
                }
            );
        } catch (e) {}
    }

    // =========================================================================
    // iOS / macOS CAIRO CIRCULAR RINGS RENDERING
    // =========================================================================

    _calculateRingsDimensions() {
        let items = this._mergedDevices.length > 0 ? this._mergedDevices : [{ dummy: true }];
        let cols = 4;
        let pad = 16;
        let cellW = 72;
        let cellH = 90;
        let colGap = 10;
        let rowGap = 10;
        let headerH = 26;

        let rows = Math.ceil(items.length / cols);
        let width = pad * 2 + cols * cellW + (cols - 1) * colGap;
        let height = pad * 2 + headerH + rows * cellH + (rows - 1) * rowGap;

        return { width, height, pad, cellW, cellH, colGap, rowGap, cols, headerH };
    }

    _isDarkMode() {
        if (this.themeMode === "dark") return true;
        if (this.themeMode === "light") return false;
        try {
            let s = new Gio.Settings({ schema_id: "org.cinnamon.theme" });
            let name = (s.get_string("name") || "").toLowerCase();
            return name.includes("dark") || name.includes("black") || name.includes("noir");
        } catch (e) {
            return true;
        }
    }

    _getPalette() {
        if (this._isDarkMode()) {
            return {
                bgTop: [0.12, 0.12, 0.15, 0.94],
                bgBottom: [0.08, 0.08, 0.10, 0.98],
                border: [1.0, 1.0, 1.0, 0.14],
                textPrimary: [0.98, 0.98, 1.0, 0.96],
                textSecondary: [0.90, 0.90, 0.95, 0.64],
                textMuted: [0.85, 0.85, 0.92, 0.42],
                trackBg: [1.0, 1.0, 1.0, 0.12]
            };
        } else {
            return {
                bgTop: [0.97, 0.97, 0.99, 0.95],
                bgBottom: [0.91, 0.92, 0.96, 0.98],
                border: [0.0, 0.0, 0.0, 0.10],
                textPrimary: [0.08, 0.08, 0.11, 0.94],
                textSecondary: [0.20, 0.20, 0.26, 0.65],
                textMuted: [0.25, 0.25, 0.32, 0.45],
                trackBg: [0.0, 0.0, 0.0, 0.10]
            };
        }
    }

    _getBatteryRingColor(dev) {
        if (!dev.connected) return [0.55, 0.55, 0.60];
        if (this.accentStyle === "blue") return [0.039, 0.518, 1.0]; // #0A84FF
        if (dev.charging) return [0.188, 0.820, 0.345];              // #30D158
        if (dev.hasBatteryLevel && dev.percentage <= 15) return [1.0, 0.271, 0.227]; // #FF453A
        if (dev.hasBatteryLevel && dev.percentage <= 25) return [1.0, 0.839, 0.039]; // #FFD60A
        return [0.188, 0.820, 0.345];                                // #30D158
    }

    _onRepaintRings(area) {
        let cr = area.get_context();
        let [w, h] = area.get_surface_size();
        let dims = this._calculateRingsDimensions();
        let palette = this._getPalette();

        cr.save();
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.restore();

        cr.setAntialias(Cairo.Antialias.BEST);

        // Rounded squircle iOS card
        this._drawRoundedRect(cr, 1.5, 1.5, w - 3, h - 3, 20);
        let grad = new Cairo.LinearGradient(0, 0, 0, h);
        grad.addColorStopRGBA(0, palette.bgTop[0], palette.bgTop[1], palette.bgTop[2], palette.bgTop[3]);
        grad.addColorStopRGBA(1, palette.bgBottom[0], palette.bgBottom[1], palette.bgBottom[2], palette.bgBottom[3]);
        cr.setSource(grad);
        cr.fillPreserve();

        cr.setSourceRGBA(palette.border[0], palette.border[1], palette.border[2], palette.border[3]);
        cr.setLineWidth(1.2);
        cr.stroke();

        // Card Header
        let cursorY = dims.pad;
        cr.newPath();
        cr.arc(dims.pad + 5, cursorY + 7, 3.8, 0, 2 * Math.PI);
        cr.setSourceRGBA(0.039, 0.518, 1.0, 0.95); // Bluetooth iOS Blue dot
        cr.fill();

        this._drawText(cr, "BATERIAS BLUETOOTH", dims.pad + 14, cursorY, {
            size: 8.8,
            weight: Pango.Weight.BOLD,
            color: palette.textSecondary,
            align: "left"
        });

        let activeCount = this._mergedDevices.filter(d => d.connected).length;
        this._drawText(cr, activeCount + (activeCount === 1 ? " CONECTADO" : " CONECTADOS"), w - dims.pad, cursorY, {
            size: 8.0,
            weight: Pango.Weight.BOLD,
            color: palette.textMuted,
            align: "right"
        });

        cursorY += dims.headerH;

        let items = this._mergedDevices.length > 0 ? this._mergedDevices : [{
            shortName: "Bluetooth",
            percentage: 0,
            hasBatteryLevel: false,
            connected: false,
            charging: false,
            type: "bluetooth"
        }];

        let ringRadius = 23;
        let strokeW = 5.6;

        for (let idx = 0; idx < items.length; idx++) {
            let dev = items[idx];
            let col = idx % dims.cols;
            let row = Math.floor(idx / dims.cols);

            let cellX = dims.pad + col * (dims.cellW + dims.colGap);
            let cellY = cursorY + row * (dims.cellH + dims.rowGap);

            let cx = cellX + dims.cellW / 2;
            let cy = cellY + ringRadius + 4;

            // Background track ring
            cr.newPath();
            cr.arc(cx, cy, ringRadius, 0, 2 * Math.PI);
            cr.setSourceRGBA(palette.trackBg[0], palette.trackBg[1], palette.trackBg[2], palette.trackBg[3]);
            cr.setLineWidth(strokeW);
            cr.stroke();

            // Active battery arc
            let progress = dev.connected ? ((dev.hasBatteryLevel ? dev.percentage : 100) / 100.0) : 0;
            let color = this._getBatteryRingColor(dev);
            if (progress > 0.005) {
                let startAngle = -Math.PI / 2;
                let endAngle = startAngle + progress * 2 * Math.PI;
                cr.newPath();
                cr.setLineCap(Cairo.LineCap.ROUND);
                cr.arc(cx, cy, ringRadius, startAngle, endAngle);
                cr.setSourceRGBA(color[0], color[1], color[2], 0.96);
                cr.setLineWidth(strokeW);
                cr.stroke();
            }

            // Center device vector icon
            this._drawVectorIcon(cr, dev.type, cx, cy, 16, dev.connected ? palette.textPrimary : palette.textMuted);

            // Charging lightning badge
            if (dev.charging) {
                let bx = cx;
                let by = cy - ringRadius;
                cr.newPath();
                cr.arc(bx, by, 6.2, 0, 2 * Math.PI);
                cr.setSourceRGBA(palette.bgBottom[0], palette.bgBottom[1], palette.bgBottom[2], 1.0);
                cr.fill();
                this._drawVectorIcon(cr, "bolt", bx, by, 8.5, [0.188, 0.820, 0.345, 1.0]);
            }

            // Device Name
            let labelY = cy + ringRadius + 6;
            this._drawText(cr, dev.shortName, cx, labelY, {
                size: 8.6,
                weight: Pango.Weight.BOLD,
                color: palette.textPrimary,
                align: "center",
                maxWidth: dims.cellW + 6
            });

            // Battery % or Status
            let subText = !dev.connected
                ? "Offline"
                : (dev.hasBatteryLevel ? (dev.percentage + "%") : "Ativo");
            this._drawText(cr, subText, cx, labelY + 13, {
                size: 8.0,
                weight: Pango.Weight.NORMAL,
                color: dev.charging ? [0.188, 0.820, 0.345, 0.95] : palette.textSecondary,
                align: "center",
                maxWidth: dims.cellW + 6
            });
        }

        cr.$dispose();
    }

    // =========================================================================
    // DEVICE CLASSIFICATION & VECTOR ICONS
    // =========================================================================

    _classifyDevice(iconName, alias, upowerKind) {
        let ic = (iconName || "").toLowerCase();
        let al = (alias || "").toLowerCase();

        if (upowerKind === 5 || ic.includes("mouse") || al.includes("mouse") || al.includes("mx ") || al.includes("deathadder") || al.includes("basilisk") || al.includes("logi")) {
            return "mouse";
        }
        if (upowerKind === 6 || ic.includes("keyboard") || al.includes("keyboard") || al.includes("teclado") || al.includes("keychron") || al.includes("k380")) {
            return "keyboard";
        }
        if (upowerKind === 12 || ic.includes("gaming") || ic.includes("joypad") || al.includes("controller") || al.includes("xbox") || al.includes("dualsense") || al.includes("dualshock") || al.includes("8bitdo")) {
            return "gamepad";
        }
        if (ic.includes("headset") || ic.includes("headphone") || al.includes("qcy") || al.includes("airpods") || al.includes("buds") || al.includes("wh-") || al.includes("wf-") || al.includes("head") || al.includes("fone")) {
            return "headphone";
        }
        if (ic.includes("audio") || ic.includes("speaker") || al.includes("onyx") || al.includes("jbl") || al.includes("studio") || al.includes("speaker") || al.includes("boom")) {
            return "speaker";
        }
        if (upowerKind === 8 || ic.includes("phone") || al.includes("iphone") || al.includes("galaxy") || al.includes("pixel")) {
            return "phone";
        }
        return "bluetooth";
    }

    _getSymbolicIconName(type) {
        switch (type) {
            case "headphone":
                return "audio-headphones-symbolic";
            case "speaker":
                return "audio-speakers-symbolic";
            case "mouse":
                return "input-mouse-symbolic";
            case "keyboard":
                return "input-keyboard-symbolic";
            case "gamepad":
                return "input-gaming-symbolic";
            case "phone":
                return "phone-symbolic";
            case "laptop":
                return "computer-symbolic";
            default:
                return "bluetooth-active-symbolic";
        }
    }

    _shortenName(name) {
        if (!name) return "Device";
        let clean = name.trim();
        if (clean.length > 11) {
            return clean.substring(0, 10).trim() + "…";
        }
        return clean;
    }

    _drawVectorIcon(cr, type, cx, cy, size, color) {
        cr.save();
        cr.setSourceRGBA(color[0], color[1], color[2], color[3] !== undefined ? color[3] : 0.95);
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);
        let r = size / 2;

        switch (type) {
            case "laptop": {
                let bw = r * 1.45;
                let bh = r * 0.95;
                this._drawRoundedRect(cr, cx - bw / 2, cy - bh / 2 - r * 0.1, bw, bh, 2);
                cr.setLineWidth(1.6);
                cr.stroke();
                cr.moveTo(cx - bw * 0.68, cy + bh / 2 + r * 0.05);
                cr.lineTo(cx + bw * 0.68, cy + bh / 2 + r * 0.05);
                cr.setLineWidth(2.0);
                cr.stroke();
                break;
            }
            case "headphone": {
                cr.newPath();
                cr.arc(cx, cy, r * 0.68, Math.PI, 0);
                cr.setLineWidth(1.8);
                cr.stroke();
                this._drawRoundedRect(cr, cx - r * 0.82, cy - r * 0.05, r * 0.34, r * 0.62, 2);
                cr.fill();
                this._drawRoundedRect(cr, cx + r * 0.48, cy - r * 0.05, r * 0.34, r * 0.62, 2);
                cr.fill();
                break;
            }
            case "speaker": {
                let sw = r * 1.1;
                let sh = r * 1.45;
                this._drawRoundedRect(cr, cx - sw / 2, cy - sh / 2, sw, sh, 2.5);
                cr.setLineWidth(1.5);
                cr.stroke();
                cr.newPath();
                cr.arc(cx, cy - sh * 0.22, r * 0.14, 0, 2 * Math.PI);
                cr.fill();
                cr.newPath();
                cr.arc(cx, cy + sh * 0.18, r * 0.28, 0, 2 * Math.PI);
                cr.setLineWidth(1.4);
                cr.stroke();
                break;
            }
            case "mouse": {
                let mw = r * 0.95;
                let mh = r * 1.45;
                this._drawRoundedRect(cr, cx - mw / 2, cy - mh / 2, mw, mh, mw / 2);
                cr.setLineWidth(1.6);
                cr.stroke();
                cr.moveTo(cx, cy - mh * 0.28);
                cr.lineTo(cx, cy - mh * 0.05);
                cr.setLineWidth(1.5);
                cr.stroke();
                break;
            }
            case "keyboard": {
                let kw = r * 1.55;
                let kh = r * 0.95;
                this._drawRoundedRect(cr, cx - kw / 2, cy - kh / 2, kw, kh, 2);
                cr.setLineWidth(1.5);
                cr.stroke();
                cr.moveTo(cx - kw * 0.25, cy + kh * 0.22);
                cr.lineTo(cx + kw * 0.25, cy + kh * 0.22);
                cr.stroke();
                break;
            }
            case "gamepad": {
                let gw = r * 1.55;
                let gh = r * 0.95;
                this._drawRoundedRect(cr, cx - gw / 2, cy - gh / 2, gw, gh, gh * 0.4);
                cr.setLineWidth(1.5);
                cr.stroke();
                cr.newPath();
                cr.arc(cx - gw * 0.22, cy, 1.3, 0, 2 * Math.PI);
                cr.fill();
                cr.newPath();
                cr.arc(cx + gw * 0.22, cy, 1.3, 0, 2 * Math.PI);
                cr.fill();
                break;
            }
            case "phone": {
                let pw = r * 0.88;
                let ph = r * 1.5;
                this._drawRoundedRect(cr, cx - pw / 2, cy - ph / 2, pw, ph, 2.5);
                cr.setLineWidth(1.5);
                cr.stroke();
                break;
            }
            case "bolt": {
                cr.moveTo(cx + r * 0.15, cy - r * 0.85);
                cr.lineTo(cx - r * 0.45, cy + r * 0.05);
                cr.lineTo(cx + r * 0.05, cy + r * 0.05);
                cr.lineTo(cx - r * 0.15, cy + r * 0.85);
                cr.lineTo(cx + r * 0.45, cy - r * 0.05);
                cr.lineTo(cx - r * 0.05, cy - r * 0.05);
                cr.closePath();
                cr.fill();
                break;
            }
            default: {
                cr.setLineWidth(1.5);
                cr.moveTo(cx - r * 0.38, cy - r * 0.38);
                cr.lineTo(cx + r * 0.38, cy + r * 0.38);
                cr.lineTo(cx, cy + r * 0.78);
                cr.lineTo(cx, cy - r * 0.78);
                cr.lineTo(cx + r * 0.38, cy - r * 0.38);
                cr.lineTo(cx - r * 0.38, cy + r * 0.38);
                cr.stroke();
                break;
            }
        }

        cr.restore();
    }

    _drawRoundedRect(cr, x, y, w, h, r) {
        let radius = Math.min(r, w / 2, h / 2);
        cr.newSubPath();
        cr.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0);
        cr.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2);
        cr.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI);
        cr.arc(x + radius, y + radius, radius, Math.PI, 3 * Math.PI / 2);
        cr.closePath();
    }

    _drawText(cr, text, x, y, opts) {
        let layout = PangoCairo.create_layout(cr);
        let fontDesc = new Pango.FontDescription();
        fontDesc.set_family("SF Pro Display, Inter, Ubuntu, Cantarell, Sans");
        fontDesc.set_weight(opts.weight || Pango.Weight.NORMAL);
        fontDesc.set_size((opts.size || 10) * Pango.SCALE);
        layout.set_font_description(fontDesc);

        if (opts.maxWidth) {
            layout.set_width(opts.maxWidth * Pango.SCALE);
            layout.set_ellipsize(Pango.EllipsizeMode.END);
        }

        layout.set_text(String(text !== undefined && text !== null ? text : ""), -1);
        let [tw] = layout.get_pixel_size();

        let drawX = x;
        if (opts.align === "center") {
            drawX = x - tw / 2;
        } else if (opts.align === "right") {
            drawX = x - tw;
        }

        let c = opts.color || [1, 1, 1, 1];
        cr.setSourceRGBA(c[0], c[1], c[2], c[3] !== undefined ? c[3] : 1.0);
        cr.moveTo(drawX, y);
        PangoCairo.show_layout(cr, layout);
        cr.newPath();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new IOSBluetoothBatteryApplet(metadata, orientation, panel_height, instance_id);
}
