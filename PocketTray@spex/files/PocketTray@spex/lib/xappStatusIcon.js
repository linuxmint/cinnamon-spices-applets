// One XApp status icon in the panel or pocket, plus the screen-recording
// indicator. Adapted from xapp-status@cinnamon.org (linuxmint/cinnamon,
// GPL-2.0-or-later).
//
// Differences to the original:
//  - the icon does not place itself: XAppHost decides between panel and
//    pocket and is told about changes through host.onIconChanged()
//  - `id` identifies the icon in the hidden list: the proxy name, or the
//    process name for unnamed StatusNotifierItems (resolved asynchronously)
//  - before a click reaches the application, host.onIconActivated() lets
//    the pocket close, so its modal grab can't block the application's menu
//
// Host interface (implemented by XAppHost):
//   host.orientation, host.getPanelIconSize(type), host.isVertical()
//   host.onIconChanged(icon), host.onIconActivated(icon)

const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const XApp = imports.gi.XApp;
const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;

const SNI_NAME = /^org\.freedesktop\.statusnotifieritem-(\d+)-\d+$/;

// Lower-case identifier from the proxy name: "org.x.StatusIcon.<name>" and
// plain names -> <name>. StatusNotifierItems without an id are named
// "org.freedesktop.statusnotifieritem-<pid>-<n>"; for those the process name
// is looked up asynchronously, see XAppStatusIcon._resolveProcessName().
function getProxyId(proxy) {
    return (proxy.name || "").replace(/^org\.x\.StatusIcon\./, "").toLowerCase();
}

// Red dot while Cinnamon's screen recorder is running (part of xapp-status).
var RecorderIcon = class RecorderIcon {
    constructor(host) {
        this._host = host;
        this.actor = new St.BoxLayout({
            style_class: "applet-box",
            reactive: false,
            visible: false,
            x_expand: true,
            y_expand: true
        });

        this.icon_holder = new St.Bin();
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
        let border = area.get_theme_node().get_foreground_color();
        let cr = area.get_context();

        Clutter.cairo_set_source_color(cr, new Clutter.Color({ red: 255, green: 0, blue: 0, alpha: 255 }));
        cr.arc(width / 2, height / 2, size / 4.0, 0.0, 2.0 * Math.PI);
        cr.fillPreserve();
        Clutter.cairo_set_source_color(cr, border);
        cr.stroke();
        cr.$dispose();
    }

    refresh() {
        const size = this._host.getPanelIconSize(St.IconType.FULLCOLOR);
        this.actor.vertical = this._host.isVertical();
        this._indicator.set_size(size, size);
        this._indicator.queue_repaint();
    }

    destroy() {
        if (this._recordListenerId > 0) {
            Main.screenRecorder.disconnect(this._recordListenerId);
            this._recordListenerId = 0;
        }
        this.actor.destroy();
    }
};

