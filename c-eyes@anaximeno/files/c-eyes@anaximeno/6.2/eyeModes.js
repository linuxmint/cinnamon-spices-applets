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

class EyeMode {
    constructor(mode) {
        this.mode = mode;
    }

    /**
     * Draws the eye on the panel
     * @param {St.DrawingArea} area The area on repaint
     * @param {Number} blinkRate The blink rate (0.0 - 1.0) which can be used for animations
     * @param {Object} options Drawing options
     */
    drawEye(area, blinkRate, options) {
        // Implemented by sub-classes
    };

    topAndLatSizes(area_width, area_height, options) {
        let top_size, lat_size;

        if (options.is_vertical) {
            top_size = area_width;
            lat_size = area_height;
        } else {
            top_size = area_height;
            lat_size = area_width;
        }

        return [top_size, lat_size];
    }

    /** Add a transparent background to avoid blemishes from previous drawings. */
    clearArea(cr, area_width, area_height) {
        cr.save();
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.rectangle(0, 0, area_width, area_height);
        cr.fill();
        cr.restore();
    }

    _clamp01(v) {
        v = Number(v);
        return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    }

    _appendVerticalCapsulePath(cr, x, y, w, h, yRad) {
        // “Capsule” = top half-ellipse + straight sides + bottom half-ellipse.
        // Used as an eyelid mask so the blink edge looks organic instead of a hard rectangle.
        const xr = w / 2;
        const yr = Math.max(0, Math.min(Number(yRad) || 0, h / 2));

        // Degenerate case for very small heights: fall back to a rectangle.
        if (yr <= 0) {
            cr.rectangle(x, y, w, h);
            return;
        }

        cr.moveTo(x, y + yr);

        cr.save();
        cr.translate(x + xr, y + yr);
        cr.scale(xr, yr);
        cr.arc(0, 0, 1, Math.PI, 0);
        cr.restore();

        cr.lineTo(x + w, y + h - yr);

        cr.save();
        cr.translate(x + xr, y + h - yr);
        cr.scale(xr, yr);
        cr.arc(0, 0, 1, 0, Math.PI);
        cr.restore();

        cr.closePath();
    }

    /**
     * Upper-lid blink: clip to eye shape, then clear a top-down capsule mask.
     * @param {cairo.Context} cr
     * @param {number} blinkRate 0..1 (1 = fully closed)
     * @param {number} eye_rad
     * @param {object} options
     * @param {Function} appendEyePath - must append the eye outline path in the *current* coordinate space
     */
    _applyUpperLidBlink(cr, blinkRate, eye_rad, options, appendEyePath) {
        const t0 = this._clamp01(blinkRate);
        if (t0 <= 0) return;

        // Smoothstep keeps endpoints (0/1) but reduces “mechanical” motion around mid-blink.
        const t = t0 * t0 * (3 - 2 * t0);

        const lw = Math.max(0, Number(options?.line_width) || 0);
        const pad = lw * 2;

        const yTop = -eye_rad - pad;
        const coverH = (2 * eye_rad * t) + pad;

        const w = 2 * (eye_rad + pad);
        const x = -eye_rad - pad;
        const y = yTop;

        const yRad = Math.min(eye_rad * 0.55, coverH / 2);

        cr.save();
        cr.newPath();
        appendEyePath();
        cr.clip();

        cr.setOperator(Cairo.Operator.CLEAR);
        cr.newPath();
        this._appendVerticalCapsulePath(cr, x, y, w, coverH, yRad);
        cr.fill();

        cr.restore();
    }

    _withEyeLocalCoords(cr, area_width, area_height, fn) {
        // Blink masking must be computed in the same base “eye-local” coordinates,
        // regardless of later iris rotations/transforms.
        cr.save();
        cr.identityMatrix();
        cr.translate(area_width * 0.5, area_height * 0.5);
        fn();
        cr.restore();
    }

    _appendEyelidEyePath(cr, eye_rad, iris_rad, x_def, y_def, top_lid, bottom_lid) {
        // Shared eyelid-outline path for EyelidMode (used both for drawing and for blink clipping).
        let amp = eye_rad * top_lid;
        cr.moveTo(-eye_rad, 0);
        cr.curveTo(
            x_def - iris_rad, y_def + amp,
            x_def + iris_rad, y_def + amp,
            eye_rad, 0
        );

        amp = eye_rad * bottom_lid;
        cr.curveTo(
            x_def + iris_rad, y_def - amp,
            x_def - iris_rad, y_def - amp,
            -eye_rad, 0
        );
        cr.closePath();
    }
}

class EyelidMode extends EyeMode {
    drawEye(area, blinkRate, options) {
        const [area_width, area_height] = area.allocation.get_size();
        const mouse_x = options.mouse_x - options.area_x - area_width / 2;
        const mouse_y = options.mouse_y - options.area_y - area_height / 2;

        const mouse_ang = Math.atan2(mouse_y, mouse_x);
        let mouse_rad = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);

        const [top_size, lat_size] = this.topAndLatSizes(area_width, area_height, options);
        let eye_rad = Math.min(top_size - options.padding, lat_size) / 2;

        const iris_rad = eye_rad * 0.5;
        const pupil_rad = iris_rad * 0.4;

        const max_rad = eye_rad * (Math.pow(Math.cos(mouse_ang), 4) * 0.5 + 0.25);

        mouse_rad = Math.min(mouse_rad, max_rad);

