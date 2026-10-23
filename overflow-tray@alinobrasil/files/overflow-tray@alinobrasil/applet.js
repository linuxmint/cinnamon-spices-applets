// Overflow Tray: a Windows-style system tray for Cinnamon.
//
// Based on Cinnamon's XApp Status Applet (xapp-status@cinnamon.org),
// Copyright the Linux Mint team, licensed under the GNU GPL v2 or later.
// Changes: pinned icons stay on the panel, the rest go into a popup behind an arrow.

const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;
const Gtk = imports.gi.Gtk;
const XApp = imports.gi.XApp;
const GLib = imports.gi.GLib;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

const UUID = "overflow-tray@alinobrasil";

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

const HORIZONTAL_STYLE = 'padding-left: 2px; padding-right: 2px; padding-top: 0; padding-bottom: 0';
const VERTICAL_STYLE = 'padding-left: 0; padding-right: 0; padding-top: 2px; padding-bottom: 2px';

// Delay between closing the overflow popup and forwarding a click to the app,
// so Cinnamon's modal grab is gone before the app tries to open its own menu.
const FORWARD_CLICK_DELAY_MS = 50;

function firstLine(text) {
    if (!text) {
        return "";
    }

    return text.replace(/<[^>]*>/g, "")
               .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
               .split("\n")[0].trim();
}

// Names like ":1.438", "org.freedesktop.statusnotifieritem-21954-1" or
// "2 unread messages" change between sessions, so they can't be remembered.
function isStableText(text) {
    return !!text && !text.includes("\n") && !/\b\d+\b/.test(text);
}

// Every key an icon can be remembered by right now, most specific first. An app can
// report different ones over time (Betterbird is "betterbird" with no new mail, but
// "2 unread messages" with some), so placement is saved under all of them.
function computeIconKeys(proxy) {
    let keys = [];

    let name = (proxy.name || "").replace("org.x.StatusIcon.", "").trim();
    if (isStableText(name)) {
        keys.push(name);
    }

    let tooltip = firstLine(proxy.tooltip_text);
    if (isStableText(tooltip)) {
        keys.push("tooltip:" + tooltip);
    }

    // Icons written to temp locations get a new filename every run.
    let iconName = (proxy.icon_name || "").trim();
    if (iconName.startsWith("/") && !/^\/(dev\/shm|tmp|run)\//.test(iconName)) {
        keys.push("path:" + GLib.path_get_dirname(iconName));
    }

    return keys;
}

// Returns [id, stable]. Once an icon gets a stable id it keeps it for its lifetime.
function computeIconId(proxy) {
    let keys = computeIconKeys(proxy);
    if (keys.length > 0) {
        return [keys[0], true];
    }

    let iconName = (proxy.icon_name || "").trim();
    if (iconName && !iconName.startsWith("/")) {
        return ["icon:" + iconName, false];
    }

    return ["name:" + (proxy.name || "").trim(), false];
}


class RecorderIcon {
    constructor(applet) {
        this.applet = applet;
        this.actor = new St.BoxLayout({
            style_class: "applet-box",
            reactive: false,
            visible: false,
            x_expand: true,
            y_expand: true
        });

        this.icon_holder = new St.Bin();
        this.iconSize = this.applet.getPanelIconSize(St.IconType.FULLCOLOR);

        this.actor.add_actor(this.icon_holder);

        this._indicator = new St.DrawingArea();
        this._indicator.connect("repaint", (area) => this._paint(area));
        this.icon_holder.add_actor(this._indicator);

        this._recordListenerId = Main.screenRecorder.connect("recording", () => this._recordingStateChanged());
        this._recordingStateChanged();

        this.refresh();
    }

    _recordingStateChanged() {
        this.actor.visible = Main.screenRecorder.recording;
        this._indicator.queue_repaint();
    }

    _paint(area) {
        let [width, height] = area.get_surface_size();
        let size = Math.max(width, height);
        let node = area.get_theme_node();
        let border = node.get_foreground_color();

        let cr = area.get_context();

        let color = new Clutter.Color({ red: 255, green: 0, blue: 0, alpha: 255 });
        Clutter.cairo_set_source_color(cr, color);

        cr.arc(
            width / 2,
            height / 2,
            size / 4.0,
            0.0,
            2.0 * Math.PI
        )

        cr.fillPreserve();
        Clutter.cairo_set_source_color(cr, border);
        cr.stroke();
        cr.$dispose();
    }

