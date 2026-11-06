// Cinnamon's native slider supplies pointer grabbing and cancellation hooks;
// this subclass adds vertical drawing and a strict percentage grid.
const PopupMenu = imports.ui.popupMenu;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const Cairo = imports.cairo;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const { _, formatPercent } = require("./i18n");

const ACTIVE_SCALE_OPACITY = 0.50;

function switchPointColor(earlier, theme) {
    let background = null;
    for (let node = theme; node; node = node.get_parent()) {
        const color = node.get_background_color();
        if (color.alpha >= 128) {
            background = color;
            break;
        }
    }
    const color = background || theme.get_foreground_color();
    const brightness = (0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue) / 255;
    const dark = background ? brightness < 0.5 : brightness > 0.5;
    // Fixed meanings; only the tone follows the background. Keep these
    // four colours in sync with switch_point_color() in settings_widgets.py.
    return (dark ? (earlier ? [109, 180, 66] : [224, 116, 107]) :
        (earlier ? [46, 125, 61] : [182, 67, 59])).map(channel => channel / 255);
}

class ScaleSlider extends PopupMenu.PopupSliderMenuItem {
    _init(value, step, customValues = [], openingReleaseBoundary = null) {
        super._init(value);
        this._openingReleaseBoundary = openingReleaseBoundary;
        this.actor.set_style("min-width: 0; padding: 0.4em 0.65em; spacing: 0;");
        this._stepSize = [5, 10, 25].includes(Number(step)) ? Number(step) : 5;
        this._custom = step === 0 || step === "0";
        this._customStops = this._custom ? [...new Set(customValues.slice(0, 3).map(raw => {
            const match = String(raw).match(/^(1\d{2})$/);
            return match ? Number(match[1]) : NaN;
        }).filter(percent => Number.isInteger(percent) && percent > 100 && percent < 200))].sort((a, b) => a - b) : [];
        this._stops = this._custom ? [100, ...this._customStops, 200] :
            Array.from({ length: 100 / this._stepSize + 1 }, (_, index) => 100 + index * this._stepSize);
        this._grabDevice = null;
        this._shadeEnabled = false;
        this._shadeSteps = [];
        this._shadeSwitchPoint = 100;
        this._scaleBothSides = false;
        this._menuSwitchEnabled = false;
        this._bandFraction = 0.5;
        this._bandDrag = null;
        this._bandAnimationId = 0;
        this._bandAnimationSerial = 0;
        this._bandDestroyed = false;
        this._feedbackSensitive = true;
        this.actor.accessible_name = _("Scaling from 100 to 200 percent");
        this.removeActor(this._slider);
        this._content = new Cinnamon.GenericContainer();
        // A separate, passive surface keeps the shading behind the right-hand
        // captions and entirely outside the reactive slider column.
        this._stageShading = new St.DrawingArea({ reactive: false, visible: false });
        this._shadingTooltip = new Tooltips.Tooltip(this._stageShading,
            _("Press on the band and drag it. Five positions range from half a step earlier to half a step later, with the regular switch point in the middle. The band moves one quarter of the pointer distance. Release to apply; Escape cancels."));
        this._shadingTooltip.preventShow = true;
        // A device grab bypasses the stage's menu filter. Handle its pointer
        // events on this actor, just as Cinnamon's native slider does.
        this._signals.connect(this._stageShading, "motion-event", (actor, event) =>
            this.handleSwitchMotion(event));
        this._signals.connect(this._stageShading, "button-release-event", (actor, event) =>
            this.handleSwitchRelease(event));
        for (const signal of ["button-press-event", "scroll-event"])
            this._signals.connect(this._stageShading, signal, () =>
                this.switchDragging ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE);
        this._signals.connect(this._stageShading, "key-press-event", (actor, event) => {
            const key = event.get_key_symbol();
            if (![Clutter.KEY_space, Clutter.KEY_Return, Clutter.KEY_KP_Enter].includes(key))
                return Clutter.EVENT_PROPAGATE;
            if (this._menuSwitchEnabled && this._feedbackSensitive &&
                !this._bandDrag && !this._bandAnimationId)
                this.emit("switch-point-toggled");
            return Clutter.EVENT_STOP;
        });
        this._valueLabel = new St.Label({ text: "100%" });
        this._valueLabel.set_style("min-width: 3.6em; font-weight: bold; text-align: right;");
        this._maxLabel = new St.Label({ text: "200%" });
        this._minLabel = new St.Label({ text: "100%" });
        this._minLabel.set_style("font-weight: bold;");
        this._customLabels = this._customStops.map(percent => {
            const label = new St.Label({ text: percent + "%" });
            label.set_style("font-weight: normal;");
            return label;
        });
        this._labelsByPercent = new Map(this._customStops.map((percent, index) => [percent, this._customLabels[index]]));
        // Horizontal slider themes (including Mint-Y) impose min-width: 15em.
        // Remove that minimum and their asymmetric horizontal borders before
        // measuring this vertical DrawingArea. Its surface matches its box.
        this._slider.set_style("width: 2.5em; min-width: 0; height: 13em; min-height: 13em; border: 0; padding: 0;");
        this._content.set_style("spacing: 0.35em;");
        for (const child of [this._stageShading, this._valueLabel, this._slider, this._maxLabel, this._minLabel, ...this._customLabels])
            this._content.add_child(child);
        this._signals.connect(this._stageShading, "repaint", area => this._drawStageShading(area));
        this._signals.connect(this._slider, "style-changed", () => {
            this._syncValueColor();
            if (this._shadeEnabled)
                this._stageShading.queue_repaint();
        });
        this._signals.connect(this._content, "get-preferred-width", (actor, forHeight, alloc) => {
            alloc.min_size = alloc.natural_size = this._measure().width;
        });
        this._signals.connect(this._content, "get-preferred-height", (actor, forWidth, alloc) => {
            const m = this._measure();
            alloc.min_size = alloc.natural_size = m.trackHeight + 2 * m.padding;
        });
        this._signals.connect(this._content, "allocate", (actor, box, flags) => this._allocateContent(box, flags));
        this.addActor(this._content, { span: -1, expand: true });
    }

