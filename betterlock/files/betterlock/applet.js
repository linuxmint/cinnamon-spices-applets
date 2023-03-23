const Applet = imports.ui.applet;
const St = imports.gi.St;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const Keymap = Gdk.Keymap.get_default();
const Caribou = imports.gi.Caribou;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Settings = imports.ui.settings;

const UUID = "betterlock";
const ICON_SIZE = 18;

// l10n/translation
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        if (Applet.hasOwnProperty("AllowedLayout"))
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        global.log(this.settings.settings);
        this.settings.bind("show-notifications", "showNotifications", null);
        this.settings.bind("show-caps-lock-indicator", "showCapsLockIndicator", this._updateIconVisibility);
        this.settings.bind("show-num-lock-indicator", "showNumLockIndicator", this._updateIconVisibility);
        this.settings.bind("show-scr-lock-indicator", "showScrLockIndicator", this._updateIconVisibility);

        this.binScr = new St.Bin({ reactive: true });
        this.binNum = new St.Bin({ reactive: true });
        this.binCaps = new St.Bin({ reactive: true });

        this.caps_on = new St.Icon({
            icon_name: "caps-on",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: ICON_SIZE,
            style_class: "system-status-icon"
        });
        this.caps_off = new St.Icon({
            icon_name: "caps-off",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: ICON_SIZE,
            style_class: "system-status-icon"
        });
        this.num_on = new St.Icon({
            icon_name: "num-on",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: ICON_SIZE,
            style_class: "system-status-icon"
        });
        this.num_off = new St.Icon({
            icon_name: "num-off",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: ICON_SIZE,
            style_class: "system-status-icon"
        });
        this.scr_on = new St.Icon({
            icon_name: "scr-on",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: ICON_SIZE,
            style_class: "system-status-icon"
        });
        this.scr_off = new St.Icon({
            icon_name: "scr-off",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: ICON_SIZE,
            style_class: "system-status-icon"
        });

        this.binScr.child = this.scr_off;
        this.binNum.child = this.num_off;
        this.binCaps.child = this.caps_off;
        this.actor.add(this.binCaps, {
            y_align: St.Align.MIDDLE,
            y_fill: false
        });
        this.actor.add(this.binNum, {
            y_align: St.Align.MIDDLE,
            y_fill: false
        });
        this.actor.add(this.binScr, {
            y_align: St.Align.MIDDLE,
            y_fill: false
        });
        this.actor.style = 'spacing: 2px';


        this.scrMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Scr Lock"), false);
        this.scrMenuItem.connect('activate', Lang.bind(this, this._onScrChanged));
        this._applet_context_menu.addMenuItem(this.scrMenuItem);

        this.numMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Num Lock"), false);
        this.numMenuItem.connect('activate', Lang.bind(this, this._onNumChanged));
        this._applet_context_menu.addMenuItem(this.numMenuItem);

        this.capsMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Caps Lock"), false);
        this.capsMenuItem.connect('activate', Lang.bind(this, this._onCapsChanged));
        this._applet_context_menu.addMenuItem(this.capsMenuItem);

        this._keyboardStateChangedId = Keymap.connect('state-changed', Lang.bind(this, this._updateState));
        this._firstRun = true;
        this._updateState();
        this._updateIconVisibility();
    },

    on_applet_removed_from_panel: function() {
        Keymap.disconnect(this._keyboardStateChangedId);
    },

    _ensureSource: function() {
        if (!this._source) {
            this._source = new MessageTray.Source();
            this._source.connect('destroy', () => this._source = null );
            if (Main.messageTray) Main.messageTray.add(this._source);
        }
    },

    _notifyMessage: function(iconName, text) {
        if (this._notification)
            this._notification.destroy();

        /* must call after destroying previous notification,
         * or this._source will be cleared */
        this._ensureSource();

        let icon = new St.Icon({
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC,
            icon_size: ICON_SIZE
        });
        this._notification = new MessageTray.Notification(this._source, _("Lock Keys"), text, {
            icon: icon
        });
        this._notification.setUrgency(MessageTray.Urgency.NORMAL);
        this._notification.setTransient(true);
        this._notification.connect('destroy', Lang.bind(this, function() {
            this._notification = null;
        }));
        this._source.notify(this._notification);
    },

    _updateIconVisibility: function() {
        if (this.showCapsLockIndicator) {
            this.binCaps.show();
        } else {
            this.binCaps.hide();
        }
        if (this.showNumLockIndicator) {
            this.binNum.show();
        } else {
            this.binNum.hide();
        }
        if (this.showScrLockIndicator) {
            this.binScr.show();
        } else {
            this.binScr.hide();
        }
    },

    _updateState: function() {
        this.scrlock_state = this._getScrlockState();
        this.numlock_state = this._getNumlockState();
        this.capslock_state = this._getCapslockState();

        let scrlock_prev = this.binScr.child;
        let numlock_prev = this.binNum.child;
        let capslock_prev = this.binCaps.child;
        if (this.scrlock_state)
            this.binScr.child = this.scr_on;
        else
            this.binScr.child = this.scr_off;

        if (this.numlock_state)
            this.binNum.child = this.num_on;
        else
            this.binNum.child = this.num_off;

        if (this.capslock_state)
            this.binCaps.child = this.caps_on;
        else
            this.binCaps.child = this.caps_off;

        let msg, icon_name;

        this.scrMenuItem.setToggleState(this.scrlock_state);
        this.numMenuItem.setToggleState(this.numlock_state);
        this.capsMenuItem.setToggleState(this.capslock_state);
        if (scrlock_prev != this.binScr.child && !this._firstRun) {
            if (this.binScr.child == this.scr_on) {
                msg = _("Scr lock on");
                icon_name = 'scr-on';
            } else {this.indicatorType == "num-only"
                msg = _("Scr lock off");
                icon_name = 'scr-off';
            }
            if (this.showNotifications && this.showScrLockIndicator) {
                this._notifyMessage(icon_name, msg);
            }
        }
        if (numlock_prev != this.binNum.child && !this._firstRun) {
            if (this.binNum.child == this.num_on) {
                msg = _("Num lock on");
                icon_name = 'num-on';
            } else {
                msg = _("Num lock off");
                icon_name = 'num-off';
            }
            if (this.showNotifications && this.showNumLockIndicator) {
                this._notifyMessage(icon_name, msg);
            }
        }
        if (capslock_prev != this.binCaps.child && !this._firstRun) {
            if (this.binCaps.child == this.caps_on) {
                msg = _("Caps lock on");
                icon_name = 'caps-on';
            } else {
                msg = _("Caps lock off");
                icon_name = 'caps-off';
            }
            if (this.showNotifications && this.showCapsLockIndicator) {
                this._notifyMessage(icon_name, msg);
            }
        }
        this._firstRun = false;
    },

    _getScrlockState: function() {
        return Keymap.get_scroll_lock_state();
    },

    _getNumlockState: function() {
        return Keymap.get_num_lock_state();
    },

    _getCapslockState: function() {
        return Keymap.get_caps_lock_state();
    },

    on_applet_clicked: function(event) {
        if (this.showCapsLockIndicator && event.get_source() === this.binCaps) {
            this._onCapsChanged();
        } else if (this.showNumLockIndicator && event.get_source() === this.binNum) {
            this._onNumChanged();
        } else if (this.showScrLockIndicator && event.get_source() === this.binScr) {
            this._onScrChanged();
        }
    },

    _onLockChanged: function(keyval) {
        if (Caribou.XAdapter.get_default !== undefined) {
            //caribou <= 0.4.11
            Caribou.XAdapter.get_default().keyval_press(keyval);
            Caribou.XAdapter.get_default().keyval_release(keyval);
        } else {
            Caribou.DisplayAdapter.get_default().keyval_press(keyval);
            Caribou.DisplayAdapter.get_default().keyval_release(keyval);
        }
        this._updateState();
    },

    _onScrChanged: function(_actor, _event) {
        let keyval = Gdk.keyval_from_name("Scroll_Lock");
        this._onLockChanged(keyval);
    },

    _onNumChanged: function(_actor, _event) {
        let keyval = Gdk.keyval_from_name("Num_Lock");
        this._onLockChanged(keyval);
    },

    _onCapsChanged: function(_actor, _event) {
        let keyval = Gdk.keyval_from_name("Caps_Lock");
        this._onLockChanged(keyval);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
