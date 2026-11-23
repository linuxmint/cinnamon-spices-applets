/*
 * capsule.js - Kapszula panel monitor, display module.
 *
 * Owns pixels only: raw St widgets, fixed geometry, style classes.
 * It knows nothing about where the numbers come from or what a threshold is.
 *
 * Contract (SPEC 7.2):
 *   new Capsule(panelHeight)
 *   capsule.actor                                             St.BoxLayout
 *   capsule.setLayout(elements, showLabels, fixedWidthPx, colors)
 *   capsule.setValues(display)
 *   capsule.setAlert(bool)
 *   capsule.destroy()
 *
 * Two rules drive every decision in this file:
 *
 * 1. The panel must never jump. Every cell has a hard fixed width, so "7" and
 *    "100" occupy the same box. setValues() only touches text, fill width, bar
 *    pixel heights and style classes; it never creates or removes a widget and
 *    never resizes anything whose size can propagate outwards. The capsule
 *    width is decided in setLayout() and stays there until the next settings
 *    change.
 *
 * 2. Cinnamon's St has no flexbox and no `gap`. Layout is St.BoxLayout with the
 *    `vertical` property plus CSS `spacing`; sizes come from set_width() /
 *    set_height() and from Clutter actor margins. Centering is done with
 *    Clutter.ActorAlign on the cross axis of a box (the cross axis always gets
 *    the full extent, so no x-expand is needed - and no x-expand means the
 *    applet can never claim extra panel width and push the clock aside).
 *
 * v2 changes, all of them inside those two rules:
 *   - the value line is a horizontal box: 12 px number + 8 px unit label,
 *     bottom aligned (SPEC 4);
 *   - the cell is 30 px wide with and without labels, and 32 px when the
 *     caller marks the element `wide` because its number is an absolute one
 *     (SPEC 4, 5.1). The mode itself stays in applet.js: this module is told
 *     the width class, not the meaning;
 *   - the equalizer is gone; the network cell is a 97 px wide
 *     [graph 59][gap 4][numbers 34] block, the graph and the two direction
 *     arrows drawn with Cairo into St.DrawingArea (SPEC 4, 7.2).
 */

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
// Loading the cairo module is what makes DrawingArea.get_context() hand back a
// usable context, so this import is required even though no symbol of it is
// referenced by name.
const Cairo = imports.cairo;

/* --- Geometry, SPEC 4. Values are for the designed 32 px capsule. --- */

const CELL_WIDTH_LABEL = 30;      // percentage cell, with a label
const CELL_WIDTH_NOLABEL = 30;    // percentage cell, without a label
// Both are 30 px on purpose: the widest content is "100" + "%" = 28 px measured
// in the real Ubuntu font, and that content is the same either way. Turning the
// labels off no longer narrows the capsule, it only thickens the bar.
const CELL_WIDTH_WIDE = 32;       // absolute value cell, with or without a label
// An absolute number is wider than a percentage: the worst case is "31,8" + "G"
// = 29,5 px measured, and a 30 px cell only offers 28 px of content. 32 px fits
// it with about the same air on either side that "100" + "%" gets in the narrow
// cell. This is a width class and nothing more - which elements get it is
// applet.js's decision (SPEC 4, 5.1, 7.2).
const CELL_SPACING = 7;           // gap between cells
// The 9 px left and right padding of the pill is not set here: it is the
// padding rule on .kapszula-capsule in stylesheet.css. Total capsule width is
// therefore 18 + the sum of the cell widths + 7 px between neighbouring cells:
// 18 + 30*n + 97 + 7*n with percentage cells only, and 2 px more per cell the
// caller marks wide. This is the SPEC 4 formula.

const CONTENT_HEIGHT = 27;        // cell content height inside the 32 px capsule

const LABEL_SLOT = 9.5;           // 8 px label + 1.5 px gap below it
const VALUE_SLOT_LABEL = 14.5;    // 12 px value + 2.5 px gap below it
const VALUE_SLOT_NOLABEL = 15;    // 12 px value + 3 px gap below it
const BAR_HEIGHT_LABEL = 3;
const BAR_HEIGHT_NOLABEL = 12;
const BAR_HEIGHT_MIN = 2;         // only reached on a panel too short for the design

/* --- Network cell, SPEC 4. 97 = 59 + 4 + 34. --- */

const NET_CELL_WIDTH = 97;
const NET_GRAPH_WIDTH = 59;       // 20 columns: 19 * 3 px pitch + 2 px last column
const NET_INNER_GAP = 4;          // between the graph and the numbers
const NET_NUMBERS_WIDTH = 34;

