/*
 *   World Clock Calendar applet calendar@simonwiles.net
 *   Fork of the Cinnamon calendar applet with support for displaying multiple timezones.
 *   version 1.2
 */

/* global imports, global */
/* exported _onVertSepRepaint, main */
"use strict";

const EXTENSION_UUID = "calendar@simonwiles.net";
const APPLET_DIR = imports.ui.appletManager.appletMeta[EXTENSION_UUID].path;
const Gettext = imports.gettext;
const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const UPowerGlib = imports.gi.UPowerGlib;
const Settings = imports.ui.settings;
const AppletDir = imports.ui.appletManager.applets[EXTENSION_UUID];
const Calendar = AppletDir.calendar;
const GLib = imports.gi.GLib;

let DEFAULT_FORMAT = _("%l:%M %p");

Gettext.bindtextdomain(EXTENSION_UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(EXTENSION_UUID, str);
}

function _onVertSepRepaint (area)
{
    let cr = area.get_context();
    let themeNode = area.get_theme_node();
    let [width, height] = area.get_surface_size();
    let stippleColor = themeNode.get_color("-stipple-color");
    let stippleWidth = themeNode.get_length("-stipple-width");
    let x = Math.floor(width/2) + 0.5;
    cr.moveTo(x, 0);
    cr.lineTo(x, height);
    Clutter.cairo_set_source_color(cr, stippleColor);
    cr.setDash([1, 3], 1); // Hard-code for now
    cr.setLineWidth(stippleWidth);
    cr.stroke();
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

            this._initContextMenu();
            this._initRightClickMenu();

            this._calendarArea = new St.BoxLayout({name: "calendarArea" });
            this.menu.addActor(this._calendarArea);

            // Fill up the first column

            let vbox = new St.BoxLayout({vertical: true});
            this._calendarArea.add(vbox);

            // Date
            this._date = new St.Label();
            this._date.style_class = "datemenu-date-label";
            vbox.add(this._date);

            this._eventSource = null;
            this._eventList = null;

            // Calendar
            this._calendar = new Calendar.Calendar(this.settings);
            vbox.add(this._calendar.actor);


            // World Clocks
            let separator = new PopupMenu.PopupSeparatorMenuItem();
            separator.setColumnWidths(1);
            vbox.add(separator.actor, {y_align: St.Align.END, expand: true, y_fill: false});

            let addWorldClocks = Lang.bind(this, function() {
                if (this._worldclocks_box) { this._worldclocks_box.destroy(); }
                this._worldclocks_box = new St.BoxLayout({vertical: true});
                // add to the calendarArea vbox instead of a new worldclocksArea so that the calendar resizes to the
                //  full width of the applet drop-down (in case the world clocks are very wide!)
                vbox.add(this._worldclocks_box);

                this._worldclocks = [];
                this._worldclock_labels = [];
                var i;
                for (i in this.worldclocks) {
                    if (typeof(this.worldclocks[i]) == 'string')
                        this._worldclocks[i] = this.worldclocks[i].split("|");
                }
                for (i in this._worldclocks) {
                    this._worldclocks[i][1] = GLib.TimeZone.new(this._worldclocks[i][1]);

                    let tz = new St.BoxLayout({vertical: false});
                    let tz_label = new St.Label({ style_class: "datemenu-date-label", text: _(this._worldclocks[i][0]) });
                    tz.add(tz_label, {x_align: St.Align.START, expand: true, x_fill: false});
                    this._worldclock_labels[i] = new St.Label({ style_class: "datemenu-date-label" });
                    tz.add(this._worldclock_labels[i], {x_align: St.Align.END, expand: true, x_fill: false});
                    this._worldclocks_box.add(tz);
                }
                this.max_length = this._worldclocks.reduce(function (a, b) { return a[0].length > b[0].length ? a : b; })[0].length;
            });

            // Track changes to clock settings
            this._dateFormat = DEFAULT_FORMAT;
            this._dateFormatFull = _("%A %B %e, %Y");

            this.settings.bindProperty(Settings.BindingDirection.IN, "use-custom-format", "use_custom_format", this.on_settings_changed, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "custom-format", "custom_format", this.on_settings_changed, null);

            // Track changes to world-clock settings
            this.settings.bindProperty(Settings.BindingDirection.IN, "worldclocks", "worldclocks", addWorldClocks, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "worldclocks-timeformat", "worldclocks_timeformat", addWorldClocks, null);

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new UPowerGlib.Client();
            try {
                this._upClient.connect("notify-resume", this._updateClockAndDate);
                this._upClient.connect("notify-resume", addWorldClocks);
            } catch (e) {
                this._upClient.connect("notify::resume", this._updateClockAndDate);
                this._upClient.connect("notify::resume", addWorldClocks);
            }

            // Start the clock
            this.on_settings_changed();
            addWorldClocks();
            this._updateClockAndDatePeriodic();
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    on_settings_changed: function() {
        if (this.use_custom_format) {
            this._dateFormat = this.custom_format;
        } else {
            this._dateFormat = DEFAULT_FORMAT;
        }
        this._updateClockAndDate();
    },

    on_custom_format_button_pressed: function() {
        Util.spawnCommandLine("xdg-open http://www.foragoodstrftime.com/");
    },

    _launch_dateandtime_settings: function() {
        this.menu.close();
        Util.spawnCommandLine("cinnamon-settings calendar");
    },

    _updateClockAndDate: function() {
        let displayDate = GLib.DateTime.new_now_local();
        let dateFormattedFull = displayDate.format(this._dateFormatFull);
        let label_string = displayDate.format(this._dateFormat);

        if (!label_string) {
            global.logError("Calendar applet: bad time format string - check your string.");
            label_string = "~CLOCK FORMAT ERROR~ " + displayDate.toLocaleFormat(DEFAULT_FORMAT);
        }
        this.set_applet_label(label_string);

        let tooltip = [];
        tooltip.push(dateFormattedFull);
        for (var i in this._worldclocks) {
            let tz = this._get_world_time(displayDate, this._worldclocks[i][1]);
            this._worldclock_labels[i].set_text(tz);
            tooltip.push(rpad(_(this._worldclocks[i][0]), "\xA0", this.max_length + 10) + tz);
        }
        this.set_applet_tooltip(tooltip.join("\n"));

        if (dateFormattedFull !== this._lastDateFormattedFull) {
            this._date.set_text(dateFormattedFull);
            this._lastDateFormattedFull = dateFormattedFull;
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

    _initContextMenu: function () {
        if (this._calendarArea) this._calendarArea.unparent();
        if (this.menu) this.menuManager.removeMenu(this.menu);

        this.menu = new Applet.AppletPopupMenu(this, this._orientation);
        this.menuManager.addMenu(this.menu);

        if (this._calendarArea){
            this.menu.addActor(this._calendarArea);
            this._calendarArea.show_all();
        }

        // Whenever the menu is opened, select today
        this.menu.connect("open-state-changed", Lang.bind(this, function(menu, isOpen) {
            if (isOpen) {
                let now = new Date();
                /* Passing true to setDate() forces events to be reloaded. We
                 * want this behavior, because
                 *
                 *   o It will cause activation of the calendar server which is
                 *     useful if it has crashed
                 *
                 *   o It will cause the calendar server to reload events which
                 *     is useful if dynamic updates are not supported or not
                 *     properly working
                 *
                 * Since this only happens when the menu is opened, the cost
                 * isn"t very big.
                 */
                this._calendar.setDate(now, true);
                // No need to update this._eventList as ::selected-date-changed
                // signal will fire
            }
        }));
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    },

    _get_world_time: function(time, tz) {
        return time.to_timezone(tz).format(this.worldclocks_timeformat).trim();
    },

    _launch_applet_config: function() {
        Util.spawn(["cinnamon-settings", "applets", EXTENSION_UUID]);
    },

    _launch_worldclocks_config: function() {
        Util.spawnCommandLine("/usr/bin/env python2 " + APPLET_DIR + "/world_clock_calendar_settings.py --instance-id " + this.instance_id);
    },

    _initRightClickMenu: function () {
        // this._applet_context_menu.addMenuItem(new Applet.MenuItem(
        //     _("Configure applet"), "system-run-symbolic", Lang.bind(this, this._launch_applet_config)));
        this._applet_context_menu.addMenuItem(new Applet.MenuItem(
            _("Edit World Clocks"), "system-run-symbolic", Lang.bind(this, this._launch_worldclocks_config)));
        this._applet_context_menu.addMenuItem(new Applet.MenuItem(
            _("Date and Time Settings"), "system-run-symbolic", Lang.bind(this, this._launch_dateandtime_settings)));
    },

};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