    _measure() {
        const left = this._valueLabel.get_preferred_width(-1)[1];
        const radius = this._slider.get_theme_node().get_length("-slider-handle-radius");
        const naturalTrackWidth = Math.max(this._slider.get_preferred_width(-1)[1], 2 * (radius + 8 * global.ui_scale));
        const trackHeight = this._slider.get_preferred_height(naturalTrackWidth)[1];
        const valueHeight = this._valueLabel.get_preferred_height(left)[1];
        const minHeight = this._minLabel.get_preferred_height(-1)[1];
        const maxHeight = this._maxLabel.get_preferred_height(-1)[1];
        const padding = Math.max(0, Math.max(valueHeight, minHeight, maxHeight) / 2 - radius);
        const gap = this._content.get_theme_node().get_length("spacing");
        const markHeight = this._customLabels.length ? this._customLabels[0].get_preferred_height(-1)[1] : 0;
        const groups = this._groupLabels(trackHeight, radius, minHeight, maxHeight, markHeight, gap);
        const right = Math.max(this._minLabel.get_preferred_width(-1)[1], this._maxLabel.get_preferred_width(-1)[1],
            ...this._customLabels.map(label => label.get_preferred_width(-1)[1]));
        // Symmetric columns keep the actual track on the menu's centerline,
        // regardless of the different label widths on either side.
        const side = Math.max(left, right);
        // Three equal columns: labels fit in the outer columns; only the
        // central column is reactive. The painted line and handle stay narrow.
        const trackWidth = Math.max(naturalTrackWidth, side + gap);
        return { left, right, trackWidth, trackHeight, valueHeight, minHeight, maxHeight,
            radius, padding, gap, side, groups, markHeight, width: 3 * trackWidth };
    }

    _groupY(percent, height, radius, minHeight, maxHeight, labelHeight, gap) {
        const low = radius + (maxHeight + labelHeight) / 2 + gap;
        const high = height - radius - (minHeight + labelHeight) / 2 - gap;
        const desired = radius + (200 - percent) / 100 * (height - 2 * radius);
        return low > high ? height / 2 : Math.max(low, Math.min(high, desired));
    }

