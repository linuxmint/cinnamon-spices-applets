const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
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

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

const UUID = "notifications-enhanced@hilyxx";
const HISTORY_DIR = GLib.get_home_dir() + "/.notifications-enhanced-applet/history";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

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
        this._appletPath = metadata.path;

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
        this.settings.bind("historyEnabled", "historyEnabled");
        this.settings.bind("historyRetentionDays", "historyRetentionDays");
        this.settings.bind("historyPageSize", "historyPageSize");
        this._setKeybinding();

        this._history = new HistoryManager();
        this._history.purgeOlderThan(this.historyRetentionDays);

        this.notif_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.notifications" });
        this.notif_settings.connect('changed::display-notifications', Lang.bind(this, function() {
        this.set_icon_status(this.notif_settings.get_boolean("display-notifications"));
        }));        

        // Layout
        this._orientation = orientation;
        this.menuManager = new PopupMenu.PopupMenuManager(this);

        // Lists
        this.notifications = [];    // The list of notifications, in order from oldest to newest.

        // Events
        Main.messageTray.connect('notify-applet-update', Lang.bind(this, this._notification_added));
        global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._on_panel_edit_mode_changed));

        // Intercept _onNotify to capture notifications to history immediately,
        // before the banner is shown (notify-applet-update only fires after it closes).
        this._origOnNotify = Main.messageTray._onNotify;
        Main.messageTray._onNotify = Lang.bind(this, function(source, notification) {
            // Record to history immediately
            if (this.historyEnabled && !notification._historyRecorded) {
                notification._historyRecorded = true;
                this._history.append(notification);
            }
            this._origOnNotify.call(Main.messageTray, source, notification);
        });

        // States
        this._blinking = false;
        this._blink_toggle = false;
    }

    _setKeybinding() {
        Main.keybindingManager.addHotKey("notification-open-" + this.instance_id, this.keyOpen, Lang.bind(this, this._openMenu));
        Main.keybindingManager.addHotKey("notification-clear-" + this.instance_id, this.keyClear, Lang.bind(this, this._clear_all));
        Main.keybindingManager.addHotKey("notification-mute-" + this.instance_id, this.keyMute, Lang.bind(this, this.mute_notifications));
    }

    on_applet_removed_from_panel () {
        Main.keybindingManager.removeHotKey("notification-open-" + this.instance_id);
        Main.keybindingManager.removeHotKey("notification-clear-" + this.instance_id);
        Main.keybindingManager.removeHotKey("notification-mute-" + this.instance_id);

        // Restore the original _onNotify
        if (this._origOnNotify) {
            Main.messageTray._onNotify = this._origOnNotify;
        }

        // Only used in cinnamon 6.6 and later
        if (MessageTray.extensionsHandlingNotifications !== undefined) {
            MessageTray.extensionsHandlingNotifications--;
        }
    }

    _openMenu() {
        this._update_timestamp();
        this.menu.toggle();
    }

    _display() {
        this.menu.box.set_style('max-width: 600px;');

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
        this.clear_action.connect('activate', Lang.bind(this, this._clear_all));
        this.clear_action.actor.hide();

        if (this._orientation == St.Side.BOTTOM) {
            this.menu.addMenuItem(this.menu_label);
            this.menu.addMenuItem(this.notDisturb_label);
            this.menu.addMenuItem(this.noNotif_label);
            this.menu.addActor(this._maincontainer);
            this.menu.addMenuItem(this.clear_separator);
            this.menu.addMenuItem(this.clear_action);
        } else {
            this.menu.addMenuItem(this.clear_action);
            this.menu.addMenuItem(this.clear_separator);
            this.menu.addMenuItem(this.notDisturb_label);
            this.menu.addMenuItem(this.noNotif_label);
            this.menu.addMenuItem(this.menu_label);
            this.menu.addActor(this._maincontainer);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Setup the notification switch
        this.notificationsSwitch = new PopupMenu.PopupSwitchMenuItem(_("Enable notifications"), this._toggleNotifications);
        this.notif_settings.connect('changed::display-notifications', Lang.bind(this, function() {
        this.notificationsSwitch.setToggleState(this.notif_settings.get_boolean("display-notifications"));
        }));
        this.notificationsSwitch.connect('toggled', Lang.bind(this, function() {
        this.notif_settings.set_boolean("display-notifications", this.notificationsSwitch.state);
        }));
        this.notificationsSwitch.setToggleState(this.notif_settings.get_boolean("display-notifications"));
        this.menu.addMenuItem(this.notificationsSwitch);

        // Notification Settings menu item
        this.item_action = new PopupMenu.PopupMenuItem(_("Notification Settings"));
        this.item_action.connect('activate', Lang.bind(this, function() {
            Util.spawnCommandLine("cinnamon-settings notifications");
        }));
        this.menu.addMenuItem(this.item_action);
        this._show_settings_action();

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Setup the notification history
        this._historyHeaderItem = new PopupMenu.PopupSubMenuMenuItem(_("Notification history"));
        this.menu.addMenuItem(this._historyHeaderItem);

        this._historyBin = new St.BoxLayout({ vertical: true });
        this._historyHeaderItem.menu.addActor(this._historyBin);

        this._seeAllBtn = new St.Button({ label: _("See all notifications"), style_class: 'notification-history-seeall' });
        this._seeAllBtn.connect('clicked', Lang.bind(this, this._open_history_viewer));
        this._historyHeaderItem.menu.addActor(this._seeAllBtn);

        this._historyHeaderItem.menu.connect('open-state-changed', Lang.bind(this, function(menu, open) {
            if (open) {
                this._render_history();
            }
        }));

        // this._render_history();

        // Notification scroll
        this.scrollview = new St.ScrollView({ x_fill: true, y_fill: true, y_align: St.Align.START, style_class: "vfade"});
        this._maincontainer.add(this.scrollview);
        this.scrollview.add_actor(this._notificationbin);
        this.scrollview.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.scrollview.set_clip_to_allocation(true);

        let vscroll = this.scrollview.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));

        // Alternative tray icons.
        this._crit_icon = new St.Icon({icon_name: 'critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        this._alt_crit_icon = new St.Icon({icon_name: 'alt-critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });

        this._on_panel_edit_mode_changed();

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
                        this.set_applet_icon_symbolic_name("low-notif");
                        break;
                    case Urgency.NORMAL:
                    case Urgency.HIGH:
                        this._blinking = false;
                        this.set_applet_icon_symbolic_name("new-notif");
                        break;
                    case Urgency.CRITICAL:
                        if (!this._blinking) {
                            this._blinking = true;
                            this.critical_blink();
                        }
                        break;
                }
            } else {    // There are no notifications.
               this._blinking = false;
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

        } catch (e) {
            global.logError(e);
        }
     }

    _open_history_viewer() {
        Util.spawnCommandLine(
            "python3 '" + this._appletPath + "/history-viewer.py' " + this.historyPageSize + " '" + HISTORY_DIR + "'"
        );
    }

    _show_full_notification(item) {
        try {
            let lines = [];

            if (item.title) {
                lines.push(item.title);
            }
            if (item.app) {
                lines.push(_("From") + ": " + item.app);
            }

            lines.push(timeify(new Date(item.ts)));
            lines.push("");

            if (item.body) {
                lines.push(item.body);
            }

            let tmpPath = GLib.get_tmp_dir() + "/notification-detail.txt";
            let tmpFile = Gio.File.new_for_path(tmpPath);
            let stream = tmpFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
            let dataStream = new Gio.DataOutputStream({ base_stream: stream });
            dataStream.put_string(lines.join("\n"), null);
            dataStream.close(null);

            Util.spawnCommandLine(
                "zenity --text-info --title='Notification' --filename='" + tmpPath + "' --width=500 --height=300"
            );
        } catch (e) {
            global.logError("_show_full_notification: " + e);
        }
    }

    _render_history() {
        if (!this._historyBin) return;

        this._historyBin.destroy_all_children();

        if (!this.historyEnabled) {
            let disabledLabel = new St.Label({
                text: _("History is disabled"),
                style_class: 'notification-history-empty'
            });
            this._historyBin.add(disabledLabel);
            this._seeAllBtn.hide();
            return;
        }

        let { items } = this._history.loadPage(0, 5);

        this._seeAllBtn.visible = items.length > 0;

        if (items.length === 0) {
            let emptyLabel = new St.Label({
                text: _("No notification history"),
                style_class: 'notification-history-empty'
            });
            this._historyBin.add(emptyLabel);
        } else {
            for (let item of items) {
                let row = new St.BoxLayout({ vertical: true, style_class: 'notification-history-item' });

                // Title + app row
                let headerBox = new St.BoxLayout();
                let titleLabel = new St.Label({
                    text: item.title || _("(no title)"),
                    style_class: 'notification-history-title'
                });
                let appLabel = new St.Label({
                    text: item.app ? " — " + item.app : "",
                    style_class: 'notification-history-app'
                });
                headerBox.add(titleLabel);
                headerBox.add(appLabel);
                row.add(headerBox);

                // Truncate long text and offer "read more"
                if (item.body) {
                    const TRUNCATE_AT = 150;
                    const body = item.body.trim();
                    const truncated = body.length > TRUNCATE_AT;
                    let bodyLabel = new St.Label({
                        text: truncated ? body.slice(0, TRUNCATE_AT).trimEnd() + "… " : body,
                        style_class: 'notification-history-body'
                    });
                    bodyLabel.clutter_text.line_wrap = true;
                    if (truncated) {
                        let readMore = new St.Button({
                            label: _("read more"),
                            style_class: 'notification-history-readmore'
                        });
                        readMore.connect('clicked', () => this._show_full_notification(item));
                        let bodyBox = new St.BoxLayout();
                        bodyBox.add(bodyLabel);
                        bodyBox.add(readMore);
                        row.add(bodyBox);
                    } else {
                        row.add(bodyLabel);
                    }
                }

                // Timestamp
                let timeLabel = new St.Label({
                    text: timeify(new Date(item.ts)),
                    style_class: 'notification-history-time'
                });
                row.add(timeLabel);

                this._historyBin.add(row);

                // Separator between entries
                let sep = new St.BoxLayout({ style_class: 'notification-history-separator' });
                this._historyBin.add(sep);
            }
        }
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

        if (this.menu) {
            this.menu.destroy();
        }
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._display();
    }

    on_applet_clicked(event) {
        this._openMenu();
    }

    _toggleNotifications() {
        let current_state = this.notif_settings.get_boolean("display-notifications");
        this.notif_settings.set_boolean("display-notifications", !current_state);
    }

    mute_notifications() {
        this.notificationsSwitch.toggle();
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

    critical_blink () {
        if (!this._blinking)
            return;
        if (this._blink_toggle) {
            this._applet_icon_box.child = this._crit_icon;
        } else {
            this._applet_icon_box.child = this._alt_crit_icon;
        }
        this._blink_toggle = !this._blink_toggle;
        Mainloop.timeout_add_seconds(1, Lang.bind(this, this.critical_blink));
    }
}

