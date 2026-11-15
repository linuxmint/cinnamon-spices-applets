// colorPicker.js — MintTenMenu in-menu colour picker
// Compact popover drawn with St/Cairo, parented inside _menuContainer.
'use strict';

const St      = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib    = imports.gi.GLib;
const {SignalManager} = imports.misc.signalManager;
const {ACCENT_COLORS} = require('./tileItem');

const DEFAULT_COLOR = ACCENT_COLORS[0];
const PRESETS_PER_ROW = 6;

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
    ];
}

function normalizeHex(input) {
    if (typeof input !== 'string') return null;
    let s = input.trim();
    if (s.startsWith('#')) s = s.slice(1);
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return '#' + s.toUpperCase();
}

function rgbToHsv(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r)      h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else                h = (r - g) / d + 4;
        h /= 6;
        if (h < 0) h += 1;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb(h, s, v) {
    h = ((h % 1) + 1) % 1;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (i % 6) {
        case 0:  r = v; g = t; b = p; break;
        case 1:  r = q; g = v; b = p; break;
        case 2:  r = p; g = v; b = t; break;
        case 3:  r = p; g = q; b = v; break;
        case 4:  r = t; g = p; b = v; break;
        default: r = v; g = p; b = q; break;
    }
    return [r, g, b];
}

function rgbToHex(r, g, b) {
    const c = n => clamp(Math.round(n * 255), 0, 255).toString(16).padStart(2, '0').toUpperCase();
    return '#' + c(r) + c(g) + c(b);
}

// ---------------------------------------------------------------------------
// ColorPickerPopover
// ---------------------------------------------------------------------------

class ColorPickerPopover {
    constructor(applet, tile, anchor) {
        this.applet   = applet;
        this._tile    = tile;
        this._tileId  = tile.data.id;
        this._anchor  = anchor;
        this._signals = new SignalManager(null);
        this._idleId  = null;
        this._drag    = null;
        this._valid   = true;

        this._original = {
            accentColor: tile.data.accentColor,
            hadConfigBg: !!(tile.data.config &&
                            Object.prototype.hasOwnProperty.call(tile.data.config, 'backgroundColor')),
            configBg: tile.data.config ? tile.data.config.backgroundColor : undefined,
        };

        const initial = normalizeHex(tile.data.accentColor) ||
                        normalizeHex(tile._accent) ||
                        DEFAULT_COLOR;
        const [r, g, b] = hexToRgb(initial);
        const hsv = rgbToHsv(r, g, b);
        this._h = hsv.h;
        this._s = hsv.s;
        this._v = hsv.v;
        this._hex = initial;

        this._build();
        this._attach();
    }

    get actor() {
        return this._actor;
    }

    // ---- Construction ------------------------------------------------------

