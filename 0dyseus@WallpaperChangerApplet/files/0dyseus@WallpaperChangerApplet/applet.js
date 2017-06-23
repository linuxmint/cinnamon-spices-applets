const $ = imports.applet.__init__;
const Settings = $.Settings;
const _ = $._;
const Daemon = new $.WallChangerDaemon();

const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

function MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    this._init(aMetadata, aOrientation, aPanel_height, aInstance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    appletActivationAllowed: true,
    _init: function(aMetadata, aOrientation, aPanel_height, aInstance_id) {
        Applet.TextIconApplet.prototype._init.call(this, aOrientation, aPanel_height, aInstance_id);

        if ($.versionCompare($.CINNAMON_VERSION, "3.0") < 0) {
            this.appletActivationAllowed = false;
            $.informAndDisable(aInstance_id);
            return;
        }

        $.debug("Initializing applet version: %s".format(aMetadata.version));

        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (Applet.hasOwnProperty("AllowedLayout"))
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            this.orientation = aOrientation;
            this.metadata = aMetadata;
            this.instance_id = aInstance_id;
            this._add_context_menu_id = 0;
            this._notifications_id = 0;
            this._toggle_daemon_id = 0;
            this._custom_applet_label_id = 0;
            this._custom_applet_icon_id = 0;
            this._current_profile_id = 0;
            this._next_wallpaper_shortcut_id = 0;
            this._prev_wallpaper_shortcut_id = 0;
            this._toggle_menu_shortcut_id = 0;
            this._preview_width_id = 0;
            this._invert_menu_items_id = 0;
            this._daemon_changed_id = 0;
            this._daemon_error_id = 0;
            this._bindSettings();

            this.set_applet_tooltip(aMetadata.name);
            this._updateIconAndLabel();
            this._expandAppletContextMenu();
            this._startConnections();

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, aOrientation);
            this.menuManager.addMenu(this.menu);

            this._buildMenu();

            if (!Daemon.is_running && Settings.auto_start) {
                // Run if auto start is enabled and its not already running
                Daemon.toggle();
            }
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    _buildMenu: function() {
        this.menu.box.pack_start = Settings.invert_menu_items_order;

        if (this.wallChangerControls)
            this.wallChangerControls.destroy();

        this.menu.removeAll();

        // Stored so I can use it for the keybindings creation.
        this.wallChangerControls = new $.WallChangerControls(Daemon.bus);

        let subMenu = new PopupMenu.PopupSubMenuMenuItem(_("Extra Options"));
        subMenu.menu.connect("open-state-changed", Lang.bind(this, this._subMenuOpenStateChanged));
        subMenu.menu.addMenuItem(new $.WallChangerDaemonControl(Daemon));
        subMenu.menu.addMenuItem(new $.WallChangerSwitch(
            _("Auto Start Daemon"),
            _("When enabled, the daemon will be automatically started when the applet is loaded. If it is already running or this is disabled, no action will be taken."),
            "auto-start"
        ));
        subMenu.menu.addMenuItem(new $.WallChangerSwitch(
            _("Change with Profile"),
            _("When enabled, this will cause the daemon to automatically change the wallpaper whenever the current profile is changed."),
            "auto-rotate"
        ));
        subMenu.menu.addMenuItem(new $.WallChangerSwitch(
            _("Notifications"),
            _("Display a notification each time an event happens with wallpaper changer. This does not stop the applet from reporting errors."),
            "notifications"
        ));
        subMenu.menu.addMenuItem(new $.WallChangerSwitch(
            _("Remember Profile State"),
            _("When enabled, the daemon will remember its current and next wallpaper for the current profile when the profile is changed. This means returning back to the profile will restore the previous background plus the next in queue."),
            "remember-profile-state"
        ));

        // Start insertions
        this.menu.addMenuItem(new $.WallChangerPreviewMenuItem(Daemon));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new $.WallChangerOpenCurrent());
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.wallChangerControls);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(subMenu);
        this.menu.addMenuItem(new $.WallChangerProfile());

        this._updateKeybindings();
    },

    _subMenuOpenStateChanged: function(aMenu, aOpen) {
        if (aOpen) {
            let children = aMenu._getTopMenu()._getMenuItems();
            let i = 0,
                iLen = children.length;
            for (; i < iLen; i++) {
                let item = children[i];

                if (item instanceof PopupMenu.PopupSubMenuMenuItem ||
                    item instanceof $.WallChangerProfile) {
                    if (aMenu !== item.menu) {
                        item.menu.close(true);
                    }
                }
            }
        }
    },

    _updateKeybindings: function() {
        Main.keybindingManager.removeHotKey("odyseus-wallpaper-changer-next-wallpaper-shortcut");
        Main.keybindingManager.removeHotKey("odyseus-wallpaper-changer-prev-wallpaper-shortcut");
        Main.keybindingManager.removeHotKey("odyseus-wallpaper-changer-toggle-menu-shortcut");

        if (Boolean(Settings.next_wallpaper_shortcut) && this.wallChangerControls) {
            Main.keybindingManager.addHotKey(
                "odyseus-wallpaper-changer-next-wallpaper-shortcut",
                Settings.next_wallpaper_shortcut + "::",
                Lang.bind(this.wallChangerControls, this.wallChangerControls.next)
            );
        }

        if (Boolean(Settings.prev_wallpaper_shortcut) && this.wallChangerControls) {
            Main.keybindingManager.addHotKey(
                "odyseus-wallpaper-changer-prev-wallpaper-shortcut",
                Settings.prev_wallpaper_shortcut + "::",
                Lang.bind(this.wallChangerControls, this.wallChangerControls.prev)
            );
        }

        if (Boolean(Settings.toggle_menu_shortcut) && this.wallChangerControls) {
            Main.keybindingManager.addHotKey(
                "odyseus-wallpaper-changer-toggle-menu-shortcut",
                Settings.toggle_menu_shortcut + "::",
                Lang.bind(this, this._toggleMenu)
            );
        }
    },

    _startConnections: function() {
        this._daemon_changed_id = Daemon.connectSignal("changed",
            Lang.bind(this, function(emitter, signalName, parameters) {
                if (Settings.notifications) {
                    Main.notify(_(this.metadata.name), _("Wallpaper Changed") + ": " + parameters[0]);
                }
            }));

        this._daemon_error_id = Daemon.connectSignal("error",
            Lang.bind(this, function(emitter, signalName, parameters) {
                Main.notifyError(_(this.metadata.name), _("Daemon Error") + ": " + parameters[0]);
            }));
    },

    _bindSettings: function() {
        this._notifications_id = Settings.connect(
            "changed::notifications",
            Lang.bind(this, function() {
                // TO TRANSLATORS: Full sentence:
                // "Notifications are now enabled/disabled"
                Main.notify(_(this.metadata.name), _("Notifications are now %s")
                    // TO TRANSLATORS: Full sentence:
                    // "Notifications are now enabled/disabled"
                    .format((Settings.notifications) ? _("enabled") : _("disabled")));
            })
        );

        // "Dummy" preference. So I can toggle the daemon from Python code.
        this._toggle_daemon_id = Settings.connect(
            "changed::toggle-daemon",
            Lang.bind(this, function() {
                Daemon.toggle();
            })
        );

        this._custom_applet_label_id = Settings.connect("changed::custom-applet-label",
            Lang.bind(this, function() {
                this._updateIconAndLabel();
            }));

        this._custom_applet_icon_id = Settings.connect("changed::custom-applet-icon",
            Lang.bind(this, function() {
                this._updateIconAndLabel();
            }));

        this._current_profile_id = Settings.connect("changed::current-profile",
            Lang.bind(this, function() {
                if (Settings.notifications) {
                    Main.notify(_(this.metadata.name), _("Profile changed to %s")
                        .format(Settings.current_profile));
                }
            }));

        this._next_wallpaper_shortcut_id = Settings.connect("changed::next-wallpaper-shortcut",
            Lang.bind(this, this._updateKeybindings));

        this._prev_wallpaper_shortcut_id = Settings.connect("changed::prev-wallpaper-shortcut",
            Lang.bind(this, this._updateKeybindings));

        this._toggle_menu_shortcut_id = Settings.connect("changed::toggle-menu-shortcut",
            Lang.bind(this, this._updateKeybindings));

        this._preview_width_id = Settings.connect("changed::wallpaper-preview-width",
            Lang.bind(this, this._buildMenu));

        this._invert_menu_items_id = Settings.connect("changed::invert-menu-items-order",
            Lang.bind(this, this._buildMenu));
    },

    _expandAppletContextMenu: function() {
        if (this._add_context_menu_id > 0)
            Mainloop.source_remove(this._add_context_menu_id);

        this._add_context_menu_id = Mainloop.timeout_add(
            5000,
            Lang.bind(this, function() {
                if (!this.context_menu_item_configure) {
                    let items = this._applet_context_menu._getMenuItems();

                    this.context_menu_item_configure = new PopupMenu.PopupIconMenuItem(
                        _("Configure..."),
                        "system-run",
                        St.IconType.SYMBOLIC
                    );

                    this.context_menu_item_configure.connect("activate",
                        Lang.bind(this, function() {
                            Util.spawn_async([this.metadata.path + "/settings.py"], null);
                        }));

                    this._applet_context_menu.addMenuItem(this.context_menu_item_configure,
                        items.indexOf(this.context_menu_item_remove));
                }
            })
        );
    },

    _updateIconAndLabel: function() {
        try {
            if (Settings.custom_applet_icon === "") {
                this.set_applet_icon_name("");
            } else if (GLib.path_is_absolute(Settings.custom_applet_icon) &&
                GLib.file_test(Settings.custom_applet_icon, GLib.FileTest.EXISTS)) {
                if (Settings.custom_applet_icon.search("-symbolic") != -1)
                    this.set_applet_icon_symbolic_path(Settings.custom_applet_icon);
                else
                    this.set_applet_icon_path(Settings.custom_applet_icon);
            } else if (Gtk.IconTheme.get_default().has_icon(Settings.custom_applet_icon)) {
                if (Settings.custom_applet_icon.search("-symbolic") != -1)
                    this.set_applet_icon_symbolic_name(Settings.custom_applet_icon);
                else
                    this.set_applet_icon_name(Settings.custom_applet_icon);
                /**
                 * START mark Odyseus
                 * I added the last condition without checking Gtk.IconTheme.get_default.
                 * Otherwise, if there is a valid icon name added by
                 *  Gtk.IconTheme.get_default().append_search_path, it will not be recognized.
                 * With the following extra condition, the worst that can happen is that
                 *  the applet icon will not change/be set.
                 */
            } else {
                try {
                    if (Settings.custom_applet_icon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_name(Settings.custom_applet_icon);
                    else
                        this.set_applet_icon_name(Settings.custom_applet_icon);
                } catch (aErr) {
                    global.logError(aErr);
                }
            }
        } catch (aErr) {
            global.logWarning("Could not load icon file \"" + Settings.custom_applet_icon + "\" for menu button");
        }

        if (Settings.custom_applet_icon === "") {
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) { // no menu label if in a vertical panel
            this.set_applet_label("");
        } else {
            if (Settings.custom_applet_label !== "")
                this.set_applet_label(_(Settings.custom_applet_label));
            else
                this.set_applet_label("");
        }

        this.updateLabelVisibility();
    },

    updateLabelVisibility: function() {
        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (typeof this.hide_applet_label !== "function")
            return;

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
            this.hide_applet_label(true);
        } else {
            if (Settings.custom_applet_label === "") {
                this.hide_applet_label(true);
            } else {
                this.hide_applet_label(false);
            }
        }
    },

    on_applet_removed_from_panel: function() {
        // No need to clean up if the applet activation wasn't allowed.
        if (!this.appletActivationAllowed)
            return;

        $.debug("Disabling applet");

        if (this._add_context_menu_id > 0)
            Mainloop.source_remove(this._add_context_menu_id);

        if (this._notifications_id > 0)
            Settings.schema.disconnect(this._notifications_id);

        if (this._toggle_daemon_id > 0)
            Settings.schema.disconnect(this._toggle_daemon_id);

        if (this._custom_applet_label_id > 0)
            Settings.schema.disconnect(this._custom_applet_label_id);

        if (this._custom_applet_icon_id > 0)
            Settings.schema.disconnect(this._custom_applet_icon_id);

        if (this._current_profile_id > 0)
            Settings.schema.disconnect(this._current_profile_id);

        if (this._next_wallpaper_shortcut_id > 0)
            Settings.schema.disconnect(this._next_wallpaper_shortcut_id);

        if (this._prev_wallpaper_shortcut_id > 0)
            Settings.schema.disconnect(this._prev_wallpaper_shortcut_id);

        if (this._toggle_menu_shortcut_id > 0)
            Settings.schema.disconnect(this._toggle_menu_shortcut_id);

        if (this._preview_width_id > 0)
            Settings.schema.disconnect(this._preview_width_id);

        if (this._invert_menu_items_id > 0)
            Settings.schema.disconnect(this._invert_menu_items_id);

        if (this._daemon_changed_id > 0)
            Daemon.disconnectSignal(this._daemon_changed_id);

        if (this._daemon_error_id > 0)
            Daemon.disconnectSignal(this._daemon_error_id);

        this._add_context_menu_id = 0;
        this._notifications_id = 0;
        this._toggle_daemon_id = 0;
        this._custom_applet_label_id = 0;
        this._custom_applet_icon_id = 0;
        this._current_profile_id = 0;
        this._next_wallpaper_shortcut_id = 0;
        this._prev_wallpaper_shortcut_id = 0;
        this._toggle_menu_shortcut_id = 0;
        this._preview_width_id = 0;
        this._invert_menu_items_id = 0;
        this._daemon_changed_id = 0;
        this._daemon_error_id = 0;

        if (Daemon.is_running) {
            $.debug("Appplet disabled, stopping daemon");
            Daemon.stop();
        }

        Main.keybindingManager.removeHotKey("odyseus-wallpaper-changer-next-wallpaper-shortcut");
        Main.keybindingManager.removeHotKey("odyseus-wallpaper-changer-prev-wallpaper-shortcut");
        Main.keybindingManager.removeHotKey("odyseus-wallpaper-changer-toggle-menu-shortcut");
    },

    _toggleMenu: function() {
        this.menu.toggle();
    },

    on_applet_clicked: function() {
        this._toggleMenu();
    }
};

function main(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    return new MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id);
}
