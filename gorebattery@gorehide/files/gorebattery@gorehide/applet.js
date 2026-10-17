const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;

const UUID = "gorebattery@gorehide";
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    let translated = Gettext.dgettext(UUID, str);
    return translated !== str ? translated : Gettext.gettext(str);
}

Gio._promisify(Gio.File.prototype, "load_contents_async", "load_contents_finish");
Gio._promisify(Gio.File.prototype, "replace_contents_async", "replace_contents_finish");

const POWER_DIR = "/sys/class/power_supply";
const decoder = new TextDecoder();
const encoder = new TextEncoder();

async function readFile(path) {
    try {
        let [bytes] = await Gio.File.new_for_path(path).load_contents_async(null);
        return decoder.decode(bytes).trim();
    } catch (e) {
        return null;
    }
}

function listSupplies() {
    let names = [];
    try {
        let dir = GLib.Dir.open(POWER_DIR, 0);
        let name;
        while ((name = dir.read_name()) !== null)
            names.push(name);
    } catch (e) {}
    return names.sort();
}

async function listBatteries() {
    let batteries = [];
    for (let name of listSupplies()) {
        if (await readFile(`${POWER_DIR}/${name}/type`) !== "Battery")
            continue;
        let model = await readFile(`${POWER_DIR}/${name}/model_name`);
        batteries.push({ name, label: model ? `${name} · ${model}` : name });
    }
    return batteries;
}

async function onAcPower(status) {
    let adapters = [];
    for (let name of listSupplies()) {
        if (await readFile(`${POWER_DIR}/${name}/type`) === "Mains")
            adapters.push(name);
    }
    if (adapters.length > 0) {
        for (let name of adapters) {
            if (await readFile(`${POWER_DIR}/${name}/online`) === "1")
                return true;
        }
        return false;
    }
    return status === "Charging" || status === "Full";
}

// The options of a combobox are static, so they are regenerated with the
// detected batteries before the settings are loaded.
async function updateSchema(metadata) {
    try {
        let path = `${metadata.path}/settings-schema.json`;
        let schema = JSON.parse(await readFile(path));
        let options = { "Automatic (first battery)": "auto" };
        for (let b of await listBatteries())
            options[b.label] = b.name;
        if (JSON.stringify(schema.battery.options) !== JSON.stringify(options)) {
            schema.battery.options = options;
            let bytes = encoder.encode(JSON.stringify(schema, null, 4));
            await Gio.File.new_for_path(path).replace_contents_async(
                bytes, null, false, Gio.FileCreateFlags.NONE, null);
        }
    } catch (e) {
        global.logError(`GoreBattery: could not update the schema: ${e}`);
    }
}

// Accepts "rgb(r,g,b)", "rgba(r,g,b,a)" and "#rrggbb". Returns [r, g, b, a] from 0 to 1.
function parseColor(text) {
    let m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/.exec(text || "");
    if (m) {
        let alpha = m[4] === undefined ? 1 : Math.min(1, Math.max(0, parseFloat(m[4])));
        return [m[1] / 255, m[2] / 255, m[3] / 255, alpha];
    }
    m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(text || "");
    if (m)
        return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255, 1];
    return [1, 0, 0, 1];
}

// Glow around the edges of every monitor. The actors are not reactive, so
// they never intercept the mouse or the keyboard.
class RedGlow {
    constructor() {
        this.actors = [];
        this.hideTimeoutId = null;
        this.frameTimeoutId = null;
    }

    // options: { style: "glow" | "gradient" | "fire", color, color2 }
    show(durationSeconds, options) {
        this.hide();
        this.style = options.style;
        this.color = parseColor(options.color);
        this.color2 = parseColor(options.color2);
        this.startTime = Date.now();
        for (let m of Main.layoutManager.monitors) {
            let actor = new St.DrawingArea({
                reactive: false,
                x: m.x, y: m.y, width: m.width, height: m.height,
                opacity: this.style === "fire" ? 255 : 0,
            });
            actor.connect("repaint", area => this.paint(area));
            Main.uiGroup.add_child(actor);
            this.actors.push(actor);
            if (this.style !== "fire")
                this.pulse(actor, true);
        }
        if (this.style === "fire") {
            this.frameTimeoutId = Mainloop.timeout_add(50, () => {
                this.actors.forEach(a => a.queue_repaint());
                return true;
            });
        }
        if (durationSeconds > 0) {
            this.hideTimeoutId = Mainloop.timeout_add_seconds(durationSeconds, () => {
                this.hideTimeoutId = null;
                this.hide();
                return false;
            });
        }
    }

    paint(area) {
        let [w, h] = area.get_surface_size();
        let cr = area.get_context();
        let size = Math.max(60, Math.round(Math.min(w, h) * 0.12));
        if (this.style === "fire")
            this.paintFire(cr, w, h, Math.round(size * 1.6));
        else
            this.paintGradient(cr, w, h, size);
        cr.$dispose();
    }