    _groupLabels(height, radius, minHeight, maxHeight, labelHeight, gap) {
        const groups = [...this._customStops].reverse().map(percent => ({ values: [percent], percent, height: labelHeight }));
        const y = group => this._groupY(group.percent, height, radius, minHeight, maxHeight, group.height, gap);
        // Nearby values form a vertical stack centered on their tick span.
        // The endpoint clearance stays unchanged; only the stack is moved
        // inward if its full height would collide with 100% or 200%.
        for (let index = 1; index < groups.length;) {
            if (y(groups[index]) - y(groups[index - 1]) < (groups[index].height + groups[index - 1].height) / 2 + gap) {
                const previous = groups[index - 1];
                previous.values.push(...groups[index].values);
                previous.percent = (Math.max(...previous.values) + Math.min(...previous.values)) / 2;
                previous.height = previous.values.length * labelHeight + (previous.values.length - 1) * gap;
                groups.splice(index, 1);
                index = 1;
            } else {
                index++;
            }
        }
        return groups;
    }

    _allocateContent(box, flags) {
        const m = this._measure();
        const trackWidth = (box.x2 - box.x1) / 3;
        const trackX = box.x1 + trackWidth;
        const left = Math.max(box.x1, trackX - m.gap - m.side);
        const top = box.y1 + m.padding;
        const height = Math.max(2 * m.radius, box.y2 - box.y1 - 2 * m.padding);
        const upper = top + m.radius;
        const lower = top + height - m.radius;
        const handleY = upper + (1 - this.value) * (lower - upper);
        const rightX = trackX + trackWidth + m.gap;
        const allocate = (child, x, y, width, childHeight) => {
            const childBox = new Clutter.ActorBox();
            Object.assign(childBox, { x1: x, y1: y, x2: x + width, y2: y + childHeight });
            child.allocate(childBox, flags);
        };
        allocate(this._slider, trackX, top, trackWidth, height);
        const shadePadding = Math.min(2 * Math.max(1, global.ui_scale), m.gap / 2);
        const captionWidth = Math.max(this._minLabel.get_preferred_width(-1)[1],
            this._maxLabel.get_preferred_width(-1)[1]);
        allocate(this._stageShading, rightX - shadePadding, upper,
            captionWidth + 2 * shadePadding, lower - upper);
        // Do not round these centers independently: the value must stay at
        // precisely the same height as the drawn handle, including endpoints.
        allocate(this._valueLabel, left, handleY - m.valueHeight / 2, m.side, m.valueHeight);
        allocate(this._maxLabel, rightX, upper - m.maxHeight / 2, m.side, m.maxHeight);
        allocate(this._minLabel, rightX, lower - m.minHeight / 2, m.side, m.minHeight);
        m.groups.forEach(group => {
            const center = top + this._groupY(group.percent, height, m.radius, m.minHeight, m.maxHeight, group.height, m.gap);
            const firstY = center - group.height / 2;
            group.values.forEach((percent, index) => {
                allocate(this._labelsByPercent.get(percent), rightX, firstY + index * (m.markHeight + m.gap), m.side, m.markHeight);
            });
        });
    }

    _syncValueColor(theme = null) {
        const color = (theme || this._slider.get_theme_node()).get_color("-slider-active-background-color");
        if (![color.red, color.green, color.blue, color.alpha].every(Number.isFinite))
            return;
        const css = "rgba(" + [color.red, color.green, color.blue, color.alpha / 255].join(",") + ")";
        if (css === this._valueColor)
            return;
        this._valueColor = css;
        this._valueLabel.set_style("min-width: 3.6em; font-weight: bold; text-align: right; color: " + css + ";");
    }

    setValue(value) {
        super.setValue(value);
        if (this._content)
            this._content.queue_relayout();
    }

    setPercentDisplay(percent) {
        this._valueLabel.set_text(formatPercent(percent));
        this.actor.accessible_name = _("Scaling: %s").replace("%s", this._valueLabel.text);
        this._content.queue_relayout();
    }

    setFeedbackSensitive(sensitive) {
        if (!sensitive)
            this.cancelSwitchDrag();
        this._feedbackSensitive = sensitive;
        this._content.opacity = sensitive ? 255 : 128;
        this._syncShadingInput();
    }

    setScaleBothSides(enabled) {
        const active = enabled === true;
        if (active === this._scaleBothSides)
            return;
        this._scaleBothSides = active;
        this._slider.queue_repaint();
    }

