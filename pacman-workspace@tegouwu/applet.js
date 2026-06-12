const Applet   = imports.ui.applet;
const Settings = imports.ui.settings;
const St       = imports.gi.St;
const Meta     = imports.gi.Meta;
const GLib     = imports.gi.GLib;
const Lang     = imports.lang;

const UUID = "pacman-workspace@tegouwu";

// Colores clásicos de los fantasmas: Blinky, Pinky, Inky, Clyde
const GHOST_COLORS = [
    [1.00, 0.20, 0.20, 1.0],   // Blinky - rojo
    [1.00, 0.72, 1.00, 1.0],   // Pinky  - rosa
    [0.40, 0.90, 1.00, 1.0],   // Inky   - cian
    [1.00, 0.72, 0.32, 1.0],   // Clyde  - naranja
];

// ---------- Color helpers ----------

function parseColor(str) {
    if (!str) return [1, 0.85, 0, 1];

    let m = str.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
    if (m) return [
        parseInt(m[1]) / 255,
        parseInt(m[2]) / 255,
        parseInt(m[3]) / 255,
        m[4] !== undefined ? parseFloat(m[4]) / (parseFloat(m[4]) > 1 ? 255 : 1) : 1
    ];

    m = str.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/);
    if (m) return [
        parseInt(m[1], 16) / 255,
        parseInt(m[2], 16) / 255,
        parseInt(m[3], 16) / 255,
        m[4] ? parseInt(m[4], 16) / 255 : 1
    ];

    return [1, 0.85, 0, 1];
}

function disposeCr(cr) {
    try { cr.$dispose(); } catch (_) {}
}

function safeCorner() {
    if (Meta.ScreenCorner && Meta.ScreenCorner.TOPLEFT !== undefined)
        return Meta.ScreenCorner.TOPLEFT;
    return 0;
}

// ---------- Draw functions ----------

function drawPellet(area, color) {
    let cr;
    try { cr = area.get_context(); } catch (e) { return; }

    let [w, h] = [0, 0];
    try { [w, h] = area.get_surface_size(); } catch (e) {}
    if (w < 2 || h < 2) { disposeCr(cr); return; }

    cr.setSourceRGBA(0, 0, 0, 0);
    cr.setOperator(1);
    cr.paint();
    cr.setOperator(2);

    let cx = w / 2, cy = h / 2;
    let r  = Math.min(w, h) / 2 - 1;

    // Punto clásico de Pac-Man: círculo pequeño centrado
    cr.setSourceRGBA(color[0], color[1], color[2], color[3]);
    cr.arc(cx, cy, r * 0.28, 0, 2 * Math.PI);
    cr.fill();

    disposeCr(cr);
}

function drawPacman(area, color, mouthAngle) {
    let cr;
    try { cr = area.get_context(); } catch (e) { return; }

    let [w, h] = [0, 0];
    try { [w, h] = area.get_surface_size(); } catch (e) {}
    if (w < 2 || h < 2) { disposeCr(cr); return; }

    cr.setSourceRGBA(0, 0, 0, 0);
    cr.setOperator(1); // SOURCE
    cr.paint();
    cr.setOperator(2); // OVER

    let cx = w / 2, cy = h / 2;
    let r  = Math.min(w, h) / 2 - 1;
    let ma = (mouthAngle !== undefined) ? mouthAngle : Math.PI / 5;

    cr.setSourceRGBA(color[0], color[1], color[2], color[3]);
    cr.moveTo(cx, cy);
    cr.arc(cx, cy, r, ma, 2 * Math.PI - ma);
    cr.closePath();
    cr.fill();

    // Ojo
    cr.setSourceRGBA(0, 0, 0, 1);
    cr.arc(cx + r * 0.15, cy - r * 0.45, r * 0.1, 0, 2 * Math.PI);
    cr.fill();

    disposeCr(cr);
}

