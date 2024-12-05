/* settingsController.js
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

const Params = imports.misc.params;
const { basicStylesEncoder, basicStylesDecoder, round } = require("./helpers.js");
const { STYLE_TWEAK_UNSET_KEY } = require("./constants.js");


var PanelTweakController = class PanelTweakController {
    constructor(applet, settings, keys, enablerKey) {
        this.applet = applet;
        this.settings = settings;
        this.keys = keys;
        this.enablerKey = enablerKey;

        if (enablerKey) {
            this.settings.bind(
                this.enablerKey,
                this.enablerKey.replaceAll('-', '_'),
                this.on_enabler_switched.bind(this),
            );
        }

        if (this.enabled) this.start();
    }

    get values() {
        let values = [];
        for (const key of this.keys)
            values.push(this.settings.getValue(key));
        return values;
    }

    get valuesKeysMapped() {
        let values = {};
        for (const key of this.keys)
            values[key] = this.settings.getValue(key);
        return values;
    }

    get enabled() {
        return this.enablerKey ? this.settings.getValue(this.enablerKey) : true;
    }

    get_panel_style() {
        return basicStylesDecoder(this.applet.panel.actor.get_style());
    }

    set_panel_style(styleObject) {
        let panelStyle = this.get_panel_style();
        let newStyle = Params.parse(styleObject, panelStyle, true);
        let encodedStyle = basicStylesEncoder(newStyle);
        this.applet.panel.actor.set_style(encodedStyle);
    }

    on_enabler_switched() {
        this.enabled ? this.start() : this.finalize();
    }

    start() {
        for (const key of this.keys) {
            this.settings.bind(
                key,
                key.replaceAll('-', '_'),
                this.on_changed.bind(this),
            );
        }
        this.on_changed();
    }

    finalize() {
        // Implemented downstream
    }

    on_changed() {
        // Implemented downstream
    }
}


var PanelColorTweakController = class PanelColorTweakController extends PanelTweakController {
    on_changed() {
        let [value] = this.values;
        this.set_panel_style({
            "background-color": value,
            "background-gradient-end": value,
            "background-gradient-start": value,
        });
    }

    finalize() {
        this.set_panel_style({
            "background-color": STYLE_TWEAK_UNSET_KEY,
            "background-gradient-end": STYLE_TWEAK_UNSET_KEY,
            "background-gradient-start": STYLE_TWEAK_UNSET_KEY,
        });
    }
}

var PanelShadowTweakController = class PanelShadowTweakController extends PanelTweakController {
    on_changed() {
        let values = this.valuesKeysMapped;
        let x = round(values["panel-shadow-x-axis-shift"], 2);
        let y = round(values["panel-shadow-y-axis-shift"], 2);
        let bluriness = round(values["panel-shadow-bluriness"], 2);
        let color = values["panel-shadow-color"];
        let shadow = `${x}px ${y}px ${bluriness}px ${color}`;
        this.set_panel_style({ "box-shadow": shadow });
    }

    finalize() {
        this.set_panel_style({ "box-shadow": STYLE_TWEAK_UNSET_KEY });
    }
}

var PanelBorderTweakController = class PanelBorderTweakController extends PanelTweakController {
    on_changed() {
        let values = this.valuesKeysMapped;
        let top = round(values["panel-border-top-thickness"], 2);
        let right = round(values["panel-border-right-thickness"], 2);
        let bottom = round(values["panel-border-bottom-thickness"], 2);
        let left = round(values["panel-border-left-thickness"], 2);
        let color = values["panel-border-color"];
        this.set_panel_style({
            "border-top": `${top}px`,
            "border-right": `${right}px`,
            "border-bottom": `${bottom}px`,
            "border-left": `${left}px`,
            "border-color": color,
        });
    }

    finalize() {
        this.set_panel_style({
            "border-top": STYLE_TWEAK_UNSET_KEY,
            "border-right": STYLE_TWEAK_UNSET_KEY,
            "border-bottom": STYLE_TWEAK_UNSET_KEY,
            "border-left": STYLE_TWEAK_UNSET_KEY,
            "border-color": STYLE_TWEAK_UNSET_KEY,
        });
    }
}