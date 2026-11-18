/**
 * A black, click-through actor covering the whole stage (all monitors), drawn by Cinnamon's
 * compositor. Its opacity determines how much the screen is darkened.
 *
 * Fullscreen windows are covered too, because Cinnamon composites them by default. Users who
 * enable "Disable compositing for full-screen windows" opt out of that, and we respect it: the
 * Meta unredirect override is forbidden for third-party code on Spices.
 *
 * The actor paints but is never picked (see overlayActorClass), so it is invisible to both
 * input and drag and drop.
 *
 * Cinnamon dependencies (Clutter, GObject, global) are injected so this class can be
 * unit-tested in Node with fakes.
 */

// Keyed by the Clutter namespace, so each set of test fakes gets its own class.
const actorClasses = new WeakMap();

/**
 * Returns the overlay's actor class, registering it on first use.
 *
 * `reactive: false` only keeps an actor out of event picking (Clutter.PickMode.REACTIVE).
 * Cinnamon's drag and drop finds drop targets with Clutter.PickMode.ALL (js/ui/dnd.js), which
 * also returns non-reactive actors, so a plain fullscreen actor swallows every drop. Doing
 * nothing in vfunc_pick (and not chaining up) leaves the actor out of picking entirely.
 *
 * GType names must be unique per process, and reloading the applet re-evaluates this module,
 * so the name gets a per-evaluation suffix.
 *
 * @param {object} Clutter - imports.gi.Clutter
 * @param {object} GObject - imports.gi.GObject
 */
function overlayActorClass(Clutter, GObject) {
    let Actor = actorClasses.get(Clutter);
    if (!Actor) {
        Actor = GObject.registerClass(
            { GTypeName: `DarkerOverlayActor_${Date.now()}` },
            class extends Clutter.Actor {
                vfunc_pick(_context) {}
            },
        );
        actorClasses.set(Clutter, Actor);
    }
    return Actor;
}

var DarkOverlay = class DarkOverlay {
    /**
     * @param {object} deps
     * @param {object} deps.Clutter - imports.gi.Clutter
     * @param {object} deps.GObject - imports.gi.GObject
     * @param {object} deps.global - Cinnamon's global object
     */
    constructor({ Clutter, GObject, global }) {
        this._stage = global.stage;

        const Actor = overlayActorClass(Clutter, GObject);
        this._actor = new Actor({
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
};

// Cinnamon 6.8+ imports this file natively and exports its top-level `var` and `function`
// declarations; there, `module` is undefined. Node (tests) and Cinnamon 6.6's `require` use the
// CommonJS exports below.
if (typeof module === 'object' && module) {
    module.exports = { DarkOverlay };
}
