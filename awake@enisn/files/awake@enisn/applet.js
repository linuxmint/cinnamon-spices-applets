// Awake Timer — keep the computer awake for N hours, then auto-restore.
//
// While active, screen blanking, screen lock, display sleep and idle suspend
// are all disabled. The user's original settings are snapshotted and restored
// automatically when the timer expires (or on demand).
//
// State is stored in ~/.cache/awake-override/state.json and a transient
// systemd user timer (awake-restore) runs the restore script even if Cinnamon
// crashes or is restarted. If the machine was powered off when the deadline
// passed, the applet restores on its next load.

const Applet = imports.ui.applet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;

const UUID = "awake@enisn";

const DIR = GLib.get_home_dir() + "/.cache/awake-override";
const STATE_FILE = DIR + "/state.json";
const RESTORE_FILE = DIR + "/restore.sh";
const TIMER_UNIT = "awake-restore";
const PRESETS = [1, 2, 3, 5, 8];
const MIN_HOURS = 0.1;
const MAX_HOURS = 24;
// Fallback "normal" values if an override is already active when we activate
// (i.e. live values are unreliable) and no saved snapshot exists.
const DEFAULTS = {
    idle_delay: 900,
    lock_enabled: true,
    sleep_display_ac: 1800,
    sleep_display_battery: 1800,
    sleep_inactive_ac_type: "suspend",
    sleep_inactive_battery_type: "suspend"
};

class AwakeApplet extends Applet.TextIconApplet {
    constructor(orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._sessionSettings = new Gio.Settings({ schema: "org.cinnamon.desktop.session" });
        this._screensaverSettings = new Gio.Settings({ schema: "org.cinnamon.desktop.screensaver" });
        this._powerSettings = new Gio.Settings({ schema: "org.cinnamon.settings-daemon.plugins.power" });

        this.set_applet_label("\u2615"); // coffee cup
        this.hide_applet_icon();
        this.set_applet_tooltip("Awake Timer");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._buildMenu();

        this._state = null;
        this._loadState();
        this._sync();

        this._tick = Mainloop.timeout_add_seconds(15, () => {
            this._onTick();
            return true; // GLib.SOURCE_CONTINUE
        });
    }

