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
const MANUAL_TRANSLATIONS = {
    "es": {
        "Network Speed": "Velocidad de red",
        "Session": "Sesión",
        "Today": "Hoy",
        "Latency": "Latencia",
        "Data Plan": "Plan de datos",
        "Used": "Usado",
        "(Click to switch views)": "(Haga clic para cambiar de vista)",
        "Daily": "Diario",
        "Usage History": "Historial de uso",
        "No history available": "No hay historial disponible",
        "Open Usage Log": "Abrir registro de uso",
        "Select Interface": "Seleccionar interfaz",
        "Auto-Detect (Recommended)": "Auto-detectar (Recomendado)",
        "Reset Session Stats": "Reiniciar estadísticas",
        "Reset Today's Stats": "Reiniciar estadísticas de hoy"
    },
    "fr": {
        "Network Speed": "Vitesse Réseau",
        "Session": "Session",
        "Today": "Aujourd'hui",
        "Latency": "Latence",
        "Daily": "Quotidien",
        "Usage History": "Historique d'utilisation",
        "Open Usage Log": "Ouvrir le journal",
        "Reset Session Stats": "Réinitialiser la session",
        "Reset Today's Stats": "Réinitialiser aujourd'hui"
    },
    "de": {
        "Network Speed": "Netzwerkgeschwindigkeit",
        "Session": "Sitzung",
        "Today": "Heute",
        "Latency": "Latenz",
        "Daily": "Täglich",
        "Usage History": "Verlauf",
        "Open Usage Log": "Protokoll öffnen",
        "Reset Session Stats": "Sitzung zurücksetzen",
        "Reset Today's Stats": "Heute zurücksetzen"
    }
};