        const iris_arc = Math.asin(iris_rad / eye_rad);
        const iris_r = eye_rad * Math.cos(iris_arc);

        const eye_ang = Math.atan(mouse_rad / iris_r);

        let cr = area.get_context();
        this.clearArea(cr, area_width, area_height);

        cr.save();

        // -- Drawing the base of the eye

        Clutter.cairo_set_source_color(cr, options.base_color);

        cr.translate(area_width * 0.5, area_height * 0.5);
        cr.setLineWidth(options.line_width);

        const x_def = iris_rad * Math.cos(mouse_ang) * (Math.sin(eye_ang));
        const y_def = iris_rad * Math.sin(mouse_ang) * (Math.sin(eye_ang));

        const top_lid = 0.8;
        const bottom_lid = 0.6;

        const appendEyePath = () => {
            this._appendEyelidEyePath(cr, eye_rad, iris_rad, x_def, y_def, top_lid, bottom_lid);
        };

        cr.newPath();
        appendEyePath();
        options.lids_fill ? cr.fill() : cr.stroke();

        cr.newPath();
        appendEyePath();
        cr.clip();

        // -- Drawing the iris of the eye

        cr.rotate(mouse_ang);
        cr.setLineWidth(options.line_width / iris_rad);

        Clutter.cairo_set_source_color(cr, options.iris_color);

        cr.translate(iris_r * Math.sin(eye_ang), 0);
        cr.scale(iris_rad * Math.cos(eye_ang), iris_rad);
        cr.arc(0, 0, 1.0, 0, 2 * Math.PI);

        options.lids_fill ? cr.fill() : cr.stroke();

        cr.scale(1 / (iris_rad * Math.cos(eye_ang)), 1 / iris_rad);
        cr.translate(-iris_r * Math.sin(eye_ang), 0);

        // -- Drawing the pupil of the eye

        Clutter.cairo_set_source_color(cr, options.pupil_color);

        cr.translate(eye_rad * Math.sin(eye_ang), 0);
        cr.scale(pupil_rad * Math.cos(eye_ang), pupil_rad);
        cr.arc(0, 0, 1.0, 0, 2 * Math.PI);
        cr.fill();

        // -- Blink overlay
        this._withEyeLocalCoords(cr, area_width, area_height, () => {
            this._applyUpperLidBlink(cr, blinkRate, eye_rad, options, () => {
                cr.newPath();
                this._appendEyelidEyePath(cr, eye_rad, iris_rad, x_def, y_def, top_lid, bottom_lid);
            });
        });

        cr.restore();
    }
}

class BulbMode extends EyeMode {
    drawEye(area, blinkRate, options) {
        const [area_width, area_height] = area.allocation.get_size();
        const mouse_x = options.mouse_x - options.area_x - area_width / 2;
        const mouse_y = options.mouse_y - options.area_y - area_height / 2;

        let mouse_rad = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);
        const mouse_ang = Math.atan2(mouse_y, mouse_x);

        const [top_size, lat_size] = this.topAndLatSizes(area_width, area_height, options);
        let eye_rad = Math.min(top_size - options.padding, lat_size) / 2;

        const iris_rad = eye_rad * 0.6;
        const pupil_rad = iris_rad * 0.4;

        const max_rad = eye_rad * Math.cos(Math.asin((iris_rad) / eye_rad)) - options.line_width;

        mouse_rad = Math.min(mouse_rad, max_rad);

        const iris_arc = Math.asin(iris_rad / eye_rad);
        const iris_r = eye_rad * Math.cos(iris_arc);

        const eye_ang = Math.atan(mouse_rad / iris_r);

        let cr = area.get_context();
        this.clearArea(cr, area_width, area_height);

        cr.save();

        // -- Drawing the base of the eye

        Clutter.cairo_set_source_color(cr, options.base_color);

        cr.translate(area_width * 0.5, area_height * 0.5);
        cr.setLineWidth(options.line_width);
        cr.arc(0, 0, eye_rad, 0, 2 * Math.PI);

        options.bulb_fill ? cr.fill() : cr.stroke();

        // -- Drawing the iris of the eye

        cr.rotate(mouse_ang);
        cr.setLineWidth(options.line_width / iris_rad);

        Clutter.cairo_set_source_color(cr, options.iris_color);

        cr.translate(iris_r * Math.sin(eye_ang), 0);
        cr.scale(iris_rad * Math.cos(eye_ang), iris_rad);
        cr.arc(0, 0, 1.0, 0, 2 * Math.PI);

        options.bulb_fill ? cr.fill() : cr.stroke();

        cr.scale(1 / (iris_rad * Math.cos(eye_ang)), 1 / iris_rad);
        cr.translate(-iris_r * Math.sin(eye_ang), 0);

        // -- Drawing the pupil of the eye

        Clutter.cairo_set_source_color(cr, options.pupil_color);

        cr.translate(eye_rad * Math.sin(eye_ang), 0);
        cr.scale(pupil_rad * Math.cos(eye_ang), pupil_rad);
        cr.arc(0, 0, 1.0, 0, 2 * Math.PI);
        cr.fill();

        // -- Blink overlay
        this._withEyeLocalCoords(cr, area_width, area_height, () => {
            this._applyUpperLidBlink(cr, blinkRate, eye_rad, options, () => {
                cr.newPath();
                cr.arc(0, 0, eye_rad, 0, 2 * Math.PI);
            });
        });

        cr.restore();
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
