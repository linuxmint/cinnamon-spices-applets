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
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;

const HORIZONTAL_STYLE = 'padding-left: 2px; padding-right: 2px; padding-top: 0; padding-bottom: 0';
const VERTICAL_STYLE = 'padding-left: 0; padding-right: 0; padding-top: 2px; padding-bottom: 2px';

const POPUP_ICONS_PER_ROW = 4;

/* Cinnamon's stock tooltips refuse to show while any menu is open
 * (global.menuStack check), which makes them useless inside our overflow
 * popup. This variant drops that check and positions itself next to the
 * icon, so it works both in the panel and in the popup. */
function IconTooltip(panelItem, initTitle, orientation) {
    this._init(panelItem, initTitle, orientation);
}

IconTooltip.prototype = {
    __proto__: Tooltips.PanelItemTooltip.prototype,

    show: function() {
        if (this._tooltip.get_text() == "" || !this.mousePosition) {
            return;
        }

        let op = this._tooltip.get_opacity();
        this._tooltip.set_opacity(0);
        this._tooltip.show();

        let actor = this._panelItem.actor;
        let monitor = Main.layoutManager.findMonitorForActor(actor);

        let [minW, minH, tooltipWidth, tooltipHeight] = this._tooltip.get_preferred_size();
        let [ax, ay] = actor.get_transformed_position();
        let aw = actor.get_width();
        let ah = actor.get_height();

        let tooltipTop, tooltipLeft;

        switch (this.orientation) {
            case St.Side.TOP:
                tooltipTop = ay + ah + 5;
                tooltipLeft = this.mousePosition[0] - Math.round(tooltipWidth / 2);
                break;
            case St.Side.LEFT:
                tooltipTop = ay + Math.round((ah - tooltipHeight) / 2);
                tooltipLeft = ax + aw + 5;
                break;
            case St.Side.RIGHT:
                tooltipTop = ay + Math.round((ah - tooltipHeight) / 2);
                tooltipLeft = ax - tooltipWidth - 5;
                break;
            case St.Side.BOTTOM:
            default:
                tooltipTop = ay - tooltipHeight - 5;
                tooltipLeft = this.mousePosition[0] - Math.round(tooltipWidth / 2);
                break;
        }

        tooltipLeft = Math.max(tooltipLeft, monitor.x);
        tooltipLeft = Math.min(tooltipLeft, monitor.x + monitor.width - tooltipWidth);
        tooltipTop = Math.max(tooltipTop, monitor.y);
        tooltipTop = Math.min(tooltipTop, monitor.y + monitor.height - tooltipHeight);

        this._tooltip.set_position(Math.round(tooltipLeft), Math.round(tooltipTop));

        this._tooltip.set_opacity(op);
        this.visible = true;
    }
};


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

/* The chevron button that expands/collapses the hidden icons,
 * like the "show hidden icons" arrow in the Windows taskbar. */
class ChevronButton {
    constructor(applet) {
        this.applet = applet;

        this.actor = new St.Button({
            style_class: "applet-box",
            reactive: true,
            track_hover: true,
            visible: false,
            x_expand: true,
            y_expand: true
        });

        this.icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_size: this.applet.getPanelIconSize(St.IconType.SYMBOLIC),
            style_class: "applet-icon"
        });

        this.actor.set_child(this.icon);

        this._tooltip = new Tooltips.PanelItemTooltip(this, _("Show hidden icons"), applet.orientation);

        this.actor.connect('clicked', () => this.applet.toggleExpanded());

        this.update();
    }

    update() {
        let open = this.applet.expanded;
        let name;

        if (this.applet.expandMode == "popup") {
            /* Arrow points toward where the popup appears */
            switch (this.applet.orientation) {
                case St.Side.BOTTOM:
                default:
                    name = open ? "pan-down-symbolic" : "pan-up-symbolic";
                    break;
                case St.Side.TOP:
                    name = open ? "pan-up-symbolic" : "pan-down-symbolic";
                    break;
                case St.Side.LEFT:
                    name = open ? "pan-start-symbolic" : "pan-end-symbolic";
                    break;
                case St.Side.RIGHT:
                    name = open ? "pan-end-symbolic" : "pan-start-symbolic";
                    break;
            }
        } else {
            let vertical = this.applet.orientation == St.Side.LEFT || this.applet.orientation == St.Side.RIGHT;

            if (open) {
                name = vertical ? "pan-down-symbolic" : "pan-end-symbolic";
            } else {
                name = vertical ? "pan-up-symbolic" : "pan-start-symbolic";
            }
        }

        this.icon.icon_name = name;
        this._tooltip.set_text(open ? _("Hide icons") : _("Show hidden icons"));
        this.icon.icon_size = this.applet.getPanelIconSize(St.IconType.SYMBOLIC);
    }

    setVisible(visible) {
        this.actor.visible = visible;
    }

    destroy() {
        this._tooltip.destroy();
        this.actor.destroy();
    }
}

