// The pocket: a popup anchored to the pocket button that holds the hidden
// tray icons.
//
// Opens on click, or on hover after "hover-delay" ms; in hover mode it
// closes "close-delay" ms after the pointer left both button and popup.
// Icons are put into `box` by the applet (see PocketTrayApplet.placeIcon).

const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;

// Value of the "open-trigger" setting that enables hover mode.
const OPEN_ON_HOVER = "hover";

var Pocket = class Pocket {
    // applet: the PocketTrayApplet (owner of the popup, orientation)
    // config: settings object with openTrigger, hoverDelay, closeDelay
    // button: the PocketButton the popup is anchored to
    constructor(applet, config, button) {
        this._config = config;
        this._button = button;
        this._hoverOpenId = 0;
        this._hoverCloseId = 0;

        // Container for the hidden icons
        this.box = new St.BoxLayout({ vertical: applet.isVertical() });

        this._menu = new Applet.AppletPopupMenu(applet, applet.orientation);
        // PopupMenu centres itself on sourceActor and keeps itself on the
        // monitor; anchor it to the button rather than the whole applet.
        this._menu.sourceActor = button.actor;
        this._menuManager = new PopupMenu.PopupMenuManager(applet);
        this._menuManager.addMenu(this._menu);

        const item = new PopupMenu.PopupBaseMenuItem({ reactive: false, activate: false });
        item.addActor(this.box, { expand: true });
        this._menu.addMenuItem(item);

        // Signals on actors owned by this object go away with them.
        this._menu.connect("open-state-changed", (menu, open) => button.setOpen(open));
        this._menu.actor.connect("enter-event", () => this._cancelHoverClose());
        this._menu.actor.connect("leave-event", () => this._scheduleHoverClose());
        button.actor.connect("clicked", () => this._onButtonClicked());
        button.actor.connect("enter-event", () => this._scheduleHoverOpen());
        button.actor.connect("leave-event", () => this._scheduleHoverClose());
    }

    get isOpen() {
        return this._menu.isOpen;
    }

    close() {
        this._cancelHoverOpen();
        this._cancelHoverClose();
        if (this._menu.isOpen) {
            this._menu.close(false);
        }
    }

    // Closes the pocket if `actor` lives in it. Used before a click is
    // forwarded to an application: the popup's modal grab would otherwise
    // block the menu the application opens.
    closeIfContains(actor) {
        if (actor.get_parent() === this.box) {
            this.close();
        }
    }

    // Shows the button only while the pocket holds a visible icon (XApp
    // icons can be hidden by their application), and closes an empty pocket.
    updateVisibility() {
        const hasIcons = this.box.get_children().some((child) => child.visible);
        this._button.actor.visible = hasIcons;
        if (!hasIcons) {
            this.close();
        }
    }

    setVertical(vertical) {
        this.box.set_vertical(vertical);
    }

    destroy() {
        this.close();
        this._menu.destroy();
    }

    // ------------------------------------------------------------------
    // Click and hover
    // ------------------------------------------------------------------
    _onButtonClicked() {
        this._cancelHoverOpen();
        this._menu.toggle();
    }

    _scheduleHoverOpen() {
        if (this._config.openTrigger !== OPEN_ON_HOVER) return;
        this._cancelHoverClose();
        if (this._menu.isOpen || this._hoverOpenId > 0) return;

        this._hoverOpenId = Mainloop.timeout_add(this._config.hoverDelay, () => {
            this._hoverOpenId = 0;
            this._menu.open();
            return GLib.SOURCE_REMOVE;
        });
    }

    _scheduleHoverClose() {
        this._cancelHoverOpen();
        if (this._config.openTrigger !== OPEN_ON_HOVER || !this._menu.isOpen) return;
        this._cancelHoverClose();

        this._hoverCloseId = Mainloop.timeout_add(this._config.closeDelay, () => {
            this._hoverCloseId = 0;
            this._menu.close();
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelHoverOpen() {
        if (this._hoverOpenId > 0) {
            Mainloop.source_remove(this._hoverOpenId);
            this._hoverOpenId = 0;
        }
    }

    _cancelHoverClose() {
        if (this._hoverCloseId > 0) {
            Mainloop.source_remove(this._hoverCloseId);
            this._hoverCloseId = 0;
        }
    }
};
