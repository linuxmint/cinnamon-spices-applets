const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;

const UUID = "timeout@narutrey";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function main(metadata, orientation, panelHeight, instanceId) {
    let applet = new AppletTimeout(metadata, orientation, panelHeight, instanceId);
    return applet;
}

function AppletTimeout(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

// Enums
var StateCountdown = {
    BREAK:      {appletLabelUpdate: false,  dialogUpdate: true  },
    WAIT:       {appletLabelUpdate: false,  dialogUpdate: false },
    WORK:       {appletLabelUpdate: true,   dialogUpdate: false },
};

var StateAppletDisplay = {
    ALL:        {icon: true,    label: true  },
    ONLY_ICON:  {icon: true,    label: false },
    ONLY_LABEL: {icon: false,   label: true  },
};
/* */

AppletTimeout.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    // Booleans
    isAllowPostpone: false,
    isAutoReflesh: false,
    isDisplaySeconds: false,
    isEnable: false,
    isResumeAuto: false,

    // Enum instances
    state: null,
    stateAppletDisplay: null,

    // Integers
    countdownInSeconds:     0,
    timeBreakInMinutes:     0,
    timePostponeInMinutes:  0,
    timeWorkInMinutes:      0,

    // Objects
    _dialog:            null,
    _menu:              null,
    _settingsProvider:  null,

    // Strings
    displayMode: "",

    /* */

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this._settingsProvider = new Settings.AppletSettings(this, UUID, instanceId);
        this.bindSettings();
        this._dialog = new Dialog();
        this._dialog.connect('close', Lang.bind(this,
            function() {
                if (!this.isEnable) return;
                if (this.state == StateCountdown.BREAK) {
                    this.beginPostpone();
                } else if (this.state == StateCountdown.WAIT) {
                    this.beginWork();
                }
            }
        ));
        this._menu = new Menu(this, orientation, this.isEnable);
        this._menu.connect('toggled::enable', Lang.bind(this, function() {this.setEnable(!this.isEnable)}));
        this._menu.connect('reset', Lang.bind(this, this.beginWork));
        this._menu.connect('break', Lang.bind(this, this.beginBreak));
        this.beginWork();
    },

    beginBreak: function() {
        let isOpened = this._dialog.open(this.isAllowPostpone);
        if (!isOpened) return false;
        this.state = StateCountdown.BREAK;
        this.countdownInSeconds = this.timeBreakInMinutes * 60;
        this.refleshUi();
        this.refleshAutoStart();
        return true;
    },

    beginPostpone: function() {
        this.state = StateCountdown.WORK;
        this.countdownInSeconds = this.timePostponeInMinutes * 60;
        this.refleshUi();
        this.refleshAutoStart();
    },

    beginWait: function() {
        this.state = StateCountdown.WAIT;
        this._dialog.breakOver();
        this.refleshAutoStop();
    },

    beginWork: function() {
        this.state = StateCountdown.WORK;
        this.countdownInSeconds = this.timeWorkInMinutes * 60;
        this.refleshUi();
        if (this.isEnable) this.refleshAutoStart();
    },

    bindSettings: function() {
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "allow_postpone", "isAllowPostpone");
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN, "display_mode", "displayMode", Lang.bind(this, this.updateDisplayMode)
        );
        this.updateDisplayMode();
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "resume_auto", "isResumeAuto");
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.BIDIRECTION, "enable", "isEnable", Lang.bind(this,
            function() {
                this.setEnable(this.isEnable);
            }
        ));
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN, "display_seconds", "isDisplaySeconds", Lang.bind(this, this.refleshUi)
        );
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,"time_work","timeWorkInMinutes");
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "time_break", "timeBreakInMinutes");
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "time_postpone", "timePostponeInMinutes");
    },

    updateDisplayMode: function() {
        switch(this.displayMode) {
            case "only_icon":
                this.stateAppletDisplay = StateAppletDisplay.ONLY_ICON;
                break;
            case "only_label":
                this.stateAppletDisplay = StateAppletDisplay.ONLY_LABEL;
                break;
            default:
                this.stateAppletDisplay = StateAppletDisplay.ALL;
                break;
        }
        if (this.stateAppletDisplay.icon) {
            this.set_applet_icon_symbolic_name("alarm");
        } else {
            this.hide_applet_icon();
        }
        this.refleshLabel();
    },

    reflesh: function() {
        if (!this.isAutoReflesh) return;
        if (this.countdownInSeconds > 0) {
            --this.countdownInSeconds;
            this.refleshUi();
        } else {
            if (this.state == StateCountdown.BREAK) {
                this.refleshAutoStop();
                if (this.isResumeAuto) {
                    this._dialog.close();
                    this.beginWork();
                } else {
                    this.beginWait();
                }
                return;
            } else {
                this.beginBreak();
            }
        }
        Mainloop.timeout_add_seconds(1, Lang.bind(this, this.reflesh));
    },

    refleshAutoStart: function() {
        if (this.isAutoReflesh) return;
        this.isAutoReflesh = true;
        Mainloop.timeout_add_seconds(1, Lang.bind(this, this.reflesh));
    },

    refleshAutoStop: function() {
        this.isAutoReflesh = false;
    },

    refleshLabel: function() {
        if (this.stateAppletDisplay.label) {
            this.set_applet_label(formatTime(this.countdownInSeconds, this.isDisplaySeconds));
        } else {
            this.set_applet_label('');
        }
    },

    refleshDialog: function() {
        this._dialog.refleshBreakCountdown(this.countdownInSeconds);
    },

    refleshUi: function() {
        if (this.state.appletLabelUpdate) {
            this.refleshLabel();
            if (!this.isDisplaySeconds || !this.stateAppletDisplay.label) {
                this.set_applet_tooltip(_("Time left:") + ' ' + formatTime(this.countdownInSeconds, true));
            } else {
                this.set_applet_tooltip('');
            }
        }
        if (this.state.dialogUpdate) this.refleshDialog();
    },

    setEnable: function(isEnable) {
        this.isEnable = isEnable;
        if (this.isEnable) this.refleshAutoStart(); else this.refleshAutoStop();
    },

    on_applet_removed_from_panel: function() {
        this.isAutoReflesh = false;
        this._dialog.destroy();
        this._menu.destroy();
        this._settingsProvider.finalize();
    },

    on_applet_clicked: function() {
        this._menu.toggle();
    },
}

