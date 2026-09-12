const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext;

const Me = imports.ui.appletManager.applets['BudsLink-Companion@maniacx.github.com'];
const {PopupMenuWidgetBox} = Me.lib.popupMenuWidget;

const _ = str => Gettext.dgettext('BudsLink-Companion@maniacx.github.com', str);

var PanelPopupMenu = class PanelPopupMenu extends PopupMenu.PopupBaseMenuItem {
    _init(settings, gIcon, path, alias, widgetInfo, dataHandler, menu, showPinButton) {
        super._init();
        this._settings = settings;

        this._gIcon = gIcon;
        this._path = path;
        this._alias = alias;
        this._widgetInfo = widgetInfo;
        this._dataHandler = dataHandler;
        this._showPinButton = showPinButton;
        this._menu = menu || null;
        this._isOpen = false;
        this.actor.add_style_class_name('bbm-submenu bbm-panel-popupmenuitem');
        this.actor.x_expand = true;
        this.actor.x_align = Clutter.ActorAlign.FILL;

        this._finalizeWidget();
    }

    _finalizeWidget() {
        this._vBox = new St.BoxLayout({vertical: true, x_expand: true, x_align: Clutter.ActorAlign.FILL});
        this.addActor(this._vBox, {expand: true, span: -1});

        this._hBox = new St.BoxLayout({x_expand: true});

        this._vBox.add_child(this._hBox);

        this._icon = new St.Icon({
            style_class: 'popup-menu-icon',
            gicon: this._gIcon(`bbm-${this._dataHandler.getConfig().commonIcon}-symbolic.svg`),
        });
        this._hBox.add_child(this._icon);

        this._label = new St.Label({
            text: this._alias, style_class: 'bbm-bt-widget',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._hBox.add_child(this._label);

        const expander = new St.Bin({x_expand: true, style: 'min-width: 18px'});
        this._hBox.add_child(expander);

        this._triangle =
             new St.Icon({icon_name: 'pan-down-symbolic', style_class: 'popup-menu-icon bbm-panel-expand-icon'});

        this._hBox.add_child(this._triangle);

        const colorInfo = {
            isDarkMode: this._widgetInfo.isDarkMode,
            accentColor: this._widgetInfo.accentColor,
            foregroundColor: this._widgetInfo.fgColor,
        };


        const headerButtons = {pin: this._showPinButton, btPair: false, collapse: true};
        this._popupItemBox = new PopupMenuWidgetBox(this._settings, this._gIcon, this._path,
            this._alias, this._widgetInfo, colorInfo, headerButtons, this._dataHandler);

        this._popupItemBox.visible = false;
        this._vBox.add_child(this._popupItemBox);

        this._updateAccesibleName();
        if (this._menu) {
            this._menu.connectObject('open-state-changed', (o, isOpen) => {
                if (!isOpen && this._menu._bbmOpenSubmenu) {
                    this._menu._bbmOpenSubmenu._toggleSubMenuBox(false, false, false);
                    this._menu._bbmOpenSubmenu = null;
                }
            }, this);
        }

        this._popupItemBox.collapseButton.connectObject('clicked', () => {
            if (this._isOpen)
                this._toggleSubMenuBox(false, true, true);
        }, this._popupItemBox);

        this.activate = __ => {
            if (!this._isOpen)
                this._toggleSubMenuBox(true, true, false);
        };

        this.connectObject(
            'enter-event', () => {
                this.actor.add_style_pseudo_class('focus');
            },
            'leave-event', () => {
                this.actor.remove_style_pseudo_class('focus');
            },
            this
        );
    }

    updatePinButton(selected) {
        this._popupItemBox?.updatePinButton(selected);
    }

    updateAlias(alias) {
        this._alias = alias;
        this._popupItemBox?.updateAlias?.(alias);
        this._updateAccesibleName();
    }

    _updateAccesibleName() {
        this.accessible_name = `${this._alias} ${_('Expand submenu')}`;
    }

    vfunc_key_press_event(event) {
        const symbol = event.get_key_symbol();
        if (symbol  === Clutter.KEY_space && !this._isOpen) {
            this._toggleSubMenuBox(true, true, true);
            return Clutter.EVENT_STOP;
        } else if (symbol === Clutter.KEY_space &&
                        this._popupItemBox.collapseButton.has_key_focus() && this._isOpen) {
            this._toggleSubMenuBox(false, true, true);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _toggleSubMenuBox(open, animate, keyGrabCall, doneCallback = null) {
        if (open) {
            const openNow = () => {
                this.active = true;
                this.actor.grab_key_focus();
                this.actor.add_style_class_name('open');
                this._hBox.hide();
                this._popupItemBox.opacity = 0;
                this._popupItemBox.visible = true;
                const [, naturalHeight] = this._popupItemBox.get_preferred_height(-1);
                this._popupItemBox.height = 0;
                const duration = animate ? 200 : 0;
                this.actor.set_can_focus(false);

                this._popupItemBox.ease({
                    height: naturalHeight,
                    opacity: 255,
                    duration,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        this._popupItemBox.set_height(-1);
                        if (keyGrabCall)
                            this._popupItemBox.collapseButton.grab_key_focus();
                        if (doneCallback)
                            doneCallback();
                    },
                });

                this._isOpen = true;
                if (this._menu)
                    this._menu._bbmOpenSubmenu = this;
            };

            if (this._menu && this._menu._bbmOpenSubmenu && this._menu._bbmOpenSubmenu !== this) {
                const other = this._menu._bbmOpenSubmenu;
                other._toggleSubMenuBox(false, true, false, () => {
                    openNow();
                });
                return;
            }

            openNow();
            return;
        }

        if (!this._isOpen) {
            if (doneCallback)
                doneCallback();
            return;
        }

        this.active = false;
        this.actor.remove_style_class_name('open');

        const duration = animate ? 100 : 0;
        this._hBox.show();

        this._popupItemBox.ease({
            height: 0,
            opacity: 0,
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._popupItemBox.visible = false;
                this._popupItemBox.set_height(-1);
                this._isOpen = false;
                this.actor.set_can_focus(true);
                if (keyGrabCall)
                    this.grab_key_focus();
                if (this._menu && this._menu._bbmOpenSubmenu === this)
                    this._menu._bbmOpenSubmenu = null;
                if (doneCallback)
                    doneCallback();
            },
        });
    }
};

