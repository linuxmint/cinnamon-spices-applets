const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;

const ALS_RAW = "/sys/bus/iio/devices/iio:device0/in_illuminance_raw";
const ALS_SCALE = "/sys/bus/iio/devices/iio:device0/in_illuminance_scale";

const POLL_MS = 1000; // 1 second

// Brightness limits (%)
const MIN_BRIGHTNESS = 10;
const MAX_BRIGHTNESS = 90;

// Smoothing factor (0.0-1.0)
const SMOOTHING = 0.2;

class AutoBrightnessApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._brightness = null;
        this._enabled = true;

        this.set_applet_label("🌤 Auto");
        this.set_applet_tooltip("Click to enable/disable auto-brightness");

        this._loop();
    }

    on_applet_clicked() {
        this._enabled = !this._enabled;
        this.set_applet_label(this._enabled ? "🌤 Auto" : "🌙 Off");
        this.set_applet_tooltip(this._enabled ? "Click to enable/disable auto-brightness" : "Auto-brightness disabled");
        global.logError("Toggle clicked: " + this._enabled);
    }

    _readNumber(path) {
        return parseFloat(GLib.file_get_contents(path)[1].toString().trim());
    }

    _luxToBrightness(lux) {
        const maxLux = 1000; // Adjust this for bright sunlight
        const normalized = Math.log(lux + 1) / Math.log(maxLux + 1);
        const clamped = Math.min(Math.max(normalized, 0), 1);
        return Math.round(MIN_BRIGHTNESS + clamped * (MAX_BRIGHTNESS - MIN_BRIGHTNESS));
    }

    _loop() {
        try {
            if (this._enabled) {
                const raw = this._readNumber(ALS_RAW);
                const scale = this._readNumber(ALS_SCALE);
                const lux = raw * scale;

                let targetBrightness = this._luxToBrightness(lux);

                if (this._brightness === null)
                    this._brightness = targetBrightness;
                else
                    this._brightness += (targetBrightness - this._brightness) * SMOOTHING;

                const finalBrightness = Math.round(this._brightness);

                GLib.spawn_command_line_async(
                    `sudo /usr/bin/brightnessctl set ${finalBrightness}%`
                );

                this.set_applet_tooltip(`Ambient light: ${lux.toFixed(1)}\nBrightness: ${finalBrightness}%`);
            } else {
                this.set_applet_tooltip("Auto-brightness disabled");
            }

        } catch (e) {
            global.logError(e);
        }

        Mainloop.timeout_add(POLL_MS, () => {
            this._loop();
            return false;
        });
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new AutoBrightnessApplet(metadata, orientation, panelHeight, instanceId);
}
