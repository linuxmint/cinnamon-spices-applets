/* modes/base.js
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

var TWO_PI = 2 * Math.PI;

/**
 * Base class of the eye modes, with the drawing helpers they share.
 */
var EyeMode = class EyeMode {
    constructor(mode) {
        this.mode = mode;
    }

    /**
     * Draws the eye on the panel
     * @param {St.DrawingArea} area The drawing area widget where the eye is rendered
     * @param {Number} blink_rate The blink rate (0.0 - 1.0) which can be used for animations, where 0 is open and 1 is fully closed
     * @param {Object} options Drawing options including colors, padding, line width, mouse position, etc.
     */
    drawEye(area, blink_rate, options) {
        // Implemented by sub-classes
    }

    /*
     * Optional lifecycle hooks, for modes that render more than what they draw
     * with Cairo (e.g. with a shader) or that animate continuously.
     */

    /**
     * Called when the mode becomes active, before it draws
     * @param {St.DrawingArea} area The drawing area widget where the eye is rendered
     */
    enable(area) {
    }

    /**
     * Called when the mode stops being active, it must undo what enable did
     */
    disable() {
    }

    /**
     * Applies mode specific options from the settings
     * @param {Object} options The options, by name
     */
    configure(options) {
    }

    /**
     * Whether the mode animates continuously, receiving onFrame calls
     * @returns {boolean}
     */
    get animated() {
        return false;
    }

    /**
     * Called on each animation frame, when the mode is animated
     * @param {number} delta_s Elapsed time since the previous frame, in seconds
     */
    onFrame(delta_s) {
    }

    /**
     * Called when the system becomes active again, after being idle
     */
    onWake() {
    }

    /**
     * The colors used when alternative colors are disabled, when the theme color doesn't fit the mode
     * @returns {Object|null} The base_color, iris_color and pupil_color as Clutter.Color
     */
    get default_palette() {
        return null;
    }

    /**
     * Clears the drawing area
     * @param {cairo.Context} cr The Cairo drawing context
     * @param {number} area_width The width of the area to clear
     * @param {number} area_height The height of the area to clear
     */
    clearArea(cr, area_width, area_height) {
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.rectangle(0, 0, area_width, area_height);
        cr.fill();
        cr.setOperator(Cairo.Operator.OVER);
    }

    /**
     * Applies blink effect
     * @param {cairo.Context} cr The Cairo drawing context
     * @param {number} blink_rate 0..1 (1 = fully closed), the rate at which the eye is blinking
     * @param {number} eye_rad The radius of the eye
     * @param {number} line_width The width of the lines used in drawing
     * @param {number} area_width The width of the drawing area
     * @param {number} area_height The height of the drawing area
     * @param {boolean} do_stroke Whether to stroke the blink layer (used when not filling)
     * @param {Clutter.Color} stroke_color The color to use for the stroke
     * @param {Function} appendEyePath A function that appends the eye outline path to the context
     * @param {boolean} use_lower_lid Whether the lower lid should also converge upwards (best for circular eyes)
     */
    _applyUpperLidBlink(cr, blink_rate, eye_rad, line_width, area_width, area_height, do_stroke, stroke_color, appendEyePath, use_lower_lid = false) {
        if (blink_rate <= 0) return;

        const t0 = blink_rate > 1 ? 1 : (blink_rate < 0 ? 0 : blink_rate);
        const t = t0 * t0 * (3 - 2 * t0);

        const radPlusPad = eye_rad + line_width * 2;

        cr.save();
        cr.identityMatrix();
        cr.translate(area_width * 0.5, area_height * 0.5);

        const cp_x = radPlusPad / 3.0; // For converting quadratic bezier to cubic bezier

        cr.newPath();
        appendEyePath(cr);
        cr.clip();

        cr.setOperator(Cairo.Operator.CLEAR);
        cr.newPath();

        if (use_lower_lid) {
            const meet_y = eye_rad * 0.25; // Eyelids meet slightly below the horizontal center
            const overlap = 0.5 * t;       // Slight overlap when closed to prevent gap seams

            // Upper lid edge positions: arcs downwards as it moves down
            const up_y_side = -radPlusPad * (1 - t) + (meet_y + overlap) * t;
            const up_y_center = (-radPlusPad - eye_rad * 0.4) * (1 - t) + (meet_y + overlap) * t;
            const up_y_control = 2 * up_y_center - up_y_side;

            // Lower lid edge positions: arcs upwards as it moves up
            const low_y_side = radPlusPad * (1 - t) + (meet_y - overlap) * t;
            const low_y_center = (radPlusPad + eye_rad * 0.2) * (1 - t) + (meet_y - overlap) * t;
            const low_y_control = 2 * low_y_center - low_y_side;

            const up_y_cp = up_y_side + (up_y_control - up_y_side) * 2 / 3;
            const low_y_cp = low_y_side + (low_y_control - low_y_side) * 2 / 3;

            // Upper lid mask
            cr.moveTo(-radPlusPad, -radPlusPad);
            cr.lineTo(radPlusPad, -radPlusPad);
            cr.lineTo(radPlusPad, up_y_side);
            cr.curveTo(cp_x, up_y_cp, -cp_x, up_y_cp, -radPlusPad, up_y_side);
            cr.closePath();

            // Lower lid mask
            cr.moveTo(-radPlusPad, radPlusPad);
            cr.lineTo(radPlusPad, radPlusPad);
            cr.lineTo(radPlusPad, low_y_side);
            cr.curveTo(cp_x, low_y_cp, -cp_x, low_y_cp, -radPlusPad, low_y_side);
            cr.closePath();

            cr.fill();

            if (do_stroke) {
                cr.setOperator(Cairo.Operator.OVER);
                Clutter.cairo_set_source_color(cr, stroke_color);
                cr.setLineWidth(line_width);
                cr.setLineJoin(Cairo.LineJoin.ROUND);
                cr.setLineCap(Cairo.LineCap.ROUND);
                cr.newPath();

                cr.moveTo(radPlusPad, up_y_side);
                cr.curveTo(cp_x, up_y_cp, -cp_x, up_y_cp, -radPlusPad, up_y_side);

                cr.moveTo(radPlusPad, low_y_side);
                cr.curveTo(cp_x, low_y_cp, -cp_x, low_y_cp, -radPlusPad, low_y_side);

                cr.stroke();
            }
        } else {
            const closed_y = radPlusPad;

            // Upper lid edge positions: arcs downwards as it moves down
            const up_y_side = -radPlusPad * (1 - t) + closed_y * t;
            const up_y_center = (-radPlusPad - eye_rad * 0.4) * (1 - t) + closed_y * t;
            const up_y_control = 2 * up_y_center - up_y_side;

            const up_y_cp = up_y_side + (up_y_control - up_y_side) * 2 / 3;

            // Upper lid mask
            cr.moveTo(-radPlusPad, -radPlusPad);
            cr.lineTo(radPlusPad, -radPlusPad);
            cr.lineTo(radPlusPad, up_y_side);
            cr.curveTo(cp_x, up_y_cp, -cp_x, up_y_cp, -radPlusPad, up_y_side);
            cr.closePath();

            cr.fill();

            if (do_stroke) {
                cr.setOperator(Cairo.Operator.OVER);
                Clutter.cairo_set_source_color(cr, stroke_color);
                cr.setLineWidth(line_width);
                cr.setLineJoin(Cairo.LineJoin.ROUND);
                cr.setLineCap(Cairo.LineCap.ROUND);
                cr.newPath();

                // Re-add path for stroking the lid edge curve
                cr.moveTo(radPlusPad, up_y_side);
                cr.curveTo(cp_x, up_y_cp, -cp_x, up_y_cp, -radPlusPad, up_y_side);

                cr.stroke();
            }
        }

        cr.restore();
    }

    /**
     * Appends eyelid eye path to the context
     * @param {cairo.Context} cr The Cairo drawing context
     * @param {number} eye_rad The radius of the eye
     * @param {number} iris_rad The radius of the iris
     * @param {number} x_def The x-deflection for eyelid shaping
     * @param {number} y_def The y-deflection for eyelid shaping
     * @param {number} top_lid The top eyelid factor (0-1)
     * @param {number} bottom_lid The bottom eyelid factor (0-1)
     */
    _appendEyelidEyePath(cr, eye_rad, iris_rad, x_def, y_def, top_lid, bottom_lid) {
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

    /**
     * Draws the pupil with the given shape
     * @param {cairo.Context} cr The Cairo drawing context
     * @param {number} pupil_rad The base radius of the pupil
     * @param {String} pupil_shape The shape of the pupil
     */
    _drawPupil(cr, pupil_rad, pupil_shape) {
        let shape_width = pupil_rad;
        let shape_height = pupil_rad;

        if (pupil_shape === 'vertical') {
            shape_width = pupil_rad * 0.4;
            shape_height = pupil_rad * 1.8;
        } else if (pupil_shape === 'horizontal') {
            shape_width = pupil_rad * 1.8;
            shape_height = pupil_rad * 0.4;
        } else if (pupil_shape === 'star') {
            shape_width = pupil_rad * 1.5;
            shape_height = pupil_rad * 1.5;
        }

        cr.scale(shape_width, shape_height);

        if (pupil_shape === 'star') {
            cr.newPath();
            const num_points = 5;
            const inner_rad = 0.382; // roughly 3 - sqrt(5) / 2

            for (let i = 0; i < num_points * 2; i++) {
                let rad = i % 2 === 0 ? 1.0 : inner_rad;
                let angle = (i * Math.PI) / num_points - (Math.PI / 2);
                cr.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
            }

            cr.closePath();
        } else {
            cr.arc(0, 0, 1.0, 0, TWO_PI);
        }

        cr.fill();
    }
}