function drawGhost(area, bodyColor, eyeColor) {
    let cr;
    try { cr = area.get_context(); } catch (e) { return; }

    let [w, h] = [0, 0];
    try { [w, h] = area.get_surface_size(); } catch (e) {}
    if (w < 2 || h < 2) { disposeCr(cr); return; }

    cr.setSourceRGBA(0, 0, 0, 0);
    cr.setOperator(1);
    cr.paint();
    cr.setOperator(2);

    let cx = w / 2, cy = h / 2;
    let r  = Math.min(w, h) / 2 - 1;

    // Cuerpo
    cr.setSourceRGBA(bodyColor[0], bodyColor[1], bodyColor[2], bodyColor[3]);
    cr.arc(cx, cy - r * 0.15, r, Math.PI, 0);
    cr.lineTo(cx + r, cy + r * 0.85);
    let ww = (r * 2) / 3;
    for (let i = 0; i < 3; i++) {
        let wx = cx + r - i * ww - ww / 2;
        if (i % 2 === 0) cr.arcNegative(wx, cy + r * 0.85, ww / 2, 0, Math.PI);
        else             cr.arc(wx,         cy + r * 0.85, ww / 2, Math.PI, 0);
    }
    cr.lineTo(cx - r, cy - r * 0.15);
    cr.fill();

    // Esclerótica (blanco)
    cr.setSourceRGBA(1, 1, 1, 1);
    cr.arc(cx - r * 0.3, cy - r * 0.2, r * 0.18, 0, 2 * Math.PI);
    cr.fill();
    cr.arc(cx + r * 0.3, cy - r * 0.2, r * 0.18, 0, 2 * Math.PI);
    cr.fill();

    // Pupilas
    cr.setSourceRGBA(eyeColor[0], eyeColor[1], eyeColor[2], eyeColor[3]);
    cr.arc(cx - r * 0.22, cy - r * 0.15, r * 0.09, 0, 2 * Math.PI);
    cr.fill();
    cr.arc(cx + r * 0.38, cy - r * 0.15, r * 0.09, 0, 2 * Math.PI);
    cr.fill();

    disposeCr(cr);
}

// Puntos blancos que indican nº de ventanas (máx 5)
function drawWindowDots(area, count) {
    if (count <= 0) return;
    let cr;
    try { cr = area.get_context(); } catch (e) { return; }

    let [w, h] = [0, 0];
    try { [w, h] = area.get_surface_size(); } catch (e) {}
    if (w < 2 || h < 2) { disposeCr(cr); return; }

    let r      = Math.min(w, h) / 2 - 1;
    let dotR   = Math.max(1.2, r * 0.09);
    let dotY   = h - dotR - 1.5;
    let gap    = dotR * 2.6;
    let startX = w / 2 - ((count - 1) * gap) / 2;

    cr.setSourceRGBA(1, 1, 1, 0.9);
    for (let d = 0; d < count; d++) {
        cr.arc(startX + d * gap, dotY, dotR, 0, 2 * Math.PI);
        cr.fill();
    }
    disposeCr(cr);
}

// ---------- Workspace management ----------

function setupWorkspaceGrid(cols, rows) {
    try {
        let target  = cols * rows;
        let screen  = global.screen || global.workspace_manager;
        let current = screen.n_workspaces;

        // Proteger el escritorio activo al reducir
        if (target < current) {
            let active = screen.get_active_workspace_index();
            if (active >= target) {
                let safe = screen.get_workspace_by_index(target - 1);
                if (safe) safe.activate(global.get_current_time());
            }
            for (let i = current; i > target; i--) {
                let ws = screen.get_workspace_by_index(screen.n_workspaces - 1);
                if (ws) screen.remove_workspace(ws, global.get_current_time());
            }
        } else if (target > current) {
            for (let i = current; i < target; i++)
                screen.append_new_workspace(false, global.get_current_time());
        }

        if (global.screen && global.screen.override_workspace_layout)
            global.screen.override_workspace_layout(safeCorner(), false, rows, cols);
    } catch (e) {
        global.logError(UUID + ": setupWorkspaceGrid error: " + e);
    }
}

// ---------- Applet ----------

function PacmanWorkspaceApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

PacmanWorkspaceApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(_metadata, orientation, panelHeight, instanceId) {
        Applet.Applet.prototype._init.call(this, orientation, panelHeight, instanceId);

        // Defaults
        this._numCols          = 2;
        this._numRows          = 1;
        this._scrollBehavior   = "col";
        this._iconSize         = 26;
        this._spacing          = 3;
        this._pacmanColor      = "rgba(255,217,0,255)";
        this._ghostColor       = "rgba(89,89,230,191)";
        this._ghostEyeColor    = "rgba(25,25,178,255)";
        this._animatePacman    = true;
        this._useClassicColors = true;
        this._showWindowCount  = true;
        this._showGhosts       = true;
        this._pelletColor      = "rgba(255,255,255,255)";

        // Estado de animación
        this._mouthOpen  = true;
        this._mouthAngle = Math.PI / 5;
        this._animId     = null;

        this._areas    = [];
        this._switchId = null;
        this._scrollId = null;

        try {
            this._settings = new Settings.AppletSettings(this, UUID, instanceId);
            let B = Settings.BindingDirection.IN;
            this._settings.bindProperty(B, "num-cols",          "_numCols",          Lang.bind(this, this._onGridChanged), null);
            this._settings.bindProperty(B, "num-rows",          "_numRows",          Lang.bind(this, this._onGridChanged), null);
            this._settings.bindProperty(B, "scroll-behavior",   "_scrollBehavior",   null, null);
            this._settings.bindProperty(B, "icon-size",         "_iconSize",         Lang.bind(this, this._rebuild), null);
            this._settings.bindProperty(B, "spacing",           "_spacing",          Lang.bind(this, this._rebuild), null);
            this._settings.bindProperty(B, "pacman-color",      "_pacmanColor",      Lang.bind(this, this._repaint), null);
            this._settings.bindProperty(B, "ghost-color",       "_ghostColor",       Lang.bind(this, this._repaint), null);
            this._settings.bindProperty(B, "ghost-eye-color",   "_ghostEyeColor",    Lang.bind(this, this._repaint), null);
            this._settings.bindProperty(B, "animate-pacman",    "_animatePacman",    Lang.bind(this, this._onAnimChanged), null);
            this._settings.bindProperty(B, "use-classic-colors","_useClassicColors", Lang.bind(this, this._repaint), null);
            this._settings.bindProperty(B, "show-window-count", "_showWindowCount",  Lang.bind(this, this._repaint), null);
            this._settings.bindProperty(B, "show-ghosts",       "_showGhosts",       Lang.bind(this, this._repaint), null);
            this._settings.bindProperty(B, "pellet-color",      "_pelletColor",      Lang.bind(this, this._repaint), null);
        } catch (e) {
            global.logError(UUID + ": settings error: " + e);
        }

        this._onGridChanged();
    },

    on_applet_removed_from_panel: function() {
        this._disconnectAll();
        try {
            if (global.screen && global.screen.override_workspace_layout)
                global.screen.override_workspace_layout(safeCorner(), false, 1, -1);
        } catch (_) {}
    },

    on_panel_height_changed: function() {
        this._rebuild();
    },

    // ---- Handlers ----

    _onGridChanged: function() {
        setupWorkspaceGrid(this._numCols, this._numRows);
        this._rebuild();
    },

    _onAnimChanged: function() {
        if (this._animatePacman) {
            this._startAnimation();
        } else {
            this._stopAnimation();
            this._mouthAngle = Math.PI / 5;
            this._repaintActive();
        }
    },

    // ---- Signals ----

    _disconnectAll: function() {
        this._stopAnimation();
        if (this._switchId) {
            try { global.window_manager.disconnect(this._switchId); } catch (_) {}
            this._switchId = null;
        }
        if (this._scrollId) {
            try { this.actor.disconnect(this._scrollId); } catch (_) {}
            this._scrollId = null;
        }
    },

    // ---- Animation ----

    _startAnimation: function() {
        this._stopAnimation();
        if (!this._animatePacman) return;
        this._animId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, Lang.bind(this, function() {
            this._mouthOpen  = !this._mouthOpen;
            this._mouthAngle = this._mouthOpen ? Math.PI / 5 : Math.PI / 22;
            this._repaintActive();
            return GLib.SOURCE_CONTINUE;
        }));
    },

    _stopAnimation: function() {
        if (this._animId) {
            GLib.source_remove(this._animId);
            this._animId = null;
        }
    },

    // ---- Helpers ----

    _ghostBodyColor: function(idx) {
        if (this._useClassicColors) return GHOST_COLORS[idx % 4];
        return parseColor(this._ghostColor);
    },

    _windowCount: function(idx) {
        if (!this._showWindowCount) return 0;
        try {
            let screen = global.screen || global.workspace_manager;
            if (idx < 0 || idx >= screen.n_workspaces) return 0;
            let ws = screen.get_workspace_by_index(idx);
            if (!ws) return 0;
            let wins = ws.list_windows();
            let count = 0;
            for (let i = 0; i < wins.length; i++)
                if (!wins[i].skip_taskbar) count++;
            return Math.min(count, 5);
        } catch (_) { return 0; }
    },

    // ---- Build UI ----

    _rebuild: function() {
        this._disconnectAll();
        this.actor.destroy_all_children();
        this._areas = [];

        let cols = Math.max(1, this._numCols || 2);
        let rows = Math.max(1, this._numRows || 1);
        let size = this._iconSize || 26;
        let pad  = this._spacing  || 3;

        let vbox = new St.BoxLayout({ vertical: true });

        for (let r = 0; r < rows; r++) {
            let hbox = new St.BoxLayout({ vertical: false });

            for (let c = 0; c < cols; c++) {
                let idx  = r * cols + c;
                let area = new St.DrawingArea({ width: size, height: size, reactive: false });

                (Lang.bind(this, function(capturedIdx, capturedArea) {
                    capturedArea.connect('repaint', Lang.bind(this, function(a) {
                        try {
                            let screen = global.screen || global.workspace_manager;
                            let active = screen.get_active_workspace_index();

                            if (capturedIdx === active) {
                                drawPacman(a, parseColor(this._pacmanColor), this._mouthAngle);
                            } else if (this._showGhosts) {
                                drawGhost(a, this._ghostBodyColor(capturedIdx), parseColor(this._ghostEyeColor));
                            } else {
                                drawPellet(a, parseColor(this._pelletColor));
                            }

                            // Dots solo en escritorios inactivos
                            if (capturedIdx !== active) {
                                let dots = this._windowCount(capturedIdx);
                                if (dots > 0) drawWindowDots(a, dots);
                            }
                        } catch (e) {
                            global.logError(UUID + ": repaint error idx=" + capturedIdx + ": " + e);
                        }
                    }));
                }))(idx, area);

                let btn = new St.Button({ reactive: true, style: "padding: " + pad + "px;" });
                btn.set_child(area);
                btn._wsIndex = idx;
                btn.connect('clicked', Lang.bind(this, function(actor) {
                    try {
                        let screen = global.screen || global.workspace_manager;
                        let ws = screen.get_workspace_by_index(actor._wsIndex);
                        if (ws) ws.activate(global.get_current_time());
                    } catch (e) {}
                }));

                this._areas.push(area);
                hbox.add(btn);
            }
            vbox.add(hbox);
        }

        this.actor.add(vbox);

        // Señal: cambio de escritorio
        try {
            this._switchId = global.window_manager.connect(
                'switch-workspace',
                Lang.bind(this, this._repaint)
            );
        } catch (e) {
            global.logError(UUID + ": switch-workspace connect error: " + e);
        }

        // Señal: rueda del ratón
        try {
            this._scrollId = this.actor.connect('scroll-event', Lang.bind(this, function(_a, event) {
                let dir = event.get_scroll_direction();
                if (dir !== 0 && dir !== 1) return;
                if ((this._scrollBehavior || "col") === "row")
                    this._scrollByRow(dir === 1);
                else
                    this._scrollByCol(dir === 1);
            }));
        } catch (e) {
            global.logError(UUID + ": scroll-event connect error: " + e);
        }

        // Resetear animación a estado abierto para consistencia
        this._mouthOpen  = true;
        this._mouthAngle = Math.PI / 5;
        this._startAnimation();
        this._repaint();
    },

    // ---- Scroll ----

    _scrollByCol: function(forward) {
        let screen = global.screen || global.workspace_manager;
        let idx = screen.get_active_workspace_index() + (forward ? 1 : -1);
        if (idx < 0 || idx >= screen.n_workspaces) return;
        let ws = screen.get_workspace_by_index(idx);
        if (ws) ws.activate(global.get_current_time());
    },

    _scrollByRow: function(forward) {
        let screen = global.screen || global.workspace_manager;
        let cols = this._numCols || 2;
        let rows = this._numRows || 1;
        let idx  = screen.get_active_workspace_index();
        let row  = Math.floor(idx / cols) + (forward ? 1 : -1);
        let col  = idx % cols;
        if (row < 0 || row >= rows) return;
        let ws = screen.get_workspace_by_index(row * cols + col);
        if (ws) ws.activate(global.get_current_time());
    },

    // ---- Repaint ----

    _repaintActive: function() {
        try {
            let screen = global.screen || global.workspace_manager;
            let active = screen.get_active_workspace_index();
            if (this._areas[active]) this._areas[active].queue_repaint();
        } catch (_) {}
    },

    _repaint: function() {
        for (let a of this._areas) {
            try { a.queue_repaint(); } catch (_) {}
        }
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new PacmanWorkspaceApplet(metadata, orientation, panelHeight, instanceId);
}