class HistoryManager {
    constructor() {
        this._ensureDir();
    }

    _ensureDir() {
        let dir = Gio.File.new_for_path(HISTORY_DIR);

        if (!dir.query_exists(null)) {
            dir.make_directory_with_parents(null);
        }
    }

    _dateKey(date) {
        let y = date.getFullYear();
        let m = String(date.getMonth() + 1).padStart(2, '0');
        let d = String(date.getDate()).padStart(2, '0');

        return `${y}-${m}-${d}`;
    }

    _filePath(dateKey) {
        return HISTORY_DIR + "/" + dateKey + ".jsonl";
    }

    append(notification) {
        try {
            let now = new Date();

            let record = JSON.stringify({
                ts: now.getTime(),
                title: (notification.title || "").trim(),
                body: ((notification._bodyUrlHighlighter && notification._bodyUrlHighlighter.actor
                        ? notification._bodyUrlHighlighter.actor.clutter_text.text
                        : "") || "").trim(),
                app: (notification.source && notification.source.title) ? notification.source.title : "",
                urgency: notification.urgency != null ? notification.urgency : 1
            });

            let path = this._filePath(this._dateKey(now));
            let file = Gio.File.new_for_path(path);
            let baseStream = file.append_to(Gio.FileCreateFlags.NONE, null);
            let dataStream = new Gio.DataOutputStream({ base_stream: baseStream });

            dataStream.put_string(record + "\n", null);
            dataStream.close(null);
        } catch (e) {
            global.logError("HistoryManager.append: " + e);
        }
    }

