// tileItem.js — MintTenMenu Single Tile Widget  (v6 — local overlay context menu, zero-freeze)
'use strict';

const St      = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango   = imports.gi.Pango;
const GLib    = imports.gi.GLib;
const Main    = imports.ui.main;
const {SignalManager} = imports.misc.signalManager;
const {makeDraggable} = imports.ui.dnd;

const { GRID_UNIT, GRID_GAP, SIZE_UNITS, tilePx } = require('./gridMath');

const TileSize = Object.freeze({ SMALL: 'small', MEDIUM: 'medium', WIDE: 'wide', LARGE: 'large' });

// Icon sizes are now computed dynamically in TileItem.getAdaptiveIconSize().
// This table is retained only as a legacy fallback for external callers.
const ICON_SIZES = {
    small:  28,
    medium: 48,
    wide:   48,
    large:  68,
};

const ACCENT_COLORS = [
    '#0078D4','#E74856','#0099BC','#7A7574','#767676',
    '#CA5010','#038387','#C239B3','#881798','#498205','#107C10','#515C6B',
];

function lightenHex(hex, amount) {
    try {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.min(255,r+amount)},${Math.min(255,g+amount)},${Math.min(255,b+amount)})`;
    } catch(e) { return hex; }
}

// ---------------------------------------------------------------------------
// CtxMenu — Local context menu drawing overlay inside _menuContainer.
// Crucial: connects button-press-event to block propagation so it doesn't
// trigger click-outside menus.
// ---------------------------------------------------------------------------

class CtxMenu {
    constructor(applet, anchor, onClose) {
        this.applet   = applet;
        this._anchor  = anchor;
        this._onClose = onClose;
        this._flyout  = null;

        this._build();
        this._show();
    }

    addSeparator() {
        const sep = new St.BoxLayout({
            style: 'height:1px; background-color:rgba(255,255,255,0.12); margin:3px 0px;',
            x_expand: true,
        });
        this._box.add_actor(sep);
    }

    addItem(label, onClick) {
        const row = this._makeRow(label);
        row.connect('button-press-event', () => Clutter.EVENT_STOP);
        row.connect('button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                this.close();
                onClick();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        row.connect('enter-event', () => {
            this._closeFlyout();
            row.style = 'padding: 9px 16px 9px 14px; background-color: rgba(0,120,212,0.35);';
        });
        row.connect('leave-event', () => {
            row.style = 'padding: 9px 16px 9px 14px;';
        });
        this._box.add_actor(row);
        return row;
    }

    addSubItem(label, buildFlyout, onClick) {
        const row = this._makeRow(label, true);
        row.connect('button-press-event', () => Clutter.EVENT_STOP);
        row.connect('enter-event', () => {
            row.style = 'padding: 9px 16px 9px 14px; background-color: rgba(0,120,212,0.35);';
        });
        row.connect('leave-event', () => {
            row.style = 'padding: 9px 16px 9px 14px;';
        });
        row.connect('button-release-event', (a, ev) => {
            if (ev.get_button() !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_PROPAGATE;
            if (onClick) onClick(row);
            else this._openFlyout(row, buildFlyout);
            return Clutter.EVENT_STOP;
        });
        this._box.add_actor(row);
        return row;
    }

    close() {
        this._closeFlyout();
        try {
            const p = this._actor.get_parent();
            if (p) p.remove_child(this._actor);
        } catch(e){}
        try { this._actor.destroy(); } catch(e){}
        this._actor = null;
        if (this._onClose) this._onClose();
    }

    _build() {
        this._actor = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style: [
                'background-color: #1e1e1e;',
                'border: 1px solid #3c3c3c;',
                'border-radius: 0px;',
                'padding: 4px 0px;',
                'min-width: 170px;',
            ].join(''),
        });
        this._box = this._actor;

        // Block clicks inside the menu from propagating to parent click-outside listeners
        this._actor.connect('button-press-event', () => Clutter.EVENT_STOP);
        this._actor.connect('button-release-event', () => Clutter.EVENT_STOP);
    }

    _show() {
        // Hide initially so it doesn't flash at position (0,0) before layout
        this._actor.hide();
        this.applet._menuContainer.add_actor(this._actor);

        // Defer positioning to after Clutter has allocated the actor,
        // so get_preferred_size() returns the real height (not 0).
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (!this._actor || !this._actor.get_parent()) return GLib.SOURCE_REMOVE;

            const [ax, ay] = this._anchor.get_transformed_position();
            const [cx, cy] = this.applet._menuContainer.get_transformed_position();
            const aw = this._anchor.width;
            const ah = this._anchor.height;

            const [,, mw, mh] = this._actor.get_preferred_size();
            const menuW = mw || 180;
            const menuH = mh || 120;

            const cw = this.applet._menuContainer.width;
            const ch = this.applet._menuContainer.height;

            let rx = ax - cx + aw + 4;
            let ry = ay - cy + ah / 2 - menuH / 2;

            // Flip left if it would overflow the right edge
            if (rx + menuW > cw) rx = ax - cx - menuW - 4;
            // Clamp vertically
            if (ry < 4) ry = 4;
            if (ry + menuH > ch - 4) ry = ch - menuH - 4;

            this._actor.set_position(Math.round(rx), Math.round(ry));
            this._actor.show();
            return GLib.SOURCE_REMOVE;
        });
    }

    _openFlyout(anchorRow, buildFn) {
        this._closeFlyout();
        this._flyout = new CtxFlyout(this, anchorRow, () => { this._flyout = null; });
        buildFn(this._flyout);
        this._flyout.show();
    }

    _closeFlyout() {
        if (this._flyout) {
            this._flyout.close();
            this._flyout = null;
        }
    }

    _makeRow(label, hasSub) {
        const row = new St.BoxLayout({
            reactive: true,
            track_hover: true,
            style: 'padding: 9px 16px 9px 14px;',
        });

        const lbl = new St.Label({
            text: label,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-size: 13px; color: #e8e8e8;',
            x_expand: true,
        });
        row.add_child(lbl);

        if (hasSub) {
            const arrow = new St.Label({
                text: '›',
                y_align: Clutter.ActorAlign.CENTER,
                style: 'font-size: 16px; color: rgba(255,255,255,0.6); margin-left: 8px;',
            });
            row.add_child(arrow);
        }

        return row;
    }
}

// ---------------------------------------------------------------------------
// CtxFlyout
// ---------------------------------------------------------------------------

class CtxFlyout {
    constructor(parentMenu, anchorRow, onClose) {
        this._parentMenu = parentMenu;
        this._anchorRow  = anchorRow;
        this._onClose   = onClose;

        this._actor = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style: [
                'background-color: #1e1e1e;',
                'border: 1px solid #3c3c3c;',
                'border-radius: 0px;',
                'padding: 4px 0px;',
                'min-width: 170px;',
            ].join(''),
        });

        this._actor.connect('button-press-event', () => Clutter.EVENT_STOP);
        this._actor.connect('button-release-event', () => Clutter.EVENT_STOP);
    }

    addCustomWidget(widget) {
        this._actor.add_child(widget);
    }

    addItem(label, extraStyle, onClick) {
        const row = new St.BoxLayout({
            reactive: true,
            track_hover: true,
            style: `padding: 9px 16px 9px 14px; ${extraStyle || ''}`,
        });

        const lbl = new St.Label({
            text: label,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-size: 13px; color: #e8e8e8;',
        });
        row.add_child(lbl);

        const normalStyle = `padding: 9px 16px 9px 14px; ${extraStyle || ''}`;
        const hoverStyle  = `padding: 9px 16px 9px 14px; background-color: rgba(0,120,212,0.35); ${extraStyle || ''}`;

        row.connect('button-press-event', () => Clutter.EVENT_STOP);
        row.connect('enter-event', () => { row.style = hoverStyle; });
        row.connect('leave-event', () => { row.style = normalStyle; });
        row.connect('button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                this._parentMenu.close();
                onClick();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._actor.add_child(row);
    }

    addSeparator() {
        const sep = new St.BoxLayout({
            style: 'height:1px; background-color:rgba(255,255,255,0.12); margin:3px 0px;',
            x_expand: true,
        });
        this._actor.add_child(sep);
    }

    show() {
        this._actor.hide();
        this._parentMenu.applet._menuContainer.add_actor(this._actor);

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (!this._actor || !this._actor.get_parent()) return GLib.SOURCE_REMOVE;

            const [, ry] = this._anchorRow.get_transformed_position();
            const container = this._parentMenu.applet._menuContainer;
            const [cx, cy] = container.get_transformed_position();
            const cw = container.width;
            const ch = container.height;

            const [,, fw, fh] = this._actor.get_preferred_size();
            const flyW = fw || 180;
            const flyH = fh || 100;

            // Place the flyout immediately right of the context menu itself.
            const menuActor = this._parentMenu._actor || this._anchorRow;
            const [mx] = menuActor.get_transformed_position();
            const menuLeft  = mx - cx;
            const menuRight = menuLeft + menuActor.width;

            const gap = 2;
            const margin = 4;
            const maxX = cw - margin - flyW;

            let fx = menuRight + gap;
            if (fx > maxX) {
                // Shift left only as far as the boundary requires; flip to the
                // left side only when the right side truly cannot fit it.
                fx = maxX >= menuLeft ? maxX : menuLeft - flyW - gap;
            }
            if (fx < margin) fx = margin;

            let fy = ry - cy;
            if (fy + flyH > ch - margin) fy = ch - flyH - margin;
            if (fy < margin) fy = margin;

            this._actor.set_position(Math.round(fx), Math.round(fy));
            this._actor.show();
            return GLib.SOURCE_REMOVE;
        });
    }

    close() {
        try {
            const p = this._actor.get_parent();
            if (p) p.remove_child(this._actor);
        } catch(e){}
        try { this._actor.destroy(); } catch(e){}
        this._actor = null;
        if (this._onClose) this._onClose();
    }
}

// ===========================================================================
// TileItem
// ===========================================================================

class TileItem {
    constructor(applet, utils, tileData, app, layoutEngine) {
        this.applet       = applet;
        this.utils        = utils;
        this.data         = tileData;
        this.app          = app;
        this.layoutEngine = layoutEngine;
        this._signals     = new SignalManager(null);
        this._cbs         = {};
        this._dragging    = false;
        this._ctxMenu     = null;
        this._renaming    = false;

        this._buildUI();
        this._setupDnD();
    }

    get actor()       { return this._actor; }
    get col()         { return this.data.x; }
    get row()         { return this.data.y; }
    get colSpan()     { return this.data.w; }
    get rowSpan()     { return this.data.h; }
    get pixelWidth()  { return tilePx(this.colSpan); }
    get pixelHeight() { return tilePx(this.rowSpan); }

    // -----------------------------------------------------------------------
    // Dynamic icon sizing — scales icon to tile dimensions
    // -----------------------------------------------------------------------
    getAdaptiveIconSize() {
        // Skip dynamic scaling for widget tiles
        if (this.data.type === 'widget' || this.data.isWidget) return 36;

        const tileW = tilePx(this.data.w);
        const tileH = tilePx(this.data.h);
        const shorterDim = Math.min(tileW, tileH);

        let ratio;
        if (shorterDim <= 80) {
            ratio = 0.40;   // Small tile → ~28px
        } else if (shorterDim <= 200) {
            ratio = 0.44;   // Medium / Wide tile → ~64px
        } else {
            ratio = 0.36;   // Large tile → ~107px
        }

        const computed = Math.round(shorterDim * ratio);
        return Math.max(16, Math.min(128, computed));
    }

    // -----------------------------------------------------------------------
    // Icon alignment — centred horizontally within the tile's actual allocation
    // -----------------------------------------------------------------------
    _updateIconBoxLayout() {
        if (!this._iconBox) return;
        this._iconBox.x_align = Clutter.ActorAlign.CENTER;
        this._iconBox.y_align = Clutter.ActorAlign.CENTER;
        this._iconBox.style   = '';
    }

    on(ev, cb) { this._cbs[ev] = cb; }

    getDragActor() {
        if (this.data.type === 'widget') {
            let ghost = new St.BoxLayout({
                style: `background-color: ${this._accent}; border-radius: ${this._radius}px; opacity: 0.6;`
            });
            ghost.set_size(tilePx(this.data.w), tilePx(this.data.h));
            return ghost;
        }
        let clone = new Clutter.Clone({ source: this._actor });
        let [w, h] = this._actor.get_size();
        clone.set_size(w, h);
        return clone;
    }
    getDragActorSource() { return this._actor; }

    destroy() {
        if (this._widget) {
            try { this._widget.destroy(); } catch(e) {}
            this._widget = null;
        }
        this._closeCtxMenu();
        this._signals.disconnectAllSignals();
        try { this._actor.destroy(); } catch(e) {}
    }

    highlightForDrop(active) {
        if (active) {
            this._actor.add_style_class_name('folder-highlight');
        } else {
            this._actor.remove_style_class_name('folder-highlight');
        }
    }

    _buildUI() {
        const size   = this.data.size || 'medium';
        const w      = tilePx(this.data.w);
        const h      = tilePx(this.data.h);
        const radius = (this.applet.settings.tileCornerRadius !== undefined)
            ? this.applet.settings.tileCornerRadius : 0;
        const accent = (this.applet.settings.tileAccentColors && this.data.accentColor)
            ? this.data.accentColor : ACCENT_COLORS[0];

        this._accent = accent;
        this._radius = radius;

        this._actor = new St.BoxLayout({
            vertical: true,
            reactive: true,
            track_hover: true,
            x_expand: false,
            y_expand: false,
        });

        this._applyStyle(w, h, accent, radius, false);

        if (this.data.type === 'widget') {
            const WidgetRegistry = require('./widgets/widgetRegistry');
            try {
                global.log("[Widget] Creating widget: tileData.id = " + this.data.id + ", TileItem = " + this + ", Actor = " + this._actor + ", kind = " + this.data.widgetKind);
                this._widget = WidgetRegistry.create(this.data, this.applet);
                this._actor.add(this._widget.contentActor, { expand: true });
                this._widget.buildUI();
                this._widget.refresh();
            } catch(e) {
                global.logError("MintTenMenu: Failed to create widget: " + e);
            }

            // Hover glow
            this._signals.connect(this._actor, 'enter-event', () => {
                if (this._dragging) return;
                this._applyStyle(tilePx(this.data.w), tilePx(this.data.h), this._accent, this._radius, true);
                try { global.set_cursor(Cinnamon.Cursor.POINTING_HAND); } catch(e){}
            });
            this._signals.connect(this._actor, 'leave-event', () => {
                this._applyStyle(tilePx(this.data.w), tilePx(this.data.h), this._accent, this._radius, false);
                try { global.unset_cursor(); } catch(e){}
            });

            // Click events
            this._signals.connect(this._actor, 'button-press-event', (a, ev) => {
                if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                    return Clutter.EVENT_PROPAGATE;
                }
                return Clutter.EVENT_STOP;
            });
            this._signals.connect(this._actor, 'button-release-event', (a, ev) => {
                if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                    return Clutter.EVENT_PROPAGATE;
                }
                if (ev.get_button() === Clutter.BUTTON_SECONDARY) {
                    this._showCtxMenu();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            return;
        }

        const iconSize = this.getAdaptiveIconSize();
        let icon = null;
        if (this.data.type === 'folder') {
            icon = new St.Icon({
                icon_name: 'folder',
                icon_size: iconSize,
                icon_type: St.IconType.SYMBOLIC,
            });
        } else {
            // _iconCacheContainer is created once in the applet constructor on global.stage.
            // It persists across _buildMenu() cycles so cached source actors are never
            // destroyed by a menu rebuild — eliminating the stale-clone icon bug.
            icon = this.utils.getIconTexture(this.app.cinnamonApp, iconSize, this.applet._iconCacheContainer);
        }
        this._icon = icon;

        const iconBox = new St.BoxLayout({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });
        this._iconBox = iconBox;
        if (icon) iconBox.add(icon, { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this._updateIconBoxLayout();
        this._actor.add(iconBox, { expand: true });

        // Title Label
        const nameText = (this.data.type === 'folder')
            ? (this.data.name || 'Folder')
            : (this.data.appName || this.app.name || '');

        this._titleLabel = new St.Label({
            text: nameText,
            style_class: 'wintenmenu-tile-name',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.END,
            visible: (size !== 'small'),
        });
        this._titleLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._titleLabel.clutter_text.set_line_wrap(false);
        this._actor.add_actor(this._titleLabel);

        // Hover glow
        this._signals.connect(this._actor, 'enter-event', () => {
            if (this._dragging) return;
            this._applyStyle(tilePx(this.data.w), tilePx(this.data.h), this._accent, this._radius, true);
            try { global.set_cursor(Cinnamon.Cursor.POINTING_HAND); } catch(e){}
        });
        this._signals.connect(this._actor, 'leave-event', () => {
            this._applyStyle(tilePx(this.data.w), tilePx(this.data.h), this._accent, this._radius, false);
            try { global.unset_cursor(); } catch(e){}
        });

        // Click events
        this._signals.connect(this._actor, 'button-press-event', (a, ev) => {
            global.log("MintTenMenu: Tile Button Press");
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                return Clutter.EVENT_PROPAGATE;
            }
            return Clutter.EVENT_STOP;
        });
        this._signals.connect(this._actor, 'button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                if (!this._dragging) {
                    if (this.data.type === 'folder') {
                        if (this.data.expanded) {
                            let expWidget = null;
                            if (this.applet._tileArea) {
                                expWidget = this.applet._tileArea.getExpansionWidget(this.data.id);
                            }
                            if (expWidget) {
                                expWidget.collapseAnimated(() => {
                                    this.layoutEngine.collapseFolder(this.data.id);
                                    if (this.applet._tileArea) {
                                        this.applet._tileArea.refreshAll();
                                    }
                                });
                                // Animate other tiles back up immediately
                                this.layoutEngine.collapseFolder(this.data.id);
                                if (this.applet._tileArea) {
                                    this.applet._tileArea.animateCandidateLayout(this.layoutEngine.tiles);
                                }
                            } else {
                                this.layoutEngine.collapseFolder(this.data.id);
                                if (this.applet._tileArea) {
                                    this.applet._tileArea.refreshAll();
                                }
                            }
                        } else {
                            this.layoutEngine.expandFolder(this.data.id);
                            if (this.applet._tileArea) {
                                this.applet._tileArea.refreshAll();
                            }
                        }
                    } else {
                        this._launch();
                    }
                }
                return Clutter.EVENT_STOP;
            }
            if (ev.get_button() === Clutter.BUTTON_SECONDARY) {
                this._showCtxMenu();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _applyStyle(w, h, accent, radius, hovered) {
        if (this.data && (this.data.widgetKind === 'weather' || this.data.widgetKind === 'weather2' || this.data.widgetKind === 'finance' || this.data.widgetKind === 'forex')) {
            this._actor.style = `background-color: transparent; border-radius: ${radius}px; padding: 0px; clip-to-allocation: true;`;
        } else if (this.data && this.data.widgetKind === 'quote') {
            this._actor.style =
                `background-color:${accent}; border-radius:${radius}px; ` +
                `padding: 4px;`;
        } else if (this.data && this.data.widgetKind === 'calendar') {
            this._actor.style = `background-color:${accent}; border-radius: ${radius}px; padding: 4px;`;
        } else {
            const bg = hovered ? lightenHex(accent, 40) : accent;
            this._actor.style =
                `background-color:${bg}; border-radius:${radius}px; ` +
                `padding: 4px;`;
        }
        this._actor.set_size(w, h);
    }

    refreshStyle() {
        const w      = tilePx(this.data.w);
        const h      = tilePx(this.data.h);
        const radius = (this.applet.settings.tileCornerRadius !== undefined)
            ? this.applet.settings.tileCornerRadius : 0;
        const accent = (this.applet.settings.tileAccentColors && this.data.accentColor)
            ? this.data.accentColor : ACCENT_COLORS[0];
        this._accent = accent;
        this._radius = radius;
        this._applyStyle(w, h, accent, radius, false);
    }

    // ---- Colour picker integration -----------------------------------------
    // previewAccentColor() mutates only the live tile; persistence happens in
    // commitAccentColor() via the existing 'changed' pipeline.

    previewAccentColor(color) {
        this.data.accentColor = color;
        if (this.data.type === 'widget') {
            this.data.config = this.data.config || {};
            this.data.config.backgroundColor = color;
        }
        this.refreshStyle();
    }

    restoreAccentColor(original) {
        this.data.accentColor = original.accentColor;
        if (this.data.type === 'widget') {
            this.data.config = this.data.config || {};
            if (original.hadConfigBg) {
                this.data.config.backgroundColor = original.configBg;
            } else {
                delete this.data.config.backgroundColor;
            }
        }
        this.refreshStyle();
    }

    commitAccentColor(color) {
        this.data.accentColor = color;
        if (this.data.type === 'widget') {
            this.data.config = this.data.config || {};
            this.data.config.backgroundColor = color;
        }
        this.refreshStyle();
        if (this._cbs.changed) this._cbs.changed(this);
        else this.layoutEngine.save();
    }

    updateGeometryAndStyle(animate = false) {
        const size   = this.data.size || 'medium';
        const w      = tilePx(this.data.w);
        const h      = tilePx(this.data.h);
        const radius = (this.applet.settings.tileCornerRadius !== undefined)
            ? this.applet.settings.tileCornerRadius : 0;
        const accent = (this.applet.settings.tileAccentColors && this.data.accentColor)
            ? this.data.accentColor : ACCENT_COLORS[0];

        this._accent = accent;
        this._radius = radius;

        if (this.data && (this.data.widgetKind === 'weather' || this.data.widgetKind === 'weather2' || this.data.widgetKind === 'finance' || this.data.widgetKind === 'forex')) {
            this._actor.style = `background-color: transparent; border-radius: ${radius}px; padding: 0px; clip-to-allocation: true;`;
        } else if (this.data && this.data.widgetKind === 'quote') {
            this._actor.style =
                `background-color:${accent}; border-radius:${radius}px; ` +
                `padding: 4px;`;
        } else if (this.data && this.data.widgetKind === 'calendar') {
            this._actor.style = `background-color:${accent}; border-radius: ${radius}px; padding: 4px;`;
        } else {
            const bg = this._actor.hover ? lightenHex(accent, 40) : accent;
            this._actor.style =
                `background-color:${bg}; border-radius:${radius}px; ` +
                `padding: 4px;`;
        }

        if (animate) {
            this._actor.save_easing_state();
            this._actor.set_easing_duration(150);
            this._actor.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
            this._actor.set_size(w, h);
            this._actor.restore_easing_state();
        } else {
            this._actor.set_size(w, h);
        }

        this._updateIconBoxLayout();
        this.updateIcon(animate);

        if (this._titleLabel) {
            const visible = (size !== 'small');
            this._titleLabel.visible = visible;
            if (visible) {
                const nameText = (this.data.type === 'folder')
                    ? (this.data.name || 'Folder')
                    : (this.data.appName || this.app.name || '');
                this._titleLabel.set_text(nameText);
            }
        }
    }

    updateIcon(animate = false) {
        const newIconSize = this.getAdaptiveIconSize();
        if (this._icon) {
            if (animate) {
                this._icon.save_easing_state();
                this._icon.set_easing_duration(150);
                this._icon.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
                if (this._icon instanceof St.Icon) {
                    this._icon.icon_size = newIconSize;
                } else {
                    this._icon.set_size(newIconSize, newIconSize);
                }
                this._icon.restore_easing_state();
            } else {
                if (this._icon instanceof St.Icon) {
                    this._icon.icon_size = newIconSize;
                } else {
                    this._icon.set_size(newIconSize, newIconSize);
                }
            }
        }
    }

    _launch() {
        setTimeout(() => {
            try { this.app.cinnamonApp.open_new_window(-1); } catch(e) {
                global.logWarning('MintTenMenu: tile launch failed: ' + e);
            }
            this.applet.menu.close();
        }, 80);
    }

    _closeCtxMenu() {
        this.applet.closeActiveContextMenu();
    }

    _startRename() {
        if (this._renaming) return;
        this._renaming = true;
        this._nameEntry = new St.Entry({
            text: this.data.name || 'Folder',
            style_class: 'wintenmenu-folder-rename-entry',
            can_focus: true,
        });
        this._nameEntry.clutter_text.set_single_line_mode(true);
        this._actor.replace_child(this._titleLabel, this._nameEntry);
        global.stage.set_key_focus(this._nameEntry.clutter_text);

        // Hand focus back to the menu before the entry is destroyed; otherwise
        // PopupMenuManager sees key focus leave the menu and closes it.
        const restoreMenuFocus = () => {
            try { this.applet.menu.actor.grab_key_focus(); } catch(e){}
        };

        const commit = (restoreFocus = true) => {
            if (!this._renaming) return;
            this._renaming = false;
            const newName = (this._nameEntry.get_text() || '').trim() || this.data.name;
            this.data.name = newName;
            this._titleLabel.set_text(newName);
            if (restoreFocus) restoreMenuFocus();
            try { this._actor.replace_child(this._nameEntry, this._titleLabel); } catch(e){}
            try { this._nameEntry.destroy(); } catch(e){}
            this._nameEntry = null;
            if (this._cbs.changed) this._cbs.changed(this);
        };

        this._signals.connect(this._nameEntry.clutter_text, 'key-press-event', (a, ev) => {
            const sym = ev.get_key_symbol();
            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
                commit(); return Clutter.EVENT_STOP;
            }
            if (sym === Clutter.KEY_Escape) {
                this._renaming = false;
                restoreMenuFocus();
                try { this._actor.replace_child(this._nameEntry, this._titleLabel); } catch(e){}
                try { this._nameEntry.destroy(); } catch(e){}
                this._nameEntry = null;
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._signals.connect(this._nameEntry.clutter_text, 'key-focus-out', () => commit(false));
    }

    _showCtxMenu() {
        this._closeCtxMenu();

        this._ctxMenu = new CtxMenu(this.applet, this._actor, () => {
            this._ctxMenu = null;
        });

        this.applet.registerActiveContextMenu(this._ctxMenu);

        if (this.data.type === 'folder') {
            this._ctxMenu.addItem('Rename Folder', () => {
                this._startRename();
            });

            this._ctxMenu.addItem('Delete Folder', () => {
                this.layoutEngine.deleteFolder(this.data.id);
                if (this.applet._tileArea) {
                    this.applet._tileArea._loadAndPopulate();
                }
            });

            this._ctxMenu.addSubItem('Resize', (flyout) => {
                const sizes = [
                    ['Medium (2×2)', 'medium'],
                    ['Wide (4×2)',   'wide'],
                    ['Large (4×4)',  'large'],
                ];
                sizes.forEach(([label, sz]) => {
                    const isCurrent = (this.data.size || 'medium') === sz;
                    const prefix    = isCurrent ? '✓  ' : '    ';
                    flyout.addItem(prefix + label, '', () => {
                        if (this._cbs.resize) this._cbs.resize(this, sz);
                    });
                });
            });
        } else if (this.data.type === 'widget') {
            global.log("[Widget] _showCtxMenu called for tileData.id = " + this.data.id + ", TileItem = " + this + ", Actor = " + this._actor);
            this._ctxMenu.addItem('Configure Widget', () => {
                global.log("[Widget] Configure Widget clicked for tileData.id = " + this.data.id + ", TileItem = " + this + ", Actor = " + this._actor);
                if (this._widget) this._widget.openSettings();
            });

            this._ctxMenu.addItem('Refresh Now', () => {
                global.log("[Widget] Refresh Now clicked for tileData.id = " + this.data.id + ", TileItem = " + this + ", Actor = " + this._actor);
                if (this._widget) this._widget.refresh();
            });

            this._ctxMenu.addSeparator();

            this._ctxMenu.addItem('Unpin from Start', () => {
                global.log("[Widget] Unpin from Start clicked for tileData.id = " + this.data.id + ", TileItem = " + this + ", Actor = " + this._actor);
                if (this._cbs.unpin) this._cbs.unpin(this);
            });
        } else {
            this._ctxMenu.addItem('Open', () => {
                this._launch();
            });

            this._ctxMenu.addSeparator();

            this._ctxMenu.addItem('Unpin from Start', () => {
                if (this._cbs.unpin) this._cbs.unpin(this);
            });

            this._ctxMenu.addSubItem('Resize', (flyout) => {
                const sizes = [
                    ['Small (1×1)',  'small'],
                    ['Medium (2×2)', 'medium'],
                    ['Wide (4×2)',   'wide'],
                    ['Large (4×4)',  'large'],
                ];
                sizes.forEach(([label, sz]) => {
                    const isCurrent = (this.data.size || 'medium') === sz;
                    const prefix    = isCurrent ? '✓  ' : '    ';
                    flyout.addItem(prefix + label, '', () => {
                        if (this._cbs.resize) this._cbs.resize(this, sz);
                    });
                });
            });
        }

        if (this.applet.settings.tileAccentColors && this.data.widgetKind !== 'weather' && this.data.widgetKind !== 'weather2' && this.data.widgetKind !== 'finance' && this.data.widgetKind !== 'forex') {
            this._ctxMenu.addSubItem('Tile color', null, (row) => {
                const menuActor = this._ctxMenu && this._ctxMenu._actor;
                if (!menuActor) return;
                const [mx, my] = menuActor.get_transformed_position();
                const anchor = {
                    x: mx,
                    y: my,
                    width: menuActor.width,
                    height: menuActor.height,
                    exact: true,
                };
                this.applet.closeActiveContextMenu();
                this.applet.showColorPicker(this, anchor);
            });
        }
    }

    _setupDnD() {
        this._actor._delegate = this;
        this.isDraggableApp   = true;

        this._draggable = makeDraggable(this._actor, {
            restoreOnSuccess: false,
        });

        this._signals.connect(this._draggable, 'drag-begin', () => {
            try {
                this._dragging = true;
                this._closeCtxMenu();
                this._actor.set_opacity(80);
                if (this.applet._tileArea) {
                    this.applet._tileArea.layoutEngine.collapseAllFolders();
                    this.applet._tileArea.disableScrolling();
                }
                global.log("MintTenMenu: Drag Begin");
            } catch (e) {
                global.logWarning("MintTenMenu: Error in drag-begin: " + e);
            }
        });
        this._signals.connect(this._draggable, 'drag-cancelled', () => {
            try {
                this._dragging = false;
                this._actor.set_opacity(255);
                if (this.applet._tileArea) {
                    this.applet._tileArea.enableScrolling();
                    this.applet._tileArea.revertToOriginalLayout();
                }
                global.log("MintTenMenu: Drag Finished (cancelled)");
            } catch (e) {
                global.logWarning("MintTenMenu: Error in drag-cancelled: " + e);
                if (this.applet._tileArea) {
                    this.applet._tileArea.enableScrolling();
                }
            }
        });
        this._signals.connect(this._draggable, 'drag-end', () => {
            try {
                this._dragging = false;
                this._actor.set_opacity(255);
                if (this.applet._tileArea) {
                    this.applet._tileArea.enableScrolling();
                    this.applet._tileArea.refreshAll();
                }
                global.log("MintTenMenu: Drag Finished");
            } catch (e) {
                global.logWarning("MintTenMenu: Error in drag-end: " + e);
                if (this.applet._tileArea) {
                    this.applet._tileArea.enableScrolling();
                }
            }
        });
    }
}

module.exports = { TileItem, TileSize, SIZE_UNITS, GRID_UNIT, GRID_GAP, tilePx, ACCENT_COLORS, CtxMenu };
