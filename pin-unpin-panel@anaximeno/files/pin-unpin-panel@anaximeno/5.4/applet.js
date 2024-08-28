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
const Panel = imports.ui.panel;
const Gettext = imports.gettext;
const SignalManager = imports.misc.signalManager;
const GLib = imports.gi.GLib;

const UUID = "pin-unpin-panel@anaximeno";
// XXX: Sync With Panel.PANEL_AUTOHIDE_KEY. Not using that directly because
// the ES6 standard doesn't support direct import of values declared with const or let
// from modules.
const PANEL_AUTOHIDE_KEY = "panels-autohide";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
	let loc = Gettext.dgettext(UUID, text);
	return loc != text ? loc : window._(text);
}


class PinUnpinPanelApplet extends Applet.IconApplet {
	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);
		this.metadata = metadata;
		this.settings = this._setup_settings(metadata.uuid, instanceId);

		this.pinned = true;

		this.signalsManager = new SignalManager.SignalManager(null);
        this.signalsManager.connect(global.settings, "changed::" + PANEL_AUTOHIDE_KEY, this.on_panels_autohide_state_changed, this);

		this.default_pin_icon_path = `${metadata.path}/../icons/pin-symbolic.svg`;
		this.default_unpin_icon_path = `${metadata.path}/../icons/unpin-symbolic.svg`;

		this.on_panels_autohide_state_changed();
	}

	_setup_settings(uuid, instanceId) {
		const settings = new Settings.AppletSettings(this, uuid, instanceId);

		const bindings = [
			{
				key: 'unpin-autohide-type',
				value: 'unpin_autohide_type',
				cb: this.on_applet_autohide_type_settings_changed,
			},
			{
				key: 'use-custom-icons',
				value: 'use_custom_icons',
				cb: this.update_panel_applet_ui_state,
			},
			{
				key: 'pin-icon',
				value: 'custom_pin_icon',
				cb: this.update_panel_applet_ui_state,
			},
			{
				key: 'unpin-icon',
				value: 'custom_unpin_icon',
				cb: this.update_panel_applet_ui_state,
			},
		];

		bindings.forEach(s => settings.bind(s.key, s.value, s.cb ? (...args) => s.cb.call(this, ...args) : null));

		return settings;
	}

	on_applet_clicked(event) {
		this.pinned = !this.pinned;
		this.set_panel_autohide_state(this.pinned ? false : this.unpin_autohide_type);
		global.log(UUID, `Panel ${this.panel.panelId} was ${this.pinned ? "pinned" : "unpinned"}`);
	}

	on_applet_removed_from_panel(deleteConfig) {
		this.destroy();
	}

	on_panels_autohide_state_changed() {
		const autohideState = this.get_panel_autohide_state();
		this.pinned = !autohideState || autohideState == 'false';
		this.update_panel_applet_ui_state();
	}

	on_applet_autohide_type_settings_changed() {
		if (!this.pinned) this.set_panel_autohide_state(this.unpin_autohide_type);
	}

	update_panel_applet_ui_state() {
		if (this.use_custom_icons) {
			this.set_applet_icon_name(this.pinned ? this.custom_unpin_icon : this.custom_pin_icon);
		} else {
			this.set_applet_icon_symbolic_path(this.pinned ? this.default_unpin_icon_path : this.default_pin_icon_path);
		}

		this.set_applet_tooltip(this.pinned ? _("Click to Unpin the Panel") : _("Click to Pin the Panel"));
	}

	get_panel_autohide_state() {
		const panelAutohideStates = global.settings.get_strv(PANEL_AUTOHIDE_KEY);

		if (!panelAutohideStates) return undefined;

		for (const panelAutohideState of panelAutohideStates) {
			let [panelId, autohideState] = panelAutohideState.split(":");

			if (panelId == this.panel.panelId)
				return autohideState;
		}

		return undefined;
	}

	set_panel_autohide_state(state) {
		const newStates = [];
		const panelAutohideStates = global.settings.get_strv(PANEL_AUTOHIDE_KEY);

		if (!panelAutohideStates) return;

		for (const panelAutohideState of panelAutohideStates) {
			let [panelId, autohideState] = panelAutohideState.split(":");

			if (panelId == this.panel.panelId)
				autohideState = state;

			newStates.push([panelId, autohideState].join(":"));
		}

		global.settings.set_strv(PANEL_AUTOHIDE_KEY, newStates);
	}

	destroy() {
		this.signalsManager.disconnectAllSignals();
		this.settings.finalize();
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new PinUnpinPanelApplet(metadata, orientation, panelHeight, instanceId);
}