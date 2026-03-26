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
const Gettext = imports.gettext;
const SignalManager = imports.misc.signalManager;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const { UUID } = require("./constants.js");


Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");


function _(text) {
	let loc = Gettext.dgettext(UUID, text);
	return loc != text ? loc : window._(text);
}


const {
	PanelColorTweakController,
	PanelShadowTweakController,
	PanelBorderTweakController,
} = require('./settingsController.js');


class PanelTweaksApplet extends Applet.IconApplet {
	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);
		this.metadata = metadata;
		this.settings = this._setup_applet_settings(metadata.uuid, instanceId);
		this.signalsManager = new SignalManager.SignalManager(null);
		this.iconPath = `${metadata.path}/../icons/panel-tweaks-icon-symbolic.svg`

		// --> declare panel settings controllers

		this.panelSettingsControllers = [
			new PanelColorTweakController(
				this,
				this.settings,
				["panel-background-color"],
				"enable-panel-background-color-tweak"
			),
			new PanelShadowTweakController(
				this,
				this.settings,
				[
					"panel-shadow-x-axis-shift",
					"panel-shadow-y-axis-shift",
					"panel-shadow-bluriness",
					"panel-shadow-color",
				],
				"enable-panel-shadow-tweak",
			),
			new PanelBorderTweakController(
				this,
				this.settings,
				[
					"panel-border-top-thickness",
					"panel-border-right-thickness",
					"panel-border-bottom-thickness",
					"panel-border-left-thickness",
					"panel-border-color",
				],
				"enable-panel-border-tweak",
			),
		];

		// <-- declare panel settings controllers

		this.update_panel_applet_ui_state();
	}

	_setup_applet_settings(uuid, instanceId) {
		const settings = new Settings.AppletSettings(this, uuid, instanceId);

		const bindings = [
			// {
			// 	key: "",
			// 	value: "",
			// 	cb: () => {}
			// },
		];

		bindings.forEach(s => settings.bind(
			s.key,
			s.value,
			s.cb ? (...args) => s.cb.call(this, ...args) : null
		));

		return settings;
	}

	on_applet_clicked(event) {
		this.configureApplet();
	}

	on_applet_removed_from_panel(deleteConfig) {
		this.destroy();
	}

	update_panel_applet_ui_state() {
		this.set_applet_icon_symbolic_path(this.iconPath);
		this.set_applet_tooltip(_(this.metadata.name), false);
	}

	finalize_panel_settings_controllers() {
		this.panelSettingsControllers.reverse(); // Finalize in the reverse order of initialization.
		this.panelSettingsControllers.forEach(s => s.finalize());
		this.panelSettingsControllers = [];
	}

	destroy() {
		this.signalsManager.disconnectAllSignals();
		this.finalize_panel_settings_controllers();
		this.settings.finalize();
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new PanelTweaksApplet(metadata, orientation, panelHeight, instanceId);
}