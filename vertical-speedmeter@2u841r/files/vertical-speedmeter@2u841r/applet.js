const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext;
const NM = imports.gi.NM;
const PopupMenu = imports.ui.popupMenu;
const { AppletSettings } = imports.ui.settings;

const UUID = "vertical-speedmeter@2u841r";

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

class VerticalPanelDownloadAndUploadSpeedApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.settings = new AppletSettings(this, UUID, instanceId);
        this.settings.bind("preferred-interface", "preferredInterface", this._onPreferredInterfaceChanged.bind(this));

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;
        this.orientation = orientation;
        this.instanceId = instanceId;
        this.iface = null;
        this.lastSample = null;
        this.loopId = 0;
        this.refreshInFlight = false;
        this.nmClient = null;
        this.sessionRX = 0;
        this.sessionTX = 0;
        this.dailyRX = 0;
        this.dailyTX = 0;
        this.currentDate = this.getCurrentDate();

        this.set_applet_tooltip(_("Detecting active interface..."));
        this.set_applet_label("0\n0");
        this._applet_label.set_style("font-family: monospace;");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.buildMenu();

        this.initNetworkManager();

        this.startLoop();
        this.refreshNow();
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
    }

    startLoop() {
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
        }

        this.loopId = Mainloop.timeout_add_seconds(1, () => {
            this.refreshNow();
            return GLib.SOURCE_CONTINUE;
        });
    }

    on_applet_clicked() {
        this.refreshNow();
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
            this.loopId = 0;
        }
    }

    _onPreferredInterfaceChanged() {
        let preferred = (this.preferredInterface || "").trim();
        if (this.ifaceSubmenu) {
            this.ifaceSubmenu.label.text = preferred
                ? _("Interface: %s").format(preferred)
                : _("Interface: Auto");
        }
        this.refreshNow(true);
    }

    buildMenu() {
        this.interfaceItem = new PopupMenu.PopupMenuItem(_("Interface: detecting..."));
        this.interfaceItem.actor.reactive = false;
        this.interfaceItem.actor.can_focus = false;
        this.menu.addMenuItem(this.interfaceItem);

        this.sessionItem = new PopupMenu.PopupMenuItem(_("Session: ↑0 B ↓0 B"));
        this.sessionItem.actor.reactive = false;
        this.sessionItem.actor.can_focus = false;
        this.menu.addMenuItem(this.sessionItem);

        this.dailyItem = new PopupMenu.PopupMenuItem(_("Today: ↑0 B ↓0 B"));
        this.dailyItem.actor.reactive = false;
        this.dailyItem.actor.can_focus = false;
        this.menu.addMenuItem(this.dailyItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.ifaceSubmenu = new PopupMenu.PopupSubMenuMenuItem(_("Interface: Auto"));
        this.menu.addMenuItem(this.ifaceSubmenu);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let resetItem = new PopupMenu.PopupMenuItem(_("Reset Session Stats"));
        resetItem.connect("activate", () => {
            this.sessionRX = 0;
            this.sessionTX = 0;
            this.updateMenuStats();
        });
        this.menu.addMenuItem(resetItem);

        this.menu.connect("open-state-changed", (menu, open) => {
            if (open) this._refreshInterfaceSubmenu();
        });
    }

    _listInterfaces(callback) {
        let dir = Gio.File.new_for_path("/sys/class/net");
        dir.enumerate_children_async(
            "standard::name",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (source, result) => {
                let ifaces = [];
                try {
                    let enumerator = source.enumerate_children_finish(result);
                    let info;
                    while ((info = enumerator.next_file(null)) !== null) {
                        let name = info.get_name();
                        if (name !== "lo") {
                            ifaces.push(name);
                        }
                    }
                    enumerator.close(null);
                } catch (e) {
                    global.logError(e);
                }
                callback(ifaces.sort());
            }
        );
    }

    _refreshInterfaceSubmenu() {
        this.ifaceSubmenu.menu.removeAll();

        let preferred = (this.preferredInterface || "").trim();

        this._listInterfaces((ifaces) => {
            let autoItem = new PopupMenu.PopupMenuItem(
                (preferred === "" ? "✓ " : "    ") + _("Auto-detect")
            );
            autoItem.connect("activate", () => {
                this.settings.setValue("preferred-interface", "");
                this.preferredInterface = "";
                this._onPreferredInterfaceChanged();
            });
            this.ifaceSubmenu.menu.addMenuItem(autoItem);

            for (let iface of ifaces) {
                let item = new PopupMenu.PopupMenuItem(
                    (preferred === iface ? "✓ " : "    ") + iface
                );
                item.connect("activate", () => {
                    this.settings.setValue("preferred-interface", iface);
                    this.preferredInterface = iface;
                    this._onPreferredInterfaceChanged();
                });
                this.ifaceSubmenu.menu.addMenuItem(item);
            }
        });
    }

    initNetworkManager() {
        try {
            this.nmClient = NM.Client.new(null);
            this.nmClient.connect("notify::primary-connection", () => this.refreshNow(true));
            this.nmClient.connect("notify::activating-connection", () => this.refreshNow(true));
        } catch (error) {
            this.nmClient = null;
            global.logError(error);
        }
    }

    refreshNow(forceDetect = false) {
        if (this.refreshInFlight) {
            return;
        }

        if (forceDetect) {
            this.iface = null;
            this.lastSample = null;
        }

        this.refreshInFlight = true;

        let nextStep = (iface) => {
            if (!iface) {
                this.iface = null;
                this.lastSample = null;
                this.set_applet_label("-\n-");
                this.set_applet_tooltip(_("No active network interface detected."));
                this.updateMenuStats();
                this.refreshInFlight = false;
                return;
            }

            this.iface = iface;
            this.readStats(iface, (stats) => {
                if (!stats) {
                    this.iface = null;
                    this.lastSample = null;
                    this.set_applet_label("-\n-");
                    this.set_applet_tooltip(_("Failed to read network counters."));
                    this.updateMenuStats();
                    this.refreshInFlight = false;
                    return;
                }

                this.updateDisplay(stats);
                this.refreshInFlight = false;
            });
        };

        if (this.iface) {
            nextStep(this.iface);
        } else {
            this.detectPrimaryInterface(nextStep);
        }
    }

    detectPrimaryInterface(callback) {
        let preferred = (this.preferredInterface || "").trim();
        if (preferred) {
            callback(preferred);
            return;
        }

        let nmIface = this.getNetworkManagerInterface();
        if (nmIface) {
            callback(nmIface);
            return;
        }

        this.detectRouteInterface(callback);
    }

    getNetworkManagerInterface() {
        if (!this.nmClient) {
            return null;
        }

        try {
            let devices = this.nmClient.get_devices();
            if (!devices) {
                return null;
            }

            for (let i = 0; i < devices.length; i++) {
                let device = devices[i];
                if (!device) {
                    continue;
                }

                let state = typeof device.get_state === "function"
                    ? device.get_state()
                    : device.state;
                let iface = typeof device.get_iface === "function"
                    ? device.get_iface()
                    : null;

                if (state === NM.DeviceState.ACTIVATED && iface && iface !== "lo") {
                    return iface;
                }
            }
        } catch (error) {
            global.logError(error);
        }

        return null;
    }

    detectRouteInterface(callback) {
        let proc;

        try {
            proc = Gio.Subprocess.new(
                ["ip", "route", "get", "1.1.1.1"],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (error) {
            global.logError(error);
            callback(null);
            return;
        }

        proc.communicate_utf8_async(null, null, (subprocess, result) => {
            try {
                let [, stdout] = subprocess.communicate_utf8_finish(result);
                let match = stdout ? stdout.match(/dev\s+(\S+)/) : null;
                callback(match ? match[1] : null);
            } catch (error) {
                global.logError(error);
                callback(null);
            }
        });
    }

    readStats(iface, callback) {
        this.readCounter(`/sys/class/net/${iface}/statistics/rx_bytes`, (rx) => {
            if (rx === null) {
                callback(null);
                return;
            }

            this.readCounter(`/sys/class/net/${iface}/statistics/tx_bytes`, (tx) => {
                if (tx === null) {
                    callback(null);
                    return;
                }

                callback({
                    rx,
                    tx,
                    time: GLib.get_monotonic_time()
                });
            });
        });
    }

    readCounter(path, callback) {
        let file = Gio.File.new_for_path(path);

        file.load_contents_async(null, (source, result) => {
            try {
                let [, contents] = source.load_contents_finish(result);
                let value = Number(ByteArray.toString(contents).trim());
                callback(Number.isFinite(value) ? value : null);
            } catch (error) {
                callback(null);
            }
        });
    }

    getCurrentDate() {
        let now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }

    checkDayRollover() {
        let today = this.getCurrentDate();
        if (today !== this.currentDate) {
            this.currentDate = today;
            this.dailyRX = 0;
            this.dailyTX = 0;
        }
    }

    updateMenuStats() {
        if (!this.interfaceItem || !this.sessionItem || !this.dailyItem) {
            return;
        }

        let ifaceLabel = this.iface ? this.iface : _("detecting...");
        this.interfaceItem.label.text = _("Interface: %s").format(ifaceLabel);
        this.sessionItem.label.text = _("Session: ↑%s ↓%s").format(
            this.formatBytes(this.sessionTX),
            this.formatBytes(this.sessionRX)
        );
        this.dailyItem.label.text = _("Today: ↑%s ↓%s").format(
            this.formatBytes(this.dailyTX),
            this.formatBytes(this.dailyRX)
        );
    }

    updateDisplay(sample) {
        if (!this.lastSample) {
            this.lastSample = sample;
            this.set_applet_label("0\n0");
            this.set_applet_tooltip(
                _("Monitoring %s").format(this.iface) +
                "\n" +
                _("Top line is upload. Bottom line is download.")
            );
            this.updateMenuStats();
            return;
        }

        let seconds = (sample.time - this.lastSample.time) / 1000000;
        if (seconds <= 0) {
            this.lastSample = sample;
            return;
        }

        let downBytes = Math.max(0, sample.rx - this.lastSample.rx);
        let upBytes = Math.max(0, sample.tx - this.lastSample.tx);
        let downRate = downBytes / seconds;
        let upRate = upBytes / seconds;

        this.checkDayRollover();
        this.sessionRX += downBytes;
        this.sessionTX += upBytes;
        this.dailyRX += downBytes;
        this.dailyTX += upBytes;
        this.lastSample = sample;

        this.set_applet_label(`${this.formatRate(upRate)}\n${this.formatRate(downRate)}`);
        this.set_applet_tooltip(
            _("Interface: %s").format(this.iface) +
            "\n" +
            _("Top line is upload. Bottom line is download.") +
            "\n" +
            _("Upload: %s/s").format(this.formatBytes(upRate)) +
            "\n" +
            _("Download: %s/s").format(this.formatBytes(downRate))
        );
        this.updateMenuStats();
    }

    formatRate(bytesPerSecond) {
        let kiloBytesPerSecond = bytesPerSecond / 1024;

        if (kiloBytesPerSecond < 1000) {
            return `${Math.round(kiloBytesPerSecond)}`;
        }

        if (kiloBytesPerSecond < 10000) {
            return `${(Math.floor(kiloBytesPerSecond) / 1000).toFixed(2)}`;
        }

        return `${(Math.floor(kiloBytesPerSecond / 10) / 100).toFixed(1)}`;
    }

    formatBytes(bytes) {
        if (bytes < 1024) {
            return `${Math.round(bytes)} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new VerticalPanelDownloadAndUploadSpeedApplet(metadata, orientation, panelHeight, instanceId);
}