function _(str) {
    let lang = global.netSpeedAppletInstance ? global.netSpeedAppletInstance.appletLanguage : "SYSTEM";
    if (lang !== "SYSTEM" && MANUAL_TRANSLATIONS[lang] && MANUAL_TRANSLATIONS[lang][str]) {
        return MANUAL_TRANSLATIONS[lang][str];
    }
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
            this.settings.bind("enableDailyLogging", "enableDailyLogging", this.onSettingsChanged);

            // Advanced Settings
            this.settings.bind("showPing", "showPing", this.onSettingsChanged);
            this.settings.bind("pingAlways", "pingAlways", this.onSettingsChanged);
            this.settings.bind("pingServer", "pingServer", this.onSettingsChanged);
            this.settings.bind("dataLimitType", "dataLimitType", this.onSettingsChanged);
            this.settings.bind("dataLimitValue", "dataLimitValue", this.onSettingsChanged);
            this.settings.bind("dataLimitUnit", "dataLimitUnit", this.onSettingsChanged);
            this.settings.bind("alertPercentage", "alertPercentage", this.onSettingsChanged);
            this.settings.bind("overrideInterface", "overrideInterface", this.onSettingsChanged);
            this.settings.bind("appletLanguage", "appletLanguage", this.onSettingsChanged);
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

        let resetDailyItem = new Applet.MenuItem(_("Reset Today's Stats"), "edit-clear-all-symbolic", () => this.resetDailyStats());
        this._applet_context_menu.addMenuItem(resetDailyItem);



        // Interface Selection Menu
        this.interfacesMenu = new PopupMenu.PopupSubMenuMenuItem(_("Select Interface"));
        this._applet_context_menu.addMenuItem(this.interfacesMenu);
        this.updateInterfacesMenu();

        // History Menu
        this.historyMenu = new PopupMenu.PopupSubMenuMenuItem(_("Usage History"));
        this._applet_context_menu.addMenuItem(this.historyMenu);
        this._applet_context_menu.connect('open-state-changed', (menu, open) => {
            if (open) this.updateHistoryMenu();
        });

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let openLogItem = new Applet.MenuItem(_("Open Usage Log"), "text-x-generic-symbolic", () => this.openUsageLog());
        this._applet_context_menu.addMenuItem(openLogItem);

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

    updateHistoryMenu() {
        this.saveDailyUsage(); // Ensure current stats are saved
        this.historyMenu.menu.removeAll();

        try {
            if (!GLib.file_test(this.usageLogPath, GLib.FileTest.EXISTS)) {
                this.historyMenu.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("No history available"), { reactive: false }));
                return;
            }

            let [ok, contents] = GLib.file_get_contents(this.usageLogPath);
            if (!ok) return;

            let data = JSON.parse(contents.toString());
            let dates = Object.keys(data).sort().reverse();

            if (dates.length === 0) {
                this.historyMenu.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("No history available"), { reactive: false }));
                return;
            }

            // Show last 7 days
            dates.slice(0, 7).forEach(date => {
                let dayData = data[date];
                // Convert MB back to bytes for formatBytes to work correctly
                let download = (dayData.download || 0) * 1048576;
                let upload = (dayData.upload || 0) * 1048576;
                let label = `${date}: ↓${this.formatBytes(download)} ↑${this.formatBytes(upload)}`;
                this.historyMenu.menu.addMenuItem(new PopupMenu.PopupMenuItem(label, { reactive: false }));
            });
        } catch (e) {
            logError("Failed to update history menu: " + e);
        }
    }

    openUsageLog() {
        this.saveDailyUsage(); // Ensure file exists and is up to date
        try {
            GLib.spawn_command_line_async(`xdg-open ${this.usageLogPath}`);
        } catch (e) {
            logError("Failed to open usage log: " + e);
        }
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
        this.update();
    }

    resetDailyStats() {
        this.dailyRX = 0;
        this.dailyTX = 0;
        this.saveDailyUsage();
        this.update();
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
                        let rx = data[today].download || 0;
                        let tx = data[today].upload || 0;

                        // DATA MIGRATION HEURISTIC:
                        // If values are astronomically high (e.g. > 1 million), they are likely legacy bytes.
                        // If we treat 100,000,000 (bytes) as MB, it becomes ~100 TB.
                        // We assume anything > 1,000,000 (1 TB as MB) is actually bytes from the old version.
                        if (rx > 1000000 || tx > 1000000) {
                            this.dailyRX = rx;
                            this.dailyTX = tx;
                        } else {
                            // Assume MB (new format)
                            this.dailyRX = rx * 1048576;
                            this.dailyTX = tx * 1048576;
                        }
                    }
                }
            }
        } catch (e) {
            global.log(`NetSpeed: Error loading usage data: ${e}`);
        }
    }

    saveDailyUsage() {
        if (!this.enableDailyLogging) return;
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

            // Update today's data (Store in MB for readability)
            data[this.currentDate] = {
                download: parseFloat((this.dailyRX / 1048576).toFixed(2)),
                upload: parseFloat((this.dailyTX / 1048576).toFixed(2))
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

        let isVertical = this._orientation === Applet.AllowedLayout.VERTICAL;

        // Handle View Modes
        if (this.viewMode === 0) { // Speed View
            let dStr = this.compactMode ? this.formatCompact(down) : this.format(down);
            let uStr = this.compactMode ? this.formatCompact(up) : this.format(up);

            if (this.verticalLayout || isVertical || this.compactMode) {
                // Vertical Stack: Keep icons and values close, pad the end for alignment
                let p = this.compactMode ? 6 : 9;
                text = `${downIcon} ${dStr.padEnd(p)}\n${upIcon} ${uStr.padEnd(p)}`;
            } else {
                // Classic Side-by-Side: Reduced internal spacing, pad end to prevent jitter
                text = `${downIcon} ${dStr.padEnd(8)} ${upIcon} ${uStr.padEnd(8)}`;
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
        if (!this.iface) {
            this.detectInterfaceAsync();
            this.startLoop();
            return false;
        }

        let now = Date.now();
        let rxNow = this.readRX();
        let txNow = this.readTX();

        // Fix: If rxPrev was 0 (interface just appeared), initialize it 
        // instead of adding the whole boot count to daily usage.
        if (this.rxPrev === 0) {
            this.rxPrev = rxNow;
            this.txPrev = txNow;
        }

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