    _dateKeys() {
        let keys = [];

        try {
            let dir = Gio.File.new_for_path(HISTORY_DIR);
            let enumerator = dir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
            let info;

            while ((info = enumerator.next_file(null)) !== null) {
                let name = info.get_name();

                if (name.endsWith(".jsonl")) {
                    keys.push(name.slice(0, -6)); // strip ".jsonl"
                }
            }

            enumerator.close(null);
        } catch (e) {
            global.logError("HistoryManager._dateKeys: " + e);
        }

        return keys.sort().reverse(); // newest first
    }

    _readAllLines() {
        let allLines = [];

        for (let key of this._dateKeys()) {
            try {
                let file = Gio.File.new_for_path(this._filePath(key));

                if (!file.query_exists(null)) {
                    continue;
                }

                let [, contents] = file.load_contents(null);
                let text = imports.byteArray ? imports.byteArray.toString(contents) : contents.toString();

                allLines = allLines.concat(text.split("\n").filter(l => l.trim() !== "").reverse());
            } catch (e) {
                global.logError("HistoryManager._readAllLines read " + key + ": " + e);
            }
        }

        return allLines;
    }

    // Returns {items: [...], totalPages: N} for the given 0-based page index and page size.
    loadPage(page, pageSize) {
        let allLines = this._readAllLines();
        let totalPages = Math.max(1, Math.ceil(allLines.length / pageSize));
        let pageLines = allLines.slice(page * pageSize, (page + 1) * pageSize);

        let items = pageLines.flatMap(line => {
            try {
                return [JSON.parse(line)];
            } catch (_) {
                return [];
            }
        });

        return { items, totalPages };
    }

    purgeOlderThan(days) {
        try {
            let cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);

            let cutoffKey = this._dateKey(cutoff);
            let keys = this._dateKeys();

            for (let key of keys) {
                if (key < cutoffKey) {
                    let file = Gio.File.new_for_path(this._filePath(key));

                    file.delete(null);
                }
            }
        } catch (e) {
            global.logError("HistoryManager.purgeOlderThan: " + e);
        }
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
