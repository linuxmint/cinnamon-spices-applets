/*
 *   Timezone Clock applet tzclock@lhriley
 *   A simple clock for displaying the current time in a timezones.
 *   version 1.0
 */

/* global imports, global */
"use strict";

const EXTENSION_UUID = "tzclock@lhriley";
const APPLET_DIR = imports.ui.appletManager.appletMeta[EXTENSION_UUID].path;
const Gettext = imports.gettext;
const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const UPowerGlib = imports.gi.UPowerGlib;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

let DEFAULT_FORMAT = _("%l:%M %p %Z");

Gettext.bindtextdomain(EXTENSION_UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(EXTENSION_UUID, str);
}

function rpad(str, pad_with, length) {
    while (str.length < length) { str = str + pad_with; }
    return str;
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.settings = new Settings.AppletSettings(this, EXTENSION_UUID, this.instance_id);

            this.menuManager = new PopupMenu.PopupMenuManager(this);

            this._orientation = orientation;

            this._initRightClickMenu();

            // Track changes to clock settings
            this._dateFormat = DEFAULT_FORMAT;

            this.settings.bindProperty(Settings.BindingDirection.IN, "displayed-timezone", "displayed_timezone", this.on_settings_changed, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "clock-use-24h", "clock_use_24h", this.on_settings_changed, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "clock-show-date", "clock_show_date", this.on_settings_changed, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "clock-show-seconds", "clock_show_seconds", this.on_settings_changed, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "use-custom-format", "use_custom_format", this.on_settings_changed, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "custom-format", "custom_format", this.on_settings_changed, null);
            // this.settings.bindProperty(Settings.BindingDirection.IN, "keybinding", "keybinding", this._onKeySettingsUpdated, null);

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new UPowerGlib.Client();
            try {
                this._upClient.connect("notify-resume", this._updateClockAndDate);
            } catch (e) {
                this._upClient.connect("notify::resume", this._updateClockAndDate);
            }

            // Start the clock
            this.on_settings_changed();
            this._updateClockAndDatePeriodic();
        }
        catch (e) {
            global.logError(e);
        }
    },

    _onKeySettingsUpdated: function() {
        if (this.keybinding != null)
            Main.keybindingManager.addHotKey(EXTENSION_UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));

        this.on_applet_clicked;
    },

    on_applet_clicked: function() {
        // this.menu.toggle();
    },

    on_settings_changed: function() {
        this._updateFormatString();
        this._updateClockAndDate();
    },

    // reads system clock setting to apply "24h" and "seconds" setting to this applet
    _updateFormatString: function() {
        if (this.use_custom_format) {
            this._dateFormat = this.custom_format;
        } else {
            let use_24h = this.clock_use_24h;
            let show_date = this.clock_show_date;
            let show_seconds = this.clock_show_seconds;

            if (use_24h) {
                if (show_seconds) {
                    this._dateFormat = "%H:%M:%S %Z";
                } else {
                    this._dateFormat = "%H:%M %Z";
                }
            } else {
                if (show_seconds) {
                    this._dateFormat = "%l:%M:%S %p %Z";
                } else {
                    this._dateFormat = DEFAULT_FORMAT;
                }
            }

            if (show_date) {
                this._dateFormat = `%Y.%m.%d ${this._dateFormat}`
            }
        }
    },

    on_browse_timezones_button_pressed: function() {
        Util.spawnCommandLine("xdg-open http://timezonedb.com/time-zones");
    },

    on_custom_format_button_pressed: function() {
        Util.spawnCommandLine("xdg-open http://www.foragoodstrftime.com/");
    },

    _launch_dateandtime_settings: function() {
        this.menu.close();
        Util.spawnCommandLine("cinnamon-settings calendar");
    },

    _updateClockAndDate: function() {
        try {
            let timezone = GLib.TimeZone.new(this.displayed_timezone);
            let displayDate = this._get_world_time(GLib.DateTime.new_now_local(), timezone);
            let label_string = displayDate;

            if (!displayDate) {
                global.logError(`[${EXTENSION_UUID}] bad time format string - check your string: '${this._dateFormat}'`);
                label_string = "~CLOCK FORMAT ERROR~ " + displayDate.toLocaleFormat(DEFAULT_FORMAT);
            }
            this.set_applet_label(label_string);

            let tooltip = [];
            tooltip.push(displayDate);
            this.set_applet_tooltip(tooltip.join("\n"));

            if (displayDate !== this._lastDisplayDate) {
                this._lastDisplayDate = displayDate;
            }
        }
        catch (e) {
            global.logError(e);
        }
    },

    _updateClockAndDatePeriodic: function() {
        this._updateClockAndDate();
        this._periodicTimeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateClockAndDatePeriodic));
    },

    on_applet_removed_from_panel: function() {
        if (this._periodicTimeoutId){
            Mainloop.source_remove(this._periodicTimeoutId);
        }
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    },

    _get_world_time: function(time, tz) {
        return time.to_timezone(tz).format(this._dateFormat).trim();
    },

    _launch_applet_config: function() {
        Util.spawn(["cinnamon-settings", "applets", EXTENSION_UUID]);
    },

    _launch_tzclocks_config: function() {
        Util.spawnCommandLine("/usr/bin/env python3 " + APPLET_DIR + "/tzclock_settings.py --instance-id " + this.instance_id);
    },

    _initRightClickMenu: function () {
        // this._applet_context_menu.addMenuItem(new Applet.MenuItem(
        //     _("Configure applet"), "system-run-symbolic", Lang.bind(this, this._launch_applet_config)));
    },

};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
