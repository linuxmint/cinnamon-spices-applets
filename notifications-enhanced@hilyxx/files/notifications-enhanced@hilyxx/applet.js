const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Urgency = imports.ui.messageTray.Urgency;
const NotificationDestroyedReason = imports.ui.messageTray.NotificationDestroyedReason;
const MessageTray = imports.ui.messageTray;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const Util = imports.misc.util;
const SignalManager = imports.misc.signalManager;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

const UUID = "notifications-enhanced@hilyxx";
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

class CinnamonNotificationsApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        // Detection of the official notifications@cinnamon.org applet already present
        const OTHER_UUID = "notifications@cinnamon.org";
        let cinnamonSettings = new Gio.Settings({ schema_id: "org.cinnamon" });
        let enabledApplets = cinnamonSettings.get_strv("enabled-applets");
        let found = false;
        for (let entry of enabledApplets) {
            if (entry.indexOf(OTHER_UUID) !== -1 && UUID !== OTHER_UUID) {
                found = true;
                break;
            }
        }
        if (found) {
            let source = new MessageTray.SystemNotificationSource();
            Main.messageTray.add(source);
            let notification = new MessageTray.Notification(
                source,
                _( "Notifications applet conflict" ),
                _( "Conflict detected: notifications@cinnamon.org is active.\nRemove it and restart Cinnamon before using Notifications-Enhanced applet." )
            );
            notification.setTransient(false);
            notification.setUrgency(MessageTray.Urgency.CRITICAL);
            source.notify(notification);
            throw new Error("Conflict: notifications@cinnamon.org already active");
        }
        super(orientation, panel_height, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        // Settings
        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.settings.bind("ignoreTransientNotifications", "ignoreTransientNotifications");
        this.settings.bind("showEmptyTray", "showEmptyTray", this._show_hide_tray);
        this.settings.bind("showDisturbIcon", "showDisturbIcon", this._show_disturb_icon);
        this.settings.bind("keyOpen", "keyOpen", this._setKeybinding);
        this.settings.bind("keyClear", "keyClear", this._setKeybinding);
        this.settings.bind("keyMute", "keyMute", this._setKeybinding);
        this.settings.bind("showNotificationCount", "showNotificationCount", this.update_list);
        this.settings.bind("showNotificationSettings", "showNotificationSettings", this._show_settings_action);
        this.settings.bind("showNewestFirst", "showNewestFirst", this.update_list);
        this._setKeybinding();

        this.notif_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.notifications" });
        this._iconSignalId = this.notif_settings.connect('changed::display-notifications', () => {
            this.set_icon_status();
        });       

        // Layout
        this._orientation = orientation;
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Lists
        this.notifications = [];    // The list of notifications, in order from oldest to newest.

        // Events
        this.signals = new SignalManager.SignalManager(null);
        this.signals.connect(Main.messageTray, 'notify-applet-update', this._notification_added.bind(this));
        this.signals.connect(global.settings, 'changed::' + PANEL_EDIT_MODE_KEY, this._on_panel_edit_mode_changed.bind(this));

        // States
        this._blinking = false;
        this._blink_toggle = false;
        this._normal_blinking = false;
        this._normal_blink_toggle = false;

        this._display();
    }

    _setKeybinding() {
        Main.keybindingManager.addHotKey("notification-open-" + this.instance_id, this.keyOpen, this._openMenu.bind(this));
        Main.keybindingManager.addHotKey("notification-clear-" + this.instance_id, this.keyClear, this._clear_all.bind(this));
        Main.keybindingManager.addHotKey("notification-mute-" + this.instance_id, this.keyMute, this.mute_notifications.bind(this));
    }

    on_applet_removed_from_panel () {
        this._is_destroyed = true;

        // Cleanly disconnect Gio.Settings signals
        if (this._iconSignalId) {
            this.notif_settings.disconnect(this._iconSignalId);
        }

        if (this._switchSignalId) {
            this.notif_settings.disconnect(this._switchSignalId);
        }

        Main.keybindingManager.removeHotKey("notification-open-" + this.instance_id);
        Main.keybindingManager.removeHotKey("notification-clear-" + this.instance_id);
        Main.keybindingManager.removeHotKey("notification-mute-" + this.instance_id);

        if (this._blinkTimeout) {
            Mainloop.source_remove(this._blinkTimeout);
            this._blinkTimeout = null;
        }
        if (this._normalBlinkTimeout) {
            Mainloop.source_remove(this._normalBlinkTimeout);
            this._normalBlinkTimeout = null;
        }

        // Only used in cinnamon 6.6 and later
        if (MessageTray.extensionsHandlingNotifications !== undefined) {
            MessageTray.extensionsHandlingNotifications--;
        }

        this.signals.disconnectAllSignals();
        this.settings.finalize();

        let icons = [this._crit_icon, this._alt_crit_icon, this._new_icon, this._alt_new_icon];
        for (let icon of icons) {
            if (icon) {
                try {
                    icon.destroy();
                } catch (e) {}
            }
        }
    }

    _openMenu() {
        this._update_timestamp();
        this.menu.toggle();
    }

    _display() {
        // Always start the applet empty, void of any notifications.
        this.set_applet_icon_symbolic_name("empty-notification");

        // Setup the notification container.
        this._maincontainer = new St.BoxLayout({name: 'traycontainer', vertical: true});
        this._notificationbin = new St.BoxLayout({vertical:true});

        // Setup the tray icon.
        this.menu_label = new PopupMenu.PopupMenuItem(stringify(this.notifications.length));
        this.menu_label.label.add_style_class_name('popup-notif-label');
        this.menu_label.actor.reactive = false;
        this.menu_label.actor.can_focus = false;

        this.notDisturb_label = new PopupMenu.PopupIconMenuItem(_("Do not disturb"), "notification-off", St.IconType.SYMBOLIC);
        this.notDisturb_label.label.add_style_class_name('popup-tray-label');
        this.notDisturb_label.actor.add_style_class_name('popup-tray-icon');
        this.notDisturb_label.actor.reactive = false;
        this.notDisturb_label.actor.can_focus = false;

        this.noNotif_label = new PopupMenu.PopupIconMenuItem(_("No notifications"), "empty-notification", St.IconType.SYMBOLIC);
        this.noNotif_label.label.add_style_class_name('popup-tray-label');
        this.noNotif_label.actor.add_style_class_name('popup-tray-icon');
        this.noNotif_label.actor.reactive = false;
        this.noNotif_label.actor.can_focus = false;

        this.clear_separator = new PopupMenu.PopupSeparatorMenuItem();

        this.clear_action = new PopupMenu.PopupMenuItem(_("Clear notifications"));
        this.clear_action.connect('activate', this._clear_all.bind(this));
        this.clear_action.actor.hide();

        this.menu.addMenuItem(this.clear_action);
        this.menu.addMenuItem(this.clear_separator);
        this.menu.addMenuItem(this.notDisturb_label);
        this.menu.addMenuItem(this.noNotif_label);
        this.menu.addMenuItem(this.menu_label);
        this.menu.addActor(this._maincontainer);

        this.bottom_separator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this.bottom_separator);

        // Setup the notification switch
        this.notificationsSwitch = new PopupMenu.PopupSwitchMenuItem(_("Enable notifications"), this._toggleNotifications);
        this._switchSignalId = this.notif_settings.connect('changed::display-notifications', () => {
            this.notificationsSwitch.setToggleState(this.notif_settings.get_boolean("display-notifications"));
        });
        this.notificationsSwitch.connect('toggled', () => {
        this.notif_settings.set_boolean("display-notifications", this.notificationsSwitch.state);
        });
        this.notificationsSwitch.setToggleState(this.notif_settings.get_boolean("display-notifications"));
        this.menu.addMenuItem(this.notificationsSwitch);

        // Notification Settings menu item
        this.item_action = new PopupMenu.PopupMenuItem(_("Notification Settings"));
        this.item_action.connect('activate', () => {
            Util.spawnCommandLine("cinnamon-settings notifications");
        });
        this.menu.addMenuItem(this.item_action);
        this._show_settings_action();

        // Notification scroll
        this.scrollview = new St.ScrollView({ x_fill: true, y_fill: true, y_align: St.Align.START, style_class: "vfade"});
        this._maincontainer.add(this.scrollview);
        this.scrollview.add_actor(this._notificationbin);
        this.scrollview.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.scrollview.set_clip_to_allocation(true);

        let vscroll = this.scrollview.get_vscroll_bar();
        vscroll.connect('scroll-start', () => {
            this.menu.passEvents = true;
        });
        vscroll.connect('scroll-stop', () => {
            this.menu.passEvents = false;
        });

        // Alternative tray icons.
        this._crit_icon = new St.Icon({icon_name: 'critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        this._alt_crit_icon = new St.Icon({icon_name: 'alt-critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        this._new_icon = new St.Icon({icon_name: 'new-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        this._alt_new_icon = new St.Icon({icon_name: 'alt-new-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });

        this._on_panel_edit_mode_changed();

    }

    _arrangeDisplay() {
        // Remove menu actors so we can put them back in a different order
        this.menu.box.remove_all_children();

        if (this._orientation == St.Side.BOTTOM) {
            this.menu.addActor(this.menu_label.actor);
            this.menu.addActor(this.notDisturb_label.actor);
            this.menu.addActor(this.noNotif_label.actor);
            this.menu.addActor(this._maincontainer);
            this.menu.addActor(this.clear_separator.actor);
            this.menu.addActor(this.clear_action.actor);
        } else {
            this.menu.addActor(this.clear_action.actor);
            this.menu.addActor(this.clear_separator.actor);
            this.menu.addActor(this.notDisturb_label.actor);
            this.menu.addActor(this.noNotif_label.actor);
            this.menu.addActor(this.menu_label.actor);
            this.menu.addActor(this._maincontainer);
        }

        this.menu.addActor(this.bottom_separator.actor);
        
        this.menu.addActor(this.notificationsSwitch.actor);
        this.menu.addActor(this.item_action.actor);

        this._show_settings_action();
        
        this.update_list();
    }

    _notification_added (mtray, notification) { // Notification event handler.
        // Ignore transient notifications?
        if (this.ignoreTransientNotifications && notification.isTransient) {
            notification.destroy();
            return;
        }

        notification.actor.unparent();
        let existing_index = this.notifications.indexOf(notification);
        if (existing_index != -1) { // This notification is already listed.
            if (notification._destroyed) {
                this.notifications.splice(existing_index, 1);
            } else {
                notification._inNotificationBin = true;
                global.reparentActor(notification.actor, this._notificationbin);
                notification._timeLabel.show();
            }
            this.update_list();
            return;
        } else if (notification._destroyed) {
            return;
        }
        // Add notification to list.
        notification._inNotificationBin = true;
        this.notifications.push(notification);

        // Steal the notification panel.
        this._notificationbin.add(notification.actor);
        notification.actor._parent_container = this._notificationbin;
        notification.actor.add_style_class_name('notification-applet-padding');
        // Cache each notification subtree in an offscreen texture.  While the
        // menu is open St repaints every notification (including its themed
        // shadow) on every stage frame: with 8 notifications on a 3000x2000
        // screen one frame took ~365ms (2.5 fps - video visibly stutters and
        // the whole desktop lags).  With offscreen redirect the painted
        // subtree is reused between frames (~2ms/frame measured); the cache is
        // invalidated automatically when the content changes (timestamps etc).
        notification.actor.set_offscreen_redirect(imports.gi.Clutter.OffscreenRedirect.ALWAYS);
        // Give each notification its own theme node: St caches the
        // CPU-prerendered (cairo) background per theme node PER SIZE, and all
        // stolen notification actors share one node.  Notifications of
        // slightly different heights therefore evict each other's cached
        // background, and every menu open re-rasterizes every background via
        // cairo (~40ms each, ~400ms per open measured with 8 notifications).
        // A unique (unstyled) class per actor makes the node - and its paint
        // cache - private: repeated menu opens drop to ~6ms.
        this._cacheSlotSeq = (this._cacheSlotSeq || 0) + 1;
        notification.actor.add_style_class_name('notification-cache-slot-' + this._cacheSlotSeq);

        // Enable middle-click to close notifications.
        notification.actor.connect('button-press-event', (actor, event) => {
            if (event.get_button && event.get_button() === 2) {
                notification.destroy(NotificationDestroyedReason.DISMISSED);
            }
        });
        // Register for destruction.
        notification.connect('scrolling-changed', (notif, scrolling) => { this.menu.passEvents = scrolling });
        notification.connect('destroy', () => {
            let i = this.notifications.indexOf(notification);
            if (i != -1)
                this.notifications.splice(i, 1);
            this.update_list();
        });
        notification._timeLabel.show();

        this.update_list();
    }

    update_list () { // Update interface
        if (this._is_destroyed) return;

        try {
            let count = this.notifications.length;
            if (count > 0) {    // There are notifications.
                this.actor.show();
                this.clear_action.actor.show();
                this.menu_label.actor.show();
                this.notDisturb_label.actor.hide();
                this.noNotif_label.actor.hide();
                this.set_applet_tooltip(ngettext("%d notification", "%d notifications", count).format(count));
                this.set_applet_label(count.toString());
                this._reorderNotifications();
                // Find max urgency and derive list icon.
                let max_urgency = -1;
                for (let i = 0; i < count; i++) {
                    let cur_urgency = this.notifications[i].urgency;
                    if (cur_urgency > max_urgency)
                        max_urgency = cur_urgency;
                }
                switch (max_urgency) {
                    case Urgency.LOW:
                        this._blinking = false;
                        this._normal_blinking = false;
                        this.set_applet_icon_symbolic_name("low-notif");
                        break;
                    case Urgency.NORMAL:
                    case Urgency.HIGH:
                        this._blinking = false;
                        if (!this._normal_blinking) {
                            this._normal_blinking = true;
                            this.normal_blink();
                        }
                        break;
                    case Urgency.CRITICAL:
                        this._normal_blinking = false;
                        if (!this._blinking) {
                            this._blinking = true;
                            this.critical_blink();
                        }
                        break;
                }
            } else {    // There are no notifications.
               this._blinking = false;
               this._normal_blinking = false;
               this.set_applet_label('');
               this.set_applet_icon_symbolic_name("empty-notification");
               this.set_applet_tooltip(_("Notifications"));
               this.noNotif_label.actor.show();
               this.notDisturb_label.actor.hide();
               this.menu_label.actor.hide();
               this.clear_action.actor.hide();
               if (!this.showEmptyTray) {
                   this.actor.hide();
               }
            }

            // Show "Do not disturb" icon and label
            if (!this.notif_settings.get_boolean("display-notifications")) {
               this.set_applet_icon_symbolic_name("notification-off");
               this.set_applet_tooltip(_("Notifications disabled"));
               this.notDisturb_label.actor.show();
               this.noNotif_label.actor.hide();
               this.menu_label.actor.hide();
               if (this.showEmptyTray || this.showDisturbIcon) {
                   this.actor.show();
               } else {
                   this.actor.hide();
               }
            } else {
                if (count > 0) {
                    this.actor.show();
                } else if (this.showEmptyTray) {
                    this.actor.show();
                } else {
                    this.actor.hide();
                }
            }
                                                                  
            if (!this.showNotificationCount) {  // Don't show notification count
                this.set_applet_label('');
            }
            this.menu_label.label.set_text(stringify(count));
            this._notificationbin.queue_relayout();

            // Pre-render the menu off-screen after list changes, so the first
            // click doesn't pay the one-time cairo rasterization of the new
            // notification (and of the resized menu background).
            this._scheduleMenuWarmup();

        } catch (e) {
            global.logError(e);
        }
     }

    // St rasterizes CSS backgrounds on the CPU during the first paint of a
    // theme node at a given size.  A freshly added notification (new theme
    // node) and the menu background (its height changed with the list) make
    // the first open after a list change take hundreds of ms.  Painting the
    // menu once while it is practically invisible (opacity 1/255) fills all
    // those caches outside the click path; opacity 0 would be skipped by
    // Clutter entirely, hence 1.
    _scheduleMenuWarmup() {
        if (this._warmupTimeoutId) {
            Mainloop.source_remove(this._warmupTimeoutId);
            this._warmupTimeoutId = 0;
        }
        this._warmupTimeoutId = Mainloop.timeout_add(1500, () => {
            this._warmupTimeoutId = 0;
            if (this._is_destroyed || this.menu.isOpen || this.menu.actor.visible)
                return false;
            let actor = this.menu.actor;
            let oldOpacity = actor.opacity;
            actor.opacity = 1;
            actor.reactive = false;
            actor.show();
            Mainloop.timeout_add(100, () => {
                if (!this.menu.isOpen)
                    actor.hide();
                actor.opacity = oldOpacity;
                actor.reactive = true;
                return false;
            });
            return false;
        });
    }

     _clear_all() {
        let count = this.notifications.length;
        if (count > 0) {
            for (let i = count-1; i >=0; i--) {
                this._notificationbin.remove_actor(this.notifications[i].actor);
                this.notifications[i].destroy(NotificationDestroyedReason.DISMISSED);
            }
        }
        this.notifications = [];
        this.update_list();
    }

    _reorderNotifications() {
        let orderedNotifications = this.notifications.slice();

        if (this.showNewestFirst) {
            orderedNotifications.reverse();
        }

        // Remove all children without destroying them.
        let children = this._notificationbin.get_children();
        for (let i = 0; i < children.length; i++) {
            this._notificationbin.remove_child(children[i]);
        }

        // Add them back in desired order.
        for (let i = 0; i < orderedNotifications.length; i++) {
            this._notificationbin.add_child(orderedNotifications[i].actor);
        }
    }

    _show_settings_action() {  // Show or hide notification settings menu item
        if (this.showNotificationSettings) {
            this.item_action.actor.show();
        } else {
            this.item_action.actor.hide();
        }
    }

    _show_hide_tray() {
        this.update_list();
    }

    _show_disturb_icon() {
        this.update_list();
    }

    _on_panel_edit_mode_changed () {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this.actor.show();
        } else {
            this.update_list();
        }
    }

    on_applet_added_to_panel() {
        this.on_orientation_changed(this._orientation);


        // Only used in cinnamon 6.6 and later
        if (MessageTray.extensionsHandlingNotifications !== undefined) {
            MessageTray.extensionsHandlingNotifications++;
        }
    }

    on_orientation_changed (orientation) {
        this._orientation = orientation;

        this._arrangeDisplay();
    }

    on_applet_clicked(event) {
        this._openMenu();
    }

    _toggleNotifications() {
        let current_state = this.notif_settings.get_boolean("display-notifications");
        this.notif_settings.set_boolean("display-notifications", !current_state);
    }

    mute_notifications() {
        this._toggleNotifications();
    }

    set_icon_status() {  // Updates the icon state based on notification settings
        this.update_list();
    }

    on_btn_open_system_settings_clicked() {
        Util.spawnCommandLine("cinnamon-settings notifications");
    }

    _update_timestamp() {
        let len = this.notifications.length;
        if (len > 0) {
            for (let i = 0; i < len; i++) {
                let notification = this.notifications[i];
                let orig_time = notification._timestamp;
                notification._timeLabel.clutter_text.set_markup(timeify(orig_time));
            }
        }
    }

    critical_blink() {
        if (this._is_destroyed) return;

        if (!this._blinking) {
            if (this._blinkTimeout) {
                Mainloop.source_remove(this._blinkTimeout);
                this._blinkTimeout = null;
            }
            return;
        }
        
        if (this._blink_toggle) {
            this._applet_icon_box.child = this._crit_icon;
        } else {
            this._applet_icon_box.child = this._alt_crit_icon;
        }
        this._blink_toggle = !this._blink_toggle;        
        this._blinkTimeout = Mainloop.timeout_add_seconds(1, () => this.critical_blink());
    }

    normal_blink() {
        if (this._is_destroyed) return;

        if (!this._normal_blinking) {
            if (this._normalBlinkTimeout) {
                Mainloop.source_remove(this._normalBlinkTimeout);
                this._normalBlinkTimeout = null;
            }
            return;
        }

        if (this._normal_blink_toggle) {
            this._applet_icon_box.child = this._new_icon;
        } else {
            this._applet_icon_box.child = this._alt_new_icon;
        }
        this._normal_blink_toggle = !this._normal_blink_toggle;

        this._normalBlinkTimeout = Mainloop.timeout_add_seconds(1, () => this.normal_blink());
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonNotificationsApplet(metadata, orientation, panel_height, instanceId);
}

function stringify(count) {
    return ngettext("%d notification", "%d notifications", count).format(count);
}

function timeify(orig_time) {
    let settings = new Gio.Settings({schema_id: 'org.cinnamon.desktop.interface'});
    let use_24h = settings.get_boolean('clock-use-24h');
    let now = new Date();
    let diff = Math.floor((now.getTime() - orig_time.getTime()) / 1000); // get diff in seconds
    let str;
    if (use_24h) {
        str = orig_time.toLocaleFormat('%x, %T');
    } else {
        str = orig_time.toLocaleFormat('%x, %r');
    }
    switch (true) {
        case (diff <= 15): {
            str += " (" + _("just now") + ")";
            break;
        } case (diff > 15 && diff <= 59): {
            str += " (" + ngettext("%d second ago", "%d seconds ago", diff).format(diff) + ")";
            break;
        } case (diff > 59 && diff <= 3540): {
            let diff_minutes = Math.floor(diff / 60);
            str += " (" + ngettext("%d minute ago", "%d minutes ago", diff_minutes).format(diff_minutes) + ")";
            break;
        }
    }
    return str;
}
