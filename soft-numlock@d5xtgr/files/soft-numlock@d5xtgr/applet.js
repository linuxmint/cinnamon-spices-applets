const Applet = imports.ui.applet;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const Keymap = Gdk.Keymap.get_default();
const Caribou = imports.gi.Caribou;
const Lang = imports.lang;
const Meta = imports.ui.appletManager.appletMeta["soft-numlock@d5xtgr"];
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "soft-numlock@d5xtgr";

// l10n/translation support

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

// This is a simple applet that displays an icon of a lock with the number "1".
// It is bright and locked when Num Lock is on, but dim and unlocked when it is off.
// Clicking the icon toggles the Num Lock state, and it responds to the keyboard.
// This is useful on my laptop, which has no other indicator for Num Lock.
// Most of the code is reused from lock@dalcde as edited November 2013.
// This version lacks the Caps Lock control, but has cosmetic improvements.
// It has new icons which respond to mouse hover if the theme supports it.
// It is no longer necessary to open a menu to toggle the state- single click works.
// Update January 2014 to accommodate Caribou's transition from X to Wayland.

function MyApplet(orientation){
    this._init(orientation);
}

MyApplet.prototype = {
    //Changed to IconApplet since we have no text label
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation){
        Applet.IconApplet.prototype._init.call(this, orientation);

        //Default to on.  No particular reason, but we'll check shortly.
        this.set_applet_tooltip(_("Number Lock on"));

        //Search for the icon representing the 'on' state
        Gtk.IconTheme.get_default().append_search_path(Meta.path);
        this.set_applet_icon_symbolic_name("num-on");

        //The point is that it updates the icon when you use the keyboard.
        this._keyboardStateChangedId = Keymap.connect('state-changed', Lang.bind(this, this._updateState));

        //Look up the real value now.
        this._updateState();
    },

    _updateState: function() {
        //Updates the appearance of the icon to match the actual state of the lock.
        this.numlock_state = this._getNumlockState();

        if (this.numlock_state) {
            this.set_applet_icon_symbolic_name("num-on");
            this.set_applet_tooltip(_("Number Lock on"));
        }
        else {
            this.set_applet_icon_symbolic_name("num-off");
            this.set_applet_tooltip(_("Number Lock off"));
        }
    },

    _getNumlockState: function() {
        return Keymap.get_num_lock_state();
    },

    on_applet_clicked: function(event){
        //This function waits for the user to click the applet, then toggles the lock.
        Lang.bind(this, this._onNumChanged("activate"));
    },

    _onNumChanged: function(actor, event) {
        //This function simulates pressing the Num Lock key to implement toggling.
        keyval = Gdk.keyval_from_name("Num_Lock");
        if (Caribou.XAdapter.get_default !== undefined) {
            //caribou <= 0.4.11
            Caribou.XAdapter.get_default().keyval_press(keyval);
            Caribou.XAdapter.get_default().keyval_release(keyval);
        } else { 
            Caribou.DisplayAdapter.get_default().keyval_press(keyval);
            Caribou.DisplayAdapter.get_default().keyval_release(keyval);
        }
    },
};

function main(metadata, orientation){
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
