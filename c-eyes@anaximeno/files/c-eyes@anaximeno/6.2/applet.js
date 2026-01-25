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

const Settings = imports.ui.settings;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Gettext = imports.gettext;
const SignalManager = imports.misc.signalManager;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const EyeModes = require("./eyeModes.js");
const Configs = require("./configs.js");
const Helpers = require("./helpers.js");


Gettext.bindtextdomain(Configs.UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
	return Gettext.dgettext(Configs.UUID, text);
}

// XXX: Mark this for translation because it will
// not be marked by the translation tool from the settings-schema.
_("Hey, I saw that!");


class Eye extends Applet.Applet {
	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);
		this.metadata = metadata;
		this.instanceId = instanceId;
		this.orientation = orientation;

		this.settings = this._setup_settings(metadata.uuid, instanceId);
		this.setAllowedLayout(Applet.AllowedLayout.BOTH);

		this.area = new St.DrawingArea();
		this.actor.add(this.area);

		this.eyePainter = EyeModes.EyeModeFactory.createEyeMode(this.mode);
		this.signals = new SignalManager.SignalManager(null);

		this.signals.connect(global.screen, 'in-fullscreen-changed', this.on_fullscreen_changed, this);
		this.signals.connect(Main.layoutManager, 'monitors-changed',
			() => Util.setTimeout(this.on_property_updated.bind(this), Configs.MONITORS_CHANGED_UPDATE_TIMEOUT_MS),
			this);
		this.signals.connect(global.screen, 'workspace-switched', () => {
			// XXX: If the eye is refreshed exactly during the workspace switch process it's possible that the position
			// of the panel is not correctly accessed, so the position of the eye cannot be estimated correctly,
			// resulting in the eye looking at the wrong direction, to avoid that we will give it some timeout and
			// wait first for the switch process to complete.
			Util.setTimeout(this.on_property_updated.bind(this), Configs.WS_SWITCHED_UPDATE_TIMEOUT_MS);
		}, this);

		this.refresh_handler_id = 0;

		this.cos_repaint_angle = Math.cos(this.repaint_angle);

		this._last_mouse_x = null;
		this._last_mouse_y = null;
		this._last_eye_x = null;
		this._last_eye_y = null;

		this.idle_monitor = new Helpers.IdleMonitor(this.idle_delay);

		this.last_blink_start = null;
		this.last_blink_end = null;
		this.blink_rate = 0.00;

		this._cached_base_color = null;
		this._cached_iris_color = null;
		this._cached_pupil_color = null;

		this.enabled = false;
		this.set_active(true);
		this.update_tooltip();
	}

	get repaint_interval() {
		let repaint_interval = this._repaint_interval;

		if (this.optimization_mode != "manual" && this.optimization_mode in Configs.Optimizations) {
			let r = Configs.Optimizations[this.optimization_mode]["repaint_interval_ms"];
			if (r != null) repaint_interval = r;
		}

		return repaint_interval;
	}

	get repaint_angle() {
		let repaint_angle = this._repaint_angle;

		if (this.optimization_mode != "manual" && this.optimization_mode in Configs.Optimizations) {
			let r = Configs.Optimizations[this.optimization_mode]["repaint_angle_rad"];
			if (r != null) repaint_angle = r;
		}

		return repaint_angle;
	}

	_setup_settings(uuid, instanceId) {
		const _d = new Helpers.Debouncer();

		const bindings = [
			{
				key: "repaint-interval",
				value: "_repaint_interval",
				cb: _d.debounce((value) => this.set_active(true), 300),
			},
			{
				key: "repaint-angle",
				value: "_repaint_angle",
				cb: () => this.cos_repaint_angle = Math.cos(this.repaint_angle),
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
				cb: _d.debounce(
					this.on_property_updated.bind(this),
					300),
			},
			{
				key: "margin",
				value: "margin",
				cb: _d.debounce(
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
				cb: this.on_fullscreen_changed,
			},
			{
				key: "use-alternative-colors",
				value: "use_alternative_colors",
				cb: this.on_property_updated,
			},
			{
				key: "padding",
				value: "padding",
				cb: _d.debounce(
					this.on_property_updated.bind(this),
					300),
			},
			{
				key: "tooltip-message",
				value: "tooltip_message",
				cb: _d.debounce((value) => {
					this.update_tooltip();
					this.on_property_updated(value);
				}, 100),
			},
			{
				key: "optimization-mode",
				value: "optimization_mode",
				cb: (value) => {
					this.on_optimization_mode_updated();
					this.on_property_updated(value);
				},
			},
			{
				key: "blink-effect-enabled",
				value: "blink_effect_enabled",
				cb: null
			},
			{
				key: "blink-period",
				value: "blink_period",
				cb: null
			},
			{
				key: "blink-gap",
				value: "blink_gap",
				cb: null
			},
			{
				key: "idle-delay",
				value: "idle_delay",
				cb: _d.debounce((value) => {
					if (this.idle_monitor) {
						this.idle_monitor.destroy();
					}
					this.idle_monitor = new Helpers.IdleMonitor(value);
				}, 300),
			}
		];

		let settings = new Settings.AppletSettings(this, uuid, instanceId);

		bindings.forEach(s => settings.bind(
			s.key,
			s.value,
			s.cb ? (...args) => s.cb.call(this, ...args) : null
		));

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

		if (this.use_alternative_colors) {
			let [ok, color] = Clutter.Color.from_string(this.base_color);
			this._cached_base_color = ok ? color : null;

			[ok, color] = Clutter.Color.from_string(this.iris_color);
			this._cached_iris_color = ok ? color : null;

			[ok, color] = Clutter.Color.from_string(this.pupil_color);
			this._cached_pupil_color = ok ? color : null;
		}

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

		if (this.deactivate_on_fullscreen && panelIsInCurrentMonitor) {
			this.set_active(!monitorIsInFullscreen);
		} else {
			this.set_active(true);
		}
	}

	on_refresh_timeout() {
		// if the applet was disabled but the source hasn't
		// been removed yet, stop the source.
		if (!this.enabled) return GLib.SOURCE_REMOVE;

		// only repaint when needed.
		if (this.should_redraw()) {
			this.area.queue_repaint();
		}

		return GLib.SOURCE_CONTINUE;
	}

	on_eye_mode_update() {
		if (!this.eyePainter || this.eyePainter.mode != this.mode) {
			this.eyePainter = EyeModes.EyeModeFactory.createEyeMode(this.mode);
		}
	}

	on_optimization_mode_updated() {
		this.set_active(this.enabled);
		global.log(Configs.UUID, `optimizing to ${this.optimization_mode}`);
	}

	update_sizes() {
		let width = 1, height = 1;

		if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
			this.actor.set_style("padding-top: 0px; padding-bottom: 0px; margin-top: 0px; margin-bottom: 0px;");
			height = (Configs.AREA_DEFAULT_WIDTH + 2 * this.margin) * global.ui_scale;
			width = this.panel.height;
		} else {
			this.actor.set_style("padding-left: 0px; padding-right: 0px; margin-left: 0px; margin-right: 0px;");
			width = (Configs.AREA_DEFAULT_WIDTH + 2 * this.margin) * global.ui_scale;
			height = this.panel.height;
		}

		this.area.set_width(width);
		this.area.set_height(height);
	}

	update_tooltip() {
		this.set_applet_tooltip(_(this.tooltip_message), false);
	}

	set_active(enabled) {
		this.enabled = enabled;

		this.signals.disconnect('repaint', this.area);

		if (this.refresh_handler_id) {
			GLib.source_remove(this.refresh_handler_id);
			this.refresh_handler_id = 0;
		}

		if (enabled) {
			this.signals.connect(this.area, 'repaint', this.paint_eye, this);
			this.refresh_handler_id = GLib.timeout_add(
				GLib.PRIORITY_DEFAULT,
				this.repaint_interval,
				this.on_refresh_timeout.bind(this),
			);
			this.on_property_updated();
		}

		global.log(Configs.UUID, `Eye/${this.instanceId} - ${enabled ? "enabled" : "disabled"}`);
	}

	destroy() {
		this.set_active(false);
		this.signals.disconnectAllSignals();
		this.area.destroy();
		this.settings.finalize();
		this.idle_monitor.destroy();
		this.idle_monitor = null;
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
			if (this._cached_base_color) base_color = this._cached_base_color;
			if (this._cached_iris_color) iris_color = this._cached_iris_color;
			if (this._cached_pupil_color) pupil_color = this._cached_pupil_color;
		}

		// if (this.blink_effect_enabled) {
		// 	global.log(Configs.UUID, `Eye/${this.instanceId} - blinking rate: ${this.blink_rate}`);
		// }

		const padding = this.padding * global.ui_scale;
		const line_width = this.line_width * global.ui_scale;
		const is_vertical = this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT;
		const lids_fill = this.fill_lids_color_painting && this.use_alternative_colors;
		const bulb_fill = this.fill_bulb_color_painting && this.use_alternative_colors;

		this.eyePainter.drawEye(
			area,
			this.blink_rate,
			{
				area_x: area_x,
				area_y: area_y,
				mouse_x: mouse_x,
				mouse_y: mouse_y,
				base_color: base_color,
				iris_color: iris_color,
				pupil_color: pupil_color,
				padding: padding,
				line_width: line_width,
				is_vertical: is_vertical,
				lids_fill: lids_fill,
				bulb_fill: bulb_fill,
			},
		);
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

	should_redraw() {
		const [mouse_x, mouse_y, _] = global.get_pointer();
		const [ox, oy] = this.get_area_position();

		let should_redraw = true;
		if (this.check_blink_needed()) {
			should_redraw = true;
		} else if (this._last_mouse_x == mouse_x &&
			this._last_mouse_y == mouse_y &&
			this._last_eye_x == ox &&
			this._last_eye_y == oy
		) {
			should_redraw = false;
		} else if (this._last_mouse_x == undefined ||
			this._last_mouse_y == undefined ||
			this._last_eye_x != ox ||
			this._last_eye_y != oy
		) {
			should_redraw = true;
		} else {
			const sq_dist = (x, y) => x * x + y * y;
			const [last_x, last_y] = [this._last_mouse_x - ox, this._last_mouse_y - oy];
			const [current_x, current_y] = [mouse_x - ox, mouse_y - oy];
			const current_sq_dist = sq_dist(current_x, current_y);
			const last_sq_dist = sq_dist(last_x, last_y);

			if (last_sq_dist === 0 || current_sq_dist === 0) {
				should_redraw = true;
			} else {
				const dot_prod = current_x * last_x + current_y * last_y;
				if (dot_prod < 0) {
					should_redraw = true;
				} else {
					const limit_sq = this.cos_repaint_angle * this.cos_repaint_angle;
					should_redraw = (dot_prod * dot_prod) <= (limit_sq * last_sq_dist * current_sq_dist);
				}
			}
		}

		if (should_redraw) {
			this._last_mouse_x = mouse_x;
			this._last_mouse_y = mouse_y;
			this._last_eye_x = ox;
			this._last_eye_y = oy;
		}

		return should_redraw;
	}

	check_blink_needed() {
		if (!this.blink_effect_enabled) {
			return false;
		}

		const now = Date.now();

		if (this.last_blink_start === null ||
			this.last_blink_end === null ||
			this.last_blink_end + this.blink_gap < now
		) {
			this.last_blink_start = now;
			this.last_blink_end = now + this.blink_period;
			this.blink_rate = 0.00;
			// global.log(Configs.UUID, `Eye/${this.instanceId} - starting blink`);
			return true;
		} else if (this.last_blink_start <= now && now <= this.last_blink_end) {
			let progress = (now - this.last_blink_start) / this.blink_period;

			if (progress <= 0.5) {
				this.blink_rate = progress * 2;
			} else {
				this.blink_rate = 2 - progress * 2;
			}

			this.blink_rate = Math.round(this.blink_rate * 100) / 100;
			return true;
		} else if (this.blink_rate > 0.00) {
			this.blink_rate = 0.00;
			// global.log(Configs.UUID, `Eye/${this.instanceId} - ending blink`);
			return true;
		}

		return false;
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new Eye(metadata, orientation, panelHeight, instanceId);
}