    setScreenShading(enabled, steps, switchPoint, menuSwitch = false, showTooltips = true) {
        const offered = Array.isArray(steps) ? [...new Set(steps.filter(value =>
            Number.isFinite(value) && value >= 100 && value <= 200))].sort((a, b) => a - b) : [];
        const point = Number.isFinite(switchPoint) ?
            Math.max(50, Math.min(150, Math.round(switchPoint / 25) * 25)) : 100;
        const active = enabled === true && offered[0] === 100;
        const switchEnabled = active && menuSwitch === true && offered.length > 1;
        this._shadingTooltip.preventShow = !switchEnabled || !showTooltips;
        if (this._shadingTooltip.preventShow)
            this._shadingTooltip.hide();
        if (active === this._shadeEnabled && point === this._shadeSwitchPoint &&
            switchEnabled === this._menuSwitchEnabled &&
            offered.join(",") === this._shadeSteps.join(","))
            return;
        const geometryChanged = active !== this._shadeEnabled || point !== this._shadeSwitchPoint ||
            switchEnabled !== this._menuSwitchEnabled || offered.join(",") !== this._shadeSteps.join(",");
        if (geometryChanged)
            this.cancelSwitchDrag();
        this._shadeEnabled = active;
        this._shadeSteps = offered;
        this._shadeSwitchPoint = point;
        this._menuSwitchEnabled = switchEnabled;
        if (geometryChanged)
            this._bandFraction = (150 - point) / 100;
        this._stageShading.visible = active;
        this._syncShadingInput();
        this._stageShading.queue_repaint();
        this._slider.queue_repaint();
    }

    _syncShadingInput() {
        const interactive = this._menuSwitchEnabled && this._feedbackSensitive;
        this._stageShading.reactive = interactive;
        this._stageShading.can_focus = interactive;
        const position =
            ({ 50: _("Half a step earlier"), 75: _("A quarter step earlier"), 100: _("Regular"),
                125: _("A quarter step later"), 150: _("Half a step later") }[this._shadeSwitchPoint]);
        this._stageShading.accessible_name = _("Switch point: %s. Drag the band up or down. Space or Enter selects the next position.")
            .replace("%s", position);
    }

    focusSwitchPoint() {
        if (this._menuSwitchEnabled && this._feedbackSensitive)
            this._stageShading.grab_key_focus();
    }

    containsSwitchBandPoint(absX, absY) {
        if (!this._menuSwitchEnabled || !this._feedbackSensitive)
            return false;
        const [x, y] = this._stageShading.get_transformed_position();
        const [screenWidth, screenHeight] = this._stageShading.get_transformed_size();
        if (screenWidth <= 0 || screenHeight <= 0 ||
            absX < x || absX >= x + screenWidth || absY < y || absY >= y + screenHeight)
            return false;
        return true;
    }

    get switchDragging() {
        return this._bandDrag !== null;
    }

    get switchAnimating() {
        return this._bandAnimationId !== 0;
    }

    _stopBandAnimation() {
        ++this._bandAnimationSerial;
        if (this._bandAnimationId) {
            Mainloop.source_remove(this._bandAnimationId);
            this._bandAnimationId = 0;
        }
    }

    _setBandFraction(fraction) {
        const value = Math.max(0, Math.min(1, fraction));
        if (value !== this._bandFraction && !this._bandDestroyed) {
            this._bandFraction = value;
            this._stageShading.queue_repaint();
            this._slider.queue_repaint();
        }
    }

    beginSwitchDrag(absX, absY, device) {
        if (this._bandDrag || !device || !this.containsSwitchBandPoint(absX, absY))
            return false;
        this._stopBandAnimation();
        const [, top] = this._stageShading.get_transformed_position();
        const [, height] = this._stageShading.get_transformed_size();
        const percent = 200 - (absY - top) / height * 100;
        let index = this._shadeSteps.findIndex((upper, i) => i > 0 && percent <= upper);
        if (index < 1)
            index = this._shadeSteps.length - 1;
        const gap = this._shadeSteps[index] - this._shadeSteps[index - 1];
        this._bandDrag = { device, startY: absY, fraction: this._bandFraction,
            point: this._shadeSwitchPoint, travel: 4 * Math.max(1, height * gap / 100) };
        device.grab(this._stageShading);
        this.focusSwitchPoint();
        this._shadingTooltip.hide();
        return true;
    }

    updateSwitchDrag(absX, absY, device) {
        const drag = this._bandDrag;
        if (!drag || drag.device !== device)
            return false;
        // Keep the grab when the pointer leaves the band. Horizontal motion
        // does not affect the switch; returning along the same path undoes it.
        this._setBandFraction(drag.fraction + (absY - drag.startY) / drag.travel);
        return true;
    }

