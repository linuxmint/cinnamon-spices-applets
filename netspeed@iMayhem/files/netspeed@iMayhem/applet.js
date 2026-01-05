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
const St = imports.gi.St;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const ByteArray = imports.byteArray;
const UUID = "netspeed@iMayhem";



// Custom Logger (Global only)
function log(msg) {
    let timestamp = new Date().toISOString();
    global.log(`[${timestamp}] [${UUID}] ${msg}`);
}
function logError(msg) {
    log("ERROR: " + msg);
    global.logError(`[${UUID}] ERROR: ${msg}`);
}


Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

const translationsCache = {};
let currentLanguage = "SYSTEM";

function _(str) {
    let lang = currentLanguage;

    // Automatic System Language Detection fallback
    if (lang === "SYSTEM") {
        let systemLangs = GLib.get_language_names();
        for (let sysLang of systemLangs) {
            if (translationsCache[sysLang]) {
                lang = sysLang;
                break;
            }
            // Also try stripping encoding/country if needed (though get_language_names usually provides fallback variants)
            let short = sysLang.split(/[._-]/)[0];
            if (translationsCache[short]) {
                lang = short;
                break;
            }
        }
    }

    if (lang === "en") return str; // Force English

    if (translationsCache[lang]) {
        let val = translationsCache[lang][str];
        if (val) return val;
    }

    return Gettext.dgettext(UUID, str);
}

class PoParser {
    static parse(content) {
        let translations = {};
        let lines = content.split('\n');
        let currentMsgid = null;
        let readingMsgstr = false;

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;

            if (line.startsWith('msgid "')) {
                currentMsgid = line.substring(7, line.length - 1);
                readingMsgstr = false;
            } else if (line.startsWith('msgstr "')) {
                let msgstr = line.substring(8, line.length - 1);
                if (currentMsgid !== null && currentMsgid !== "") {
                    translations[currentMsgid] = msgstr;
                    readingMsgstr = true;
                }
            } else if (line.startsWith('"')) {
                let str = line.substring(1, line.length - 1);
                if (readingMsgstr) {
                    if (currentMsgid !== null && currentMsgid !== "") {
                        translations[currentMsgid] += str;
                    }
                } else {
                    if (currentMsgid !== null) {
                        currentMsgid += str;
                    }
                }
            }
        }
        return translations;
    }
}


class ProcessMonitor {
    constructor() {
        this.history = {}; // pid -> { rx, tx, time }
        this.lastAlertTimes = {}; // name -> timestamp
        this.topProcesses = [];
        this.activeAppCount = 0;

        // Settings from applet
        this.enableHighUsageAlerts = false;
        this.highUsageThreshold = 10; // MB/s
    }

