const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const { Clutter, GLib } = imports.gi;

// Cinnamon resolves xlet require() paths relative to the applet root, not the calling file.
const Darkness = require('./lib/darkness.js');
const { DarkOverlay } = require('./lib/overlay.js');

const UUID = 'darker@chris-lep';
const ICON_NAME = 'xsi-display-brightness-symbolic';

// Translations are installed per user by Cinnamon (from po/, when installed from Spices).
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + '/locale');

function _(text) {
    return Gettext.dgettext(UUID, text);
}

// The stock slider scrolls by 5% of its span, which is off the applet's 5% brightness grid
// (the slider only spans 10..100%). Route its scroll events through the applet so scrolling
// over the slider and over the panel icon behave the same.
class DarknessSlider extends PopupMenu.PopupSliderMenuItem {
    constructor(onScroll) {
        super(1);
        this._onScroll = onScroll;
    }

    _onScrollEvent(_actor, event) {
        return this._onScroll(event);
    }
}

class DarkerApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.set_applet_icon_symbolic_name(ICON_NAME);
        this._overlay = new DarkOverlay({ Clutter, global });

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._slider = new DarknessSlider((event) => this._onScroll(event));
        this._slider.connect('value-changed', (_slider, value) =>
            this._setLevel(Darkness.sliderToLevel(value)),
        );
        this.menu.addMenuItem(this._slider);

        const resetItem = new PopupMenu.PopupMenuItem(Darkness.resetLabel(_));
        resetItem.connect('activate', () => this._setLevel(0));
        this.menu.addMenuItem(resetItem);

        this.actor.connect('scroll-event', (_actor, event) => this._onScroll(event));

        // Always start undarkened.
        this._setLevel(0);
    }

    _setLevel(level) {
        this._level = Darkness.clampLevel(level);
        this._overlay.setOpacity(Darkness.levelToOpacity(this._level));
        this._slider.setValue(Darkness.levelToSlider(this._level));
        this.set_applet_label(Darkness.panelLabel(this._level, _));
        this.set_applet_tooltip(Darkness.tooltipText(this._level, _));
    }

    _onScroll(event) {
        const steps = Darkness.scrollSteps(event.get_scroll_direction(), Clutter.ScrollDirection);
        if (steps === 0) return Clutter.EVENT_PROPAGATE;

        this._setLevel(Darkness.stepLevel(this._level, steps));
        return Clutter.EVENT_STOP;
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._overlay.destroy();
        this.menu.destroy();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new DarkerApplet(metadata, orientation, panelHeight, instanceId);
}
