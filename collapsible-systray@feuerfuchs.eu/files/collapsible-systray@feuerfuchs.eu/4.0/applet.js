const uuid = "collapsible-systray@feuerfuchs.eu";

const Util                      = imports.misc.util;
const Lang                      = imports.lang;
const Clutter                   = imports.gi.Clutter;
const St                        = imports.gi.St;
const Main                      = imports.ui.main;
const Mainloop                  = imports.mainloop;
const SignalManager             = imports.misc.signalManager;
const Settings                  = imports.ui.settings;
const Tweener                   = imports.ui.tweener;

const Applet                    = imports.ui.applet;
const PopupMenu                 = imports.ui.popupMenu;

let CinnamonSystray, CSCollapseBtn, CSRemovableSwitchMenuItem, _;
if (typeof require !== 'undefined') {
    CinnamonSystray             = require('./CinnamonSystray');
    CSCollapseBtn               = require('./CSCollapseBtn');
    CSRemovableSwitchMenuItem   = require('./CSRemovableSwitchMenuItem');
    _                           = require('./Util')._;
} else {
    const AppletDir             = imports.ui.appletManager.applets[uuid];
    CinnamonSystray             = AppletDir.CinnamonSystray;
    CSCollapseBtn               = AppletDir.CSCollapseBtn;
    CSRemovableSwitchMenuItem   = AppletDir.CSRemovableSwitchMenuItem;
    _                           = AppletDir.Util._;
}

const ICON_SCALE_FACTOR         = CinnamonSystray.ICON_SCALE_FACTOR;
const DEFAULT_ICON_SIZE         = CinnamonSystray.DEFAULT_ICON_SIZE;

// ------------------------------------------------------------------------------------------------------