    // Every edge is drawn in local coordinates: x along the edge and
    // negative y towards the inside of the screen.
    forEachEdge(cr, w, h, draw) {
        let edges = [
            [() => cr.translate(0, h), w],
            [() => { cr.translate(w, 0); cr.rotate(Math.PI); }, w],
            [() => cr.rotate(Math.PI / 2), h],
            [() => { cr.translate(w, h); cr.rotate(-Math.PI / 2); }, h],
        ];
        for (let [transform, length] of edges) {
            cr.save();
            transform();
            draw(length);
            cr.restore();
        }
    }

    paintGradient(cr, w, h, size) {
        let [r1, g1, b1, a1] = this.color;
        let [r2, g2, b2, a2] = this.style === "gradient" ? this.color2 : this.color;
        this.forEachEdge(cr, w, h, length => {
            let gradient = new imports.cairo.LinearGradient(0, 0, 0, -size);
            gradient.addColorStopRGBA(0, r1, g1, b1, 0.9 * a1);
            gradient.addColorStopRGBA(0.5, r2, g2, b2, 0.5 * a2);
            gradient.addColorStopRGBA(1, r2, g2, b2, 0);
            cr.setSource(gradient);
            cr.rectangle(0, -size, length, size);
            cr.fill();
        });
    }

    paintFire(cr, w, h, size) {
        let t = (Date.now() - this.startTime) / 1000;
        this.forEachEdge(cr, w, h, length => {
            let gradient = new imports.cairo.LinearGradient(0, 0, 0, -size);
            gradient.addColorStopRGBA(0, 1, 0.95, 0.3, 0.95);
            gradient.addColorStopRGBA(0.3, 1, 0.55, 0.05, 0.85);
            gradient.addColorStopRGBA(0.7, 0.85, 0.12, 0, 0.45);
            gradient.addColorStopRGBA(1, 0.6, 0, 0, 0);
            cr.setSource(gradient);
            cr.moveTo(0, 0);
            for (let x = 0; x <= length; x += 4) {
                let n = 0.5 * Math.sin(x * 0.02 + t * 3.1) +
                        0.3 * Math.sin(x * 0.055 - t * 5.3) +
                        0.2 * Math.abs(Math.sin(x * 0.11 + t * 7.7));
                cr.lineTo(x, -size * (0.4 + 0.6 * (n + 0.5) / 1.5));
            }
            cr.lineTo(length, 0);
            cr.closePath();
            cr.fill();
        });
    }

    pulse(actor, up) {
        actor.ease({
            opacity: up ? 255 : 90,
            duration: 900,
            mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
            onComplete: () => {
                if (this.actors.includes(actor))
                    this.pulse(actor, !up);
            },
        });
    }

    hide() {
        for (let id of [this.hideTimeoutId, this.frameTimeoutId]) {
            if (id)
                Mainloop.source_remove(id);
        }
        this.hideTimeoutId = null;
        this.frameTimeoutId = null;
        for (let actor of this.actors) {
            actor.remove_all_transitions();
            Main.uiGroup.remove_child(actor);
            actor.destroy();
        }
        this.actors = [];
    }
}

// Thin static border around every monitor, shown while the computer is
// running on battery. Like the glow, it never captures input.
class ScreenBorder {
    constructor() {
        this.actors = [];
        this.key = null;
    }

    // Re-creates the actors only when something that affects them changed.
    show(color, width) {
        let key = JSON.stringify([color, width, Main.layoutManager.monitors.map(
            m => [m.x, m.y, m.width, m.height])]);
        if (key === this.key)
            return;
        this.hide();
        this.key = key;
        let [r, g, b, a] = parseColor(color);
        for (let m of Main.layoutManager.monitors) {
            let actor = new St.DrawingArea({
                reactive: false,
                x: m.x, y: m.y, width: m.width, height: m.height,
            });
            actor.connect("repaint", area => {
                let [w, h] = area.get_surface_size();
                let cr = area.get_context();
                cr.setSourceRGBA(r, g, b, a);
                cr.setLineWidth(width);
                cr.rectangle(width / 2, width / 2, w - width, h - width);
                cr.stroke();
                cr.$dispose();
            });
            Main.uiGroup.add_child(actor);
            this.actors.push(actor);
        }
    }

    hide() {
        this.key = null;
        for (let actor of this.actors) {
            Main.uiGroup.remove_child(actor);
            actor.destroy();
        }
        this.actors = [];
    }
}

class GoreBatteryApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.warned = false;
        this.glow = new RedGlow();
        this.border = new ScreenBorder();
        this.unplugged = false;
        this.iconDir = `${metadata.path}/icons`;
        this.appletName = metadata.name;
        this.previewing = false;
        this.previewKey = null;
        this.settings = null;
        this.removed = false;
        this.checking = false;
        this.pendingCheck = false;

        this.set_applet_tooltip("GoreBattery");
        this.initialize(metadata, instanceId).catch(e =>
            global.logError(`GoreBattery: ${e}`));
    }

    async initialize(metadata, instanceId) {
        await updateSchema(metadata);
        if (this.removed)
            return;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        let changed = this.onSettingsChanged.bind(this);
        for (let key of ["battery", "threshold", "glowDuration", "glowStyle",
                         "glowColor", "glowColor2", "showGlow", "showPercent", "showBorder", "borderWidth", "borderColor"])
            this.settings.bind(key, key, changed);
        this.settings.bind("checkInterval", "checkInterval", this.startTimer.bind(this));

        this.check();
        this.startTimer();
        this.previewTimeoutId = Mainloop.timeout_add(500, () => {
            this.syncPreview();
            return true;
        });
    }

    settingsWindowOpen() {
        return global.get_window_actors().some(a => {
            let w = a.meta_window;
            return w.get_wm_class() === "Xlet-settings.py" && w.get_title() === this.appletName;
        });
    }

    // While the settings window is open the glow is always shown (without a
    // time limit) so the changes can be seen live.
    syncPreview() {
        try {
            if (this.settingsWindowOpen()) {
                let options = {
                    style: this.glowStyle,
                    color: this.glowColor,
                    color2: this.glowColor2,
                };
                let key = JSON.stringify([options, this.showGlow]);
                if (!this.previewing || key !== this.previewKey) {
                    this.previewing = true;
                    this.previewKey = key;
                    if (this.showGlow)
                        this.glow.show(0, options);
                    else
                        this.glow.hide();
                }
            } else if (this.previewing) {
                this.previewing = false;
                this.previewKey = null;
                this.glow.hide();
                this.warned = false;
                this.check();
            }
            this.updateBorder();
        } catch (e) {
            global.logError(`GoreBattery: ${e}`);
        }
    }

    // The border is shown while unplugged (whatever the charge level) and
    // also during the settings preview, so its color and width can be seen.
    updateBorder() {
        if (this.showBorder && (this.previewing || this.unplugged))
            this.border.show(this.borderColor, Math.max(1, parseInt(this.borderWidth) || 2));
        else
            this.border.hide();
    }

    startTimer() {
        if (this.timeoutId)
            Mainloop.source_remove(this.timeoutId);
        let seconds = Math.max(1, parseInt(this.checkInterval) || 1);
        this.timeoutId = Mainloop.timeout_add_seconds(seconds, () => {
            this.check();
            return true;
        });
    }

    onSettingsChanged() {
        this.warned = false;
        this.check();
    }

    async selectedBattery() {
        let names = (await listBatteries()).map(b => b.name);
        if (names.includes(this.battery))
            return this.battery;
        return names.length > 0 ? names[0] : null;
    }

    iconFor(level, plugged) {
        let step = Math.min(100, Math.round(level / 10) * 10);
        let name = String(step).padStart(2, "0");
        return `${this.iconDir}/level-${name}${plugged ? "-charging" : ""}.svg`;
    }

    // Checks never overlap: if one is requested while another is running,
    // it runs once more right after the current one finishes.
    async check() {
        if (this.checking) {
            this.pendingCheck = true;
            return;
        }
        this.checking = true;
        try {
            do {
                this.pendingCheck = false;
                await this.doCheck();
            } while (this.pendingCheck && !this.removed);
        } catch (e) {
            global.logError(`GoreBattery: ${e}`);
        } finally {
            this.checking = false;
        }
    }

    async doCheck() {
        this.syncPreview();
        let name = await this.selectedBattery();
        let level = name ? parseInt(await readFile(`${POWER_DIR}/${name}/capacity`)) : NaN;
        let status = isNaN(level) ? null : await readFile(`${POWER_DIR}/${name}/status`);
        let plugged = isNaN(level) ? false : await onAcPower(status);
        if (this.removed)
            return;

        this.unplugged = !isNaN(level) && !plugged;
        this.updateBorder();

        if (isNaN(level)) {
            this.set_applet_icon_symbolic_name("battery-missing-symbolic");
            this.set_applet_label("");
            this.set_applet_tooltip(_("Battery not available"));
            return;
        }

        this.set_applet_icon_path(this.iconFor(level, plugged));
        this.set_applet_label(this.showPercent ? `${level}%` : "");
        this.set_applet_tooltip(
            `${name}: ${level}% · ${plugged ? _("plugged in") : _("on battery")}\n` +
            `${_("Alert below")} ${this.threshold}%`);

        if (this.previewing) {
            return;
        } else if (plugged || level > this.threshold || !this.showGlow) {
            this.warned = false;
            this.glow.hide();
        } else if (!this.warned) {
            this.warned = true;
            this.glow.show(this.glowDuration, {
                style: this.glowStyle,
                color: this.glowColor,
                color2: this.glowColor2,
            });
        }
    }

    on_applet_removed_from_panel() {
        this.removed = true;
        this.glow.hide();
        this.border.hide();
        if (this.previewTimeoutId) {
            Mainloop.source_remove(this.previewTimeoutId);
            this.previewTimeoutId = null;
        }
        if (this.timeoutId) {
            Mainloop.source_remove(this.timeoutId);
            this.timeoutId = null;
        }
        if (this.settings)
            this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new GoreBatteryApplet(metadata, orientation, panelHeight, instanceId);
}
