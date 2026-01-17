/* eyeModes.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
'use strict';

const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;

// Pre-computed constants to avoid repeated calculations
const TWO_PI = 2 * Math.PI;

class EyeMode {
    constructor(mode) {
        this.mode = mode;
        // Reusable objects to avoid allocations during animation frames
        this._blinkParams = { x: 0, y: 0, w: 0, coverH: 0, yRad: 0 };
    }

    /**
     * Draws the eye on the panel
     * @param {St.DrawingArea} area The area on repaint
     * @param {Number} blink_rate The blink rate (0.0 - 1.0) which can be used for animations
     * @param {Object} options Drawing options
     */
    drawEye(area, blink_rate, options) {
        // Implemented by sub-classes
    }

    /** Compute top and lateral sizes based on orientation - inlined for performance */
    topAndLatSizes(area_width, area_height, is_vertical) {
        return is_vertical
            ? [area_width, area_height]
            : [area_height, area_width];
    }

    /** Clear drawing area - optimized to avoid save/restore */
    clearArea(cr, area_width, area_height) {
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.rectangle(0, 0, area_width, area_height);
        cr.fill();
        cr.setOperator(Cairo.Operator.OVER);
    }

    _appendVerticalCapsulePath(cr, x, y, w, h, yRad) {
        // "Capsule" = top half-ellipse + straight sides + bottom half-ellipse.
        // Used as an eyelid mask so the blink edge looks organic instead of a hard rectangle.
        const xr = w * 0.5;
        const yr = yRad > 0 ? Math.min(yRad, h * 0.5) : 0;

        // Degenerate case for very small heights: fall back to a rectangle.
        if (yr <= 0) {
            cr.rectangle(x, y, w, h);
            return;
        }

        const cx = x + xr;
        const topCy = y + yr;
        const bottomCy = y + h - yr;

        cr.moveTo(x, topCy);

        // Top arc - ellipse via matrix transform
        cr.save();
        cr.translate(cx, topCy);
        cr.scale(xr, yr);
        cr.arc(0, 0, 1, Math.PI, 0);
        cr.restore();

        cr.lineTo(x + w, bottomCy);

        // Bottom arc
        cr.save();
        cr.translate(cx, bottomCy);
        cr.scale(xr, yr);
        cr.arc(0, 0, 1, 0, Math.PI);
        cr.restore();

        cr.closePath();
    }

    /**
     * Upper-lid blink: clip to eye shape, then clear a top-down capsule mask.
     * Optimized to minimize state changes and reuse computed values.
     * @param {cairo.Context} cr
     * @param {number} blink_rate 0..1 (1 = fully closed)
     * @param {number} eye_rad
     * @param {number} line_width
     * @param {number} area_width
     * @param {number} area_height
     * @param {Function} appendEyePath - function(cr) that appends eye outline path
     */
    _applyUpperLidBlink(cr, blink_rate, eye_rad, line_width, area_width, area_height, appendEyePath) {
        if (blink_rate <= 0) return;

        // Clamp to [0,1] and apply smoothstep for natural animation
        const t0 = blink_rate > 1 ? 1 : (blink_rate < 0 ? 0 : blink_rate);
        // Smoothstep: t² * (3 - 2t) - keeps endpoints but eases mid-animation
        const t = t0 * t0 * (3 - 2 * t0);

        const pad = line_width * 2;
        const radPlusPad = eye_rad + pad;

        // Reuse params object to avoid allocation on each frame
        const p = this._blinkParams;
        p.x = -radPlusPad;
        p.y = -radPlusPad;
        p.w = 2 * radPlusPad;
        p.coverH = (2 * eye_rad * t) + pad;
        p.yRad = Math.min(eye_rad * 0.55, p.coverH * 0.5);

        // Save state and set up eye-local coordinates
        cr.save();
        cr.identityMatrix();
        cr.translate(area_width * 0.5, area_height * 0.5);

        // Clip to eye shape
        cr.newPath();
        appendEyePath(cr);
        cr.clip();

        // Clear the blink area
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.newPath();
        this._appendVerticalCapsulePath(cr, p.x, p.y, p.w, p.coverH, p.yRad);
        cr.fill();

        cr.restore();
    }

    _appendEyelidEyePath(cr, eye_rad, iris_rad, x_def, y_def, top_lid, bottom_lid) {
        // Shared eyelid-outline path for EyelidMode (used both for drawing and for blink clipping).
        // Pre-compute amplitudes and control points
        const top_amp = eye_rad * top_lid;
        const bottom_amp = eye_rad * bottom_lid;
        const x_minus_iris = x_def - iris_rad;
        const x_plus_iris = x_def + iris_rad;
        const y_plus_top = y_def + top_amp;
        const y_minus_bottom = y_def - bottom_amp;

        cr.moveTo(-eye_rad, 0);
        cr.curveTo(x_minus_iris, y_plus_top, x_plus_iris, y_plus_top, eye_rad, 0);
        cr.curveTo(x_plus_iris, y_minus_bottom, x_minus_iris, y_minus_bottom, -eye_rad, 0);
        cr.closePath();
    }
}