    _buildMenu() {
        this._statusItem = new PopupMenu.PopupMenuItem("Awake mode: off", { reactive: false });
        this._statusItem.label.style = "font-weight: bold;";
        this.menu.addMenuItem(this._statusItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        for (const h of PRESETS) {
            let item = new PopupMenu.PopupMenuItem(h + (h === 1 ? " hour" : " hours"));
            item.connect("activate", () => this.activate(h));
            this.menu.addMenuItem(item);
        }

        // Custom duration entry (press Enter to apply)
        let entry = new St.Entry({
            hint_text: "Custom hours (e.g. 1.5)",
            can_focus: true
        });
        entry.style = "padding: 6px 10px;";
        entry.connect("button-press-event", () => {
            entry.clutter_text.grab_key_focus();
        });
        entry.clutter_text.connect("activate", (text) => {
            let hours = parseFloat(text.text.replace(",", "."));
            if (!isNaN(hours) && hours >= MIN_HOURS && hours <= MAX_HOURS) {
                this.activate(hours);
                this.menu.close();
            } else {
                text.text = "";
            }
        });
        this.menu.addActor(entry);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._offItem = new PopupMenu.PopupMenuItem("Turn off now (restore settings)");
        this._offItem.connect("activate", () => this.restore());
        this.menu.addMenuItem(this._offItem);

        this.menu.connect("open-state-changed", (menu, open) => {
            if (open) this._sync();
        });
    }

    activate(hours) {
        let now = Math.floor(Date.now() / 1000);
        let deadline = now + Math.round(hours * 3600);
        // Keep the original snapshot if extending an active override
        let saved = this._state ? this._state.saved : this._readSaved();

        this._writeFiles(deadline, saved);
        this._restartTimer(deadline - now);

        this._sessionSettings.set_uint("idle-delay", 0);
        this._screensaverSettings.set_boolean("lock-enabled", false);
        this._powerSettings.set_int("sleep-display-ac", 0);
        this._powerSettings.set_int("sleep-display-battery", 0);
        this._powerSettings.set_string("sleep-inactive-ac-type", "nothing");
        this._powerSettings.set_string("sleep-inactive-battery-type", "nothing");

        this._state = { deadline: deadline, saved: saved };
        this._sync();
    }

    restore() {
        if (!this._state) {
            this._sync();
            return;
        }
        this._applySaved(this._state.saved);
        this._cleanupTimerAndFiles();
        this._state = null;
        this._sync();
    }

    _readSaved() {
        let idle = this._sessionSettings.get_uint("idle-delay");
        if (idle === 0) {
            // Already overridden by something else — defaults are the best guess
            return Object.assign({}, DEFAULTS);
        }
        return {
            idle_delay: idle,
            lock_enabled: this._screensaverSettings.get_boolean("lock-enabled"),
            sleep_display_ac: this._powerSettings.get_int("sleep-display-ac"),
            sleep_display_battery: this._powerSettings.get_int("sleep-display-battery"),
            sleep_inactive_ac_type: this._powerSettings.get_string("sleep-inactive-ac-type"),
            sleep_inactive_battery_type: this._powerSettings.get_string("sleep-inactive-battery-type")
        };
    }

    _applySaved(s) {
        s = s || DEFAULTS;
        this._sessionSettings.set_uint("idle-delay", s.idle_delay);
        this._screensaverSettings.set_boolean("lock-enabled", s.lock_enabled);
        this._powerSettings.set_int("sleep-display-ac", s.sleep_display_ac);
        this._powerSettings.set_int("sleep-display-battery", s.sleep_display_battery);
        this._powerSettings.set_string("sleep-inactive-ac-type", s.sleep_inactive_ac_type || DEFAULTS.sleep_inactive_ac_type);
        this._powerSettings.set_string("sleep-inactive-battery-type", s.sleep_inactive_battery_type || DEFAULTS.sleep_inactive_battery_type);
    }

    _writeFiles(deadline, saved) {
        GLib.mkdir_with_parents(DIR, 0o700);
        GLib.file_set_contents(STATE_FILE, JSON.stringify({ deadline: deadline, saved: saved }, null, 1));

        let acType = saved.sleep_inactive_ac_type || DEFAULTS.sleep_inactive_ac_type;
        let batteryType = saved.sleep_inactive_battery_type || DEFAULTS.sleep_inactive_battery_type;
        let script = [
            "#!/bin/bash",
            "gsettings set org.cinnamon.desktop.session idle-delay " + saved.idle_delay,
            "gsettings set org.cinnamon.desktop.screensaver lock-enabled " + saved.lock_enabled,
            "gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-ac " + saved.sleep_display_ac,
            "gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-battery " + saved.sleep_display_battery,
            "gsettings set org.cinnamon.settings-daemon.plugins.power sleep-inactive-ac-type '" + acType + "'",
            "gsettings set org.cinnamon.settings-daemon.plugins.power sleep-inactive-battery-type '" + batteryType + "'",
            "systemctl --user stop " + TIMER_UNIT + ".timer >/dev/null 2>&1 || true",
            "systemctl --user reset-failed " + TIMER_UNIT + ".service >/dev/null 2>&1 || true",
            "rm -rf '" + DIR + "'"
        ].join("\n") + "\n";
        GLib.file_set_contents(RESTORE_FILE, script);
        Util.spawn(["chmod", "+x", RESTORE_FILE]);
    }

    _restartTimer(seconds) {
        Util.spawn(["/bin/sh", "-c",
            "systemctl --user stop " + TIMER_UNIT + ".timer 2>/dev/null; " +
            "systemd-run --user --on-active=" + Math.max(60, Math.round(seconds)) + "s " +
            "--unit=" + TIMER_UNIT + " /bin/bash '" + RESTORE_FILE + "' >/dev/null 2>&1 || true"]);
    }

    _cleanupTimerAndFiles() {
        Util.spawn(["/bin/sh", "-c",
            "systemctl --user stop " + TIMER_UNIT + ".timer 2>/dev/null; " +
            "systemctl --user reset-failed " + TIMER_UNIT + ".service 2>/dev/null; " +
            "rm -rf '" + DIR + "'"]);
    }

    _loadState() {
        try {
            if (!GLib.file_test(STATE_FILE, GLib.FileTest.EXISTS)) return;
            let [ok, contents] = GLib.file_get_contents(STATE_FILE);
            if (!ok) return;
            let text = typeof contents === "string" ? contents : imports.byteArray.toString(contents);
            let state = JSON.parse(text);
            if (!state.deadline || !state.saved) return;

            let now = Math.floor(Date.now() / 1000);
            if (state.deadline <= now) {
                // Deadline passed while we weren't running — restore now
                this._applySaved(state.saved);
                this._cleanupTimerAndFiles();
            } else {
                this._state = state;
            }
        } catch (e) {
            log("[" + UUID + "] could not read state: " + e);
        }
    }

    _onTick() {
        if (this._state && Math.floor(Date.now() / 1000) >= this._state.deadline) {
            this.restore();
        } else {
            this._sync();
        }
    }

    _sync() {
        if (this._state) {
            let until = GLib.DateTime.new_from_unix_local(this._state.deadline).format("%H:%M");
            let remaining = this._state.deadline - Math.floor(Date.now() / 1000);
            this.set_applet_label("\u2615 " + this._formatRemaining(remaining));
            this.set_applet_tooltip("Awake until " + until + " — click to change");
            this._statusItem.label.text = "Awake until " + until;
            this._offItem.setSensitive(true);
        } else {
            this.set_applet_label("\u2615");
            this.set_applet_tooltip("Awake Timer — click to keep the computer awake");
            this._statusItem.label.text = "Awake mode: off";
            this._offItem.setSensitive(false);
        }
    }

    _formatRemaining(seconds) {
        if (seconds < 0) seconds = 0;
        let h = Math.floor(seconds / 3600);
        let m = Math.round((seconds % 3600) / 60);
        if (m === 60) { h += 1; m = 0; }
        if (h > 0) return h + ":" + (m < 10 ? "0" : "") + m;
        return m + "m";
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        // Keep any active override running — the systemd timer still restores it.
        if (this._tick) {
            Mainloop.source_remove(this._tick);
            this._tick = null;
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new AwakeApplet(orientation, panelHeight, instanceId);
}
