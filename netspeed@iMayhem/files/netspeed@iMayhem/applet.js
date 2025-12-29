/*
 * Net Speed (Text Only) - Cinnamon Applet
 * Copyright (c) 2025 iMayhem
 * Licensed under the MIT License
 */

const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const NM = imports.gi.NM;
const UUID = "netspeed@iMayhem";



// Custom Logger (File + Global)
function log(msg) {
    let debugPath = GLib.get_home_dir() + "/netspeed_debug.log";
    let timestamp = new Date().toISOString();
    let logMsg = `[${timestamp}] [${UUID}] ${msg}`;

    global.log(logMsg);

    // Append to file asynchronously using shell redirection (simple & effective for debug)
    try {
        GLib.spawn_command_line_async(`bash -c 'echo "${logMsg}" >> ${debugPath}'`);
    } catch (e) {
        global.logError("Failed to write to debug log: " + e);
    }
}
function logError(msg) {
    log("ERROR: " + msg);
    global.logError(`[${UUID}] ERROR: ${msg}`);
}

const Config = imports.misc.config;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

// Localized String Helper
// Uses manual translation dictionary if available, otherwise falls back to system gettext
function _(str) {
    return Gettext.dgettext(UUID, str);
}

class NetSpeedApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        // Use monospace font to prevent width jitter which can close the hover tooltip
        this._applet_label.set_style("font-family: monospace;");

        this.metadata = metadata;

        // Expose instance for the helper function
        global.netSpeedAppletInstance = this;

        // Settings
        this.settings = new Settings.AppletSettings(
            this,
            metadata.uuid,
            instanceId
        );

        try {
            log("Binding settings...");
            this.settings.bind("refreshRate", "refreshRate", this.onSettingsChanged);
            this.settings.bind("compactMode", "compactMode", this.onSettingsChanged);
            this.settings.bind("iconTheme", "iconTheme", this.onSettingsChanged);
            this.settings.bind("verticalLayout", "verticalLayout", this.onSettingsChanged);


            this.settings.bind("ignoreLocalTraffic", "ignoreLocalTraffic", this.onSettingsChanged);
            this.settings.bind("showSessionStats", "showSessionStats", this.onSettingsChanged);
            this.settings.bind("dailyLogRetention", "dailyLogRetention", this.onSettingsChanged);

            // Advanced Settings
            this.settings.bind("showPing", "showPing", this.onSettingsChanged);
            this.settings.bind("pingAlways", "pingAlways", this.onSettingsChanged);
            this.settings.bind("pingServer", "pingServer", this.onSettingsChanged);
            this.settings.bind("dataLimitType", "dataLimitType", this.onSettingsChanged);
            this.settings.bind("dataLimitValue", "dataLimitValue", this.onSettingsChanged);
            this.settings.bind("dataLimitUnit", "dataLimitUnit", this.onSettingsChanged);
            this.settings.bind("alertPercentage", "alertPercentage", this.onSettingsChanged);
            this.settings.bind("overrideInterface", "overrideInterface", this.onSettingsChanged);
            log("Settings bound successfully.");
        } catch (e) {
            logError("Failed to bind settings: " + e);
        }

        // Feature Initialization
        this.currentPing = 0;
        this.viewMode = 0; // 0: Speed, 1: Session, 2: Daily
        this.pingLoopId = null;
        this.isHovering = false;

        // Smart Ping: Track Hover State
        this.actor.connect('enter-event', () => {
            this.isHovering = true;
            this.updatePing(); // Immediate ping on hover
        });
        this.actor.connect('leave-event', () => {
            this.isHovering = false;
        });

        // Context Menu
        let item = new Applet.MenuItem(_("Reset Session Stats"), "view-refresh-symbolic", () => this.resetSessionCounters());
        this._applet_context_menu.addMenuItem(item);



        // Interface Selection Menu
        this.interfacesMenu = new PopupMenu.PopupSubMenuMenuItem(_("Select Interface"));
        this._applet_context_menu.addMenuItem(this.interfacesMenu);
        this.updateInterfacesMenu();

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Help Menu Removed (Moved to Settings)

        // Usage tracking
        this.usageLogPath = GLib.get_home_dir() + "/.local/share/cinnamon/applets/netspeed@iMayhem/usage.json";
        this.sessionRX = 0;
        this.sessionTX = 0;
        this.dailyRX = 0;
        this.dailyTX = 0;
        this.currentDate = this.getCurrentDate();

        // Network Manager Client (Event Driven)
        try {
            this._client = NM.Client.new(null);
            this._client.connect('notify::primary-connection', () => {
                this.detectInterfaceAsync();
            });
            this._client.connect('notify::activating-connection', () => {
                this.detectInterfaceAsync();
            });
        } catch (e) {
            global.logError(e);
        }

        // Load daily usage from disk
        this.loadDailyUsage();

        // Initial state
        this.detectInterfaceAsync(); // Start async detection
        this.rxPrev = this.readRX();
        this.txPrev = this.readTX();
        this.lastTime = Date.now();

        this.updateTooltip();
        this.updateLabel(0, 0);

        this.startLoop();
    }

    onSettingsChanged() {
        this.detectInterfaceAsync();
        this.update();
    }

    startLoop() {
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
        }

        this.loopId = Mainloop.timeout_add_seconds(
            this.refreshRate,
            () => this.update()
        );
    }

    execCommandAsync(argv, callback) {
        try {
            let proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (callback) callback(stdout);
                } catch (e) {
                    // Command failed
                }
            });
        } catch (e) {
            global.logError(e);
        }
    }

    getAvailableInterfaces() {
        let interfaces = [];
        try {
            let dir = GLib.dir_open("/sys/class/net", 0);
            let file;
            while ((file = dir.read_name()) !== null) {
                if (file !== "lo") {
                    interfaces.push(file);
                }
            }
            dir.close();
            // Sort nicely: eth0, wlan0...
            interfaces.sort();
        } catch (e) {
            global.logError(e);
        }
        return interfaces;
    }

    updateInterfacesMenu() {
        this.interfacesMenu.menu.removeAll();

        // Auto Option
        let autoItem = new PopupMenu.PopupMenuItem(_("Auto-Detect (Recommended)"));
        // Add dot if selected
        if (this.overrideInterface === "") {
            autoItem.setShowDot(true);
        }
        autoItem.connect('activate', () => {
            this.overrideInterface = ""; // Clear override
            this.updateInterfacesMenu(); // Refresh menu dots
            this.update(); // Trigger immediate update
        });
        this.interfacesMenu.menu.addMenuItem(autoItem);

        this.interfacesMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // List Interfaces
        let interfaces = this.getAvailableInterfaces();
        interfaces.forEach(iface => {
            let item = new PopupMenu.PopupMenuItem(iface);
            if (this.overrideInterface === iface) {
                item.setShowDot(true);
            }
            item.connect('activate', () => {
                this.overrideInterface = iface; // Set override
                this.updateInterfacesMenu(); // Refresh menu dots
                this.update(); // Trigger immediate update
            });
            this.interfacesMenu.menu.addMenuItem(item);
        });
    }

    isInterfaceActive(iface) {
        // Only filter if setting is enabled
        if (this.ignoreLocalTraffic) {
            // Ignore loopback
            if (iface === "lo") return false;

            // Check if interface is UP
            let [ok, out] = GLib.spawn_command_line_sync(`ip link show ${iface}`);
            if (ok) {
                let status = out.toString();
                // Look for "state UP" or "<UP," in the output
                return status.includes("state UP") || status.includes("<UP,");
            }
            return false;
        }

        // If setting disabled, accept all interfaces
        return true;
    }

    detectInterfaceAsync() {
        // 1. Check Manual Override
        if (this.overrideInterface !== "") {
            this.iface = this.overrideInterface;
            // Immediate update not needed here, loop will pick it up
            return;
        }

        // 2. Auto-Detect active route asynchronously
        this.execCommandAsync(['ip', 'route', 'get', '1.1.1.1'], (stdout) => {
            if (!stdout) return;

            let match = stdout.match(/dev (\S+)/);
            if (match) {
                let candidate = match[1];

                // 3. Check if active (chained async)
                if (this.ignoreLocalTraffic) {
                    // Ignore loopback
                    if (candidate === "lo") return;

                    this.execCommandAsync(['ip', 'link', 'show', candidate], (linkOut) => {
                        if (linkOut && (linkOut.includes("state UP") || linkOut.includes("<UP,"))) {
                            this.iface = candidate;
                        }
                    });
                } else {
                    this.iface = candidate;
                }
            }
        });
    }

    readRX() {
        if (!this.iface) return 0;
        try {
            let [, bytes] = GLib.file_get_contents(
                `/sys/class/net/${this.iface}/statistics/rx_bytes`
            );
            return Number(bytes.toString());
        } catch {
            return 0;
        }
    }

    readTX() {
        if (!this.iface) return 0;
        try {
            let [, bytes] = GLib.file_get_contents(
                `/sys/class/net/${this.iface}/statistics/tx_bytes`
            );
            return Number(bytes.toString());
        } catch {
            return 0;
        }
    }

    getCurrentDate() {
        let now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    formatBytes(bytes) {
        if (bytes >= 1073741824) { // >= 1 GB
            return `${(bytes / 1073741824).toFixed(2)} GB`;
        } else if (bytes >= 1048576) { // >= 1 MB
            return `${(bytes / 1048576).toFixed(1)} MB`;
        } else if (bytes >= 1024) { // >= 1 KB
            return `${(bytes / 1024).toFixed(0)} KB`;
        }
        return `${bytes} B`;
    }

    resetSessionCounters() {
        this.sessionRX = 0;
        this.sessionTX = 0;
    }

    checkDayRollover() {
        let today = this.getCurrentDate();
        if (today !== this.currentDate) {
            // Save yesterday's data
            this.saveDailyUsage();

            // Reset for new day
            this.currentDate = today;
            this.dailyRX = 0;
            this.dailyTX = 0;

            // Load today's data (if exists)
            this.loadDailyUsage();
        }
    }

    loadDailyUsage() {
        try {
            // Ensure directory exists
            let dir = GLib.path_get_dirname(this.usageLogPath);
            GLib.mkdir_with_parents(dir, 0o755);

            // Try to read existing file
            if (GLib.file_test(this.usageLogPath, GLib.FileTest.EXISTS)) {
                let [ok, contents] = GLib.file_get_contents(this.usageLogPath);
                if (ok) {
                    let data = JSON.parse(contents.toString());
                    let today = this.currentDate;

                    if (data[today]) {
                        this.dailyRX = data[today].download || 0;
                        this.dailyTX = data[today].upload || 0;
                    }
                }
            }
        } catch (e) {
            global.log(`NetSpeed: Error loading usage data: ${e}`);
        }
    }

    saveDailyUsage() {
        try {
            let data = {};

            // Load existing data
            if (GLib.file_test(this.usageLogPath, GLib.FileTest.EXISTS)) {
                let [ok, contents] = GLib.file_get_contents(this.usageLogPath);
                if (ok) {
                    try {
                        data = JSON.parse(contents.toString());
                    } catch (e) {
                        data = {};
                    }
                }
            }

            // Update today's data
            data[this.currentDate] = {
                download: this.dailyRX,
                upload: this.dailyTX
            };

            // Clean up old entries
            let cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.dailyLogRetention);

            for (let date in data) {
                let entryDate = new Date(date);
                if (entryDate < cutoffDate) {
                    delete data[date];
                }
            }

            // Save to file
            let jsonData = JSON.stringify(data, null, 2);
            GLib.file_set_contents(this.usageLogPath, jsonData);
        } catch (e) {
            global.log(`NetSpeed: Error saving usage data: ${e}`);
        }
    }

    updateTooltip() {
        let tooltip = _("Network Speed");

        // Add Data Plan Status
        if (this.dataLimitType !== "None") {
            let totalUsage = this.dailyRX + this.dailyTX;
            let limitBytes = this.dataLimitValue * (this.dataLimitUnit === "GB" ? 1073741824 : 1048576);
            let percentage = (totalUsage / limitBytes) * 100;
            tooltip += `\n\n${_("Data Plan")} (${this.dataLimitType}):`;
            tooltip += `\n  ${_("Used")}: ${percentage.toFixed(1)}% (${this.formatBytes(totalUsage)} / ${this.dataLimitValue}${this.dataLimitUnit})`;
        }

        if (this.showSessionStats && this.iface) {
            tooltip += `\n\n${_("Session")} (${this.iface}):`;
            tooltip += `\n  ↓ ${this.formatBytes(this.sessionRX)}`;
            tooltip += `\n  ↑ ${this.formatBytes(this.sessionTX)}`;

            tooltip += `\n\n${_("Today")} (${this.currentDate}):`;
            tooltip += `\n  ↓ ${this.formatBytes(this.dailyRX)}`;
            tooltip += `\n  ↑ ${this.formatBytes(this.dailyTX)}`;
        }

        if (this.showPing && this.currentPing > 0) {
            tooltip += `\n\n${_("Latency")}: ${this.currentPing.toFixed(1)} ms`;
        }

        tooltip += `\n\n${_("(Click to switch views)")}`;

        this.set_applet_tooltip(tooltip);
    }


    format(value) {
        return value >= 1024
            ? `${(value / 1024).toFixed(1)} MB/s`
            : `${value.toFixed(0)} KB/s`;
    }

    formatCompact(value) {
        return value >= 1024
            ? `${(value / 1024).toFixed(1)}M`
            : `${value.toFixed(0)}K`;
    }

    getIndicators() {
        switch (this.iconTheme) {
            case "small_arrows": return ["▾", "▴"];
            case "triangles": return ["▼", "▲"];
            case "chevrons": return ["∨", "∧"];
            case "guillemets": return ["«", "»"];
            case "arrows": default: return ["↓", "↑"];
        }
    }

    updateLabel(down, up) {
        // Clamp very small values to zero
        down = down < 1 ? 0 : down;
        up = up < 1 ? 0 : up;

        let text = "";

        let [downIcon, upIcon] = this.getIndicators();

        // Handle View Modes
        if (this.viewMode === 0) { // Speed View
            let dStr = this.compactMode ? this.formatCompact(down) : this.format(down);
            let uStr = this.compactMode ? this.formatCompact(up) : this.format(up);

            if (this.verticalLayout) {
                // Vertical Stack with Padding for Alignment
                // We pad start to ensuring similar width. 
                // Note: Unless a monospace font is enforced by theme, this is an approximation.
                text = `${downIcon} ${dStr.padStart(9)}\n${upIcon} ${uStr.padStart(9)}`;
            } else {
                // Classic Side-by-Side (Aligned)
                text = this.compactMode
                    ? `${downIcon}${dStr.padStart(6)} ${upIcon}${uStr.padStart(6)}`
                    : `${downIcon} ${dStr.padStart(9)}   ${upIcon} ${uStr.padStart(9)}`;
            }
        } else if (this.viewMode === 1) { // Session View
            // Session/Daily always use single line as they are wide
            text = `${_("Session")}: ${downIcon}${this.formatBytes(this.sessionRX)} ${upIcon}${this.formatBytes(this.sessionTX)}`;
        } else if (this.viewMode === 2) { // Daily View
            text = `${_("Daily")}: ${downIcon}${this.formatBytes(this.dailyRX)} ${upIcon}${this.formatBytes(this.dailyTX)}`;
        }

        // Apply Data Limit Alert
        if (this.dataLimitType !== "None") {
            let totalUsage = this.dailyRX + this.dailyTX;
            let limitBytes = this.dataLimitValue * (this.dataLimitUnit === "GB" ? 1073741824 : 1048576);
            let percentage = (totalUsage / limitBytes) * 100;

            if (percentage >= 100) {
                text = "⚠ " + text; // Critical Alert
                // In a real applet we might change CSS class, but text is safer for now
            } else if (percentage >= this.alertPercentage) {
                text = "! " + text; // Warning Alert
            }
        }
        this.set_applet_label(text);
    }

    update() {
        // NOTE: We do NOT poll detectInterfaceAsync() here anymore.
        // It is handled by NMClient signals ('notify::primary-connection').
        // This saves massive CPU by not spawning 'ip route' every second.

        let now = Date.now();
        let rxNow = this.readRX();
        let txNow = this.readTX();

        let dt = (now - this.lastTime) / 1000;
        if (dt <= 0) {
            this.startLoop();
            return false;
        }

        // Calculate differences in bytes
        let rxDiff = rxNow - this.rxPrev;
        let txDiff = txNow - this.txPrev;

        // Handle potential counter overflow/reset
        if (rxDiff < 0) rxDiff = 0;
        if (txDiff < 0) txDiff = 0;

        // Update counters
        this.sessionRX += rxDiff;
        this.sessionTX += txDiff;
        this.dailyRX += rxDiff;
        this.dailyTX += txDiff;

        // Check for day rollover
        this.checkDayRollover();

        // Update Ping (less frequently, e.g. every 5th update or separate loop)
        // For simplicity, we call it here but it's async
        if (this.showPing) this.updatePing();

        // Update tooltip with new stats
        this.updateTooltip();

        let down = rxDiff / dt / 1024;
        let up = txDiff / dt / 1024;

        this.updateLabel(down, up);

        this.rxPrev = rxNow;
        this.txPrev = txNow;
        this.lastTime = now;

        this.startLoop();
        return false;
    }

    on_applet_clicked(event) {
        // Toggle view mode: Speed -> Session -> Daily -> Speed
        this.viewMode = (this.viewMode + 1) % 3;
        // Immediate update to show change
        this.update();
    }

    on_applet_middle_clicked(event) {
        // Force refresh
        this.iface = null; // Forces re-detect
        this.update();
    }

    updatePing() {
        // Smart Ping Optimization:
        // Only ping if enabled, interface exists, AND (USER IS HOVERING OR Explicitly Enabled Always)
        if (!this.iface || !this.showPing) return;
        if (!this.pingAlways && !this.isHovering) return;

        try {
            // Check for previous ping result
            let pingFile = "/tmp/netspeed_ping";
            if (GLib.file_test(pingFile, GLib.FileTest.EXISTS)) {
                let [ok, content] = GLib.file_get_contents(pingFile);
                if (ok) {
                    let match = content.toString().match(/time=([\d.]+)/);
                    if (match) this.currentPing = parseFloat(match[1]);
                }
            }

            // Trigger new ping (async)
            // We use 'sh -c' to redirect output to file
            let cmd = `sh -c "ping -c 1 -W 1 ${this.pingServer} > ${pingFile}"`;
            GLib.spawn_command_line_async(cmd);

        } catch (e) {
            // Silent error to avoid spamming logs
        }
    }





    onSaveSettings() {
        log("Save Settings & Reload requested...");
        this.update();

        // Force language reload locally
        this.onLanguageChanged();

        // Reload the applet via DBus
        Mainloop.timeout_add(300, () => {
            try {
                log("Triggering DBus reload for " + UUID);
                let cmd = `dbus-send --session --dest=org.Cinnamon --print-reply /org/Cinnamon org.Cinnamon.ReloadXlet string:'${UUID}' string:'APPLET'`;
                GLib.spawn_command_line_async(cmd);
            } catch (e) {
                logError("Reload failed: " + e);
            }
            return GLib.SOURCE_REMOVE;
        });
    }


    onSaveButton() {
        // Trigger a force update of the applet to reflect all settings
        this.detectInterfaceAsync();
        this.update();
        log("Settings applied manually.");
    }

    on_applet_removed_from_panel() {
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
        }
        this.saveDailyUsage();
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new NetSpeedApplet(metadata, orientation, panelHeight, instanceId);
}