    refresh() {
        this.setOrientation(this.applet.orientation);
        this._indicator.set_size(this.iconSize, this.iconSize);
        this._indicator.queue_repaint();
    }

    setOrientation(orientation) {
        switch (orientation) {
            case St.Side.TOP:
            case St.Side.BOTTOM:
                this.actor.vertical = false;
                this.actor.remove_style_class_name("vertical");
                break;
            case St.Side.LEFT:
            case St.Side.RIGHT:
                this.actor.vertical = true;
                this.actor.add_style_class_name("vertical");
                break;
        }
    }

    destroy() {
        if (this._recordListenerId > 0) {
            Main.screenRecorder.disconnect(this._recordListenerId);
            this._recordListenerId = 0;
        }
        this.actor.destroy();
    }
}

class XAppStatusIcon {
    constructor(applet, proxy) {
        this.name = proxy.get_name();
        this.applet = applet;
        this.proxy = proxy;

        this.iconName = null;
        this.inOverflow = false;
        [this.id, this.idStable] = computeIconId(proxy);
        this.keys = computeIconKeys(proxy);

        this.actor = new St.BoxLayout({
            style_class: "applet-box",
            reactive: !global.settings.get_boolean('panel-edit-mode'),
            track_hover: true,
            // The systray use a layout manager, we need to fill the space of the actor
            // or otherwise the menu will be displayed inside the panel.
            x_expand: true,
            y_expand: true
        });

        this.icon_holder = new St.Bin();
        this.iconSize = this.applet.getPanelIconSize(St.IconType.FULLCOLOR);

        this.proxy.icon_size = this.iconSize;

        this.label = new St.Label({
            'y-align': St.Align.END,
        });

        this.actor.add_actor(this.icon_holder);
        this.actor.add_actor(this.label);

        this._tooltip = new Tooltips.PanelItemTooltip(this, "", applet.orientation);

        this.actor.connect('button-press-event', (...args) => this.onButtonPressEvent(...args));
        this.actor.connect('button-release-event', (...args) => this.onButtonReleaseEvent(...args));
        this.actor.connect('scroll-event', (...args) => this.onScrollEvent(...args));
        this.actor.connect('enter-event', (...args) => this.onEnterEvent(...args));

        this._proxy_prop_change_id = this.proxy.connect('g-properties-changed', (...args) => this.on_properties_changed(...args));

        this.refresh();
    }

    on_properties_changed(proxy, changed_props, invalidated_props) {
        let prop_names = changed_props.deep_unpack();

        if ('IconName' in prop_names) {
            this.setIconName(proxy.icon_name);
        }
        if ('TooltipText' in prop_names) {
            this.setTooltipText(proxy.tooltip_text);
        }
        if ('Label' in prop_names) {
            this.setLabel(proxy.label);
        }
        if ('Visible' in prop_names) {
            this.setVisible(proxy.visible);
        }
        if ('Name' in prop_names) {
            this.applet.sortIcons();
        }
        if ('PrimaryMenuIsOpen' in prop_names) {
            if (!proxy.primary_menu_is_open) {
                this.actor.sync_hover();
            }
        }
        if ('SecondaryMenuIsOpen' in prop_names) {
            if (!proxy.secondary_menu_is_open) {
                this.actor.sync_hover();
            }
        }
        if ('Name' in prop_names || 'TooltipText' in prop_names || 'IconName' in prop_names) {
            if (this.updateId()) {
                this.applet.onIconIdChanged(this);
            }
        }
        return;
    }

    // Returns true if the id changed or the icon gained a key.
    updateId() {
        let changed = false;

        for (let key of computeIconKeys(this.proxy)) {
            if (!this.keys.includes(key)) {
                this.keys.push(key);
                changed = true;
            }
        }

        if (!this.idStable) {
            let [id, stable] = computeIconId(this.proxy);
            changed = changed || id !== this.id;

            this.id = id;
            this.idStable = stable;
        }

        return changed;
    }

