const UUID = "cinnamon-timer@jake1164";
const APPLET_PATH = imports.ui.appletManager.appletMeta[UUID].path;
imports.searchPath.push(APPLET_PATH);
const Lang = imports.lang;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const ModalDialog = imports.ui.modalDialog;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;
const MessageTray = imports.ui.messageTray;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

const SliderIntervals = [
    { min: 0, max: 300, step: 15 },
    { min: 300, max: 1800, step: 60 },
    { min: 1800, max: 10800, step: 600 },
    { min: 10800, max: 86400, step: 3600 }];

const Presets = [
    6 * 3600,
    4 * 3600,
    3 * 3600,
    2 * 3600,
    90 * 60,
    60 * 60,
    45 * 60,
    30 * 60,
    20 * 60,
    15 * 60,
    10 * 60,
    5 * 60,
    3 * 60,
    2 * 60,
    1 * 60,
    30,
    0];

function _(str) {
    return Gettext.dgettext(UUID, str);
}

Number.prototype.pad = function (size) {
    var s = String(this);
    while (s.length < (size || 2)) { s = "0" + s; }
    return s;
}

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            if (this.versionCompare(GLib.getenv('CINNAMON_VERSION'), "3.2") >= 0) {
                this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            }
            this._init_settings();
            this.on_orientation_changed(orientation);
            this.timerDuration = 0;
            this.timerStopped = true;
            this.alarmOn = false;
            this.state = false;

            this.menuManager = new PopupMenu.PopupMenuManager(this);

            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            this.set_applet_icon_symbolic_name("alarm");
            this.actor.add_style_class_name("timer");

            this.timerSwitch = new PopupMenu.PopupSwitchMenuItem(_("Timer"));
            this.timerSwitch.connect('toggled', Lang.bind(this, this.doTimerSwitch));
            this.menu.addMenuItem(this.timerSwitch);

            this.buildTimePresetMenu();

            this.timerMenuItem = new PopupMenu.PopupMenuItem(_("Minutes") + ": 0", { reactive: false });
            this.menu.addMenuItem(this.timerMenuItem);

            this._timerSlider = new PopupMenu.PopupSliderMenuItem(0);
            this._timerSlider.connect('value-changed', Lang.bind(this, this.sliderChanged));
            this._timerSlider.connect('drag-end', Lang.bind(this, this.sliderReleased));

            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            this.menu.addMenuItem(this._timerSlider);
            this.createContextMenu();

            // Check if the timer was running and we restarted
            if (this.getCurrentTime() < this.alarm_end) {
                this.timerStopped = false;
                this.doTick();
            }
            this.doUpdateUI();
        }
        catch (e) {
            global.logError(e);
        }
    },

    _init_settings: function (instance_id) {
        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "confirm-prompt-enable",
            "confirm_prompt_enable",
            this._on_settings_changed,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "sound-prompt-enable",
            "sound_prompt_enable",
            this._on_settings_changed,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "sound-file",
            "sound_file",
            this._on_settings_changed,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "message-prompt-enable",
            "message_prompt_enable",
            this._on_settings_changed,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "display-menu-enable",
            "display_menu_enable",
            this._on_settings_changed,
            null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "time_display_enable",
            "time_display_enable",
            this._on_settings_changed,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "display-message",
            "display_message",
            this._on_settings_changed,
            null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "alarm_start",
            "alarm_start",
            this._on_settings_changed,
            null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "alarm_end",
            "alarm_end",
            this._on_settings_changed,
            null);


        this._on_settings_changed();
    },
    _on_settings_changed: function () {
        // Settings have been changed, update the options.
        this.ConfirmPromptOn = this.settings.getValue("confirm-prompt-enable");
        this.SoundPromptOn = this.settings.getValue("sound-prompt-enable");
        this.MessagePromptOn = this.settings.getValue("message-prompt-enable");
        this.ShowMenuOn = this.settings.getValue("display-menu-enable");
        this.SoundPath = this.settings.getValue("sound-file");
        this.MessageStr = this.settings.getValue("display-message");
        this.on_orientation_changed(this._orientation);
    },
    on_applet_clicked: function (event) {
        if (this.timerStopped && this.alarmOn) {
            this.doClearAlarm();
        }

        this.menu.toggle();
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        if (this.versionCompare(GLib.getenv('CINNAMON_VERSION'), "3.2") >= 0) {
            if (this._orientation == St.Side.LEFT || this._orientation == St.Side.RIGHT) {
                // vertical
                this.isHorizontal = false;
                // No room in a vertical display to show the time label.
                this.time_display_enable = false;
            } else {
                // horizontal
                this.isHorizontal = true;
            }
        } else {
            this.isHorizontal = true;  // Do not check unless >= 3.2
        }
    },

    buildTimePresetMenu: function () {
        Presets.forEach(Lang.bind(this, function (preset) {
            let hr = Math.floor(preset / 3600);
            let min = Math.floor((preset % 3600) / 60);
            let sec = preset % 60;

            let hrText = (hr > 0 ? hr + " " + _("Hours") + " " : "");
            let minText = (min > 0 ? min + " " + _("Minutes") + " " : "");
            let secText = (sec > 0 ? sec + " " + _("Seconds") : "");

            let label = preset > 0 ? hrText + minText + secText : _("Reset");

            let item = new PopupMenu.PopupMenuItem(label);
            this.menu.addMenuItem(item);
            item.connect('activate', Lang.bind(this, this.doTimePreset, preset));
        }));
    },

    doTimePreset: function (a, b, c, duration) {
        this.timerDuration = duration;
        if (duration > 0) {
            this.doStartTimer();
        } else {
            this.doStopTimer();
        }
    },

    doTimerSwitch: function (item) {
        if (item.state) {
            if (this.timerDuration <= 0) {
                this.timerSwitch.setToggleState(false);
                return;
            }
            this.doStartTimer();
        } else {
            this.doStopTimer();

        }
    },

    doStartTimer: function () {
        if (this.timerDuration == 0) return;

        this.timerStopped = false;
        this.alarm_start = this.getCurrentTime();
        this.alarm_end = this.alarm_start + this.timerDuration * 1000;

        this.doTick();
        this.doUpdateUI();
    },

    getCurrentTime: function () {
        let d = new Date();
        let x = Math.floor(d.getTime());
        return x;
    },

    doStopTimer: function () {
        this.timerStopped = true;
        this.doUpdateUI();
    },

    doTick: function () {
        if (this.timerStopped) return;

        if (this.getCurrentTime() >= this.alarm_end) {
            this.doTimerExpired();
            return;
        }

        this.timerDuration = Math.max(0, Math.round((this.alarm_end - this.getCurrentTime()) / 1000));
        this.doUpdateUI();

        Mainloop.timeout_add_seconds(1, Lang.bind(this, this.doTick));
    },

    doUpdateUI: function () {
        this.timerSwitch.setToggleState(!this.timerStopped);

        if (this.state) this.actor.remove_style_class_name("timer-" + this.state);
        this.state = this.alarmOn ? "expired" : (this.timerStopped ? "stopped" : "running");
        this.actor.add_style_class_name("timer-" + this.state);

        let hr = Math.floor(this.timerDuration / 3600);
        let min = Math.floor((this.timerDuration % 3600) / 60);
        let sec = this.timerDuration % 60;

        this.timerMenuItem.label.text = hr + " " + _("Hours") + "," + " " + min.pad(2) + " " + _("Minutes") + " " + _("and") + " " + sec.pad(2) + " " + _("Seconds");
        let timeStr = hr + ":" + min.pad(2) + ":" + sec.pad(2);
        this.set_applet_tooltip(_("Timer") + ":" + " " + timeStr);

        if (this.time_display_enable) {
            if (this.timerStopped && this.timerDuration == 0)
                this.set_applet_label("");
            else
                this.set_applet_label(timeStr);
        } else {
            this.set_applet_label("");
        }
    },

    doTimerExpired: function () {
        this.timerDuration = 0;
        this.alarmOn = true;
        this.doStopTimer();
        this.set_applet_label(""); // remove label on panel

        if (this.ShowMenuOn) {
            this.menu.open();
        }
        if (this.SoundPromptOn) {
            try {
                Util.spawnCommandLine("play " + this.SoundPath);
            }
            catch (e) {
                global.logError(e);
            }
        }

        if (this.MessagePromptOn) {
            this.notifyMessage("Cinnamon Timer", this.MessageStr);
        }

        if (this.ConfirmPromptOn) {
            this.confirm = new ConfirmDialog(this.MessageStr, Lang.bind(this, this.doClearAlarm));
            this.confirm.open();
        }
    },

    doClearAlarm: function () {
        this.alarmOn = false;
        this.destroyMessage();
        this.doUpdateUI();
    },

    sliderChanged: function (slider, value) {
        this.timerStopped = true;

        let position = Math.max(0, Math.min(1, parseFloat(value)));

        if (position < 1) {
            let intervalCount = SliderIntervals.length;
            let intervalID = Math.floor(position * intervalCount);
            let intervalDef = SliderIntervals[intervalID];
            let intervalPos = (position - intervalID / intervalCount) * intervalCount;

            this.timerDuration = Math.floor((intervalDef.min + (intervalDef.max - intervalDef.min) * intervalPos) / intervalDef.step) * intervalDef.step;
        } else {
            this.timerDuration = SliderIntervals[SliderIntervals.length - 1].max;
        }

        this.doUpdateUI();
    },

    sliderReleased: function (slider, value) {
        this.timerStopped = true;
        if (this.timerDuration == 0) {
            this.doStopTimer();
            this.set_applet_label(""); // remove label on panel
            return;
        }

        this.doStartTimer();
    },

    createContextMenu: function () {
        // No context menu items at this time.
    },

    notifyMessage: function (title, text) {
        if (this._notification)
            this._notification.destroy();

        this._ensureSource();
        let gicon = Gio.icon_new_for_string(APPLET_PATH + "/icon.png");
        let icon = new St.Icon({ gicon: gicon });
        this._notification = new MessageTray.Notification(this._source, title, text, { icon: icon });
        this._notification.setTransient(false);
        this._notification.connect('destroy', Lang.bind(this, function () {
            this._notification = null;
        }));

        this._source.notify(this._notification);

    },
    _ensureSource: function () {
        if (!this._source) {
            let gicon = Gio.icon_new_for_string(APPLET_PATH + "/icon.png");
            let icon = new St.Icon({ gicon: gicon });

            this._source = new MessageTraySource("Cinnamon Timer Notification", icon);
            this._source.connect('destroy', Lang.bind(this, function () {
                this._source = null;
            }));
            if (Main.messageTray) Main.messageTray.add(this._source);
        }
    },

    destroyMessage: function () {
        if (this._notification)
            this._notification.destroy();
    },
    // Compare two version numbers (strings) based on code by Alexey Bass (albass)
    // Takes account of many variations of version numers including cinnamon.
    versionCompare: function (left, right) {
        if (typeof left + typeof right != 'stringstring')
            return false;
        var a = left.split('.'),
            b = right.split('.'),
            i = 0,
            len = Math.max(a.length, b.length);
        for (; i < len; i++) {
            if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
                return 1;
            } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
                return -1;
            }
        }
        return 0;
    },
};

function ConfirmDialog(message, callback) {
    this._init(message, callback);
}

ConfirmDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function (message, callback) {
        ModalDialog.ModalDialog.prototype._init.call(this);
        let label = new St.Label({ text: message + "\n\n", style_class: "timer-dialog-label" });
        this.contentLayout.add(label);

        this.setButtons([
            {
                label: _("Okay"),
                action: Lang.bind(this, function () {
                    callback();
                    this.close();
                })
            }
        ]);
    },
}

function MessageTraySource() {
    this._init();
}

MessageTraySource.prototype = {
    __proto__: MessageTray.Source.prototype,

    _init: function () {
        MessageTray.Source.prototype._init.call(this, _("Cinnamon Timer"));

        let gicon = Gio.icon_new_for_string(APPLET_PATH + "/icon.png");
        let icon = new St.Icon({ gicon: gicon });

        this._setSummaryIcon(icon);
    }
};
