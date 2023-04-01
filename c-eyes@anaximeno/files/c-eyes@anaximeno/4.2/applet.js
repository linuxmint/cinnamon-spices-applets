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
const Gettext = imports.gettext;

const SignalManager = imports.misc.signalManager;
const { Atspi, GLib, Gio, St, Clutter } = imports.gi;

const { EyeModeFactory } = require("./eyeModes.js");
const { ClickAnimationModeFactory } = require("./clickAnimationModes.js");
const { Debouncer } = require("./helper.js");

const CLICK_DEBOUNCE_INTERVAL = 2;

const EYE_AREA_WIDTH = 28;
const EYE_AREA_HEIGHT = 16;

// NOTE: must keep in sync with metadata.uuid
const UUID = "c-eyes@anaximeno";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
	let locText = Gettext.dgettext(UUID, text);

	if (locText == text) {
		locText = window._(text);
	}

	return locText;
}

class Eye extends Applet.Applet {
	_get_icon_cached(dir, mode, click_type, color) {
		let key = `${dir}${mode}${click_type}${color}`;
		let path = `${dir}/icons/${mode}_${click_type}_${color}.svg`;

		if (this._file_mem_cache[key]) {
			return this._file_mem_cache[key];
		} else if (GLib.file_test(path, GLib.FileTest.IS_REGULAR)) {
			this._file_mem_cache[key] = Gio.icon_new_for_string(path);
			return this._file_mem_cache[key];
		} else {
			return null;
		}
	}

	_init_data_dir() {
		let data_dir = `${GLib.get_user_cache_dir()}/${this.metadata.uuid}`;

		if (GLib.mkdir_with_parents(`${data_dir}/icons`, 0o777) < 0)
			throw new Error(`Failed to create cache dir at ${data_dir}`);

		return data_dir;
	}

