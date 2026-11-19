const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const Cairo = imports.cairo;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const ByteArray = imports.byteArray;

const UUID = "pill-battery@hunte";

function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function (metadata, orientation, panelHeight, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panelHeight, instance_id);
        this.instance_id = instance_id;
        
        this.batteryPercentage = 50;
        this.batteryState = "unknown";
        this.acOnline = false;
        this.acPaths = [];
        this._upowerSignalId = null;
        this._loginSignalId = null;
        this._settleTimeout = 0;
        
        this._buildUI();
        this.setupSettings();
        this._setupDBusListeners();
    },

    _buildUI: function () {
        this.actor.style = "padding: 0px; margin: 0px;";
        this.pillWrapper = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER
        });

        this.pillCanvas = new St.DrawingArea();
        this.pillCanvas.connect('repaint', Lang.bind(this, this._drawProgressPill));

        this.appletLabel = new St.Label({
            text: "100", 
            style: "padding: 2px 6px; font-weight: bold; text-align: center; font-size: 100%; min-width: 2.5em;",
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER
        });

        this.appletLabel.connect('allocation-changed', Lang.bind(this, function () {
            this._syncPillSizeAndRedraw();
        }));

        this.pillWrapper.add_actor(this.pillCanvas);
        this.pillWrapper.add_actor(this.appletLabel);
        this.actor.add_actor(this.pillWrapper);
    },

    _onPowerEvent: function () {
        // Update immediately, then do one quick 150ms follow-up in case the kernel
        // updated AC/online slightly before BAT0/status settled
        this.updateUI();
        if (this._settleTimeout) {
            Mainloop.source_remove(this._settleTimeout);
            this._settleTimeout = 0;
        }
        this._settleTimeout = Mainloop.timeout_add(150, Lang.bind(this, function () {
            this._settleTimeout = 0;
            this.updateUI();
            return false;
        }));
    },

    _setupDBusListeners: function () {
        try {
            // 1. UPower daemon (battery percentage & state changes)
            this._upowerSignalId = Gio.DBus.system.signal_subscribe(
                "org.freedesktop.UPower",
                "org.freedesktop.DBus.Properties",
                "PropertiesChanged",
                null,
                null,
                Gio.DBusSignalFlags.NONE,
                Lang.bind(this, function (connection, sender, path, iface, signal, params) {
                    if (path && (path.indexOf("battery_") > -1 || path.indexOf("line_power") > -1 || path.indexOf("DisplayDevice") > -1)) {
                        this._onPowerEvent();
                    }
                })
            );

            // 2. systemd-logind (fast external power / AC plug detection)
            this._loginSignalId = Gio.DBus.system.signal_subscribe(
                "org.freedesktop.login1",
                "org.freedesktop.DBus.Properties",
                "PropertiesChanged",
                "/org/freedesktop/login1",
                "org.freedesktop.login1.Manager",
                Gio.DBusSignalFlags.NONE,
                Lang.bind(this, function () {
                    this._onPowerEvent();
                })
            );
        } catch (e) {
            global.logError("[" + UUID + "] DBus Listener Error: " + e);
        }
    },

    _parseColor: function (colorStr, fallback) {
        if (!colorStr) return fallback;
        let s = colorStr.trim();
        let rgbMatch = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
        if (rgbMatch) {
            return [
                parseFloat(rgbMatch[1]) / 255.0,
                parseFloat(rgbMatch[2]) / 255.0,
                parseFloat(rgbMatch[3]) / 255.0,
                rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1.0
            ];
        }
        return fallback;
    },

    _getFontFamilyCSS: function () {
        if (!this.font_name || this.font_name.trim() === "") return "";
        try {
            // Pango parses strings like "JetBrains Mono Bold 11" cleanly into family + weight
            let desc = Pango.FontDescription.from_string(this.font_name);
            let family = desc.get_family();
            if (family) {
                let safeFamily = family.replace(/"/g, '\\"');
                return `font-family: "${safeFamily}";`;
            }
        } catch (e) {
            global.logError("[" + UUID + "] Font parse error: " + e);
        }
        return "";
    },

    _tracePillPath: function (cr, x, y, w, h, r) {
        cr.newSubPath();
        cr.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
        cr.arc(x + r, y + r, r, Math.PI / 2, 3 * Math.PI / 2);
        cr.closePath();
    },

    _syncPillSizeAndRedraw: function () {
        if (!this.pillCanvas || !this.appletLabel) return;
        let [, natW] = this.appletLabel.get_preferred_width(-1);
        let [, natH] = this.appletLabel.get_preferred_height(-1);
        let w = Math.ceil(natW);
        let h = Math.ceil(natH);
        if (w > 0 && h > 0) {
            let [curW, curH] = this.pillCanvas.get_size();
            if (curW !== w || curH !== h) {
                this.pillCanvas.set_size(w, h);
            }
            this.pillCanvas.queue_repaint();
        }
    },

    _isPluggedIn: function () {
        let state = (this.batteryState || "").toLowerCase();
        if (state === "charging" || state === "full" || state === "not charging") return true;
        if (state.indexOf("discharg") > -1) return false;
        return this.acOnline;
    },

    _drawProgressPill: function (area) {
        let [w, h] = area.get_surface_size();
        if (w <= 0 || h <= 0) return;

        let cr = area.get_context();
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(Cairo.Operator.OVER);

        let plugged_in = this._isPluggedIn();
        let bw = plugged_in ? 2 : 0;
        let offset = bw / 2.0;
        let innerW = w - bw;
        let innerH = h - bw;
        if (innerW <= 0 || innerH <= 0) return;
        let radius = innerH / 2.0;

        cr.save();
        this._tracePillPath(cr, offset, offset, innerW, innerH, radius);
        cr.clip();

        cr.setSourceRGBA(0.28, 0.28, 0.32, 0.55);
        cr.rectangle(offset, offset, innerW, innerH);
        cr.fill();

        let pct = Math.max(0, Math.min(100, this.batteryPercentage || 0)) / 100.0;
        let fillW = innerW * pct;
        if (fillW > 0) {
            let [r, g, b, a] = this._parseColor(this.activeFillColor, [0.12, 0.75, 0.31, 0.9]);
            cr.setSourceRGBA(r, g, b, a);
            cr.rectangle(offset, offset, fillW, innerH);
            cr.fill();
        }
        cr.restore();

        if (bw > 0) {
            cr.setLineWidth(bw);
            let [br, bg, bb, ba] = this._parseColor(this.charging_border_color, [1, 1, 1, 0.5]);
            cr.setSourceRGBA(br, bg, bb, ba);
            this._tracePillPath(cr, offset, offset, innerW, innerH, radius);
            cr.stroke();
        }
        cr.$dispose();
    },

    _discoverPowerSupplies: function () {
        let basePath = "/sys/class/power_supply";
        this.acPaths = [];
        try {
            let dir = Gio.File.new_for_path(basePath);
            let enumerator = dir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                let name = info.get_name();
                let fullPath = basePath + "/" + name;
                if (!this.batteryPath && GLib.file_test(fullPath + "/capacity", GLib.FileTest.EXISTS)) {
                    this.batteryPath = fullPath;
                }
                if (GLib.file_test(fullPath + "/online", GLib.FileTest.EXISTS)) {
                    this.acPaths.push(fullPath + "/online");
                }
            }
        } catch (e) {
            // Fallback to BAT0
            this.batteryPath = basePath + "/BAT0";
        }
    },

    setupSettings: function () {
        try {
            this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);

            this.settings.bindProperty(Settings.BindingDirection.IN, "refreshInterval", "refreshInterval", this.updateLoop, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "alertPercentage", "alertPercentage", this.updateUI, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "criticalPercentage", "criticalPercentage", this.updateUI, null);
            
            this.settings.bindProperty(Settings.BindingDirection.IN, "font_name", "font_name", this.updateUI, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "font_size", "font_size", this.updateUI, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "pill_padding_x", "pill_padding_x", this.updateUI, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "pill_padding_y", "pill_padding_y", this.updateUI, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "min_width", "min_width", this.updateUI, null);

            this.settings.bindProperty(Settings.BindingDirection.IN, "normal_background_color", "normal_background_color", this.updateUI, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "alert_background_color", "alert_background_color", this.updateUI, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "limit_exceeded_background_color", "limit_exceeded_background_color", this.updateUI, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "charging_border_color", "charging_border_color", this.updateUI, null);

            this._discoverPowerSupplies();

            this.applet_running = true;
            this.updateLoop();
        } catch (e) {
            global.logError("[" + UUID + "] Settings Error: " + e);
        }
    },

    refreshBattery: function () {
        try {
            if (this.batteryPath && GLib.file_test(this.batteryPath + '/capacity', GLib.FileTest.EXISTS)) {
                let capacityValue = GLib.file_get_contents(this.batteryPath + '/capacity')[1];
                this.batteryPercentage = parseInt(ByteArray.toString(capacityValue));

                let stateValue = GLib.file_get_contents(this.batteryPath + '/status')[1];
                this.batteryState = ByteArray.toString(stateValue).toLowerCase().trim();
            }

            // Check AC adapter 'online' files directly for the fastest possible plug/unplug state
            let online = false;
            for (let i = 0; i < this.acPaths.length; i++) {
                let val = GLib.file_get_contents(this.acPaths[i])[1];
                if (parseInt(ByteArray.toString(val)) === 1) {
                    online = true;
                    break;
                }
            }
            this.acOnline = online;
        } catch (err) {
            global.logError("[" + UUID + "] Battery read error: " + err);
        }
    },

    updateUI: function () {
        try {
            this.refreshBattery();

            if (isNaN(this.batteryPercentage) || this.batteryPercentage < 0 || this.batteryPercentage > 100) {
                this.batteryPercentage = 50; 
            }

            let plugged_in = this._isPluggedIn();
            let critPct = this.criticalPercentage !== undefined ? this.criticalPercentage : 5;

            if (plugged_in) {
                this.activeFillColor = this.normal_background_color || "rgba(30, 190, 80, 0.9)";
            } else if (this.batteryPercentage <= critPct) {
                this.activeFillColor = this.limit_exceeded_background_color || "rgba(255, 0, 0, 1)";
            } else if (this.batteryPercentage <= (this.alertPercentage || 25)) {
                this.activeFillColor = this.alert_background_color || "rgba(255, 165, 0, 1)";
            } else {
                this.activeFillColor = this.normal_background_color || "rgba(30, 190, 80, 0.9)";
            }

            if (this.appletLabel) {
                let padX = this.pill_padding_x !== undefined ? this.pill_padding_x : 6;
                let padY = this.pill_padding_y !== undefined ? this.pill_padding_y : 2;
                let fSize = this.font_size !== undefined ? this.font_size : 100;
                let mWidth = this.min_width !== undefined ? this.min_width : 2.5;
                let fontFamilyCSS = this._getFontFamilyCSS();

                this.appletLabel.set_style(`${fontFamilyCSS} padding: ${padY}px ${padX}px; margin: 0px; font-weight: 700; text-align: center; font-size: ${fSize}%; min-width: ${mWidth}em;`);
                
                let displayText = this.batteryPercentage.toString();
                if (plugged_in && this.batteryPercentage != 100) {
                    displayText = "⚡\uFE0E\u2009" + displayText;
                }
                
                this.appletLabel.set_text(displayText);
            }

            this._syncPillSizeAndRedraw();

            let dState = this.batteryState ? this.batteryState.charAt(0).toUpperCase() + this.batteryState.slice(1) : "Unknown";
            this.set_applet_tooltip("Charge: " + this.batteryPercentage + "% (" + dState + ")");
        } catch (e) {
            global.logError("[" + UUID + "] UI Error: " + e);
        }
    },

    updateLoop: function () {
        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = 0;
        }
        if (this.applet_running) {
            this.updateUI();
            this.timeout = Mainloop.timeout_add_seconds(this.refreshInterval || 30, Lang.bind(this, this.updateLoop));
        }
    },

    on_applet_removed_from_panel: function () {
        this.applet_running = false;
        if (this._upowerSignalId) {
            Gio.DBus.system.signal_unsubscribe(this._upowerSignalId);
            this._upowerSignalId = null;
        }
        if (this._loginSignalId) {
            Gio.DBus.system.signal_unsubscribe(this._loginSignalId);
            this._loginSignalId = null;
        }
        if (this._settleTimeout) {
            Mainloop.source_remove(this._settleTimeout);
            this._settleTimeout = 0;
        }
        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = 0;
        }
        this.settings.finalize();
    }
};

function main(metadata, orientation, panelHeight, instance_id) {
    return new MyApplet(metadata, orientation, panelHeight, instance_id);
}