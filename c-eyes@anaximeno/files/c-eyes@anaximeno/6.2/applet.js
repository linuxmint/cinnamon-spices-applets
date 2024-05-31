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

const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Gettext = imports.gettext;
const SignalManager = imports.misc.signalManager;
const { GLib, St, Clutter } = imports.gi;

const { EyeModeFactory } = require("./eyeModes.js");
const { Debouncer } = require("./helpers.js");


const UUID = "c-eyes@anaximeno";
const LOC_DIR = GLib.get_home_dir() + "/.local/share/locale";
const AREA_DEFAULT_WIDTH = 28;

Gettext.bindtextdomain(UUID, LOC_DIR);

function _(text) {
	let loc = Gettext.dgettext(UUID, text);
	return loc != text ? loc : window._(text);
}


class Eye extends Applet.Applet {
	constructor(metadata, orientation, panelHeight, instanceId, areaWidth) {
		super(orientation, panelHeight, instanceId);
		this.settings = this._setup_settings(metadata.uuid, instanceId);
		this.orientation  = orientation;
		this.metadata = metadata;
		this.area_width = areaWidth;

		this.setAllowedLayout(Applet.AllowedLayout.BOTH);

		this.area = new St.DrawingArea();
		this.actor.add(this.area);

		this.eye_painter = EyeModeFactory.createEyeMode(this.mode);

		this.signals = new SignalManager.SignalManager(null);
		this.signals.connect(global.screen, 'in-fullscreen-changed', this.on_fullscreen_changed, this);
        this.signals.connect(Main.layoutManager, 'monitors-changed', this.on_property_updated, this);

		this._last_mouse_x = undefined;
		this._last_mouse_y = undefined;

		this.set_active(true);
		this.update_tooltip();
	}

	_setup_settings(uuid, instanceId) {
		const d = new Debouncer();
		const bindings = [
			{
				key: "repaint-interval",
				value: "repaint_interval",
				cb: d.debounce((value) => this.set_active(true), 300),
			},
			{
				key: "repaint-angle",
				value: "repaint_angle",
				cb: null,
			},
			{
				key: "mode",
				value: "mode",
				cb: (value) => {
					this.on_eye_mode_update();
					this.on_property_updated(value);
				},
			},
			{
				key: "line-width",
				value: "line_width",
				cb: d.debounce(
					this.on_property_updated.bind(this),
					300),
			},
			{
				key: "margin",
				value: "margin",
				cb: d.debounce(
					this.on_property_updated.bind(this),
					300),
			},
			{
				key: "base-color",
				value: "base_color",
				cb: this.on_property_updated,
			},
			{
				key: "iris-color",
				value: "iris_color",
				cb: this.on_property_updated,
			},
			{
				key: "pupil-color",
				value: "pupil_color",
				cb: this.on_property_updated,
			},
			{
				key: "fill-lids-color-painting",
				value: "fill_lids_color_painting",
				cb: this.on_property_updated,
			},
			{
				key: "fill-bulb-color-painting",
				value: "fill_bulb_color_painting",
				cb: this.on_property_updated,
			},
			{
				key: "deactivate-on-fullscreen",
				value: "deactivate_on_fullscreen",
				cb: null,
			},
			{
				key: "use-alternative-colors",
				value: "use_alternative_colors",
				cb: this.on_property_updated,
			},
			{
				key: "padding",
				value: "padding",
				cb: d.debounce(
					this.on_property_updated.bind(this),
					300),
			},
			{
				key: "tooltip-message",
				value: "tooltip_message",
				cb: d.debounce((value) => {
					this.update_tooltip();
					this.on_property_updated(value);
				}, 100),
			}
		];

		let settings = new Settings.AppletSettings(this, uuid, instanceId);

		bindings.forEach(
			s => settings.bind(
				s.key, s.value, s.cb ? (...args) => s.cb.call(this, ...args) : null
			)
		);

		return settings;
	}

	on_orientation_changed(orientation) {
		this.orientation = orientation;
		this.update_sizes();
    }

	on_applet_removed_from_panel(deleteConfig) {
		this.destroy();
	}

	on_applet_clicked(event) {
		this.area.queue_repaint();
	}

	on_property_updated(value = null) {
		this.update_sizes();
		this.area.queue_repaint();
	}

	on_fullscreen_changed() {
		const monitor = global.screen.get_current_monitor();
		const monitorIsInFullscreen = global.screen.get_monitor_in_fullscreen(monitor);
		const panelsInMonitor = Main.panelManager.getPanelsInMonitor(monitor);

		let panelIsInCurrentMonitor = false;
		if (panelsInMonitor !== null && panelsInMonitor !== undefined) {
			panelIsInCurrentMonitor = panelsInMonitor.includes(this.panel);
		}

		if (this.deactivate_on_fullscreen) {
			this.set_active(!monitorIsInFullscreen && panelIsInCurrentMonitor);
		}
	}