	_setup_settings(uuid, instanceId) {
		this.settings = new Settings.AppletSettings(this, uuid, instanceId);
		const settingsDebouncer = new Debouncer();

		const _settings = [
			{
				key: "eye-repaint-interval",
				value: "eye_repaint_interval",
				cb: settingsDebouncer.debounce((e) => this.set_active(true), 400),
			},
			{
				key: "fade-timeout",
				value: "fade_timeout",
				cb: settingsDebouncer.debounce((e) => this.on_property_updated(e), 400),
			},
			{
				key: "eye-mode",
				value: "eye_mode",
				cb: this.on_property_updated,
			},
			{
				key: "mouse-click-mode",
				value: "mouse_click_mode",
				cb: this.on_property_updated,
			},
			{
				key: "eye-line-width",
				value: "eye_line_width",
				cb: settingsDebouncer.debounce((e) => this.on_property_updated(e), 400),
			},
			{
				key: "eye-margin",
				value: "eye_margin",
				cb: settingsDebouncer.debounce((e) => this.on_property_updated(e), 400),
			},
			{
				key: "eye-clicked-color",
				value: "eye_clicked_color",
				cb: this.on_property_updated,
			},
			{
				key: "iris-clicked-color",
				value: "iris_clicked_color",
				cb: this.on_property_updated,
			},
			{
				key: "pupil-clicked-color",
				value: "pupil_clicked_color",
				cb: this.on_property_updated,
			},
			{
				key: "mouse-click-image-size",
				value: "mouse_click_image_size",
				cb: settingsDebouncer.debounce((e) => this.on_property_updated(e), 400),
			},
			{
				key: "mouse-click-enable",
				value: "mouse_click_enable",
				cb: this.on_mouse_click_enable_updated,
			},
			{
				key: "mouse-left-click-enable",
				value: "mouse_left_click_enable",
				cb: this.on_property_updated,
			},
			{
				key: "mouse-right-click-enable",
				value: "mouse_right_click_enable",
				cb: this.on_property_updated,
			},
			{
				key: "mouse-middle-click-enable",
				value: "mouse_middle_click_enable",
				cb: this.on_property_updated,
			},
			{
				key: "mouse-left-click-color",
				value: "mouse_left_click_color",
				cb: this.on_property_updated,
			},
			{
				key: "mouse-middle-click-color",
				value: "mouse_middle_click_color",
				cb: this.on_property_updated,
			},
			{
				key: "mouse-right-click-color",
				value: "mouse_right_click_color",
				cb: this.on_property_updated,
			},
			{
				key: "mouse-click-opacity",
				value: "mouse_click_opacity",
				cb: settingsDebouncer.debounce((e) => this.on_property_updated(e), 400),
			},
			{
				key: "click-animation-mode",
				value: "click_animation_mode",
				cb: null,
			},
			{
				key: "eye-activate-by-default",
				value: "eye_activate_by_default",
				cb: this.on_eye_activated_by_default_updated,
			},
			{
				key: "deactivate-on-fullscreen",
				value: "deactivate_on_fullscreen",
				cb: null,
			},
			{
				key: "eye-vertical-padding",
				value: "eye_vertical_padding",
				cb: settingsDebouncer.debounce(
					(e) => this.on_property_updated(e,
						{ eye_property_update: true, mouse_property_update: false })),
			},
		];

		_settings.forEach(
			s => this.settings.bind(s.key, s.value, s.cb ? (...args) => s.cb.call(this, ...args) : null)
		);
	}

	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);

		this.setAllowedLayout(Applet.AllowedLayout.BOTH);
		this._setup_settings(metadata.uuid, instanceId);

		this.metadata = metadata;
		this.data_dir = this._init_data_dir();
		this.img_dir = `${metadata.path}/../circle`;

		if (!Gio.File.new_for_path(this.img_dir).query_exists(null)) {
			this.img_dir = `${GLib.get_home_dir()}/.local/share/cinnamon/applets/${this.metadata.uuid}/circle`;
		}

		this.area = new St.DrawingArea();
		this.actor.add(this.area);

		this.signals = new SignalManager.SignalManager(null);
		this.signals.connect(global.screen, 'in-fullscreen-changed', this.on_fullscreen_changed, this);
		this._mouseListener = Atspi.EventListener.new(this._mouseCircleClick.bind(this));

		this._file_mem_cache = {};
		this._last_mouse_x = undefined;
		this._last_mouse_y = undefined;

		this.eye_activated = this.eye_activate_by_default;

		this.click_debounced = (new Debouncer()).debounce(this._clickAnimation.bind(this), CLICK_DEBOUNCE_INTERVAL);

		this.set_active(true);
		this.set_mouse_circle_property_update(false);
		this.set_mouse_circle_enable(this.mouse_click_show);
		this._update_tooltip();
	}

	get mouse_click_show() {
		return this.mouse_click_enable && this.eye_activated;
	}

	on_applet_removed_from_panel(deleteConfig) {
		this.destroy();
	}

	on_applet_clicked(event) {
		this.eye_activated = !this.eye_activated;

		if (this.mouse_click_enable) {
			this.set_mouse_circle_enable(this.mouse_click_show);
		}

		this.area.queue_repaint();
		this._update_tooltip();
	}

	on_property_updated(event, opts = { mouse_property_update: true, eye_property_update: true }) {
		if (opts.mouse_property_update)
			this.set_mouse_circle_property_update(true);
		if (opts.eye_property_update)
			this.setEyePropertyUpdate();
		this._update_tooltip();
	}

	on_mouse_click_enable_updated(event) {
		this.on_property_updated(event);
		this.set_mouse_circle_enable(this.mouse_click_show);
		this.area.queue_repaint();
	}

	on_eye_activated_by_default_updated(event) {
		this.on_property_updated(event);

		if (this.eye_activate_by_default) {
			this.eye_activated = this.eye_activate_by_default;
			this.set_mouse_circle_enable(this.mouse_click_show);
			this.area.queue_repaint();
		}
	}

	on_fullscreen_changed() {
		if (this.deactivate_on_fullscreen) {
			let monitor = global.screen.get_current_monitor();
			let inFullscreen = global.screen.get_monitor_in_fullscreen(monitor);
			this.set_mouse_circle_enable(!inFullscreen && this.mouse_click_show);
			this.set_active(!inFullscreen);
		}
	}

	destroy() {
		this.signals.disconnectAllSignals();
		this.set_mouse_circle_enable(false);
		this.set_active(false);
		this.area.destroy();
		this.settings.finalize();
	}

	set_active(enabled) {
		this.setEyePropertyUpdate();

		if (this._eye_update_handler) {
			Mainloop.source_remove(this._eye_update_handler);
			this._eye_update_handler = null;
		}

		this.signals.disconnect('repaint', this.area);

		if (enabled) {
			this.signals.connect(this.area, 'repaint', this._eyeDraw, this);

			this._eye_update_handler = Mainloop.timeout_add(
				this.eye_repaint_interval, this._eyeTimeout.bind(this)
			);

			this.area.queue_repaint();
		}
	}

	set_mouse_circle_property_update(checkCache = true) {
		this._mouse_circle_create_data_icon('left_click', this.mouse_left_click_color, checkCache);
		this._mouse_circle_create_data_icon('right_click', this.mouse_right_click_color, checkCache);
		this._mouse_circle_create_data_icon('middle_click', this.mouse_middle_click_color, checkCache);
	}

	setEyePropertyUpdate() {
		this.area.set_width(EYE_AREA_WIDTH + 2 * this.eye_margin);
		this.area.set_height(EYE_AREA_HEIGHT);
		this.area.queue_repaint();
	}

	set_mouse_circle_enable(enabled) {
		if (enabled == null) {
			enabled = this.mouse_click_show;
		}

		this._mouseListener.deregister('mouse');

		if (enabled) {
			this.set_mouse_circle_property_update(true);
			this._mouseListener.register('mouse');
		}
	}

	_update_tooltip() {
		let complement = this.mouse_click_enable ? _("effects enabled") : _("effects disabled");

		if (this.eye_activated) {
			this.set_applet_tooltip(_("Click to deactivate") + ` (${complement})`);
		} else {
			this.set_applet_tooltip(_("Click to activate") + ` (${complement})`);
		}
	}

	_mouse_circle_create_data_icon(name, color, checkCache) {
		if (checkCache && this._get_icon_cached(this.data_dir, this.mouse_click_mode, name, color))
			return;

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

	_clickAnimation(clickType, color) {
		let icon = this._get_icon_cached(this.data_dir, this.mouse_click_mode, clickType, color);

		if (icon) {
			let options = {
				icon_size: this.mouse_click_image_size,
				opacity: this.mouse_click_opacity,
				timeout: this.fade_timeout
			};

			ClickAnimationModeFactory
				.createClickAnimationMode(this.click_animation_mode)
				.animateClick(icon, options);
		}
	}

	_eyeDraw(area) {
		const foreground_color = this.area.get_theme_node().get_foreground_color();

		let options = {
			eye_color: foreground_color,
			iris_color: foreground_color,
			pupil_color: foreground_color,
			line_width: this.eye_line_width,
			is_eye_active: this.eye_activated,
			padding: this.eye_vertical_padding,
		};

		if (this.eye_activated) {
			let [ok, color] = Clutter.Color.from_string(this.eye_clicked_color);
			options.eye_color = ok ? color : options.eye_color;

			[ok, color] = Clutter.Color.from_string(this.iris_clicked_color);
			options.iris_color = ok ? color : options.iris_color;

			[ok, color] = Clutter.Color.from_string(this.pupil_clicked_color);
			options.pupil_color = ok ? color : options.pupil_color;
		}

		EyeModeFactory.createEyeMode(this, this.eye_mode).drawEye(area, options);
	}

	_mouseCircleClick(event) {
		switch (event.type) {
			case 'mouse:button:1p':
				if (this.mouse_left_click_enable)
					this.click_debounced('left_click', this.mouse_left_click_color);
				break;
			case 'mouse:button:2p':
				if (this.mouse_middle_click_enable)
					this.click_debounced('middle_click', this.mouse_middle_click_color);
				break;
			case 'mouse:button:3p':
				if (this.mouse_right_click_enable)
					this.click_debounced('right_click', this.mouse_right_click_color);
				break;
		}
	}

	_eyeTimeout() {
		let [mouse_x, mouse_y, mask] = global.get_pointer();

		if (mouse_x !== this._last_mouse_x || mouse_y !== this._last_mouse_y) {
			this._last_mouse_x = mouse_x;
			this._last_mouse_y = mouse_y;
			this.area.queue_repaint();
		}

		return true;
	}
}

function main(metadata, orientation, instanceId) {
	return new Eye(metadata, orientation, instanceId);
}
