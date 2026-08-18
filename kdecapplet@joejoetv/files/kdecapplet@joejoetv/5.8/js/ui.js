const PopupMenu = require('ui.popupMenu');
const Tooltips = require('ui.tooltips');
const St = require('gi.St');
const Clutter = require('gi.Clutter');
const GObject = require('gi.GObject');
const Params = require('misc.params');
const MessageTray = require('ui.messageTray');

const Logging = require("./js/logging.js");
const Utils = require("./js/utils.js");

const MenuItemIconButton = GObject.registerClass({
    // The GTypeName must be unique, so we use the current timestamp here to avoid
    // exceptions at runtime when reloading the applet.
    GTypeName: `MenuItemIconButton_${Date.now()}`,
    Properties: {
        'icon-actor': GObject.ParamSpec.object(
            'icon-actor', 'icon-actor', 'Icon actor',
            GObject.ParamFlags.READWRITE,
            Clutter.Actor.$gtype
        ),
        'enabled': GObject.ParamSpec.boolean(
            'enabled', 'enabled', 'Enabled',
            GObject.ParamFlags.READWRITE,
            true
        ),
        'tooltip-text': GObject.ParamSpec.string(
            'tooltip-text', 'tooltip-text', 'Tooltip Text',
            GObject.ParamFlags.WRITABLE,
            ""
        ),
    },
    Signals: {
        'clicked': { param_types: [Clutter.ModifierType.$gtype] }
    }
}, class MenuItemIconButton extends St.Bin {
    #icon;
    #tooltip;
    #enabled;
    #signals;

    static LOGGER = new Logging.Logger(Utils.UUID, "MenuItemIconButton");

    /**
     * @param {object} params - Parameters for the widget.
     * @param {St.Icon} params.icon_actor - The icon actor to put in the button.
     */
    constructor(params) {
        params = Params.parse(params, {
            icon_actor: null,
            tooltip_text: null,
            enabled: true,
        });

        if (params.icon_actor === null) {
            throw new Error("icon_actor property is required!");
        }

        params.icon_actor.style_class = 'menu-item-button-icon';

        super({
            style_class: 'notification-icon-button menu-item-button',
            important: true,
            child: params.icon_actor,
            track_hover: params.enabled,
            hover: false,
            reactive: params.enabled,
            can_focus: params.enabled,
            x_expand: false,
            y_expand: false,
        });

        this.#icon = params.icon_actor;
        this.#tooltip = new Tooltips.Tooltip(this, params.tooltip_text);
        this.#enabled = params.enabled;

        this.#signals = [];
        this.#signals.push(this.connect("button-press-event", this.#onButtonPressEvent.bind(this)));
        this.#signals.push(this.connect("button-release-event", this.#onButtonReleaseEvent.bind(this)));
        this.#signals.push(this.connect("key-press-event", this.#onKeyPressEvent.bind(this)));
        this.#signals.push(this.connect("key-focus-in", this.#onKeyFocusIn.bind(this)));
        this.#signals.push(this.connect("key-focus-out", this.#onKeyFocusOut.bind(this)));
        this.#signals.push(this.connect("leave-event", this.#onLeaveEvent.bind(this)));

        this.#signals.push(this.connect("notify::hover", this.#onHoverChanged.bind(this)));

        this.#signals.push(this.connect("destroy", this.destroy.bind(this)));

        this.change_style_pseudo_class("hover", false);
        this.sync_hover();
        this.change_style_pseudo_class("active", false);
        this.change_style_pseudo_class("insensitive", !this.#enabled);

        MenuItemIconButton.LOGGER.debug(`constructor finish: enabled=${this.#enabled} pseudo_classes=${this.get_style_pseudo_class()}`);
    }

    #onHoverChanged(actor, event) {
        MenuItemIconButton.LOGGER.trace(`Hover changed: hover=${this.hover} pseudo_classes=${this.get_style_pseudo_class()}`);
    }

    #onButtonPressEvent(actor, event) {
        this.change_style_pseudo_class("active", true);
        return true;
    }

    #onButtonReleaseEvent(actor, event) {
        this.change_style_pseudo_class("active", false);
        return this.#activate(event);
    }

    #onKeyPressEvent(actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol === Clutter.KEY_space ||
            symbol === Clutter.KEY_Return ||
            symbol === Clutter.KEY_KP_Enter) {
            return this.#activate(event);
        }
        return false;
    }

    #onKeyFocusIn(actor) {
        if (!this.#enabled) return;

        this.hover = true;
        this.change_style_pseudo_class("hover", true);
        this.grab_key_focus();
    }

    #onKeyFocusOut(actor) {
        this.hover = false;
        this.change_style_pseudo_class("hover", false);
    }

    #onLeaveEvent(actor, event) {
        this.change_style_pseudo_class("active", false);
        return false;
    }

    #activate(event) {
        if (!this.#enabled) return false;
        
        MenuItemIconButton.LOGGER.debug(`Activated: enabled=${this.#enabled} pseudo_classes=${this.get_style_pseudo_class()}`);

        this.emit("clicked", event);
        return true;
    }

    set enabled(value) {
        this.#enabled = value;
        if (value) {
            this.track_hover = true;
            this.reactive = true;
            this.can_focus = true;

            this.#tooltip.preventShow = false;
        } else {
            this.track_hover = false;
            this.reactive = false;
            this.can_focus = false;
            this.hover = false;

            this.#tooltip.preventShow = true;
            this.#tooltip.hide();

            this.change_style_pseudo_class("hover", false);
            this.change_style_pseudo_class("active", false);
        }

        this.change_style_pseudo_class("insensitive", !value);
    }

    get enabled() {
        return this.#enabled;
    }

    set icon_actor(value) {
        this.#icon = value;
        this.child = value;
    }

    get icon_actor() {
        return this.#icon;
    }

    setTooltipText(text) {
        this.#tooltip.set_text(text);
    }

    destroy() {
        this.#signals.forEach(signal => {
            this.disconnect(signal);
        });
        this.#icon.destroy();
        this.#tooltip.destroy();
    }
});

