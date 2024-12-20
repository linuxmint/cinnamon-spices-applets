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

const Main = imports.ui.main;
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
		this.instanceId = instanceId;
		this.metadata = metadata;

		this.settings = this._setup_settings(metadata.uuid, instanceId);

		this.pinned = true;

		this.signalsManager = new SignalManager.SignalManager(null);
		this.signalsManager.connect(global.settings, "changed::" + PANEL_AUTOHIDE_KEY, this.on_panels_autohide_state_changed, this);

		this._default_pin_icon_path = `${metadata.path}/../icons/pin-symbolic.svg`;
		this._default_unpin_icon_path = `${metadata.path}/../icons/unpin-symbolic.svg`;

		this._toggle_panel_pin_binding_id = `${metadata.uuid}-toggle-panel-pin-binding-keys-${this.instanceId}`;
		this._panel_peek_binding_id = `${metadata.uuid}-peek-panel-bindind-keys-${this.instanceId}`;

		this.set_toggle_panel_pin_keydind();
		this.set_peek_panek_keybind();
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
				key: 'pinned-at-startup',
				value: 'pinned_at_startup',
				cb: null,
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
			{
				key: 'toggle-panel-pin-binding-keys',
				value: 'toggle_panel_pin_binding_keys',
				cb: this.set_toggle_panel_pin_keydind,
			},
			{
				key: 'peek-panel-bindind-keys',
				value: 'peek_panel_bindind_keys',
				cb: this.set_peek_panek_keybind,
			},
		];

		bindings.forEach(s => settings.bind(s.key, s.value, s.cb ? (...args) => s.cb.call(this, ...args) : null));

		return settings;
	}

	on_applet_clicked(event) {
		this.toggle_panel_pin_state();
	}

	on_applet_added_to_panel(userEnabled) {
		//~ global.log(UUID+": instance "+this.instanceId);
		if (this.pinned_at_startup !== 0 && (this.pinned_at_startup === 1) !== this.pinned) {
			this.toggle_panel_pin_state();
		}
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

	toggle_panel_pin_state() {
		this.pinned = !this.pinned;
		this.set_panel_autohide_state(this.pinned ? false : this.unpin_autohide_type);
		global.log(UUID, `Panel ${this.panel.panelId} was ${this.pinned ? "pinned" : "unpinned"}`);
	}

	update_panel_applet_ui_state() {
		let icon = this.pinned ? this._default_unpin_icon_path : this._default_pin_icon_path;

		if (this.use_custom_icons)
			icon = this.pinned ? this.custom_unpin_icon : this.custom_pin_icon;

		if (icon.endsWith('-symbolic')) this.set_applet_icon_symbolic_name(icon);
		else if (icon.endsWith('-symbolic.svg')) this.set_applet_icon_symbolic_path(icon);
		else if (icon.endsWith('.png')) this.set_applet_icon_path(icon);
		else this.set_applet_icon_name(icon);

		let tooltip = this.pinned ? _("Click to Unpin the Panel") : _("Click to Pin the Panel");
		this.set_applet_tooltip(tooltip);
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
		const panelAutohideStates = global.settings.get_strv(PANEL_AUTOHIDE_KEY);

		if (!panelAutohideStates) return;

		const newStates = [];
		for (const panelAutohideState of panelAutohideStates) {
			let [panelId, autohideState] = panelAutohideState.split(":");

			if (panelId == this.panel.panelId)
				autohideState = state;

			let newState = [panelId, autohideState].join(":");
			if (!newStates.includes(newState))
				newStates.push(newState);
		}

		global.settings.set_strv(PANEL_AUTOHIDE_KEY, newStates);
	}

	peek_panel() {
		this.panel.peekPanel();
	}

	set_toggle_panel_pin_keydind() {
		this.set_keybinding(
			this._toggle_panel_pin_binding_id,
			this.toggle_panel_pin_binding_keys,
			this.toggle_panel_pin_state.bind(this),
		);
	}

	set_peek_panek_keybind() {
		this.set_keybinding(
			this._panel_peek_binding_id,
			this.peek_panel_bindind_keys,
			this.peek_panel.bind(this),
		);
	}

	set_keybinding(id, keys, cb) {
		this.unset_keybinding(id);
		Main.keybindingManager.addHotKey(id, keys, cb);
	}

	unset_keybinding(id) {
		Main.keybindingManager.removeHotKey(id);
	}

	destroy() {
		this.signalsManager.disconnectAllSignals();
		this.settings.finalize();
		this.unset_keybinding(this._toggle_panel_pin_binding_id);
		this.unset_keybinding(this._panel_peek_binding_id);
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new PinUnpinPanelApplet(metadata, orientation, panelHeight, instanceId);
}
