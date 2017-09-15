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

let UUID = "betterlock";
const Meta = imports.ui.appletManager.appletMeta[UUID];

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
        this._bindSettings();

        this.settings.bind("show-caps-lock", "showCapsLock", this._updateIconVisibility);
        this.settings.bind("show-num-lock", "showNumLock", this._updateIconVisibility);

        this.binNum = new St.Bin();
        this.binCaps = new St.Bin();
        this.binEmpty = new St.Bin();
        this.binEmpty.set_size(3, 3);
        this.binIndOff = new St.Bin();

        Gtk.IconTheme.get_default().append_search_path(Meta.path);

        this.caps_on = new St.Icon({
            icon_name: "caps-on",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 18,
            style_class: "applet-icon"
        });
        this.caps_off = new St.Icon({
            icon_name: "caps-off",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 18,
            style_class: "applet-icon"
        });
        this.num_on = new St.Icon({
            icon_name: "num-on",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 18,
            style_class: "applet-icon"
        });
        this.num_off = new St.Icon({
            icon_name: "num-off",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 18,
            style_class: "applet-icon"
        });
        this.indicator_off = new St.Icon({
            icon_name: "indicator-off",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 18,
            style_class: "applet-icon"
        });

        this.binNum.child = this.num_off;
        this.binCaps.child = this.caps_off;
        this.binIndOff.child = this.indicator_off;
        this.actor.add(this.binCaps, {
            y_align: St.Align.MIDDLE,
            y_fill: false
        });
        this.actor.add(this.binEmpty);
        this.actor.add(this.binNum, {
            y_align: St.Align.MIDDLE,
            y_fill: false
        });
        this.actor.add(this.binIndOff, {
            y_align: St.Align.MIDDLE,
            y_fill: false
        });

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.numMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Num Lock"), false, {
            reactive: true
        });
        this.numMenuItem.connect('activate', Lang.bind(this, this._onNumChanged));
        this.menu.addMenuItem(this.numMenuItem);

        this.capsMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Caps Lock"), false, {
            reactive: true
        });
        this.capsMenuItem.connect('activate', Lang.bind(this, this._onCapsChanged));
        this.menu.addMenuItem(this.capsMenuItem);

        this.notificationsMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Notifications"), this.pref_show_notifications, {
            reactive: true
        });
        this.notificationsMenuItem.connect('activate', Lang.bind(this, this._onNotificationsChanged));
        this.menu.addMenuItem(this.notificationsMenuItem);

        this._keyboardStateChangedId = Keymap.connect('state-changed', Lang.bind(this, this._updateState));
        this._firstRun = true;
        this._updateState();
        this._updateIconVisibility();
    },

    _bindSettings: function() {
        let bD = Settings.BindingDirection || null;
        let settingsArray = [
            [bD.BIDIRECTIONAL, "pref_show_notifications", null],
        ];
        let newBinding = typeof this.settings.bind === "function";
        for (let [binding, property_name, callback] of settingsArray) {
            // Condition needed for retro-compatibility.
            // Mark for deletion on EOL.
            if (newBinding)
                this.settings.bind(property_name, property_name, callback);
            else
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    on_applet_removed_from_panel: function() {
        Keymap.disconnect(this._keyboardStateChangedId);
    },

    _ensureSource: function() {
        if (!this._source) {
            this._source = new MessageTray.Source();
            this._source.connect('destroy', Lang.bind(this, function() {
                this._source = null;
            }));
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
            icon_size: this._source.ICON_SIZE
        });
        this._notification = new MessageTray.Notification(this._source, _("Lock Keys"), text, {
            icon: icon
        });
        this._notification.setUrgency(MessageTray.Urgency.NORMAL);
        this._notification.setTransient(true);
        this._notification.connect('destroy', function() {
            this._notification = null;
        });
        this._source.notify(this._notification);
    },

    _updateIconVisibility: function() {
        if (this.showCapsLock)
            this.binCaps.show();
        else
            this.binCaps.hide();
        if (this.showNumLock)
            this.binNum.show();
        else
            this.binNum.hide();
        if (this.showCapsLock && this.showNumLock)
            this.binEmpty.show();
        else
            this.binEmpty.hide();
        if (!this.showCapsLock && !this.showNumLock)
            this.binIndOff.show();
        else
            this.binIndOff.hide();
    },

    _updateState: function() {
        this.numlock_state = this._getNumlockState();
        this.capslock_state = this._getCapslockState();

        let numlock_prev = this.binNum.child;
        let capslock_prev = this.binCaps.child;
        if (this.numlock_state)
            this.binNum.child = this.num_on;
        else
            this.binNum.child = this.num_off;

        if (this.capslock_state)
            this.binCaps.child = this.caps_on;
        else
            this.binCaps.child = this.caps_off;

        let msg, icon_name;

        this.numMenuItem.setToggleState(this.numlock_state);
        this.capsMenuItem.setToggleState(this.capslock_state);
        if (numlock_prev != this.binNum.child && !this._firstRun && this.showNumLock) {
            if (this.binNum.child == this.num_on) {
                msg = _("Num lock on");
                icon_name = 'num-on';
            } else {
                msg = _("Num lock off");
                icon_name = 'num-off';
            }
            if (this.pref_show_notifications)
                this._notifyMessage(icon_name, msg);
        }
        if (capslock_prev != this.binCaps.child && !this._firstRun && this.showCapsLock) {
            if (this.binCaps.child == this.caps_on) {
                msg = _("Caps lock on");
                icon_name = 'caps-on';
            } else {
                msg = _("Caps lock off");
                icon_name = 'caps-off';
            }
            if (this.pref_show_notifications)
                this._notifyMessage(icon_name, msg);
        }
        this._firstRun = false;
    },

    _getNumlockState: function() {
        return Keymap.get_num_lock_state();
    },

    _getCapslockState: function() {
        return Keymap.get_caps_lock_state();
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _onNumChanged: function(actor, event) {
        let keyval = Gdk.keyval_from_name("Num_Lock");
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

    _onCapsChanged: function(actor, event) {
        let keyval = Gdk.keyval_from_name("Caps_Lock");
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

    _onNotificationsChanged: function(actor, event) {
        this.pref_show_notifications = !this.pref_show_notifications;
    },
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
