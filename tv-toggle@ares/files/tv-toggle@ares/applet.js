const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;

const UUID = "tv-toggle@ares";

function TVToggleApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

TVToggleApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this.settings.bind("internal-output", "internal_output");
        this.settings.bind("external-output", "external_output");
        this.settings.bind("external-mode", "external_mode");
        this.settings.bind("external-position", "external_position");

        this.set_applet_icon_name("video-display");
        this.set_applet_tooltip(_("TV Toggle: click to switch displays"));
    },

    _is_external_on: function() {
        try {
            let cmd = 'sh -c \'xrandr | grep "^' + this.external_output + ' connected" | grep -q "+" && echo "on" || echo "off"\'';
            let [ok, stdout] = GLib.spawn_command_line_sync(cmd);
            let state = String.fromCharCode.apply(null, stdout).trim();
            return state === "on";
        } catch (e) {
            global.logError("TV Toggle: " + e);
            return false;
        }
    },

    on_applet_clicked: function() {
        try {
            if (this._is_external_on()) {
                // External is on — go back to internal only
                GLib.spawn_command_line_async(
                    'xrandr --output ' + this.external_output + ' --off' +
                    ' --output ' + this.internal_output + ' --auto'
                );
            } else {
                // External is off — extend desktop to it
                GLib.spawn_command_line_async(
                    'xrandr --output ' + this.external_output + ' --mode ' + this.external_mode +
                    ' --output ' + this.internal_output + ' --auto' +
                    ' --' + this.external_position + ' ' + this.external_output
                );
            }
        } catch (e) {
            global.logError("TV Toggle: " + e);
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new TVToggleApplet(orientation, panel_height, instance_id);
}