const NET_BAR_COUNT = 20;         // 20 buckets of 1 s = a 20 s window (SPEC 6.2)
const NET_BAR_WIDTH = 2;
const NET_BAR_PITCH = 3;
const NET_BAR_RADIUS = 1;
const NET_BAR_MIN_HEIGHT = 1;     // any traffic at all must leave a visible tick
const NET_AXIS_ALPHA = 0.10;      // rgba(255,255,255,0.10), SPEC 4.1
const NET_ARROW_SIZE = 6;         // the Cairo drawn direction triangle, 6 x 6 px
const NET_UNIT_FONT = 7;          // the unit next to a network number is 7 px

// SPEC 4.1: these are settings, not constants. They are only the fallback for a
// missing or unparsable colour string.
const NET_COLOR_UP_DEFAULT = "#E5484D";
const NET_COLOR_DOWN_DEFAULT = "#46A758";

/* --- Panel height handling, SPEC 7.3 --- */

const CAPSULE_HEIGHT_MIN = 22;
const CAPSULE_HEIGHT_MAX = 34;
const CAPSULE_HEIGHT_INSET = 8;   // capsuleHeight = clamp(panelHeight - 8, 22, 34)
const LABELS_MIN_HEIGHT = 28;     // below this there is no room for labels
const DEFAULT_PANEL_HEIGHT = 40;  // fallback if the applet passes something unusable

/* --- Element identity --- */

const NET_ID = "net";             // the one element drawn as a graph
const MISSING_TEXT = "—";    // em dash, shown when a value is missing or null

const LABEL_TEXT = {
    mem: "MEM",
    cpu: "CPU",
    gpu: "GPU",
    ssd: "SSD",
    swp: "SWP",
    gfx: "GFX",
    tmp: "TMP"
};
// "net" is deliberately absent: the network cell has no label, the graph and the
// arrows fill all 27 px on their own (SPEC 5).

/* --- CSS class names, SPEC 7.4. Fixed, stylesheet.css matches on these. --- */

const CLASS_CAPSULE = "kapszula-capsule";
const CLASS_CAPSULE_ALERT = "kapszula-capsule-alert";
const CLASS_CELL = "kapszula-cell";
const CLASS_CELL_NOLABEL = "kapszula-cell-nolabel";
const CLASS_LABEL = "kapszula-label";
const CLASS_LABEL_ALERT = "kapszula-label-alert";
const CLASS_VALUE = "kapszula-value";
const CLASS_VALUE_ALERT = "kapszula-value-alert";
const CLASS_UNIT = "kapszula-unit";
const CLASS_UNIT_ALERT = "kapszula-unit-alert";
const CLASS_TRACK = "kapszula-track";
const CLASS_TRACK_NOLABEL = "kapszula-track-nolabel";
const CLASS_FILL = "kapszula-fill";
const CLASS_FILL_ALERT = "kapszula-fill-alert";
const CLASS_NETNUM = "kapszula-netnum";

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
}

/*
 * setLayout() takes { id, wide } objects since v2. A caller written against v1
 * hands over plain id strings instead, and one forgotten caller must not be
 * able to bring the panel down, so a bare string is read as
 * { id: <string>, wide: false } - the v1 geometry, which is exactly what such a
 * caller means. Anything without a usable id is dropped rather than turned into
 * a cell labelled with garbage.
 *
 * Only `true` means wide: a missing, null or "abs" valued flag all fall back to
 * the narrow cell, because a wrong guess here would widen the capsule.
 */
function normalizeElements(elements) {
    let list = Array.isArray(elements) ? elements : [];
    let out = [];

    for (let i = 0; i < list.length; i++) {
        let entry = list[i];
        let id = null;
        let wide = false;

        if (entry && typeof entry === "object") {
            if (entry.id !== null && entry.id !== undefined)
                id = String(entry.id);
            wide = (entry.wide === true);
        } else if (entry !== null && entry !== undefined) {
            id = String(entry);
        }

        if (id === null || id === "")
            continue;

        out.push({ id: id, wide: wide });
    }

    return out;
}

/*
 * Cairo wants three floats, the settings hand us a string. Cinnamon's
 * colorchooser has emitted both "#rrggbb" and "rgb(r,g,b)" over the years, so
 * both are accepted; a shorthand or an alpha channel is tolerated and the alpha
 * ignored, because these two colours are always painted opaque.
 * Returns [r, g, b] in 0..1, or null if the string is not a colour.
 */
