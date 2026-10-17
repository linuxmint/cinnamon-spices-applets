const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

const Gettext = imports.gettext;

const UUID = "gorebattery@gorehide";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    let translated = Gettext.dgettext(UUID, str);
    return translated !== str ? translated : Gettext.gettext(str);
}

const POWER_DIR = "/sys/class/power_supply";
const decoder = new TextDecoder();

function readFile(path) {
    try {
        let [ok, bytes] = GLib.file_get_contents(path);
        return ok ? decoder.decode(bytes).trim() : null;
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

function listBatteries() {
    return listSupplies()
        .filter(n => readFile(`${POWER_DIR}/${n}/type`) === "Battery")
        .map(n => {
            let model = readFile(`${POWER_DIR}/${n}/model_name`);
            return { name: n, label: model ? `${n} · ${model}` : n };
        });
}

function onAcPower(status) {
    let adapters = listSupplies().filter(n => readFile(`${POWER_DIR}/${n}/type`) === "Mains");
    if (adapters.length > 0)
        return adapters.some(n => readFile(`${POWER_DIR}/${n}/online`) === "1");
    return status === "Charging" || status === "Full";
}

// Las opciones de un combobox son estáticas, así que se regeneran con las
// baterías detectadas antes de cargar los ajustes.
function updateSchema(metadata) {
    try {
        let path = `${metadata.path}/settings-schema.json`;
        let schema = JSON.parse(readFile(path));
        let options = { "Automatic (first battery)": "auto" };
        for (let b of listBatteries())
            options[b.label] = b.name;
        if (JSON.stringify(schema.battery.options) !== JSON.stringify(options)) {
            schema.battery.options = options;
            GLib.file_set_contents(path, JSON.stringify(schema, null, 4));
        }
    } catch (e) {
        global.logError(`GoreBattery: could not update the schema: ${e}`);
    }
}

// Halo rojo pulsante alrededor de cada monitor. No es reactivo, así que no
// intercepta el ratón ni el teclado.
// Acepta "rgb(r,g,b)", "rgba(r,g,b,a)" y "#rrggbb". Devuelve [r, g, b] de 0 a 1.
function parseColor(text) {
    let m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(text || "");
    if (m)
        return [m[1] / 255, m[2] / 255, m[3] / 255];
    m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(text || "");
    if (m)
        return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
    return [1, 0, 0];
}

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

    // Cada borde se dibuja en coordenadas locales: x a lo largo del borde,
    // y negativa hacia el interior de la pantalla.
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
        let [r1, g1, b1] = this.color;
        let [r2, g2, b2] = this.style === "gradient" ? this.color2 : this.color;
        this.forEachEdge(cr, w, h, length => {
            let gradient = new imports.cairo.LinearGradient(0, 0, 0, -size);
            gradient.addColorStopRGBA(0, r1, g1, b1, 0.9);
            gradient.addColorStopRGBA(0.5, r2, g2, b2, 0.5);
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
        Tweener.addTween(actor, {
            opacity: up ? 255 : 90,
            time: 0.9,
            transition: "easeInOutSine",
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
            Tweener.removeTweens(actor);
            Main.uiGroup.remove_child(actor);
            actor.destroy();
        }
        this.actors = [];
    }
}

class BatteryAlertApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.warned = false;
        this.glow = new RedGlow();
        this.iconDir = `${metadata.path}/icons`;
        this.appletName = metadata.name;
        this.previewing = false;
        this.previewKey = null;

        updateSchema(metadata);
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("battery", "battery", this.onSettingsChanged.bind(this));
        this.settings.bind("threshold", "threshold", this.onSettingsChanged.bind(this));
        this.settings.bind("glowDuration", "glowDuration", this.onSettingsChanged.bind(this));
        this.settings.bind("glowStyle", "glowStyle", this.onSettingsChanged.bind(this));
        this.settings.bind("glowColor2", "glowColor2", this.onSettingsChanged.bind(this));
        this.settings.bind("glowColor", "glowColor", this.onSettingsChanged.bind(this));
        this.settings.bind("checkInterval", "checkInterval", this.startTimer.bind(this));
        this.settings.bind("showPercent", "showPercent", this.onSettingsChanged.bind(this));

        this.set_applet_tooltip("GoreBattery");
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

    // Mientras la ventana de configuración está abierta, el halo se muestra
    // siempre (sin límite de tiempo) para ver los cambios en vivo.
    syncPreview() {
        try {
            if (this.settingsWindowOpen()) {
                let options = {
                    style: this.glowStyle,
                    color: this.glowColor,
                    color2: this.glowColor2,
                };
                let key = JSON.stringify(options);
                if (!this.previewing || key !== this.previewKey) {
                    this.previewing = true;
                    this.previewKey = key;
                    this.glow.show(0, options);
                }
            } else if (this.previewing) {
                this.previewing = false;
                this.previewKey = null;
                this.glow.hide();
                this.warned = false;
                this.check();
            }
        } catch (e) {
            global.logError(`GoreBattery: ${e}`);
        }
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

    selectedBattery() {
        let names = listBatteries().map(b => b.name);
        if (names.includes(this.battery))
            return this.battery;
        return names.length > 0 ? names[0] : null;
    }

    iconFor(level, plugged) {
        let step = Math.min(100, Math.round(level / 10) * 10);
        let name = String(step).padStart(2, "0");
        return `${this.iconDir}/level-${name}${plugged ? "-charging" : ""}.svg`;
    }

    check() {
        try {
            this.doCheck();
        } catch (e) {
            global.logError(`GoreBattery: ${e}`);
        }
    }

    doCheck() {
        this.syncPreview();
        let name = this.selectedBattery();
        let level = name ? parseInt(readFile(`${POWER_DIR}/${name}/capacity`)) : NaN;
        if (isNaN(level)) {
            this.set_applet_icon_symbolic_name("battery-missing-symbolic");
            this.set_applet_label("");
            this.set_applet_tooltip(_("Battery not available"));
            return;
        }

        let status = readFile(`${POWER_DIR}/${name}/status`);
        let plugged = onAcPower(status);
        this.set_applet_icon_path(this.iconFor(level, plugged));
        this.set_applet_label(this.showPercent ? `${level}%` : "");
        this.set_applet_tooltip(
            `${name}: ${level}% · ${plugged ? _("plugged in") : _("on battery")}\n` +
            `${_("Alert below")} ${this.threshold}%`);

        if (this.previewing) {
            return;
        } else if (plugged || level > this.threshold) {
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
        this.glow.hide();
        if (this.previewTimeoutId) {
            Mainloop.source_remove(this.previewTimeoutId);
            this.previewTimeoutId = null;
        }
        if (this.timeoutId) {
            Mainloop.source_remove(this.timeoutId);
            this.timeoutId = null;
        }
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new BatteryAlertApplet(metadata, orientation, panelHeight, instanceId);
}
