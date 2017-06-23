// Timer applet with notifications visual and auditory
// Mark Bokil 5/12/12
// Version 1.0.2

const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const ModalDialog = imports.ui.modalDialog;
const Gettext = imports.gettext;
const UUID = "axos88@countdown-timer";
const AppletMeta = imports.ui.appletManager.applets[UUID];
const AssetDir = imports.ui.appletManager.appletMeta[UUID].path + "/assets";
const ConfigFile = GLib.build_filenamev([global.userdatadir, 'applets/' + UUID + '/config.js']);
let AppOptions = AppletMeta.config.Options;
const OpenFileCmd = "xdg-open";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

Number.prototype.pad = function(size) {
  var s = String(this);
  while (s.length < (size || 2)) {s = "0" + s;}
  return s;
}

function ConfirmDialog(){
    this._init();
}

ConfirmDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
        ModalDialog.ModalDialog.prototype._init.call(this);
        let label = new St.Label({text: AppOptions.ConfirmMessage + "\n\n", style_class: "timer-dialog-label"});
        this.contentLayout.add(label);

        this.setButtons([
            {
                label: _("Okay"),
                action: Lang.bind(this, function(){
                    this.close();
                })
            }
        ]);
    },
}

function PopupMenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation) {
        Applet.TextIconApplet.prototype._init.call(this, orientation);

        try {
            //set properties from external config file
            this.ConfirmPromptOn = AppOptions.ConfirmPromptOn;
            this.SoundPromptOn = AppOptions.SoundPrompOn;
            this.MessagePromptOn = AppOptions.MessagePromptOn;
            this.ShowMenuOn = AppOptions.ShowMenuOn;
            this.MessageStr = AppOptions.MessageStr;
            this.SoundPath = AppOptions.SoundPath;
            this.LabelOn = AppOptions.LabelOn;

            this.timerDuration = 0;
            this.timerStopped = true;
            this.alarmOn = false;
            this.state = false;

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._orientation = orientation;
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

            this.doUpdateUI();
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        if (this.timerStopped && this.alarmOn) {
            this.alarmOn = false;
            this.doUpdateUI();
        }

        this.menu.toggle();
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    },

    buildTimePresetMenu: function() {
            AppOptions.Presets.forEach(Lang.bind(this, function(preset) {
                let hr = Math.floor(preset / 3600)
                let min = Math.floor((preset % 3600) / 60)
                let sec = preset % 60

                let hrText = (hr > 0 ? hr + " " + _("Hours") + " " : "")
                let minText = (min > 0 ? min + " " + _("Minutes") + " " : "")
                let secText = (sec > 0 ? sec + " " + _("Seconds") : "")

                let label = preset > 0 ? hrText + minText + secText : _("Reset")

                let item = new PopupMenu.PopupMenuItem(label);
                this.menu.addMenuItem(item)
                item.connect('activate', Lang.bind(this, this.doTimePreset, preset));
            }));
    },

    doTimePreset: function(a, b, c, duration) {
                this.timerDuration = duration;
                if (duration > 0) {
                    this.doStartTimer();
                } else {
                    this.doStopTimer();
                }
    },

    doTimerSwitch: function(item) {
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

    doStartTimer: function() {
        if (this.timerDuration == 0) return;

        this.timerStopped = false;
        this.startTime = this.getCurrentTime();
        this.endTime = this.startTime + this.timerDuration * 1000;

        this.doTick();
        this.doUpdateUI();
    },

    getCurrentTime: function() {
        let d = new Date();
	    let x = Math.floor(d.getTime());
	    return x;
    },

    doStopTimer: function() {
        this.timerStopped = true;
        this.doUpdateUI();
    },

    doTick: function() {
        if (this.timerStopped) return;

        if (this.getCurrentTime() >= this.endTime) {
            this.doTimerExpired();
            return;
        }

        this.timerDuration = Math.max(0, Math.round( (this.endTime - this.getCurrentTime()) / 1000));
        this.doUpdateUI();

        Mainloop.timeout_add_seconds(1, Lang.bind(this, this.doTick));
    },

    doUpdateUI: function() {
        this.timerSwitch.setToggleState(!this.timerStopped);

        if (this.state) this.actor.remove_style_class_name("timer-" + this.state);
        this.state = this.alarmOn ? "expired" : (this.timerStopped ? "stopped" : "running")
        this.actor.add_style_class_name("timer-" + this.state);

        let hr = Math.floor(this.timerDuration / 3600)
        let min = Math.floor((this.timerDuration % 3600) / 60)
        let sec = this.timerDuration % 60

        this.timerMenuItem.label.text = hr + " " + _("Hours") + "," + " " + min.pad(2) + " " + _("Minutes") + " " + _("and") + " " + sec.pad(2) + " " + _("Seconds")
        let timeStr = hr + ":" + min.pad(2) + ":" + sec.pad(2)
        this.set_applet_tooltip(_("Timer") + ":" + " " + timeStr);

        if (AppOptions.LabelOn) {
            if (this.timerStopped && this.timerDuration == 0)
                this.set_applet_label("");
            else
                this.set_applet_label(timeStr);
        }
    },

    doTimerExpired: function() {
        this.timerDuration = 0
        this.alarmOn = true
        this.doStopTimer()

        if (AppOptions.LabelOn) {
            this.set_applet_label(""); // remove label on panel
        }

        if (this.ShowMenuOn) {
            this.menu.open();
        }
        if (this.SoundPromptOn) {
             try {
                Util.spawnCommandLine("play " + AssetDir + "/" + this.SoundPath);
             }
             catch (e) {
                global.logError(e);
             }
        }
        if (this.MessagePromptOn) {
            Util.spawnCommandLine("notify-send '" + this.MessageStr + "'");
        }
        if (this.ConfirmPromptOn) {
            this.confirm = new ConfirmDialog();
            this.confirm.open();
        }
    },

    sliderChanged: function(slider, value) {
        this.timerStopped = true;

        let position = Math.max(0, Math.min(1,parseFloat(value)));

        if (position < 1) {
            let intervalCount = AppOptions.SliderIntervals.length
            let intervalID = Math.floor(position * intervalCount)
            let intervalDef = AppOptions.SliderIntervals[intervalID]
            let intervalPos = (position - intervalID / intervalCount) * intervalCount

            this.timerDuration = Math.floor((intervalDef.min + (intervalDef.max - intervalDef.min) * intervalPos) / intervalDef.step) * intervalDef.step
        } else {
            this.timerDuration = AppOptions.SliderIntervals[AppOptions.SliderIntervals.length - 1].max
        }

        this.doUpdateUI()
    },

    sliderReleased: function(slider, value) {
        this.timerStopped = true;
        if (this.timerDuration == 0) {
            this.doStopTimer();
            if (AppOptions.LabelOn) {
                this.set_applet_label(""); // remove label on panel
            }
            return;
        }

        this.doStartTimer();
    },

    loadOptions: function() {
        AppOptions = AppletMeta.config.Options;
    },

    createContextMenu: function () {
        this.edit_menu_item = new Applet.MenuItem(_("Edit Options"), Gtk.STOCK_EDIT,
            Lang.bind(this, this.editProperties));
        this.reload_menu_item = new Applet.MenuItem(_("Restart Cinnamon"), Gtk.STOCK_REFRESH,
            Lang.bind(this, this.doRestart));
        this._applet_context_menu.addMenuItem(this.edit_menu_item);
        this._applet_context_menu.addMenuItem(this.reload_menu_item);

    },

    editProperties: function () {
        Main.Util.spawnCommandLine(OpenFileCmd + " " + ConfigFile);
    },

    doRestart: function() {
        Util.spawnCommandLine(global.reexec_self());
    }

};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