var XAppStatusIcon = class XAppStatusIcon {
    constructor(host, proxy) {
        this._host = host;
        this.proxy = proxy;
        this.id = getProxyId(proxy);
        // Unnamed StatusNotifierItem: id becomes the process name
        this.anonymous = SNI_NAME.test(proxy.name || "");
        this._cancellable = new Gio.Cancellable();
        this._resolveProcessName();
        this.icon_loader_handle = null;

        this.actor = new St.BoxLayout({
            style_class: "applet-box",
            reactive: !global.settings.get_boolean('panel-edit-mode'),
            track_hover: true,
            x_expand: true,
            y_expand: true
        });

        this.icon_holder = new St.Bin();
        this.iconSize = this._host.getPanelIconSize(St.IconType.FULLCOLOR);
        this.proxy.icon_size = this.iconSize;

        this.label = new St.Label({ 'y-align': St.Align.END });

        this.actor.add_actor(this.icon_holder);
        this.actor.add_actor(this.label);

        this._tooltip = new Tooltips.PanelItemTooltip(this, "", host.orientation);

        this.actor.connect('button-press-event', (a, e) => this.onButtonPressEvent(a, e));
        this.actor.connect('button-release-event', (a, e) => this.onButtonReleaseEvent(a, e));
        this.actor.connect('scroll-event', (a, e) => this.onScrollEvent(a, e));
        this.actor.connect('enter-event', () => { this._tooltip.preventShow = false; });

        this._proxy_prop_change_id = this.proxy.connect('g-properties-changed',
            (p, changed, invalidated) => this.on_properties_changed(p, changed, invalidated));

        this.refresh();
    }

    on_properties_changed(proxy, changed_props, invalidated_props) {
        let prop_names = changed_props.deep_unpack();

        if ('IconName' in prop_names) this.setIconName(proxy.icon_name);
        if ('TooltipText' in prop_names) this.setTooltipText(proxy.tooltip_text);
        if ('Label' in prop_names) this.setLabel(proxy.label);
        if ('Visible' in prop_names) {
            this.setVisible(proxy.visible);
            this._host.onIconChanged(this);
        }
        if ('Name' in prop_names) {
            this.id = getProxyId(proxy);
            this.anonymous = SNI_NAME.test(proxy.name || "");
            this._resolveProcessName();
            this._host.onIconChanged(this);
        }
        if ('PrimaryMenuIsOpen' in prop_names && !proxy.primary_menu_is_open) this.actor.sync_hover();
        if ('SecondaryMenuIsOpen' in prop_names && !proxy.secondary_menu_is_open) this.actor.sync_hover();
    }

    // For unnamed StatusNotifierItems read /proc/<pid>/comm without
    // blocking, then let the host re-sort the icon under its new id.
    _resolveProcessName() {
        const m = (this.proxy.name || "").match(SNI_NAME);
        if (!m) return;

        Gio.File.new_for_path("/proc/" + m[1] + "/comm").load_contents_async(this._cancellable, (file, res) => {
            try {
                const [ok, bytes] = file.load_contents_finish(res);
                const comm = ok ? new TextDecoder().decode(bytes).trim().toLowerCase() : "";
                if (comm && this.proxy && comm !== this.id) {
                    this.id = comm;
                    this._host.onIconChanged(this);
                }
            } catch (e) {
                // cancelled or process already gone: keep the raw name
            }
        });
    }

    refresh() {
        this.setIconName(this.proxy.icon_name);
        this.setLabel(this.proxy.label);
        this.setTooltipText(this.proxy.tooltip_text);
        this.setVisible(this.proxy.visible);
        this.setOrientation(this._host.orientation);
        this.actor.queue_relayout();
    }

    setOrientation(orientation) {
        this._tooltip.orientation = orientation;
        if (orientation === St.Side.LEFT || orientation === St.Side.RIGHT) {
            this.actor.vertical = true;
            this.actor.add_style_class_name("vertical");
        } else {
            this.actor.vertical = false;
            this.actor.remove_style_class_name("vertical");
        }
    }

    setIconName(iconName) {
        if (!iconName || !iconName.trim()) {
            this.icon_holder.hide();
            return;
        }

        const type = iconName.match(/symbolic/) ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR;

        this.iconSize = this._host.getPanelIconSize(type);
        this.proxy.icon_size = this.iconSize;

        // Assume symbolic icons are always square/suitable for an StIcon.
        if (iconName.includes("/") && type !== St.IconType.SYMBOLIC) {
            this.icon_loader_handle = St.TextureCache.get_default().load_image_from_file_async(
                iconName,
                // Top/bottom panel: allow horizontal expansion, else keep square
                this.actor.vertical ? this.iconSize : -1,
                this.iconSize,
                (...args) => this._onImageLoaded(...args)
            );
            return;
        }

        this.icon_holder.child = new St.Icon({ icon_type: type, icon_size: this.iconSize, icon_name: iconName });
        this.icon_holder.show();
    }

    _onImageLoaded(cache, handle, actor) {
        if (handle !== this.icon_loader_handle || !this.proxy) {
            return;   // a newer image was requested meanwhile, or destroyed
        }
        this.icon_holder.child = actor;
        this.icon_holder.show();
    }

    setTooltipText(tooltipText) {
        if (tooltipText) {
            this._tooltip.preventShow = false;
        } else {
            tooltipText = "";
            this._tooltip.preventShow = true;
        }
        this._tooltip.set_markup(tooltipText);
        // Re-align a visible tooltip after its text length changed
        if (this._tooltip.visible) {
            this._tooltip.hide();
            this._tooltip.show();
        }
    }

    setLabel(label) {
        this.label.set_text(label || "");
        this.label.visible = !this._host.isVertical() && !!label && label.length > 0;
    }

    setVisible(visible) {
        if (visible) this.actor.show();
        else this.actor.hide();
    }

    // Position + side the application should use for its own menu.
    getEventPositionInfo(actor) {
        let allocation = Cinnamon.util_get_transformed_allocation(actor);

        let x = Math.round(allocation.x1 / global.ui_scale);
        let y = Math.round(allocation.y1 / global.ui_scale);
        let w = Math.round((allocation.x2 - allocation.x1) / global.ui_scale);
        let h = Math.round((allocation.y2 - allocation.y1) / global.ui_scale);

        switch (this._host.orientation) {
            case St.Side.TOP:   return [x, y + h, Gtk.PositionType.TOP];
            case St.Side.LEFT:  return [x + w, y, Gtk.PositionType.LEFT];
            case St.Side.RIGHT: return [x, y, Gtk.PositionType.RIGHT];
            default:            return [x, y, Gtk.PositionType.BOTTOM];
        }
    }

    onButtonPressEvent(actor, event) {
        this._tooltip.hide();
        this._tooltip.preventShow = true;

        if (event.get_button() === Clutter.BUTTON_SECONDARY && (event.get_state() & Clutter.ModifierType.CONTROL_MASK)) {
            return Clutter.EVENT_PROPAGATE;   // Ctrl+right click: applet context menu
        }

        // Remember the position now: inside the pocket the actor is hidden
        // once the pocket closes.
        this._pressInfo = this.getEventPositionInfo(actor);
        let [x, y, o] = this._pressInfo;
        this.proxy.call_button_press(x, y, event.get_button(), event.get_time(), o, null, null);

        return Clutter.EVENT_STOP;
    }

    onButtonReleaseEvent(actor, event) {
        let [x, y, o] = this._pressInfo || this.getEventPositionInfo(actor);
        this._pressInfo = null;

        // Close the pocket first: its modal grab would block the menu the
        // application is about to open.
        this._host.onIconActivated(this);

        this.proxy.call_button_release(x, y, event.get_button(), event.get_time(), o, null, null);

        return Clutter.EVENT_STOP;
    }

    onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction !== Clutter.ScrollDirection.SMOOTH) {
            let x_dir = XApp.ScrollDirection.UP;
            let delta = 0;

            if (direction === Clutter.ScrollDirection.UP) {
                x_dir = XApp.ScrollDirection.UP; delta = -1;
            } else if (direction === Clutter.ScrollDirection.DOWN) {
                x_dir = XApp.ScrollDirection.DOWN; delta = 1;
            } else if (direction === Clutter.ScrollDirection.LEFT) {
                x_dir = XApp.ScrollDirection.LEFT; delta = -1;
            } else if (direction === Clutter.ScrollDirection.RIGHT) {
                x_dir = XApp.ScrollDirection.RIGHT; delta = 1;
            }

            this.proxy.call_scroll(delta, x_dir, event.get_time(), null, null);
        }

        return Clutter.EVENT_STOP;
    }

    destroy() {
        this._cancellable.cancel();
        if (this._proxy_prop_change_id) {
            this.proxy.disconnect(this._proxy_prop_change_id);
            this._proxy_prop_change_id = 0;
        }
        this._tooltip.destroy();
        this.actor.destroy();
        this.proxy = null;
    }
};