    update(callback) {
        try {
            let proc = Gio.Subprocess.new(
                ['ss', '-antuipOH'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout] = proc.communicate_utf8_finish(res);
                    if (stdout) {
                        this.parseOutput(stdout);
                        if (callback) callback();
                    }
                } catch (e) {
                    // Command failed or interrupted
                }
            });
        } catch (e) {
            global.logError(e);
        }
    }

    triggerAlert(name, speedMBs) {
        let now = Date.now();
        // Cooldown: 5 minutes (300,000 ms)
        if (this.lastAlertTimes[name] && (now - this.lastAlertTimes[name] < 300000)) {
            return;
        }

        this.lastAlertTimes[name] = now;
        let title = _("High Network Usage Detected");
        let body = _("Application '%s' is consuming %s MB/s").format(name, speedMBs.toFixed(1));

        Main.notify(title, body);
    }

    parseOutput(stdout) {
        let lines = stdout.split('\n');
        let socketStats = {}; // pid_fd -> { rx, tx, name, pid }
        let now = Date.now();

        for (let line of lines) {
            if (!line) continue;

            // Extract process name, pid, and fd
            let usersMatch = line.match(/users:\(\("([^"]+)",pid=(\d+),fd=(\d+)/);
            if (!usersMatch) continue;

            let name = usersMatch[1];
            let pid = usersMatch[2];
            let fd = usersMatch[3];
            let key = `${pid}_${fd}`;

            // Extract bytes
            let sentMatch = line.match(/bytes_sent:(\d+)/);
            let recvMatch = line.match(/bytes_received:(\d+)/);

            let tx = sentMatch ? parseInt(sentMatch[1]) : 0;
            let rx = recvMatch ? parseInt(recvMatch[1]) : 0;

            socketStats[key] = { name: name, pid: pid, rx: rx, tx: tx };
        }

        let appSpeeds = {}; // pid -> { name, rx, tx }

        for (let key in socketStats) {
            let stats = socketStats[key];
            let pid = stats.pid;

            if (this.history[key]) {
                let prev = this.history[key];
                let dt = (now - prev.time) / 1000;
                if (dt > 0) {
                    let rxSpeed = Math.max(0, (stats.rx - prev.rx) / dt);
                    let txSpeed = Math.max(0, (stats.tx - prev.tx) / dt);

                    if (!appSpeeds[pid]) {
                        appSpeeds[pid] = { name: stats.name, rx: 0, tx: 0 };
                    }
                    appSpeeds[pid].rx += rxSpeed;
                    appSpeeds[pid].tx += txSpeed;
                }
            }
            // Update history with current snapshot
            this.history[key] = { rx: stats.rx, tx: stats.tx, time: now };
        }

        // Cleanup old history keys that are no longer active
        for (let key in this.history) {
            if (!socketStats[key]) {
                delete this.history[key];
            }
        }

        let deltas = [];
        for (let pid in appSpeeds) {
            let app = appSpeeds[pid];
            if (app.rx > 0 || app.tx > 0) {
                deltas.push({
                    name: app.name,
                    rx: app.rx,
                    tx: app.tx,
                    total: app.rx + app.tx
                });
            }
        }

        // Sort by total usage desc
        deltas.sort((a, b) => b.total - a.total);

        // Aggregate by name (multiple pids for same app)
        let aggregated = {};
        for (let d of deltas) {
            if (!aggregated[d.name]) aggregated[d.name] = { name: d.name, rx: 0, tx: 0, total: 0 };
            aggregated[d.name].rx += d.rx;
            aggregated[d.name].tx += d.tx;
            aggregated[d.name].total += d.total;

            // High Usage Alert Logic
            if (this.enableHighUsageAlerts) {
                let totalMBs = (d.rx + d.tx) / (1024 * 1024);
                if (totalMBs >= this.highUsageThreshold) {
                    this.triggerAlert(d.name, totalMBs);
                }
            }
        }

        this.topProcesses = Object.values(aggregated)
            .sort((a, b) => b.total - a.total);

        this.activeAppCount = this.topProcesses.length;
    }
}