class EyelidMode extends EyeMode {
    drawEye(area, blink_rate, options) {
        const [area_width, area_height] = area.allocation.get_size();
        const half_width = area_width * 0.5;
        const half_height = area_height * 0.5;

        const mouse_x = options.mouse_x - options.area_x - half_width;
        const mouse_y = options.mouse_y - options.area_y - half_height;

        const mouse_ang = Math.atan2(mouse_y, mouse_x);
        const mouse_dist = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);

        // Pre-compute trig values used multiple times
        const cos_mouse_ang = Math.cos(mouse_ang);
        const sin_mouse_ang = Math.sin(mouse_ang);

        const [top_size, lat_size] = this.topAndLatSizes(area_width, area_height, options.is_vertical);
        const eye_rad = Math.min(top_size - options.padding, lat_size) * 0.5;

        const iris_rad = eye_rad * 0.5;
        const pupil_rad = iris_rad * 0.4;

        // Compute max radius with pre-computed cos value
        const cos4 = cos_mouse_ang * cos_mouse_ang;
        const max_rad = eye_rad * (cos4 * cos4 * 0.5 + 0.25);
        const mouse_rad = Math.min(mouse_dist, max_rad);

        const iris_arc = Math.asin(iris_rad / eye_rad);
        const iris_r = eye_rad * Math.cos(iris_arc);
        const eye_ang = Math.atan(mouse_rad / iris_r);

        // Pre-compute eye angle trig values used multiple times
        const sin_eye_ang = Math.sin(eye_ang);
        const cos_eye_ang = Math.cos(eye_ang);

        const cr = area.get_context();
        this.clearArea(cr, area_width, area_height);

        // -- Drawing the base of the eye
        Clutter.cairo_set_source_color(cr, options.base_color);

        cr.translate(half_width, half_height);
        cr.setLineWidth(options.line_width);

        const x_def = iris_rad * cos_mouse_ang * sin_eye_ang;
        const y_def = iris_rad * sin_mouse_ang * sin_eye_ang;

        const top_lid = 0.8;
        const bottom_lid = 0.6;

        // Draw and fill/stroke eye shape
        cr.newPath();
        this._appendEyelidEyePath(cr, eye_rad, iris_rad, x_def, y_def, top_lid, bottom_lid);
        options.lids_fill ? cr.fill() : cr.stroke();

        // Clip to eye shape for iris/pupil
        cr.newPath();
        this._appendEyelidEyePath(cr, eye_rad, iris_rad, x_def, y_def, top_lid, bottom_lid);
        cr.clip();

        // -- Drawing the iris of the eye
        cr.rotate(mouse_ang);

        Clutter.cairo_set_source_color(cr, options.iris_color);

        const iris_scale_x = iris_rad * cos_eye_ang;
        const iris_translate_x = iris_r * sin_eye_ang;

        cr.setLineWidth(options.line_width / iris_rad);
        cr.translate(iris_translate_x, 0);
        cr.scale(iris_scale_x, iris_rad);
        cr.arc(0, 0, 1.0, 0, TWO_PI);
        options.lids_fill ? cr.fill() : cr.stroke();

        // Reset transforms for pupil (more efficient than inverse operations)
        cr.identityMatrix();
        cr.translate(half_width, half_height);
        cr.rotate(mouse_ang);

        // -- Drawing the pupil of the eye
        Clutter.cairo_set_source_color(cr, options.pupil_color);

