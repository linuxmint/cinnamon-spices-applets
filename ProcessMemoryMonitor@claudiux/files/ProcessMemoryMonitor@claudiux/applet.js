/**
 * Process Memory Monitor (applet)
 * Author: @claudiux on Github.
 * Thanks to: @mtwebster on Github.
 **/
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const Settings = imports.ui.settings;
const Clutter = imports.gi.Clutter;
const ByteArray = imports.byteArray;
const St = imports.gi.St;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const Tooltips = imports.ui.tooltips;
const appSystem = imports.gi.Cinnamon.AppSystem.get_default();
const Pango = imports.gi.Pango;


const UUID = "ProcessMemoryMonitor@claudiux";
const HOME_DIR = GLib.get_home_dir();
const APPLET_DIR = `${HOME_DIR}/.local/share/cinnamon/applets/${UUID}`;
const GET_MEM_SCRIPT = `${APPLET_DIR}/scripts/get-mem.sh`;

// In milliseconds:
var REFRESH_RATE = 1000; // 1 second by default.
const MIN_REFRESH_RATE = 1000; // 1 second min.
const MAX_REFRESH_RATE = 10000; // 10 seconds max.
const STEP = 500; // 0.5 second.

const FLAT_RANGE = 5; // (+/- xx kb/min)


const MB = 2 ** 20; //1048576;
const KB = 2 ** 10; //1024;
const MINUTE = 60000;

const {
    timeout_add,
    setTimeout,
    clearTimeout,
    source_remove,
    remove_all_sources
} = require("./lib/mainloopTools");

Gettext.bindtextdomain(UUID, `${HOME_DIR}/.local/share/locale`);

function _(str) {
    let customTranslation = Gettext.dgettext(UUID, str);
    if (customTranslation != str) {
        return customTranslation;
    }
    return Gettext.gettext(str);
}

const STR_CLICK = _("Click to reset or reconnect to the process");
const STR_SEP = "─".repeat(STR_CLICK.length) + "\n";

const translations = {
    "Variation:": _("Variation:"),
    "Process:": _("Process:"),
    "PID:": _("PID:"),
    "Elapsed:": _("Elapsed:"),
    "Start:": _("Start:"),
    "Diff:": _("Diff:"),
    "Max:": _("Max:"),
    "Value:": _("Value:"),
    "Min:": _("Min:"),
    "Refresh interval:": _("Refresh interval:")
}
var spaces = {
    "Variation:": 0,
    "Process:": 0,
    "PID:": 0,
    "Elapsed:": 0,
    "Start:": 0,
    "Diff:": 0,
    "Max:": 0,
    "Value:": 0,
    "Min:": 0,
    "Refresh interval:": 0
}
var maxLength = 0;
for (let [item, value] of Object.entries(translations)) {
    let l = value.length;
    if (l > maxLength)
        maxLength = l;
}
maxLength += 1;
for (let [item, value] of Object.entries(translations)) {
    spaces[item] = maxLength - value.length;
}


class ProcessMemoryMonitorApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.lastCurMb = 0;
        this.maxMb = 0;
        this.minMb = 2 ** 40;

        this.process_display_name = "Cinnamon";
        this.pid = global.get_pid();

        this.pulse_timer_id = null;
        this.isRunning = false;

        this.settings = new Settings.AppletSettings(this, UUID, instance_id);

        this.settings.bind("process-name", "process_name");
        this.get_pid_for_process_name(this.process_name);

        this.settings.bind("refresh-rate", "refresh_rate", () => { this.on_refresh_rate_changed() });
        REFRESH_RATE = this.refresh_rate;

        this.settings.bind("char-max", "char_max", () => { this.on_chars_changed() });
        this.settings.bind("char-up", "char_up", () => { this.on_chars_changed() });
        this.settings.bind("char-flat", "char_flat", () => { this.on_chars_changed() });
        this.settings.bind("char-down", "char_down", () => { this.on_chars_changed() });
        this.settings.bind("char-min", "char_min", () => { this.on_chars_changed() });

        this.settings.bind("no-char-var", "no_char_var");

        this.settings.bind("abbrev-MiB", "abbrev_MiB", () => { this.on_abbrev_changed() });
        this.settings.bind("abbrev-kpm", "abbrev_kpm", () => { this.on_abbrev_changed() });

        this.settings.bind("style-customized-width", "width_is_customized", () => { this.on_style_changed() });
        this.settings.bind("style-font-weight", "font_weight", () => { this.on_style_changed() });
        this.settings.bind("style-font-family", "font_family", () => { this.on_style_changed() });
        this.settings.bind("style-font-size", "font_size", () => { this.on_style_changed() });
        this.settings.bind("style-label-width", "label_width", () => { this.on_style_changed() });

        this._orientation = orientation;
        this.initialTime = new Date();
    }

    on_style_changed() {
        this._applet_label.set_x_align(Clutter.ActorAlign.CENTER);
        this._applet_label.set_x_expand(true);

        let test_string;

        if (this.pid.toString() == global.get_pid().toString()) {
            test_string = "88888.88 MiB ";
        } else {
            test_string = " " + this.process_name + ": 88888.88 MiB ";
        }

        this._applet_label.set_style(null);
        this._applet_label.set_style_class_name("applet-label");

        let style = `font-weight: ${this.font_weight}; font-family: ${this.font_family}; font-size: ${this.font_size}; align-content: center; padding: 2px;`;
        this.actor.set_style(style);
        this._applet_label.set_style(style);

        if (this.width_is_customized) {
            style = `font-weight: ${this.font_weight}; font-family: ${this.font_family}; font-size: ${this.font_size}; width: ${this.label_width}px; align-content: center; padding: 2px;`
            let actorWidth = this.label_width + 20;
            this.actor.natural_width = actorWidth;
            this._applet_label.set_style(style);
        } else {
            this.actor.natural_width = this.calculated_width(test_string);
            let l_width = Math.round(this.actor.natural_width / 5) * 5 - 20;
            if (l_width != this.label_width)
                this.label_width = l_width;
        }

    }

    calculated_width(str) {
        const COEFF = {
            "xx-small": 0.9,
            "x-small": 1.0,
            "small": 1.2,
            "medium": 1.4,
            "large": 1.8,
            "x-large": 2.5,
            "xx-large": 3.0,
            "monospace": 1.1,
            "serif": 1.1,
            "sans-serif": 1.0,
            "cursive": 1.0,
            "fantasy": 1.0,
            "normal": 1.0,
            "bold": 1.05
        }
        let label = new St.Label();
        let pango_layout = label.create_pango_layout(str);
        pango_layout.set_markup(str, str.length);
        let pango_font_desc = Pango.FontDescription.from_string(this.font_family);
        pango_layout.set_font_description(pango_font_desc);
        let ret = pango_layout.get_pixel_size()[0];
        ret = 20.0 + ret * COEFF[this.font_weight] * COEFF[this.font_family] * COEFF[this.font_size];
        pango_font_desc = null;
        pango_layout = null;
        label = null;
        return Math.round(ret * global.ui_scale);
    }

    on_abbrev_changed() {
        if (this.abbrev_MiB.length === 0)
            this.abbrev_MiB = _("MiB");
        if (this.abbrev_kpm.length === 0)
            this.abbrev_kpm = _("kiB/min");
        this.on_style_changed();
    }

    on_chars_changed() {
        if (this.char_max.length === 0)
            this.char_max = "🔺";
        if (this.char_up.length === 0)
            this.char_up = "↗️";
        if (this.char_flat.length === 0)
            this.char_flat = "➡️";
        if (this.char_down.length === 0)
            this.char_down = "↘️";
        if (this.char_min.length === 0)
            this.char_min = "🔻";
        this.on_style_changed();
    }

    set_default_pid_and_processname() {
        this.pid = global.get_pid();
        this.process_display_name = "Cinnamon";
        this.cinnamonMem = new CinnamonMemMonitor(this.pid);
    }

    get_pid_for_process_name(name) {
        if (name.length === 0 || name.toLowerCase() === "cinnamon") {
            this.set_default_pid_and_processname();
            return
        }

        if (!isNaN(name)) {
            if (GLib.file_test(`/proc/${name}`, GLib.FileTest.EXISTS)) {
                this.pid = Math.ceil(name);
                this.process_display_name = "" + name;
                this.cinnamonMem = new CinnamonMemMonitor(this.pid);
            } else {
                this.set_default_pid_and_processname();
            }
            return
        }

        let command = `${APPLET_DIR}/scripts/get-pid-from-process-name.sh ${name}`;
        let subProcess = Util.spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                if (stdout.length > 0) {
                    this.pid = Math.ceil(stdout);
                    this.process_display_name = "" + name;
                    this.cinnamonMem = new CinnamonMemMonitor(this.pid);
                } else {
                    this.set_default_pid_and_processname();
                }
            } else {
                this.set_default_pid_and_processname();
            }
            subProcess.send_signal(9);
        });
    }

    on_settings_changed() {
        if (this.process_name.length === 0) {
            this.pid = global.get_pid();
            this.process_display_name = "Cinnamon";
        } else
        if (!isNaN(parseInt(this.process_name))) {
            this.pid = parseInt(this.process_name);
            this.process_display_name = `${this.process_name}`;
        } else {
            this.get_pid_for_process_name(this.process_name);
        }

        this.cinnamonMem = new CinnamonMemMonitor(this.pid);

        this.on_style_changed();
    }

    on_reset_pressed() {
        this.process_name = "";
        this.on_settings_changed();
    }

    on_refresh_rate_changed() {
        this.stop_pulse();
        let old_refresh_rate = REFRESH_RATE;
        REFRESH_RATE = this.refresh_rate;
        setTimeout(() => {
                remove_all_sources();
                this.isRunning = true;
                this.pulse_timer_id = timeout_add(REFRESH_RATE, () => {
                    return this._pulse();
                });
                if (this.cinnamonMem)
                    this._pulse();
            },
            1000 + old_refresh_rate
        );
    }

    _pulse() {
        if (!this.isRunning) return false;
        this.cinnamonMem.update();
        let now = new Date();
        let elapsed = (now.getTime() - this.initialTime.getTime()) / MINUTE; // get elapsed minutes
        let delta = this.cinnamonMem.getDiffKb() / elapsed;
        let ttip;
        if (delta > FLAT_RANGE) {
            ttip = " ".repeat(spaces["Variation:"]) + translations["Variation:"] + " " + "+" + delta.toFixed(2) + " " + this.abbrev_kpm + "\n";
        } else if (delta < -FLAT_RANGE) {
            ttip = " ".repeat(spaces["Variation:"]) + translations["Variation:"] + " " + delta.toFixed(2) + " " + this.abbrev_kpm + "\n";
        } else {
            ttip = " ".repeat(spaces["Variation:"]) + translations["Variation:"] + " " + "0.00" + " " + this.abbrev_kpm + "\n";
        }
        ttip += STR_SEP;
        ttip += " ".repeat(spaces["Process:"]) + translations["Process:"] + " " + this.process_display_name + "\n";
        ttip += " ".repeat(spaces["PID:"]) + translations["PID:"] + " " + this.pid.toString() + "\n";
        let time = secondsToTime(elapsed * 60);
        ttip += " ".repeat(spaces["Elapsed:"]) + translations["Elapsed:"] + " " + time.h + ":" + time.m + ":" + time.s + "\n";
        ttip += STR_SEP;
        ttip += " ".repeat(spaces["Start:"]) + translations["Start:"] + " " + this.cinnamonMem.getStartMb().toFixed(2) + " " + this.abbrev_MiB + "\n";
        let diff = this.cinnamonMem.getDiffMb();
        if (diff >= 0)
            ttip += " ".repeat(spaces["Diff:"]) + translations["Diff:"] + " " + "+" + diff.toFixed(2) + " " + this.abbrev_MiB + "\n";
        else
            ttip += " ".repeat(spaces["Diff:"]) + translations["Diff:"] + " " + diff.toFixed(2) + " " + this.abbrev_MiB + "\n";

        let curMb = this.cinnamonMem.getCurMb();
        if (isNaN(curMb)) curMb = 0;
        ttip += " ".repeat(spaces["Max:"]) + translations["Max:"] + " " + this.cinnamonMem.getMaxMb().toFixed(2) + " " + this.abbrev_MiB + "\n";
        ttip += " ".repeat(spaces["Value:"]) + translations["Value:"] + " " + curMb.toFixed(2) + " " + this.abbrev_MiB + "\n";
        ttip += " ".repeat(spaces["Min:"]) + translations["Min:"] + " " + this.cinnamonMem.getMinMb().toFixed(2) + " " + this.abbrev_MiB + "\n";
        ttip += STR_SEP;
        ttip += " ".repeat(spaces["Refresh interval:"]) + translations["Refresh interval:"] + " " + REFRESH_RATE / 1000 + " s.\n";
        ttip += STR_SEP;
        ttip += STR_CLICK;


        let newCurMb = Math.ceil(100.0 * curMb);
        let diffMb = newCurMb - this.lastCurMb;

        let updown = "";

        if (!this.no_char_var) {
            if (diffMb > 0)
                updown = this.char_up;
            else if (diffMb < 0)
                updown = this.char_down;
            else
                updown = this.char_flat;

            if (this.maxMb < newCurMb) {
                this.maxMb = newCurMb;
                updown = this.char_max;
            }

            if (this.minMb > newCurMb) {
                this.minMb = newCurMb;
                updown = this.char_min;
            }
        }

        let label = "";
        this.set_applet_label(label);
        if (this.process_display_name == "Cinnamon") {
            label = updown + " " + curMb.toFixed(2) + " " + this.abbrev_MiB;
        } else {
            label = this.process_display_name + ": " + updown + " " + curMb.toFixed(2) + " " + this.abbrev_MiB;
        }

        this.lastCurMb = newCurMb;

        this.set_applet_label(label);
        this.set_applet_tooltip(ttip);

        return (this.isRunning && this.pulse_timer_id != null);
    }

    stop_pulse() {
        this.isRunning = false;
        if (this.pulse_timer_id != null) {
            source_remove(this.pulse_timer_id);
            this.pulse_timer_id = null;
        }
    }

    on_applet_added_to_panel() {
        if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
            this._applet_tooltip._tooltip.set_style('text-align: right; font-family: monospace;');
        } else {
            this._applet_tooltip._tooltip.set_style('text-align: left; font-family: monospace;');
        }

        this.get_pid_for_process_name(this.process_name);
        this.on_refresh_rate_changed();
        this.on_settings_changed();
        this.on_chars_changed();
        this.on_abbrev_changed();

        this.stop_pulse();
        this.pulse_timer_id = timeout_add(REFRESH_RATE, () => {
            return this._pulse()
        });
        this.isRunning = true;
    }

    on_applet_removed_from_panel(event) {
        this.stop_pulse();
        remove_all_sources();
    }

    on_applet_clicked(event) {
        this.lastCurMb = 0;
        this.maxMb = 0;
        this.minMb = 2 ** 40;
        this.initialTime = new Date();
        this.on_settings_changed();
    }

    on_orientation_changed(orientation) {
        this._orientation = orientation;
    }

    finalizeContextMenu() {
        // Add default context menus if we're in panel edit mode, ensure their removal if we're not
        let items = this._applet_context_menu._getMenuItems();

        if (this.context_menu_item_remove == null) {
            this.context_menu_item_remove = new PopupMenu.PopupIconMenuItem(_("Remove '%s'")
                .format(this._(this._meta.name)),
                "edit-delete",
                St.IconType.SYMBOLIC);
            this.context_menu_item_remove.connect('activate', (actor, event) => this.confirmRemoveApplet(event));
        }

        if (this.context_menu_item_about == null) {
            this.context_menu_item_about = new PopupMenu.PopupIconMenuItem(_("About..."),
                "dialog-question",
                St.IconType.SYMBOLIC);
            this.context_menu_item_about.connect('activate', () => {
                this.openAbout()
            });
        }

        if (this.context_menu_separator == null && this._applet_context_menu._getMenuItems().length > 0) {
            this.context_menu_separator = new PopupMenu.PopupSeparatorMenuItem();
            this._applet_context_menu.addMenuItem(this.context_menu_separator);
        }

        if (items.indexOf(this.context_menu_item_about) == -1) {
            this._applet_context_menu.addMenuItem(this.context_menu_item_about);
        }

        if (!this._meta["hide-configuration"] && GLib.file_test(this._meta["path"] + "/settings-schema.json", GLib.FileTest.EXISTS)) {
            if (this.context_menu_item_configure == null) {
                this.context_menu_item_configure = new PopupMenu.PopupIconMenuItem(_("Configure..."),
                    "system-run",
                    St.IconType.SYMBOLIC);
                this.context_menu_item_configure.connect('activate', () => {
                    this.configureApplet()
                });
            }
            if (items.indexOf(this.context_menu_item_configure) == -1) {
                this._applet_context_menu.addMenuItem(this.context_menu_item_configure);
            }
        }

        if (items.indexOf(this.context_menu_item_remove) == -1) {
            this._applet_context_menu.addMenuItem(this.context_menu_item_remove);
        }

        this.slider = new PopupMenu.PopupSliderMenuItem(REFRESH_RATE / MAX_REFRESH_RATE);
        this.slider_tooltip = new Tooltips.Tooltip(this.slider.actor, _("Refresh interval: %s seconds").format(this.slider._value * MAX_REFRESH_RATE / MIN_REFRESH_RATE));
        this.slider.connect('value-changed', () => this.onSliderValueChanged());
        this._applet_context_menu.addMenuItem(this.slider);

        if (this.context_menu_item_opensysmon == null) {
            this.context_menu_item_opensysmon = new PopupMenu.PopupIconMenuItem(_("Open System Monitor"),
                "utilities-system-monitor",
                St.IconType.SYMBOLIC);
            this.context_menu_item_opensysmon.connect('activate', () => {
                this._runSysMon()
            });
        }

        if (items.indexOf(this.context_menu_item_opensysmon) == -1) {
            this._applet_context_menu.addMenuItem(this.context_menu_item_opensysmon);
        }
    }

    onSliderValueChanged() {
        this.stop_pulse();
        var slider_value = 1.0 * this.slider._value;
        for (let i = 1; i <= MAX_REFRESH_RATE / STEP; i++) {
            if (Math.abs(slider_value * MAX_REFRESH_RATE - i * STEP) < STEP / 2) {
                slider_value = i * STEP / MAX_REFRESH_RATE;
                break
            }
        }
        this.slider._value = Math.max(slider_value, MIN_REFRESH_RATE / MAX_REFRESH_RATE);
        this.slider_tooltip.set_text(_("Refresh interval: %s seconds").format(this.slider._value * MAX_REFRESH_RATE / MIN_REFRESH_RATE));
        this.refresh_rate = this.slider._value * MAX_REFRESH_RATE;
        this.on_refresh_rate_changed();
    }

    _runSysMon() {
        let systemMonitoringCenter = appSystem.lookup_flatpak_app_id('io.github.hakandundar34coding.system-monitoring-center');
        if (systemMonitoringCenter) {
            systemMonitoringCenter.activate();
            return
        }
        systemMonitoringCenter = appSystem.lookup_app('io.github.hakandundar34coding.system-monitoring-center.desktop');
        if (systemMonitoringCenter) {
            systemMonitoringCenter.activate();
            return
        }
        let gnomeSystemMonitor = appSystem.lookup_app('gnome-system-monitor.desktop');
        if (gnomeSystemMonitor) {
            gnomeSystemMonitor.activate();
            return
        }
        gnomeSystemMonitor = appSystem.lookup_app('org.gnome.SystemMonitor.desktop');
        if (gnomeSystemMonitor) {
            gnomeSystemMonitor.activate();
        }
  }
}