    // Returns [name, detail] for the "Show on panel" menu. Tooltips often hold
    // status text ("59 updates available"), so they're only the detail when we have a name.
    getLabels() {
        let tooltip = firstLine(this.proxy.tooltip_text);
        let name;

        if (this.id.startsWith("tooltip:")) {
            name = this.id.substring("tooltip:".length);
        } else if (this.id.startsWith("path:")) {
            // "/opt/betterbird/chrome/icons/default" -> "betterbird"
            let parts = this.id.substring("path:".length).split("/").filter(p => p);
            let optIndex = parts.indexOf("opt");
            name = (optIndex >= 0 && parts[optIndex + 1]) ? parts[optIndex + 1] : parts[parts.length - 1];
        } else if (this.idStable) {
            name = this.id.replace(/\.py$/, "").replace(/[_-]/g, " ");
        } else {
            name = tooltip || (this.proxy.name || "").replace("org.x.StatusIcon.", "") || this.id;
            tooltip = "";
        }

        name = name.charAt(0).toUpperCase() + name.substring(1);

        let truncate = (text, max) => text.length > max ? text.substring(0, max - 1) + "…" : text;
        let normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
        let detail = normalize(tooltip) === normalize(name) ? "" : tooltip;

        return [truncate(name, 30), truncate(detail, 30)];
    }

    refresh() {
        this.setIconName(this.proxy.icon_name);
        this.setLabel(this.proxy.label);
        this.setTooltipText(this.proxy.tooltip_text);
        this.setVisible(this.proxy.visible);
        this.setOrientation(this.applet.orientation);

        this.actor.queue_relayout();
    }

    setInOverflow(inOverflow) {
        this.inOverflow = inOverflow;

        // Panel styling makes symbolic icons near-white, which vanishes on a light popup.
        if (inOverflow) {
            this.actor.remove_style_class_name("applet-box");
            this.actor.add_style_class_name("overflow-tray-icon");
        } else {
            this.actor.remove_style_class_name("overflow-tray-icon");
            this.actor.add_style_class_name("applet-box");
        }

        this.setOrientation(this.applet.orientation);
    }

    setOrientation(orientation) {
        // Icons in the overflow popup are laid out like a top/bottom panel.
        if (this.inOverflow) {
            orientation = St.Side.BOTTOM;
        }

        switch (orientation) {
            case St.Side.TOP:
            case St.Side.BOTTOM:
                this.actor.vertical = false;
                this.actor.remove_style_class_name("vertical");
                break;
            case St.Side.LEFT:
            case St.Side.RIGHT:
                this.actor.vertical = true;
                this.actor.add_style_class_name("vertical");
                break;
        }
    }

    setIconName(iconName) {
        if (iconName) {
            let type, icon;

            if (iconName.match(/symbolic/)) {
                type = St.IconType.SYMBOLIC;
            }
            else {
                type = St.IconType.FULLCOLOR;
            }

            this.iconName = iconName;
            this.iconSize = this.applet.getPanelIconSize(type);
            this.proxy.icon_size = this.iconSize;

            // Assume symbolic icons would always be square/suitable for an StIcon.
            if (iconName.includes("/") && type != St.IconType.SYMBOLIC) {
                this.icon_loader_handle = St.TextureCache.get_default().load_image_from_file_async(
                    iconName,
                    /* If top/bottom panel, allow the image to expand horizontally,
                     * otherwise, restrict it to a square (but keep aspect ratio.) */
                    this.actor.vertical ? this.iconSize : -1,
                    this.iconSize,
                    (...args)=>this._onImageLoaded(...args)
                );

                return;
            }
            else {
                icon = new St.Icon( { "icon-type": type, "icon-size": this.iconSize, "icon-name": iconName });
                this.icon_holder.show();
                this.icon_holder.child = icon;
            }
        }
        else {
            this.iconName = null;
            this.icon_holder.hide();
        }
    }

