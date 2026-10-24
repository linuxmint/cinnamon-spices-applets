// SPDX-License-Identifier: GPL-3.0-or-later
// Clockoo applet — hourly cuckoo, alarms read aloud, countdown timers.
// Copyright (C) 2026 FranzBias
//
// Why this file exists: it is Clockoo's face in the Cinnamon panel. It
// never rings by itself: it turns the applet settings into a JSON config
// and asks clockoo_core.py (bundled next to it) to write systemd *user*
// timers. systemd then runs clockoo_ring.py at the right moment, so every
// alarm and timer keeps ringing even if Cinnamon restarts or crashes.
// All units of the applet are named clockoo-applet-*: they never clash
// with the standalone Clockoo app (clockoo-*).

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Gettext = imports.gettext;

const UUID = "clockoo@FranzBias";
const PRESETS = [1, 5, 10, 15, 30];     // quick timers, minutes
const STATUS_EVERY = 30;                // seconds between status refreshes
const APPLY_DELAY = 700;                // ms: many setting changes, one apply

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    let translated = Gettext.dgettext(UUID, text);
    return translated !== text ? translated : Gettext.gettext(text);
}

// FNV-1a: a stable 8-hex-digit id per alarm, from its content. The list
// widget has no ids of its own, and systemd unit names need one.
function alarmId(row) {
    let text = [row.name, row.time, row.days, row.sound, row.text,
                row.voice, row.repeat].join("\u0001");
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return ("0000000" + hash.toString(16)).slice(-8);
}

function parseTime(text) {
    let match = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(text || "");
    if (!match)
        return null;
    let hour = parseInt(match[1], 10), minute = parseInt(match[2], 10);
    if (hour > 23 || minute > 59)
        return null;
    return [hour, minute];
}

// "7-21" / "8,12,18" / "0-6,22-23" -> [7, 8, ..., 21]
function parseHours(text) {
    let hours = new Set();
    for (let part of (text || "").split(",")) {
        let range = part.trim().split("-").map(n => parseInt(n, 10));
        if (range.some(isNaN) || range.length > 2)
            continue;
        let [from, to] = range.length === 2 ? range : [range[0], range[0]];
        for (let h = Math.max(0, from); h <= Math.min(23, to); h++)
            hours.add(h);
    }
    return [...hours].sort((a, b) => a - b);
}

function pad(n) {
    return (n < 10 ? "0" : "") + n;
}

