const Applet = imports.ui.applet;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const UUID = "desaturate-all@hkoosha";
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;

function MyApplet() {
    this._init.apply(this, arguments);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(aMetadata, aOrientation, aPanelHeight, aInstanceId) {
        Applet.IconApplet.prototype._init.call(this, aOrientation, aPanelHeight, aInstanceId);

        if (Applet.hasOwnProperty("AllowedLayout")) {
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        }

        this.effect = new Clutter.DesaturateEffect();
        this.set_applet_icon_symbolic_name("applications-graphics");

        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("keybinding", "keybinding", this.on_keybinding_changed);

        this.on_keybinding_changed();
    },

    _toggleEffect: function() {
        if (Main.uiGroup.has_effects() && Main.uiGroup.get_effects().indexOf(this.effect) > -1) {
            Main.uiGroup.remove_effect(this.effect);
        } else {
            Main.uiGroup.add_effect(this.effect);
        }
    },

    on_applet_clicked: function() {
        this._toggleEffect();
    },

    on_keybinding_changed() {
        Main.keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this, this._toggleEffect));
    }
};

function main(aMetadata, aOrientation, aPanelHeight, aInstanceId) {
    return new MyApplet(aMetadata, aOrientation, aPanelHeight, aInstanceId);
}