function parseColor(value) {
    if (typeof value !== "string")
        return null;

    let text = value.trim();

    let hex = /^#([0-9a-fA-F]+)$/.exec(text);
    if (hex) {
        let digits = hex[1];
        let step;
        if (digits.length === 3 || digits.length === 4)
            step = 1;
        else if (digits.length === 6 || digits.length === 8)
            step = 2;
        else if (digits.length === 12 || digits.length === 16)
            step = 4;
        else
            return null;

        let out = [];
        for (let i = 0; i < 3; i++) {
            let part = digits.substr(i * step, step);
            let max = Math.pow(16, step) - 1;
            // "f" means the same as "ff" and as "ffff", hence the division by max.
            out.push(parseInt(part, 16) / max);
        }
        return out;
    }

    let rgb = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/.exec(text);
    if (rgb) {
        let out = [];
        for (let i = 1; i <= 3; i++) {
            let channel = parseFloat(rgb[i]);
            if (!isFiniteNumber(channel))
                return null;
            out.push(clamp(channel, 0, 255) / 255);
        }
        return out;
    }

    return null;
}

function Capsule(panelHeight) {
    this._init(panelHeight);
}

Capsule.prototype = {

    _init: function(panelHeight) {
        let height = isFiniteNumber(panelHeight) ? panelHeight : DEFAULT_PANEL_HEIGHT;

        // SPEC 7.3: the panel height is never hard coded, it is derived here.
        this.capsuleHeight = clamp(Math.round(height) - CAPSULE_HEIGHT_INSET,
                                   CAPSULE_HEIGHT_MIN, CAPSULE_HEIGHT_MAX);
        // Below 28 px there is no room for the 8 px labels, so they are forced off.
        // Exposed so applet.js can put the matching first line in the tooltip.
        this.labelsPossible = this.capsuleHeight >= LABELS_MIN_HEIGHT;
        this.labelsForcedOff = false;

        this._destroyed = false;
        this._alert = false;
        this._showLabels = false;
        this._cells = [];
        // Pango "tnum" is applied through markup because St's CSS parser has no
        // font-feature-settings. If markup ever fails we fall back to plain text.
        this._useMarkup = true;

        this._netColors = {
            up: parseColor(NET_COLOR_UP_DEFAULT),
            down: parseColor(NET_COLOR_DOWN_DEFAULT)
        };

        // Outer actor: what applet.js adds to the panel. Never expands.
        this.actor = new St.BoxLayout({ x_expand: false, y_expand: false });

        // Centering host. St.Bin does align/fill itself, so we do not need
        // Clutter's x-expand, which would propagate up and let the applet steal
        // panel width from its neighbours.
        this._bin = new St.Bin({
            x_fill: false,
            y_fill: false,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });

        // The pill itself. Width stays natural: cells + spacing + the 9+9 px
        // padding that stylesheet.css puts on .kapszula-capsule.
        this._capsule = new St.BoxLayout({ style_class: CLASS_CAPSULE });
        this._capsule.set_height(this.capsuleHeight);
        // spacing is layout, so it belongs here and not in the stylesheet.
        // border-radius is overridden with half of the real height so the capsule
        // stays a pill on a panel shorter than the designed 40 px.
        this._capsule.set_style("spacing: " + CELL_SPACING + "px; " +
                                "border-radius: " + (this.capsuleHeight / 2) + "px;");

        this._bin.set_child(this._capsule);
        this.actor.add_child(this._bin);
    },

    /*
     * Full rebuild. Called on settings changes only, never from the data cycle.
     *
     * elements is [{ id: "mem", wide: true }, ...]: the order is the user's
     * (SPEC 10) and `wide` asks for the 32 px cell an absolute number needs
     * (SPEC 5.1). Plain id strings are still accepted and read as narrow cells.
     * showLabels may be overridden by the panel height; fixedWidthPx > 0
     * reserves that much space and centers the capsule in it; colors is
     * { netUp, netDown } hex strings.
     *
     * Every cell width in the capsule is decided here and nowhere else, so the
     * only thing that can change it is a settings change.
     */
    setLayout: function(elements, showLabels, fixedWidthPx, colors) {
        if (this._destroyed)
            return;

        this._releaseCells();
        this._capsule.destroy_all_children();
        this._cells = [];

        let palette = (colors && typeof colors === "object") ? colors : {};
        // A missing or malformed colour must not blank out the graph, so each
        // channel falls back to the SPEC 4.1 default on its own.
        this._netColors = {
            up: parseColor(palette.netUp) || parseColor(NET_COLOR_UP_DEFAULT),
            down: parseColor(palette.netDown) || parseColor(NET_COLOR_DOWN_DEFAULT)
        };

        let list = normalizeElements(elements);
        let wanted = (showLabels === true);
        this._showLabels = wanted && this.labelsPossible;
        this.labelsForcedOff = wanted && !this.labelsPossible;

        let metrics = this._computeMetrics(this._showLabels);

        for (let i = 0; i < list.length; i++) {
            let entry = list[i];
            // The network cell is always 97 px: it holds a graph and two
            // preformatted numbers, so `wide` has no meaning for it (SPEC 7.2).
            let cell = (entry.id === NET_ID)
                ? this._buildNetCell(entry.id, metrics)
                : this._buildValueCell(entry.id, metrics, entry.wide);
            this._cells.push(cell);
            this._capsule.add_child(cell.actor);
        }

        let reserved = isFiniteNumber(fixedWidthPx) ? Math.round(fixedWidthPx) : 0;
        // -1 clears the fixed size and lets the bin fall back to its natural width.
        this._bin.set_width(reserved > 0 ? reserved : -1);
    },

    /*
     * Per second update. Text, fill width, bar pixel heights and style classes
     * only. Every write is guarded by a comparison so an unchanged value costs
     * nothing and triggers no style recomputation, and the network graph asks
     * for at most one repaint per cycle.
     */
    setValues: function(display) {
        if (this._destroyed)
            return;

        let data = (display && typeof display === "object") ? display : {};

        for (let i = 0; i < this._cells.length; i++) {
            let cell = this._cells[i];
            let item = data[cell.id];
            if (cell.kind === "net")
                this._updateNetCell(cell, item);
            else
                this._updateValueCell(cell, item);
        }
    },

    /* Capsule background. Nothing moves, nothing resizes. */
    setAlert: function(on) {
        if (this._destroyed)
            return;

        let state = (on === true);
        if (state === this._alert)
            return;
        this._alert = state;

        // The alert class is added next to the base class, never instead of it.
        if (state)
            this._capsule.add_style_class_name(CLASS_CAPSULE_ALERT);
        else
            this._capsule.remove_style_class_name(CLASS_CAPSULE_ALERT);
    },

    destroy: function() {
        if (this._destroyed)
            return;
        this._destroyed = true;

        this._releaseCells();
        this._cells = [];

        // Destroying the root actor tears down every widget it built; the repaint
        // handlers of the drawing areas were already disconnected above.
        if (this.actor && !(this.actor.is_finalized && this.actor.is_finalized()))
            this.actor.destroy();

        this.actor = null;
        this._bin = null;
        this._capsule = null;
    },

    /* Disconnect every repaint handler this module connected. */
    _releaseCells: function() {
        for (let i = 0; i < this._cells.length; i++) {
            let signals = this._cells[i].signals;
            if (!signals)
                continue;
            for (let j = 0; j < signals.length; j++) {
                try {
                    signals[j].actor.disconnect(signals[j].id);
                } catch (e) {
                    // The actor is already gone; there is nothing left to detach.
                }
            }
            this._cells[i].signals = [];
        }
    },

    /* ------------------------------------------------------------------ */
    /* Geometry                                                            */
    /* ------------------------------------------------------------------ */

    /*
     * On the designed 40 px panel this returns exactly the SPEC 4 numbers:
     * cell 30 px wide (32 px for a wide one), 27 px of content, bar 3 px with
     * labels and 12 px without. On a shorter panel the value slot keeps the room
     * the 12 px digits need and the bar absorbs the loss; the network cell
     * follows the same cell height so every cell still ends on the same
     * baseline. Only the height depends on the panel - the widths are the same
     * on every panel, because the font size is.
     */
    _computeMetrics: function(showLabels) {
        let available = Math.min(CONTENT_HEIGHT, this.capsuleHeight - 2);

        let labelSlot = showLabels ? LABEL_SLOT : 0;
        let valueSlot = showLabels ? VALUE_SLOT_LABEL : VALUE_SLOT_NOLABEL;
        let designBar = showLabels ? BAR_HEIGHT_LABEL : BAR_HEIGHT_NOLABEL;
        let barHeight = Math.max(BAR_HEIGHT_MIN,
                                 Math.min(designBar, available - labelSlot - valueSlot));

        let cellHeight = labelSlot + valueSlot + barHeight;

        return {
            showLabels: showLabels,
            cellWidth: showLabels ? CELL_WIDTH_LABEL : CELL_WIDTH_NOLABEL,
            // The wide cell is 32 px either way: an absolute number takes the
            // same room whether or not there is a label above it (SPEC 4).
            cellWidthWide: CELL_WIDTH_WIDE,
            cellHeight: cellHeight,
            labelSlot: labelSlot,
            valueSlot: valueSlot,
            barHeight: barHeight,
            // 27 / 2 - 0.5 = 13, the SPEC 4 maximum deflection per direction. The
            // half pixel is the room the 1 px centre line takes.
            netMaxDeflect: Math.max(1, cellHeight / 2 - 0.5)
        };
    },

    /* ------------------------------------------------------------------ */
    /* Cell construction                                                   */
    /* ------------------------------------------------------------------ */

    _newCellActor: function(metrics, width) {
        let cell = new St.BoxLayout({ vertical: true, style_class: CLASS_CELL });
        if (!metrics.showLabels)
            cell.add_style_class_name(CLASS_CELL_NOLABEL);

        // Hard fixed size: set_width/set_height pin both the minimum and the
        // natural size, so no child can ever widen the cell.
        cell.set_width(width);
        cell.set_height(metrics.cellHeight);
        // The capsule is taller than the content, so center the cell in it.
        cell.set_y_align(Clutter.ActorAlign.CENTER);
        return cell;
    },

    _newLabelActor: function(id, metrics) {
        // Uppercase here: St's CSS has no text-transform.
        let text = LABEL_TEXT[id] || id.toUpperCase();
        let label = new St.Label({ style_class: CLASS_LABEL, text: text });
        label.set_height(metrics.labelSlot);
        // Cross axis of a vertical box: the child gets the full cell width, so
        // ActorAlign.CENTER centers it without any expand flag.
        label.set_x_align(Clutter.ActorAlign.CENTER);
        return label;
    },

    /*
     * A percentage, temperature or absolute value cell. `wide` picks the width
     * class and nothing else: the layout inside is identical either way, the
     * number just gets 2 px more room. The width is frozen here; the track and
     * therefore the fill scale follow it, so setValues() never has to know it.
     */
    _buildValueCell: function(id, metrics, wide) {
        let cellWidth = (wide === true) ? metrics.cellWidthWide : metrics.cellWidth;
        let cellActor = this._newCellActor(metrics, cellWidth);

        let labelActor = null;
        if (metrics.showLabels) {
            labelActor = this._newLabelActor(id, metrics);
            cellActor.add_child(labelActor);
        }

        // The value line: number and unit side by side in one horizontal box,
        // the box centered in the cell. Both children are bottom aligned, and
        // since neither a digit nor "%" nor "°" has a descender, matching the
        // bottom edges is the same as matching the baselines (SPEC 7.2).
        let valueRow = new St.BoxLayout();
        valueRow.set_height(metrics.valueSlot);
        valueRow.set_x_align(Clutter.ActorAlign.CENTER);
        cellActor.add_child(valueRow);

        let valueActor = new St.Label({ style_class: CLASS_VALUE });
        valueActor.set_y_align(Clutter.ActorAlign.END);
        valueRow.add_child(valueActor);

        let unitActor = new St.Label({ style_class: CLASS_UNIT });
        unitActor.set_y_align(Clutter.ActorAlign.END);
        // An element without a unit must not leave a hole next to the number.
        unitActor.hide();
        valueRow.add_child(unitActor);

        let trackActor = new St.BoxLayout({ style_class: CLASS_TRACK });
        if (!metrics.showLabels)
            trackActor.add_style_class_name(CLASS_TRACK_NOLABEL);
        trackActor.set_width(cellWidth);
        trackActor.set_height(metrics.barHeight);
        trackActor.set_x_align(Clutter.ActorAlign.CENTER);
        cellActor.add_child(trackActor);

        // The fill is the only actor whose size changes per second. It lives
        // inside a hard sized track, so its width can never reach the panel.
        let fillActor = new St.Widget({ style_class: CLASS_FILL });
        fillActor.set_height(metrics.barHeight);
        fillActor.set_y_align(Clutter.ActorAlign.FILL);
        fillActor.set_width(0);
        trackActor.add_child(fillActor);

        let cell = {
            id: id,
            kind: "value",
            wide: (wide === true),
            actor: cellActor,
            signals: [],
            labelActor: labelActor,
            valueActor: valueActor,
            unitActor: unitActor,
            fillActor: fillActor,
            tabularActors: [valueActor],
            trackWidth: cellWidth,
            lastText: null,
            lastUnit: "",
            lastFillWidth: 0,
            lastAlert: false
        };

        this._applyText(cell, "lastText", valueActor, MISSING_TEXT);
        return cell;
    },

    /*
     * The network cell, SPEC 4: [graph 59][gap 4][numbers 34], 97 px wide, no
     * label. The graph is one St.DrawingArea painted with Cairo - forty separate
     * bar widgets would cost forty allocations a second for no gain.
     */
    _buildNetCell: function(id, metrics) {
        let cellActor = new St.BoxLayout({ style_class: CLASS_CELL });
        if (!metrics.showLabels)
            cellActor.add_style_class_name(CLASS_CELL_NOLABEL);
        cellActor.set_width(NET_CELL_WIDTH);
        cellActor.set_height(metrics.cellHeight);
        cellActor.set_y_align(Clutter.ActorAlign.CENTER);
        // The 4 px between the graph and the numbers is layout, so it is box
        // spacing and not a stylesheet rule.
        cellActor.set_style("spacing: " + NET_INNER_GAP + "px;");

        let cell = {
            id: id,
            kind: "net",
            actor: cellActor,
            signals: [],
            labelActor: null,
            graphActor: null,
            upHeights: new Array(NET_BAR_COUNT).fill(0),
            downHeights: new Array(NET_BAR_COUNT).fill(0),
            maxDeflect: metrics.netMaxDeflect,
            colorUp: this._netColors.up,
            colorDown: this._netColors.down,
            tabularActors: [],
            lastAlert: false
        };

        let graphActor = new St.DrawingArea();
        graphActor.set_width(NET_GRAPH_WIDTH);
        graphActor.set_height(metrics.cellHeight);
        graphActor.set_y_align(Clutter.ActorAlign.CENTER);
        cell.signals.push({
            actor: graphActor,
            id: graphActor.connect("repaint", (area) => this._drawNetGraph(area, cell))
        });
        cellActor.add_child(graphActor);
        cell.graphActor = graphActor;

        let numbersActor = new St.BoxLayout({ vertical: true });
        numbersActor.set_width(NET_NUMBERS_WIDTH);
        numbersActor.set_height(metrics.cellHeight);
        cellActor.add_child(numbersActor);

        // Two rows of equal height: the upload one in the top half, the download
        // one in the bottom half, both right aligned (SPEC 4).
        let rowHeight = metrics.cellHeight / 2;
        cell.up = this._buildNetRow(cell, numbersActor, rowHeight, cell.colorUp, true);
        cell.down = this._buildNetRow(cell, numbersActor, rowHeight, cell.colorDown, false);

        return cell;
    },

    /* One network row: [number][arrow 6x6][unit 7 px], right aligned. */
    _buildNetRow: function(cell, parent, rowHeight, color, isUp) {
        let rowActor = new St.BoxLayout();
        rowActor.set_height(rowHeight);
        // Cross axis of a vertical box, so END right aligns the whole row inside
        // the 34 px numbers column without any expand flag.
        rowActor.set_x_align(Clutter.ActorAlign.END);
        parent.add_child(rowActor);

        let numActor = new St.Label({ style_class: CLASS_NETNUM });
        numActor.set_y_align(Clutter.ActorAlign.END);
        rowActor.add_child(numActor);

        // No Unicode triangle anywhere: the arrow is Cairo, in the colour of its
        // own series (SPEC 3.4, 7.2).
        let arrowActor = new St.DrawingArea();
        arrowActor.set_width(NET_ARROW_SIZE);
        arrowActor.set_height(NET_ARROW_SIZE);
        // Centered on the digits' own box, which puts it on their optical middle.
        arrowActor.set_y_align(Clutter.ActorAlign.CENTER);
        cell.signals.push({
            actor: arrowActor,
            id: arrowActor.connect("repaint", (area) => this._drawArrow(area, color, isUp))
        });
        rowActor.add_child(arrowActor);

        let unitActor = new St.Label({ style_class: CLASS_UNIT });
        unitActor.set_y_align(Clutter.ActorAlign.END);
        // The unit of a network number is 7 px, not the 8 px of a percentage
        // cell; the colour still comes from .kapszula-unit in the stylesheet.
        unitActor.set_style("font-size: " + NET_UNIT_FONT + "px;");
        unitActor.hide();
        rowActor.add_child(unitActor);

        cell.tabularActors.push(numActor);

        let row = {
            actor: rowActor,
            numActor: numActor,
            arrowActor: arrowActor,
            unitActor: unitActor,
            lastText: null,
            lastUnit: ""
        };

        this._applyText(row, "lastText", numActor, MISSING_TEXT);
        return row;
    },

    /* ------------------------------------------------------------------ */
    /* Cairo drawing                                                       */
    /* ------------------------------------------------------------------ */

    /*
     * The graph reads nothing but the pixel heights setValues() already worked
     * out, so a repaint is pure drawing. Twenty columns per direction, 2 px wide
     * on a 3 px pitch, growing away from the centre line.
     */
    _drawNetGraph: function(area, cell) {
        if (this._destroyed)
            return;

        let cr = area.get_context();
        try {
            let size = area.get_surface_size();
            let width = size[0];
            let height = size[1];
            if (!(width > 0) || !(height > 0))
                return;

            let centerY = height / 2;

            // Centre line first, so the bars sit on top of it.
            cr.setSourceRGBA(1, 1, 1, NET_AXIS_ALPHA);
            cr.rectangle(0, centerY - 0.5, width, 1);
            cr.fill();

            this._drawNetBars(cr, cell.upHeights, cell.colorUp, centerY, true);
            this._drawNetBars(cr, cell.downHeights, cell.colorDown, centerY, false);
        } catch (e) {
            global.logError("capsule-monitor: net graph repaint failed: " + e);
        } finally {
            // Without this the context leaks, and this runs every second.
            cr.$dispose();
        }
    },

    _drawNetBars: function(cr, heights, color, centerY, isUp) {
        if (!color)
            return;

        cr.setSourceRGBA(color[0], color[1], color[2], 1);
        for (let i = 0; i < NET_BAR_COUNT; i++) {
            let barHeight = heights[i];
            if (!(barHeight > 0))
                continue;
            let x = i * NET_BAR_PITCH;
            let y = isUp ? (centerY - 0.5 - barHeight) : (centerY + 0.5);
            this._roundedRect(cr, x, y, NET_BAR_WIDTH, barHeight, NET_BAR_RADIUS);
        }
        // One fill for all twenty columns of the direction.
        cr.fill();
    },

    /*
     * Rounded rectangle without new_sub_path: the initial moveTo opens the
     * subpath and every arc joins to the previous one with a straight edge.
     */
    _roundedRect: function(cr, x, y, width, height, radius) {
        let r = Math.min(radius, width / 2, height / 2);
        if (!(r > 0)) {
            cr.rectangle(x, y, width, height);
            return;
        }

        let half = Math.PI / 2;
        cr.moveTo(x + r, y);
        cr.arc(x + width - r, y + r, r, -half, 0);
        cr.arc(x + width - r, y + height - r, r, 0, half);
        cr.arc(x + r, y + height - r, r, half, Math.PI);
        cr.arc(x + r, y + r, r, Math.PI, Math.PI + half);
        cr.closePath();
    },

    /* A solid triangle in the series colour, 6 x 6 px, apex up or down. */
    _drawArrow: function(area, color, isUp) {
        if (this._destroyed)
            return;

        let cr = area.get_context();
        try {
            let size = area.get_surface_size();
            let width = size[0];
            let height = size[1];
            if (!(width > 0) || !(height > 0) || !color)
                return;

            cr.setSourceRGBA(color[0], color[1], color[2], 1);
            if (isUp) {
                cr.moveTo(width / 2, 0.5);
                cr.lineTo(width - 0.5, height - 1);
                cr.lineTo(0.5, height - 1);
            } else {
                cr.moveTo(width / 2, height - 0.5);
                cr.lineTo(width - 0.5, 1);
                cr.lineTo(0.5, 1);
            }
            cr.closePath();
            cr.fill();
        } catch (e) {
            global.logError("capsule-monitor: arrow repaint failed: " + e);
        } finally {
            cr.$dispose();
        }
    },

    /* ------------------------------------------------------------------ */
    /* Per cycle updates                                                   */
    /* ------------------------------------------------------------------ */

    _updateValueCell: function(cell, item) {
        let missing = !item || item.text === null || item.text === undefined || item.text === "";

        let text = MISSING_TEXT;
        let unit = "";
        let fillWidth = 0;
        let alert = false;

        if (!missing) {
            text = String(item.text);
            if (item.unit !== null && item.unit !== undefined)
                unit = String(item.unit);
            if (isFiniteNumber(item.ratio))
                fillWidth = Math.round(clamp(item.ratio, 0, 1) * cell.trackWidth);
            alert = (item.alert === true);
        }

        this._applyText(cell, "lastText", cell.valueActor, text);
        this._applyUnit(cell, "lastUnit", cell.unitActor, unit);

        if (fillWidth !== cell.lastFillWidth) {
            cell.lastFillWidth = fillWidth;
            cell.fillActor.set_width(fillWidth);
        }

        this._applyAlert(cell, alert);
    },

    /*
     * The network never alerts (SPEC 6.2). The two arrays are turned into pixel
     * heights here and compared against the last ones, so an unchanged graph
     * costs no repaint at all and a changed one costs exactly one.
     */
    _updateNetCell: function(cell, item) {
        let data = (item && typeof item === "object") ? item : null;

        let changed = false;
        if (this._readBars(data ? data.barsUp : null, cell.upHeights, cell.maxDeflect))
            changed = true;
        if (this._readBars(data ? data.barsDown : null, cell.downHeights, cell.maxDeflect))
            changed = true;
        if (changed && cell.graphActor)
            cell.graphActor.queue_repaint();

        this._applyNetRow(cell.up, data ? data.upText : null, data ? data.upUnit : null);
        this._applyNetRow(cell.down, data ? data.downText : null, data ? data.downUnit : null);
    },

    /*
     * Ratios in, pixel heights out. The newest sample is at the end of the array
     * (SPEC 7.1), so a short array is padded on the left and a long one is read
     * from its tail. Returns true if any column moved.
     */
    _readBars: function(values, target, maxDeflect) {
        let source = Array.isArray(values) ? values : null;
        let count = source ? source.length : 0;
        let changed = false;

        for (let i = 0; i < NET_BAR_COUNT; i++) {
            let index = count - NET_BAR_COUNT + i;
            let value = (source && index >= 0) ? source[index] : null;

            let height = 0;
            if (isFiniteNumber(value) && value > 0) {
                height = Math.round(clamp(value, 0, 1) * maxDeflect);
                // A live but quiet direction still leaves a one pixel tick, so
                // "no traffic" never looks like "no data".
                if (height < NET_BAR_MIN_HEIGHT)
                    height = NET_BAR_MIN_HEIGHT;
            }

            if (height !== target[i]) {
                target[i] = height;
                changed = true;
            }
        }

        return changed;
    },

    _applyNetRow: function(row, text, unit) {
        if (!row)
            return;

        let missing = (text === null || text === undefined || text === "");
        let shown = missing ? MISSING_TEXT : String(text);
        // With no number there is nothing for a unit to qualify.
        let shownUnit = (missing || unit === null || unit === undefined) ? "" : String(unit);

        this._applyText(row, "lastText", row.numActor, shown);
        this._applyUnit(row, "lastUnit", row.unitActor, shownUnit);
    },

    /* ------------------------------------------------------------------ */
    /* Text and style helpers                                              */
    /* ------------------------------------------------------------------ */

    _applyText: function(holder, key, actor, text) {
        if (!actor || holder[key] === text)
            return;
        holder[key] = text;
        this._setTabularText(actor, text);
    },

    /*
     * Showing and hiding is the only allowed layout change here: the unit is a
     * property of the element, not of its value, so in practice this fires once
     * during the first cycle and never again. It happens inside a hard sized
     * cell, so nothing outside the cell can move.
     */
    _applyUnit: function(holder, key, actor, unit) {
        if (!actor || holder[key] === unit)
            return;
        holder[key] = unit;

        if (unit === "") {
            actor.hide();
            return;
        }

        actor.set_text(unit);
        actor.show();
    },

    _setTabularText: function(actor, text) {
        if (this._useMarkup) {
            try {
                // Tabular figures, so the digits do not wobble inside the cell.
                actor.get_clutter_text().set_markup(
                    "<span font_features=\"tnum\">" + GLib.markup_escape_text(text, -1) + "</span>");
                return;
            } catch (e) {
                this._useMarkup = false;
                this._dropMarkup();
                try {
                    actor.get_clutter_text().set_use_markup(false);
                } catch (e2) {
                    // Nothing sensible left to do; plain text still renders.
                }
            }
        }

        actor.set_text(text);
    },

    /* Leave markup mode on every tabular label that is already built. */
    _dropMarkup: function() {
        for (let i = 0; i < this._cells.length; i++) {
            let actors = this._cells[i].tabularActors || [];
            for (let j = 0; j < actors.length; j++) {
                try {
                    actors[j].get_clutter_text().set_use_markup(false);
                } catch (e) {
                    // Nothing sensible left to do; plain text still renders.
                }
            }
        }
    },

    /*
     * Alert colouring. Classes are added next to the base class, never in place
     * of it, so the alert rules only override colour and the sizes stay put.
     */
    _applyAlert: function(cell, alert) {
        if (alert === cell.lastAlert)
            return;
        cell.lastAlert = alert;

        if (cell.labelActor) {
            if (alert)
                cell.labelActor.add_style_class_name(CLASS_LABEL_ALERT);
            else
                cell.labelActor.remove_style_class_name(CLASS_LABEL_ALERT);
        }

        if (cell.valueActor) {
            if (alert)
                cell.valueActor.add_style_class_name(CLASS_VALUE_ALERT);
            else
                cell.valueActor.remove_style_class_name(CLASS_VALUE_ALERT);
        }

        if (cell.unitActor) {
            if (alert)
                cell.unitActor.add_style_class_name(CLASS_UNIT_ALERT);
            else
                cell.unitActor.remove_style_class_name(CLASS_UNIT_ALERT);
        }

        if (cell.fillActor) {
            if (alert)
                cell.fillActor.add_style_class_name(CLASS_FILL_ALERT);
            else
                cell.fillActor.remove_style_class_name(CLASS_FILL_ALERT);
        }
    }
};