class CollapsibleSystrayApplet extends CinnamonSystray.CinnamonSystrayApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.Menu = {
            ACTIVE_APPLICATIONS:   true,
            INACTIVE_APPLICATIONS: false
        };
    
        this.Direction = {
            HORIZONTAL: 0,
            VERTICAL:   1
        };

        this.actor.add_style_class_name("ff-collapsible-systray");
        this.actor.remove_actor(this.manager_container);

        this.icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR);

        //
        // Expand/collapse button

        this.collapseBtn = new CSCollapseBtn.CSCollapseBtn(this);
        this.collapseBtn.actor.connect('clicked', Lang.bind(this, function(o, event) {
            if (this._hoverTimerID) {
                Mainloop.source_remove(this._hoverTimerID);
                this._hoverTimerID = null;
            }
            if (this._initialCollapseTimerID) {
                Mainloop.source_remove(this._initialCollapseTimerID);
                this._initialCollapseTimerID = null;
            }

            switch (this.collapseBtn.state) {
                case this.collapseBtn.State.EXPANDED:
                    this._hideAppIcons(true);
                    break;

                case this.collapseBtn.State.COLLAPSED:
                    this._showAppIcons(true);
                    break;

                case this.collapseBtn.State.UNAVAILABLE:
                    this._applet_context_menu.toggle();
                    break;
            }
        }));

        //
        // Variables

        this._direction          = (orientation == St.Side.TOP || orientation == St.Side.BOTTOM) ? this.Direction.HORIZONTAL : this.Direction.VERTICAL;
        this._signalManager      = new SignalManager.SignalManager(null);
        this._hovering           = false;
        this._hoverTimerID       = null;
        this._registeredAppIcons = {};
        this._activeMenuItems    = {};
        this._inactiveMenuItems  = {};
        this._animating          = false;
        this._iconsAreHidden     = false;

        //
        // Root container

        this.mainLayout = new St.BoxLayout({ vertical: this._direction == this.Direction.VERTICAL });

        //
        // Container for hidden icons

        this.hiddenIconsContainer = new St.BoxLayout({ vertical: this._direction == this.Direction.VERTICAL });

        // Add horizontal scrolling and scroll to the end on each redraw so that it looks like the
        // collapse button "eats" the icons on collapse
        this.hiddenIconsContainer.hadjustment = new St.Adjustment();
        this.hiddenIconsContainer.vadjustment = new St.Adjustment();
        this.hiddenIconsContainer.connect('queue-redraw', Lang.bind(this, function() {
            if (this._direction == this.Direction.HORIZONTAL) {
                this.hiddenIconsContainer.hadjustment.set_value(this.hiddenIconsContainer.hadjustment.upper);
            } else {
                this.hiddenIconsContainer.vadjustment.set_value(this.hiddenIconsContainer.vadjustment.upper);
            }
        }));

        //
        // Container for shown icons

        this.shownIconsContainer = new St.BoxLayout({ vertical: this._direction == this.Direction.VERTICAL });

        //
        // Assemble layout

        this.mainLayout.add_actor(this.collapseBtn.actor);
        this.mainLayout.add_actor(this.shownIconsContainer);
        this.actor.add_actor(this.mainLayout);

        //
        // Context menu items

        this.cmitemActiveItems   = new PopupMenu.PopupSubMenuMenuItem(_("Active applications"));
        this.cmitemInactiveItems = new PopupMenu.PopupSubMenuMenuItem(_("Inactive applications"));

        this._populateMenus();

        //
        // Settings

        this._settings = new Settings.AppletSettings(this, uuid, instance_id);
        this._settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "icon-visibility-list",          "savedIconVisibilityList",    this._loadAppIconVisibilityList);
        this._settings.bindProperty(Settings.BindingDirection.IN,            "init-delay",                    "initDelay");
        this._settings.bindProperty(Settings.BindingDirection.IN,            "animation-support",             "animationSupport",           this._onAnimationSupportUpdated);
        this._settings.bindProperty(Settings.BindingDirection.IN,            "animation-duration",            "animationDuration");
        this._settings.bindProperty(Settings.BindingDirection.IN,            "horizontal-expand-icon-name",   "horizontalExpandIconName",   this._onExpandCollapseIconNameUpdated);
        this._settings.bindProperty(Settings.BindingDirection.IN,            "horizontal-collapse-icon-name", "horizontalCollapseIconName", this._onExpandCollapseIconNameUpdated);
        this._settings.bindProperty(Settings.BindingDirection.IN,            "vertical-expand-icon-name",     "verticalExpandIconName",     this._onExpandCollapseIconNameUpdated);
        this._settings.bindProperty(Settings.BindingDirection.IN,            "vertical-collapse-icon-name",   "verticalCollapseIconName",   this._onExpandCollapseIconNameUpdated);
        this._settings.bindProperty(Settings.BindingDirection.IN,            "tray-icon-padding",             "trayIconPadding",            this._onTrayIconPaddingUpdated);
        this._settings.bindProperty(Settings.BindingDirection.IN,            "expand-on-hover",               "expandOnHover");
        this._settings.bindProperty(Settings.BindingDirection.IN,            "expand-on-hover-delay",         "expandOnHoverDelay");
        this._settings.bindProperty(Settings.BindingDirection.IN,            "collapse-on-leave",             "collapseOnLeave");
        this._settings.bindProperty(Settings.BindingDirection.IN,            "collapse-on-leave-delay",       "collapseOnLeaveDelay");
        this._settings.bindProperty(Settings.BindingDirection.IN,            "no-hover-for-tray-icons",       "noHoverForTrayIcons");
        this._settings.bindProperty(Settings.BindingDirection.IN,            "sort-icons",                    "sortIcons");
        

        this._refreshHiddenIconsContainerState();
        this._loadAppIconVisibilityList();
        this.collapseBtn.setVertical(this._direction == this.Direction.VERTICAL);
        this.collapseBtn.refreshReactive();

        
        global.log("[" + uuid + "] Initialized");
    }

    /*
     * Get the correct collapse icon according to the user settings and the applet orientation
     */
    get collapseIcon() {
        if (this._direction == this.Direction.HORIZONTAL) {
            return this.horizontalCollapseIconName;
        } else {
            return this.verticalCollapseIconName;
        }
    }

    /*
     * Get the correct expand icon according to the user settings and the applet orientation
     */
    get expandIcon() {
        if (this._direction == this.Direction.HORIZONTAL) {
            return this.horizontalExpandIconName;
        } else {
            return this.verticalExpandIconName;
        }
    }

    /*
     * Set the collapse button's state
     */
    _refreshCollapseBtnState() {
        let collapsible = false;
        for (let id in this.iconVisibilityList) {
            if (this.iconVisibilityList.hasOwnProperty(id) && this._registeredAppIcons.hasOwnProperty(id)) {
                if (!this.iconVisibilityList[id]) {
                    collapsible = true;
                    break;
                }
            }
        }

        if (collapsible) {
            this.collapseBtn.setState(this._iconsAreHidden ? this.collapseBtn.State.COLLAPSED : this.collapseBtn.State.EXPANDED);
        } else {
            this.collapseBtn.setState(this.collapseBtn.State.UNAVAILABLE);
        }
    }

    /*
     * Change applet state to accommodate the current animation support state.
     */
    _refreshHiddenIconsContainerState() {
        this.mainLayout.remove_actor(this.hiddenIconsContainer);

        if (this.animationSupport || !this._iconsAreHidden) {
            this.mainLayout.add_actor(this.hiddenIconsContainer);
            this.mainLayout.set_child_above_sibling(this.shownIconsContainer, this.hiddenIconsContainer);
        }
    }

    /*
     * Add all necessary menu items to the context menu
     */
    _populateMenus() {
        let i = -1;
        this._applet_context_menu.addMenuItem(this.cmitemActiveItems, ++i);
        this._applet_context_menu.addMenuItem(this.cmitemInactiveItems, ++i);
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), ++i);
    }

    /*
     * Add the specified icon to the item list and create a menu entry
     */
    _registerAppIcon(id, actor) {
        if (!this._registeredAppIcons.hasOwnProperty(id)) {
            this._registeredAppIcons[id] = [];
        }

        const instanceArray = this._registeredAppIcons[id];

        if (instanceArray.indexOf(actor) != -1) return;

        global.log("[" + uuid + "] Register instance of " + id);

        instanceArray.push(actor);

        if (!this.iconVisibilityList.hasOwnProperty(id)) {
            this.iconVisibilityList[id] = true;
            this._saveAppIconVisibilityList();
        }

        const container = this.iconVisibilityList[id] ? this.shownIconsContainer : this.hiddenIconsContainer;
        let   index     = 0;
        if (this.sortIcons) {
            const icons = container.get_children();
            for (let len = icons.length; index < len; ++index) {
                if (icons[index].appID.localeCompare(id) >= 1) {
                    break;
                }
            }
        }
        container.insert_actor(actor, index);

        actor.appID = id;

        if (this._iconsAreHidden && !this.iconVisibilityList[id]) {
            actor.csDisable();
        }

        this._addApplicationMenuItem(id, this.Menu.ACTIVE_APPLICATIONS);
        this._refreshCollapseBtnState();
    }

    /*
     * Remove the icon from the list and move the menu entry to the list of inactive applications
     */
    _unregisterAppIcon(id, actor) {
        global.log("[" + uuid + "] Unregister instance of " + id);

        const instanceArray = this._registeredAppIcons[id];
        const iconIndex     = instanceArray.indexOf(actor);
        if (iconIndex != -1) {
            instanceArray.splice(iconIndex, 1);
        }

        //actor.destroy();
        actor.get_parent().remove_actor(actor);

        if (instanceArray.length == 0) {
            global.log("[" + uuid + "] No more instances left");

            delete this._registeredAppIcons[id];
            this._addApplicationMenuItem(id, this.Menu.INACTIVE_APPLICATIONS);
            this._refreshCollapseBtnState();
        }
    }

    /*
     * Create a menu entry for the specified icon in the "active applications" section
     */
    _addApplicationMenuItem(id, menu) {
        const curMenuItems   = menu == this.Menu.ACTIVE_APPLICATIONS ? this._activeMenuItems       : this._inactiveMenuItems;
        const curMenu        = menu == this.Menu.ACTIVE_APPLICATIONS ? this.cmitemActiveItems.menu : this.cmitemInactiveItems.menu;
        const otherMenuItems = menu == this.Menu.ACTIVE_APPLICATIONS ? this._inactiveMenuItems     : this._activeMenuItems;
        let   menuItem       = null;

        // If there's a menu item in the other menu, delete it
        if (otherMenuItems.hasOwnProperty(id)) {
            otherMenuItems[id].actor.destroy();
            delete otherMenuItems[id];
        }

        // If there's already a menu item in the current menu, do nothing
        if (curMenuItems.hasOwnProperty(id)) {
            return;
        }

        global.log("[" + uuid + "] Insert menu item for " + id + " in " + (menu == this.Menu.ACTIVE_APPLICATIONS ? "active" : "inactive") + " applications");

        switch (menu) {
            case this.Menu.ACTIVE_APPLICATIONS:
                menuItem = new PopupMenu.PopupSwitchMenuItem(id, this.iconVisibilityList[id]);
                menuItem.appID = id;
                menuItem.connect('toggled', Lang.bind(this, function(o, state) {
                    this._updateAppIconVisibility(id, state);
                }));
                break;

            default:
            case this.Menu.INACTIVE_APPLICATIONS:
                menuItem = new CSRemovableSwitchMenuItem.CSRemovableSwitchMenuItem(id, this.iconVisibilityList[id]);
                menuItem.appID = id;
                menuItem.connect('toggled', Lang.bind(this, function(o, state) {
                    this._updateAppIconVisibility(id, state);
                }));
                menuItem.connect('remove', Lang.bind(this, function(o, state) {
                    delete this.iconVisibilityList[id];
                    this._saveAppIconVisibilityList();

                    delete this._inactiveMenuItems[id];
                }));
                break;
        }

        // Find insertion index so all menu items are alphabetically sorted
        let   index = 0;
        const items = curMenu._getMenuItems();
        for (let len = items.length; index < len; ++index) {
            if (items[index].appID.localeCompare(id) >= 1) {
                break;
            }
        }

        curMenu.addMenuItem(menuItem, index);
        curMenuItems[id] = menuItem;
    }

    /*
     * Hide all icons that are marked as hidden
     */
    _hideAppIcons(animate) {
        if (animate && this._animating) {
            return;
        }

        global.log("[" + uuid + "] _hideAppIcons");

        if (this.hiddenIconsContainer.hasOwnProperty('tweenParams')) {
            Tweener.removeTweens(this.hiddenIconsContainer);
            this.hiddenIconsContainer.tweenParams.onComplete();
        }

        this._iconsAreHidden = true;

        if (this.animationSupport) {
            const onFinished = Lang.bind(this, function() {
                delete this.hiddenIconsContainer.tweenParams;

                let icons  = this.hiddenIconsContainer.get_children();
                for (let i = icons.length - 1; i >= 0; --i) {
                    icons[i].csDisable();
                    icons[i].hide();
                }

                this._animating = false;
                this._refreshCollapseBtnState();
            });

            if (animate) {
                this._animating = true;
                this.hiddenIconsContainer.tweenParams = {
                    time:       this.animationDuration / 1000,
                    transition: 'easeInOutQuart',
                    rounded:    true,
                    onComplete: onFinished
                }

                if (this._direction == this.Direction.HORIZONTAL) {
                    this.hiddenIconsContainer.tweenParams.width = 0;
                } else {
                    this.hiddenIconsContainer.tweenParams.height = 0;
                }

                Tweener.addTween(this.hiddenIconsContainer, this.hiddenIconsContainer.tweenParams);
            } else {
                if (this._direction == this.Direction.HORIZONTAL) {
                    this.hiddenIconsContainer.set_width(0);
                } else {
                    this.hiddenIconsContainer.set_height(0);
                }
                onFinished();
            }
        } else {
            if (this._direction == this.Direction.HORIZONTAL) {
                this.hiddenIconsContainer.set_width(0);
            } else {
                this.hiddenIconsContainer.set_height(0);
            }

            this._refreshHiddenIconsContainerState();
            this._refreshCollapseBtnState();
        }
    }

    /*
     * Unhide all icons that are marked as hidden
     */
    _showAppIcons(animate) {
        if (animate && this._animating) {
            return;
        }

        global.log("[" + uuid + "] _showAppIcons");

        if (this.hiddenIconsContainer.hasOwnProperty('tweenParams')) {
            Tweener.removeTweens(this.hiddenIconsContainer);
            this.hiddenIconsContainer.tweenParams.onComplete();
        }

        this._iconsAreHidden = false;

        if (this.animationSupport) {
            const onFinished = Lang.bind(this, function() {
                delete this.hiddenIconsContainer.tweenParams;

                this.hiddenIconsContainer.get_children().forEach(function(icon, index) {
                    icon.csEnableAfter();
                });

                if (this._direction == this.Direction.HORIZONTAL) {
                    this.hiddenIconsContainer.set_width(-1);
                } else {
                    this.hiddenIconsContainer.set_height(-1);
                }

                this._animating = false;
                this._refreshCollapseBtnState();
            });

            this.hiddenIconsContainer.get_children().forEach(function(icon, index) {
                icon.csEnable();
                icon.show();
            });

            if (animate) {
                this._animating = true;

                this.hiddenIconsContainer.tweenParams = {
                    time:       this.animationDuration / 1000,
                    transition: 'easeInOutQuart',
                    rounded:    true,
                    onComplete: onFinished
                };

                if (this._direction == this.Direction.HORIZONTAL) {
                    let [minWidth, natWidth] = this.hiddenIconsContainer.get_preferred_width(-1);
                    let prevWidth = natWidth;

                    this.hiddenIconsContainer.set_width(-1);
                    [minWidth, natWidth] = this.hiddenIconsContainer.get_preferred_width(-1);
                    this.hiddenIconsContainer.tweenParams.width = natWidth;

                    this.hiddenIconsContainer.set_width(prevWidth);
                } else {
                    let [minHeight, natHeight] = this.hiddenIconsContainer.get_preferred_height(-1);
                    let prevHeight = natHeight;

                    this.hiddenIconsContainer.set_height(-1);
                    [minHeight, natHeight] = this.hiddenIconsContainer.get_preferred_height(-1);
                    this.hiddenIconsContainer.tweenParams.height = natHeight;

                    this.hiddenIconsContainer.set_height(prevHeight);
                }

                Tweener.addTween(this.hiddenIconsContainer, this.hiddenIconsContainer.tweenParams);
            } else {
                onFinished();
            }
        } else {
            if (this._direction == this.Direction.HORIZONTAL) {
                this.hiddenIconsContainer.set_width(-1);
            } else {
                this.hiddenIconsContainer.set_height(-1);
            }

            this._refreshHiddenIconsContainerState();
            this._refreshCollapseBtnState();

            if (animate) {
                Main.statusIconDispatcher.redisplay();
            }
        }
    }

    /*
     * Update the specified icon's visibility state and (un)hide it if necessary
     */
    _updateAppIconVisibility(id, state) {
        global.log("[" + uuid + "] State of " + id + " was set to " + (state ? "shown" : "hidden"));

        this.iconVisibilityList[id] = state;

        // Application is active, show/hide the icon if necessary
        if (this._registeredAppIcons.hasOwnProperty(id)) {
            const instances = this._registeredAppIcons[id];

            const container = state ? this.shownIconsContainer : this.hiddenIconsContainer;
            let   index     = 0;

            if (this.sortIcons) {
                const icons = container.get_children();
                for (let len = icons.length; index < len; ++index) {
                    if (icons[index].appID.localeCompare(id) >= 1) {
                        break;
                    }
                }
            }

            instances.forEach(Lang.bind(this, function(actor, index) {
                actor.get_parent().remove_child(actor);
                container.add_child(actor);
                container.set_child_at_index(actor, index);

                if (this._iconsAreHidden) {
                    if (state) {
                        actor.csEnable();
                        actor.csEnableAfter();
                        actor.show();
                    } else {
                        actor.csDisable();
                        actor.hide();
                    }
                }
            }));
        }

        this._saveAppIconVisibilityList();
        this._refreshCollapseBtnState();
    }

    /*
     * Update the tray icons' padding
     */
    _updateTrayIconPadding() {
        this.shownIconsContainer.get_children()
            .concat(this.hiddenIconsContainer.get_children())
            .filter(function(iconWrapper) { return iconWrapper.isIndicator != true; })
            .forEach(Lang.bind(this, function(iconWrapper, index) {
                if (this._direction == this.Direction.HORIZONTAL) {
                    iconWrapper.set_style('padding-left: ' + this.trayIconPadding + 'px; padding-right: ' + this.trayIconPadding + 'px;');
                } else {
                    iconWrapper.set_style('padding-top: ' + this.trayIconPadding + 'px; padding-bottom: ' + this.trayIconPadding + 'px;');
                }
            }));
    }

    /*
     * Load the list of hidden icons from the settings
     */
    _loadAppIconVisibilityList() {
        try {
            this.iconVisibilityList = JSON.parse(this.savedIconVisibilityList);

            this._refreshCollapseBtnState();

            for (let id in this.iconVisibilityList) {
                if (this.iconVisibilityList.hasOwnProperty(id) && !this._registeredAppIcons.hasOwnProperty(id)) {
                    this._addApplicationMenuItem(id, this.Menu.INACTIVE_APPLICATIONS);
                }
            }
        } catch(e) {
            this.iconVisibilityList = {};
            global.log("[" + uuid + "] Chouldn't load icon visibility list: " + e);
        }
    }

    /*
     * Save the list of hidden icons
     */
    _saveAppIconVisibilityList() {
        this.savedIconVisibilityList = JSON.stringify(this.iconVisibilityList);
    }

    /*
     * An applet setting with visual impact has been changed
     */
    _onExpandCollapseIconNameUpdated(value) {
        this._refreshCollapseBtnState();
    }

    /*
     * An applet setting with visual impact has been changed
     */
    _onTrayIconPaddingUpdated(value) {
        this._updateTrayIconPadding();
    }

    /*
     * An applet setting with visual impact has been changed
     */
    _onAnimationSupportUpdated(value) {
        this._refreshHiddenIconsContainerState();

        if (value) {
            Main.statusIconDispatcher.redisplay();
        }
    }

    //
    // Events
    // ---------------------------------------------------------------------------------

    _onEnter() {
        this._hovering = true;

        if (this._hoverTimerID) {
            Mainloop.source_remove(this._hoverTimerID);
            this._hoverTimerID = null;
        }

        if (!this.expandOnHover)      return;
        if (!this._draggable.inhibit) return;

        if (this._initialCollapseTimerID) {
            Mainloop.source_remove(this._initialCollapseTimerID);
            this._initialCollapseTimerID = null;
        }

        this._hoverTimerID = Mainloop.timeout_add(this.expandOnHoverDelay, Lang.bind(this, function() {
            this._hoverTimerID = null;

            if (this._iconsAreHidden) {
                this._showAppIcons(true);
            }
        }));
    }

    _onLeave() {
        this._hovering = false;

        if (this._hoverTimerID) {
            Mainloop.source_remove(this._hoverTimerID);
            this._hoverTimerID = null;
        }

        if (!this.collapseOnLeave)    return;
        if (!this._draggable.inhibit) return;

        if (this._initialCollapseTimerID) {
            Mainloop.source_remove(this._initialCollapseTimerID);
            this._initialCollapseTimerID = null;
        }

        this._hoverTimerID = Mainloop.timeout_add(this.collapseOnLeaveDelay, Lang.bind(this, function() {
            this._hoverTimerID = null;

            if (!this._iconsAreHidden) {
                this._hideAppIcons(true);
            }
        }));
    }

    //
    // Overrides
    // ---------------------------------------------------------------------------------

    /*
     * Disable the collapse/expand button if the panel is in edit mode so the user can
     * perform drag and drop on that button
     */
    _setAppletReactivity() {
        global.log("[" + uuid + "] Event: _setAppletReactivity");

        super._setAppletReactivity();

        if (this.collapseBtn)
            this.collapseBtn.refreshReactive();

        if (this._hoverTimerID) {
            Mainloop.source_remove(this._hoverTimerID);
            this._hoverTimerID = null;
        }
    }

    /*
     * The Cinnamon applet invalidates all tray icons if this event occurs, so I have to
     * unregister all tray icons when this happens
     */
    _onBeforeRedisplay() {
        global.log("[" + uuid + "] Event: _onBeforeRedisplay");

        super._onBeforeRedisplay();

        this.shownIconsContainer.get_children()
            .concat(this.hiddenIconsContainer.get_children())
            .filter(function(iconWrapper) { return iconWrapper.isIndicator != true; })
            .forEach(Lang.bind(this, function(iconWrapper, index) {
                iconWrapper.icon.destroy();
            }));
    }

    /*
     * Remove icon from tray, wrap it in an applet-box and re-add it. This way,
     * tray icons are displayed like applets and thus integrate nicely in the panel.
     */
    _insertStatusItem(role, icon) {
        if (icon.obsolete == true) {
            return;
        }
        if (role.trim() == "") {
            role = "[empty name]";
        }

        global.log("[" + uuid + "] Event: _insertStatusItem - " + role);

        super._insertStatusItem(role, icon);

        this.manager_container.remove_child(icon);

        const iconWrap        = new St.BoxLayout({ style_class: 'applet-box', reactive: true, track_hover: !this.noHoverForTrayIcons });
        const iconWrapContent = new St.Bin({ child: icon });

        iconWrap.add_style_class_name('ff-collapsible-systray__status-icon');
        iconWrap.add_actor(iconWrapContent);
        if (this._direction == this.Direction.HORIZONTAL) {
            iconWrap.set_style('padding-left: ' + this.trayIconPadding + 'px; padding-right: ' + this.trayIconPadding + 'px;');
        } else {
            iconWrap.set_style('padding-top: ' + this.trayIconPadding + 'px; padding-bottom: ' + this.trayIconPadding + 'px;');
        }
        iconWrap.isIndicator = false;
        iconWrap.icon        = icon;
        iconWrap.setVertical = function(vertical) {
            iconWrap.set_vertical(vertical);
            if (vertical) {
                iconWrap.add_style_class_name('vertical');
            } else {
                iconWrap.remove_style_class_name('vertical');
            }
        }
        iconWrap.setVertical(this._direction == this.Direction.VERTICAL);

        if (["livestreamer-twitch-gui", "chromium", "swt", "skypeforlinux"].indexOf(role) != -1) {
            iconWrap.csDisable = Lang.bind(this, function() {
                if (this.animationSupport) {
                    iconWrapContent.set_child(null);
                }
            });
            iconWrap.csEnable = Lang.bind(this, function() {
                if (this.animationSupport) {
                    iconWrapContent.set_child(icon);
                }
            });
            iconWrap.csEnableAfter = function() { }
        } else if (["pidgin"].indexOf(role) != -1) {
            iconWrap.csDisable = Lang.bind(this, function() {
                if (this.animationSupport) {
                    icon.window.hide();
                }
            });
            iconWrap.csEnable = function() { }
            iconWrap.csEnableAfter = Lang.bind(this, function() {
                if (this.animationSupport) {
                    icon.window.show();
                }
            });
        } else {
            iconWrap.csDisable = Lang.bind(this, function() {
                if (this.animationSupport) {
                    icon.window.hide();
                }
            });
            iconWrap.csEnable = Lang.bind(this, function() {
                if (this.animationSupport) {
                    icon.window.show();
                }
            });
            iconWrap.csEnableAfter = function() { }
        }

        iconWrap.connect('button-press-event', Lang.bind(this, function(actor, e) { return true; }));
        iconWrap.connect('button-release-event', Lang.bind(this, function(actor, e) {
            let ret = icon.handle_event(Clutter.EventType.BUTTON_PRESS, e);
            return ret;
        }));

        icon.connect('destroy', Lang.bind(this, function() {
            this._unregisterAppIcon(role, iconWrap);
        }));

        this._registerAppIcon(role, iconWrap);
    }

    /*
     * An AppIndicator has been added; prepare its actor and register the icon
     */
    _onIndicatorAdded(manager, appIndicator) {
        global.log("[" + uuid + "] Event: _onIndicatorAdded - " + appIndicator.id);

        super._onIndicatorAdded(manager, appIndicator);

        let id = appIndicator.id;

        if (appIndicator.id.trim() == "")
        {
            global.logError("[" + uuid + "] Indicator ID is empty. It's probably Dropbox being \"special\" once again.");
            id = "[empty name]";
        }

        for (let i = 0; i < this._shellIndicators.length; i++) {
            if (this._shellIndicators[i].id == appIndicator.id) {
                const iconActor = this._shellIndicators[i].instance.actor;
    
                this.manager_container.remove_actor(iconActor);
    
                const iconWrap = new St.BoxLayout({ style_class: 'applet-box', reactive: true, track_hover: !this.noHoverForTrayIcons });
                iconWrap.add_style_class_name('ff-collapsible-systray__status-icon');
                iconWrap.add_actor(iconActor);
                if (this._direction == this.Direction.HORIZONTAL) {
                    iconWrap.set_style('padding-left: ' + this.trayIconPadding + 'px; padding-right: ' + this.trayIconPadding + 'px;');
                } else {
                    iconWrap.set_style('padding-top: ' + this.trayIconPadding + 'px; padding-bottom: ' + this.trayIconPadding + 'px;');
                }
                iconWrap.isIndicator = true;
                iconWrap.icon        = iconActor;
                iconWrap.setVertical = function(vertical) {
                    iconWrap.set_vertical(vertical);
                    if (vertical) {
                        iconWrap.add_style_class_name('vertical');
                    } else {
                        iconWrap.remove_style_class_name('vertical');
                    }
                }
                iconWrap.setVertical(this._direction == this.Direction.VERTICAL);

                iconWrap.csDisable = Lang.bind(this, function() {
                    if (this.animationSupport) {
                        iconActor.set_reactive(false);
                    }
                });
                iconWrap.csEnable = Lang.bind(this, function() {
                    if (this.animationSupport) {
                        iconActor.set_reactive(true);
                    }
                });
                iconWrap.csEnableAfter = function() { }

                iconWrap.connect('button-press-event', Lang.bind(this, function(actor, e) { return true; }));
                iconWrap.connect('button-release-event', Lang.bind(this, function(actor, e) {
                    let ret = icon.handle_event(Clutter.EventType.BUTTON_PRESS, e);
                    return ret;
                }));

                iconActor.connect('destroy', Lang.bind(this, function() {
                    this._unregisterAppIcon(id, iconActor);
                }));
    
                this._registerAppIcon(id, iconWrap);

                return;
            }
        }
    }

    /*
     * Patching icon resizing
     */
    on_panel_icon_size_changed(size) {
        global.log("[" + uuid + "] Event: on_panel_icon_size_changed");

        this.icon_size = size;
        Main.statusIconDispatcher.redisplay();

        for (let i = 0; i < this._shellIndicators.length; i++) {
            let indicator = Main.indicatorManager.getIndicatorById(this._shellIndicators[i].id);
            if (indicator) {
                this._shellIndicators[i].instance.setSize(this.icon_size);
            }
        }
    }

    /*
     * The applet's orientation changed; adapt accordingly
     */
    on_orientation_changed(orientation) {
        global.log("[" + uuid + "] Event: on_orientation_changed");

        super.on_orientation_changed(orientation);

        this._direction  = (orientation == St.Side.TOP || orientation == St.Side.BOTTOM) ? this.Direction.HORIZONTAL : this.Direction.VERTICAL;

        if (this._direction == this.Direction.VERTICAL) {
            this.mainLayout.set_vertical(true);
            this.hiddenIconsContainer.set_vertical(true);
            this.shownIconsContainer.set_vertical(true);
            this.collapseBtn.setVertical(true);

            this.hiddenIconsContainer.get_children().forEach(function(icon, index) {
                icon.setVertical(true);
            });
        } else {
            this.mainLayout.set_vertical(false);
            this.hiddenIconsContainer.set_vertical(false);
            this.shownIconsContainer.set_vertical(false);
            this.collapseBtn.setVertical(false);

            this.hiddenIconsContainer.get_children().forEach(function(icon, index) {
                icon.setVertical(false);
            });
        }

        this.hiddenIconsContainer.hadjustment.set_value(0);
        this.hiddenIconsContainer.vadjustment.set_value(0);
    }

    /*
     * The applet has been added to the panel
     */
    on_applet_added_to_panel() {
        global.log("[" + uuid + "] Event: on_applet_added_to_panel");

        super.on_applet_added_to_panel();

        this._showAppIcons(false);

        //
        // Automatically collapse after X seconds

        this._initialCollapseTimerID = Mainloop.timeout_add(this.initDelay * 1000, Lang.bind(this, function() {
            this._initialCollapseTimerID = null;

            if (this._draggable.inhibit) {
                this._hideAppIcons(true);
            }
        }));

        //
        // Hover events

        this._signalManager.connect(this.actor, 'enter-event', Lang.bind(this, this._onEnter));
        this._signalManager.connect(this.actor, 'leave-event', Lang.bind(this, this._onLeave));
    }

    /*
     * The applet has been removed from the panel; save settings
     */
    on_applet_removed_from_panel() {
        global.log("[" + uuid + "] Event: on_applet_removed_from_panel");

        super.on_applet_removed_from_panel();

        this._settings.finalize();
    }

    /*
     * Patching icon resizing
     */
    _resizeStatusItem(role, icon) {
        if (CinnamonSystray.NO_RESIZE_ROLES.indexOf(role) > -1) {
            global.log("[" + uuid + "] Not resizing " + role + " as it's known to be buggy (" + icon.get_width() + "x" + icon.get_height() + "px)");
        } else {
            icon.set_size(this.icon_size * global.ui_scale, this.icon_size * global.ui_scale);
            global.log("[" + uuid + "] Resized " + role + " with normalized size (" + icon.get_width() + "x" + icon.get_height() + "px)");
            //Note: dropbox doesn't scale, even though we resize it...
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CollapsibleSystrayApplet(orientation, panel_height, instance_id);
}