    _onImageLoaded(cache, handle, actor, data=null) {
        if (handle !== this.icon_loader_handle) {
            global.logError(`${UUID}: Icon or image seems out of sync (${this.name})`);
            return;
        }

        this.icon_holder.child = actor;
        this.icon_holder.show();
    }

    setTooltipText(tooltipText) {
        if (tooltipText) {
            this._tooltip.preventShow = false;
        }
        else {
            tooltipText = "";
            this._tooltip.preventShow = true;
        }
        this._tooltip.set_markup(tooltipText);
        // If the tooltip is currently visible, then we might need to trigger a realignment of the tooltip after changing the text length
        if (this._tooltip.visible) {
           this._tooltip.hide();
           this._tooltip.show();
        }
    }

    setLabel(label) {
        if (label) {
            this.label.set_text(label);
        } else {
            this.label.set_text("");
        }

        this.show_label = (this.applet.orientation == St.Side.TOP || this.applet.orientation == St.Side.BOTTOM) &&
                           this.proxy.label.length > 0;

        this.label.visible = this.show_label;
    }

    setVisible(visible) {
        if (visible) {
            this.actor.show();
        }
        else {
            this.actor.hide();
        }

        this.applet.onIconVisibilityChanged(this);
    }

    onEnterEvent(actor, event) {
        this._tooltip.preventShow = false;
    }

    getEventPositionInfo(actor) {
        let allocation = Cinnamon.util_get_transformed_allocation(actor);

        let x = Math.round(allocation.x1 / global.ui_scale);
        let y = Math.round(allocation.y1 / global.ui_scale);
        let w = Math.round((allocation.x2 - allocation.x1) / global.ui_scale)
        let h = Math.round((allocation.y2 - allocation.y1) / global.ui_scale)

        let final_x, final_y, final_o;

        switch (this.applet.orientation) {
            case St.Side.TOP:
                final_x = x;
                final_y = y + h;
                final_o = Gtk.PositionType.TOP;
                break;
            case St.Side.BOTTOM:
            default:
                final_x = x;
                final_y = y;
                final_o = Gtk.PositionType.BOTTOM;
                break;
            case St.Side.LEFT:
                final_x = x + w;
                final_y = y
                final_o = Gtk.PositionType.LEFT;
                break;
            case St.Side.RIGHT:
                final_x = x;
                final_y = y;
                final_o = Gtk.PositionType.RIGHT;
                break;
        }

        return [final_x, final_y, final_o];
    }

    onButtonPressEvent(actor, event) {
        this._tooltip.hide();
        this._tooltip.preventShow = true;

        if (event.get_button() == Clutter.BUTTON_SECONDARY && event.get_state() & Clutter.ModifierType.CONTROL_MASK) {
            return Clutter.EVENT_PROPAGATE;
        }

        if (this.inOverflow) {
            this.applet.forwardClickFromOverflow(this, event);
            return Clutter.EVENT_STOP;
        }

        let [x, y, o] = this.getEventPositionInfo(actor);

        this.proxy.call_button_press(x, y, event.get_button(), event.get_time(), o, null, null);

        return Clutter.EVENT_STOP;
    }

    onButtonReleaseEvent(actor, event) {
        // Overflow clicks are forwarded as press + release in one go.
        if (this.inOverflow) {
            return Clutter.EVENT_STOP;
        }

        let [x, y, o] = this.getEventPositionInfo(actor);

        this.proxy.call_button_release(x, y, event.get_button(), event.get_time(), o, null, null);

        return Clutter.EVENT_STOP;
    }

    onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction != Clutter.ScrollDirection.SMOOTH) {
            let x_dir = XApp.ScrollDirection.UP;
            let delta = 0;

            if (direction == Clutter.ScrollDirection.UP) {
                x_dir = XApp.ScrollDirection.UP;
                delta = -1;
            } else if (direction == Clutter.ScrollDirection.DOWN) {
                x_dir = XApp.ScrollDirection.DOWN;
                delta = 1;
            } else if (direction == Clutter.ScrollDirection.LEFT) {
                x_dir = XApp.ScrollDirection.LEFT;
                delta = -1;
            } else if (direction == Clutter.ScrollDirection.RIGHT) {
                x_dir = XApp.ScrollDirection.RIGHT;
                delta = 1;
            }

            this.proxy.call_scroll(delta, x_dir, event.get_time(), null, null);
        }

        return Clutter.EVENT_STOP;
    }

    destroy() {
        this.proxy.disconnect(this._proxy_prop_change_id);
        this._proxy_prop_change_id = 0;
        this._tooltip.destroy();
    }
}

class CinnamonOverflowTrayApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.orientation = orientation;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.remove_style_class_name('applet-box');
        this.actor.set_important(true);  // ensure we get class details from the default theme if not present

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("new-icons-on-panel", "newIconsOnPanel", () => this.onPlacementSettingsChanged());
        this.settings.bind("columns", "columns", () => this.layoutOverflow());

        // The arrow sits to the left of (or above) the pinned icons, like on Windows.
        this._arrowBox = new St.Bin({ style_class: "applet-box", reactive: true, track_hover: true });
        this._arrowIcon = new St.Icon({ icon_type: St.IconType.SYMBOLIC });
        this._arrowBox.set_child(this._arrowIcon);
        this.actor.add_actor(this._arrowBox);

        this._arrowTooltip = new Tooltips.PanelItemTooltip({ actor: this._arrowBox, _applet: this }, _("Show hidden icons"), orientation);

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            this.manager_container = new St.BoxLayout( { vertical: false, style: HORIZONTAL_STYLE });
        } else {
            this.manager_container = new St.BoxLayout( { vertical: true, style: VERTICAL_STYLE });
        }

        this.actor.add_actor (this.manager_container);
        this.manager_container.show();

        this._recording_indicator = new RecorderIcon(this);
        this.manager_container.add_actor(this._recording_indicator.actor);

        // Left-click popup holding the hidden icons.
        this._overflowMenu = new Applet.AppletPopupMenu(this, orientation);
        this._menuManager.addMenu(this._overflowMenu);

        this._overflowLayout = new Clutter.GridLayout();
        this._overflowGrid = new St.Widget({ style_class: "overflow-tray-grid", layout_manager: this._overflowLayout });
        this._emptyLabel = new St.Label({ style_class: "overflow-tray-empty", text: _("No hidden icons") });
        this._overflowMenu.addActor(this._overflowGrid);
        this._overflowMenu.addActor(this._emptyLabel);

        this._overflowMenu.connect("open-state-changed", (menu, open) => {
            this._arrowTooltip.hide();
            this._arrowTooltip.preventShow = open;
            this._updateArrow();
        });

        // Right-click menu: one switch per icon, "Show on panel".
        this._placementSection = new PopupMenu.PopupMenuSection();
        this._applet_context_menu.addMenuItem(this._placementSection);
        this._placementMenuDirty = false;
        this._menuRebuildId = 0;
        this._forwardClickId = 0;

        this._applet_context_menu.connect("open-state-changed", (menu, open) => {
            if (!open && this._placementMenuDirty) {
                this._rebuildPlacementMenu();
            }
        });

        this.statusIcons = {};

        /* This doesn't really work 100% because applets get reloaded and we end up losing this
         * list. Not that big a deal in practice*/
        this.ignoredProxies = {};

        this.signalManager = new SignalManager.SignalManager(null);
        this._scaleUpdateId = 0;

        this._updateArrow();
        this.layoutOverflow();
        this._rebuildPlacementMenu();

        this.monitor = new XApp.StatusIconMonitor();
        this.signalManager.connect(this.monitor, "icon-added", this.onMonitorIconAdded, this);
        this.signalManager.connect(this.monitor, "icon-removed", this.onMonitorIconRemoved, this);

        this.signalManager.connect(Gtk.IconTheme.get_default(), 'changed', this.on_icon_theme_changed, this);
        this.signalManager.connect(global.settings, 'changed::panel-edit-mode', this.on_panel_edit_mode_changed, this);

        this.signalManager.connect(Main.systrayManager, "changed", this.onSystrayRolesChanged, this);

        /* HACK - the built-in on_panel_icon_size_changed() call only sends if the type (symbolic, fullcolor)
         * of the icon size matches the last type used by the applet.  Since this applet can contain both
         * types, listen to the panel signal directly, so we always receive the update. */
        this.signalManager.connect(this.panel, "icon-size-changed", this.icon_size_changed, this);
        this.signalManager.connect(global, "scale-changed", this.ui_scale_changed, this);
    }

    on_applet_clicked(event) {
        this._overflowMenu.toggle();
    }

    _updateArrow() {
        // Point towards where the popup opens, and flip while it's open.
        let open = this._overflowMenu && this._overflowMenu.isOpen;
        let iconName;

        switch (this.orientation) {
            case St.Side.TOP:
                iconName = open ? 'xsi-pan-up' : 'xsi-pan-down';
                break;
            case St.Side.LEFT:
                iconName = open ? 'xsi-pan-start' : 'xsi-pan-end';
                break;
            case St.Side.RIGHT:
                iconName = open ? 'xsi-pan-end' : 'xsi-pan-start';
                break;
            case St.Side.BOTTOM:
            default:
                iconName = open ? 'xsi-pan-down' : 'xsi-pan-up';
                break;
        }

        this._arrowIcon.icon_name = iconName;
        this._arrowIcon.icon_size = this.getPanelIconSize(St.IconType.SYMBOLIC);
    }

    getKey(icon_proxy) {
        let proxy_name = icon_proxy.get_name();
        let proxy_path = icon_proxy.get_object_path()

        return proxy_name + proxy_path;
    }

    onMonitorIconAdded(monitor, icon_proxy) {
        let key = this.getKey(icon_proxy);

        if (this.statusIcons[key]) {
            return;
        }

        if (this.shouldIgnoreStatusIcon(icon_proxy)) {
            global.log(`Hiding XAppStatusIcon (we have an applet): ${icon_proxy.name}`);
            this.ignoreStatusIcon(icon_proxy);

            return;
        }

        global.log(`Adding XAppStatusIcon: ${icon_proxy.name} (${key})`);
        this.addStatusIcon(icon_proxy);
    }

    onMonitorIconRemoved(monitor, icon_proxy) {
        let key = this.getKey(icon_proxy);

        if (!this.statusIcons[key]) {
            if (this.ignoredProxies[key]) {
                delete this.ignoredProxies[key];
            }

            return;
        }

        global.log(`Removing XAppStatusIcon: ${icon_proxy.name} (${key})`);
        this.removeStatusIcon(icon_proxy);
    }

    onSystrayRolesChanged() {
        let hiddenIcons = Main.systrayManager.getRoles();

        for (let i in this.statusIcons) {
            let icon_proxy = this.statusIcons[i].proxy;

            if (this.shouldIgnoreStatusIcon(icon_proxy)) {
                global.log(`Hiding XAppStatusIcon (we have an applet): ${icon_proxy.name} (${i})`);
                this.removeStatusIcon(icon_proxy);
                this.ignoreStatusIcon(icon_proxy);
            }
        }

        for (let i in this.ignoredProxies) {
            let icon_proxy = this.ignoredProxies[i];

            if (!this.shouldIgnoreStatusIcon(icon_proxy)) {
                delete this.ignoredProxies[i];

                global.log(`Restoring hidden XAppStatusIcon (native applet gone): ${icon_proxy.name} (${i})`);
                this.addStatusIcon(icon_proxy);
            }
        }
    }

    addStatusIcon(icon_proxy) {
        let key = this.getKey(icon_proxy);
        let statusIcon = new XAppStatusIcon(this, icon_proxy);

        this.statusIcons[key] = statusIcon;

        this.sortIcons();
    }

    removeStatusIcon(icon_proxy) {
        let key = this.getKey(icon_proxy);
        let statusIcon = this.statusIcons[key];

        if (!statusIcon) {
            return;
        }

        let parent = statusIcon.actor.get_parent();
        if (parent) {
            parent.remove_child(statusIcon.actor);
        }

        statusIcon.destroy();
        delete this.statusIcons[key];

        this.sortIcons();
    }

    ignoreStatusIcon(icon_proxy) {
        let key = this.getKey(icon_proxy);

        if (this.ignoredProxies[key]) {
            return;
        }

        this.ignoredProxies[key] = icon_proxy;
    }

    shouldIgnoreStatusIcon(icon_proxy) {
        let hiddenIcons = Main.systrayManager.getRoles();

        let name = (icon_proxy.name || "").toLowerCase();

        if (hiddenIcons.indexOf(name) != -1 ) {
            return true;
        }

        return false;
    }

    _sortFunc(a, b) {
        let asym = (a.proxy.icon_name || "").includes("-symbolic");
        let bsym = (b.proxy.icon_name || "").includes("-symbolic");

        if (asym && !bsym) {
            return 1;
        }

        if (bsym && !asym) {
            return -1;
        }

        return GLib.utf8_collate((a.proxy.name || "").replace("org.x.StatusIcon.", "").toLowerCase(),
                                 (b.proxy.name || "").replace("org.x.StatusIcon.", "").toLowerCase());
    }

    sortedIcons() {
        let icon_list = Object.values(this.statusIcons);
        icon_list.sort(this._sortFunc);

        return icon_list;
    }

    sortIcons() {
        this.onSystrayRolesChanged();
        this.arrangeIcons();
        this.queuePlacementMenuRebuild();
    }

    isPinned(icon) {
        let placement = this.settings.getValue("placement") || {};

        for (let key of [icon.id, ...icon.keys]) {
            if (key in placement) {
                return placement[key];
            }
        }

        return this.newIconsOnPanel;
    }

    setPinned(icon, pinned) {
        let placement = Object.assign({}, this.settings.getValue("placement") || {});

        for (let key of [icon.id, ...icon.keys]) {
            placement[key] = pinned;
        }

        this.settings.setValue("placement", placement);

        this.arrangeIcons();
    }

    // Puts each icon either on the panel or in the overflow popup, in sorted order.
    arrangeIcons() {
        let index = 0;

        for (let icon of this.sortedIcons()) {
            let inOverflow = !this.isPinned(icon);

            if (inOverflow !== icon.inOverflow) {
                icon.setInOverflow(inOverflow);
            }

            let parent = icon.actor.get_parent();

            if (inOverflow) {
                if (parent === this.manager_container) {
                    this.manager_container.remove_child(icon.actor);
                }
                continue;
            }

            if (parent !== this.manager_container) {
                if (parent) {
                    parent.remove_child(icon.actor);
                }
                this.manager_container.add_actor(icon.actor);
            }

            this.manager_container.set_child_at_index(icon.actor, index++);
        }

        this.manager_container.set_child_at_index(this._recording_indicator.actor, -1);

        this.layoutOverflow();
    }

    layoutOverflow() {
        for (let child of this._overflowGrid.get_children()) {
            this._overflowGrid.remove_child(child);
        }

        let columns = Math.max(1, this.columns || 4);
        let count = 0;

        for (let icon of this.sortedIcons()) {
            if (!icon.inOverflow || !icon.proxy.visible) {
                continue;
            }

            this._overflowLayout.attach(icon.actor, count % columns, Math.floor(count / columns), 1, 1);
            count++;
        }

        this._overflowGrid.visible = count > 0;
        this._emptyLabel.visible = count === 0;
    }

    forwardClickFromOverflow(icon, event) {
        let button = event.get_button();
        let time = event.get_time();
        let key = this.getKey(icon.proxy);

        // Open the app's menu next to the arrow, as if the icon were there.
        let [x, y, o] = icon.getEventPositionInfo(this._arrowBox);

        this._overflowMenu.close();

        if (this._forwardClickId > 0) {
            Mainloop.source_remove(this._forwardClickId);
        }

        this._forwardClickId = Mainloop.timeout_add(FORWARD_CLICK_DELAY_MS, () => {
            this._forwardClickId = 0;

            if (this.statusIcons[key] === icon) {
                icon.proxy.call_button_press(x, y, button, time, o, null, null);
                icon.proxy.call_button_release(x, y, button, time, o, null, null);
            }

            return GLib.SOURCE_REMOVE;
        });
    }

    onIconVisibilityChanged(icon) {
        if (this.statusIcons[this.getKey(icon.proxy)] !== icon) {
            return;  // still being constructed
        }

        if (icon.inOverflow) {
            this.layoutOverflow();
        }

        this.queuePlacementMenuRebuild();
    }

    onIconIdChanged(icon) {
        this.arrangeIcons();
        this.queuePlacementMenuRebuild();
    }

    onPlacementSettingsChanged() {
        this.arrangeIcons();
        this.queuePlacementMenuRebuild();
    }

    queuePlacementMenuRebuild() {
        if (this._menuRebuildId > 0) {
            return;
        }

        this._menuRebuildId = Mainloop.idle_add(() => {
            this._menuRebuildId = 0;

            // Don't pull items out from under the pointer; rebuild once it closes.
            if (this._applet_context_menu.isOpen) {
                this._placementMenuDirty = true;
            } else {
                this._rebuildPlacementMenu();
            }

            return GLib.SOURCE_REMOVE;
        });
    }

    _rebuildPlacementMenu() {
        this._placementMenuDirty = false;
        this._placementSection.removeAll();

        this._placementSection.addMenuItem(new PopupMenu.PopupMenuItem(_("Show on panel"), { reactive: false }));

        let seen = {};
        let count = 0;

        for (let icon of this.sortedIcons()) {
            if (!icon.proxy.visible || seen[icon.id]) {
                continue;
            }

            seen[icon.id] = true;

            let [name, detail] = icon.getLabels();
            let item = new PopupMenu.PopupSwitchMenuItem(name, this.isPinned(icon));
            item.setStatus(detail);
            item.connect("toggled", (item, state) => this.setPinned(icon, state));
            this._placementSection.addMenuItem(item);

            count++;
        }

        if (count === 0) {
            this._placementSection.addMenuItem(new PopupMenu.PopupMenuItem(_("No tray icons"), { reactive: false }));
        }
    }

    refreshIcons() {
        for (let owner in this.statusIcons) {
            let icon = this.statusIcons[owner];
            icon.refresh();
        }

        this._recording_indicator.refresh();
        this._updateArrow();
    }

    icon_size_changed() {
        this.refreshIcons();
    }

    on_icon_theme_changed() {
        this.refreshIcons();
    }

    ui_scale_changed() {
        if (this._scaleUpdateId > 0) {
            Mainloop.source_remove(this._scaleUpdateId);
        }

        this._scaleUpdateId = Mainloop.timeout_add(1500, () => {
            this.refreshIcons();

            this._scaleUpdateId = 0;
            return GLib.SOURCE_REMOVE;
        })
    }

    on_applet_removed_from_panel() {
        this.signalManager.disconnectAllSignals();

        if (this._menuRebuildId > 0) {
            Mainloop.source_remove(this._menuRebuildId);
            this._menuRebuildId = 0;
        }

        if (this._forwardClickId > 0) {
            Mainloop.source_remove(this._forwardClickId);
            this._forwardClickId = 0;
        }

        if (this._scaleUpdateId > 0) {
            Mainloop.source_remove(this._scaleUpdateId);
            this._scaleUpdateId = 0;
        }

        for (let key in this.statusIcons) {
            this.statusIcons[key].destroy();
            delete this.statusIcons[key];
        };

        for (let key in this.ignoredProxies) {
            delete this.ignoredProxies[key];
        };

        this._recording_indicator.destroy();
        this._recording_indicator = null;

        this._overflowMenu.destroy();
        this._arrowTooltip.destroy();
        this.settings.finalize();

        this.monitor = null;
    }

    on_panel_edit_mode_changed() {
        let reactive = !global.settings.get_boolean('panel-edit-mode');
        for (let owner in this.statusIcons) {
            let icon = this.statusIcons[owner];
            icon.actor.reactive = reactive;
        }
    }

    on_orientation_changed(newOrientation) {
        this.orientation = newOrientation;

        if (newOrientation == St.Side.TOP || newOrientation == St.Side.BOTTOM) {
            this.manager_container.vertical = false;
            this.manager_container.style = HORIZONTAL_STYLE;
        } else {
            this.manager_container.vertical = true;
            this.manager_container.style = VERTICAL_STYLE;
        }

        this.refreshIcons();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonOverflowTrayApplet(metadata, orientation, panel_height, instance_id);
}
