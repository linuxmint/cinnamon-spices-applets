/**
 * A black, click-through actor covering the whole stage (all monitors), drawn by Cinnamon's
 * compositor. Its opacity determines how much the screen is darkened.
 *
 * Fullscreen windows are covered too, because Cinnamon composites them by default. Users who
 * enable "Disable compositing for full-screen windows" opt out of that, and we respect it: the
 * Meta unredirect override is forbidden for third-party code on Spices.
 *
 * Cinnamon dependencies (Clutter, global) are injected so this class can be unit-tested in
 * Node with fakes.
 */
class DarkOverlay {
    /**
     * @param {object} deps
     * @param {object} deps.Clutter - imports.gi.Clutter
     * @param {object} deps.global - Cinnamon's global object
     */
    constructor({ Clutter, global }) {
        this._stage = global.stage;

        this._actor = new Clutter.Actor({
            name: 'darker-overlay',
            reactive: false,
            visible: false,
            opacity: 0,
            background_color: new Clutter.Color({ red: 0, green: 0, blue: 0, alpha: 255 }),
        });
        // Follow the stage size so monitor/resolution changes are handled automatically.
        this._actor.add_constraint(
            new Clutter.BindConstraint({
                source: this._stage,
                coordinate: Clutter.BindCoordinate.ALL,
                offset: 0,
            }),
        );

        // Direct child of the stage, above uiGroup (windows, panels, menus) and top_window_group.
        this._stage.add_child(this._actor);
        // Stay topmost if anything else is added to the stage later. Cinnamon's Clutter is
        // older than upstream: the signal is ClutterContainer's 'actor-added', not 'child-added'.
        this._actorAddedId = this._stage.connect('actor-added', () => this._raise());
    }

    /**
     * @param {number} opacity - Clutter opacity, integer 0..255; 0 hides the overlay
     */
    setOpacity(opacity) {
        if (!this._actor) return;

        this._actor.opacity = opacity;
        if (opacity > 0) {
            this._raise();
            this._actor.show();
        } else {
            this._actor.hide();
        }
    }

    /** Removes the overlay. Safe to call more than once. */
    destroy() {
        if (!this._actor) return;

        this._stage.disconnect(this._actorAddedId);
        this._actor.destroy();
        this._actor = null;
    }

    _raise() {
        this._stage.set_child_above_sibling(this._actor, null);
    }
}

module.exports = { DarkOverlay };