    _build() {
        this._actor = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style_class: 'wintenmenu-color-picker',
        });

        // Swallow clicks so they never reach the tile underneath
        this._signals.connect(this._actor, 'button-press-event', () => Clutter.EVENT_STOP);
        this._signals.connect(this._actor, 'button-release-event', () => Clutter.EVENT_STOP);

        const headerRow = new St.BoxLayout({ vertical: false, style: 'spacing: 6px;' });
        const title = new St.Label({
            text: 'Tile color',
            style_class: 'wintenmenu-color-picker-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        headerRow.add_child(title);
        this._actor.add_child(headerRow);

        // ---- Preview + HEX -------------------------------------------------
        const previewRow = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 8px;',
        });

        this._preview = new St.Widget({
            style_class: 'wintenmenu-color-preview',
            style: `background-color: ${this._hex};`,
        });
        previewRow.add_child(this._preview);

        this._hexEntry = new St.Entry({
            text: this._hex,
            hint_text: '#RRGGBB',
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'wintenmenu-color-hex-entry',
        });
        this._hexEntry.clutter_text.set_single_line_mode(true);
        this._signals.connect(this._hexEntry.clutter_text, 'text-changed', () => this._onHexChanged());
        this._signals.connect(this._hexEntry.clutter_text, 'key-press-event', (a, ev) => {
            const sym = ev.get_key_symbol();
            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
                this.apply();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._signals.connect(this._hexEntry.clutter_text, 'key-focus-out', () => {
            if (this._valid) this._hexEntry.set_text(this._hex);
        });
        previewRow.add_child(this._hexEntry);
        this._actor.add_child(previewRow);

        // ---- Spectrum ------------------------------------------------------
        this._actor.add_child(new St.Label({
            text: 'Spectrum',
            style_class: 'wintenmenu-color-label',
        }));

        this._svArea = new St.DrawingArea({
            reactive: true,
            style_class: 'wintenmenu-color-field',
        });
        this._signals.connect(this._svArea, 'repaint', area => this._paintSV(area));
        this._signals.connect(this._svArea, 'button-press-event', (a, ev) => {
            if (ev.get_button() !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_PROPAGATE;
            this._beginDrag(this._svArea, e => this._pickSV(e), ev);
            this._pickSV(ev);
            return Clutter.EVENT_STOP;
        });
        this._actor.add_child(this._svArea);

        this._hueArea = new St.DrawingArea({
            reactive: true,
            style_class: 'wintenmenu-color-hue',
        });
        this._signals.connect(this._hueArea, 'repaint', area => this._paintHue(area));
        this._signals.connect(this._hueArea, 'button-press-event', (a, ev) => {
            if (ev.get_button() !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_PROPAGATE;
            this._beginDrag(this._hueArea, e => this._pickHue(e), ev);
            this._pickHue(ev);
            return Clutter.EVENT_STOP;
        });
        this._actor.add_child(this._hueArea);

        // ---- Presets -------------------------------------------------------
        this._actor.add_child(new St.Label({
            text: 'Presets',
            style_class: 'wintenmenu-color-label',
        }));

        const presetBox = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 4px; margin-top: 2px;',
        });
        this._presetSwatches = [];
        let row = null;
        ACCENT_COLORS.forEach((color, idx) => {
            if (idx % PRESETS_PER_ROW === 0) {
                row = new St.BoxLayout({ vertical: false, style: 'spacing: 4px;' });
                presetBox.add_child(row);
            }
            const swatch = new St.Button({
                reactive: true,
                track_hover: true,
                style: this._presetStyle(color, false, false),
            });
            this._signals.connect(swatch, 'enter-event', () => {
                swatch.style = this._presetStyle(color, true, this._hex === color);
            });
            this._signals.connect(swatch, 'leave-event', () => {
                swatch.style = this._presetStyle(color, false, this._hex === color);
            });
            this._signals.connect(swatch, 'clicked', () => {
                const [r, g, b] = hexToRgb(color);
                const hsv = rgbToHsv(r, g, b);
                this._setFromHsv(hsv.h, hsv.s, hsv.v);
            });
            this._presetSwatches.push({ color, actor: swatch });
            row.add_child(swatch);
        });
        this._actor.add_child(presetBox);

        // ---- Actions -------------------------------------------------------
        const btnRow = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 6px; margin-top: 4px;',
        });

        this._resetBtn = this._makeButton('Reset', 'wintenmenu-color-btn wintenmenu-color-btn-reset', () => {
            const [r, g, b] = hexToRgb(DEFAULT_COLOR);
            const hsv = rgbToHsv(r, g, b);
            this._setFromHsv(hsv.h, hsv.s, hsv.v);
        });
        btnRow.add_child(this._resetBtn);

        const spacer = new St.Widget({ x_expand: true });
        btnRow.add_child(spacer);

        this._cancelBtn = this._makeButton('Cancel', 'wintenmenu-color-btn', () => this.cancel());
        btnRow.add_child(this._cancelBtn);

        this._applyBtn = this._makeButton('Apply', 'wintenmenu-color-btn wintenmenu-color-btn-primary', () => this.apply());
        btnRow.add_child(this._applyBtn);

        this._actor.add_child(btnRow);

        this._updateVisuals();
    }

    _makeButton(label, styleClass, onClick) {
        const btn = new St.Button({
            label,
            reactive: true,
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: styleClass,
        });
        this._signals.connect(btn, 'clicked', onClick);
        return btn;
    }

    _presetStyle(color, hovered, selected) {
        const border = selected
            ? '2px solid white'
            : (hovered ? '1px solid rgba(255,255,255,0.7)' : '1px solid rgba(255,255,255,0.15)');
        return `background-color: ${color}; width: 18px; height: 18px; ` +
               `min-width: 18px; min-height: 18px; border: ${border}; border-radius: 2px;`;
    }

    // ---- Colour state ------------------------------------------------------

    _setFromHsv(h, s, v) {
        this._h = h;
        this._s = s;
        this._v = v;
        const [r, g, b] = hsvToRgb(h, s, v);
        this._hex = rgbToHex(r, g, b);
        this._valid = true;
        this._hexEntry.remove_style_class_name('invalid');

        if (this._hexEntry.get_text().toUpperCase() !== this._hex) {
            this._hexEntry.set_text(this._hex);
            this._hexEntry.clutter_text.set_cursor_position(this._hex.length);
        }

        this._updateVisuals();
        this._previewColor(this._hex);
    }

    _onHexChanged() {
        const hex = normalizeHex(this._hexEntry.get_text());
        if (!hex) {
            this._valid = false;
            this._hexEntry.add_style_class_name('invalid');
            return;
        }

        this._valid = true;
        this._hexEntry.remove_style_class_name('invalid');
        if (hex === this._hex) return;

        const [r, g, b] = hexToRgb(hex);
        const hsv = rgbToHsv(r, g, b);
        this._h = hsv.h;
        this._s = hsv.s;
        this._v = hsv.v;
        this._hex = hex;
        this._updateVisuals();
        this._previewColor(hex);
    }

    _updateVisuals() {
        if (this._preview) {
            this._preview.style = `background-color: ${this._hex};`;
        }
        if (this._svArea) this._svArea.queue_repaint();
        if (this._hueArea) this._hueArea.queue_repaint();
        for (const entry of this._presetSwatches || []) {
            entry.actor.style = this._presetStyle(entry.color, false, entry.color === this._hex);
        }
    }

    _previewColor(hex) {
        if (!this._tile) return;
        try { this._tile.previewAccentColor(hex); } catch (e) { /* tile gone */ }
    }

    _targetTile() {
        const tile = this._tile;
        if (tile && tile.data && tile.data.id === this._tileId &&
                tile.actor && tile.actor.get_parent()) {
            return tile;
        }
        return null;
    }

    // ---- Drawing -----------------------------------------------------------

    _paintSV(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        if (!w || !h) {
            cr.$dispose();
            return;
        }

        const [hr, hg, hb] = hsvToRgb(this._h, 1, 1);
        const xSteps = Math.max(1, Math.ceil(w));
        for (let i = 0; i < xSteps; i++) {
            const t = xSteps === 1 ? 0 : i / (xSteps - 1);
            cr.setSourceRGBA(1 - t + hr * t, 1 - t + hg * t, 1 - t + hb * t, 1);
            cr.rectangle(Math.floor(i * w / xSteps), 0, Math.ceil(w / xSteps), h);
            cr.fill();
        }

        const ySteps = Math.max(1, Math.ceil(h));
        for (let j = 0; j < ySteps; j++) {
            const t = ySteps === 1 ? 0 : j / (ySteps - 1);
            cr.setSourceRGBA(0, 0, 0, t);
            cr.rectangle(0, Math.floor(j * h / ySteps), w, Math.ceil(h / ySteps));
            cr.fill();
        }

        const scale = global.ui_scale || 1;
        const hx = this._s * w;
        const hy = (1 - this._v) * h;
        const radius = Math.max(5, Math.round(6 * scale));

        cr.arc(hx, hy, radius, 0, Math.PI * 2);
        cr.setLineWidth(Math.max(2, Math.round(2 * scale)));
        cr.setSourceRGBA(0, 0, 0, 0.75);
        cr.strokePreserve();
        cr.setLineWidth(Math.max(1, Math.round(1 * scale)));
        cr.setSourceRGBA(1, 1, 1, 0.95);
        cr.stroke();

        cr.$dispose();
    }

    _paintHue(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        if (!w || !h) {
            cr.$dispose();
            return;
        }

        const segments = Math.max(24, Math.round(w / 2));
        for (let i = 0; i < segments; i++) {
            const [r, g, b] = hsvToRgb(i / segments, 1, 1);
            cr.setSourceRGBA(r, g, b, 1);
            cr.rectangle(Math.floor(i * w / segments), 0,
                         Math.ceil(w / segments), h);
            cr.fill();
        }

        const scale = global.ui_scale || 1;
        const hx = clamp(this._h, 0, 1) * w;
        const handleW = Math.max(3, Math.round(3 * scale));

        cr.rectangle(hx - handleW / 2, 0, handleW, h);
        cr.setLineWidth(Math.max(2, Math.round(2 * scale)));
        cr.setSourceRGBA(0, 0, 0, 0.8);
        cr.strokePreserve();
        cr.setLineWidth(Math.max(1, Math.round(1 * scale)));
        cr.setSourceRGBA(1, 1, 1, 0.95);
        cr.stroke();

        cr.$dispose();
    }

    // ---- Pointer dragging --------------------------------------------------

    _pickSV(ev) {
        const [ax, ay] = this._svArea.get_transformed_position();
        // get_surface_size() is only valid inside repaint; pointer events must
        // use the allocated size (surface queries assert outside repaint).
        const w = this._svArea.width;
        const h = this._svArea.height;
        const [px, py] = ev.get_coords();
        if (!w || !h) return;
        const s = clamp((px - ax) / w, 0, 1);
        const v = 1 - clamp((py - ay) / h, 0, 1);
        this._setFromHsv(this._h, s, v);
    }

    _pickHue(ev) {
        const [ax,] = this._hueArea.get_transformed_position();
        const w = this._hueArea.width;
        const [px,] = ev.get_coords();
        if (!w) return;
        const hue = clamp((px - ax) / w, 0, 1);
        this._setFromHsv(hue, this._s, this._v);
    }

    _beginDrag(area, handler, event) {
        this._endDrag();
        const drag = { area, handler, device: null, motionId: 0, releaseId: 0 };
        this._drag = drag;

        try {
            drag.device = event.get_device();
            drag.device.grab(area);
        } catch (e) {
            drag.device = null;
        }

        drag.motionId = area.connect('motion-event', (a, ev) => {
            if (this._drag !== drag) return Clutter.EVENT_STOP;
            handler(ev);
            return Clutter.EVENT_STOP;
        });
        drag.releaseId = area.connect('button-release-event', () => {
            this._endDrag();
            return Clutter.EVENT_STOP;
        });
    }

    _endDrag() {
        const drag = this._drag;
        if (!drag) return;
        this._drag = null;

        if (drag.motionId) {
            try { drag.area.disconnect(drag.motionId); } catch (e) {}
        }
        if (drag.releaseId) {
            try { drag.area.disconnect(drag.releaseId); } catch (e) {}
        }
        if (drag.device) {
            try { drag.device.ungrab(); } catch (e) {}
        }
    }

    // ---- Placement ---------------------------------------------------------

    _attach() {
        if (!this.applet._menuContainer) {
            this._destroy();
            return;
        }

        this._actor.hide();
        this.applet._menuContainer.add_actor(this._actor);

        // The themed height is not final until the first allocation, and it
        // grows once padding/spacing are applied — re-place when that lands.
        this._signals.connect(this._actor, 'notify::height', () => {
            if (this._actor && this._actor.get_parent()) this._position();
        });

        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = null;
            if (!this._actor || !this._actor.get_parent()) return GLib.SOURCE_REMOVE;

            this._position();
            this._actor.show();

            try { global.stage.set_key_focus(this._hexEntry.clutter_text); } catch (e) {}
            return GLib.SOURCE_REMOVE;
        });
    }

    _position() {
        const container = this.applet._menuContainer;
        if (!container) return;

        const scale = global.ui_scale || 1;
        const [cx, cy] = container.get_transformed_position();
        const cw = container.width || Math.round((this.applet.settings.customMenuWidth || 940) * scale);
        const ch = container.height || Math.round((this.applet.settings.customMenuHeight || 640) * scale);

        const [,, pw, ph] = this._actor.get_preferred_size();
        const popW = this._actor.width || pw || Math.round(260 * scale);
        const popH = this._actor.height || ph || Math.round(360 * scale);

        let ax, ay, aw, ah;
        if (this._anchor) {
            ax = this._anchor.x;
            ay = this._anchor.y;
            aw = this._anchor.width || 0;
            ah = this._anchor.height || 0;
        } else {
            const tile = this._tile;
            if (!tile || !tile.actor) return;
            [ax, ay] = tile.actor.get_transformed_position();
            aw = tile.actor.width;
            ah = tile.actor.height;
        }

        const gap = Math.round(8 * scale);
        const margin = Math.round(4 * scale);

        // Exact placement: anchor.x/y is the top-left the picker should
        // occupy (the context menu's rect). Only nudge it inside the menu.
        if (this._anchor && this._anchor.exact) {
            const px = clamp(ax - cx, margin, Math.max(margin, cw - popW - margin));
            const py = clamp(ay - cy, margin, Math.max(margin, ch - popH - margin));
            this._actor.set_position(Math.round(px), Math.round(py));
            return;
        }

        let px = ax - cx + aw + gap;
        let py = ay - cy + (ah - popH) / 2;

        if (px + popW > cw - margin) px = ax - cx - popW - gap;
        if (px < margin) {
            px = clamp(Math.round((cw - popW) / 2), margin, Math.max(margin, cw - popW - margin));
        }

        if (py + popH > ch - margin) {
            const above = ay - cy - popH - gap;
            py = above >= margin ? above : ch - popH - margin;
        }
        if (py < margin) py = margin;

        this._actor.set_position(Math.round(px), Math.round(py));
    }

    // ---- Lifecycle ---------------------------------------------------------

    cancel() {
        this._restore();
        this._destroy();
    }

    close() {
        this.cancel();
    }

    apply() {
        if (!this._valid) return;

        const hex = this._hex;
        const tile = this._targetTile();
        this._destroy();

        if (!tile) return;
        try { tile.commitAccentColor(hex); }
        catch (e) { global.logWarning('MintTenMenu: Failed to apply tile colour: ' + e); }
    }

    _restore() {
        const tile = this._targetTile();
        if (!tile) return;
        try { tile.restoreAccentColor(this._original); }
        catch (e) { global.logWarning('MintTenMenu: Failed to restore tile colour: ' + e); }
    }

    _destroy() {
        if (this._idleId) {
            try { GLib.source_remove(this._idleId); } catch (e) {}
            this._idleId = null;
        }

        this._endDrag();

        // Unrealizing an actor that currently owns the key focus can leave
        // Clutter's focus chain mid-remap. Hand focus back to the menu
        // (its normal owner while open) before teardown.
        try {
            const focus = global.stage.get_key_focus();
            if (focus && this._actor && this._actor.contains(focus)) {
                const menuOpen = this.applet.menu && this.applet.menu.isOpen;
                if (menuOpen && this.applet.menu.actor) {
                    global.stage.set_key_focus(this.applet.menu.actor);
                } else {
                    global.stage.set_key_focus(null);
                }
            }
        } catch (e) {}

        try { this._signals.disconnectAllSignals(); } catch (e) {}

        const actor = this._actor;
        this._actor = null;

        // Tear down on the next idle: destroying a mapped actor while the
        // menu is still open re-enters Clutter's map/unmap bookkeeping.
        // Hiding first lets the redraw pass unmap it cleanly.
        if (actor) {
            try { actor.hide(); } catch (e) {}
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                try {
                    const parent = actor.get_parent();
                    if (parent) parent.remove_child(actor);
                } catch (e) {}
                try { actor.destroy(); } catch (e) {}
                return GLib.SOURCE_REMOVE;
            });
        }

        this._tile = null;

        if (this.applet._colorPicker === this) {
            this.applet._colorPicker = null;
        }
    }
}

module.exports = { ColorPickerPopover };
