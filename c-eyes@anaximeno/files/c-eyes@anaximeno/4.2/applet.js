/* applet.js
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

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Tweener = imports.ui.tweener;

const Mainloop = imports.mainloop;

const { Atspi, Clutter, GLib, Gio, St } = imports.gi;

const { debounce } = require("./helper.js");

const EYE_AREA_WIDTH = 34;
const EYE_AREA_HEIGHT = 16;


// Class to create the Eye
class Eye extends Applet.Applet {
	_get_mouse_circle_icon(dir, mode, click_type, color) {
		let key = `${dir}${mode}${click_type}${color}`;
		let path = `${dir}/icons/${mode}_${click_type}_${color}.svg`;

		if (this._file_mem_cache[key]) {
			return this._file_mem_cache[key];
		}

		this._file_mem_cache[key] = Gio.icon_new_for_string(path);

		return this._file_mem_cache[key];
	}

	_initDataDir() {
		let data_dir = `${GLib.get_user_cache_dir()}/${this.metadata.uuid}`;

		if (GLib.mkdir_with_parents(`${data_dir}/icons`, 0o777) < 0)
			throw new Error(`Failed to create cache dir at ${data_dir}`);

		return data_dir;
	}

	_setupSettings(uuid, instanceId) {
		this.settings = new Settings.AppletSettings(this, uuid, instanceId);

		this.settings.bind(
			"eye-repaint-interval",
			"eye_repaint_interval",
			debounce((e) => this.setActive(true), 200)
		);

		this.settings.bind(
			"fade-timeout",
			"fade_timeout",
			debounce((e) => this.on_property_updated(e), 200)
		);

		this.settings.bind(
			"eye-mode",
			"eye_mode",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-click-mode",
			"mouse_click_mode",
			this.on_property_updated
		);

		this.settings.bind(
			"eye-line-width",
			"eye_line_width",
			debounce((e) => this.on_property_updated(e), 200)
		);

		this.settings.bind(
			"eye-margin",
			"eye_margin",
			debounce((e) => this.on_property_updated(e), 200)
		);

		this.settings.bind(
			"eye-clicked-color",
			"eye_clicked_color",
			this.on_property_updated
		);

		this.settings.bind(
			"iris-clicked-color",
			"iris_clicked_color",
			this.on_property_updated
		);

		this.settings.bind(
			"pupil-clicked-color",
			"pupil_clicked_color",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-click-image-size",
			"mouse_click_image_size",
			debounce((e) => this.on_property_updated(e), 200)
		);

		this.settings.bind(
			"mouse-click-enable",
			"mouse_click_enable",
			this.on_mouse_click_enable_updated
		);

		this.settings.bind(
			"mouse-left-click-enable",
			"mouse_left_click_enable",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-right-click-enable",
			"mouse_right_click_enable",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-middle-click-enable",
			"mouse_middle_click_enable",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-left-click-color",
			"mouse_left_click_color",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-middle-click-color",
			"mouse_middle_click_color",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-right-click-color",
			"mouse_right_click_color",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-click-opacity",
			"mouse_click_opacity",
			debounce((e) => this.on_property_updated(e), 200)
		);
	}

	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);

		this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);
		this._setupSettings(metadata.uuid, instanceId);

		this.metadata = metadata;
		this.data_dir = this._initDataDir();
		this.img_dir = `${metadata.path}/../circle`;

		if (!Gio.File.new_for_path(this.img_dir).query_exists(null)) {
			this.img_dir = `${GLib.get_home_dir()}/.local/share/cinnamon/applets/${this.metadata.uuid}/circle`;
		}

		this.area = new St.DrawingArea();
		this.actor.add(this.area);

		Atspi.init();

		this._mouseListener = Atspi.EventListener.new(this._mouseCircleClick.bind(this));

		this.setActive(true);
		this.setMouseCirclePropertyUpdate();

		this._file_mem_cache = {};
		this._last_mouse_x_pos = undefined;
		this._last_mouse_y_pos = undefined;
	}

	on_applet_removed_from_panel(deleteConfig) {
		this.destroy();
	}

	on_applet_reloaded(deleteConfig) {
		this._file_mem_cache = {};
		this._last_mouse_x_pos = undefined;
		this._last_mouse_y_pos = undefined;
	}

	on_applet_clicked(event) {
		if (this.mouse_click_enable) {
			this._eyeClick(this, event);
		}
	}

	on_property_updated(event) {
		this.setMouseCirclePropertyUpdate();
		this.setEyePropertyUpdate();
	}

	on_mouse_click_enable_updated(event) {
		if (this.mouse_click_enable === false)
			this.mouse_click_show = false;
		this.setMouseCircleActive(this.mouse_click_show);
		this.on_property_updated(event);
		this.area.queue_repaint();
	}

	destroy() {
		this.setMouseCircleActive(false);
		this.setActive(false);
		this.area.destroy();
	}

	setActive(enabled) {
		this.setEyePropertyUpdate();

		if (this._repaint_handler) {
			this.area.disconnect(this._repaint_handler);
			this._repaint_handler = null;
		}

		if (this._eye_update_handler) {
			Mainloop.source_remove(this._eye_update_handler);
			this._eye_update_handler = null;
		}

		if (enabled) {
			this._repaint_handler = this.area.connect("repaint", this._eyeDraw.bind(this));

			this._eye_update_handler = Mainloop.timeout_add(
				this.eye_repaint_interval, this._eyeTimeout.bind(this)
			);

			this.area.queue_repaint();
		}
	}

	_mouseCircleCreateDataIcon(name, color) {
		let source = Gio.File.new_for_path(`${this.img_dir}/${this.mouse_click_mode}.svg`);
		let [l_success, contents] = source.load_contents(null);
		contents = contents.toString();

		// Replace to new color
		contents = contents.replace('fill="#000000"', `fill="${color}"`);

		// Save content to cache dir
		let dest = Gio.File.new_for_path(`${this.data_dir}/icons/${this.mouse_click_mode}_${name}_${color}.svg`);
		if (!dest.query_exists(null)) {
			dest.create(Gio.FileCreateFlags.NONE, null);
		}
		let [r_success, tag] = dest.replace_contents(contents, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
	}

	_clickAnimation(click_type, color) {
		let [mouse_x, mouse_y, mask] = global.get_pointer();
		let actor_scale = this.mouse_click_image_size > 20 ? 1.5 : 3;

		let icon = this._get_mouse_circle_icon(this.data_dir, this.mouse_click_mode, click_type, color);

		let actor = new St.Icon({
			x: mouse_x - (this.mouse_click_image_size / 2),
			y: mouse_y - (this.mouse_click_image_size / 2),
			reactive: false,
			can_focus: false,
			track_hover: false,
			icon_size: this.mouse_click_image_size,
			opacity: this.mouse_click_opacity,
			gicon: icon
		});

		Main.uiGroup.add_child(actor);

		Tweener.addTween(actor,
			{
				x: mouse_x - (this.mouse_click_image_size * actor_scale / 2),
				y: mouse_y - (this.mouse_click_image_size * actor_scale / 2),
				scale_x: actor_scale,
				scale_y: actor_scale,
				opacity: 0,
				time: this.fade_timeout / 1000,
				transition: "easeOutQuad",
				onComplete: function () {
					Main.uiGroup.remove_child(actor);
					actor.destroy();
					actor = null;
				},
				onCompleteScope: this
			});
	}

	_mouseCircleClick(event) {
		switch (event.type) {
			case 'mouse:button:1p':
				if (this.mouse_left_click_enable)
					this._clickAnimation('left_click', this.mouse_left_click_color);
				break;
			case 'mouse:button:2p':
				if (this.mouse_middle_click_enable)
					this._clickAnimation('middle_click', this.mouse_middle_click_color);
				break;
			case 'mouse:button:3p':
				if (this.mouse_right_click_enable)
					this._clickAnimation('right_click', this.mouse_right_click_color);
				break;
		}
	}

	setMouseCirclePropertyUpdate() {
		this._mouseCircleCreateDataIcon('left_click', this.mouse_left_click_color);
		this._mouseCircleCreateDataIcon('right_click', this.mouse_right_click_color);
		this._mouseCircleCreateDataIcon('middle_click', this.mouse_middle_click_color);
	}

	setEyePropertyUpdate() {
		const margin = 2 * this.eye_margin;
		this.area.set_width(EYE_AREA_WIDTH + margin);
		this.area.set_height(EYE_AREA_HEIGHT + margin);
		this.area.queue_repaint();
	}

	setMouseCircleActive(enabled) {
		if (enabled == null) {
			enabled = this.mouse_click_show;
		}

		if (enabled) {
			this.setMouseCirclePropertyUpdate();
			this._mouseListener.register('mouse');
		} else {
			this._mouseListener.deregister('mouse');
		}
	}

	_eyeTimeout() {
		let [mouse_x, mouse_y, mask] = global.get_pointer();

		if (mouse_x !== this._last_mouse_x_pos || mouse_y !== this._last_mouse_y_pos) {
			this._last_mouse_x_pos = mouse_x;
			this._last_mouse_y_pos = mouse_y;
			this.area.queue_repaint();
		}

		return true;
	}

	_eyeClick(actor, event) {
		let button = 1;

		if (button === 1 /* Left button */) {
			this.mouse_click_show = !this.mouse_click_show;
			this.setMouseCircleActive(this.mouse_click_show);
			this.area.queue_repaint();
		}

		if (button === 2 /* Right button */) {
			//
		}
	}

	_eyeDraw(area) {
		let get_pos = function (self) {
			let area_x = 0;
			let area_y = 0;

			let obj = self.area;
			do {
				let tx = 0;
				let ty = 0;
				try {
					[tx, ty] = obj.get_position();
				} catch (e) {
				}
				area_x += tx;
				area_y += ty;
				obj = obj.get_parent();
			}
			while (obj);

			return [area_x, area_y];
		};

		let [area_width, area_height] = area.get_surface_size();
		let [area_x, area_y] = get_pos(this);
		area_x += area_width / 2;
		area_y += area_height / 2;

		let [mouse_x, mouse_y, mask] = global.get_pointer();
		mouse_x -= area_x;
		mouse_y -= area_y;

		let mouse_ang = Math.atan2(mouse_y, mouse_x);
		let mouse_rad = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);

		let eye_rad;
		let iris_rad;
		let pupil_rad;
		let max_rad;

		if (this.eye_mode === "bulb") {
			eye_rad = (area_height) / 2.3;
			iris_rad = eye_rad * 0.6;
			pupil_rad = iris_rad * 0.4;

			max_rad = eye_rad * Math.cos(Math.asin((iris_rad) / eye_rad)) - this.eye_line_width;
		} else if (this.eye_mode === "lids") {
			eye_rad = (area_height) / 2;
			iris_rad = eye_rad * 0.5;
			pupil_rad = iris_rad * 0.4;

			max_rad = eye_rad * (Math.pow(Math.cos(mouse_ang), 4) * 0.5 + 0.25)
		}

		if (mouse_rad > max_rad)
			mouse_rad = max_rad;

		let iris_arc = Math.asin(iris_rad / eye_rad);
		let iris_r = eye_rad * Math.cos(iris_arc);

		let eye_ang = Math.atan(mouse_rad / iris_r);

		let cr = area.get_context();
		let theme_node = this.area.get_theme_node();

		if (this.mouse_click_show) {
			let [ok, color] = Clutter.Color.from_string(this.eye_clicked_color);
			Clutter.cairo_set_source_color(cr, ok ? color : theme_node.get_foreground_color());
		} else {
			Clutter.cairo_set_source_color(cr, theme_node.get_foreground_color());
		}

		cr.translate(area_width * 0.5, area_height * 0.5);
		cr.setLineWidth(this.eye_line_width);

		if (this.eye_mode === "bulb") {
			cr.arc(0, 0, eye_rad, 0, 2 * Math.PI);
			cr.stroke();
		} else if (this.eye_mode === "lids") {
			let x_def = iris_rad * Math.cos(mouse_ang) * (Math.sin(eye_ang));
			let y_def = iris_rad * Math.sin(mouse_ang) * (Math.sin(eye_ang));
			let amp;

			let top_lid = 0.8;
			let bottom_lid = 0.6;

			amp = eye_rad * top_lid;
			cr.moveTo(-eye_rad, 0);
			cr.curveTo(x_def - iris_rad, y_def + amp,
				x_def + iris_rad, y_def + amp, eye_rad, 0);

			amp = eye_rad * bottom_lid;
			cr.curveTo(x_def + iris_rad, y_def - amp,
				x_def - iris_rad, y_def - amp, -eye_rad, 0);
			cr.stroke();

			amp = eye_rad * top_lid;
			cr.moveTo(-eye_rad, 0);
			cr.curveTo(x_def - iris_rad, y_def + amp,
				x_def + iris_rad, y_def + amp, eye_rad, 0);

			amp = eye_rad * bottom_lid;
			cr.curveTo(x_def + iris_rad, y_def - amp,
				x_def - iris_rad, y_def - amp, -eye_rad, 0);
			cr.clip();
		}

		cr.rotate(mouse_ang);
		cr.setLineWidth(this.eye_line_width / iris_rad);

		if (this.mouse_click_show) {
			let [ok, color] = Clutter.Color.from_string(this.iris_clicked_color);
			Clutter.cairo_set_source_color(cr, ok ? color : theme_node.get_foreground_color());
		}

		cr.translate(iris_r * Math.sin(eye_ang), 0);
		cr.scale(iris_rad * Math.cos(eye_ang), iris_rad);
		cr.arc(0, 0, 1.0, 0, 2 * Math.PI);
		cr.stroke();
		cr.scale(1 / (iris_rad * Math.cos(eye_ang)), 1 / iris_rad);
		cr.translate(-iris_r * Math.sin(eye_ang), 0);

		if (this.mouse_click_show) {
			let [ok, color] = Clutter.Color.from_string(this.pupil_clicked_color);
			Clutter.cairo_set_source_color(cr, ok ? color : theme_node.get_foreground_color());
		}

		cr.translate(eye_rad * Math.sin(eye_ang), 0);
		cr.scale(pupil_rad * Math.cos(eye_ang), pupil_rad);
		cr.arc(0, 0, 1.0, 0, 2 * Math.PI);
		cr.fill();

		cr.save();
		cr.restore();
		cr.$dispose();
	}
}

function main(metadata, orientation, instanceId) {
	return new Eye(metadata, orientation, instanceId);
}