    handleSwitchMotion(event) {
        if (!this._bandDrag)
            return Clutter.EVENT_PROPAGATE;
        if (!(event.get_state() & Clutter.ModifierType.BUTTON1_MASK))
            this.cancelSwitchDrag(event.get_device());
        else
            this.updateSwitchDrag(...event.get_coords(), event.get_device());
        return Clutter.EVENT_STOP;
    }

    handleSwitchRelease(event) {
        if (!this._bandDrag)
            return Clutter.EVENT_PROPAGATE;
        if (event.get_button() === 1)
            this.endSwitchDrag(...event.get_coords(), event.get_device());
        return Clutter.EVENT_STOP;
    }

    _animateBandTo(fraction, complete) {
        this._stopBandAnimation();
        const from = this._bandFraction;
        if (Math.abs(from - fraction) < 0.001) {
            this._setBandFraction(fraction);
            complete();
            return;
        }
        const started = GLib.get_monotonic_time();
        const serial = this._bandAnimationSerial;
        this._bandAnimationId = Mainloop.timeout_add(16, () => {
            if (this._bandDestroyed || serial !== this._bandAnimationSerial)
                return false;
            const progress = Math.min(1, (GLib.get_monotonic_time() - started) / 120000);
            this._setBandFraction(from + (fraction - from) * (1 - Math.pow(1 - progress, 3)));
            if (progress < 1)
                return true;
            this._bandAnimationId = 0;
            complete();
            return false;
        });
    }

    endSwitchDrag(absX, absY, device) {
        const drag = this._bandDrag;
        if (!drag || drag.device !== device)
            return false;
        this.updateSwitchDrag(absX, absY, device);
        this._bandDrag = null;
        drag.device.ungrab();
        this.emit("switch-drag-ended");
        const value = 150 - 100 * this._bandFraction;
        // Nearest of all five stops. An exact tie retains the starting stop
        // when possible; otherwise it favours the middle.
        const selected = [100, 75, 125, 50, 150].reduce((best, point) =>
            Math.abs(point - value) < Math.abs(best - value) - 0.000001 ? point : best, drag.point);
        this._animateBandTo((150 - selected) / 100, () => {
            if (!this._bandDestroyed && this._menuSwitchEnabled && this._feedbackSensitive &&
                this._shadeSwitchPoint === drag.point && selected !== drag.point)
                this.emit("switch-point-selected", selected);
        });
        return true;
    }

    cancelSwitchDrag(device = null) {
        if (device && this._bandDrag && device !== this._bandDrag.device)
            return;
        this._stopBandAnimation();
        const drag = this._bandDrag;
        this._bandDrag = null;
        if (drag) {
            drag.device.ungrab();
            this.emit("switch-drag-ended");
        }
        this._setBandFraction((150 - this._shadeSwitchPoint) / 100);
    }

    _shadeBoundaries(switchPoint) {
        const boundaries = [100];
        for (let index = 1; index < this._shadeSteps.length; index++) {
            const lower = this._shadeSteps[index - 1], upper = this._shadeSteps[index];
            const boundary = lower + (upper - lower) * switchPoint / 100;
            // Prefix maxima mirror native selection if offered gaps differ.
            // Clipping also leaves the final stage empty when its delayed
            // threshold lies beyond the selectable 200-percent endpoint.
            boundaries.push(Math.max(boundaries[index - 1], Math.min(200, boundary)));
        }
        boundaries.push(200);
        return boundaries;
    }

    _shadeRectangles(width, height, switchPoint) {
        const y = percent => Math.round((200 - percent) / 100 * height);
        const boundaries = this._shadeBoundaries(switchPoint);
        return this._shadeSteps.map((stage, index) => {
            const top = y(boundaries[index + 1]), bottom = y(boundaries[index]);
            return [0, top, width, bottom - top, index];
        });
    }

    _switchShadeClips(width, height, fraction) {
        const boundaries = this._shadeBoundaries(150 - 100 * fraction);
        const y = percent => Math.round((200 - percent) / 100 * height);
        return this._shadeSteps.slice(1).map((stage, index) => {
            // Highlight only the deviation from "on reaching", either above
            // or below it. The neutral middle position has no active patch.
            const a = y(stage), b = y(boundaries[index + 1]);
            return [0, Math.min(a, b), width, Math.abs(a - b)];
        });
    }

