/* clickAnimationModes.js
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
const Tweener = imports.ui.tweener;
const St = imports.gi.St;

class ClickAnimationMode {
    constructor() { }

    /**
     * Animates the click into the screen
     * @param {GIcon} icon The icon that will be animated
     * @param {Object} options Additional options used while during the animation
     */
    animateClick(icon, options) {
        // Implemented by sub-classes
    }
}

class ExpansionClickAnimationMode extends ClickAnimationMode {
    animateClick(icon, options) {
        let actor_scale = options.icon_size > 20 ? 1.5 : 3;
        let [mouse_x, mouse_y, _] = global.get_pointer();

        let actor = new St.Icon({
            x: mouse_x - (options.icon_size / 2),
            y: mouse_y - (options.icon_size / 2),
            reactive: false,
            can_focus: false,
            track_hover: false,
            icon_size: options.icon_size,
            opacity: options.opacity,
            gicon: icon
        });

        Main.uiGroup.add_child(actor);

        Tweener.addTween(actor, {
            opacity: 0,
            x: mouse_x - (options.icon_size * actor_scale / 2),
            y: mouse_y - (options.icon_size * actor_scale / 2),
            scale_x: actor_scale,
            scale_y: actor_scale,
            time: options.timeout / 1000,
            transition: "easeOutQuad",
            onComplete: () => {
                Main.uiGroup.remove_child(actor);
                actor.destroy();
                actor = null;
            },
            onCompleteScope: this
        });
    }
}

class RetractionClickAnimationMode extends ClickAnimationMode {
    animateClick(icon, options) {
        let [mouse_x, mouse_y, _] = global.get_pointer();

        let actor = new St.Icon({
            x: mouse_x - (options.icon_size / 2),
            y: mouse_y - (options.icon_size / 2),
            reactive: false,
            can_focus: false,
            track_hover: false,
            icon_size: options.icon_size,
            opacity: options.opacity,
            gicon: icon
        });

        Main.uiGroup.add_child(actor);

        Tweener.addTween(actor, {
            opacity: 0,
            x: mouse_x,
            y: mouse_y,
            scale_x: 0,
            scale_y: 0,
            time: options.timeout / 1000,
            transition: "easeOutQuad",
            onComplete: () => {
                Main.uiGroup.remove_child(actor);
                actor.destroy();
                actor = null;
            },
            onCompleteScope: this
        });
    }
}

class BounceBackClickAnimationMode extends ClickAnimationMode {
    animateClick(icon, options) {
        let [mouse_x, mouse_y, _] = global.get_pointer();

        let actor = new St.Icon({
            x: mouse_x,
            y: mouse_y,
            scale_x: 0,
            scale_y: 0,
            reactive: false,
            can_focus: false,
            track_hover: false,
            icon_size: options.icon_size,
            opacity: 0,
            gicon: icon
        });

        Main.uiGroup.add_child(actor);

        Tweener.addTween(actor, {
            x: mouse_x - (options.icon_size / 2),
            y: mouse_y - (options.icon_size / 2),
            scale_x: 1,
            scale_y: 1,
            opacity: options.opacity,
            time: options.timeout / 2000 - 0.025, /* = (((timeout - 50) / 1000) / 2) */
            transition: "easeOutQuad",
            onComplete: () => {
                Tweener.addTween(actor, {
                    opacity: 0,
                    x: mouse_x,
                    y: mouse_y,
                    scale_x: 0,
                    scale_y: 0,
                    time: options.timeout / 2000 + 0.025, /* = (((timeout + 50) / 1000) / 2) */
                    transition: "easeOutQuad",
                    onComplete: () => {
                        Main.uiGroup.remove_child(actor);
                        actor.destroy();
                        actor = null;
                    },
                    onCompleteScope: this
                });
            },
            onCompleteScope: this
        });
    }
}

class BlinkClickAnimationMode extends ClickAnimationMode {
    animateClick(icon, options) {
        let [mouse_x, mouse_y, _] = global.get_pointer();

        let actor = new St.Icon({
            x: mouse_x - (options.icon_size / 2),
            y: mouse_y - (options.icon_size / 2),
            reactive: false,
            can_focus: false,
            track_hover: false,
            icon_size: options.icon_size,
            opacity: options.opacity,
            gicon: icon
        });

        Main.uiGroup.add_child(actor);

        Tweener.addTween(actor, {
            opacity: 0,
            time: options.timeout / 1000,
            transition: "easeOutQuad",
            onComplete: () => {
                Main.uiGroup.remove_child(actor);
                actor.destroy();
                actor = null;
            },
            onCompleteScope: this
        });
    }
}

class ClickAnimationModeFactory {
    /**
     * Returns an click animation mode depending on the given name
     * @param {String} mode Click Animation mode name to create
     * @returns ClickAnimationMode subclass
     */
    static createClickAnimationMode(mode) {
        switch (mode) {
            case "bounce-back":
                return new BounceBackClickAnimationMode();
            case "retract":
                return new RetractionClickAnimationMode();
            case "expand":
                return new ExpansionClickAnimationMode();
            case "blink":
            default:
                return new BlinkClickAnimationMode();
        }
    }
}
