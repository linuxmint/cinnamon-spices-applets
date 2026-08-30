const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;
const SignalManager = imports.misc.signalManager;
const Util = imports.misc.util;

const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Cinnamon = imports.gi.Cinnamon;
const Meta = imports.gi.Meta;
const Lang = imports.lang;
const Gettext = imports.gettext;

const UUID = "trayflow@monsma-dev";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

let XApp = null;
try {
    XApp = imports.gi.XApp;
} catch (e) {
    global.logWarning("trayflow: XApp not available: " + e);
}

const VIS = {
    PINNED: "pinned",
    OVERFLOW: "overflow",
    HIDDEN: "hidden"
};

const LEGACY_ICON_ALIASES = {
    "bitwarden-app": "com.bitwarden.desktop"
};

const LEGACY_IGNORE_ROLES = [
    "unknown",
    "xapp-sn-watcher",
    "indicator-application-service",
    "mintupdate.py"
];

class XAppTrayIcon {
    constructor(applet, proxy) {
        this.applet = applet;
        this.proxy = proxy;
        this.kind = "xapp";
        this.id = this._makeId(proxy);
        this.labelName = (proxy.name || "xapp").replace(/^org\.x\.StatusIcon\./, "");

        this.actor = new St.BoxLayout({
            style_class: "trayflow-cell",
            reactive: !global.settings.get_boolean("panel-edit-mode"),
            track_hover: true,
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.actor.connect("enter-event", () => {
            this.actor.add_style_pseudo_class("active");
            return Clutter.EVENT_PROPAGATE;
        });
        this.actor.connect("leave-event", () => {
            this.actor.remove_style_pseudo_class("active");
            return Clutter.EVENT_PROPAGATE;
        });

        this.icon_holder = new St.Bin({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.actor.add_actor(this.icon_holder);

        this._tooltip = new Tooltips.PanelItemTooltip(this, "", applet.orientation);
        this.iconSize = applet.getPanelIconSize(St.IconType.FULLCOLOR);
        this.proxy.icon_size = this.iconSize;

        this.actor.connect("button-press-event", Lang.bind(this, this.onButtonPressEvent));
        this.actor.connect("button-release-event", Lang.bind(this, this.onButtonReleaseEvent));
        this.actor.connect("scroll-event", (...args) => this.onScrollEvent(...args));
        this.actor.connect("enter-event", Lang.bind(this, this.onEnterEvent));

        this._proxyChangeId = this.proxy.connect(
            "g-properties-changed",
            Lang.bind(this, this.onPropertiesChanged)
        );

        this._appVisible = true;
        this._inPopup = false;
        this.refresh();
    }

    _makeId(proxy) {
        try {
            return "xapp:" + proxy.get_name() + proxy.get_object_path();
        } catch (e) {
            return "xapp:" + (proxy.name || "unknown");
        }
    }

    onPropertiesChanged(proxy, changed_props, _invalidated) {
        if (this._settingIcon) return;
        let props = changed_props.deep_unpack();
        if ("IconName" in props) this.setIconName(proxy.icon_name);
        if ("TooltipText" in props) this.setTooltipText(proxy.tooltip_text);
        if ("Visible" in props) this.setVisible(proxy.visible);
        if ("Name" in props) {
            this.labelName = (proxy.name || this.labelName).replace(/^org\.x\.StatusIcon\./, "");
            if (this.applet && !this.applet._inRelayout) {
                this.applet.queueRelayout();
            }
        }
        if ("PrimaryMenuIsOpen" in props || "SecondaryMenuIsOpen" in props) {
            if (!proxy.primary_menu_is_open && !proxy.secondary_menu_is_open) {
                this.actor.sync_hover();
            }
        }
    }

    refresh() {
        this.setIconName(this.proxy.icon_name);
        this.setTooltipText(this.proxy.tooltip_text);
        this.setVisible(this.proxy.visible);
        this.setOrientation(this.applet.orientation);
        this.actor.queue_relayout();
    }

    setOrientation(orientation) {
        this.actor.vertical = orientation === St.Side.LEFT || orientation === St.Side.RIGHT;
    }

    setIconName(iconName) {
        if (this._settingIcon) return;
        this._settingIcon = true;
        try {
            if (!iconName) {
                this.icon_holder.hide();
                return;
            }

            let type = iconName.match(/symbolic/) ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR;
            this.iconSize = this.applet.getEffectiveIconSize(type, this._inPopup);

            if (iconName.includes("/") && type !== St.IconType.SYMBOLIC) {
                this.icon_loader_handle = St.TextureCache.get_default().load_image_from_file_async(
                    iconName,
                    this.actor.vertical ? this.iconSize : -1,
                    this.iconSize,
                    (...args) => this._onImageLoaded(...args)
                );
                return;
            }

            this.icon_holder.child = new St.Icon({
                icon_type: type,
                icon_size: this.iconSize,
                icon_name: iconName
            });
            this.icon_holder.show();
        } finally {
            this._settingIcon = false;
        }
    }

    _onImageLoaded(_cache, handle, actor) {
        if (handle !== this.icon_loader_handle) return;
        this.icon_holder.child = actor;
        this.icon_holder.show();
    }

    setTooltipText(text) {
        if (text) {
            this._tooltip.preventShow = false;
            this._tooltip.set_markup(text);
        } else {
            this._tooltip.preventShow = true;
            this._tooltip.set_markup("");
        }
    }

    setVisible(visible) {
        let next = !!visible;
        if (this._appVisible === next) return;
        this._appVisible = next;
        if (this.applet) this.applet.queueRelayout();
    }

    onEnterEvent() {
        this._tooltip.preventShow = false;
    }

    getEventPositionInfo(actor) {
        let allocation = Cinnamon.util_get_transformed_allocation(actor);
        let x = Math.round(allocation.x1 / global.ui_scale);
        let y = Math.round(allocation.y1 / global.ui_scale);
        let w = Math.round((allocation.x2 - allocation.x1) / global.ui_scale);
        let h = Math.round((allocation.y2 - allocation.y1) / global.ui_scale);

        switch (this.applet.orientation) {
            case St.Side.TOP:
                return [x, y + h, Gtk.PositionType.TOP];
            case St.Side.LEFT:
                return [x + w, y, Gtk.PositionType.LEFT];
            case St.Side.RIGHT:
                return [x, y, Gtk.PositionType.RIGHT];
            case St.Side.BOTTOM:
            default:
                return [x, y, Gtk.PositionType.BOTTOM];
        }
    }

    onButtonPressEvent(actor, event) {
        this._tooltip.hide();
        this._tooltip.preventShow = true;

        // Ctrl+right-click → toggle pin/overflow for this icon
        if (
            event.get_button() === Clutter.BUTTON_SECONDARY &&
            event.get_state() & Clutter.ModifierType.CONTROL_MASK
        ) {
            this.applet.openIconManageMenu(this, event);
            return Clutter.EVENT_STOP;
        }

        let [x, y, o] = this.getEventPositionInfo(actor);
        this.proxy.call_button_press(x, y, event.get_button(), event.get_time(), o, null, null);
        return Clutter.EVENT_STOP;
    }

    onButtonReleaseEvent(actor, event) {
        let [x, y, o] = this.getEventPositionInfo(actor);
        this.proxy.call_button_release(x, y, event.get_button(), event.get_time(), o, null, null);
        return Clutter.EVENT_STOP;
    }

    onScrollEvent(_actor, event) {
        let direction = event.get_scroll_direction();
        if (direction === Clutter.ScrollDirection.SMOOTH || !XApp) {
            return Clutter.EVENT_STOP;
        }

        let x_dir = XApp.ScrollDirection.UP;
        let delta = 0;
        if (direction === Clutter.ScrollDirection.UP) {
            x_dir = XApp.ScrollDirection.UP;
            delta = -1;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            x_dir = XApp.ScrollDirection.DOWN;
            delta = 1;
        } else if (direction === Clutter.ScrollDirection.LEFT) {
            x_dir = XApp.ScrollDirection.LEFT;
            delta = -1;
        } else if (direction === Clutter.ScrollDirection.RIGHT) {
            x_dir = XApp.ScrollDirection.RIGHT;
            delta = 1;
        }

        this.proxy.call_scroll(delta, x_dir, event.get_time(), null, null);
        return Clutter.EVENT_STOP;
    }

    setInPopup(inPopup) {
        this._inPopup = !!inPopup;
        this.applyVisualSize();
    }

    applyVisualSize() {
        let size = this.applet.getEffectiveIconSize(
            this.proxy.icon_name && this.proxy.icon_name.match(/symbolic/)
                ? St.IconType.SYMBOLIC
                : St.IconType.FULLCOLOR,
            this._inPopup
        );
        let child = this.icon_holder.child;
        if (!child) return;

        // Resize the local actor only. Updating proxy.icon_size while moving an
        // icon can synchronously emit DBus property changes and recurse.
        if (child instanceof St.Icon) {
            child.icon_size = size;
        } else {
            child.set_size(size, size);
        }
        this.icon_holder.set_size(size, size);
        this.iconSize = size;
    }

    destroy() {
        if (this._proxyChangeId) {
            this.proxy.disconnect(this._proxyChangeId);
            this._proxyChangeId = 0;
        }
        if (this._tooltip) {
            this._tooltip.destroy();
            this._tooltip = null;
        }
        if (this.actor) {
            this.actor.destroy();
            this.actor = null;
        }
    }
}

class LegacyTrayIcon {
    constructor(applet, icon, role) {
        this.applet = applet;
        this.kind = "legacy";
        this.role = role;
        this.id = "legacy:" + String(role).toLowerCase();
        this.labelName = role;
        this._appVisible = true;
        this._inPopup = false;
        this._icon = icon;

        this.actor = new St.Widget({
            style_class: "trayflow-cell",
            reactive: true,
            track_hover: true,
            layout_manager: new Clutter.BinLayout(),
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        this._displayIcon = new St.Icon({
            icon_name: this._resolveIconName(role),
            icon_type: St.IconType.FULLCOLOR,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        // Keep the real XEmbed actor mapped so its application menu remains
        // functional, but paint a reliable themed icon above it. XEmbed
        // windows commonly render transparent when moved into popup actors.
        icon.opacity = 0;
        this.actor.add_actor(icon);
        this.actor.add_actor(this._displayIcon);

        try {
            icon.set_x_align(Clutter.ActorAlign.CENTER);
            icon.set_y_align(Clutter.ActorAlign.FILL);
            this.actor.set_y_align(Clutter.ActorAlign.FILL);
        } catch (e) {}

        this._pressId = this.actor.connect(
            "button-press-event",
            Lang.bind(this, this.onButtonPressEvent)
        );
        this._releaseId = this.actor.connect(
            "button-release-event",
            (_actor, event) => this._forwardEvent(event)
        );
        this._scrollId = this.actor.connect(
            "scroll-event",
            (_actor, event) => this._forwardEvent(event)
        );
        this.actor.connect("enter-event", () => {
            this.actor.add_style_pseudo_class("active");
            return Clutter.EVENT_PROPAGATE;
        });
        this.actor.connect("leave-event", () => {
            this.actor.remove_style_pseudo_class("active");
            return Clutter.EVENT_PROPAGATE;
        });

        this._readyId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._readyId = 0;
            if (!this._icon || this._icon.is_finalized()) {
                return GLib.SOURCE_REMOVE;
            }

            this._icon.reactive = true;
            this._icon.visible = true;
            this._icon.opacity = 0;
            this.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _resolveIconName(role) {
        let normalized = String(role).toLowerCase();
        let candidates = [
            LEGACY_ICON_ALIASES[normalized],
            normalized,
            normalized.replace(/-app$/, ""),
            "application-x-executable"
        ].filter(Boolean);

        let theme = Gtk.IconTheme.get_default();
        for (let name of candidates) {
            try {
                if (theme.has_icon(name)) return name;
            } catch (e) {}
        }
        return "application-x-executable";
    }

    _applySize() {
        if (!this._icon || this._icon.is_finalized()) return;
        let size = this.applet.getEffectiveIconSize(
            St.IconType.FULLCOLOR,
            this._inPopup
        );
        this._icon.set_size(1, 1);
        this._displayIcon.icon_size = size;
    }

    refresh() {
        try {
            this._applySize();
        } catch (e) {
            global.logWarning("trayflow: legacy icon resize failed: " + e);
        }
    }

    setInPopup(inPopup) {
        let changed = this._inPopup !== !!inPopup;
        this._inPopup = !!inPopup;
        if (changed && !this._readyId) this.refresh();
    }

    onButtonPressEvent(_actor, event) {
        if (
            event.get_button() === Clutter.BUTTON_SECONDARY &&
            event.get_state() & Clutter.ModifierType.CONTROL_MASK
        ) {
            this.applet.openIconManageMenu(this, event);
            return Clutter.EVENT_STOP;
        }
        return this._forwardEvent(event);
    }

    _forwardEvent(event) {
        if (!this._icon || this._icon.is_finalized()) {
            return Clutter.EVENT_PROPAGATE;
        }

        let type = event.type();
        if (type === Clutter.EventType.BUTTON_PRESS) {
            global.begin_modal(Meta.ModalOptions.POINTER_ALREADY_GRABBED, event.time);
        }

        let result = this._icon.handle_event(type, event);

        if (type === Clutter.EventType.BUTTON_PRESS) {
            global.end_modal(event.time);
        }
        return result;
    }

    destroy() {
        if (this._readyId) {
            GLib.source_remove(this._readyId);
            this._readyId = 0;
        }
        try {
            if (this._icon && this._icon.get_parent() === this.actor) {
                this.actor.remove_actor(this._icon);
            }
        } catch (e) {}
        if (this.actor) {
            this.actor.destroy();
            this.actor = null;
        }
        this._icon = null;
    }
}

class TrayFlowApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.orientation = orientation;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.remove_style_class_name("applet-box");
        this.actor.add_style_class_name("trayflow");
        this.actor.set_important(true);

        this.icons = {}; // id -> icon wrapper
        this.ignoredXApp = {};
        this._hoverOpenId = 0;
        this._leaveCloseId = 0;
        this._scaleUpdateId = 0;
        this._relayoutIdleId = 0;
        this._uiRefreshIdleId = 0;
        this._legacyRedisplayId = 0;
        this._legacyStarted = false;
        this.xappTray = true;
        this.legacyTray = true;

        this._signalManager = new SignalManager.SignalManager(null);

        this._buildUi();
        this._bindSettings(instance_id);
        this._buildContextMenu();
        this._updatePadding();
    }

    _buildUi() {
        let vertical = this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT;

        this.pinnedBox = new St.BoxLayout({
            style_class: "trayflow-pinned",
            vertical: vertical,
            x_expand: false,
            y_expand: true
        });

        // Dedicated box for legacy XEmbed icons (never reparented during XApp relayout)
        this.legacyBox = new St.BoxLayout({
            style_class: "trayflow-pinned",
            vertical: vertical,
            x_expand: false,
            y_expand: true
        });

        this.chevron = new St.Button({
            style_class: "applet-box trayflow-chevron",
            reactive: true,
            track_hover: true
        });
        this.chevronIcon = new St.Icon({
            icon_name: "pan-up-symbolic",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: this.getPanelIconSize(St.IconType.SYMBOLIC)
        });
        this.chevron.set_child(this.chevronIcon);
        this.chevron.connect("clicked", () => this._onChevronClicked());
        this.chevron.connect("enter-event", () => this._onChevronEnter());
        this.chevron.connect("leave-event", () => this._onChevronLeave());

        this.actor.add_actor(this.pinnedBox);
        this.actor.add_actor(this.legacyBox);
        this.actor.add_actor(this.chevron);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        this.popupBox = new St.BoxLayout({
            style_class: "trayflow-popup",
            vertical: true,
            reactive: true,
            track_hover: true
        });

        this.overflowGrid = new St.BoxLayout({
            style_class: "trayflow-popup-grid",
            vertical: true,
            x_expand: false,
            y_expand: false
        });
        this._overflowRows = [];

        this.emptyLabel = new St.Label({
            style_class: "popup-inactive-menu-item trayflow-empty",
            text: _("No hidden icons"),
            reactive: false
        });

        this.popupBox.add_child(this.overflowGrid);
        this.popupBox.add_child(this.emptyLabel);
        this.popupBox.connect("enter-event", () => {
            this._cancelLeaveTimer();
            return Clutter.EVENT_PROPAGATE;
        });
        this.popupBox.connect("leave-event", () => {
            this._onOverflowLeave();
            return Clutter.EVENT_PROPAGATE;
        });

        // Put the grid directly in the popup (avoid PopupBaseMenuItem quirks)
        this.menu.box.add_child(this.popupBox);
        this.menu.actor.reactive = true;
        this.menu.actor.connect("enter-event", () => {
            this._cancelLeaveTimer();
            return Clutter.EVENT_PROPAGATE;
        });
        this.menu.actor.connect("leave-event", () => {
            this._onOverflowLeave();
            return Clutter.EVENT_PROPAGATE;
        });

        this.menu.connect("open-state-changed", (_m, open) => {
            this._cancelLeaveTimer();
            if (open && this.closeOnLeave) {
                // If the pointer never enters the flyout, still dismiss it.
                this._scheduleLeaveClose();
            }
        });
    }

    _bindSettings(instance_id) {
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, instance_id);

        this.settings.bind("default-visibility", "defaultVisibility", () => this.queueUiRefresh());
        this.settings.bind("open-on-click", "openOnClick", null);
        this.settings.bind("open-on-hover", "openOnHover", null);
        this.settings.bind("hover-open-delay", "hoverOpenDelay", null);
        this.settings.bind("close-on-leave", "closeOnLeave", null);
        this.settings.bind("leave-close-delay", "leaveCloseDelay", null);
        this.settings.bind("always-show-chevron", "alwaysShowChevron", () => this.queueUiRefresh());
        this.settings.bind("panel-icon-padding", "panelIconPadding", () => this.queueUiRefresh());
        this.settings.bind("chevron-icon", "chevronIconName", () => this.queueUiRefresh());
        this.settings.bind("sort-icons", "sortIcons", () => this.queueUiRefresh());
        this.settings.bind("popup-columns", "popupColumns", () => this.queueUiRefresh());
        this.settings.bind("popup-icon-size", "popupIconSize", () => this.queueUiRefresh());
        this.settings.bind("popup-padding", "popupPadding", () => this.queueUiRefresh());
        this.settings.bind("popup-spacing", "popupSpacing", () => this.queueUiRefresh());

        this.iconStates = this.settings.getValue("icon-states") || {};
        if (typeof this.iconStates !== "object" || Array.isArray(this.iconStates)) {
            this.iconStates = {};
        }

        this._updateChevronIcon();
        this._updatePopupStyle();
    }

    on_reset_icon_states() {
        this.iconStates = {};
        this._saveIconStates();
        this.relayoutIcons();
    }

    _saveIconStates() {
        try {
            this.settings.setValue("icon-states", this.iconStates);
        } catch (e) {
            global.logError("trayflow: failed to save icon states: " + e);
        }
    }

    _buildContextMenu() {
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.manageSubMenu = new PopupMenu.PopupSubMenuMenuItem(_("Tray icons"));
        this._applet_context_menu.addMenuItem(this.manageSubMenu);
        this._applet_context_menu.connect("open-state-changed", (_m, open) => {
            if (open) this._populateManageSubmenu();
        });
    }

    _populateManageSubmenu() {
        this.manageSubMenu.menu.removeAll();

        let ids = Object.keys(this.icons);
        if (ids.length === 0) {
            this.manageSubMenu.menu.addMenuItem(
                new PopupMenu.PopupMenuItem(_("No icons yet"), { reactive: false })
            );
            return;
        }

        ids.sort((a, b) => {
            return this.icons[a].labelName.localeCompare(this.icons[b].labelName);
        });

        for (let id of ids) {
            let icon = this.icons[id];
            let sub = new PopupMenu.PopupSubMenuMenuItem(icon.labelName);

            for (let [label, state] of [
                [_("Pinned to panel"), VIS.PINNED],
                [_("Overflow popup"), VIS.OVERFLOW],
                [_("Hidden"), VIS.HIDDEN]
            ]) {
                let item = new PopupMenu.PopupMenuItem(label);
                if (this.getIconVisibility(id) === state) {
                    item.setOrnament(PopupMenu.OrnamentType.DOT);
                }
                item.connect("activate", () => {
                    this.setIconVisibility(id, state);
                });
                sub.menu.addMenuItem(item);
            }

            this.manageSubMenu.menu.addMenuItem(sub);
        }
    }

    openIconManageMenu(icon) {
        this.setIconVisibility(
            icon.id,
            this.getIconVisibility(icon.id) === VIS.PINNED ? VIS.OVERFLOW : VIS.PINNED
        );
        Main.notify(
            _("TrayFlow"),
            icon.labelName +
                ": " +
                (this.getIconVisibility(icon.id) === VIS.PINNED
                    ? _("pinned to panel")
                    : _("moved to overflow")) +
                "\n" +
                _("Tip: right-click the applet → Tray icons for Hidden.")
        );
    }

    getIconVisibility(id) {
        let state = this.iconStates[id];
        if (state === VIS.PINNED || state === VIS.OVERFLOW || state === VIS.HIDDEN) {
            return state;
        }
        return this.defaultVisibility || VIS.OVERFLOW;
    }

    setIconVisibility(id, state) {
        this.iconStates[id] = state;
        this._saveIconStates();
        this.relayoutIcons();
    }

    getEffectiveIconSize(type, inPopup) {
        if (inPopup && this.popupIconSize > 0) {
            return this.popupIconSize;
        }
        return this.getPanelIconSize(type || St.IconType.FULLCOLOR);
    }

    _updatePadding() {
        let p = this.panelIconPadding || 0;
        this.pinnedBox.set_style(`spacing: ${p}px;`);
        this.legacyBox.set_style(`spacing: ${p}px;`);
    }

    _updatePopupStyle() {
        let pad = this.popupPadding || 6;
        let space = this.popupSpacing || 2;
        this.popupBox.set_style(`padding: ${pad}px;`);
        this.overflowGrid.set_style(`spacing: ${space}px;`);
        if (this._overflowRows) {
            for (let row of this._overflowRows) {
                row.set_style(`spacing: ${space}px;`);
            }
        }
    }

    _popupColumnCount(iconCount) {
        let cols = parseInt(this.popupColumns, 10);
        if (!(cols > 0)) cols = 4;
        if (cols > 12) cols = 12;
        if (iconCount > 0) cols = Math.min(cols, iconCount);
        return Math.max(1, cols);
    }

    _clearOverflowRows() {
        let rows = this.overflowGrid.get_children();
        for (let row of rows) {
            let kids = row.get_children ? row.get_children() : [];
            for (let kid of kids) {
                try {
                    row.remove_child(kid);
                } catch (e) {
                    try {
                        row.remove_actor(kid);
                    } catch (e2) {}
                }
            }
            try {
                this.overflowGrid.remove_child(row);
            } catch (e) {}
            try {
                row.destroy();
            } catch (e) {}
        }
        this._overflowRows = [];
    }

    _fillOverflowGrid(overflow) {
        this._clearOverflowRows();
        if (!overflow.length) return;

        let cols = this._popupColumnCount(overflow.length);
        let space = this.popupSpacing || 2;

        for (let i = 0; i < overflow.length; i++) {
            let rowIndex = Math.floor(i / cols);
            if (!this._overflowRows[rowIndex]) {
                let row = new St.BoxLayout({
                    style_class: "trayflow-popup-row",
                    vertical: false,
                    x_expand: false,
                    y_expand: false
                });
                row.set_style(`spacing: ${space}px;`);
                this.overflowGrid.add_child(row);
                this._overflowRows[rowIndex] = row;
            }
            overflow[i].setInPopup(true);
            this._overflowRows[rowIndex].add_child(overflow[i].actor);
        }
    }

    _updateChevronIcon() {
        let name = this.chevronIconName || "pan-up-symbolic";
        this.chevronIcon.icon_name = name;
        this.chevronIcon.icon_size = this.getPanelIconSize(St.IconType.SYMBOLIC);
    }

    _updateChevronVisibility() {
        let overflowCount = this._countByVisibility(VIS.OVERFLOW);
        if (this.alwaysShowChevron || overflowCount > 0) {
            this.chevron.show();
        } else {
            this.chevron.hide();
            if (this.menu.isOpen) this.menu.close(false);
        }
    }

    _countByVisibility(vis) {
        let n = 0;
        for (let id in this.icons) {
            let icon = this.icons[id];
            if (icon._appVisible === false) continue;
            if (this.getIconVisibility(id) === vis) n++;
        }
        return n;
    }

    _onChevronClicked() {
        if (!this.openOnClick) return;
        this._cancelLeaveTimer();
        this.menu.toggle();
    }

    _onChevronEnter() {
        if (!this.openOnHover) return;
        this._cancelLeaveTimer();
        this._cancelHoverOpenTimer();
        this._hoverOpenId = Mainloop.timeout_add(this.hoverOpenDelay || 0, () => {
            this._hoverOpenId = 0;
            if (!this.menu.isOpen) this.menu.open(true);
            return GLib.SOURCE_REMOVE;
        });
    }

    _onChevronLeave() {
        this._cancelHoverOpenTimer();
        this._onOverflowLeave();
    }

    _onOverflowLeave() {
        if (!this.closeOnLeave || !this.menu.isOpen) return;
        this._scheduleLeaveClose();
    }

    _pointerOverOverflow() {
        try {
            let [x, y] = global.get_pointer();
            return this._actorContainsPoint(this.menu.actor, x, y)
                || this._actorContainsPoint(this.chevron, x, y)
                || this._actorContainsPoint(this.popupBox, x, y);
        } catch (e) {
            return false;
        }
    }

    _actorContainsPoint(actor, x, y) {
        if (!actor || !actor.get_stage || !actor.get_stage()) return false;
        let box = Cinnamon.util_get_transformed_allocation(actor);
        return x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2;
    }

    _scheduleLeaveClose() {
        this._cancelLeaveTimer();
        this._leaveCloseId = Mainloop.timeout_add(this.leaveCloseDelay || 2000, () => {
            this._leaveCloseId = 0;
            if (!this.menu.isOpen) return GLib.SOURCE_REMOVE;
            if (this._pointerOverOverflow()) {
                // Still aiming at an icon; wait another interval.
                this._scheduleLeaveClose();
                return GLib.SOURCE_REMOVE;
            }
            this.menu.close(true);
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelHoverOpenTimer() {
        if (this._hoverOpenId) {
            Mainloop.source_remove(this._hoverOpenId);
            this._hoverOpenId = 0;
        }
    }

    _cancelLeaveTimer() {
        if (this._leaveCloseId) {
            Mainloop.source_remove(this._leaveCloseId);
            this._leaveCloseId = 0;
        }
    }

    on_applet_added_to_panel() {
        this._startSources();

        this._signalManager.connect(Main.systrayManager, "changed", () => {
            this._onSystrayRolesChanged();
        });
        this._signalManager.connect(global.settings, "changed::panel-edit-mode", () => {
            this._onPanelEditModeChanged();
        });
        this._signalManager.connect(global, "scale-changed", () => this._onScaleChanged());
        if (this.panel) {
            this._signalManager.connect(this.panel, "icon-size-changed", () => this._refreshAllIcons());
        }
        try {
            this._signalManager.connect(Gtk.IconTheme.get_default(), "changed", () =>
                this._refreshAllIcons()
            );
        } catch (e) {}
    }

    on_applet_removed_from_panel() {
        this._cancelHoverOpenTimer();
        this._cancelLeaveTimer();
        if (this._scaleUpdateId) {
            Mainloop.source_remove(this._scaleUpdateId);
            this._scaleUpdateId = 0;
        }
        if (this._relayoutIdleId) {
            Mainloop.source_remove(this._relayoutIdleId);
            this._relayoutIdleId = 0;
        }
        if (this._uiRefreshIdleId) {
            Mainloop.source_remove(this._uiRefreshIdleId);
            this._uiRefreshIdleId = 0;
        }
        if (this._legacyRedisplayId) {
            Mainloop.source_remove(this._legacyRedisplayId);
            this._legacyRedisplayId = 0;
        }

        this.monitor = null;
        this._legacyStarted = false;
        this._signalManager.disconnectAllSignals();

        for (let id in this.icons) {
            try {
                this.icons[id].destroy();
            } catch (e) {}
        }
        this.icons = {};

        if (this.settings) {
            this.settings.finalize();
        }
    }

    on_applet_reloaded() {
        global.trayReloading = true;
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        let vertical = orientation === St.Side.LEFT || orientation === St.Side.RIGHT;
        this.pinnedBox.vertical = vertical;
        if (this.legacyBox) this.legacyBox.vertical = vertical;
        this._updateChevronIcon();
        this._updateLegacyOrientation();
        this._refreshAllIcons();
        this.relayoutIcons();
    }

    on_panel_icon_size_changed() {
        this._updateChevronIcon();
        this._refreshAllIcons();
    }

    _onScaleChanged() {
        if (this._scaleUpdateId) Mainloop.source_remove(this._scaleUpdateId);
        this._scaleUpdateId = Mainloop.timeout_add(1000, () => {
            this._scaleUpdateId = 0;
            this._refreshAllIcons();
            return GLib.SOURCE_REMOVE;
        });
    }

    _onPanelEditModeChanged() {
        let reactive = !global.settings.get_boolean("panel-edit-mode");
        for (let id in this.icons) {
            if (this.icons[id].actor) this.icons[id].actor.reactive = reactive;
        }
    }

    _restartSources() {
        // Full reconnect of tray sources (settings toggle). Safer than half-stopping.
        this._signalManager.disconnectAllSignals();
        for (let id in this.icons) {
            try {
                this._detachIcon(this.icons[id]);
                this.icons[id].destroy();
            } catch (e) {}
        }
        this.icons = {};
        this.ignoredXApp = {};
        this.monitor = null;
        this._legacyStarted = false;

        this._startSources();

        // Re-bind panel lifecycle signals cleared above
        this._signalManager.connect(Main.systrayManager, "changed", () => {
            this._onSystrayRolesChanged();
        });
        this._signalManager.connect(global.settings, "changed::panel-edit-mode", () => {
            this._onPanelEditModeChanged();
        });
        this._signalManager.connect(global, "scale-changed", () => this._onScaleChanged());
        if (this.panel) {
            this._signalManager.connect(this.panel, "icon-size-changed", () => this._refreshAllIcons());
        }
        this.relayoutIcons();
    }

    _startSources() {
        if (this.xappTray !== false && XApp) {
            try {
                this.monitor = new XApp.StatusIconMonitor();
                this._signalManager.connect(this.monitor, "icon-added", this._onXAppAdded, this);
                this._signalManager.connect(this.monitor, "icon-removed", this._onXAppRemoved, this);
            } catch (e) {
                global.logError("trayflow: XApp monitor failed: " + e);
            }
        }

        if (this.legacyTray !== false) {
            try {
                if (!global.trayReloading) {
                    Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());
                }
                this._updateLegacyOrientation();
                this._signalManager.connect(
                    Main.statusIconDispatcher,
                    "status-icon-added",
                    this._onLegacyAdded,
                    this
                );
                this._signalManager.connect(
                    Main.statusIconDispatcher,
                    "status-icon-removed",
                    this._onLegacyRemoved,
                    this
                );
                this._signalManager.connect(
                    Main.statusIconDispatcher,
                    "before-redisplay",
                    this._onLegacyBeforeRedisplay,
                    this
                );
                this._legacyStarted = true;
                global.trayReloading = false;
                this._legacyRedisplayId = Mainloop.idle_add(() => {
                    this._legacyRedisplayId = 0;
                    if (this._legacyStarted) {
                        Main.statusIconDispatcher.redisplay();
                    }
                    return GLib.SOURCE_REMOVE;
                });
            } catch (e) {
                global.logError("trayflow: legacy tray failed: " + e);
            }
        }
    }

    _updateLegacyOrientation() {
        try {
            if (
                this.orientation === St.Side.LEFT ||
                this.orientation === St.Side.RIGHT
            ) {
                Main.statusIconDispatcher.set_tray_orientation(Clutter.Orientation.VERTICAL);
            } else {
                Main.statusIconDispatcher.set_tray_orientation(Clutter.Orientation.HORIZONTAL);
            }
        } catch (e) {}
    }

    _onXAppAdded(_monitor, icon_proxy) {
        let key = this._xappKey(icon_proxy);
        if (this.icons[key] || this.ignoredXApp[key]) return;

        if (this._shouldIgnoreXApp(icon_proxy)) {
            this.ignoredXApp[key] = icon_proxy;
            return;
        }

        try {
            let icon = new XAppTrayIcon(this, icon_proxy);
            // Use stable-ish id based on name for settings persistence
            let settingsId = "xapp:" + String(icon_proxy.name || key).toLowerCase();
            icon.id = settingsId;
            icon._rawKey = key;
            this.icons[settingsId] = icon;
            this.relayoutIcons();
        } catch (e) {
            global.logError("trayflow: add xapp icon failed: " + e);
        }
    }

    _onXAppRemoved(_monitor, icon_proxy) {
        let key = this._xappKey(icon_proxy);
        if (this.ignoredXApp[key]) {
            delete this.ignoredXApp[key];
            return;
        }

        for (let id in this.icons) {
            let icon = this.icons[id];
            if (icon.kind === "xapp" && icon._rawKey === key) {
                this._detachIcon(icon);
                icon.destroy();
                delete this.icons[id];
                this.relayoutIcons();
                return;
            }
        }
    }

    _xappKey(proxy) {
        try {
            return proxy.get_name() + proxy.get_object_path();
        } catch (e) {
            return String(proxy.name);
        }
    }

    _shouldIgnoreXApp(icon_proxy) {
        try {
            let hidden = Main.systrayManager.getRoles();
            let name = String(icon_proxy.name || "").toLowerCase();
            return hidden.indexOf(name) !== -1;
        } catch (e) {
            return false;
        }
    }

    _onSystrayRolesChanged() {
        // Re-evaluate ignored XApp icons when roles change
        for (let key in this.ignoredXApp) {
            let proxy = this.ignoredXApp[key];
            if (!this._shouldIgnoreXApp(proxy)) {
                delete this.ignoredXApp[key];
                this._onXAppAdded(this.monitor, proxy);
            }
        }
        for (let id in this.icons) {
            let icon = this.icons[id];
            if (icon.kind === "xapp" && this._shouldIgnoreXApp(icon.proxy)) {
                this._detachIcon(icon);
                icon.destroy();
                delete this.icons[id];
                this.ignoredXApp[icon._rawKey] = icon.proxy;
            }
        }
        this.relayoutIcons();
    }

    _onLegacyBeforeRedisplay() {
        // Match stock systray: fully clear old XEmbed actors before redisplay.
        let toRemove = [];
        for (let id in this.icons) {
            if (this.icons[id].kind === "legacy") toRemove.push(id);
        }
        for (let id of toRemove) {
            try {
                this._detachIcon(this.icons[id]);
                this.icons[id].destroy();
            } catch (e) {}
            delete this.icons[id];
        }
        this.queueRelayout();
    }

    _onLegacyAdded(_o, icon, role) {
        try {
            let roleName = String(role || "").toLowerCase();
            let hidden = Main.systrayManager.getRoles();
            if (hidden.indexOf(roleName) !== -1 || LEGACY_IGNORE_ROLES.indexOf(roleName) !== -1) {
                return;
            }

            let id = "legacy:" + String(role).toLowerCase();
            if (this.icons[id]) return;

            global.log("trayflow: Adding legacy systray: " + role);

            let trayIcon = new LegacyTrayIcon(this, icon, role);
            this.icons[id] = trayIcon;
            this.relayoutIcons();
        } catch (e) {
            global.logError("trayflow: legacy add failed: " + e);
        }
    }

    _onLegacyRemoved(_o, icon) {
        for (let id in this.icons) {
            let item = this.icons[id];
            if (item.kind !== "legacy") continue;
            try {
                if (item._icon === icon) {
                    this._detachIcon(item);
                    item.destroy();
                    delete this.icons[id];
                    this.relayoutIcons();
                    return;
                }
            } catch (e) {}
        }
    }

    _detachIcon(icon) {
        if (!icon || !icon.actor) return;
        let parent = icon.actor.get_parent();
        if (parent) {
            try {
                parent.remove_child(icon.actor);
            } catch (e) {
                try {
                    parent.remove_actor(icon.actor);
                } catch (e2) {}
            }
        }
    }

    _refreshAllIcons() {
        for (let id in this.icons) {
            try {
                this.icons[id].refresh();
            } catch (e) {}
        }
    }

    onLegacyIconEvent(icon, event) {
        let type = event.type();
        let button = icon.get_parent();
        if (!button) return Clutter.EVENT_PROPAGATE;

        if (type === Clutter.EventType.BUTTON_PRESS) {
            global.begin_modal(Meta.ModalOptions.POINTER_ALREADY_GRABBED, event.time);
        } else if (type === Clutter.EventType.ENTER) {
            button.add_style_pseudo_class("hover");
        } else if (type === Clutter.EventType.LEAVE) {
            button.remove_style_pseudo_class("hover");
        }

        let result = icon.handle_event(type, event);
        if (type === Clutter.EventType.BUTTON_PRESS) {
            global.end_modal(event.time);
        }
        return result;
    }

    relayoutIcons() {
        if (this._inRelayout) return;
        this._inRelayout = true;
        try {
            this._relayoutIconsImpl();
        } finally {
            this._inRelayout = false;
        }
    }

    queueRelayout() {
        if (this._relayoutQueued || this._inRelayout) return;
        this._relayoutQueued = true;
        this._relayoutIdleId = Mainloop.idle_add(() => {
            this._relayoutIdleId = 0;
            this._relayoutQueued = false;
            this.relayoutIcons();
            return GLib.SOURCE_REMOVE;
        });
    }

    queueUiRefresh() {
        if (this._uiRefreshQueued) return;
        this._uiRefreshQueued = true;
        this._uiRefreshIdleId = Mainloop.idle_add(() => {
            this._uiRefreshIdleId = 0;
            this._uiRefreshQueued = false;
            this._updatePadding();
            this._updatePopupStyle();
            this._updateChevronIcon();
            this._refreshAllIcons();
            this.relayoutIcons();
            return GLib.SOURCE_REMOVE;
        });
    }

    _relayoutIconsImpl() {
        // Reparent all live icons into either the panel or the overflow popup.
        for (let id in this.icons) {
            this._detachIcon(this.icons[id]);
        }

        this._clearOverflowRows();

        let pinned = [];
        let overflow = [];

        for (let id in this.icons) {
            let icon = this.icons[id];

            if (icon._appVisible === false) {
                icon.actor.hide();
                continue;
            }
            icon.actor.show();

            let vis = this.getIconVisibility(id);
            if (vis === VIS.HIDDEN) {
                continue;
            } else if (vis === VIS.PINNED) {
                pinned.push(icon);
            } else {
                overflow.push(icon);
            }
        }

        if (this.sortIcons) {
            let cmp = (a, b) => a.labelName.localeCompare(b.labelName);
            pinned.sort(cmp);
            overflow.sort(cmp);
        }

        for (let icon of pinned) {
            icon.setInPopup(false);
            this.pinnedBox.add_child(icon.actor);
        }

        this._fillOverflowGrid(overflow);

        this.emptyLabel.visible = overflow.length === 0;
        this.overflowGrid.visible = overflow.length > 0;
        this._updateChevronVisibility();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new TrayFlowApplet(metadata, orientation, panel_height, instance_id);
}