        const pupil_translate_x = eye_rad * sin_eye_ang;
        const pupil_scale_x = pupil_rad * cos_eye_ang;

        cr.translate(pupil_translate_x, 0);
        cr.scale(pupil_scale_x, pupil_rad);
        cr.arc(0, 0, 1.0, 0, TWO_PI);
        cr.fill();

        // -- Blink overlay (uses eye-local coords internally)
        this._applyUpperLidBlink(cr, blink_rate, eye_rad, options.line_width, area_width, area_height,
            (ctx) => this._appendEyelidEyePath(ctx, eye_rad, iris_rad, x_def, y_def, top_lid, bottom_lid)
        );
    }
}

class BulbMode extends EyeMode {
    drawEye(area, blink_rate, options) {
        const [area_width, area_height] = area.allocation.get_size();
        const half_width = area_width * 0.5;
        const half_height = area_height * 0.5;

        const mouse_x = options.mouse_x - options.area_x - half_width;
        const mouse_y = options.mouse_y - options.area_y - half_height;

        const mouse_dist = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);
        const mouse_ang = Math.atan2(mouse_y, mouse_x);

        const [top_size, lat_size] = this.topAndLatSizes(area_width, area_height, options.is_vertical);
        const eye_rad = Math.min(top_size - options.padding, lat_size) * 0.5;

        const iris_rad = eye_rad * 0.6;
        const pupil_rad = iris_rad * 0.4;

        // Pre-compute iris arc values (used for max_rad calculation)
        const iris_arc = Math.asin(iris_rad / eye_rad);
        const iris_r = eye_rad * Math.cos(iris_arc);

        const max_rad = iris_r - options.line_width;
        const mouse_rad = Math.min(mouse_dist, max_rad);

        const eye_ang = Math.atan(mouse_rad / iris_r);

        // Pre-compute eye angle trig values used multiple times
        const sin_eye_ang = Math.sin(eye_ang);
        const cos_eye_ang = Math.cos(eye_ang);

        const cr = area.get_context();
        this.clearArea(cr, area_width, area_height);

        // -- Drawing the base of the eye
        Clutter.cairo_set_source_color(cr, options.base_color);

        cr.translate(half_width, half_height);
        cr.setLineWidth(options.line_width);
        cr.arc(0, 0, eye_rad, 0, TWO_PI);
        options.bulb_fill ? cr.fill() : cr.stroke();

        // -- Drawing the iris of the eye
        cr.rotate(mouse_ang);

        Clutter.cairo_set_source_color(cr, options.iris_color);

        const iris_scale_x = iris_rad * cos_eye_ang;
        const iris_translate_x = iris_r * sin_eye_ang;

        cr.setLineWidth(options.line_width / iris_rad);
        cr.translate(iris_translate_x, 0);
        cr.scale(iris_scale_x, iris_rad);
        cr.arc(0, 0, 1.0, 0, TWO_PI);
        options.bulb_fill ? cr.fill() : cr.stroke();

        // Reset transforms for pupil (more efficient than inverse operations)
        cr.identityMatrix();
        cr.translate(half_width, half_height);
        cr.rotate(mouse_ang);

        // -- Drawing the pupil of the eye
        Clutter.cairo_set_source_color(cr, options.pupil_color);

        const pupil_translate_x = eye_rad * sin_eye_ang;
        const pupil_scale_x = pupil_rad * cos_eye_ang;

        cr.translate(pupil_translate_x, 0);
        cr.scale(pupil_scale_x, pupil_rad);
        cr.arc(0, 0, 1.0, 0, TWO_PI);
        cr.fill();

        // -- Blink overlay (uses eye-local coords internally)
        this._applyUpperLidBlink(cr, blink_rate, eye_rad, options.line_width, area_width, area_height,
            (ctx) => { ctx.arc(0, 0, eye_rad, 0, TWO_PI); }
        );
    }
}


class EyeModeFactory {
    /**
     * Returns an eye mode depending on the given name
     * @param {String} mode Eye mode name to create
     * @returns EyeMode subclass
     */
    static createEyeMode(mode) {
        switch (mode) {
            case "bulb":
                return new BulbMode(mode);

            case "lids":
            default:
                return new EyelidMode(mode);
        }
    }
}