function isoDate(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function formatDuration(seconds) {
    seconds = Math.max(0, Math.round(seconds));
    let h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
    return h ? h + ":" + pad(m) + ":" + pad(s) : pad(m) + ":" + pad(s);
}

// A sound chooser may store a file:// URI or a plain path.
function soundPath(value) {
    if (!value)
        return "";
    if (value.startsWith("file://"))
        return Gio.File.new_for_uri(value).get_path() || "";
    return value;
}

class ClockooApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        // Without this the default is horizontal only: on a vertical panel
        // Cinnamon shows a modal warning that grabs the whole desktop.
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.dir = metadata.path;
        this.core = this.dir + "/clockoo_core.py";
        this.configDir = GLib.get_user_config_dir() + "/Clockoo-applet";
        this.countdownsFile = this.configDir + "/countdowns.json";
        this.status = null;
        this.missing = [];
        this.applyTimeout = 0;
        this.tickTimeout = 0;

        this.set_applet_icon_symbolic_name("alarm-symbolic");
        this.set_applet_tooltip("Clockoo");

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        for (let [key, prop] of [
            ["cuckoo-enabled", "cuckooEnabled"], ["cuckoo-hours", "cuckooHours"],
            ["cuckoo-minute", "cuckooMinute"], ["cuckoo-sound", "cuckooSound"],
            ["cuckoo-count-hours", "cuckooCountHours"], ["alarms", "alarms"],
            ["timer-sound", "timerSound"], ["timer-text", "timerText"],
            ["timer-voice", "timerVoice"], ["timer-repeat", "timerRepeat"],
            ["timer-custom-minutes", "timerCustom"], ["snooze-minutes", "snoozeMinutes"],
            ["piper-dir", "piperDir"], ["show-countdown", "showCountdown"],
            ["once-dates", "onceDates"]]) {
            this.settings.bind(key, prop, () => this.onSettingsChanged(key));
        }

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.buildMenu();
        this.menu.connect("open-state-changed", (_menu, open) => {
            if (open)
                this.refreshStatus();
        });

        this.checkDependencies();
        this.applyNow();
        this.statusTimeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, STATUS_EVERY, () => {
                this.refreshStatus();
                return GLib.SOURCE_CONTINUE;
            });
    }

    // ------------------------------------------------------------ menu

    buildMenu() {
        this.menu.removeAll();

        this.nextItem = new PopupMenu.PopupMenuItem("", {reactive: false});
        this.menu.addMenuItem(this.nextItem);

        this.warningItem = new PopupMenu.PopupMenuItem("", {reactive: false});
        this.warningItem.actor.hide();
        this.menu.addMenuItem(this.warningItem);

        this.installItem = new PopupMenu.PopupIconMenuItem(
            _("Install missing packages…"), "system-software-install-symbolic",
            St.IconType.SYMBOLIC);
        this.installItem.connect("activate", () => this.installDependencies());
        this.installItem.actor.hide();
        this.menu.addMenuItem(this.installItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.cuckooSwitch = new PopupMenu.PopupSwitchMenuItem(
            "🐦 " + _("Hourly cuckoo"), this.cuckooEnabled);
        this.cuckooSwitch.connect("toggled", (_item, state) => {
            this.settings.setValue("cuckoo-enabled", state);
        });
        this.menu.addMenuItem(this.cuckooSwitch);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let timers = new PopupMenu.PopupSubMenuMenuItem("⏳ " + _("Start a timer"));
        for (let minutes of PRESETS) {
            let item = new PopupMenu.PopupMenuItem(_("%d min").format(minutes));
            item.connect("activate", () => this.startCountdown(minutes * 60));
            timers.menu.addMenuItem(item);
        }
        this.customItem = new PopupMenu.PopupMenuItem("");
        this.customItem.connect("activate", () => this.startCountdown(this.timerCustom * 60));
        timers.menu.addMenuItem(this.customItem);
        this.menu.addMenuItem(timers);

        this.countdownSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this.countdownSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_("Settings"), () => this.configureApplet());

        this.updateMenu();
    }

    updateMenu() {
        let status = this.status;
        if (status && status.next) {
            let when = new Date(status.next.when);
            let label = _("Next alarm: %s").format(this.whenText(when));
            if (status.next.name)
                label += " — " + status.next.name;
            this.nextItem.label.set_text("⏰ " + label);
        } else {
            this.nextItem.label.set_text("⏰ " + _("No alarm set"));
        }
        this.set_applet_tooltip("Clockoo\n" + this.nextItem.label.get_text());

        let warnings = [];
        if (this.missing.length)
            warnings.push(_("Missing packages: %s").format(this.missing.join(", ")));
        if (status && status.other_cuckoo && this.cuckooEnabled)
            warnings.push(_("The Clockoo app runs its own cuckoo too: you will hear it twice."));
        if (warnings.length) {
            this.warningItem.label.set_text("⚠ " + warnings.join("\n⚠ "));
            this.warningItem.actor.show();
        } else {
            this.warningItem.actor.hide();
        }
        if (this.missing.length)
            this.installItem.actor.show();
        else
            this.installItem.actor.hide();

        this.cuckooSwitch.setToggleState(this.cuckooEnabled);
        this.customItem.label.set_text(_("%d min").format(this.timerCustom) +
                                       "  (" + _("custom") + ")");
        this.updateCountdowns();
    }

    whenText(date) {
        let today = new Date();
        let tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        let clock = pad(date.getHours()) + ":" + pad(date.getMinutes());
        if (isoDate(date) === isoDate(today))
            return _("today") + " " + clock;
        if (isoDate(date) === isoDate(tomorrow))
            return _("tomorrow") + " " + clock;
        return date.toLocaleDateString(undefined, {weekday: "short", day: "numeric", month: "numeric"}) +
            " " + clock;
    }

    // ------------------------------------------------------------ countdowns

    readCountdowns() {
        try {
            let [ok, bytes] = GLib.file_get_contents(this.countdownsFile);
            if (!ok)
                return [];
            let items = JSON.parse(new TextDecoder().decode(bytes));
            return Array.isArray(items) ? items : [];
        } catch (e) {
            return [];
        }
    }

    updateCountdowns() {
        let now = Date.now();
        let items = this.readCountdowns()
            .map(c => Object.assign({}, c, {left: (new Date(c.end).getTime() - now) / 1000}))
            .filter(c => c.left > -5)
            .sort((a, b) => a.left - b.left);

        this.countdownSection.removeAll();
        for (let item of items) {
            let label = "⏳ " + (item.name || _("Timer")) + "  " + formatDuration(item.left) +
                "   ✕ " + _("Cancel");
            let menuItem = new PopupMenu.PopupMenuItem(label);
            menuItem.connect("activate", () => this.cancelCountdown(item.id));
            this.countdownSection.addMenuItem(menuItem);
        }

        if (this.showCountdown && items.length)
            this.set_applet_label(formatDuration(items[0].left));
        else
            this.set_applet_label("");

        // Tick every second only while a timer runs.
        if (items.length && !this.tickTimeout) {
            this.tickTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                this.updateCountdowns();
                if (this.readCountdowns().length)
                    return GLib.SOURCE_CONTINUE;
                this.tickTimeout = 0;
                this.set_applet_label("");
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    startCountdown(seconds) {
        this.runCore(["countdown", String(seconds), "", soundPath(this.timerSound),
                      this.timerText || "", this.timerVoice || "",
                      String(this.timerRepeat)], out => {
            if (out && out.error)
                Main.notify("Clockoo", _("Could not start the timer") + ": " + out.error);
            this.updateCountdowns();
        });
    }

    cancelCountdown(id) {
        this.runCore(["cancel", id], () => this.updateCountdowns());
    }

    // ------------------------------------------------------------ config → systemd

    onSettingsChanged(key) {
        if (key === "once-dates")
            return;
        if (key === "show-countdown" || key === "timer-custom-minutes") {
            this.updateMenu();
            return;
        }
        if (this.applyTimeout)
            GLib.source_remove(this.applyTimeout);
        this.applyTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, APPLY_DELAY, () => {
            this.applyTimeout = 0;
            this.applyNow();
            return GLib.SOURCE_REMOVE;
        });
    }

    // One-time alarms: remember the date they were armed for; once that
    // moment has passed, switch the row off in the settings list.
    onceDate(id, hour, minute, dates, expired) {
        let now = new Date();
        if (dates[id]) {
            let [y, mo, d] = dates[id].split("-").map(n => parseInt(n, 10));
            if (new Date(y, mo - 1, d, hour, minute) > now)
                return dates[id];
            expired.push(id);
            return null;
        }
        let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
        if (target <= now)
            target.setDate(target.getDate() + 1);
        dates[id] = isoDate(target);
        return dates[id];
    }

    buildConfig() {
        let dates = Object.assign({}, this.onceDates || {});
        let expired = [];
        let alarms = [];
        let rows = Array.isArray(this.alarms) ? this.alarms : [];
        for (let row of rows) {
            let time = parseTime(row.time);
            if (!time)
                continue;
            let id = alarmId(row);
            let days = (row.days || "").split("").map(n => parseInt(n, 10))
                .filter(n => n >= 0 && n <= 6);
            let date = null;
            if (!days.length && row.enabled)
                date = this.onceDate(id, time[0], time[1], dates, expired);
            alarms.push({
                id: id, name: row.name || "", enabled: !!row.enabled && (days.length > 0 || !!date),
                time: pad(time[0]) + ":" + pad(time[1]), days: days, date: date,
                sound: soundPath(row.sound), text: row.text || "", voice: row.voice || "",
                repeat: Math.max(1, parseInt(row.repeat, 10) || 1),
            });
        }
        // Forget dates of alarms that no longer exist or are not "once".
        let keep = {};
        for (let alarm of alarms)
            if (dates[alarm.id] && !alarm.days.length && alarm.enabled)
                keep[alarm.id] = dates[alarm.id];

        return {
            config: {
                version: 1,
                ui_lang: "auto",
                sounds_dir: "",
                piper_dir: soundPath(this.piperDir),
                snooze_minutes: this.snoozeMinutes,
                cuckoo: {
                    enabled: !!this.cuckooEnabled,
                    hours: parseHours(this.cuckooHours),
                    minute: this.cuckooMinute,
                    sound: soundPath(this.cuckooSound) || "cuckoo-clock.ogg",
                    count_hours: !!this.cuckooCountHours,
                },
                timer: {
                    sound: soundPath(this.timerSound) || "kitchen-timer.ogg",
                    voice: this.timerVoice || "",
                    repeat: this.timerRepeat,
                },
                alarms: alarms,
            },
            dates: keep,
            expired: expired,
            rows: rows,
        };
    }

    applyNow(disableAll = false) {
        let built = this.buildConfig();
        let config = built.config;
        if (disableAll) {
            config.cuckoo.enabled = false;
            config.alarms = [];
        }
        if (built.expired.length && !disableAll) {
            // Switching the rows off triggers onSettingsChanged → a new apply.
            let rows = built.rows.map(row => built.expired.includes(alarmId(row))
                ? Object.assign({}, row, {enabled: false}) : row);
            this.settings.setValue("once-dates", built.dates);
            this.settings.setValue("alarms", rows);
            return;
        }
        if (JSON.stringify(built.dates) !== JSON.stringify(this.onceDates || {}))
            this.settings.setValue("once-dates", built.dates);

        GLib.mkdir_with_parents(this.configDir, 0o755);
        GLib.file_set_contents(this.configDir + "/config.json",
                               JSON.stringify(config, null, 2) + "\n");
        this.runCore(["apply"], out => {
            if (out && out.errors && out.errors.length)
                Main.notify("Clockoo", _("systemd reported a problem") + ":\n" + out.errors.join("\n"));
            this.refreshStatus();
        });
    }

    refreshStatus() {
        this.runCore(["status"], out => {
            if (out) {
                this.status = out;
                // A one-time alarm that has just rung must turn off in the list.
                let expired = (this.buildConfig().expired || []).length;
                if (expired)
                    this.applyNow();
            }
            this.updateMenu();
        });
    }

    runCore(args, callback) {
        let argv = ["env", "CLOCKOO_PROFILE=applet", "python3", this.core, ...args];
        try {
            Util.spawnCommandLineAsyncIO(null, (stdout, stderr, exitCode) => {
                let out = null;
                if (exitCode === 0) {
                    try {
                        out = JSON.parse(stdout);
                    } catch (e) {
                        global.logError(UUID + ": bad output from clockoo_core.py: " + stdout);
                    }
                } else {
                    global.logError(UUID + ": clockoo_core.py " + args[0] + " failed: " + stderr);
                }
                if (callback)
                    callback(out);
            }, {argv: argv});
        } catch (e) {
            global.logError(UUID + ": " + e);
            if (callback)
                callback(null);
        }
    }

    // ------------------------------------------------------------ dependencies

    // Only packages from the distribution; nothing is ever downloaded.
    checkDependencies() {
        let missing = [];
        let have = name => !!GLib.find_program_in_path(name);
        if (!have("python3"))
            missing.push("python3");
        if (!have("pw-play") && !have("paplay"))
            missing.push(have("pipewire") ? "pipewire-bin" : "pulseaudio-utils");
        if (!have("spd-say") && !this.piperDir)
            missing.push("speech-dispatcher");
        this.missing = missing;
        if (have("python3")) {
            Util.spawnCommandLineAsyncIO(null, (_out, _err, exitCode) => {
                if (exitCode !== 0 && !this.missing.includes("gir1.2-notify-0.7"))
                    this.missing.push("python3-gi", "gir1.2-notify-0.7");
                this.updateMenu();
            }, {argv: ["python3", "-c",
                       "import gi; gi.require_version('Notify', '0.7'); from gi.repository import Notify"]});
        }
        this.updateMenu();
    }

    installDependencies() {
        let packages = this.missing.slice();
        if (!packages.length)
            return;
        if (GLib.find_program_in_path("apturl"))
            Util.spawn(["apturl", "apt://" + packages.join(",")]);
        else if (GLib.find_program_in_path("pkcon"))
            Util.spawn(["pkcon", "install", "-y", ...packages]);
        else if (GLib.find_program_in_path("pkexec") && GLib.find_program_in_path("apt-get"))
            Util.spawn(["pkexec", "apt-get", "install", "-y", ...packages]);
        else
            Main.notify("Clockoo", _("Please install with your package manager: %s").format(packages.join(" ")));
        this.menu.close();
        // Look again a little later, when the installation may be done.
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
            this.checkDependencies();
            return GLib.SOURCE_REMOVE;
        });
    }

    // ------------------------------------------------------------ applet events

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_removed_from_panel(deleteConfig) {
        // Removing the applet for good must silence it: drop all its timers.
        // A reload or an update (deleteConfig false) must not: the new
        // instance is already applying the same settings.
        if (deleteConfig)
            this.applyNow(true);
        for (let id of [this.applyTimeout, this.tickTimeout, this.statusTimeout])
            if (id)
                GLib.source_remove(id);
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new ClockooApplet(metadata, orientation, panelHeight, instanceId);
}