/**
 * A pupup menu item that features an icon, a label and a small button which can be activated separately.
 */
class PopupMenuIconButtonItem extends PopupMenu.PopupBaseMenuItem {
    #label;
    #icon;
    #button;
    #buttonIcon;
    #tooltip;
    #keepMenuOnItemClick;

    /**
     * Type of activation (either by activating the menu item or the button).
     * @constant
     * @enum {number}
     */
    static ActivateType = {
        ITEM: 0,
        BUTTON: 1
    }

    static LOGGER = new Logging.Logger(Utils.UUID, "PopupMenuIconButtonItem");

    /**
     * @param {string} text The label text to show.
     * @param {string} iconName The name of the icon to display on the left.
     * @param {St.IconType} iconType The type of the icon to display on the left.
     * @param {string} buttonIconName The name of the icon to display in the button.
     * @param {St.IconType} buttonIconType The type of the icon to display in the button.
     * @param {object} params Additional optional options. Options irrelevant for this object are passed through to the parent class constructor.
     * @param {(string|null)} params.tooltip_text Text to show in the tooltip of the menu item, if any.
     * @param {(string|null)} params.button_tooltip_text Text to show in the tooltip of the button, if any.
     * @param {bool} params.keep_menu_item_click Whether to close the menu automatically, if the menu item is activated.
     */
    constructor(text, iconName, iconType, buttonIconName, buttonIconType, params) {
        let { tooltip_text, button_tooltip_text, keep_menu_item_click, ...super_params} = Params.parse(
            params,
            {
                tooltip_text: null,
                button_tooltip_text: null,
                keep_menu_item_click: false,
            },
            true
        );

        super_params.style_class = "menu-icon-button-item"

        super(super_params);

        this.#keepMenuOnItemClick = keep_menu_item_click;

        this.#label = new St.Label({ text: text });
        this.actor.label_actor = this.#label;

        this.#icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_name: iconName,
            icon_type: iconType
        });

        this.#buttonIcon = new St.Icon({
            icon_name: buttonIconName,
            icon_type: buttonIconType,
            y_expand: true,
        })

        this.#button = new MenuItemIconButton({
            icon_actor: this.#buttonIcon,
            tooltip_text: button_tooltip_text,
        });

        this.#tooltip = new Tooltips.Tooltip(this.actor, tooltip_text);

        this._signals.connect(this.#button, 'clicked', this.#onButtonClicked.bind(this));
        this._signals.connect(this.#button, 'notify::hover', this.#onButtonHoverChanged.bind(this));

        this.addActor(this.#icon, { span: 0 });
        this.addActor(this.#label);
        this.addActor(this.#button, { span: 0 });

        PopupMenuIconButtonItem.LOGGER.debug(`constructor finish`);
    }

    #onButtonClicked(event) {
        PopupMenuIconButtonItem.LOGGER.debug("Button was clicked");
        this.activate(event, false, PopupMenuIconButtonItem.ActivateType.BUTTON);
    }

    #onButtonHoverChanged(actor) {
        PopupMenuIconButtonItem.LOGGER.trace(`Hover of button changed: ${actor.hover}`);

        if (actor.hover) {
            // If the button is being hovered over
            this.#tooltip.preventShow = true;
            this.setActive(false);
        } else {
            this.#tooltip.preventShow = false;
            this.setActive(this.actor.hover);
        }
    }

    _onButtonReleaseEvent(actor, event) {
        if (!this.#button.enabled || !this.#button.hover) {
            PopupMenuIconButtonItem.LOGGER.debug("Item was activated by clicking");
            this.activate(event, this.#keepMenuOnItemClick, PopupMenuIconButtonItem.ActivateType.ITEM);
            return true;
        }
        return false;
    }

    _onKeyPressEvent(actor, event) {
        let symbol = event.get_key_symbol();

        PopupMenuIconButtonItem.LOGGER.trace(`Key press event occured: ${symbol}`);

        // If the button is enabled and currently focused/being hovered,
        // we don't want to activate the menu item
        if (this.#button.enabled && this.#button.hover)
            return false;

        if (symbol === Clutter.KEY_space ||
            symbol === Clutter.KEY_Return ||
            symbol === Clutter.KEY_KP_Enter) {
            PopupMenuIconButtonItem.LOGGER.debug("Item was activated by key press");
            this.activate(event, this.#keepMenuOnItemClick, PopupMenuIconButtonItem.ActivateType.ITEM);
            return true;
        }
        return false;
    }

    _onHoverChanged(actor) {
        PopupMenuIconButtonItem.LOGGER.trace(`Hover changed: hover=${actor.hover} button.hover=${this.#button.hover} button.enabled=${this.#button.enabled}`);
        
        if (this.#button.enabled && this.#button.hover) {
            // The button is being hovered over (while active), so the menu item
            // should essentially act like it is not being hovered over/focused
            this.#tooltip.hide();
            this.#tooltip.preventShow = true;
            this.setActive(false);
            return;
        }

        this.#tooltip.preventShow = false;
        this.setActive(actor.hover);
    }

    activate(event, keepMenu = false, type = PopupMenuIconButtonItem.ActivateType.ITEM) {
        this.emit('activate', event, keepMenu, type);
    }

    destroy() {
        this._signals.disconnectAllSignals();
        this.actor.destroy();
        this.#button.destroy();
        this.#tooltip.destroy();
        this.emit('destroy');
    }

    set button_enabled(enabled) {
        this.#button.enabled = enabled;
    }

    get button_enabled() {
        return this.#button.enabled;
    }

    set label(text) {
        this.#label.set_text(text);
    }

    get label() {
        return this.#label.get_text();
    }

    setTooltipText(text) {
        this.#tooltip.set_text(text);
    }

    setButtonTooltipText(text) {
        this.#button.setTooltipText(text);
    }
}

/**
 * @classdesc Notification Source for the applet
 */
class AppletNotificationSource extends MessageTray.Source {
    constructor() {
        super(Utils.APPLET_NAME);

        this._setSummaryIcon(this.createNotificationIcon());
    }

    createNotificationIcon() {
        return new St.Icon({
            icon_name: Utils.KDECONNECT_APP_ID,
            icon_type: St.IconType.APPLICATION,
            icon_size: this.ICON_SIZE
        });
    }

    open() {
        this.destroy();
    }
}