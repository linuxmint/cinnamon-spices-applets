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
        this.signalsManager.connect(global.settings, "changed::" + Panel.PANEL_AUTOHIDE_KEY, this.on_panels_autohide_state_changed, this);

		this.on_panels_autohide_state_changed();
	}

	_setup_settings(uuid, instanceId) {
		const settings = new Settings.AppletSettings(this, uuid, instanceId);

		const bindings = [
			{
				key: 'unpin-autohide-type',
				value: 'unpin_autohide_type',
				cb: null,
			},
			{
				key: 'pin-icon',
				value: 'pin_icon',
				cb: null,
			},
			{
				key: 'unpin-icon',
				value: 'unpin_icon',
				cb: null,
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

	update_panel_applet_ui_state() {
		const icon_name = this.pinned ? this.unpin_icon : this.pin_icon;
		const tooltip = this.pinned ? _("Click to Unpin the Panel") : _("Click to Pin the Panel");
		this.set_applet_icon_symbolic_name(icon_name);
		this.set_applet_tooltip(tooltip);
	}

	get_panel_autohide_state() {
		const autohideStates = global.settings.get_strv(Panel.PANEL_AUTOHIDE_KEY);
		const autohideState = autohideStates ? autohideStates.find((v, i, arr) => v.split(":")[0] == this.panel.panelId) : undefined;
		return autohideState ? autohideState.split(':')[1] : undefined;
	}

	set_panel_autohide_state(state) {
		const newStates = [];
		const panelAutohideStates = global.settings.get_strv(Panel.PANEL_AUTOHIDE_KEY);

		for (let i = 0 ; i < panelAutohideStates.length ; i++) {
			let panelAutohideState = panelAutohideStates[i];
			let [panelId, autohideState] = panelAutohideState.split(":");

			if (panelId == this.panel.panelId)
				autohideState = state;

			newStates.push([panelId, autohideState].join(":"));
		}

		global.settings.set_strv(Panel.PANEL_AUTOHIDE_KEY, newStates);
		this.update_panel_applet_ui_state();
	}

	destroy() {
		this.signalsManager.disconnectAllSignals();
		this.settings.finalize();
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new PinUnpinPanelApplet(metadata, orientation, panelHeight, instanceId);
}