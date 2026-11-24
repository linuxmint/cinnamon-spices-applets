/* modes/bulb.js
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
// Cinnamon resolves require paths from the applet's root folder, even in sub folders.
const { EyeMode, TWO_PI } = require("./modes/base.js");

var BulbMode = class BulbMode extends EyeMode {
    drawEye(area, blink_rate, options) {
        const [area_width, area_height] = area.allocation.get_size();
        const half_width = area_width * 0.5;
        const half_height = area_height * 0.5;

        const mouse_x = options.mouse_x - options.area_x - half_width;
        const mouse_y = options.mouse_y - options.area_y - half_height;

        const mouse_dist = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);
        const mouse_ang = Math.atan2(mouse_y, mouse_x);

        const min_area_size = Math.min(area_width, area_height);
        const eye_rad = (min_area_size - options.padding) * 0.5;

        const iris_rad = eye_rad * 0.6;
        const pupil_rad = iris_rad * 0.4;

        const iris_arc = Math.asin(iris_rad / eye_rad);
        const iris_r = eye_rad * Math.cos(iris_arc);

        const max_rad = iris_r - options.line_width;
        const mouse_rad = Math.min(mouse_dist, max_rad);

        const eye_ang = Math.atan(mouse_rad / iris_r);

        const sin_eye_ang = Math.sin(eye_ang);
        const cos_eye_ang = Math.cos(eye_ang);

        const cr = area.get_context();
        this.clearArea(cr, area_width, area_height);

        Clutter.cairo_set_source_color(cr, options.base_color);

        cr.translate(half_width, half_height);
        cr.setLineWidth(options.line_width);
        cr.arc(0, 0, eye_rad, 0, TWO_PI);

        if (options.fill) {
            cr.fill();
        } else {
            cr.stroke();
        }

        cr.rotate(mouse_ang);

        Clutter.cairo_set_source_color(cr, options.iris_color);

        const iris_scale_x = iris_rad * cos_eye_ang;
        const iris_translate_x = iris_r * sin_eye_ang;

        cr.setLineWidth(options.line_width / iris_rad);
        cr.translate(iris_translate_x, 0);
        cr.scale(iris_scale_x, iris_rad);
        cr.arc(0, 0, 1.0, 0, TWO_PI);
        options.fill ? cr.fill() : cr.stroke();

        cr.identityMatrix();
        cr.translate(half_width, half_height);

        Clutter.cairo_set_source_color(cr, options.pupil_color);

        const pupil_translate_x_base = eye_rad * sin_eye_ang;
        const pt_x = pupil_translate_x_base * Math.cos(mouse_ang);
        const pt_y = pupil_translate_x_base * Math.sin(mouse_ang);

        cr.translate(pt_x, pt_y);

        cr.rotate(mouse_ang);
        cr.scale(cos_eye_ang, 1.0);
        cr.rotate(-mouse_ang);

        this._drawPupil(cr, pupil_rad, options.pupil_shape);

        let lid_stroke_width = options.fill ? Math.max(1, options.line_width * 0.4) : options.line_width;
        let lid_stroke_color = options.fill ? options.stroke_color : options.base_color;

        this._applyUpperLidBlink(cr, blink_rate, eye_rad, lid_stroke_width, area_width, area_height, true, lid_stroke_color,
            (ctx) => { ctx.arc(0, 0, eye_rad, 0, TWO_PI); },
            true // use lower lid
        );
    }
}
