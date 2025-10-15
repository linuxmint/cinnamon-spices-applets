const Applet = imports.ui.applet;
const Lang = imports.lang;
const GLib = imports.gi.GLib;

function MoonPhaseApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

MoonPhaseApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.TextApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
        this.set_applet_label("🌕 ♈");
        this.set_applet_tooltip("Moon Phase & Zodiac Applet");
        this.updateLoop();
    },

    updateLoop: function() {
        this.updateLabel();
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1800, Lang.bind(this, this.updateLoop));
    },

    updateLabel: function() {
        // Placeholder: replace with real lunar/zodiac calculation
        this.set_applet_label("🌖 ♋");
        this.set_applet_tooltip("Waning Gibbous in Cancer");
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new MoonPhaseApplet(metadata, orientation, panelHeight, instanceId);
}
