const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Gio = imports.gi.Gio;

const UUID = "internet-speed-meter@mebs";

class InternetSpeedMeter extends Applet.TextApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_label("↓ 0.0 B/s  ↑ 0.0 B/s");
        this.set_applet_tooltip("Internet Speed Meter");

        this._iface = null;
        this._rxPrev = 0;
        this._txPrev = 0;
        this._lastTime = 0;
        this._loopId = 0;
        this._initialized = false;
        this._sampling = false;
        this._detecting = false;
        this._lastLabel = "";
        this._appliedStyle = null;

        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this.settings.bind("refresh-interval", "_refreshInterval", this._onSettingsChanged.bind(this));
        this.settings.bind("show-bits", "_showBits", this._onSettingsChanged.bind(this));
        this.settings.bind("default-interface", "_defaultInterface", this._onInterfaceSettingChanged.bind(this));
        this.settings.bind("decimal-places", "_decimalPlaces", this._updateDisplay.bind(this));
        this.settings.bind("display-mode", "_displayMode", this._updateDisplay.bind(this));
        this.settings.bind("font-size", "_fontSize", this._applyStyle.bind(this));

        this._applyStyle();
        this._detectInterface();
        this._start();
    }

    _detectInterface() {
        if (this._defaultInterface) {
            this._iface = this._defaultInterface;
            return;
        }
        if (this._detecting) return;
        this._detecting = true;
        let file = Gio.File.new_for_path("/proc/net/route");
        file.load_contents_async(null, (source, res) => {
            this._detecting = false;
            try {
                let [, content] = source.load_contents_finish(res);
                let lines = imports.byteArray.toString(content).split("\n");
                for (let i = 1; i < lines.length; i++) {
                    let parts = lines[i].trim().split(/\s+/);
                    if (parts.length >= 2 && parts[1] === "00000000") {
                        this._iface = parts[0];
                        return;
                    }
                }
            } catch (e) {
                global.logError("SpeedMeter: failed to detect interface: " + e);
            }
        });
    }

    _readBytesAsync(path, callback) {
        let file = Gio.File.new_for_path(path);
        file.load_contents_async(null, (source, res) => {
            try {
                let [, content] = source.load_contents_finish(res);
                callback(Number(imports.byteArray.toString(content).trim()));
            } catch (e) {
                callback(-1);
            }
        });
    }

    _formatSpeed(bytesPerSec) {
        if (bytesPerSec < 0) bytesPerSec = 0;
        let value = this._showBits ? bytesPerSec * 8 : bytesPerSec;
        let units = this._showBits
            ? ["b/s", "Kb/s", "Mb/s", "Gb/s"]
            : ["B/s", "KB/s", "MB/s", "GB/s"];
        let sizes = [1, 1000, 1000000, 1000000000];
        let decimals = this._decimalPlaces;
        for (let i = sizes.length - 1; i >= 0; i--) {
            if (value >= sizes[i]) {
                return (value / sizes[i]).toFixed(decimals) + " " + units[i];
            }
        }
        return value.toFixed(decimals) + " " + units[0];
    }

    _update() {
        if (!this._iface) {
            this._detectInterface();
            if (!this._iface) {
                this._setLabel("no iface");
                return true;
            }
        }

        if (this._sampling) return true;
        this._sampling = true;

        let now = Date.now();
        let base = "/sys/class/net/" + this._iface + "/statistics/";
        this._readBytesAsync(base + "rx_bytes", (rx) => {
            this._readBytesAsync(base + "tx_bytes", (tx) => {
                this._sampling = false;
                this._processSample(now, rx, tx);
            });
        });

        return true;
    }

    _processSample(now, rxNow, txNow) {
        if (rxNow < 0 || txNow < 0) {
            this._setLabel("iface down");
            this._rxPrev = 0;
            this._txPrev = 0;
            this._lastTime = 0;
            this._initialized = false;
            return;
        }

        if (this._initialized && this._lastTime > 0) {
            let dt = (now - this._lastTime) / 1000;
            if (dt > 0) {
                let down = Math.max(0, rxNow - this._rxPrev) / dt;
                let up = Math.max(0, txNow - this._txPrev) / dt;
                this._downSpeed = down;
                this._upSpeed = up;
                this._updateDisplay();
                this.set_applet_tooltip(
                    "Interface: " + this._iface + "\n" +
                    "Download: " + this._formatSpeed(down) + "\n" +
                    "Upload: " + this._formatSpeed(up)
                );
            }
        }

        this._rxPrev = rxNow;
        this._txPrev = txNow;
        this._lastTime = now;
        this._initialized = true;
    }

    _setLabel(text) {
        if (text === this._lastLabel) return;
        this._lastLabel = text;
        this.set_applet_label(text);
    }

    _applyStyle() {
        let style = "font-family: monospace; font-weight: bold; font-size: " +
            (this._fontSize || 13) + "px; padding: 0 4px;";
        if (style === this._appliedStyle) return;
        this._appliedStyle = style;
        this._applet_label.set_style(style);
    }

    _updateDisplay() {
        let down = this._formatSpeed(this._downSpeed || 0);
        let up = this._formatSpeed(this._upSpeed || 0);

        if (this._displayMode === "stacked") {
            this._setLabel("↓ " + down + "\n↑ " + up);
        } else {
            this._setLabel("↓ " + down + "  ↑ " + up);
        }
    }

    _start() {
        if (this._loopId) Mainloop.source_remove(this._loopId);
        let intervalMs = Math.max(500, (this._refreshInterval || 2) * 1000);
        this._loopId = Mainloop.timeout_add(intervalMs, this._update.bind(this));
    }

    _stop() {
        if (this._loopId) {
            Mainloop.source_remove(this._loopId);
            this._loopId = 0;
        }
    }

    _restart() {
        this._initialized = false;
        this._rxPrev = 0;
        this._txPrev = 0;
        this._lastTime = 0;
        this._downSpeed = 0;
        this._upSpeed = 0;
        this._lastLabel = "";
        this._sampling = false;
        this._detecting = false;
        this._stop();
        this._start();
    }

    _onSettingsChanged() {
        this._restart();
    }

    _onInterfaceSettingChanged() {
        this._detectInterface();
        this._restart();
    }

    on_applet_removed_from_panel() {
        this._stop();
        if (this.settings) this.settings.finalize();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new InternetSpeedMeter(metadata, orientation, panel_height, instance_id);
}