    _drawStageShading(area) {
        const cr = area.get_context();
        try {
            const [width, height] = area.get_surface_size();
            if (!this._shadeEnabled || width <= 0 || height <= 0)
                return;
            const theme = this._slider.get_theme_node();
            const color = theme.get_foreground_color();
            // Replace full rows so both tones remain unchanged while their
            // boundary moves, aligned with the scale's active-colour patches.
            cr.setOperator(Cairo.Operator.SOURCE);
            const point = this._menuSwitchEnabled ? 150 - 100 * this._bandFraction :
                this._shadeSwitchPoint;
            cr.setAntialias(Cairo.Antialias.NONE);
            for (const [x, y, w, h, index] of this._shadeRectangles(width, height, point)) {
                cr.setSourceRGBA(color.red / 255, color.green / 255, color.blue / 255,
                    (index % 2 === 0 ? 0.045 : 0.12) * color.alpha / 255);
                cr.rectangle(x, y, w, h);
                cr.fill();
            }
        } finally {
            cr.$dispose();
        }
    }

    _sliderRepaint(area) {
        const cr = area.get_context();
        const theme = area.get_theme_node();
        this._syncValueColor(theme);
        const [cross, length] = area.get_surface_size();
        const radius = theme.get_length("-slider-handle-radius");
        const track = theme.get_length("-slider-height");
        const start = radius, end = Math.max(start, length - radius);
        const position = start + (end - start) * this.value;
        const center = cross / 2;
        if (this._menuSwitchEnabled && this._bandFraction !== 0.5) {
            const color = switchPointColor(this._bandFraction > 0.5, theme);
            const width = 5 * global.ui_scale;
            const left = center + radius + 2 * global.ui_scale;
            cr.save();
            cr.setAntialias(Cairo.Antialias.NONE);
            cr.setSourceRGBA(...color, ACTIVE_SCALE_OPACITY);
            // Draw behind the right-hand ticks only. Use the same rows as
            // the moving band, aligned to the scale's actual end markers.
            for (const [, top, w, h] of this._switchShadeClips(width, end - start, this._bandFraction))
                cr.rectangle(left, start + top, w, h);
            cr.fill();
            cr.restore();
        }
        cr.translate(0, length);
        cr.rotate(-Math.PI / 2);
        Clutter.cairo_set_source_color(cr, theme.get_color("-slider-background-color"));
        cr.setLineWidth(track);
        cr.moveTo(start, center); cr.lineTo(end, center); cr.stroke();
        Clutter.cairo_set_source_color(cr, theme.get_color("-slider-active-background-color"));
        cr.moveTo(start, center); cr.lineTo(position, center); cr.stroke();
        Clutter.cairo_set_source_color(cr, theme.get_foreground_color());
        cr.setLineWidth(Math.max(1, global.ui_scale));
        for (const percent of this._stops) {
            const fraction = (percent - 100) / 100;
            const x = start + (end - start) * fraction;
            const offset = radius + 2 * global.ui_scale;
            const tick = (this._custom || percent % 25 === 0 ? 5 : 2) * global.ui_scale;
            cr.setLineWidth((percent === 100 ? 4 : 1) * Math.max(1, global.ui_scale));
            // The fixed 100% reference is a stronger, two-sided notch.
            // It remains distinct from the moving circular handle.
            cr.moveTo(x, percent === 100 ? center - offset - tick : center + offset);
            cr.lineTo(x, center + offset + tick); cr.stroke();
            if (this._scaleBothSides && percent !== 100) {
                cr.moveTo(x, center - offset);
                cr.lineTo(x, center - offset - tick); cr.stroke();
            }
        }
        cr.arc(position, center, radius, 0, Math.PI * 2);
        cr.fill();
        cr.$dispose();
    }

    containsPoint(absX, absY, allowVerticalExit = false) {
        const [x, y] = this._slider.get_transformed_position();
        const [width, height] = this._slider.get_transformed_size();
        let margin = 0;
        if (allowVerticalExit && this._openingReleaseBoundary) {
            const [, lineY] = this._openingReleaseBoundary.get_transformed_position();
            const [, lineHeight] = this._openingReleaseBoundary.get_transformed_size();
            // The separator is painted at the center of its DrawingArea.
            // Mirror its distance from the slider below the lower endpoint.
            margin = Math.max(0, y - (lineY + lineHeight / 2));
        }
        return absX >= x && absX < x + width && absY >= y - margin && absY < y + height + margin;
    }

    percentAtPoint(absX, absY, allowVerticalExit = false) {
        return this.containsPoint(absX, absY, allowVerticalExit) ? this._percentAtY(absY) : null;
    }

