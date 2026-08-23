/*
 * Lumendusk — Cinnamon panel applet.
 *
 * This is a thin JS shell for the panel: an icon + dropdown menu. The actual
 * work (deciding day/night, switching theme, night light, brightness) is done
 * by the Python engine, which this applet calls via its CLI.
 *
 * Settings (right-click → Configure) are defined in settings-schema.json.
 * Cinnamon stores those in its own per-instance JSON, but the engine's source
 * of truth is ~/.config/lumendusk/config.toml — so the panel is kept as a view
 * onto that file: we seed it from `lumendusk config show` on startup, and write
 * every change back with `lumendusk config set`. Nothing here parses TOML.
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const Mainloop = imports.mainloop;

const UUID = "lumendusk@kasun";

// Spices installs compiled catalogs under the user's data directory; a system
// package would land in /usr/share/locale, which gettext already searches.
// get_user_data_dir() rather than ~/.local/share: it is the same path unless
// XDG_DATA_HOME says otherwise, and Cinnamon itself installs the catalog
// through that variable, so hardcoding would look in the wrong place on
// exactly the machines that set it.
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

// Where the engine might be, best first. install.sh builds a venv so we don't
// touch the system Python, but that is not the only way it gets installed — a
// plain `pip install --user lumendusk`, a distro package, or a dev checkout all
// put it somewhere else, and an applet that only knows one path calls those
// "not installed".
//
// PATH is checked last rather than first: the panel inherits the session's PATH
// from login, which on Mint often predates ~/.local/bin being on it, so a hit
// there is a bonus rather than something to rely on.
const ENGINE_CANDIDATES = [
    GLib.get_user_data_dir() + "/lumendusk/venv/bin/lumendusk",
    GLib.get_home_dir() + "/.local/bin/lumendusk",
    "/usr/local/bin/lumendusk",
    "/usr/bin/lumendusk",
];

// The applet's own directory, from metadata.path. Set on init, because the
// engine may be bundled inside it (see below).
let _appletDir = null;
let _engineArgv = null;

function findEngineArgv() {
    // Returns the command to run the engine as an argv array, or null if there
    // isn't one. An array rather than a path because the bundled copy is run as
    // `python3 <dir>/engine/run.py`, not as an executable of its own.
    //
    // Cached once found, re-checked while missing: installing the engine with
    // the applet already sitting in the panel should start working on the next
    // menu open, not require a Cinnamon restart. A path that has resolved can't
    // move without a reinstall, so caching that direction is safe.
    if (_engineArgv !== null) return _engineArgv;

    for (let i = 0; i < ENGINE_CANDIDATES.length; i++) {
        if (GLib.file_test(ENGINE_CANDIDATES[i], GLib.FileTest.IS_EXECUTABLE)) {
            _engineArgv = [ENGINE_CANDIDATES[i]];
            return _engineArgv;
        }
    }

    let onPath = GLib.find_program_in_path("lumendusk");
    if (onPath) {
        _engineArgv = [onPath];
        return _engineArgv;
    }

    // Last resort: the copy bundled inside the applet directory. Installing
    // from Cinnamon Spices extracts a zip and runs nothing — no venv, no pip —
    // so for a Spices user this is the only engine on the machine.
    //
    // It goes last so that a real install still wins. Someone with a dev
    // checkout or a pip install wants their edits to take effect, not a frozen
    // copy shipped inside the applet.
    if (_appletDir) {
        let bundled = _appletDir + "/engine/run.py";
        let python = GLib.find_program_in_path("python3");
        if (python && GLib.file_test(bundled, GLib.FileTest.EXISTS)) {
            _engineArgv = [python, bundled];
            return _engineArgv;
        }
    }
    return null;
}

// Settings we mirror into config.toml. Names match the engine's config keys
// exactly, which is what lets the sync below stay generic.
const SYNCED_KEYS = [
    "control", "mode", "latitude", "longitude", "dark_start", "light_start",
    "theme_day", "theme_night",
    "nightlight_enabled", "nightlight_temperature",
    "brightness_enabled", "brightness_day", "brightness_night",
];

function keepOpen(item) {
    // Cinnamon closes the menu whenever a menu item is activated — popupMenu.js
    // hands `keepMenu = false` to activate() on button release. That's right for
    // an item that does its one thing and is finished (Settings, Open config
    // file), and wrong for the items this wraps, which the menu is also
    // *showing the state of*: clicking Manual is what reveals Light/Dark, so
    // closing at that moment hides the controls the click just unlocked, and
    // choosing an appearance gives you no chance to see the dot move or change
    // your mind.
    //
    // PopupSwitchMenuItem already opts out this way (which is why the night
    // light switch behaves); this gives plain items the same treatment.
    item.activate = function (event) {
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this, event, true);
    };
    return item;
}

function LumenduskApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

LumenduskApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        // Where this applet was installed. Cinnamon sets meta.path to the
        // applet's own directory, which is how the bundled engine is located
        // (see findEngineArgv) — the same trick printers@cinnamon.org uses to
        // reach its Python helpers.
        if (metadata && metadata.path) _appletDir = metadata.path;

        this.set_applet_icon_symbolic_name("weather-clear-night");
        this.set_applet_tooltip(_("Lumendusk — auto theme, night light & brightness"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Refresh state each time the menu opens, in case it was changed from
        // the CLI, another instance, or Cinnamon's own settings.
        this.menu.connect("open-state-changed", (menu, open) => {
            if (!open) return;
            this._refreshModeItems();
            this._refreshBrightness();
        });

        this._brightnessDebounce = 0;
        this._pushDebounce = 0;
        // Last text read from config.toml. Loaded asynchronously, so the very
        // first paint uses the defaults and is corrected a moment later —
        // _buildMenu ends with the refresh that primes it.
        this._configText = "";
        // Guards the slider's value-changed handler while we're setting the
        // slider ourselves — otherwise syncing the real value straight back to
        // the engine would re-apply it (and fight the user mid-drag).
        this._syncingSlider = false;
        // Same guard for the night light switch, which we set from the engine's
        // real state on every menu open.
        this._syncingNightlight = false;
        this._buildMenu();
        this._initSettings(metadata, instanceId);
    },

    // ---- settings panel <-> config.toml -------------------------------------

    _initSettings: function (metadata, instanceId) {
        // Guards the write-back while we're loading values *from* the engine,
        // so seeding the panel doesn't immediately write them all back out.
        this._loadingSettings = true;
        // What we believe the engine already has, so a settings-changed signal
        // only writes the keys that actually moved.
        this._pushed = {};
        // Which keys have a write out with the engine right now — see
        // _pushSettings.
        this._inflight = {};

        let uuid = (metadata && metadata.uuid) || "lumendusk@kasun";
        try {
            this.settings = new Settings.AppletSettings(this, uuid, instanceId);
        } catch (e) {
            global.logError("Lumendusk: could not open applet settings: " + e);
            this._loadingSettings = false;
            return;
        }

        for (let i = 0; i < SYNCED_KEYS.length; i++) {
            let key = SYNCED_KEYS[i];
            // Bound to this.cfg_<key>. The callback fires per-key on older
            // Cinnamon versions; "settings-changed" covers the newer ones. Both
            // land in the same place, and _pushSettings only writes real diffs,
            // so being called twice is harmless.
            this.settings.bind(key, "cfg_" + key, () => this._onSettingsChanged());
        }
        try {
            this.settings.connect("settings-changed",
                                  () => this._onSettingsChanged());
        } catch (e) {
            // Older Cinnamon without the signal — the per-key binds above carry it.
        }

        this._pullSettings();
    },

    _onSettingsChanged: function () {
        if (this._loadingSettings) return;
        // Coalesce. The warmth and brightness controls are sliders, and Cinnamon
        // reports every value they pass on the way to where the user let go —
        // one write and one apply each. That was harmless while the values only
        // went into a file; now that they reach the screen, a drag would queue
        // dozens of them and the last one would land seconds after the mouse
        // stopped. Same reason as the menu slider's debounce, and long enough
        // that a drag settles inside it while a click still feels immediate.
        if (this._pushDebounce) {
            Mainloop.source_remove(this._pushDebounce);
        }
        this._pushDebounce = Mainloop.timeout_add(400, () => {
            this._pushDebounce = 0;
            this._pushSettings();
            return GLib.SOURCE_REMOVE;
        });
    },

    _pullSettings: function () {
        // Seed the panel from config.toml, which is what the engine actually
        // reads. Without this the panel would show schema defaults and the
        // first edit would quietly overwrite the user's real settings.
        this._runEngineAsync(["config", "show"], (stdout) => {
            if (stdout === null) {
                this._loadingSettings = false;
                return;
            }
            this._loadingSettings = true;
            try {
                let values = this._parseKeyValues(stdout);
                for (let key in values) {
                    if (SYNCED_KEYS.indexOf(key) === -1) continue;
                    let value = values[key];
                    this._pushed[key] = value;
                    try {
                        this.settings.setValue(key, value);
                    } catch (e) {
                        global.logError("Lumendusk: could not set '" + key + "': " + e);
                    }
                }
            } finally {
                this._loadingSettings = false;
            }
            this._refreshModeItems();
        });
    },

    _pushSettings: function () {
        // Write back only what changed — one `config set` per edited key. The
        // engine validates; a rejected value is logged and the panel is
        // resynced so it can't keep showing something that was never stored.
        if (!this.settings) return;
        let rejected = false;
        for (let i = 0; i < SYNCED_KEYS.length; i++) {
            let key = SYNCED_KEYS[i];
            let value = this["cfg_" + key];
            if (value === undefined) continue;
            if (this._pushed[key] === value) continue;
            // One write per key at a time, newest value wins. A brightness
            // write goes out over DDC/CI and takes a second or two, so a slider
            // dragged across several stops would otherwise queue them all and
            // replay them one by one on the monitor long after the mouse
            // stopped. Leaving _pushed alone keeps this key looking changed, so
            // the re-run below picks up wherever the slider ended up rather
            // than the value that was current when we skipped.
            if (this._inflight[key]) {
                this._inflight[key] = "again";
                continue;
            }
            this._pushed[key] = value;
            this._inflight[key] = true;
            let text = (typeof value === "boolean")
                ? (value ? "true" : "false") : String(value);
            // `control` gets its own command rather than `config set`, so that
            // changing it in the dialog takes effect at once — same reason as
            // _setControl().
            //
            // Everything else is stored with `--apply`, which shows the change
            // now if it affects the phase we're currently in. Without it the
            // dialog writes the file and the screen sits unchanged until the
            // next tick, which reads as a control that doesn't work. The engine
            // decides what "affects" means: dragging the *day* brightness after
            // dark still changes nothing.
            let argv = (key === "control" && (text === "auto" || text === "manual"))
                ? [text] : ["config", "set", key, text, "--apply"];
            this._runEngineAsync(argv, (out, err) => {
                let again = this._inflight[key] === "again";
                this._inflight[key] = false;
                if (out !== null) {
                    // Both of these are on the menu's status line, so it has to
                    // be redrawn: control switches which items are shown, and
                    // the appearance mapping is how the phase is read back.
                    if (key === "control" || key === "theme_day" ||
                        key === "theme_night") {
                        this._refreshModeItems();
                    }
                    if (again) this._pushSettings();
                    return;
                }
                global.logError("Lumendusk: rejected " + key + "=" + text +
                                (err ? " (" + err.trim() + ")" : ""));
                if (!rejected) {
                    rejected = true;
                    this._pullSettings();
                }
            });
        }
    },

    onDetectLocation: function () {
        // settings-schema.json button callback.
        this._runEngineAsync(["location", "--detect"], (stdout, stderr) => {
            if (stdout === null) {
                global.logError("Lumendusk: location detection failed" +
                                (stderr ? ": " + stderr.trim() : ""));
                return;
            }
            // The engine wrote a location and switched to sun mode; pull it back
            // so the latitude/longitude fields show what was actually stored.
            this._pullSettings();
        });
    },

    _parseKeyValues: function (text) {
        // "key=value" per line, from `lumendusk config show`. Values are typed
        // to match the schema: Cinnamon stores what it's given, and handing a
        // spinbutton a string would break it.
        let out = {};
        let lines = (text || "").split("\n");
        for (let i = 0; i < lines.length; i++) {
            let split = lines[i].indexOf("=");
            if (split <= 0) continue;
            let key = lines[i].substring(0, split).trim();
            let raw = lines[i].substring(split + 1).trim();
            if (raw === "true" || raw === "false") {
                out[key] = (raw === "true");
            } else if (/^-?\d+$/.test(raw)) {
                out[key] = parseInt(raw, 10);
            } else if (/^-?\d*\.\d+$/.test(raw)) {
                out[key] = parseFloat(raw);
            } else {
                out[key] = raw;
            }
        }
        return out;
    },

    _buildMenu: function () {
        this.menu.removeAll();

        let title = new PopupMenu.PopupMenuItem("Lumendusk", { reactive: false });
        this.menu.addMenuItem(title);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Without the engine every menu item below is a no-op, which looks like
        // a broken applet. Say so instead of failing silently.
        if (!this._engineInstalled()) {
            let missing = new PopupMenu.PopupMenuItem(
                _("Engine not found — run install.sh"), { reactive: false });
            this.menu.addMenuItem(missing);
            // Name the first candidate only. The full list is four paths plus
            // PATH, which is a wall of text in a panel menu and answers a
            // question nobody asked; the log has all of it if it's really
            // installed somewhere unusual.
            let hint = new PopupMenu.PopupMenuItem(
                _("Looked in %s and on PATH").replace("%s", ENGINE_CANDIDATES[0]),
                { reactive: false });
            hint.actor.set_style("font-size: 8pt;");
            this.menu.addMenuItem(hint);
            this.set_applet_tooltip(_("Lumendusk — engine not installed"));
            return;
        }

        // Who is driving: Lumendusk, or the user. Radio dots rather than a
        // switch, because "Pause automation OFF" was a double negative nobody
        // should have to parse.
        this._autoItem = keepOpen(new PopupMenu.PopupMenuItem(_("Automatic")));
        this._autoItem.connect("activate", () => this._setControl("auto"));
        this.menu.addMenuItem(this._autoItem);

        this._manualItem = keepOpen(new PopupMenu.PopupMenuItem(_("Manual")));
        this._manualItem.connect("activate", () => this._setControl("manual"));
        this.menu.addMenuItem(this._manualItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Hidden in Automatic. Offering a dark/light choice while the schedule
        // is running invites the obvious question — does this stick? — and the
        // honest answer is "no, until the next transition". Better not to ask
        // it: if you want to choose, you're in Manual.
        this._manualSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._manualSection);

        this._lightItem = keepOpen(new PopupMenu.PopupMenuItem(_("Light")));
        this._lightItem.connect("activate", () => this._setAppearance("light"));
        this._manualSection.addMenuItem(this._lightItem);

        this._darkItem = keepOpen(new PopupMenu.PopupMenuItem(_("Dark")));
        this._darkItem.connect("activate", () => this._setAppearance("dark"));
        this._manualSection.addMenuItem(this._darkItem);

        // The live warm-tint switch, not the config key of the same name: in
        // Manual nothing schedules night light, so this is the only way to get
        // it. Colour temperature stays in Settings.
        this._nightlightSwitch = new PopupMenu.PopupSwitchMenuItem(_("Night light"), false);
        this._nightlightSwitch.connect("toggled", (item, value) => {
            if (this._syncingNightlight) return;
            this._runEngine(["nightlight", value ? "on" : "off"]);
        });
        this._manualSection.addMenuItem(this._nightlightSwitch);

        // Shown in Automatic in place of the controls above: what it's doing
        // and why, so the menu isn't just two radio buttons and a slider.
        this._statusItem = new PopupMenu.PopupMenuItem("", { reactive: false });
        this._statusItem.actor.set_style("font-size: 8pt;");
        this.menu.addMenuItem(this._statusItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Brightness (all monitors) slider.
        let bLabel = new PopupMenu.PopupMenuItem(_("Brightness (all monitors)"), { reactive: false });
        this.menu.addMenuItem(bLabel);
        this._brightnessSlider = new PopupMenu.PopupSliderMenuItem(0.8);
        this._brightnessSlider.connect("value-changed", (slider, value) =>
            this._onBrightnessChanged(value));
        this.menu.addMenuItem(this._brightnessSlider);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Apply the correct phase right now (theme + night light + brightness).
        // Hidden in Manual, where the engine would refuse anyway — a menu item
        // that does nothing is worse than one that isn't there.
        this._applyNow = new PopupMenu.PopupIconMenuItem(
            _("Apply day/night now"), "view-refresh-symbolic", imports.gi.St.IconType.SYMBOLIC);
        this._applyNow.connect("activate", () => this._runEngine(["--once"]));
        this.menu.addMenuItem(this._applyNow);

        let settings = new PopupMenu.PopupIconMenuItem(
            _("Settings…"), "preferences-system-symbolic", imports.gi.St.IconType.SYMBOLIC);
        settings.connect("activate", () => this.configureApplet());
        this.menu.addMenuItem(settings);

        let configFile = new PopupMenu.PopupIconMenuItem(
            _("Open config file"), "document-edit-symbolic", imports.gi.St.IconType.SYMBOLIC);
        configFile.connect("activate", () => this._openConfig());
        this.menu.addMenuItem(configFile);

        this._refreshModeItems();
    },

    _setControl: function (control) {
        // `auto`/`manual` write the config *and* act on it (night light off, or
        // snap to the current phase) — `config set control …` would only write,
        // leaving the screen unchanged for up to a tick after a click.
        this._runEngineAsync([control], () => {
            this._refreshModeItems();
            this._pullSettings();   // keep the settings dialog in step
        });
    },

    _setAppearance: function (which) {
        this._runEngineAsync(["appearance", which], () => this._refreshModeItems());
    },

    _refreshModeItems: function () {
        // Read from config/gsettings rather than tracking state here: the CLI,
        // the settings dialog and another panel instance can all change this.
        //
        // The read is asynchronous, so this is a two-parter: pull the file,
        // then draw. Every caller is a "redraw the menu now" point and four of
        // the six are already inside async callbacks, so doing the reload here
        // rather than at each call site keeps it to one place.
        if (!this._autoItem) return;
        this._loadConfigAsync(() => this._drawModeItems());
    },

    _drawModeItems: function () {
        // The applet can be removed from the panel while a load is in flight.
        if (!this._autoItem) return;
        let auto = this._readControl() === "auto";
        let dark = this._readDark();
        this._autoItem.setShowDot(auto);
        this._manualItem.setShowDot(!auto);
        this._lightItem.setShowDot(!dark);
        this._darkItem.setShowDot(dark);

        this._manualSection.actor.visible = !auto;
        this._statusItem.actor.visible = auto;
        if (this._applyNow) this._applyNow.actor.visible = auto;

        if (auto) {
            this.set_applet_tooltip(this._readMode() === "sun"
                ? _("Lumendusk — automatic (sunrise and sunset)")
                : _("Lumendusk — automatic (fixed times)"));
            let night = this._phaseFromAppearance(dark);
            if (night === null) this._refreshPhase();   // async; sets the label
            else this._setStatusText(night);
        } else {
            this.set_applet_tooltip(dark
                ? _("Lumendusk — manual (dark)")
                : _("Lumendusk — manual (light)"));
            this._refreshNightlight();
        }
    },

    _phaseFromAppearance: function (dark) {
        // The status line reports the *phase*, which stopped being the same
        // thing as the appearance once day and night each got their own
        // light/dark setting — with "daytime appearance: dark" the desktop is
        // dark at noon, and calling that night would be a lie.
        //
        // While the two phases wear different appearances the shell theme still
        // tells us the phase for free, just read backwards through the mapping.
        // When they wear the same one it tells us nothing at all: null, and the
        // caller asks the engine instead.
        let day = this.cfg_theme_day || "light";
        let night = this.cfg_theme_night || "dark";
        if (day === night) return null;
        return (dark ? "dark" : "light") === night;
    },

    _refreshPhase: function () {
        // Costs a subprocess, so it's only the fallback: sun mode works off the
        // solar elevation, which the panel has no business recomputing.
        this._runEngineAsync(["status"], (stdout) => {
            if (stdout === null || !this._statusItem) return;
            let match = /\bphase=(\w+)/.exec(stdout);
            if (match) this._setStatusText(match[1] === "night");
        });
    },

    _setStatusText: function (night) {
        // Whole phrases rather than assembled fragments. Building
        // "Following " + source + " · " + phase reads fine in English and is
        // untranslatable everywhere else: word order moves, and some languages
        // need a different separator. Four complete strings cost a translator
        // less than three fragments they cannot see the shape of.
        if (!this._statusItem) return;
        if (this._readMode() === "sun") {
            this._statusItem.label.text = night
                ? _("Following sunrise and sunset · night")
                : _("Following sunrise and sunset · day");
        } else {
            this._statusItem.label.text = night
                ? _("Following fixed times · night")
                : _("Following fixed times · day");
        }
    },

    _refreshNightlight: function () {
        // gsettings shells out, so read it off the main thread. Guarded, or
        // setting the switch to the real value would echo back as a user toggle.
        this._runEngineAsync(["nightlight", "status"], (stdout) => {
            if (stdout === null || !this._nightlightSwitch) return;
            this._syncingNightlight = true;
            try {
                this._nightlightSwitch.setToggleState(stdout.trim() === "on");
            } finally {
                this._syncingNightlight = false;
            }
        });
    },

    _onBrightnessChanged: function (value) {
        if (this._syncingSlider) return;   // we set it, don't echo it back
        // DDC/CI is slow — debounce so dragging the slider doesn't spam writes.
        let percent = Math.round(value * 100);
        if (this._brightnessDebounce) {
            Mainloop.source_remove(this._brightnessDebounce);
        }
        this._brightnessDebounce = Mainloop.timeout_add(200, () => {
            this._brightnessDebounce = 0;
            this._runEngine(["brightness", "set", percent]);
            return GLib.SOURCE_REMOVE;
        });
    },

    _refreshBrightness: function () {
        // Show what the monitors are actually at, rather than a hardcoded
        // guess — otherwise the first touch of the slider jumps them to it.
        // Read asynchronously: ddcutil takes a few hundred ms per monitor and
        // this runs on the compositor's thread.
        if (!this._brightnessSlider) return;
        this._runEngineAsync(["brightness", "get"], (stdout) => {
            if (stdout === null) return;
            let percent = this._firstPercent(stdout);
            if (percent === null) return;
            this._syncingSlider = true;
            try {
                this._brightnessSlider.setValue(percent / 100);
            } finally {
                this._syncingSlider = false;
            }
        });
    },

    _runEngineAsync: function (argv, callback) {
        // Runs the engine off the compositor thread and hands stdout back.
        // stdout is null when it couldn't run or exited non-zero; stderr comes
        // along so callers can report why. Never blocks the panel.
        let base = findEngineArgv();
        if (base === null) {
            callback(null, "engine not installed");
            return;
        }
        try {
            let proc = new Gio.Subprocess({
                argv: base.concat(argv),
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });
            proc.init(null);
            proc.communicate_utf8_async(null, null, (source, result) => {
                try {
                    let [, stdout, stderr] = source.communicate_utf8_finish(result);
                    callback(source.get_successful() ? stdout : null, stderr);
                } catch (e) {
                    global.logError("Lumendusk: '" + argv.join(" ") + "' failed: " + e);
                    callback(null, "" + e);
                }
            });
        } catch (e) {
            global.logError("Lumendusk: could not run the engine: " + e);
            callback(null, "" + e);
        }
    },

    _firstPercent: function (text) {
        // Engine prints one line per monitor: "  ddc1: 33%" (or "?%" on error).
        let match = /(\d+)%/.exec(text || "");
        return match ? parseInt(match[1], 10) : null;
    },

    _engineInstalled: function () {
        return findEngineArgv() !== null;
    },

    _runEngine: function (argv) {
        // argv is an array, like _runEngineAsync's, and every part of it is
        // quoted. spawnCommandLine takes a string, so this is the one place a
        // shell is involved at all — and the arguments it gets today are all
        // literals. Building the string by concatenation worked for exactly
        // that reason, which is a bad reason: the next argument to be added
        // here is as likely as not to be a theme name or a time out of the
        // settings dialog, and it would arrive unquoted with nothing to
        // notice.
        let base = findEngineArgv();
        if (base === null) {
            global.logError("Lumendusk: engine not found (looked in " +
                            ENGINE_CANDIDATES.join(", ") + ", on PATH, and in " +
                            (_appletDir || "the applet directory") +
                            "/engine) — run install.sh from the repo.");
            return;
        }
        let quoted = base.concat(argv).map((part) => GLib.shell_quote(String(part)));
        Util.spawnCommandLine(quoted.join(" "));
    },

    _loadConfigAsync: function (done) {
        // Off the main loop. The file is small and local, so a synchronous read
        // would almost always be quick — but "almost always" is doing the work
        // there: config.toml can sit on a network home directory, and a stalled
        // read on this thread freezes the whole shell, not just the applet.
        //
        // Failure is not an error worth reporting: on a fresh install the file
        // genuinely doesn't exist until the engine writes it. Empty text makes
        // the readers below return their defaults, which is what we want.
        let path = GLib.get_user_config_dir() + "/lumendusk/config.toml";
        try {
            Gio.File.new_for_path(path).load_contents_async(null, (file, result) => {
                try {
                    let [ok, data] = file.load_contents_finish(result);
                    this._configText = (ok && data)
                        ? ((data instanceof Uint8Array)
                            ? imports.byteArray.toString(data)
                            : ("" + data))
                        : "";
                } catch (e) {
                    this._configText = "";
                }
                if (done) done();
            });
        } catch (e) {
            this._configText = "";
            if (done) done();
        }
    },

    _readConfigText: function () {
        // Whatever the last load put there. Primed at startup and refreshed
        // before every redraw, so it is never more than one menu-open stale.
        return this._configText || "";
    },

    _readControl: function () {
        // Default to "auto" only when the file says so or is unreadable on a
        // fresh install; anything unrecognised is treated as manual, matching
        // the engine, so the two can't disagree about who is in charge.
        let match = /^\s*control\s*=\s*"([^"]*)"/m.exec(this._readConfigText());
        if (!match) return "auto";
        return match[1] === "manual" ? "manual" : "auto";
    },

    _readMode: function () {
        let match = /^\s*mode\s*=\s*"([^"]*)"/m.exec(this._readConfigText());
        return match ? match[1] : "fixed";
    },

    _readDark: function () {
        // The Cinnamon shell theme name is the reliable "is it dark" signal.
        try {
            let s = new Gio.Settings({ schema_id: "org.cinnamon.theme" });
            return s.get_string("name").indexOf("-Dark") !== -1;
        } catch (e) {
            return false;
        }
    },

    _openConfig: function () {
        let path = GLib.get_user_config_dir() + "/lumendusk/config.toml";
        let open = () => Util.spawnCommandLine("xdg-open " + GLib.shell_quote(path));
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            open();
            return;
        }
        // First run: the engine writes the default config. Give it a moment
        // before handing the path to xdg-open, or we open nothing.
        this._runEngine(["--once"]);
        Mainloop.timeout_add(700, () => { open(); return GLib.SOURCE_REMOVE; });
    },

    on_applet_clicked: function () {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function () {
        if (this._brightnessDebounce) {
            Mainloop.source_remove(this._brightnessDebounce);
            this._brightnessDebounce = 0;
        }
        if (this._pushDebounce) {
            Mainloop.source_remove(this._pushDebounce);
            this._pushDebounce = 0;
        }
        // Drops the file monitor Cinnamon keeps on the settings file.
        if (this.settings) {
            this.settings.finalize();
            this.settings = null;
        }
    },
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new LumenduskApplet(metadata, orientation, panelHeight, instanceId);
}