/* Wraps a legacy XEmbed tray icon (e.g. evolution-alarm-notify) so it follows
 * the same hide/expand rules as the XApp status icons. Hosting logic is taken
 * from the stock systray@cinnamon.org applet. */
class TrayIconWrapper {
    constructor(applet, icon, role) {
        this.applet = applet;
        this.icon = icon;
        this.role = role.toLowerCase();
        this.inPopup = false;

        this.actor = new St.Bin({
            style_class: "applet-box",
            child: icon
        });

        icon.set_x_align(Clutter.ActorAlign.CENTER);
        icon.set_y_align(Clutter.ActorAlign.CENTER);
        this.actor.set_y_align(Clutter.ActorAlign.FILL);

        icon.visible = false;
        icon.opacity = 0;

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            if (icon.is_finalized()) {
                return GLib.SOURCE_REMOVE;
            }

            icon.reactive = true;
            icon.visible = true;

            /* XEmbed apps tend to paint their artwork with internal padding,
             * so give them a slightly larger allocation to visually match
             * the XApp icons. */
            let size = (this.applet.clampIconSize(this.applet.getPanelIconSize(St.IconType.FULLCOLOR)) + 6) * global.ui_scale;
            icon.set_size(size, size);

            icon.ease({
                opacity: 255,
                duration: 400,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });

            icon.connect("event", (actor, event) => this._onEvent(actor, event));
            return GLib.SOURCE_REMOVE;
        });
    }

    _onEvent(icon, event) {
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
            this.applet.onHiddenIconUsed(this);
        }

        return ret;
    }

    matchName() {
        return this.role;
    }

    displayName() {
        return this.role.charAt(0).toUpperCase() + this.role.slice(1);
    }

    updateVisibility() {
        if (this.inPopup) {
            this.actor.visible = true;
            return;
        }

        let hiddenByUser = this.applet.isIconHidden(this);
        let revealedInline = this.applet.expanded && this.applet.expandMode == "inline";

        this.actor.visible = !hiddenByUser || revealedInline;
    }

    destroy() {
        if (this.icon.get_parent() === this.actor) {
            this.actor.remove_actor(this.icon);
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
        this.inPopup = false;

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
        this.iconSize = this.applet.clampIconSize(this.applet.getPanelIconSize(St.IconType.FULLCOLOR));

        this.proxy.icon_size = this.iconSize;

        this.label = new St.Label({
            'y-align': St.Align.END,
        });

        this.actor.add_actor(this.icon_holder);
        this.actor.add_actor(this.label);

        this._tooltip = new IconTooltip(this, "", applet.orientation);

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
        }
        if ('Label' in prop_names) {
            this.setLabel(proxy.label);
        }
        if ('Visible' in prop_names) {
            this.updateVisibility();
        }
        if ('Name' in prop_names) {
            this.applet.sortIcons();
            this.applet.updateCollapsedState();
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

    /* The identity used in the hidden-apps setting. Unnamed StatusNotifier
     * items get their D-Bus address (e.g. ":1.157") as a name, which changes
     * every session - fall back to something stable instead. */
    matchName() {
        let name = this.proxy.name;

        if (!name || name.length === 0 || name.startsWith(":")) {
            if (this.proxy.tooltip_text && this.proxy.tooltip_text.length > 0) {
                name = this.proxy.tooltip_text.split("\n")[0];
            } else if (this.proxy.icon_name && this.proxy.icon_name.length > 0 &&
                       !this.proxy.icon_name.startsWith("/")) {
                /* pixmap icons get a temp file path which changes every session */
                name = this.proxy.icon_name;
            } else {
                name = "unnamed-icon";
            }
        }

        return name.toLowerCase();
    }

    /* A human-friendly name for the context menu */
    displayName() {
        let name = this.proxy.name;

        if (!name || name.length === 0 || name.startsWith(":")) {
            if (this.proxy.tooltip_text && this.proxy.tooltip_text.length > 0) {
                name = this.proxy.tooltip_text.split("\n")[0];
            } else if (this.proxy.icon_name && this.proxy.icon_name.length > 0 &&
                       !this.proxy.icon_name.startsWith("/")) {
                name = this.proxy.icon_name;
            } else {
                name = _("Unnamed icon");
            }
        }

        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    updateVisibility() {
        if (this.inPopup) {
            /* While shown in the overflow popup, only the app itself decides */
            this.actor.visible = this.proxy.visible;
            return;
        }

        let hiddenByUser = this.applet.isIconHidden(this);
        let revealedInline = this.applet.expanded && this.applet.expandMode == "inline";

        this.actor.visible = this.proxy.visible && (!hiddenByUser || revealedInline);
    }

    refresh() {
        this.setIconName(this.proxy.icon_name);
        this.setLabel(this.proxy.label);
        this.setTooltipText(this.proxy.tooltip_text);
        this.updateVisibility();
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
            this.iconSize = this.applet.clampIconSize(this.applet.getPanelIconSize(type));
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
            global.logError(`collapsible-xapp-status@marius: Icon or image seems out of sync (${this.name}`);
            return;
        }

        this.icon_holder.child = actor;
        this.icon_holder.show();
    }

    setTooltipText(tooltipText) {
        if (!tooltipText || tooltipText.length === 0) {
            /* Windows shows the app name when there is no tooltip */
            tooltipText = GLib.markup_escape_text(this.displayName(), -1);
        }

        this._tooltip.preventShow = false;
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

        if (this.inPopup) {
            /* The open popup holds an input grab which would prevent the
             * app's own menu (especially Qt ones like FortiClient) from
             * grabbing the pointer - it would close instantly. So: remember
             * the click, close the popup (releasing the grab), and forward a
             * full click shortly after, once the grab is gone. */
            let button = event.get_button();
            let time = event.get_time();

            this._deferredClick = true;

            Mainloop.timeout_add(100, () => {
                this.applet.collapse();
                return GLib.SOURCE_REMOVE;
            });

            Mainloop.timeout_add(300, () => {
                this._deferredClick = false;
                this.proxy.call_button_press(x, y, button, time, o, null, null);
                this.proxy.call_button_release(x, y, button, time, o, null, null);
                return GLib.SOURCE_REMOVE;
            });

            return Clutter.EVENT_STOP;
        }

        this.proxy.call_button_press(x, y, event.get_button(), event.get_time(), o, null, null);

        return Clutter.EVENT_STOP;
    }

    onButtonReleaseEvent(actor, event) {
        if (this._deferredClick) {
            /* click already handled by the popup path */
            return Clutter.EVENT_STOP;
        }

        let [x, y, o] = this.getEventPositionInfo(actor);

        this.proxy.call_button_release(x, y, event.get_button(), event.get_time(), o, null, null);

        this.applet.onHiddenIconUsed(this);

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

        /* Detach the icon from its St.Bin holder before anything gets
         * disposed: texture-cache actors don't always die when their parent
         * bin does, and st_bin_destroy() fatally asserts if its child
         * survives (this crashed all of Cinnamon once). */
        this.icon_loader_handle = null;
        this.icon_holder.child = null;
    }
}

class CollapsibleXAppStatusApplet extends Applet.Applet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.orientation = orientation;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.remove_style_class_name('applet-box');
        this.actor.set_important(true);  // ensure we get class details from the default theme if not present

        this.settings = new Settings.AppletSettings(this, "collapsible-xapp-status@marius", instance_id);
        this.settings.bind("hidden-apps", "hiddenApps", () => this.updateCollapsedState());
        this.settings.bind("known-apps", "knownApps");
        this.settings.bind("expand-mode", "expandMode", () => this._onExpandModeChanged());
        this.settings.bind("hide-new-icons", "hideNewIcons");
        this.settings.bind("autocollapse-delay", "autocollapseDelay");
        this.settings.bind("collapse-on-click", "collapseOnClick");
        this.settings.bind("max-icon-size", "maxIconSize", () => this._onIconSizeSettingChanged());

        this.expanded = false;
        this._autocollapseId = 0;
        this._collapseOnClickId = 0;

        /* Legacy XEmbed tray icons, hosted alongside the XApp ones */
        this.trayWrappers = [];

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            this.manager_container = new St.BoxLayout( { vertical: false, style: HORIZONTAL_STYLE });
        } else {
            this.manager_container = new St.BoxLayout( { vertical: true, style: VERTICAL_STYLE });
        }

        this.actor.add_actor (this.manager_container);
        this.manager_container.show();

        this.chevron = new ChevronButton(this);
        this.manager_container.add_actor(this.chevron.actor);

        this._recording_indicator = new RecorderIcon(this);
        this.manager_container.add_actor(this._recording_indicator.actor);

        this.statusIcons = {};

        /* This doesn't really work 100% because applets get reloaded and we end up losing this
         * list. Not that big a deal in practice*/
        this.ignoredProxies = {};

        this.signalManager = new SignalManager.SignalManager(null);
        this._scaleUpdateId = 0;

        /* The Windows-style overflow popup */
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        this.popupGrid = new St.BoxLayout({ vertical: true, style: "padding: 6px;" });
        this.menu.box.add_actor(this.popupGrid);

        this.signalManager.connect(this.menu, 'open-state-changed', this._onPopupOpenStateChanged, this);

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

        this._buildContextMenuSection();
    }

    /* ------- collapse/expand logic ------- */

    isIconHidden(statusIcon) {
        return this.hiddenApps.indexOf(statusIcon.matchName()) != -1;
    }

    /* Cap app icon sizes so oversized full-color icons match the rest */
    clampIconSize(size) {
        if (this.maxIconSize > 0) {
            return Math.min(size, this.maxIconSize);
        }
        return size;
    }

    _onIconSizeSettingChanged() {
        this.refreshIcons();
        Main.statusIconDispatcher.redisplay();
    }

    /* Whether the app itself currently wants its icon shown */
    iconCanShow(icon) {
        return icon.proxy ? icon.proxy.visible : true;
    }

    anyHiddenIcons() {
        for (let icon of this.allIcons()) {
            if (this.iconCanShow(icon) && this.isIconHidden(icon)) {
                return true;
            }
        }
        return false;
    }

    /* Windows hides new tray icons by default: every app icon we have never
     * seen before gets hidden automatically (if enabled). The user promotes
     * the ones they want visible via the right-click menu. */
    registerApp(statusIcon) {
        let name = statusIcon.matchName();

        if (this.knownApps.indexOf(name) != -1) {
            return;
        }

        this.knownApps = [...this.knownApps, name];

        if (this.hideNewIcons && this.hiddenApps.indexOf(name) == -1) {
            global.log(`collapsible-xapp-status@marius: auto-hiding new icon: ${name}`);
            this.hiddenApps = [...this.hiddenApps, name];
        }
    }

    /* Every icon we manage, XApp and legacy alike */
    allIcons() {
        let list = [];

        for (let key in this.statusIcons) {
            list.push(this.statusIcons[key]);
        }

        return list.concat(this.trayWrappers);
    }

    toggleExpanded() {
        if (this.expanded) {
            this.collapse();
        } else {
            this.expand();
        }
    }

    expand() {
        if (this.expandMode == "popup") {
            /* If the click that triggered this just closed the popup (via the
             * menu's input grab), don't instantly reopen it. */
            if (this._popupClosedAt && GLib.get_monotonic_time() - this._popupClosedAt < 300000) {
                return;
            }
            this._openPopup();
        } else {
            this.expanded = true;
            this._scheduleAutocollapse();
            this.updateCollapsedState();
        }
    }

    collapse() {
        if (this.menu.isOpen) {
            this.menu.close();  /* handler does the rest */
            return;
        }

        this.expanded = false;
        this._cancelAutocollapse();
        this.updateCollapsedState();
    }

    _openPopup() {
        if (this.menu.isOpen) {
            return;
        }

        this.popupGrid.destroy_all_children();

        let hiddenXApp = [];
        let hiddenLegacy = [];

        for (let icon of this.allIcons()) {
            if (this.iconCanShow(icon) && this.isIconHidden(icon)) {
                if (icon.proxy) {
                    /* skip icons currently publishing no graphic - they would
                     * just leave an empty gap in the grid */
                    if (icon.iconName) {
                        hiddenXApp.push(icon);
                    }
                } else {
                    hiddenLegacy.push(icon);
                }
            }
        }

        hiddenXApp.sort(this._sortFunc);
        let hiddenIcons = hiddenLegacy.concat(hiddenXApp);

        if (hiddenIcons.length == 0) {
            return;
        }

        /* Tic-tac-toe style grid: fixed square cells, icons centered, thin
         * separator lines between cells (inner lines only), and the last row
         * padded with empty cells so the grid stays rectangular. */
        let count = hiddenIcons.length;
        let cols = Math.min(count, POPUP_ICONS_PER_ROW);
        let rows = Math.ceil(count / POPUP_ICONS_PER_ROW);
        let cellSize = this.clampIconSize(this.getPanelIconSize(St.IconType.FULLCOLOR)) + 16;

        let row = null;
        for (let i = 0; i < rows * cols; i++) {
            let r = Math.floor(i / cols);
            let c = i % cols;

            if (c == 0) {
                row = new St.BoxLayout({ vertical: false });
                this.popupGrid.add_actor(row);
            }

            let style = `width: ${cellSize}px; height: ${cellSize}px; border-color: rgba(128, 128, 128, 0.4);`;
            if (c < cols - 1) {
                style += " border-right-width: 1px;";
            }
            if (r < rows - 1) {
                style += " border-bottom-width: 1px;";
            }

            /* St.BoxLayout, NOT St.Bin: st_bin_destroy() fatally asserts if
             * a child is still attached, which can bring down Cinnamon. */
            let cell = new St.BoxLayout({ style: style });
            row.add_actor(cell);

            if (i < count) {
                let icon = hiddenIcons[i];
                icon.actor.get_parent().remove_child(icon.actor);
                icon.inPopup = true;
                /* center within the fixed-size cell */
                icon.actor.x_expand = true;
                icon.actor.y_expand = true;
                icon.actor.x_align = Clutter.ActorAlign.CENTER;
                icon.actor.y_align = Clutter.ActorAlign.CENTER;
                cell.add_actor(icon.actor);
                icon.updateVisibility();
            }
        }

        this.menu.open();
    }

    _returnPopupIcons() {
        for (let icon of this.allIcons()) {
            if (icon.inPopup) {
                icon.actor.get_parent().remove_child(icon.actor);
                icon.inPopup = false;
                icon.actor.x_align = Clutter.ActorAlign.FILL;
                icon.actor.y_align = Clutter.ActorAlign.FILL;
                this.manager_container.add_child(icon.actor);
                icon.updateVisibility();
            }
        }

        this.popupGrid.destroy_all_children();
        this.sortIcons();
    }

    _onPopupOpenStateChanged(menu, open) {
        if (open) {
            this.expanded = true;
            this._scheduleAutocollapse();
        } else {
            this._returnPopupIcons();
            this.expanded = false;
            this._cancelAutocollapse();
            this._popupClosedAt = GLib.get_monotonic_time();
        }

        this.chevron.update();
    }

    _scheduleAutocollapse() {
        this._cancelAutocollapse();

        if (this.autocollapseDelay > 0) {
            this._autocollapseId = Mainloop.timeout_add_seconds(this.autocollapseDelay, () => {
                this._autocollapseId = 0;
                this.collapse();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _cancelAutocollapse() {
        if (this._autocollapseId > 0) {
            Mainloop.source_remove(this._autocollapseId);
            this._autocollapseId = 0;
        }
    }

    _onExpandModeChanged() {
        if (this.expanded) {
            this.collapse();
        }
        this.chevron.update();
    }

    /* Called after any click forwarded to an icon - collapse again like Windows does
     * when you use an icon from the overflow. Delayed slightly so the app still
     * gets its menu positioned correctly. */
    onHiddenIconUsed(statusIcon) {
        if (!this.expanded || !this.collapseOnClick || !this.isIconHidden(statusIcon)) {
            return;
        }

        if (this._collapseOnClickId > 0) {
            Mainloop.source_remove(this._collapseOnClickId);
        }

        this._collapseOnClickId = Mainloop.timeout_add(500, () => {
            this._collapseOnClickId = 0;
            this.collapse();
            return GLib.SOURCE_REMOVE;
        });
    }

    updateCollapsedState() {
        for (let icon of this.allIcons()) {
            icon.updateVisibility();
        }

        let anyHidden = this.anyHiddenIcons();

        if (!anyHidden && this.expanded) {
            this.collapse();
        }

        this.chevron.setVisible(anyHidden && !global.settings.get_boolean('panel-edit-mode'));
        this.chevron.update();
    }

    setIconHidden(statusIcon, hide) {
        let name = statusIcon.matchName();
        let list = this.hiddenApps.filter(n => n != name);

        if (hide) {
            list.push(name);
        }

        this.hiddenApps = list;  // reassign so the setting is saved

        this.updateCollapsedState();
    }

    /* ------- context menu (right-click) ------- */

    _buildContextMenuSection() {
        this._iconTogglesSection = new PopupMenu.PopupMenuSection();
        this._applet_context_menu.addMenuItem(this._iconTogglesSection);

        this.signalManager.connect(this._applet_context_menu, 'open-state-changed', (menu, open) => {
            if (open) {
                this._rebuildIconToggles();
            }
        }, this);
    }

    _rebuildIconToggles() {
        this._iconTogglesSection.removeAll();

        let icon_list = this.allIcons();

        if (icon_list.length == 0) {
            return;
        }

        icon_list.sort((a, b) => GLib.utf8_collate(a.matchName(), b.matchName()));

        let header = new PopupMenu.PopupMenuItem(_("Visible tray icons:"), { reactive: false });
        this._iconTogglesSection.addMenuItem(header);

        for (let icon of icon_list) {
            let item = new PopupMenu.PopupSwitchMenuItem(icon.displayName(), !this.isIconHidden(icon));

            item.connect('toggled', (menuItem, state) => {
                this.setIconHidden(icon, !state);
            });

            this._iconTogglesSection.addMenuItem(item);
        }

        this._iconTogglesSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    /* ------- legacy XEmbed tray hosting (from systray@cinnamon.org) ------- */

    on_applet_added_to_panel() {
        if (!global.trayReloading) {
            Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());
        }

        this.update_na_tray_orientation();

        this.signalManager.connect(Main.statusIconDispatcher, 'status-icon-added', this._onTrayIconAdded, this);
        this.signalManager.connect(Main.statusIconDispatcher, 'status-icon-removed', this._onTrayIconRemoved, this);
        this.signalManager.connect(Main.statusIconDispatcher, 'before-redisplay', this._onBeforeRedisplay, this);

        /* Always resync: icons may have been emitted while no tray applet was
         * listening (e.g. when taking over from systray@cinnamon.org). */
        global.trayReloading = false;
        Main.statusIconDispatcher.redisplay();
    }

    on_applet_reloaded() {
        global.trayReloading = true;
    }

    update_na_tray_orientation() {
        switch (this.orientation) {
            case St.Side.LEFT:
            case St.Side.RIGHT:
                Main.statusIconDispatcher.set_tray_orientation(Clutter.Orientation.VERTICAL);
                break;
            case St.Side.TOP:
            case St.Side.BOTTOM:
            default:
                Main.statusIconDispatcher.set_tray_orientation(Clutter.Orientation.HORIZONTAL);
                break;
        }
    }

    _onTrayIconAdded(o, icon, role) {
        try {
            let hiddenIcons = Main.systrayManager.getRoles();

            if (hiddenIcons.indexOf(role.toLowerCase()) != -1) {
                // We've got an applet for that
                global.log("Hiding systray: " + role);
                return;
            }

            global.log(`Adding legacy tray icon: ${role}`);

            let wrapper = new TrayIconWrapper(this, icon, role);

            this.trayWrappers.push(wrapper);
            this.manager_container.insert_child_at_index(wrapper.actor, 1);

            this.registerApp(wrapper);
            wrapper.updateVisibility();

            this.sortIcons();
            this.updateCollapsedState();
        } catch (e) {
            global.logError(e);
        }
    }

    _onTrayIconRemoved(o, icon) {
        for (let i = 0; i < this.trayWrappers.length; i++) {
            if (this.trayWrappers[i].icon === icon) {
                let wrapper = this.trayWrappers[i];
                this.trayWrappers.splice(i, 1);
                wrapper.destroy();

                this.updateCollapsedState();
                return;
            }
        }
    }

    _onBeforeRedisplay() {
        // Mark all icons as obsolete
        // There might still be pending delayed operations to insert/resize of them
        // And that would crash Cinnamon
        for (let wrapper of this.trayWrappers) {
            wrapper.destroy();
        }
        this.trayWrappers = [];

        this.updateCollapsedState();
    }

    /* ------- stock applet logic ------- */

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

        this.registerApp(statusIcon);

        this.sortIcons();
        this.updateCollapsedState();
    }

    removeStatusIcon(icon_proxy) {
        let key = this.getKey(icon_proxy);

        if (!this.statusIcons[key]) {
            return;
        }

        let statusIcon = this.statusIcons[key];
        let parent = statusIcon.actor.get_parent();

        if (parent) {
            parent.remove_child(statusIcon.actor);
        }

        statusIcon.destroy();
        delete this.statusIcons[key];

        this.sortIcons();
        this.updateCollapsedState();
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

        let icon_list = []

        for (let i in this.statusIcons) {
            /* icons currently shown in the overflow popup are not our children */
            if (!this.statusIcons[i].inPopup) {
                icon_list.push(this.statusIcons[i]);
            }
        }

        icon_list.sort(this._sortFunc);
        icon_list.reverse()

        for (let icon of icon_list) {
            this.manager_container.set_child_at_index(icon.actor, 0);
        }

        /* Legacy tray icons group in front of the XApp ones */
        for (let wrapper of this.trayWrappers) {
            if (!wrapper.inPopup) {
                this.manager_container.set_child_at_index(wrapper.actor, 0);
            }
        }

        /* Chevron always first (like the Windows overflow arrow), recorder always last */
        this.manager_container.set_child_at_index(this.chevron.actor, 0);
        this.manager_container.set_child_at_index(this._recording_indicator.actor, -1);
    }

    refreshIcons() {
        for (let owner in this.statusIcons) {
            let icon = this.statusIcons[owner];
            icon.refresh();
        }

        this.chevron.update();
        this._recording_indicator.refresh();
    }

    icon_size_changed() {
        this.refreshIcons();
        Main.statusIconDispatcher.redisplay();
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
        /* Empty the popup grid BEFORE anything is destroyed: destroying an
         * St.Bin cell that still holds an icon actor is a fatal assertion
         * in St and takes the whole of Cinnamon down. */
        if (this.menu.isOpen) {
            this.menu.close(false);
        }
        this._returnPopupIcons();

        this._cancelAutocollapse();

        if (this._collapseOnClickId > 0) {
            Mainloop.source_remove(this._collapseOnClickId);
            this._collapseOnClickId = 0;
        }

        if (this._scaleUpdateId > 0) {
            Mainloop.source_remove(this._scaleUpdateId);
            this._scaleUpdateId = 0;
        }

        this.signalManager.disconnectAllSignals();

        for (let key in this.statusIcons) {
            this.statusIcons[key].destroy();
            delete this.statusIcons[key];
        };

        for (let key in this.ignoredProxies) {
            delete this.ignoredProxies[key];
        };

        for (let wrapper of this.trayWrappers) {
            wrapper.destroy();
        }
        this.trayWrappers = [];

        this.menu.destroy();

        this.chevron.destroy();
        this.chevron = null;

        this._recording_indicator.destroy();
        this._recording_indicator = null;

        this.monitor = null;

        this.settings.finalize();
    }

    on_panel_edit_mode_changed() {
        let reactive = !global.settings.get_boolean('panel-edit-mode');
        for (let owner in this.statusIcons) {
            let icon = this.statusIcons[owner];
            icon.actor.reactive = reactive;
        }
        this.updateCollapsedState();
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

        this.update_na_tray_orientation();
        this.refreshIcons();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CollapsibleXAppStatusApplet(orientation, panel_height, instance_id);
}