    previewAtPoint(absX, absY, allowVerticalExit = false) {
        if (this.containsPoint(absX, absY, allowVerticalExit))
            this._moveHandle(absX, absY);
    }

    _percentAtY(absY) {
        const [, y] = this._slider.get_transformed_position();
        const [, height] = this._slider.get_transformed_size();
        const scale = height / Math.max(1, this._slider.height);
        const radius = this._slider.get_theme_node().get_length("-slider-handle-radius") * scale;
        const coordinate = absY - y;
        const value = 1 - Math.max(0, Math.min(1, (coordinate - radius) / Math.max(1, height - 2 * radius)));
        const target = 100 + value * 100;
        return this._stops.reduce((best, candidate) =>
            Math.abs(candidate - target) <= Math.abs(best - target) + 0.000001 ? candidate : best);
    }

    _moveHandle(absX, absY) {
        const percent = this._percentAtY(absY);
        this.setValue((percent - 100) / 100);
        this.emit("value-changed", this.value);
    }

    _startDragging(actor, event) {
        if (event.get_button() !== 1 || !this.containsPoint(...event.get_coords()))
            return Clutter.EVENT_PROPAGATE;
        if (!this._dragging) {
            this._grabDevice = event.get_device();
            super._startDragging(actor, event);
        }
        return Clutter.EVENT_STOP;
    }

    _endDragging(actor, event) {
        if (event.get_button() !== 1 || (this._grabDevice && event.get_device() !== this._grabDevice))
            return Clutter.EVENT_PROPAGATE;
        if (!this._dragging)
            return Clutter.EVENT_PROPAGATE;
        const [x, y] = event.get_coords();
        if (!this.containsPoint(x, y)) {
            this.cancelDrag();
            this.emit("drag-released-outside", x, y);
            return Clutter.EVENT_STOP;
        }
        // Use the release coordinates even if no final motion was delivered.
        this._moveHandle(x, y);
        const result = super._endDragging(actor, event);
        this._grabDevice = null;
        return result;
    }

    _motionEvent(actor, event) {
        const [absX] = event.get_coords();
        const [x] = this._slider.get_transformed_position();
        const [width] = this._slider.get_transformed_size();
        if (this._dragging && event.get_device() === this._grabDevice && absX >= x && absX < x + width)
            super._motionEvent(actor, event);
        return Clutter.EVENT_STOP;
    }

    get dragging() {
        return this._dragging;
    }

    cancelDrag() {
        this.cancelSwitchDrag();
        if (!this._dragging)
            return;
        this._signals.disconnect("button-release-event", this._slider);
        this._signals.disconnect("motion-event", this._slider);
        if (this._grabDevice)
            this._grabDevice.ungrab();
        this._grabDevice = null;
        this._dragging = false;
        this.emit("drag-cancelled");
    }

    _step(count) {
        const current = 100 + this.value * 100;
        let index;
        if (count > 0) {
            index = this._stops.findIndex(percent => percent > current + 0.000001);
            if (index < 0)
                index = this._stops.length - 1;
            index = Math.min(this._stops.length - 1, index + count - 1);
        } else {
            index = this._stops.length - 1;
            while (index > 0 && this._stops[index] >= current - 0.000001)
                index--;
            index = Math.max(0, index + count + 1);
        }
        this.setValue((this._stops[index] - 100) / 100);
        this.emit("value-changed", this.value);
    }

    _onKeyPressEvent(actor, event) {
        if (this._dragging)
            return Clutter.EVENT_PROPAGATE;
        const key = event.get_key_symbol();
        if ([Clutter.KEY_Up, Clutter.KEY_Down, Clutter.KEY_Left, Clutter.KEY_Right].includes(key)) {
            const count = key === Clutter.KEY_Up || key === Clutter.KEY_Right ? 1 : -1;
            this._step(count);
        } else if (key === Clutter.KEY_Home || key === Clutter.KEY_End) {
            this.setValue(key === Clutter.KEY_Home ? 0 : 1);
            this.emit("value-changed", this.value);
        } else {
            return Clutter.EVENT_PROPAGATE;
        }
        return Clutter.EVENT_STOP;
    }

    _onScrollEvent(actor, event) {
        return Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        this._bandDestroyed = true;
        this.cancelDrag();
        super.destroy();
    }
}

module.exports = ScaleSlider;
