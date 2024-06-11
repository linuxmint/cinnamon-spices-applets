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

const { Clutter } = imports.gi;

class EyeMode {
    constructor(mode) {
        this.mode = mode;
    }

    /**
     * Draws the eye on the panel
     * @param {St.DrawingArea} area The area on repaint
     * @param {Object} options Drawing options
     */
    drawEye(area, options) {
        // Implemented by sub-classes
    };

    topAndLatSizes(area_width, area_height, options) {
        let top_size, lat_size;

        if(options.is_vertical) {
            top_size = area_width;
            lat_size = area_height;
        } else {
            top_size = area_height;
            lat_size = area_width;
        }

        return [top_size, lat_size];
    }
}

class EyelidMode extends EyeMode {
    drawEye(area, options) {
        let [area_width, area_height] = area.get_surface_size();
        let [mouse_x, mouse_y] = [options.mouse_x, options.mouse_y];
        let [area_x, area_y] = [options.area_x, options.area_y];

        area_x += area_width / 2;
        area_y += area_height / 2;

        mouse_x -= area_x;
        mouse_y -= area_y;

        const mouse_ang = Math.atan2(mouse_y, mouse_x);
        let mouse_rad = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);

        let [top_size, lat_size] = this.topAndLatSizes(area_width, area_height, options);
        let eye_rad = (top_size - options.padding) / 2;
        if (2 * eye_rad > lat_size) eye_rad = lat_size / 2;

        const iris_rad = eye_rad * 0.5;
        const pupil_rad = iris_rad * 0.4;

        const max_rad = eye_rad * (Math.pow(Math.cos(mouse_ang), 4) * 0.5 + 0.25);

        if (mouse_rad > max_rad)
            mouse_rad = max_rad;

        const iris_arc = Math.asin(iris_rad / eye_rad);
        const iris_r = eye_rad * Math.cos(iris_arc);

        const eye_ang = Math.atan(mouse_rad / iris_r);

        let cr = area.get_context();

        // -- Drawing the base of the eye

        Clutter.cairo_set_source_color(cr, options.base_color);

        cr.translate(area_width * 0.5, area_height * 0.5);
        cr.setLineWidth(options.line_width);

        const x_def = iris_rad * Math.cos(mouse_ang) * (Math.sin(eye_ang));
        const y_def = iris_rad * Math.sin(mouse_ang) * (Math.sin(eye_ang));
        let amp;

        const top_lid = 0.8;
        const bottom_lid = 0.6;

        amp = eye_rad * top_lid;
        cr.moveTo(-eye_rad, 0);
        cr.curveTo(x_def - iris_rad, y_def + amp,
            x_def + iris_rad, y_def + amp, eye_rad, 0);

        amp = eye_rad * bottom_lid;
        cr.curveTo(x_def + iris_rad, y_def - amp,
            x_def - iris_rad, y_def - amp, -eye_rad, 0);

        options.lids_fill ? cr.fill() : cr.stroke();

        amp = eye_rad * top_lid;
        cr.moveTo(-eye_rad, 0);
        cr.curveTo(x_def - iris_rad, y_def + amp,
            x_def + iris_rad, y_def + amp, eye_rad, 0);

        amp = eye_rad * bottom_lid;
        cr.curveTo(x_def + iris_rad, y_def - amp,
            x_def - iris_rad, y_def - amp, -eye_rad, 0);
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

        cr.save();
        cr.restore();
        cr.$dispose();
    }
}


class BulbMode extends EyeMode {
    drawEye(area, options) {
        let [area_width, area_height] = area.get_surface_size();
        let [mouse_x, mouse_y] = [options.mouse_x, options.mouse_y];
        let [area_x, area_y] = [options.area_x, options.area_y];

        area_x += area_width / 2;
        area_y += area_height / 2;

        mouse_x -= area_x;
        mouse_y -= area_y;

        let mouse_rad = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);
        const mouse_ang = Math.atan2(mouse_y, mouse_x);

        let [top_size, lat_size] = this.topAndLatSizes(area_width, area_height, options);
        let eye_rad = (top_size - options.padding) / 2;
        if (2 * eye_rad > lat_size) eye_rad = lat_size / 2;

        const iris_rad = eye_rad * 0.6;
        const pupil_rad = iris_rad * 0.4;

        const max_rad = eye_rad * Math.cos(Math.asin((iris_rad) / eye_rad)) - options.line_width;

        if (mouse_rad > max_rad) mouse_rad = max_rad;

        const iris_arc = Math.asin(iris_rad / eye_rad);
        const iris_r = eye_rad * Math.cos(iris_arc);

        const eye_ang = Math.atan(mouse_rad / iris_r);

        const cr = area.get_context();

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

        cr.save();
        cr.restore();
        cr.$dispose();
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
