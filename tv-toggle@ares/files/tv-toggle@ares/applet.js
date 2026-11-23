const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Gio = imports.gi.Gio;

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

        // Assume external is off until we detect the real state (async, non-blocking)
        this._external_on = false;
        this._detect_initial_state();
    },

    // Detect whether the external display is currently active.
    // Runs once at startup, asynchronously, so it never blocks the panel.
    // Parses `xrandr` output directly — no shell involved.
    _detect_initial_state: function() {
        try {
            let proc = new Gio.Subprocess({
                argv: ['xrandr'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE
            });
            proc.init(null);
            let self = this;
            proc.communicate_utf8_async(null, null, function(proc, res) {
                try {
                    let [, stdout] = proc.communicate_utf8_finish(res);
                    let lines = stdout.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        // e.g. "HDMI-1 connected 1920x1080+1366+0 ..."
                        // Active outputs have a resolution with a +X+Y offset.
                        if (lines[i].indexOf(self.external_output + ' connected') === 0) {
                            self._external_on = /\d+x\d+\+\d+\+\d+/.test(lines[i]);
                            break;
                        }
                    }
                } catch (e) {
                    global.logError("TV Toggle init: " + e);
                }
            });
        } catch (e) {
            global.logError("TV Toggle init: " + e);
        }
    },

    on_applet_clicked: function() {
        try {
            if (this._external_on) {
                // External is on — go back to internal only
                Util.spawn(["xrandr",
                    "--output", this.external_output, "--off",
                    "--output", this.internal_output, "--auto"
                ]);
            } else {
                // External is off — extend desktop to it
                Util.spawn(["xrandr",
                    "--output", this.external_output, "--mode", this.external_mode,
                    "--output", this.internal_output, "--auto",
                    "--" + this.external_position, this.external_output
                ]);
            }
            this._external_on = !this._external_on;
        } catch (e) {
            global.logError("TV Toggle: " + e);
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new TVToggleApplet(orientation, panel_height, instance_id);
}