function Dialog() {
    this._init();
}

Dialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    STYLE: 'text-align: center; font-size: xx-large',

    _label: null,

    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this);
        this.label = new St.Label({text: ''});
        this.contentLayout.add(this.label);
        this.contentLayout.set_style(this.STYLE);
    },

    breakOver: function() {
        this.setButtons([
            {
                label: _("Resume"),
                action: Lang.bind(this, this.close),
                key: Clutter.Return,
                focused: true
            }
        ]);
        this.label.set_text(_("The break is over"));
    },

    close: function(timestamp) {
        ModalDialog.ModalDialog.prototype.close.call(this, timestamp);

        this.emit('close');
    },

    refleshBreakCountdown: function(seconds) {
        this.label.set_text(_("Break!") + '\n\n' + formatTime(seconds, true));
    },

    open: function(isShowButtonPostpone, timestamp) {
        let isOpened = ModalDialog.ModalDialog.prototype.open.call(this, timestamp);
        if (!isOpened) return false;

        if (isShowButtonPostpone) {
            this.setButtons([
                {
                    label: _("Postpone"),
                    action: Lang.bind(this, this.close),
                    key: Clutter.Return
                }
            ]);
        } else {
            this._buttonLayout.destroy_all_children();
        }
        return true;
    },
}

function Menu(launcher, orientation, isEnable) {
    this._init(launcher, orientation, isEnable);
}

Menu.prototype = {
    __proto__: Applet.AppletPopupMenu.prototype,

    _menuManager:   null,
    _switchEnable:  null,

    _init: function(launcher, orientation, isEnable) {
        Applet.AppletPopupMenu.prototype._init.call(this, launcher, orientation);

        this._menuManager = new PopupMenu.PopupMenuManager(launcher);
        //

        this._switchEnable = new PopupMenu.PopupSwitchMenuItem(_("Enabled"));
        this._switchEnable.setToggleState(isEnable);
        this._switchEnable.connect('toggled', Lang.bind(this,
            function() {
                this.emit('toggled::enable');
            }
        ));
        this.addMenuItem(this._switchEnable);

        this.addAction(_("Reset timer"), Lang.bind(this,
            function() {
                this.emit('reset');
            }
        ));
        this.addAction(_("Take a break"), Lang.bind(this,
            function() {
                this.emit('break');
            }
        ));
    },

    open: function(animate) {
        this._menuManager.addMenu(this);
        Applet.AppletPopupMenu.prototype.open.call(this, animate);
    },

    close: function(animate) {
        if (this.isOpen) {
            Applet.AppletPopupMenu.prototype.close.call(this, animate);
            this._menuManager.removeMenu(this);
        }
    },

    setEnable: function(isEnable) {
        this._switchEnable.setToggleState(isEnable);
    },
}

function formatSexagesimal(value) {
    if (value < 0) value = -value;
    value = Math.floor(value % 60);
    if (value < 10) value = '0' + value;
    return value;
}

function formatTime(seconds, isReturnSeconds) {
    let s = formatSexagesimal(seconds);
    let m = formatSexagesimal(seconds / 60);
    let h = formatSexagesimal(seconds / (60 * 60));
    let label;
    if (isReturnSeconds) {
        if (h > 0) {
            label = h + ':' + m + ':' + s;
        } else {
            label = m + ':' + s;
        }
    } else {
        m = parseInt(m, 10); // Drop leading zero
        if (seconds % 60 > 0) ++m;
        if (h > 0) {
            label = h + ':' + m;
        } else {
            label = '' + m;
        }
    }
    return label;
}
