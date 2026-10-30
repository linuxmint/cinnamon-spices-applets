const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Interfaces = imports.misc.interfaces;
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
const Meta = imports.gi.Meta;
const AppletManager = imports.ui.appletManager;

const Gettext = imports.gettext;

const UUID = "xapp-status-collapsible@paradoxxx";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const SNI_NAME_RE = /statusnotifieritem-\d+-\d+$/;
const NAMES_VERSION = 2;

// Icons with no launcher in the menu: fixed label.
const FIXED_LABELS = {
    "nvidia-prime": "NVIDIA Prime",
    "process-monitor": _("Mint process monitor")
};

// Icons whose name does not match their launcher.
const DESKTOP_OVERRIDES = {
    "mintupdate.py": "mintupdate.desktop",
    "mintupdate": "mintupdate.desktop",
    "mintreport": "mintreport.desktop",
    "blueman": "blueman-manager.desktop"
};

function _norm(str) {
    return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Find the name shown in the main menu from an icon name / WM_CLASS.
function resolveAppName(raw) {
    if (!raw) {
        return null;
    }

    let base = raw.replace("org.x.StatusIcon.", "");
    let lower = base.toLowerCase();

    if (FIXED_LABELS[lower]) {
        return FIXED_LABELS[lower];
    }

    let appSys = Cinnamon.AppSystem.get_default();
    let candidates = [base, lower, lower.replace(/\.py$/, ""), lower.replace(/-app$/, ""),
                      lower.replace(/\s+/g, "-")];
    candidates = candidates.filter((c, i) => c && candidates.indexOf(c) == i);

    try {
        if (DESKTOP_OVERRIDES[lower]) {
            let app = appSys.lookup_app(DESKTOP_OVERRIDES[lower]);
            if (app) {
                return app.get_name();
            }
        }

        for (let c of candidates) {
            let app = appSys.lookup_app(c + ".desktop") ||
                      appSys.lookup_startup_wmclass(c) ||
                      appSys.lookup_desktop_wmclass(c) ||
                      appSys.lookup_flatpak_app_id(c);
            if (app) {
                return app.get_name();
            }
        }

        // Last resort: loose match on the app ID (e.g. com.bitwarden.desktop),
        // its StartupWMClass and its name.
        let wanted = candidates.map(_norm).filter(c => c.length >= 3);

        for (let app of appSys.get_all()) {
            let id = (app.get_id() || "").replace(/:flatpak$/, "").replace(/\.desktop$/, "");
            let keys = id.split(/[.\/]/).map(_norm);
            keys.push(_norm(id), _norm(app.get_name()));

            let info = app.get_app_info ? app.get_app_info() : null;
            if (info && info.get_startup_wm_class) {
                keys.push(_norm(info.get_startup_wm_class()));
            }

            if (keys.some(k => k && wanted.indexOf(k) != -1)) {
                return app.get_name();
            }
        }
    } catch (e) {
        global.logError(e);
    }

    return null;
}

const HORIZONTAL_STYLE = 'padding-left: 2px; padding-right: 2px; padding-top: 0; padding-bottom: 0';
const VERTICAL_STYLE = 'padding-left: 0; padding-right: 0; padding-top: 2px; padding-bottom: 2px';


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
        this.proxyVisible = true;

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

        this.actor.connect('button-press-event', Lang.bind(this, this.onButtonPressEvent));
        this.actor.connect('button-release-event', Lang.bind(this, this.onButtonReleaseEvent));
        this.actor.connect('scroll-event', (...args) => this.onScrollEvent(...args));
        this.actor.connect('enter-event', Lang.bind(this, this.onEnterEvent));

        this._proxy_prop_change_id = this.proxy.connect('g-properties-changed', Lang.bind(this, this.on_properties_changed))

        this.refresh();
    }

    on_properties_changed(proxy, changed_props, invalidated_props) {
        let prop_names = changed_props.deep_unpack();

        if ('IconName' in prop_names) {
            this.setIconName(proxy.icon_name);
        }
        if ('TooltipText' in prop_names) {
            this.setTooltipText(proxy.tooltip_text);
            // SNI icons without a stable name are identified by their tooltip.
            this.applet.updateVisibility();
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
        return;
    }

    refresh() {
        this.setIconName(this.proxy.icon_name);
        this.setLabel(this.proxy.label);
        this.setTooltipText(this.proxy.tooltip_text);
        this.setVisible(this.proxy.visible);
        this.setOrientation(this.applet.orientation);

        this.actor.queue_relayout();
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
            global.logError(`xapp-status@cinnamon.org: Icon or image seems out of sync (${this.name}`);
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

    // Final visibility also depends on the collapsed/pinned state, decided by the applet.
    // Actors are only ever shown/hidden, never reparented (reparenting tray actors is
    // what makes other collapsible systray applets crash Cinnamon).
    setVisible(visible) {
        this.proxyVisible = !!visible;
        this.applet.updateVisibility();
    }

    _hasStableName() {
        let name = this.proxy.name || "";
        return name !== "" && !SNI_NAME_RE.test(name);
    }

    _tooltipFirstLine() {
        return (this.proxy.tooltip_text || "").replace(/<[^>]*>/g, "").split("\n")[0].trim();
    }

    getId() {
        if (this._hasStableName()) {
            return this.proxy.name.toLowerCase();
        }

        let tip = this._tooltipFirstLine();
        if (tip) {
            return "tip:" + tip;
        }

        return "icon:" + (this.proxy.icon_name || "").split("/").pop();
    }

    getDisplayName() {
        if (this._hasStableName()) {
            if (this._appNameFor !== this.proxy.name) {
                this._appNameFor = this.proxy.name;
                this._appName = resolveAppName(this.proxy.name);
            }

            if (this._appName) {
                return this._appName;
            }
        }

        return this._tooltipFirstLine() || (this.proxy.name || "?").replace("org.x.StatusIcon.", "");
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

        let [x, y, o] = this.getEventPositionInfo(actor);

        this.proxy.call_button_press(x, y, event.get_button(), event.get_time(), o, null, null);

        return Clutter.EVENT_STOP;
    }

    onButtonReleaseEvent(actor, event) {
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

// Legacy XEmbed tray icon (e.g. AnyDesk), logic taken from systray@cinnamon.org
class TrayEntry {
    constructor(role, icon, button) {
        this.role = role;
        this.icon = icon;
        this.actor = button;
        this.proxyVisible = true;
    }

    getId() {
        return "tray:" + this.role.toLowerCase();
    }

    getDisplayName() {
        if (this._appName === undefined) {
            this._appName = resolveAppName(this.role);
        }

        return this._appName || this.role;
    }
}

class CinnamonXAppStatusApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.orientation = orientation;

        this._expanded = false;
        this._collapseId = 0;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("auto-collapse", "autoCollapse");

        this._writingRows = false;
        this._rowsIdleId = 0;
        this.settings.bind("icons", "iconRows", this._onIconRowsChanged);

        let rows = Array.isArray(this.iconRows) ? this.iconRows : [];

        // Migration from 1.0/1.1: the old "pinned" list becomes rows.
        let legacy = this.settings.getValue("pinned");
        if (rows.length == 0 && Array.isArray(legacy) && legacy.length > 0) {
            rows = legacy.map(id => ({ name: id, collapse: false, id: id }));
            this._writeRows(rows);
            this.settings.setValue("pinned", []);
        }

        if (rows.some(r => r && typeof r.collapse !== "boolean")) {
            rows = rows.filter(r => r && r.id).map(r => this._normalizeRow(r));
            this._writeRows(rows);
        }

        this._pinned = this._pinnedFromRows(rows);

        let namesVersion = this.settings.getValue("names-version") || 0;
        this._refreshNames = namesVersion < NAMES_VERSION;
        if (this._refreshNames) {
            this.settings.setValue("names-version", NAMES_VERSION);
        }

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.remove_style_class_name('applet-box');
        this.actor.set_important(true);  // ensure we get class details from the default theme if not present

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            this.manager_container = new St.BoxLayout( { vertical: false, style: HORIZONTAL_STYLE, reactive: true, track_hover: true });
        } else {
            this.manager_container = new St.BoxLayout( { vertical: true, style: VERTICAL_STYLE, reactive: true, track_hover: true });
        }

        this.actor.add_actor (this.manager_container);
        this.manager_container.show();

        // Expand/collapse arrow
        this._arrowIcon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_size: this.getPanelIconSize(St.IconType.SYMBOLIC)
        });
        this._arrow = new St.Button({
            style_class: "applet-box",
            reactive: !global.settings.get_boolean('panel-edit-mode'),
            track_hover: true,
            child: this._arrowIcon,
            visible: false
        });
        this._arrow.connect("clicked", () => this.toggleExpanded());
        this._arrowTooltip = new Tooltips.PanelItemTooltip(this._arrow, "", orientation);
        this.manager_container.add_actor(this._arrow);

        this._recording_indicator = new RecorderIcon(this);
        this.manager_container.add_actor(this._recording_indicator.actor);

        // Per-application switches at the top of the context menu (right-click on the arrow)
        this._pinSection = new PopupMenu.PopupMenuSection();
        this._applet_context_menu.addMenuItem(this._pinSection, 0);
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 1);

        this.statusIcons = {};
        this.trayEntries = [];
        this._trayDisabled = false;
        this._redisplayId = 0;
        this._trayTimeouts = new Set();
        this.tray_icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR) * global.ui_scale;

        /* This doesn't really work 100% because applets get reloaded and we end up losing this
         * list. Not that big a deal in practice*/
        this.ignoredProxies = {};

        this.signalManager = new SignalManager.SignalManager(null);
        this._scaleUpdateId = 0;

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

        this._rebuildPinMenu();
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

        this.manager_container.insert_child_at_index(statusIcon.actor, 0);
        this.statusIcons[key] = statusIcon;

        this.sortIcons();
    }

    removeStatusIcon(icon_proxy) {
        let key = this.getKey(icon_proxy);

        if (!this.statusIcons[key]) {
            return;
        }

        this.manager_container.remove_child(this.statusIcons[key].actor);
        this.statusIcons[key].destroy();
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

        let name = icon_proxy.name.toLowerCase();

        if (hiddenIcons.indexOf(name) != -1 ) {
            return true;
        }

        return false;
    }

    _sortFunc(a, b) {
        let asym = a.proxy.icon_name.includes("-symbolic");
        let bsym = b.proxy.icon_name.includes("-symbolic");

        if (asym && !bsym) {
            return 1;
        }

        if (bsym && !asym) {
            return -1;
        }

        return GLib.utf8_collate(a.proxy.name.replace("org.x.StatusIcon.", "").toLowerCase(),
                                 b.proxy.name.replace("org.x.StatusIcon.", "").toLowerCase());
    }

    sortIcons() {
        this.onSystrayRolesChanged();
        this._reorderOnly();
        this._rebuildPinMenu();
    }

    isPinned(icon) {
        return this._pinned.indexOf(icon.getId()) != -1;
    }

    // "Add" column: checked = the application goes into the collapsible area (behind the arrow).
    // Backward compatible with the old inverted "visible" field (1.2).
    _rowCollapsed(r) {
        if (typeof r.collapse === "boolean") {
            return r.collapse;
        }

        if (typeof r.visible === "boolean") {
            return !r.visible;
        }

        return true;
    }

    _normalizeRow(r) {
        return { name: r.name || r.id, collapse: this._rowCollapsed(r), id: r.id };
    }

    _pinnedFromRows(rows) {
        return rows.filter(r => r && r.id && !this._rowCollapsed(r)).map(r => r.id);
    }

    _writeRows(rows) {
        this._writingRows = true;
        try {
            this.settings.setValue("icons", rows);
        } finally {
            this._writingRows = false;
        }
    }

    // Add never-seen icons to the settings list.
    // Rows of absent icons are kept (application not running yet).
    _syncRows() {
        let rows = (Array.isArray(this.iconRows) ? this.iconRows : []).filter(r => r && r.id).map(r => this._normalizeRow(r));
        let changed = false;

        for (let icon of this._allEntries()) {
            let id = icon.getId();
            let name = icon.getDisplayName();
            let row = rows.find(r => r.id === id);

            if (!row) {
                rows.push({ name: name, collapse: this._pinned.indexOf(id) == -1, id: id });
                changed = true;
            } else if (this._refreshNames && row.name !== name) {
                // One-time upgrade of old tooltip-based labels. Afterwards a name the user
                // edited in the settings is never overwritten.
                row.name = name;
                changed = true;
            }
        }

        if (changed) {
            rows.sort((a, b) => GLib.utf8_collate((a.name || "").toLowerCase(), (b.name || "").toLowerCase()));
            this._writeRows(rows);
        }
    }

    // Change made in the settings dialog
    _onIconRowsChanged() {
        if (this._writingRows) {
            return;
        }

        if (this._rowsIdleId > 0) {
            return;
        }

        // Deferred: never rebuild the menu from inside a signal handler.
        this._rowsIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._rowsIdleId = 0;
            this._pinned = this._pinnedFromRows(Array.isArray(this.iconRows) ? this.iconRows : []);
            this._reorderOnly();
            this._rebuildPinMenu();
            return GLib.SOURCE_REMOVE;
        });
    }

    setPinned(id, state) {
        let list = this._pinned.filter(x => x !== id);

        if (state) {
            list.push(id);
        }

        this._pinned = list;

        let rows = (Array.isArray(this.iconRows) ? this.iconRows : []).filter(r => r && r.id).map(r => this._normalizeRow(r));
        let row = rows.find(r => r.id === id);

        if (row) {
            row.collapse = !state;
        } else {
            rows.push({ name: id, collapse: !state, id: id });
        }

        this._writeRows(rows);

        // No _rebuildPinMenu() here: the switch that triggered this call would be
        // destroyed during its own signal emission.
        this._reorderOnly();
    }

    _allEntries() {
        let list = [];

        for (let i in this.statusIcons) {
            list.push(this.statusIcons[i]);
        }

        return list.concat(this.trayEntries);
    }

    _reorderOnly() {
        let icon_list = [];

        for (let i in this.statusIcons) {
            icon_list.push(this.statusIcons[i]);
        }

        icon_list.sort(this._sortFunc);

        let trays = this.trayEntries.slice().sort((a, b) =>
            GLib.utf8_collate(a.role.toLowerCase(), b.role.toLowerCase()));
        icon_list = trays.concat(icon_list);

        let hidden = icon_list.filter(icon => !this.isPinned(icon));
        let pinned = icon_list.filter(icon => this.isPinned(icon));
        let idx = 0;

        for (let icon of hidden) {
            this.manager_container.set_child_at_index(icon.actor, idx++);
        }

        this.manager_container.set_child_at_index(this._arrow, idx++);

        for (let icon of pinned) {
            this.manager_container.set_child_at_index(icon.actor, idx++);
        }

        this.manager_container.set_child_at_index(this._recording_indicator.actor, -1);

        this.updateVisibility();
    }

    updateVisibility() {
        if (!this.statusIcons || !this.trayEntries || !this._arrow) {
            return;
        }

        let editMode = global.settings.get_boolean('panel-edit-mode');
        let hiddenCount = 0;

        for (let icon of this._allEntries()) {
            let pinned = this.isPinned(icon);

            if (icon.proxyVisible && !pinned) {
                hiddenCount++;
            }

            icon.actor.visible = icon.proxyVisible && (pinned || this._expanded || editMode);
        }

        this._arrow.visible = hiddenCount > 0;

        if (hiddenCount == 0 && this._expanded) {
            this._expanded = false;
            this._clearCollapseTimeout();
        }

        this._updateArrow(hiddenCount);
    }

    _updateArrow(hiddenCount) {
        let vertical = !(this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM);
        let name;

        if (vertical) {
            name = this._expanded ? "pan-down-symbolic" : "pan-up-symbolic";
        } else {
            name = this._expanded ? "pan-end-symbolic" : "pan-start-symbolic";
        }

        this._arrowIcon.icon_name = name;
        this._arrowIcon.icon_size = this.getPanelIconSize(St.IconType.SYMBOLIC);

        this._arrowTooltip.set_text(this._expanded
            ? _("Hide icons")
            : _("Show hidden icons (%d)").format(hiddenCount));
    }

    toggleExpanded() {
        this._arrowTooltip.hide();
        this._expanded = !this._expanded;
        this._clearCollapseTimeout();

        if (this._expanded && this.autoCollapse > 0) {
            this._armCollapseTimeout();
        }

        this.updateVisibility();
    }

    _armCollapseTimeout() {
        this._clearCollapseTimeout();

        this._collapseId = Mainloop.timeout_add_seconds(this.autoCollapse, () => {
            this._collapseId = 0;

            // Pointer still over the area: try again later.
            if (this.manager_container.hover) {
                this._armCollapseTimeout();
                return GLib.SOURCE_REMOVE;
            }

            if (this._expanded) {
                this._expanded = false;
                this.updateVisibility();
            }

            return GLib.SOURCE_REMOVE;
        });
    }

    _clearCollapseTimeout() {
        if (this._collapseId > 0) {
            Mainloop.source_remove(this._collapseId);
            this._collapseId = 0;
        }
    }

    _rebuildPinMenu() {
        if (!this._pinSection) {
            return;
        }

        if (this.settings) {
            this._syncRows();
        }

        this._pinSection.removeAll();

        let title = new PopupMenu.PopupMenuItem(_("Add to the collapsible area"), { reactive: false });
        this._pinSection.addMenuItem(title);

        let icon_list = this._allEntries();

        if (icon_list.length == 0) {
            this._pinSection.addMenuItem(new PopupMenu.PopupMenuItem(_("No icons"), { reactive: false }));
            return;
        }

        icon_list.sort((a, b) => GLib.utf8_collate(a.getDisplayName().toLowerCase(),
                                                   b.getDisplayName().toLowerCase()));

        for (let icon of icon_list) {
            let id = icon.getId();
            let item = new PopupMenu.PopupSwitchMenuItem(icon.getDisplayName(), !this.isPinned(icon));
            item.connect("toggled", (it, state) => this.setPinned(id, !state));
            this._pinSection.addMenuItem(item);
        }
    }

    // ---- Legacy XEmbed icons (logic from systray@cinnamon.org 6.6.9) ----

    on_applet_added_to_panel() {
        if (Meta.is_wayland_compositor()) {
            return;
        }

        // Safety: if the stock System Tray applet is also on a panel, leave XEmbed icons
        // alone (two applets fighting over the same icons crashes Cinnamon).
        if (AppletManager.getRunningInstancesForUuid("systray@cinnamon.org").length > 0) {
            global.logWarning(`${UUID}: systray@cinnamon.org is running, legacy tray icons ignored. Remove the System Tray applet and reload this applet.`);
            this._trayDisabled = true;
            return;
        }

        if (!global.trayReloading) {
            Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());
        }

        this._updateTrayOrientation();

        this.signalManager.connect(Main.statusIconDispatcher, 'status-icon-added', this._onTrayIconAdded, this);
        this.signalManager.connect(Main.statusIconDispatcher, 'status-icon-removed', this._onTrayIconRemoved, this);
        this.signalManager.connect(Main.statusIconDispatcher, 'before-redisplay', this._onBeforeRedisplay, this);
        this.signalManager.connect(Main.systrayManager, "changed", this._queueTrayRedisplay, this);

        if (global.trayReloading) {
            global.trayReloading = false;
            Main.statusIconDispatcher.redisplay();
        }
    }

    on_applet_reloaded() {
        global.trayReloading = true;
    }

    on_applet_clicked(event) {
    }

    // At startup every applet registering a role emits "changed": coalesce them.
    _queueTrayRedisplay() {
        if (this._redisplayId > 0) {
            return;
        }

        this._redisplayId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._redisplayId = 0;
            this._trayRedisplay();
            return GLib.SOURCE_REMOVE;
        });
    }

    _trayRedisplay() {
        if (!this._trayDisabled && !Meta.is_wayland_compositor()) {
            this.tray_icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR) * global.ui_scale;
            Main.statusIconDispatcher.redisplay();
        }
    }

    _updateTrayOrientation() {
        if (this._trayDisabled || Meta.is_wayland_compositor()) {
            return;
        }

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
            Main.statusIconDispatcher.set_tray_orientation(Clutter.Orientation.VERTICAL);
        } else {
            Main.statusIconDispatcher.set_tray_orientation(Clutter.Orientation.HORIZONTAL);
        }
    }

    _clearTrayIcons() {
        for (let entry of this.trayEntries) {
            let button = entry.actor;

            if (button.child) {
                button.remove_actor(button.child);
            }

            if (button.get_parent()) {
                button.get_parent().remove_child(button);
            }

            button.destroy();
        }

        this.trayEntries = [];
    }

    _onBeforeRedisplay() {
        this._clearTrayIcons();
    }

    _onTrayIconAdded(o, icon, role) {
        try {
            let hiddenIcons = Main.systrayManager.getRoles();

            if (hiddenIcons.indexOf(role.toLowerCase()) != -1) {
                global.log("Hiding systray: " + role);
                return;
            }

            global.log("Adding systray: " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");

            let button = new St.Bin({
                style_class: "applet-box",
                child: icon
            });

            icon.set_x_align(Clutter.ActorAlign.CENTER);
            icon.set_y_align(Clutter.ActorAlign.FILL);
            button.set_y_align(Clutter.ActorAlign.FILL);

            let entry = new TrayEntry(role, icon, button);

            icon.visible = false;
            icon.opacity = 0;
            let timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this._trayTimeouts.delete(timeoutId);

                // Stale entry (a redisplay happened meanwhile): nothing to do.
                if (this.trayEntries.indexOf(entry) == -1) {
                    return GLib.SOURCE_REMOVE;
                }

                if (icon.is_finalized()) {
                    let idx = this.trayEntries.indexOf(entry);
                    if (idx != -1) {
                        this.trayEntries.splice(idx, 1);
                        button.destroy();
                        this.updateVisibility();
                    }
                    return GLib.SOURCE_REMOVE;
                }

                icon.reactive = true;
                icon.visible = true;
                icon.set_size(this.tray_icon_size, this.tray_icon_size);
                icon.ease({
                    opacity: 255,
                    duration: 400,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });

                // The icon actor is reused across redisplays: connect only once.
                if (!icon._xscEventId) {
                    icon._xscEventId = icon.connect("event", (actor, event) => this._onTrayEvent(actor, event));
                }
                return GLib.SOURCE_REMOVE;
            });
            this._trayTimeouts.add(timeoutId);

            this.trayEntries.push(entry);
            this.manager_container.insert_child_at_index(button, 0);

            this._reorderOnly();
            this._rebuildPinMenu();
        } catch (e) {
            global.logError(e);
        }
    }

    _onTrayEvent(icon, event) {
        let etype = event.type();
        const button = icon.get_parent();

        if (button == null) {
            return GLib.SOURCE_REMOVE;
        }

        if (etype === Clutter.EventType.BUTTON_PRESS) {
            global.begin_modal(Meta.ModalOptions.POINTER_ALREADY_GRABBED, event.time);
        }
        else if (etype === Clutter.EventType.ENTER) {
            button.add_style_pseudo_class("hover");
        }
        else if (etype === Clutter.EventType.LEAVE) {
            button.remove_style_pseudo_class("hover");
        }

        let ret = icon.handle_event(etype, event);

        if (etype === Clutter.EventType.BUTTON_PRESS) {
            global.end_modal(event.time);
        }

        return ret;
    }

    _onTrayIconRemoved(o, icon) {
        let idx = this.trayEntries.findIndex(e => e.icon === icon);
        const parent = icon.get_parent();

        if (parent) {
            parent.remove_actor(icon);
        }

        if (idx != -1) {
            let entry = this.trayEntries[idx];
            this.trayEntries.splice(idx, 1);
            entry.actor.destroy();
        } else if (parent) {
            parent.destroy();
        }

        this.updateVisibility();
        this._rebuildPinMenu();
    }

    refreshIcons() {
        for (let owner in this.statusIcons) {
            let icon = this.statusIcons[owner];
            icon.refresh();
        }

        this._recording_indicator.refresh();
        this.updateVisibility();
    }

    icon_size_changed() {
        this.refreshIcons();
        this._trayRedisplay();
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
            this._trayRedisplay();

            this._scaleUpdateId = 0;
            return GLib.SOURCE_REMOVE;
        })
    }

    on_applet_removed_from_panel() {
        this._clearCollapseTimeout();

        if (this._rowsIdleId > 0) {
            GLib.source_remove(this._rowsIdleId);
            this._rowsIdleId = 0;
        }

        if (this._redisplayId > 0) {
            GLib.source_remove(this._redisplayId);
            this._redisplayId = 0;
        }

        for (let id of this._trayTimeouts) {
            GLib.source_remove(id);
        }
        this._trayTimeouts.clear();

        if (this._scaleUpdateId > 0) {
            Mainloop.source_remove(this._scaleUpdateId);
            this._scaleUpdateId = 0;
        }

        this.signalManager.disconnectAllSignals();
        this.settings.finalize();
        this._arrowTooltip.destroy();
        this._clearTrayIcons();

        for (let key in this.statusIcons) {
            this.statusIcons[key].destroy();
            delete this.statusIcons[key];
        };

        for (let key in this.ignoredProxies) {
            delete this.ignoredProxies[key];
        };

        this._recording_indicator.destroy();
        this._recording_indicator = null;

        this.monitor = null;
    }

    on_panel_edit_mode_changed() {
        let reactive = !global.settings.get_boolean('panel-edit-mode');
        for (let owner in this.statusIcons) {
            let icon = this.statusIcons[owner];
            icon.actor.reactive = reactive;
        }

        this._arrow.reactive = reactive;
        this._trayRedisplay();

        // In panel edit mode everything is shown, so the real width is visible.
        this.updateVisibility();
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
        this._updateTrayOrientation();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonXAppStatusApplet(metadata, orientation, panel_height, instance_id);
}