class CustomTooltip {
    constructor(applet) {
        this.applet = applet;
        this.actor = new St.BoxLayout({
            vertical: true,
            style_class: 'netspeed-popup',
            track_hover: true,
            reactive: true
        });
        this.actor.hide();
        Main.uiGroup.add_actor(this.actor);

        this.header = new St.BoxLayout({ x_align: St.Align.START });
        this.actor.add(this.header, { x_fill: true });

        this.title = new St.Label({ style_class: 'netspeed-title' });
        this.header.add(this.title, { expand: true, x_align: St.Align.START });

        this.scrollView = new St.ScrollView({
            x_fill: true,
            y_fill: true,
            y_expand: true,
            style_class: 'netspeed-scroll'
        });

        // Fix scroll hijacking: Capture ALL scroll events on the actor to stop them from leaking
        // Fix scroll hijacking: Capture ALL scroll events on the actor to stop them from leaking
        this.actor.connect('scroll-event', (actor, event) => {
            return Clutter.EVENT_STOP;
        });
        this.scrollView.connect('scroll-event', (actor, event) => {
            return Clutter.EVENT_STOP;
        });

        this.actor.add(this.scrollView, { expand: true, x_fill: true, y_fill: true });

        let box = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            reactive: true // Make box reactive too
        });
        this.scrollView.add_actor(box);

        // EXTRA scroll stop on the box itself
        box.connect('scroll-event', () => Clutter.EVENT_STOP);
        this.scrollView.connect('scroll-event', () => Clutter.EVENT_STOP);

        this.content = new St.Label({ style_class: 'netspeed-label-mono' });
        this.content.clutter_text.set_use_markup(true);
        box.add_actor(this.content);

        // Smart Hover logic for panel itself
        this.mouseIn = false;
        this.actor.set_reactive(true);
        this.actor.connect('enter-event', () => {
            this.mouseIn = true;
        });
        this.actor.connect('leave-event', () => {
            this.mouseIn = false;
            this.handleHoverChange();
        });
    }

    handleHoverChange() {
        Mainloop.timeout_add(500, () => {
            if (!this.applet.isHovering && !this.mouseIn) {
                this.hide();
            }
        });
    }

    setTitle(text) {
        this.title.set_text(text);
    }

    setText(text) {
        this.content.clutter_text.set_markup(text);
    }

    show() {
        // Position relative to applet
        let [x, y] = this.applet.actor.get_transformed_position();
        let [w, h] = this.applet.actor.get_transformed_size();
        let [tw, th] = this.actor.get_transformed_size();

        let posX = x + (w / 2) - (tw / 2);
        // POSITION: Ensure no gap. 
        // We put it exactly against the applet actor to ensure a seamless transition for the mouse.
        let posY = y - th;

        // Keep on screen
        posX = Math.max(0, Math.min(posX, global.screen_width - tw));

        this.actor.set_position(posX, posY);
        this.actor.set_opacity(0);
        this.actor.show();
        this.actor.ease({
            opacity: 255,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    hide() {
        this.actor.ease({
            opacity: 0,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.actor.hide()
        });
    }

    destroy() {
        this.actor.destroy();
    }
}

class NetSpeedApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        // Use monospace font to prevent width jitter which can close the hover tooltip
        this._applet_label.set_style("font-family: monospace;");

        this.metadata = metadata;

        // Load custom stylesheet
        try {
            Main.theme_context.get_theme().load_stylesheet(metadata.path + "/stylesheet.css");
        } catch (e) {
            global.logError("Failed to load stylesheet: " + e);
        }

        // Expose instance for the helper function (Manual override support)
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
            this.settings.bind("enablePerAppMonitor", "enablePerAppMonitor", this.onSettingsChanged);
            this.settings.bind("enableHighUsageAlerts", "enableHighUsageAlerts", this.onSettingsChanged);
            this.settings.bind("highUsageThreshold", "highUsageThreshold", this.onSettingsChanged);
            this.settings.bind("appletLanguage", "appletLanguage", this.onLanguageSettingChanged);

            // Advanced Settings
            this.settings.bind("showPing", "showPing", this.onSettingsChanged);
            this.settings.bind("pingAlways", "pingAlways", this.onSettingsChanged);
            this.settings.bind("pingServer", "pingServer", this.onSettingsChanged);
            this.settings.bind("dataLimitType", "dataLimitType", this.onSettingsChanged);
            this.settings.bind("dataLimitValue", "dataLimitValue", this.onSettingsChanged);
            this.settings.bind("dataLimitUnit", "dataLimitUnit", this.onSettingsChanged);
            this.settings.bind("alertPercentage", "alertPercentage", this.onSettingsChanged);
            this.settings.bind("overrideInterface", "overrideInterface", this.onSettingsChanged);
        } catch (e) {
            logError("Failed to bind settings: " + e);
        }

        // Feature Initialization
        this.customTooltip = new CustomTooltip(this);
        this.processMonitor = new ProcessMonitor();
        this.currentPing = 0;
        this.curDown = 0;
        this.curUp = 0;
        this.viewMode = 0; // 0: Speed, 1: Session, 2: Daily
        this.pingLoopId = null;
        this.isHovering = false;

        // Smart Tooltip: Track Hover State
        this.actor.connect('enter-event', () => {
            this.isHovering = true;
            this.updatePing(); // Immediate ping on hover
            this.updateTooltip();
            this.customTooltip.show();
        });
        this.actor.connect('leave-event', () => {
            this.isHovering = false;
            Mainloop.timeout_add(500, () => {
                if (!this.isHovering && !this.customTooltip.mouseIn) {
                    this.customTooltip.hide();
                }
            });
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

        this.discoverTranslations();

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let openUserGuideItem = new Applet.MenuItem(_("User Guide"), "system-help-symbolic", () => this.openUserGuide());
        this._applet_context_menu.addMenuItem(openUserGuideItem);

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

    onLanguageSettingChanged() {
        currentLanguage = this.appletLanguage;
        log(`Language changed to: ${currentLanguage}`);


        // Save current menu state if needed, but here we just rebuild the whole static part
        this._applet_context_menu.removeAll();

        let resetItem = new Applet.MenuItem(_("Reset Session Stats"), "view-refresh-symbolic", () => this.resetSessionCounters());
        this._applet_context_menu.addMenuItem(resetItem);

        let resetDailyItem = new Applet.MenuItem(_("Reset Today's Stats"), "edit-clear-all-symbolic", () => this.resetDailyStats());
        this._applet_context_menu.addMenuItem(resetDailyItem);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.interfacesMenu = new PopupMenu.PopupSubMenuMenuItem(_("Select Interface"));
        this._applet_context_menu.addMenuItem(this.interfacesMenu);
        this.updateInterfacesMenu();

        this.historyMenu = new PopupMenu.PopupSubMenuMenuItem(_("Usage History"));
        this._applet_context_menu.addMenuItem(this.historyMenu);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let openUserGuideItem = new Applet.MenuItem(_("User Guide"), "system-help-symbolic", () => this.openUserGuide());
        this._applet_context_menu.addMenuItem(openUserGuideItem);

        let openLogItem = new Applet.MenuItem(_("Open Usage Log"), "text-x-generic-symbolic", () => this.openUsageLog());
        this._applet_context_menu.addMenuItem(openLogItem);

        this.update();
        this.updateTooltip();
    }

    discoverTranslations() {
        try {
            let poDirPath = this.metadata.path + "/po";
            let poDir = Gio.File.new_for_path(poDirPath);

            if (!poDir.query_exists(null)) return;

            let enumerator = poDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                let file = info.get_name();
                if (file.endsWith(".po")) {
                    let langCode = file.replace(".po", "");
                    let [ok, content] = GLib.file_get_contents(poDirPath + "/" + file);
                    if (ok) {
                        try {
                            // Try modern TextDecoder
                            let decoder = new TextDecoder();
                            translationsCache[langCode] = PoParser.parse(decoder.decode(content));
                            log(`Loaded ${Object.keys(translationsCache[langCode]).length} strings for ${langCode}`);
                        } catch (e) {
                            // Fallback to ByteArray for older GJS
                            translationsCache[langCode] = PoParser.parse(ByteArray.toString(content));
                            log(`Loaded (legacy) ${Object.keys(translationsCache[langCode]).length} strings for ${langCode}`);
                        }
                    }
                }
            }
            currentLanguage = this.appletLanguage;
        } catch (e) {
            logError("Failed to discover translations: " + e);
        }
    }

    updateLanguageMenu() {
        this.languageMenu.menu.removeAll();

        // System Default
        let systemItem = new PopupMenu.PopupMenuItem(_("System Default"));
        if (this.appletLanguage === "SYSTEM") systemItem.setShowDot(true);
        systemItem.connect('activate', () => {
            this.appletLanguage = "SYSTEM";
        });
        this.languageMenu.menu.addMenuItem(systemItem);
        this.languageMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Discovered Languages
        let languages = Object.keys(translationsCache).sort();
        languages.forEach(lang => {
            let label = lang.toUpperCase();
            // Friendly names for common languages
            if (lang === "es") label = "Español";
            else if (lang === "fr") label = "Français";
            else if (lang === "hu") label = "Magyar";
            else if (lang === "de") label = "Deutsch";

            let item = new PopupMenu.PopupMenuItem(label);
            if (this.appletLanguage === lang) item.setShowDot(true);
            item.connect('activate', () => {
                this.appletLanguage = lang;
            });
            this.languageMenu.menu.addMenuItem(item);
        });
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
            let dir = Gio.File.new_for_path("/sys/class/net");
            let enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                let file = info.get_name();
                if (file !== "lo") {
                    interfaces.push(file);
                }
            }
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

    openUserGuide() {
        let path = this.metadata.path + "/user_guide.txt";
        try {
            GLib.spawn_command_line_async(`xdg-open "${path}"`);
        } catch (e) {
            Main.notify(_("Error opening User Guide"), e.message);
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
            return `${(bytes / 1073741824).toFixed(2)} G`;
        } else if (bytes >= 1048576) { // >= 1 MB
            return `${(bytes / 1048576).toFixed(1)} M`;
        } else if (bytes >= 1024) { // >= 1 KB
            return `${(bytes / 1024).toFixed(0)} K`;
        }
        return `${bytes} B`;
    }

    formatBytesFixed(bytes) {
        if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB/s`;
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB/s`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
        return `${bytes.toFixed(0)} B/s`;
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
        let title = "";
        let content = "";

        const dArrow = '<span color="#00ff00">↓</span>';
        const uArrow = '<span color="#ffaa00">↑</span>';

        if (this.viewMode === 0) { // Speed Mode
            title = _("Real-time Speed");
            content = `${dArrow} ${this.formatBytesFixed(this.curDown).padEnd(15, ' ')}\n${uArrow} ${this.formatBytesFixed(this.curUp)}`;
            if (this.showPing && this.currentPing > 0) {
                content += `\n\n<span color="#aaaaaa">${_("Latency")}:</span> ${this.currentPing.toFixed(1)} ms`;
            }
        }
        else if (this.viewMode === 1) { // Session Mode
            title = _("Session Usage");
            content = `${_("Interface")}: ${this.iface}\n\n`;
            content += `${dArrow} ${this.formatBytes(this.sessionRX).padEnd(12, ' ')}\n${uArrow} ${this.formatBytes(this.sessionTX)}`;
        }
        else if (this.viewMode === 2) { // Daily Mode
            title = _("Daily Usage");
            content = `${_("Date")}: ${this.currentDate}\n\n`;
            content += `${dArrow} ${this.formatBytes(this.dailyRX).padEnd(12, ' ')}\n${uArrow} ${this.formatBytes(this.dailyTX)}`;

            if (this.dataLimitType !== "None") {
                let totalUsage = this.dailyRX + this.dailyTX;
                let limitBytes = this.dataLimitValue * (this.dataLimitUnit === "GB" ? 1073741824 : 1048576);
                let percentage = (totalUsage / limitBytes) * 100;
                content += `\n\n<span color="#aaaaaa">${_("Data Plan")}:</span> ${percentage.toFixed(1)}%`;
            }
        }
        else if (this.viewMode === 3) { // Applications Mode
            title = _("Applications");
            if (this.processMonitor.topProcesses.length > 0) {
                this.processMonitor.topProcesses.forEach(p => {
                    let safeName = GLib.markup_escape_text(p.name, -1);
                    let name = safeName.substring(0, 8).padEnd(10, ' ');
                    let dStr = this.formatBytesFixed(p.rx).padStart(10, ' ');
                    let uStr = this.formatBytesFixed(p.tx).padStart(10, ' ');
                    content += `\n${name} ${dArrow}${dStr} ${uArrow}${uStr}`;
                });
            } else {
                content = `\n${_("No active apps")}`;
            }
        }

        this.customTooltip.setTitle(title);
        this.customTooltip.setText(content);
    }


    format(value) {
        // value is in KB/s
        if (value >= 1048576) { // >= 1 GB/s
            return `${(value / 1048576).toFixed(1)} G/s`;
        } else if (value >= 1024) { // >= 1 MB/s
            return `${(value / 1024).toFixed(1)} M/s`;
        } else {
            return `${value.toFixed(0)} K/s`;
        }
    }

    formatCompact(value) {
        // value is in KB/s
        if (value >= 1048576) return `${(value / 1048576).toFixed(1)}G`;
        if (value >= 1024) return `${(value / 1024).toFixed(1)}M`;
        return `${value.toFixed(0)}K`;
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
                // Vertical Stack
                text = `${downIcon}${dStr}\n${upIcon}${uStr}`;
            } else {
                // Horizontal
                text = `${downIcon}${dStr} ${upIcon}${uStr}`;
            }

        } else if (this.viewMode === 1) { // Session View
            let dStr = this.formatBytes(this.sessionRX);
            let uStr = this.formatBytes(this.sessionTX);
            if (this.compactMode || isVertical) {
                text = `${downIcon}${dStr}\n${upIcon}${uStr}`;
            } else {
                text = `${_("Session")}: ${downIcon}${dStr} ${upIcon}${uStr}`;
            }
        } else if (this.viewMode === 2) { // Daily View
            let dStr = this.formatBytes(this.dailyRX);
            let uStr = this.formatBytes(this.dailyTX);
            if (this.compactMode || isVertical) {
                text = `${downIcon}${dStr}\n${upIcon}${uStr}`;
            } else {
                text = `${_("Daily")}: ${downIcon}${dStr} ${upIcon}${uStr}`;
            }
        } else if (this.viewMode === 3) { // Applications Count View
            let count = this.processMonitor.activeAppCount;
            text = `${count} ${_("apps")}`;
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

        // Update Tip with process monitor
        if (this.enablePerAppMonitor || this.viewMode === 3 || this.enableHighUsageAlerts) {
            this.processMonitor.enableHighUsageAlerts = this.enableHighUsageAlerts;
            this.processMonitor.highUsageThreshold = this.highUsageThreshold;
            this.processMonitor.update(() => this.updateTooltip());
        }

        // Update tooltip with new stats
        this.updateTooltip();

        let downRate = rxDiff / dt;
        let upRate = txDiff / dt;
        this.curDown = downRate;
        this.curUp = upRate;

        let down = downRate / 1024;
        let up = upRate / 1024;

        this.updateLabel(down, up);

        this.rxPrev = rxNow;
        this.txPrev = txNow;
        this.lastTime = now;

        this.startLoop();
        return false;
    }

    on_applet_clicked(event) {
        // Toggle view mode: Speed -> Session -> Daily -> Apps -> Speed
        this.viewMode = (this.viewMode + 1) % 4;
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
        this.customTooltip.destroy();
        this.saveDailyUsage();
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new NetSpeedApplet(metadata, orientation, panelHeight, instanceId);
}
