const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "panel-drawer@ChrisB85";
const XAPP_UUID = "xapp-status@cinnamon.org";
const SYSTRAY_UUID = "systray@cinnamon.org";
const SNI_WATCHER = "org.kde.StatusNotifierWatcher";
const FLATPAK_SUFFIX = ":flatpak";
const MENU_ICON_SIZE = 24;     // only ever asks the theme whether it has the icon

const Drawer = imports.ui.appletManager.applets[UUID].drawer;

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.orientation = orientation;
        this._collapsed = false;
        this._hiddenKeys = [];          // what we hid ourselves - only these get shown again
        this._idCache = {};             // bus name -> StatusNotifier Id
        this._watched = [];             // [[object, signalId]]
        this._busy = false;             // we are the one changing visibility right now
        this._graceActors = [];         // just appeared - not hidden yet, see _refreshWatches
        this._hoverTimeoutId = null;
        this._collapseTimeoutId = null;
        this._startTimeoutId = null;
        this._restructureId = null;
        this._revealIds = [];           // XEmbed icons waiting for the row to settle

        try {
            Gtk.IconTheme.get_default().append_search_path(metadata.path);

            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            ["hoveropens", "hovertime", "autocollapsetime", "animationtime"].forEach((key) => {
                this.settings.bindProperty(Settings.BindingDirection.IN, key, key, function() {}, null);
            });
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "draweritems", "draweritems",
                                       this._onMembersChanged.bind(this), null);

            this._buildContextMenu();

            global.settings.connect("changed::panel-edit-mode",
                                    this.on_panel_edit_mode_changed.bind(this));
            this.actor.connect("enter-event", this._onEntered.bind(this));
            this.actor.connect("leave-event", this._cancelHover.bind(this));

            this._updateIcon();

            // Panels and tray icons are still loading while we start up.
            this._startTimeoutId = Mainloop.timeout_add(1500, () => {
                this._startTimeoutId = null;
                this._refreshWatches();
                this._collapse();
                this._rebuildMemberItems();
                return false;
            });
        }
        catch (e) {
            global.logError(e);
        }
    },

    // -- what the drawer can hide ------------------------------------------

    _panelBox: function() {
        return this.actor.get_parent();
    },

    /** Every applet with this UUID, wherever it sits. */
    _appletsByUuid: function(uuid) {
        let found = [];
        Main.panelManager.panels.forEach((panel) => {
            if (!panel)
                return;
            [panel._leftBox, panel._centerBox, panel._rightBox].forEach(function(box) {
                box.get_children().forEach(function(child) {
                    if (child._applet && child._applet._uuid === uuid)
                        found.push(child._applet);
                });
            });
        });
        return found;
    },

    /** The XApp status applet object, wherever it sits. */
    _xappApplet: function() {
        return this._appletsByUuid(XAPP_UUID)[0] || null;
    },

    /**
     * The icons of the legacy XEmbed tray, as [button, wm_class].
     *
     * Apps that never moved to StatusNotifier (AnyDesk, and anything Java or
     * plain Qt) end up here instead, in the systray applet - a box of St.Bin
     * wrappers around X windows, one per icon.
     */
    _systrayIcons: function() {
        let icons = [];
        this._appletsByUuid(SYSTRAY_UUID).forEach(function(systray) {
            if (!systray.button_box)
                return;
            systray.button_box.get_children().forEach(function(button) {
                if (button.child)
                    icons.push([button, button.child.wm_class || ""]);
            });
        });
        return icons;
    },

    /** The tray icon a bus name belongs to, if it is still on the panel. */
    _trayIcon: function(busName) {
        let xapp = this._xappApplet();
        if (!xapp)
            return null;
        for (let id in xapp.statusIcons) {
            let icon = xapp.statusIcons[id];
            if ((icon.proxy.name || "") === busName)
                return icon;
        }
        return null;
    },

    /**
     * The Id an app registered its StatusNotifier item under, so bridged icons
     * keep the same key across sessions.
     *
     * Asked in the background - the watcher knows the object path, the app
     * itself knows the Id. Until both answers land the icon is keyed by its
     * tooltip, and _rekey carries our bookkeeping over to the new key.
     */
    _idFor: function(busName) {
        if (this._idCache[busName] !== undefined)
            return this._idCache[busName];

        this._idCache[busName] = null;          // one lookup per bus name, answer or not
        Gio.DBus.session.call(
            SNI_WATCHER, "/StatusNotifierWatcher", "org.freedesktop.DBus.Properties", "Get",
            new GLib.Variant("(ss)", [SNI_WATCHER, "RegisteredStatusNotifierItems"]),
            new GLib.VariantType("(v)"), Gio.DBusCallFlags.NONE, 500, null,
            (bus, result) => {
                let entries;
                try {
                    entries = bus.call_finish(result).get_child_value(0).get_variant().deep_unpack();
                }
                catch (e) {
                    return;             // no StatusNotifier host on this session
                }
                // Entries read "<bus name><object path>", e.g. ":1.42/StatusNotifierItem".
                let entry = entries.filter(function(e) {
                    return e.indexOf(busName + "/") === 0;
                })[0];
                if (entry)
                    this._askId(busName, entry.substring(busName.length));
            });
        return null;
    },

    _askId: function(busName, objectPath) {
        Gio.DBus.session.call(
            busName, objectPath, "org.freedesktop.DBus.Properties", "Get",
            new GLib.Variant("(ss)", ["org.kde.StatusNotifierItem", "Id"]),
            new GLib.VariantType("(v)"), Gio.DBusCallFlags.NONE, 500, null,
            (bus, result) => {
                let id;
                try {
                    id = bus.call_finish(result).get_child_value(0).get_variant().deep_unpack();
                }
                catch (e) {
                    return;             // app already gone, or it will not say
                }
                if (id) {
                    this._idCache[busName] = id;
                    this._rekey(busName);
                }
            });
    },

    /** An Id changes the icon's key, so move whatever we track by key onto the new one. */
    _rekey: function(busName) {
        let icon = this._trayIcon(busName);
        if (!icon)
            return;

        let tooltip = icon.proxy.tooltip_text || "";
        let oldKey = Drawer.trayKey({ name: busName, id: null, tooltip: tooltip });
        let newKey = Drawer.trayKey({ name: busName, id: this._idCache[busName], tooltip: tooltip });
        if (oldKey !== newKey) {
            let hidden = this._hiddenKeys.indexOf(oldKey);
            if (hidden > -1)
                this._hiddenKeys[hidden] = newKey;

            let members = this._members().slice();
            let member = members.indexOf(oldKey);
            if (member > -1) {
                members[member] = newKey;
                this.draweritems = members;     // settings only notice a fresh array
            }
        }

        this._apply();
        this._rebuildMemberItems();
    },

    /** Everything the drawer may hide: applets next to us, plus every tray icon. */
    _items: function() {
        let items = [];

        let parent = this._panelBox();
        if (parent) {
            parent.get_children().forEach((child) => {
                if (!child._applet || child === this.actor)
                    return;
                let applet = child._applet;
                let meta = applet._meta || {};
                let appletIcon = applet._applet_icon;
                items.push({
                    kind: "applet",
                    key: Drawer.keyFor(applet._uuid, applet.instance_id),
                    label: meta.name || applet._uuid,
                    icon: (appletIcon && appletIcon.get_icon_name()) || meta.icon || null,
                    actor: child,
                    visible: child.visible
                });
            });
        }

        let xapp = this._xappApplet();
        if (xapp) {
            for (let id in xapp.statusIcons) {
                let icon = xapp.statusIcons[id];
                let proxy = icon.proxy;
                let name = proxy.name || "";
                let tooltip = proxy.tooltip_text || "";
                let describe = {
                    name: name,
                    id: name.charAt(0) === ":" ? this._idFor(name) : null,
                    tooltip: tooltip
                };
                items.push({
                    kind: "tray",
                    key: Drawer.trayKey(describe),
                    label: Drawer.trayLabel(describe),
                    // Some apps park an icon on the panel with nothing drawn in
                    // it (mintreport publishes " "), so fall back to the app.
                    icon: (proxy.icon_name || "").trim() || this._appIcon(name),
                    actor: icon.actor,
                    proxy: proxy,
                    visible: icon.actor.visible
                });
            }
        }

        // wm_class is what Cinnamon itself keys an XEmbed icon on, and it is all
        // these icons say about themselves.
        this._systrayIcons().forEach((pair) => {
            let wmClass = pair[1] || "unknown";
            items.push({
                kind: "tray",
                key: Drawer.systrayKey(wmClass),
                label: wmClass,
                icon: this._appIcon(wmClass),
                actor: pair[0],
                visible: pair[0].visible,
                xembed: true
            });
        });

        return items;
    },

    _members: function() {
        return this.draweritems || [];
    },

    _isMember: function(key) {
        return this._members().indexOf(key) > -1;
    },

    _toggleMember: function(key, wanted) {
        let members = this._members().slice();
        let pos = members.indexOf(key);
        if (wanted && pos < 0)
            members.push(key);
        else if (!wanted && pos > -1)
            members.splice(pos, 1);
        if (wanted)
            this._collapsed = true;     // picking an icon hides it right away, like Windows does
        this.draweritems = members;
        // The binding's callback only runs for changes coming from the settings
        // file (settings.js _checkSettings), and writing the property from here
        // updates the in-memory copy first - so that comparison never fires.
        this._onMembersChanged();
    },

    _onMembersChanged: function() {
        this._apply();
        this._updateIcon();
    },

    // -- applying the state ------------------------------------------------

    _apply: function() {
        if (this._busy || global.settings.get_boolean("panel-edit-mode"))
            return;

        let items = this._items();
        let byKey = {};
        items.forEach(function(i) { byKey[i.key] = i; });

        let plan = Drawer.plan(items, this._members(), this._hiddenKeys, this._collapsed);

        this._busy = true;
        plan.toHide.forEach((key) => {
            if (this._graceActors.indexOf(byKey[key].actor) > -1)
                return;                 // the app behind it just started - leave it in sight
            if (this._hiddenKeys.indexOf(key) < 0)
                this._hiddenKeys.push(key);     // it may be a re-hide, and one key means one entry
            this._slideOut(byKey[key]);
        });
        plan.toShow.forEach((key) => {
            this._hiddenKeys.splice(this._hiddenKeys.indexOf(key), 1);
            this._slideIn(byKey[key]);
        });
        this._busy = false;
    },

    // -- sliding -----------------------------------------------------------

    /** Drop any running transition and hand the actor back its own sizing. */
    _resetActor: function(actor) {
        actor.remove_all_transitions();
        actor.set_clip_to_allocation(false);
        actor.set_width(-1);
        actor.set_height(-1);
        actor.opacity = 255;
    },

    /**
     * Size the sliding actor, whole pixels only.
     *
     * panel.js rounds the boundary between the panel boxes but not the width of
     * the boxes themselves, so a fractional child leaves the whole row off the
     * screen edge by up to a pixel for as long as the tween runs. Hence the
     * size is stepped by hand instead of being handed to ease().
     */
    _setSize: function(actor, vertical, size) {
        if (vertical)
            actor.set_height(size);
        else
            actor.set_width(size);
    },

    _cancelReveal: function(actor) {
        if (!actor._pdRevealId)
            return;
        Mainloop.source_remove(actor._pdRevealId);
        this._revealIds.splice(this._revealIds.indexOf(actor._pdRevealId), 1);
        actor._pdRevealId = null;
    },

    /**
     * An XEmbed tray icon is a real X window the app owns, and the panel drags
     * it along on every frame the row moves - a round trip to the app each time,
     * which stutters. So it is taken out of the row for the whole animation and
     * put back once nothing is moving any more.
     */
    _slideIn: function(item) {
        let actor = item.actor;
        let duration = this.animationtime || 0;

        if (item.xembed) {
            this._cancelReveal(actor);
            if (!duration) {
                this._resetActor(actor);
                actor.show();
                return;
            }
            actor._pdRevealId = Mainloop.timeout_add(duration, () => {
                this._revealIds.splice(this._revealIds.indexOf(actor._pdRevealId), 1);
                actor._pdRevealId = null;
                this._resetActor(actor);
                actor.show();
                return false;
            });
            this._revealIds.push(actor._pdRevealId);
            return;
        }

        this._resetActor(actor);
        actor.show();

        if (!duration)
            return;

        let vertical = this.is_vertical();
        // Ask what the icon wants to be before pinning it to zero.
        let natural = Math.round(
            (vertical ? actor.get_preferred_height(-1) : actor.get_preferred_width(-1))[1]);
        if (natural <= 0)
            return;

        actor.set_clip_to_allocation(true);     // no spilling out of the shrunk box
        actor.opacity = 0;
        this._setSize(actor, vertical, 0);
        actor.ease({
            opacity: 255,
            duration: duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onUpdate: (transition) => {
                this._setSize(actor, vertical, Math.round(natural * transition.get_progress()));
            },
            onComplete: () => {
                actor.set_clip_to_allocation(false);
                actor.set_width(-1);
                actor.set_height(-1);
            }
        });
    },

    _slideOut: function(item) {
        let actor = item.actor;
        let duration = this.animationtime || 0;

        if (item.xembed) {
            this._cancelReveal(actor);
            let wasBusy = this._busy;
            this._busy = true;              // hiding is us, not the app
            this._resetActor(actor);
            actor.hide();
            this._busy = wasBusy;
            return;
        }

        if (!duration) {
            this._resetActor(actor);
            actor.hide();
            return;
        }

        let done = () => {
            let wasBusy = this._busy;
            this._busy = true;              // hiding is us, not the app
            actor.hide();
            this._busy = wasBusy;
            this._resetActor(actor);
        };

        actor.remove_all_transitions();
        actor.set_clip_to_allocation(true);
        let vertical = this.is_vertical();
        // Whatever it is right now - it may still be sliding in.
        let natural = Math.round(vertical ? actor.height : actor.width);
        actor.ease({
            opacity: 0,
            duration: duration,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onUpdate: (transition) => {
                this._setSize(actor, vertical, Math.round(natural * (1 - transition.get_progress())));
            },
            onComplete: done
        });
    },

    _collapse: function() {
        this._collapsed = true;
        this._graceActors = [];
        this._apply();
        this._cancelAutoCollapse();
        this._updateIcon();
    },

    _expand: function() {
        this._collapsed = false;
        this._graceActors = [];
        this._apply();
        this._queueAutoCollapse();
        this._updateIcon();
    },

    /**
     * Re-hook everything we react to: the panel box (applets come and go), the
     * tray container (icons come and go) and each icon actor, because the XApp
     * applet shows an icon again whenever the app flips its Visible property.
     */
    _refreshWatches: function() {
        this._watched.forEach(function(pair) {
            try { pair[0].disconnect(pair[1]); } catch (e) {}
        });
        this._watched = [];

        let watch = (object, signal, handler) => {
            if (object)
                this._watched.push([object, object.connect(signal, handler)]);
        };

        /**
         * The XApp applet puts a tray icon's actor on the panel before it lists
         * the icon (addStatusIcon), so looking at the tray from inside the
         * signal would miss the icon that just arrived. Wait for the current
         * callback to finish first.
         */
        let onStructureChanged = () => {
            if (this._busy || this._restructureId)
                return;
            this._restructureId = Mainloop.idle_add(() => {
                this._restructureId = null;
                this._apply();
                this._refreshWatches();
                this._rebuildMemberItems();
                if (this._graceActors.length)
                    this._queueAutoCollapse();
                return false;
            });
        };

        // An icon showing up while the drawer is shut belongs to an app the user
        // has just started, so it stays in sight for the auto collapse delay
        // instead of vanishing under their hands.
        let onActorAdded = (container, actor) => {
            if (!this._busy && this._collapsed && this.autocollapsetime &&
                this._graceActors.indexOf(actor) < 0)
                this._graceActors.push(actor);
            onStructureChanged();
        };

        watch(this._panelBox(), "actor-added", onActorAdded);
        watch(this._panelBox(), "actor-removed", onStructureChanged);

        this._appletsByUuid(SYSTRAY_UUID).forEach((systray) => {
            watch(systray.button_box, "actor-added", onActorAdded);
            watch(systray.button_box, "actor-removed", onStructureChanged);
        });

        let xapp = this._xappApplet();
        if (xapp) {
            watch(xapp.manager_container, "actor-added", onActorAdded);
            watch(xapp.manager_container, "actor-removed", onStructureChanged);
        }

        // Anything on the panel may show itself again behind our back, and it
        // never says so: the XApp applet shows every tray icon when the theme
        // changes, and the network applet shows itself on every NetworkManager
        // state change. So watch each actor, not just the tray ones.
        this._items().forEach((item) => {
            watch(item.actor, "notify::visible", () => {
                if (!this._busy)
                    this._apply();
            });
        });
    },

    // -- context menu ------------------------------------------------------

    _buildContextMenu: function() {
        this._applet_context_menu.addMenuItem(
            new PopupMenu.PopupMenuItem(_("Keep in the drawer:"), { reactive: false }));
        this._membersSection = new PopupMenu.PopupMenuSection();
        this._applet_context_menu.addMenuItem(this._membersSection);

        // Icons come and go while the menu is shut, so refresh the list on the way in.
        this._applet_context_menu.connect("open-state-changed", (menu, open) => {
            if (open)
                this._rebuildMemberItems(true);
        });
    },

    /**
     * The picture for a tray icon that does not hand one over - all we have is
     * the name it goes by (WM_CLASS for XEmbed, bus name for the rest): the
     * .desktop icon of the app answering to that name first, a theme icon of
     * that name second. Flatpak apps register their WM_CLASS with a ":flatpak"
     * suffix, and an app whose tray window is a separate binary calls itself
     * "<app>-app" or "<app>-bin" there.
     */
    _appIcon: function(wmClass) {
        let appSystem = Cinnamon.AppSystem.get_default();
        let theme = Gtk.IconTheme.get_default();

        let names = [wmClass, wmClass.toLowerCase()];
        let trimmed = names[1].replace(/-(app|bin|desktop)$/, "");
        if (trimmed && trimmed !== names[1])
            names.push(trimmed);

        for (let i = 0; i < names.length; i++) {
            let name = names[i];
            let app = appSystem.lookup_startup_wmclass(name)
                   || appSystem.lookup_startup_wmclass(name + FLATPAK_SUFFIX)
                   || appSystem.lookup_desktop_wmclass(name)
                   || appSystem.lookup_desktop_wmclass(name + FLATPAK_SUFFIX);
            let info = app && app.get_app_info();
            let gicon = info && info.get_icon();
            if (gicon)
                return gicon;
            // lookup_icon() is what St resolves an icon through, and it finds
            // the legacy pixmap dirs the plain theme folders leave out.
            if (theme.lookup_icon(name, MENU_ICON_SIZE, 0))
                return name;
        }

        // Nothing claims the class - a generic icon still beats an empty slot.
        return "application-x-executable";
    },

    /** Tray icons name themselves by GIcon, icon theme name or temp file path. */
    _dressIcon: function(iconActor, name) {
        if (!name) {
            iconActor.visible = false;
            return;
        }
        if (typeof name !== "string") {
            iconActor.gicon = name;
            return;
        }
        name = name.trim();
        if (!name) {
            iconActor.visible = false;
            return;
        }
        if (name.charAt(0) === "/") {
            iconActor.gicon = Gio.FileIcon.new(Gio.File.new_for_path(name));
            return;
        }
        iconActor.icon_type = name.indexOf("-symbolic") > -1 ? St.IconType.SYMBOLIC
                                                             : St.IconType.FULLCOLOR;
        iconActor.icon_name = name;
    },

    _rebuildMemberItems: function(force) {
        if (!this._membersSection)
            return;
        if (this._applet_context_menu.isOpen && !force)
            return;                     // never pull items out from under an open menu

        this._membersSection.removeAll();

        let items = this._items();
        let byLabel = {};
        items.forEach(function(i) { byLabel[i.label] = (byLabel[i.label] || 0) + 1; });

        ["tray", "applet"].forEach((kind) => {
            let group = items.filter(function(i) { return i.kind === kind; });
            if (!group.length)
                return;

            if (kind === "applet")
                this._membersSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            group.sort(function(a, b) { return a.label.localeCompare(b.label); });
            group.forEach((item) => {
                let label = byLabel[item.label] > 1 ? item.label + " (" + item.key + ")" : item.label;
                // Tray icons announce themselves by bus name ("blueman", "mintUpdate.py"),
                // which nobody recognises - so show the icon the panel shows.
                let menuItem = new PopupMenu.PopupSwitchIconMenuItem(
                    label, this._isMember(item.key), "", St.IconType.FULLCOLOR);
                this._dressIcon(menuItem._icon, item.icon);
                menuItem.connect("toggled", (source, state) => {
                    this._toggleMember(item.key, state);
                });
                this._membersSection.addMenuItem(menuItem);
            });
        });
    },

    // -- interaction -------------------------------------------------------

    on_applet_clicked: function(event) {
        if (this._collapsed)
            this._expand();
        else
            this._collapse();
    },

    _onEntered: function(event) {
        if (!this.hoveropens || !this._collapsed)
            return;
        this._cancelHover();
        this._hoverTimeoutId = Mainloop.timeout_add(this.hovertime, () => {
            this._hoverTimeoutId = null;
            if (this.actor.hover)
                this._expand();
            return false;
        });
    },

    _cancelHover: function() {
        if (this._hoverTimeoutId) {
            Mainloop.source_remove(this._hoverTimeoutId);
            this._hoverTimeoutId = null;
        }
    },

    // -- auto collapse -----------------------------------------------------

    _queueAutoCollapse: function(delay, keepState) {
        this._cancelAutoCollapse();
        if (!this.autocollapsetime)
            return;
        if (!keepState)
            this._wasInUse = false;
        let full = Math.round(this.autocollapsetime * 1000);
        this._collapseTimeoutId = Mainloop.timeout_add(delay || full, () => {
            this._collapseTimeoutId = null;
            if (this._collapsed && !this._graceActors.length)
                return false;
            if (this._inUse()) {        // pointer on the icons, or one of their menus open
                this._wasInUse = true;
                this._queueAutoCollapse(Math.min(full, 400), true);
                return false;
            }
            if (this._wasInUse) {
                // The countdown belongs to the moment the pointer left, not to the
                // moment the drawer opened - so start it over now.
                this._wasInUse = false;
                this._queueAutoCollapse(full, true);
                return false;
            }
            this._collapse();
            return false;
        });
    },

    _cancelAutoCollapse: function() {
        if (this._collapseTimeoutId) {
            Mainloop.source_remove(this._collapseTimeoutId);
            this._collapseTimeoutId = null;
        }
    },

    _pointerOver: function(actor, px, py) {
        if (!actor || !actor.visible || !actor.get_stage())
            return false;
        let [x, y] = actor.get_transformed_position();
        let [w, h] = actor.get_transformed_size();
        return px >= x && px <= x + w && py >= y && py <= y + h;
    },

    /**
     * Is the user busy with the icons we just revealed?
     *
     * actor.hover alone is not enough: an SNI icon's menu is a GTK window of its
     * own, so the panel stops seeing the pointer the moment the menu opens, and
     * the gaps between icons are not hover territory either. Hence the pointer
     * rectangle test, the whole tray strip, and the proxy's own menu flags.
     */
    _inUse: function() {
        if (this._applet_context_menu.isOpen)
            return true;

        let [px, py] = global.get_pointer();
        if (this.actor.hover || this._pointerOver(this.actor, px, py))
            return true;

        // Collapsing shifts every applet next to us, so anything the pointer aims
        // at moves out from under it. Wait until the pointer leaves the row.
        if (this._pointerOver(this._panelBox(), px, py))
            return true;

        let items = this._items();
        let hasTrayMember = items.some((item) => {
            return item.kind === "tray" && this._isMember(item.key);
        });
        if (hasTrayMember) {
            let xapp = this._xappApplet();
            if (xapp && this._pointerOver(xapp.manager_container, px, py))
                return true;            // anywhere in the tray strip counts
        }

        return items.some((item) => {
            if (!this._isMember(item.key))
                return false;
            if (item.actor.hover || this._pointerOver(item.actor, px, py))
                return true;
            if (item.proxy && (item.proxy.primary_menu_is_open || item.proxy.secondary_menu_is_open))
                return true;
            let applet = item.actor._applet;
            let manager = applet && (applet._menuManager || applet.menuManager);
            return !!(manager && manager._activeMenu);
        });
    },

    // -- panel state -------------------------------------------------------

    on_panel_edit_mode_changed: function() {
        let editMode = global.settings.get_boolean("panel-edit-mode");
        if (editMode) {
            // Hand everything back before a drag can start: hidden actors have no
            // allocation, and panel.js drops applets by comparing the pointer
            // against the children's centres.
            this._wasCollapsed = this._collapsed;
            this._collapsed = false;
            this._showEverythingWeHid();
            this._updateIcon();
        } else if (this._wasCollapsed) {
            this._collapse();
        }
    },

    _showEverythingWeHid: function() {
        let byKey = {};
        this._items().forEach(function(i) { byKey[i.key] = i; });
        this._busy = true;
        this._hiddenKeys.forEach((key) => {
            if (!byKey[key])
                return;
            this._resetActor(byKey[key].actor);  // kill any tween, restore natural size
            byKey[key].actor.show();
        });
        this._busy = false;
        this._hiddenKeys = [];
    },

    on_orientation_changed: function(orientation) {
        this.orientation = orientation;
        this._updateIcon();
    },

    on_applet_removed_from_panel: function() {
        this._cancelHover();
        this._cancelAutoCollapse();
        if (this._startTimeoutId)
            Mainloop.source_remove(this._startTimeoutId);
        if (this._restructureId)
            Mainloop.source_remove(this._restructureId);
        this._revealIds.forEach(function(id) { Mainloop.source_remove(id); });
        this._revealIds = [];
        this._watched.forEach(function(pair) {
            try { pair[0].disconnect(pair[1]); } catch (e) {}
        });
        this._watched = [];
        this._showEverythingWeHid();    // never leave icons stranded invisible
        this.settings.finalize();
    },

    // -- misc --------------------------------------------------------------

    _updateIcon: function() {
        // Collapsed points back at the arrow's own side (horizontal "2" is <, vertical
        // "2v" is ^), expanded points along the row the icons come back into.
        let name = this._collapsed ? "2" : "1";
        this.set_applet_icon_symbolic_name(this.is_vertical() ? name + "v" : name);
        if (!this._members().length)
            this.set_applet_tooltip(_("Drawer is empty - right click to pick icons"));
        else
            this.set_applet_tooltip(this._collapsed ? _("Show hidden icons") : _("Hide icons"));
    },

    is_vertical: function() {
        return this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT;
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
