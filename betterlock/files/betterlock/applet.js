const Applet = imports.ui.applet;
const St = imports.gi.St;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Keymap = Gdk.Keymap.get_default();
const Caribou = imports.gi.Caribou;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Settings = imports.ui.settings;
const ModalDialog = imports.ui.modalDialog;

const UUID = "betterlock";
const NOTIF_ICON_SIZE = 18;

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
        this.settings.bind("show-toast-notifications", "showToastNotifications", null);
        this.settings.bind("show-osd-notifications", "showOSDNotifications", null);
        this.settings.bind("show-silent-notifications", "showSilentNotifications", null)
        this.settings.bind("show-caps-lock-indicator", "showCapsLockIndicator", this._updateAllIndicators);
        this.settings.bind("show-num-lock-indicator", "showNumLockIndicator", this._updateAllIndicators);
        this.settings.bind("show-scr-lock-indicator", "showScrLockIndicator", this._updateAllIndicators);
        this.settings.bind("hide-inactive-indicators", "hideInactiveIndicators", this._updateAllIndicators);
        this.settings.bind("toggle-on-click", "toggleOnClick", null);


        this.binScr = new St.Bin({ reactive: true });
        this.binNum = new St.Bin({ reactive: true });
        this.binCaps = new St.Bin({ reactive: true });

        this.caps_on = new St.Icon({
            icon_name: "caps-on",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "system-status-icon"
        });
        this.caps_off = new St.Icon({
            icon_name: "caps-off",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "system-status-icon"
        });
        this.num_on = new St.Icon({
            icon_name: "num-on",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "system-status-icon"
        });
        this.num_off = new St.Icon({
            icon_name: "num-off",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "system-status-icon"
        });
        this.scr_on = new St.Icon({
            icon_name: "scr-on",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "system-status-icon"
        });
        this.scr_off = new St.Icon({
            icon_name: "scr-off",
            icon_type: St.IconType.SYMBOLIC,
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

        this.scrlock_state = this._getScrlockState();
        this.numlock_state = this._getNumlockState();
        this.capslock_state = this._getCapslockState();

        this._keyboardStateChangedId = Keymap.connect('state-changed', Lang.bind(this, this._onAnyLockStateChanged));
        this._updateIconsSize();
        this._updateAllIndicators();
    },

    on_panel_icon_size_changed: function() {
        this._updateIconsSize();
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
        // Toast or OSD?
        if (this.showToastNotifications) {
            if (this._notification)
                this._notification.destroy();

            /* must call after destroying previous notification,
            * or this._source will be cleared */
            this._ensureSource();

            let icon = new St.Icon({
                icon_name: iconName,
                icon_type: St.IconType.SYMBOLIC,
                icon_size: NOTIF_ICON_SIZE
            });
            this._notification = new MessageTray.Notification(this._source, _("Lock Keys"), text, {
                icon: icon,
                silent: this.showSilentNotifications
            });
            this._notification.setUrgency(MessageTray.Urgency.NORMAL);
            this._notification.setTransient(true);
            this._notification.connect('destroy', Lang.bind(this, function() {
                this._notification = null;
            }));
            this._source.notify(this._notification);
        }
        if (this.showOSDNotifications) {
            Main.osdWindowManager.show(-1, Gio.Icon.new_for_string(iconName), text, null);
        }
    },

    _updateIconsSize: function() {
        let size = this.getPanelIconSize(St.IconType.SYMBOLIC);
        this.caps_on.icon_size = size;
        this.caps_off.icon_size = size;
        this.num_on.icon_size = size;
        this.num_off.icon_size = size;
        this.scr_on.icon_size = size;
        this.scr_off.icon_size = size;
    },

    _updateAllIndicators: function() {
        this._updateCapsLockIcon();
        this._updateCapsLockIndicatorVisibility();
        this._updateNumLockIcon();
        this._updateNumLockIndicatorVisibility();
        this._updateScrLockIcon();
        this._updateScrLockIndicatorVisibility();
    },

    _updateCapsLockIndicatorVisibility: function() {
        if (this.showCapsLockIndicator &&
                !(this.hideInactiveIndicators && !this.capslock_state)) {
            this.binCaps.show();
        } else {
            this.binCaps.hide();
        }
    },

    _updateNumLockIndicatorVisibility: function() {
        if (this.showNumLockIndicator &&
                !(this.hideInactiveIndicators && !this.numlock_state)) {
            this.binNum.show();
        } else {
            this.binNum.hide();
        }
    },

    _updateScrLockIndicatorVisibility: function() {
        if (this.showScrLockIndicator &&
                !(this.hideInactiveIndicators && !this.scrlock_state_state)) {
            this.binScr.show();
        } else {
            this.binScr.hide();
        }
    },

    _updateCapsLockIcon: function() {
        this.binCaps.child = this.capslock_state ? this.caps_on : this.caps_off;
    },

    _updateNumLockIcon: function() {
        this.binNum.child = this.numlock_state ? this.num_on : this.num_off;
    },

    _updateScrLockIcon: function() {
        this.binScr.child = this.scrlock_state ? this.scr_on : this.scr_off;
    },

    _notifyCapsLock: function() {
        if (this.capslock_state) {
            this._notifyMessage ('caps-on', _("Caps lock on"));
        } else {
            this._notifyMessage ('caps-off', _("Caps lock off"));
        }
    },

    _notifyNumLock: function() {
        if (this.numlock_state) {
            this._notifyMessage ('num-on', _("Num lock on"));
        } else {
            this._notifyMessage ('num-off', _("Num lock off"));
        }
    },

    _notifyScrLock: function() {
        if (this.scrlock_state) {
            this._notifyMessage ('scr-on', _("Scr lock on"));
        } else {
            this._notifyMessage ('scr-off', _("Scr lock off"));
        }
    },

    _onAnyLockStateChanged: function() {
        let scrlock_prev_state = this.scrlock_state;
        let numlock_prev_state = this.numlock_state;
        let capslock_prev_state = this.capslock_state;

        this.scrlock_state = this._getScrlockState();
        this.numlock_state = this._getNumlockState();
        this.capslock_state = this._getCapslockState();

        if (this.scrlock_state !== scrlock_prev_state) {
            this.scrMenuItem.setToggleState(this.scrlock_state);

            if (this.showScrLockIndicator) {
                this._updateScrLockIcon();
                this._updateScrLockIndicatorVisibility();
                this._notifyScrLock();
            }
        }

        if (this.numlock_state !== numlock_prev_state) {
            this.numMenuItem.setToggleState(this.numlock_state);

            if (this.showNumLockIndicator) {
                this._updateNumLockIcon();
                this._updateNumLockIndicatorVisibility();
                this._notifyNumLock();
            }
        }

        if (this.capslock_state !== capslock_prev_state) {
            this.capsMenuItem.setToggleState(this.capslock_state);

            if (this.showCapsLockIndicator) {
                this._updateCapsLockIcon();
                this._updateCapsLockIndicatorVisibility();
                this._notifyCapsLock();
            }
        }
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
        if (!this.toggleOnClick) {
            return
        } else if (this.showCapsLockIndicator && event.get_source() === this.binCaps) {
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
        this._onLockStateChanged();
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
