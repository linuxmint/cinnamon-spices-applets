/*
 * Pantalla — applet de Cinnamon para brillo y temperatura de color.
 * Copyright (C) 2026 Jorge Senosiain — apps.culturoscope.es
 * Licencia: GPL-3.0-or-later. Ver el archivo LICENSE.
 *
 * Motor: xrandr (por software). El brillo y la temperatura viajan en la misma
 * tabla de color del GPU, así que no dependen del firmware del monitor ni de
 * permisos especiales. Se aplican a todas las salidas conectadas, detectadas
 * en caliente.
 *
 * Reparto: el MENÚ (clic izquierdo) es para el uso diario —sliders, aplicar un
 * modo, guardar valores—. La CONFIGURACIÓN —modos, automático, brillo mínimo—
 * vive en el diálogo de Cinnamon (clic derecho → Configurar, o "Configuración…"
 * en el menú). Ver 01 Documentacion/.
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;

// Rango de temperatura del slider: izquierda cálido, derecha neutro.
const TEMP_MIN = 2500;   // K, muy cálido
const TEMP_MAX = 6500;   // K, neutro (sin tinte)
const APPLY_DEBOUNCE_MS = 150;

// D-Bus del Night Light de Cinnamon (para el modo automático día/noche).
const COLOR_BUS  = "org.cinnamon.SettingsDaemon.Color";
const COLOR_PATH = "/org/cinnamon/SettingsDaemon/Color";

function _toStr(data) {
    if (data instanceof Uint8Array) return new TextDecoder().decode(data);
    return ("" + data);
}

function _clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// Kelvin -> "R:G:B" para `xrandr --gamma`. Aproximación de Tanner Helland,
// normalizada al canal máximo (mantiene el brillo, solo tiñe). A 6500 K queda
// prácticamente 1:1:1 (sin tinte); por debajo, reduce verde y azul (cálido).
function kelvinToGamma(kelvin) {
    let t = kelvin / 100;
    let r, g, b;

    if (t <= 66) r = 255;
    else r = 329.698727446 * Math.pow(t - 60, -0.1332047592);

    if (t <= 66) g = 99.4708025861 * Math.log(t) - 161.1195681661;
    else g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);

    if (t >= 66) b = 255;
    else if (t <= 19) b = 0;
    else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;

    r = _clamp(r, 0, 255);
    g = _clamp(g, 0, 255);
    b = _clamp(b, 0, 255);

    let max = Math.max(r, g, b) || 1;
    r = Math.max(r / max, 0.10);
    g = Math.max(g / max, 0.10);
    b = Math.max(b / max, 0.10);

    return r.toFixed(3) + ":" + g.toFixed(3) + ":" + b.toFixed(3);
}

function PantallaApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

PantallaApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this._outputs = [];
        this._applyTimeoutId = 0;
        this._colorProxy = null;
        this._colorSignalId = 0;
        this._monitorsChangedId = 0;
        this._version = (metadata && metadata.version) || "?";

        try {
            this.set_applet_icon_symbolic_name("display-brightness");
            this.set_applet_tooltip("Brillo y temperatura de la pantalla");

            // Ajustes (ver settings-schema.json). La configuración se edita en
            // el diálogo de Cinnamon; aquí solo los leemos / reaccionamos.
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
            this.settings.bind("brightness", "brightness");
            this.settings.bind("temperature", "temperature");
            this.settings.bind("min-brightness", "minBrightness");
            this.settings.bind("modes", "modes", () => this._rebuildModesUI());
            this.settings.bind("auto-night", "autoNight", () => this._onAutoToggled());
            this.settings.bind("auto-day", "autoDay", () => this._onAutoToggled());
            this.settings.bind("night-mode", "nightModeName");
            this.settings.bind("day-mode", "dayModeName");

            // Menú (uso diario).
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            this.menu.connect("open-state-changed", (m, open) => { if (open) this._collapseSubmenus(); });

            this._buildMenu();
            this._detectOutputs();

            this._monitorsChangedId = Main.layoutManager.connect(
                "monitors-changed", () => { this._detectOutputs(); this._apply(); });

            // Reaplicar el último estado guardado al cargar (al iniciar sesión).
            this._syncSlidersFromState();
            this._apply();

            if (this.autoNight || this.autoDay) this._startAutoWatch();
        } catch (e) {
            global.logError("[pantallas@jorge] error en _init: " + e);
        }
    },

    on_applet_clicked: function() {
        this.menu.toggle();
    },

    // ---- Menú (uso diario) ------------------------------------------------

    _buildMenu: function() {
        this.brightnessLabel = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.brightnessLabel.actor.add_style_class_name("pantalla-label");
        this.menu.addMenuItem(this.brightnessLabel);

        this.brightnessSlider = new PopupMenu.PopupSliderMenuItem(this._brightnessToSlider());
        this.brightnessSlider.actor.add_style_class_name("pantalla-slider");
        this.brightnessSlider.connect("value-changed", (slider, value) => {
            if (value === undefined) value = slider.value;
            let pct = Math.round(value * 100);
            let floor = this.minBrightness || 10;
            if (pct < floor) { pct = floor; slider.setValue(pct / 100); }  // no bajar del mínimo
            this.brightness = pct;
            this._updateLabels();
            this._scheduleApply();
        });
        this.menu.addMenuItem(this.brightnessSlider);

        this.temperatureLabel = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.temperatureLabel.actor.add_style_class_name("pantalla-label");
        this.menu.addMenuItem(this.temperatureLabel);

        this.temperatureSlider = new PopupMenu.PopupSliderMenuItem(this._temperatureToSlider());
        this.temperatureSlider.actor.add_style_class_name("pantalla-slider");
        this.temperatureSlider.connect("value-changed", (slider, value) => {
            if (value === undefined) value = slider.value;
            this.temperature = Math.round(TEMP_MIN + value * (TEMP_MAX - TEMP_MIN));
            this._updateLabels();
            this._scheduleApply();
        });
        this.menu.addMenuItem(this.temperatureSlider);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Aplicar modos + "Guardar valores actuales en…".
        this._modesSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._modesSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Abre el diálogo de Cinnamon, donde vive la configuración.
        let config = new PopupMenu.PopupMenuItem("Configuración…");
        config.connect("activate", () => this._openSettings());
        this.menu.addMenuItem(config);

        this._updateLabels();
        this._rebuildModesUI();
    },

    _rebuildModesUI: function() {
        if (!this._modesSection) return;
        this._modesSection.removeAll();

        let modes = this._getModes();

        this._modeItems = [];
        for (let i = 0; i < modes.length; i++) {
            let idx = i;
            let item = new PopupMenu.PopupMenuItem(modes[i].name);
            item.connect("activate", () => {
                let m = this._getModes()[idx];   // valor actual, no el capturado al construir el menú
                if (m) this._applyMode(m);
            });
            this._modesSection.addMenuItem(item);
            this._modeItems.push({ item: item, idx: idx });
        }

        this._saveSubmenu = new PopupMenu.PopupSubMenuMenuItem("Guardar valores actuales en…");
        for (let i = 0; i < modes.length; i++) {
            let idx = i;
            let sub = new PopupMenu.PopupMenuItem(modes[i].name);
            sub.connect("activate", () => this._saveCurrentToMode(idx));
            this._saveSubmenu.menu.addMenuItem(sub);
        }
        this._modesSection.addMenuItem(this._saveSubmenu);

        this._updateActiveMarks();
    },

    // Marca con un punto el modo cuyos valores coinciden con el estado actual.
    _updateActiveMarks: function() {
        if (!this._modeItems) return;
        let modes = this._getModes();
        let b = Math.round(this.brightness), t = Math.round(this.temperature);
        for (let mi of this._modeItems) {
            let mode = modes[mi.idx];
            let active = !!mode && mode.brightness === b && mode.temperature === t;
            if (mi.item._activeMark === active) continue;   // evita trabajo redundante
            mi.item._activeMark = active;
            if (typeof mi.item.setShowDot === "function") {
                mi.item.setShowDot(active);   // crea/destruye el punto de forma fiable (setOrnament(NONE) no limpia)
            }
        }
    },

    _collapseSubmenus: function() {
        if (this._saveSubmenu && this._saveSubmenu.menu) this._saveSubmenu.menu.close(false);
    },

    _openSettings: function() {
        // Método público de Cinnamon: idéntico al "Configurar" del clic derecho.
        try { this.configureApplet(); }
        catch (e) { global.logError("[pantallas@jorge] no se pudo abrir la configuración: " + e); }
    },

    // ---- Estado y etiquetas ----------------------------------------------

    _brightnessToSlider: function() {
        return _clamp(this.brightness / 100, 0, 1);
    },

    _temperatureToSlider: function() {
        return _clamp((this.temperature - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), 0, 1);
    },

    _syncSlidersFromState: function() {
        if (this.brightnessSlider) this.brightnessSlider.setValue(this._brightnessToSlider());
        if (this.temperatureSlider) this.temperatureSlider.setValue(this._temperatureToSlider());
        this._updateLabels();
    },

    _updateLabels: function() {
        if (this.brightnessLabel)
            this.brightnessLabel.label.text = "☀ Brillo: " + Math.round(this.brightness) + "%";
        if (this.temperatureLabel)
            this.temperatureLabel.label.text = "🌙 Temperatura: " + Math.round(this.temperature) + " K";
        this.set_applet_tooltip(
            "Pantalla v" + (this._version || "?") +
            " · Brillo " + Math.round(this.brightness) + "% · " + Math.round(this.temperature) + " K");
        this._updateActiveMarks();
    },

    // ---- Modos ------------------------------------------------------------

    _getModes: function() {
        let modes = this.modes;
        if (!modes || !modes.length) {
            modes = [
                { name: "Día", brightness: 100, temperature: 6500 },
                { name: "Noche", brightness: 60, temperature: 3400 }
            ];
        }
        return modes;
    },

    _findMode: function(name) {
        let modes = this._getModes();
        for (let m of modes) if (m.name === name) return m;
        return null;
    },

    _applyMode: function(mode) {
        this.brightness = _clamp(mode.brightness, 1, 100);
        this.temperature = _clamp(mode.temperature, TEMP_MIN, TEMP_MAX);
        this._syncSlidersFromState();
        this._apply();
    },

    _saveCurrentToMode: function(index) {
        let modes = this._getModes().slice();
        if (index < 0 || index >= modes.length) return;
        modes[index] = {
            name: modes[index].name,
            brightness: Math.round(this.brightness),
            temperature: Math.round(this.temperature)
        };
        this.modes = modes;
        this._rebuildModesUI();   // el callback de bind no salta en auto-asignación: refrescar a mano
    },

    // ---- Aplicación vía xrandr -------------------------------------------

    _detectOutputs: function() {
        this._outputs = [];
        try {
            let [ok, out] = GLib.spawn_command_line_sync("xrandr --query");
            if (ok && out) {
                let lines = _toStr(out).split("\n");
                for (let line of lines) {
                    let m = line.match(/^(\S+)\s+connected/);
                    if (m) this._outputs.push(m[1]);
                }
            }
        } catch (e) {
            global.logError("[pantallas@jorge] no se pudieron detectar salidas: " + e);
        }
    },

    _scheduleApply: function() {
        if (this._applyTimeoutId) Mainloop.source_remove(this._applyTimeoutId);
        this._applyTimeoutId = Mainloop.timeout_add(APPLY_DEBOUNCE_MS, () => {
            this._applyTimeoutId = 0;
            this._apply();
            return false; // no repetir
        });
    },

    _apply: function() {
        if (!this._outputs.length) return;
        let floor = (this.minBrightness || 10) / 100;
        let b = _clamp(this.brightness / 100, floor, 1);
        let gamma = kelvinToGamma(this.temperature);

        let parts = ["xrandr"];
        for (let o of this._outputs)
            parts.push("--output " + o + " --brightness " + b.toFixed(3) + " --gamma " + gamma);

        try {
            Util.spawnCommandLine(parts.join(" "));
        } catch (e) {
            global.logError("[pantallas@jorge] fallo al aplicar xrandr: " + e);
        }
    },

    // ---- Automático día/noche (Night Light de Cinnamon) -------------------

    _onAutoToggled: function() {
        if (this.autoNight || this.autoDay) this._startAutoWatch();
        else this._stopAutoWatch();
        if (this._colorProxy) this._onNightLightChanged();
    },

    _startAutoWatch: function() {
        if (this._colorProxy) return;
        try {
            this._colorProxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, null,
                COLOR_BUS, COLOR_PATH, COLOR_BUS, null);

            this._colorSignalId = this._colorProxy.connect(
                "g-properties-changed", () => this._onNightLightChanged());

            this._onNightLightChanged();
        } catch (e) {
            global.logError("[pantallas@jorge] no se pudo conectar al Night Light de Cinnamon: " + e);
            this._colorProxy = null;
        }
    },

    _stopAutoWatch: function() {
        if (this._colorProxy && this._colorSignalId) {
            try { this._colorProxy.disconnect(this._colorSignalId); } catch (e) {}
        }
        this._colorSignalId = 0;
        this._colorProxy = null;
    },

    _onNightLightChanged: function() {
        if (!this._colorProxy) return;
        let v = this._colorProxy.get_cached_property("NightLightActive");
        if (!v) return;
        let isNight = v.get_boolean();
        let mode = null;
        if (isNight && this.autoNight) mode = this._findMode(this.nightModeName);
        else if (!isNight && this.autoDay) mode = this._findMode(this.dayModeName);
        if (mode) this._applyMode(mode);
    },

    // ---- Limpieza ---------------------------------------------------------

    on_applet_removed_from_panel: function() {
        if (this._applyTimeoutId) Mainloop.source_remove(this._applyTimeoutId);
        if (this._monitorsChangedId)
            Main.layoutManager.disconnect(this._monitorsChangedId);
        this._stopAutoWatch();
        if (this.settings) this.settings.finalize();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new PantallaApplet(metadata, orientation, panel_height, instance_id);
}