class CinnamonMemMonitor {
    constructor(pid) {
        try {
            this.pid = pid;

            this.memCommand = `${GET_MEM_SCRIPT} ${this.pid}`;

            this.procMemResident = 0;
            Util.spawnCommandLineAsyncIO(this.memCommand, (stdout, stderr, exitCode) => {
                if (exitCode === 0) {
                    this.procMemResident = parseInt(stdout);
                    this.startMem = this.procMemResident;
                }
            });

            this.maxMem = 0;
            this.minMem = 2 ** 40;

            this.resetStats();
        } catch (e) {
            global.logError(e);
        }
    }

    update() {
        if (this.maxMem < this.procMemResident) {
            this.maxMem = this.procMemResident;
        }
        if (this.minMem > this.procMemResident && this.procMemResident != 0.0) {
            this.minMem = this.procMemResident;
        }
    }

    getCurMb() {
        Util.spawnCommandLineAsyncIO(this.memCommand, (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                this.procMemResident = parseInt(stdout);
                this.update();
            }
        });
        return this.procMemResident / KB;
    }

    getStartMb() {
        return this.startMem / KB;
    }

    getMaxMb() {
        return this.maxMem / KB;
    }

    getMinMb() {
        return this.minMem / KB;
    }

    getDiffMb() {
        return (this.procMemResident - this.startMem) / KB;
    }

    getDiffKb() {
        return (this.procMemResident - this.startMem);
    }

    resetStats() {
        this.update();
        this.startMem = this.procMemResident;
        this.maxMem = this.startMem;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ProcessMemoryMonitorApplet(metadata, orientation, panel_height, instance_id);
}


function secondsToTime(secs) {
    let hours = Math.floor(secs / (60 * 60));
    let divisor_for_minutes = secs % (60 * 60);
    let minutes = Math.floor(divisor_for_minutes / 60);

    let divisor_for_seconds = divisor_for_minutes % 60;
    let seconds = Math.floor(divisor_for_seconds);
    let obj = {
        "h": hours,
        "m": minutes < 10 ? "0" + minutes : minutes,
        "s": seconds < 10 ? "0" + seconds : seconds
    };
    return obj;
}