	on_refresh_timeout() {
		if (this.should_redraw())
			this.area.queue_repaint();
		return true;
	}

	on_eye_mode_update() {
		if (this.eye_painter && this.eye_painter.mode != this.mode) {
			this.eye_painter = EyeModeFactory.createEyeMode(this.mode);
		}
	}

	destroy() {
		this.set_active(false);
		this.signals.disconnectAllSignals();
		this.area.destroy();
		this.settings.finalize();
	}

	update_sizes() {
		let width = 1, height = 1;

		if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
			this.actor.set_style("padding-top: 0px; padding-bottom: 0px; margin-top: 0px; margin-bottom: 0px;");
			height = (this.area_width + 2 * this.margin) * global.ui_scale;
			width = this.panel.height;
		} else {
			this.actor.set_style("padding-left: 0px; padding-right: 0px; margin-left: 0px; margin-right: 0px;");
			width = (this.area_width + 2 * this.margin) * global.ui_scale;
			height = this.panel.height;
		}

		this.area.set_width(width);
		this.area.set_height(height);
	}

	set_active(enabled) {
		this.on_property_updated();

		if (this._update_handler) {
			Mainloop.source_remove(this._update_handler);
			this._update_handler = null;
		}

		this.signals.disconnect('repaint', this.area);

		if (enabled) {
			this.signals.connect(this.area, 'repaint', this.paint_eye, this);

			this._update_handler = Mainloop.timeout_add(
				this.repaint_interval, this.on_refresh_timeout.bind(this)
			);

			this.area.queue_repaint();
		}
	}

	update_tooltip() {
		this.set_applet_tooltip(_(this.tooltip_message), false);
	}

	get_area_position() {
		let obj = this.area;

		let area_x = 0;
		let area_y = 0;

		do {
			let pos = obj.get_position();

			if (pos) {
				let [tx, ty] = pos;

				area_x += tx;
				area_y += ty;
			}

			obj = obj.get_parent();
		} while (obj);

		return [area_x, area_y];
	}

	paint_eye(area) {
		this.on_eye_mode_update();
		const theme_node = this.area.get_theme_node();
		const [mouse_x, mouse_y, _] = global.get_pointer();
		const [area_x, area_y] = this.get_area_position();

		let base_color = theme_node.get_foreground_color();
		let iris_color = theme_node.get_foreground_color();
		let pupil_color = theme_node.get_foreground_color();

		if (this.use_alternative_colors) {
			let [ok, color] = Clutter.Color.from_string(this.base_color);
			base_color = ok ? color : base_color;

			[ok, color] = Clutter.Color.from_string(this.iris_color);
			iris_color = ok ? color : iris_color;

			[ok, color] = Clutter.Color.from_string(this.pupil_color);
			pupil_color = ok ? color : pupil_color;
		}

		this.eye_painter.drawEye(area, {
			area_x: area_x,
			area_y: area_y,
			mouse_x: mouse_x,
			mouse_y: mouse_y,
			base_color: base_color,
			iris_color: iris_color,
			pupil_color: pupil_color,
			line_width: this.line_width * global.ui_scale,
			padding: this.padding * global.ui_scale,
			lids_fill: this.fill_lids_color_painting &&
					   this.use_alternative_colors,
			bulb_fill: this.fill_bulb_color_painting &&
			           this.use_alternative_colors,
			is_vertical: this.orientation == St.Side.LEFT ||
							  this.orientation == St.Side.RIGHT,
		});
	}

	should_redraw() {
		const [mouse_x, mouse_y, _] = global.get_pointer();

		let should_redraw = true;
		if (this._last_mouse_x == mouse_x && this._last_mouse_y == mouse_y) {
			should_redraw = false;
		} else if (this._last_mouse_x == undefined || this._last_mouse_y == undefined) {
			should_redraw = true;
		} else {
			const dist = (x, y) => Math.sqrt(x * x + y * y);
			const [ox, oy] = this.get_area_position();
			const [last_x, last_y] = [this._last_mouse_x - ox, this._last_mouse_y - oy];
			const [current_x, current_y] = [mouse_x - ox, mouse_y - oy];
			const dist_prod = dist(last_x, last_y) * dist(current_x, current_y);

			if (dist_prod == 0) {
				should_redraw = true;
			} else {
				const dot_prod = current_x * last_x + current_y * last_y;
				const angle = Math.acos(dot_prod / dist_prod);
				should_redraw = angle >= this.repaint_angle;
			}
		}

		if (should_redraw) {
			this._last_mouse_x = mouse_x;
			this._last_mouse_y = mouse_y;
		}

		return should_redraw;
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new Eye(metadata, orientation, panelHeight, instanceId, AREA_DEFAULT_WIDTH);
}
