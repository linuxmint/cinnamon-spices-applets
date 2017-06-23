const $ = imports.applet.__init__;
const _ = $._;
const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const CMenu = imports.gi.CMenu;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const Util = imports.misc.util;
const Tweener = imports.ui.tweener;
const Meta = imports.gi.Meta;
const DocInfo = imports.misc.docInfo;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const SearchProviderManager = imports.ui.searchProviderManager;
const DND = imports.ui.dnd;

const INITIAL_BUTTON_LOAD = 30;
const PRIVACY_SCHEMA = "org.cinnamon.desktop.privacy";
const REMEMBER_RECENT_KEY = "remember-recent-files";

let appsys = Cinnamon.AppSystem.get_default();

function MyApplet() {
    this._init.apply(this, arguments);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(aMetadata, aOrientation, aPanel_height, aInstance_id) {
        Applet.TextIconApplet.prototype._init.call(this, aOrientation, aPanel_height, aInstance_id);
        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (Applet.hasOwnProperty("AllowedLayout"))
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.applet_dir = aMetadata.path;

        try {
            this.settings = new Settings.AppletSettings(this, aMetadata.uuid, aInstance_id);
            this._bindSettings();

            this.initial_load_done = false;

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, aOrientation);
            this.menuManager.addMenu(this.menu);
            this.orientation = aOrientation;

            this.actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));

            this._appletEnterEventId = 0;
            this._appletLeaveEventId = 0;
            this._appletHoverDelayId = 0;

            /**
             * START mark Odyseus
             * Be careful not to call the _() function before this point!!!
             */
            this.metadata = aMetadata;
            this.instance_id = aInstance_id;

            // From Sane Menu
            Gtk.IconTheme.get_default().append_search_path(this.applet_dir + "/icons/");
            this._applicationsButtonsBackup = [];
            this._applicationsOrder = {};
            //
            this._menuLayout = [];
            this._updateMenuLayout();
            this._expand_applet_context_menu();
            this._hardRefreshTimeout = null;
            this._refreshCustomCommandsTimeout = null;

            // Commented out due to Mainloop.idle_add_full disappointment.
            // Revisit in the future.
            // $.portOverrides();

            this._recentAppsButtons = [];
            this._recentAppsApps = [];
            this._runFromTerminalScript = this.applet_dir + "/run_from_terminal.sh";
            // this._terminalReady is defined to decide if the the context menus that
            // uses the needed file should be shown or not.
            this._terminalReady = GLib.file_test(this._runFromTerminalScript, GLib.FileTest.EXISTS);

            // NOTE: This string could be left blank because it's a default string,
            // so it's already translated by Cinnamon. It's up to the translators.
            this.set_applet_tooltip(_("Menu"));

            if (this._terminalReady &&
                !GLib.file_test(this._runFromTerminalScript, GLib.FileTest.IS_EXECUTABLE))
                Util.spawnCommandLine("chmod +x \"" + this._runFromTerminalScript + "\"");

            if (this.pref_system_buttons_display !== 0) {
                this._session = new GnomeSession.SessionManager();
                this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
            }
            /**
             * END
             */

            // Condition needed for retro-compatibility.
            // Mark for deletion on EOL.
            if (typeof this.menu.setCustomStyleClass === "function")
                this.menu.setCustomStyleClass("menu-background");
            else
                this.menu.actor.add_style_class_name("menu-background");

            this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
            Main.themeManager.connect("theme-set", Lang.bind(this, this._updateIconAndLabel));

            this._searchIconClickedId = 0;
            this._applicationsButtons = [];
            this._applicationsButtonFromApp = {};
            this._favoritesButtons = [];
            this._placesButtons = [];
            this._transientButtons = [];
            this._recentButtons = [];
            this._categoryButtons = [];
            this._searchProviderButtons = [];
            this._selectedItemIndex = null;
            this._previousSelectedActor = null;
            this._previousVisibleIndex = null;
            this._previousTreeSelectedActor = null;
            this._activeContainer = null;
            this._activeActor = null;
            this._applicationsBoxWidth = 0;
            this.menuIsOpening = false;
            // Used to keep track of apps that are already installed, so we can highlight newly installed ones
            this._knownApps = [];
            this._appsWereRefreshed = false;
            this.RecentManager = new DocInfo.DocManager();
            this.privacy_settings = new Gio.Settings({
                schema_id: PRIVACY_SCHEMA
            });
            this.noRecentDocuments = true;
            this._activeContextMenuParent = null;
            this._activeContextMenuItem = null;
            this._display();
            appsys.connect('installed-changed', Lang.bind(this, this.onAppSysChanged));
            AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._refreshFavs));
            this._update_hover_delay();
            Main.placesManager.connect('places-updated', Lang.bind(this, this._refreshBelowApps));
            this.RecentManager.connect('changed', Lang.bind(this, this._refreshRecent));
            this.privacy_settings.connect("changed::" + REMEMBER_RECENT_KEY, Lang.bind(this, this._refreshRecent));
            this._fileFolderAccessActive = false;
            this._pathCompleter = new Gio.FilenameCompleter();
            this._pathCompleter.set_dirs_only(false);
            this.lastAcResults = [];
            // used as a flag to know if we're currently refreshing
            // (so we don't do it more than once concurrently)
            this.refreshing = false;
            this.lastSelectedCategory = null;

            /**
             * Mark Odyseus. Moved these calls here because they were called too earlier.
             */
            this._updateGlobalPreferences();
            this._updateActivateOnHover();
            this._updateKeybinding();
            this._updateIconAndLabel();

            // We shouldn't need to call _refreshAll() here... since we get an
            // "icon-theme-changed" signal when CSD starts.
            // The reason we do is in case the Cinnamon icon theme is the same
            // as the one specificed in GTK itself (in .config).
            // In that particular case we get no signal at all.
            this._refreshAll();

            St.TextureCache.get_default().connect("icon-theme-changed",
                Lang.bind(this, this.onIconThemeChanged));
            this._recalc_height();

            this.updateLabelVisibility();

            // Temporary fix.
            Mainloop.timeout_add_seconds(5, Lang.bind(this, function() {
                if (this.context_menu_item_remove)
                    this.context_menu_item_remove.label.set_text(_("Remove '%s'").format(_(this._meta.name)));
            }));
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    _updateGlobalPreferences: function() {
        // Added the pref_show_uninstall_on_context check here so it doesn't have to check
        // file existence when disabled.
        this._canUninstallApps = this.pref_show_uninstall_on_context &&
            GLib.file_test("/usr/bin/cinnamon-remove-application", GLib.FileTest.EXISTS);

        // Added the pref_show_bumblebee_on_context check here so it doesn't have to check
        // file existence when disabled.
        this._isBumblebeeInstalled = this.pref_show_bumblebee_on_context &&
            GLib.file_test("/usr/bin/optirun", GLib.FileTest.EXISTS);

        this._useHoverFeedback = this.pref_use_hover_feedback &&
            this.pref_user_picture_placement !== 0 &&
            this.pref_appinfo_display_method === "infobox";

        this.max_width_for_buttons = "max-width: " + this.pref_max_width_for_buttons + "em;";
    },

    /**
     * START mark Odyseus
     */
    _bindSettings: function() {
        // Needed for retro-compatibility.
        // Mark for deletion on EOL.
        let bD = {
            IN: 1,
            OUT: 2,
            BIDIRECTIONAL: 3
        };
        let settingsArray = [
            [bD.BIDIRECTIONAL, "pref_hide_allapps_category", null],
            [bD.BIDIRECTIONAL, "pref_display_favorites_as_category_menu", null],
            [bD.BIDIRECTIONAL, "pref_recently_used_apps", null],
            [bD.IN, "pref_use_alternate_vector_box", null],
            [bD.IN, "pref_max_width_for_buttons", this._updateGlobalPreferences],
            [bD.IN, "pref_terminal_emulator", null],
            [bD.IN, "pref_show_icons_on_context", null],
            [bD.IN, "pref_show_add_to_panel_on_context", null],
            [bD.IN, "pref_show_add_to_desktop_on_context", null],
            [bD.IN, "pref_show_add_remove_favorite_on_context", null],
            [bD.IN, "pref_show_uninstall_on_context", this._updateGlobalPreferences],
            [bD.IN, "pref_show_bumblebee_on_context", this._updateGlobalPreferences],
            [bD.IN, "pref_gain_privileges_on_context", null],
            [bD.IN, "pref_privilege_elevator", null],
            [bD.IN, "pref_custom_editor_for_edit_desktop_file_on_context", null],
            [bD.IN, "pref_show_run_from_terminal_on_context", null],
            [bD.IN, "pref_show_run_from_terminal_as_root_on_context", null],
            [bD.IN, "pref_show_desktop_file_folder_on_context", null],
            [bD.IN, "pref_show_edit_desktop_file_on_context", null],
            [bD.IN, "pref_show_run_as_root_on_context", null],
            [bD.IN, "pref_animate_menu", null],
            [bD.IN, "pref_recently_used_apps_custom_icon", null],
            [bD.IN, "pref_cat_select_on_hover", this._update_hover_delay],
            [bD.IN, "pref_cat_hover_delay", this._update_hover_delay],
            [bD.IN, "pref_remember_recently_used_apps", null],
            [bD.IN, "pref_recent_apps_ignore_favorites", null],
            [bD.IN, "pref_recently_used_apps_invert_order", null],
            [bD.IN, "pref_recently_used_apps_separator", null],
            [bD.IN, "pref_max_recently_used_apps", null],
            [bD.IN, "pref_apps_info_box_alignment_to_the_left", null],
            [bD.IN, "pref_user_picture_placement", this._updateGlobalPreferences],
            [bD.IN, "pref_use_hover_feedback", this._updateGlobalPreferences],
            [bD.IN, "pref_user_picture_size", null],
            [bD.IN, "pref_user_picture_stylized", null],
            [bD.IN, "pref_info_box_title_font_size", null],
            [bD.IN, "pref_info_box_description_font_size", null],
            [bD.IN, "pref_swap_categories_box", null],
            [bD.IN, "pref_disable_new_apps_highlighting", null],
            [bD.IN, "pref_fuzzy_search_enabled", null],
            [bD.IN, "pref_show_recents_button", null],
            [bD.IN, "pref_system_buttons_display", null],
            [bD.IN, "pref_show_lock_button", null],
            [bD.IN, "pref_show_logout_button", null],
            [bD.IN, "pref_show_shutdown_button", null],
            [bD.IN, "pref_lock_button_custom_icon", null],
            [bD.IN, "pref_logout_button_custom_icon", null],
            [bD.IN, "pref_shutdown_button_custom_icon", null],
            [bD.IN, "pref_separator_heigth", null],
            [bD.IN, "pref_custom_width_for_searchbox", null],
            [bD.IN, "pref_appinfo_display_method", null],
            [bD.IN, "pref_max_fav_icon_size", null],
            [bD.IN, "pref_category_icon_size", null],
            [bD.IN, "pref_application_icon_size", null],
            [bD.IN, "pref_max_recent_files", null],
            [bD.IN, "pref_custom_commands_box_placement", null],
            [bD.IN, "pref_menu_layout_first_place", null],
            [bD.IN, "pref_menu_layout_second_place", null],
            [bD.IN, "pref_menu_layout_third_place", null],
            [bD.IN, "pref_menu_layout_fourth_place", null],
            [bD.IN, "pref_autofit_searchbox_width", null],
            [bD.IN, "pref_custom_command_box_padding_top", null],
            [bD.IN, "pref_custom_command_box_padding_right", null],
            [bD.IN, "pref_custom_command_box_padding_bottom", null],
            [bD.IN, "pref_custom_command_box_padding_left", null],
            [bD.IN, "pref_custom_commands_box_alignment", null],
            [bD.IN, "pref_custom_command_icon_size", null],
            [bD.IN, "pref_categories_box_padding_top", null],
            [bD.IN, "pref_categories_box_padding_right", null],
            [bD.IN, "pref_categories_box_padding_bottom", null],
            [bD.IN, "pref_categories_box_padding_left", null],
            [bD.IN, "pref_hide_applications_list_scrollbar", null],
            [bD.IN, "pref_search_entry_padding_top", null],
            [bD.IN, "pref_search_entry_padding_right", null],
            [bD.IN, "pref_search_entry_padding_bottom", null],
            [bD.IN, "pref_search_entry_padding_left", null],
            [bD.IN, "pref_info_box_padding_right", null],
            [bD.IN, "pref_info_box_padding_left", null],
            [bD.IN, "pref_set_info_box_padding", null],
            [bD.IN, "pref_set_search_entry_padding", null],
            [bD.IN, "pref_set_custom_box_padding", null],
            [bD.IN, "pref_set_categories_padding", null],
            [bD.IN, "pref_search_box_padding_top", null],
            [bD.IN, "pref_search_box_padding_right", null],
            [bD.IN, "pref_search_box_padding_bottom", null],
            [bD.IN, "pref_search_box_padding_left", null],
            [bD.IN, "pref_set_search_box_padding", null],
            [bD.IN, "pref_command_1_label", null],
            [bD.IN, "pref_command_1_command", null],
            [bD.IN, "pref_command_1_icon", null],
            [bD.IN, "pref_command_1_description", null],
            [bD.IN, "pref_command_2_label", null],
            [bD.IN, "pref_command_2_command", null],
            [bD.IN, "pref_command_2_icon", null],
            [bD.IN, "pref_command_2_description", null],
            [bD.IN, "pref_command_3_label", null],
            [bD.IN, "pref_command_3_command", null],
            [bD.IN, "pref_command_3_icon", null],
            [bD.IN, "pref_command_3_description", null],
            [bD.IN, "pref_command_4_label", null],
            [bD.IN, "pref_command_4_command", null],
            [bD.IN, "pref_command_4_icon", null],
            [bD.IN, "pref_command_4_description", null],
            [bD.IN, "pref_command_5_label", null],
            [bD.IN, "pref_command_5_command", null],
            [bD.IN, "pref_command_5_icon", null],
            [bD.IN, "pref_command_5_description", null],
            [bD.IN, "pref_command_6_label", null],
            [bD.IN, "pref_command_6_command", null],
            [bD.IN, "pref_command_6_icon", null],
            [bD.IN, "pref_command_6_description", null],
            [bD.IN, "pref_command_7_label", null],
            [bD.IN, "pref_command_7_command", null],
            [bD.IN, "pref_command_7_icon", null],
            [bD.IN, "pref_command_7_description", null],
            [bD.IN, "pref_command_8_label", null],
            [bD.IN, "pref_command_8_command", null],
            [bD.IN, "pref_command_8_icon", null],
            [bD.IN, "pref_command_8_description", null],
            [bD.IN, "pref_command_9_label", null],
            [bD.IN, "pref_command_9_command", null],
            [bD.IN, "pref_command_9_icon", null],
            [bD.IN, "pref_command_9_description", null],
            [bD.IN, "pref_command_10_label", null],
            [bD.IN, "pref_command_10_command", null],
            [bD.IN, "pref_command_10_icon", null],
            [bD.IN, "pref_command_10_description", null],
            /**
             * START Original preferences renamed and moved here
             */
            [bD.IN, "pref_enable_autoscroll", this._update_autoscroll],
            [bD.IN, "pref_search_filesystem", null],
            [bD.IN, "pref_show_places", this._refreshBelowApps],
            [bD.IN, "pref_display_category_icons", this._refreshAll],
            [bD.IN, "pref_display_application_icons", this._refreshAll],
            [bD.IN, "pref_display_fav_box", this._favboxtoggle],
            [bD.IN, "pref_overlay_key", this._updateKeybinding],
            [bD.IN, "pref_custom_label_for_applet", this._updateIconAndLabel],
            [bD.IN, "pref_custom_icon_for_applet", this._updateIconAndLabel],
            [bD.IN, "pref_use_a_custom_icon_for_applet", this._updateIconAndLabel],
            [bD.IN, "pref_open_menu_on_hover", this._updateActivateOnHover],
            [bD.IN, "pref_menu_hover_delay", this._updateActivateOnHover],
            /**
             * END
             */
        ];
        let newBinding = typeof this.settings.bind === "function";
        for (let [binding, property_name, callback] of settingsArray) {
            // Condition needed for retro-compatibility.
            // Mark for deletion on EOL.
            if (newBinding)
                this.settings.bind(property_name, property_name, callback);
            else
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }

        if (!this.pref_hide_allapps_category)
            this.pref_display_favorites_as_category_menu = false;
    },
    /**
     * END
     */

    _updateKeybinding: function() {
        Main.keybindingManager.removeHotKey("odyseus-custom-cinnamon-menu-" + this.instance_id);

        Main.keybindingManager.addHotKey("odyseus-custom-cinnamon-menu-" + this.instance_id, this.pref_overlay_key, Lang.bind(this, function() {
            if (!Main.overview.visible && !Main.expo.visible)
                this.menu.toggle_with_options(this.pref_animate_menu);
        }));
    },

    onIconThemeChanged: function() {
        if (!this.refreshing) {
            this.refreshing = true;
            Mainloop.timeout_add_seconds(1, Lang.bind(this, this._refreshAll));
        }
    },

    onAppSysChanged: function() {
        if (!this.refreshing) {
            this.refreshing = true;
            Mainloop.timeout_add_seconds(1, Lang.bind(this, this._refreshAll));
        }
    },

    _refreshAll: function() {
        /**
         * START mark Odyseus
         */
        if (!this.pref_remember_recently_used_apps) {
            this.pref_recently_used_apps = []; // Clear list when disabling
        }
        /**
         * END
         */

        try {
            this._refreshApps();
            this._refreshFavs();
            this._refreshPlaces();
            this._refreshRecent();
            this._refreshRecentApps();
        } catch (exception) {
            global.log(exception);
        }
        this.refreshing = false;
    },

    _refreshBelowApps: function() {
        this._refreshPlaces();
        this._refreshRecent();
    },

    openMenu: function() {
        if (!this._applet_context_menu.isOpen) {
            this.menu.open(this.pref_animate_menu);
        }
    },

    _clearDelayCallbacks: function() {
        if (this._appletHoverDelayId > 0) {
            Mainloop.source_remove(this._appletHoverDelayId);
            this._appletHoverDelayId = 0;
        }

        if (this._appletLeaveEventId > 0) {
            this.actor.disconnect(this._appletLeaveEventId);
            this._appletLeaveEventId = 0;
        }
        return false;
    },

    _updateActivateOnHover: function() {
        if (this._appletEnterEventId > 0) {
            this.actor.disconnect(this._appletEnterEventId);
            this._appletEnterEventId = 0;
        }
        this._clearDelayCallbacks();
        if (this.pref_open_menu_on_hover) {
            this._appletEnterEventId = this.actor.connect('enter-event', Lang.bind(this, function() {
                if (this.pref_menu_hover_delay > 0) {
                    this._appletLeaveEventId = this.actor.connect('leave-event', Lang.bind(this, this._clearDelayCallbacks));
                    this._appletHoverDelayId = Mainloop.timeout_add(this.pref_menu_hover_delay,
                        Lang.bind(this, function() {
                            this.openMenu();
                            this._clearDelayCallbacks();
                        }));
                } else {
                    this.openMenu();
                }
            }));
        }
    },

    _update_hover_delay: function() {
        this.cat_hover_delay = this.pref_cat_hover_delay / 1000;
    },

    _recalc_height: function() {
        let scrollBoxHeight = (this.leftBox.get_allocation_box().y2 -
            this.leftBox.get_allocation_box().y1);
        /**
         * START mark Odyseus
         */
        if (this._menuLayout.indexOf("searchBox") !== -1 && this.searchBox) {
            scrollBoxHeight = scrollBoxHeight - (this.searchBox.get_allocation_box().y2 -
                this.searchBox.get_allocation_box().y1);
        }

        if (this._menuLayout.indexOf("myCustomLaunchersBox") !== -1 && this.myCustomLaunchersBox) {
            scrollBoxHeight = scrollBoxHeight - (this.myCustomLaunchersBox.get_allocation_box().y2 -
                this.myCustomLaunchersBox.get_allocation_box().y1);
        }

        if (this._menuLayout.indexOf("selectedAppBox") !== -1 && this.selectedAppBoxContainer) {
            scrollBoxHeight = scrollBoxHeight - (this.selectedAppBoxContainer.get_allocation_box().y2 -
                this.selectedAppBoxContainer.get_allocation_box().y1);
        }
        /**
         * END
         */
        this.applicationsScrollBox.style = "height: " + scrollBoxHeight / global.ui_scale + "px;";
    },

    updateLabelVisibility: function() {
        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (typeof this.hide_applet_label !== "function")
            return;

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
            this.hide_applet_label(true);
        } else {
            if (this.pref_custom_label_for_applet === "") {
                this.hide_applet_label(true);
            } else {
                this.hide_applet_label(false);
            }
        }
    },

    /**
     * START mark Odyseus
     */
    _hardRefreshAll: function() {
        this._updateMenuLayout();

        if (!this.pref_hide_allapps_category)
            this.pref_display_favorites_as_category_menu = false;

        if (this._hardRefreshTimeout) {
            Mainloop.source_remove(this._hardRefreshTimeout);
            this._hardRefreshTimeout = null;
        }

        this._hardRefreshTimeout = Mainloop.timeout_add(500, Lang.bind(this, function() {
            this.initial_load_done = true;
            this.on_orientation_changed(this.orientation);
        }));
    },
    /**
     * END
     */

    on_orientation_changed: function(orientation) {
        this.orientation = orientation;
        this.updateLabelVisibility();
        this.menu.destroy();
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (typeof this.menu.setCustomStyleClass === "function")
            this.menu.setCustomStyleClass("menu-background");
        else
            this.menu.actor.add_style_class_name("menu-background");

        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
        this._display();

        if (this.initial_load_done) {
            this._refreshAll();
            this.initial_load_done = false;
        }

        this._updateIconAndLabel();

        // Temporary fix.
        Mainloop.timeout_add_seconds(5, Lang.bind(this, function() {
            if (this.context_menu_item_remove)
                this.context_menu_item_remove.label.set_text(_("Remove '%s'").format(_(this._meta.name)));
        }));
    },

    on_applet_added_to_panel: function() {
        this.initial_load_done = true;
    },

    _launch_editor: function() {
        Util.spawnCommandLine("cinnamon-menu-editor");
    },

    on_applet_clicked: function(event) { // jshint ignore:line
        this.menu.toggle_with_options(this.pref_animate_menu);
    },

    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle_with_options(this.pref_animate_menu);
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close(this.pref_animate_menu);
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle_with_options(this.pref_animate_menu);

            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    },

    _onOpenStateChanged: function(menu, open) {
        if (open) {
            // Condition needed for retro-compatibility.
            // Mark for deletion on EOL.
            if (this._appletEnterEventId > 0 && typeof this.actor.handler_block === "function")
                this.actor.handler_block(this._appletEnterEventId);

            this.menuIsOpening = true;
            this.actor.add_style_pseudo_class('active');
            global.stage.set_key_focus(this.searchEntry);
            this._selectedItemIndex = null;
            this._activeContainer = null;
            this._activeActor = null;
            this.lastSelectedCategory = null;

            let n = Math.min(this._applicationsButtons.length,
                INITIAL_BUTTON_LOAD);
            let i = 0;
            for (; i < n; i++) {
                this._applicationsButtons[i].actor.show();
            }
            /**
             * START mark Odyseus
             */
            if (this.pref_hide_allapps_category)
                this._clearPrevCatSelection(this._allAppsCategoryButton.actor);

            this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";

            if (this.pref_hide_allapps_category) {
                this._select_category(this.pref_hide_allapps_category ?
                    this._initialSelectedCategory :
                    null);
            } else {
                Mainloop.idle_add(Lang.bind(this, this._initial_cat_selection, n));
            }
            /**
             * END
             */
        } else {
            // Condition needed for retro-compatibility.
            // Mark for deletion on EOL.
            if (this._appletEnterEventId > 0 && typeof this.actor.handler_unblock === "function")
                this.actor.handler_unblock(this._appletEnterEventId);

            this.actor.remove_style_pseudo_class('active');

            if (this.searchActive) {
                this.resetSearch();
            }

            if (this._useHoverFeedback) {
                this.userPicture.refreshFace();
            }

            this.setSelectedItemTitleAndDescription(null, "", "");
            this._previousTreeSelectedActor = null;
            this._previousSelectedActor = null;
            this.closeContextMenus(null, false);

            this._clearAllSelections(true);
            this.destroyVectorBox();
        }
    },

    _initial_cat_selection: function(start_index) {
        let n = this._applicationsButtons.length;
        let i = start_index;
        for (; i < n; i++) {
            this._applicationsButtons[i].actor.show();
        }
    },

    destroy: function() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    },

    _set_default_menu_icon: function() {
        let path = global.datadir + "/theme/menu.svg";
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            this.set_applet_icon_path(path);
            return;
        }

        path = global.datadir + "/theme/menu-symbolic.svg";
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            this.set_applet_icon_symbolic_path(path);
            return;
        }
        /* If all else fails, this will yield no icon */
        this.set_applet_icon_path("");
    },

    _favboxtoggle: function() {
        if (!this.pref_display_fav_box) {
            this.leftPane.hide();
            this.leftPane.remove_actor(this.leftBox);
        } else {
            this.leftPane.show();
            this.leftPane.add_actor(this.leftBox);
        }
    },

    _updateIconAndLabel: function() {
        try {
            if (this.pref_use_a_custom_icon_for_applet) {
                if (this.pref_custom_icon_for_applet === "") {
                    this.set_applet_icon_name("");
                } else if (GLib.path_is_absolute(this.pref_custom_icon_for_applet) &&
                    GLib.file_test(this.pref_custom_icon_for_applet, GLib.FileTest.EXISTS)) {
                    if (this.pref_custom_icon_for_applet.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_path(this.pref_custom_icon_for_applet);
                    else
                        this.set_applet_icon_path(this.pref_custom_icon_for_applet);
                } else if (Gtk.IconTheme.get_default().has_icon(this.pref_custom_icon_for_applet)) {
                    if (this.pref_custom_icon_for_applet.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_name(this.pref_custom_icon_for_applet);
                    else
                        this.set_applet_icon_name(this.pref_custom_icon_for_applet);
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
                        if (this.pref_custom_icon_for_applet.search("-symbolic") != -1)
                            this.set_applet_icon_symbolic_name(this.pref_custom_icon_for_applet);
                        else
                            this.set_applet_icon_name(this.pref_custom_icon_for_applet);
                    } catch (aErr) {
                        global.logError(aErr);
                    }
                }
            } else {
                this._set_default_menu_icon();
            }
        } catch (aErr) {
            global.logWarning("Could not load icon file \"" + this.pref_custom_icon_for_applet + "\" for menu button");
        }

        if (this.pref_use_a_custom_icon_for_applet && this.pref_custom_icon_for_applet === "") {
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) { // no menu label if in a vertical panel
            this.set_applet_label("");
        } else {
            if (this.pref_custom_label_for_applet !== "")
                this.set_applet_label(_(this.pref_custom_label_for_applet));
            else
                this.set_applet_label("");
        }

        this.updateLabelVisibility();
    },

    _navigateContextMenu: function(actor, symbol, altKey) {
        if (symbol === Clutter.KEY_Menu || symbol === Clutter.Escape ||
            (altKey && (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter))) {
            actor.activateContextMenus();
            return;
        }

        let goUp = symbol === Clutter.KEY_Up;
        let nextActive = null;
        let menuItems = actor.menu._getMenuItems(); // The context menu items

        // The first context menu item of a $.RecentButton is used just as a label.
        // So remove it from the iteration.
        if (actor instanceof $.RecentButton)
            menuItems.shift();

        let menuItemsLength = menuItems.length;

        switch (symbol) {
            case Clutter.KEY_Page_Up:
                this._activeContextMenuItem = menuItems[0];
                this._activeContextMenuItem.setActive(true);
                return;
            case Clutter.KEY_Page_Down:
                this._activeContextMenuItem = menuItems[menuItemsLength - 1];
                this._activeContextMenuItem.setActive(true);
                return;
        }

        if (!this._activeContextMenuItem) {
            this._activeContextMenuItem = menuItems[goUp ? menuItemsLength - 1 : 0];
            this._activeContextMenuItem.setActive(true);
            return;
        } else if (this._activeContextMenuItem &&
            (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter)) {
            this._activeContextMenuItem.activate();
            this._activeContextMenuItem = null;
            return;
        }

        let i = 0;
        for (; i < menuItemsLength; i++) {
            if (menuItems[i] === this._activeContextMenuItem) {
                nextActive = goUp ? (menuItems[i - 1] || null) : (menuItems[i + 1] || null);
                break;
            }
        }

        if (!nextActive)
            nextActive = goUp ? menuItems[menuItemsLength - 1] : menuItems[0];

        nextActive.setActive(true);
        this._activeContextMenuItem = nextActive;
    },

    _onMenuKeyPress: function(actor, event) {
        if (this.pref_use_alternate_vector_box)
            this.destroyVectorBox();

        if (this._useHoverFeedback)
            this.userPicture.refreshFace();

        let symbol = event.get_key_symbol();

        /**
         * START mark Odyseus
         */
        // From Sane Menu
        if (this.pref_fuzzy_search_enabled)
            this._applicationsButtons = Object.create(this._applicationsButtonsBackup);
        /**
         * END
         */
        let item_actor;
        let index = 0;
        this.appBoxIter.reloadVisible();
        this.catBoxIter.reloadVisible();

        if (this.pref_display_fav_box)
            this.favBoxIter.reloadVisible();

        if (this.myCustomLaunchersBox)
            this.myCustomLaunchersBoxIter.reloadVisible();

        let keyCode = event.get_key_code();
        let modifierState = Cinnamon.get_event_state(event);

        /* check for a keybinding and quit early, otherwise we get a double hit
           of the keybinding callback */
        let action = global.display.get_keybinding_action(keyCode, modifierState);

        if (action == Meta.KeyBindingAction.CUSTOM) {
            return true;
        }

        index = this._selectedItemIndex;

        let ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK;
        let altKey = modifierState & Clutter.ModifierType.MOD1_MASK;

        if (this._activeContextMenuParent && this._activeContextMenuParent._contextIsOpen &&
            this._activeContainer === this.applicationsBox &&
            (this._activeContextMenuParent instanceof $.ApplicationButton ||
                this._activeContextMenuParent instanceof $.RecentButton)) {
            let continueNavigation = false;
            switch (symbol) {
                case Clutter.KEY_Up:
                case Clutter.KEY_Down:
                case Clutter.KEY_Return:
                case Clutter.KP_Enter:
                case Clutter.KEY_Menu:
                case Clutter.KEY_Page_Up:
                case Clutter.KEY_Page_Down:
                case Clutter.Escape:
                    this._navigateContextMenu(this._activeContextMenuParent, symbol, altKey);
                    break;
                case Clutter.KEY_Right:
                case Clutter.KEY_Left:
                case Clutter.Tab:
                case Clutter.ISO_Left_Tab:
                    continueNavigation = true;

                    if (symbol === Clutter.Tab || symbol === Clutter.ISO_Left_Tab)
                        this.closeContextMenus(null, false);
                    break;
            }

            if (!continueNavigation)
                return true;
        }

        let navigationKey = true;
        let whichWay = "none";

        switch (symbol) {
            case Clutter.KEY_Up:
                whichWay = "up";

                if (this._activeContainer === this.favoritesBox && ctrlKey &&
                    (this.favoritesBox.get_child_at_index(index))
                    ._delegate instanceof $.FavoritesButton)
                    navigationKey = false;
                break;
            case Clutter.KEY_Down:
                whichWay = "down";

                if (this._activeContainer === this.favoritesBox && ctrlKey &&
                    (this.favoritesBox.get_child_at_index(index))
                    ._delegate instanceof $.FavoritesButton)
                    navigationKey = false;
                break;
            case Clutter.KEY_Page_Up:
                whichWay = "top";
                break;
            case Clutter.KEY_Page_Down:
                whichWay = "bottom";
                break;
            case Clutter.KEY_Right:
                if (!this.searchActive)
                    whichWay = this.pref_swap_categories_box ? "left" : "right";

                if (this._activeContainer === this.applicationsBox)
                    whichWay = this.pref_swap_categories_box ? "left" : "none";
                else if (this._activeContainer === this.categoriesBox &&
                    (((this.categoriesBox.get_child_at_index(index))
                            ._delegate instanceof $.RecentCategoryButton &&
                            this.noRecentDocuments) ||
                        ((this.categoriesBox.get_child_at_index(index))
                            ._delegate instanceof $.RecentAppsCategoryButton &&
                            this.pref_recently_used_apps.length === 0))) {
                    whichWay = "none";
                } else if (this.myCustomLaunchersBox &&
                    this._activeContainer === this.myCustomLaunchersBox) {
                    whichWay = "jump-right";
                }
                break;
            case Clutter.KEY_Left:
                if (!this.searchActive)
                    whichWay = this.pref_swap_categories_box ? "right" : "left";

                if (this._activeContainer === this.favoritesBox)
                    whichWay = (this.pref_swap_categories_box ? "right" : "none");
                else if (!this.pref_display_fav_box &&
                    (this._activeContainer === this.categoriesBox || this._activeContainer === null))
                    whichWay = this.pref_swap_categories_box ? "right" : "none";
                else if (this.myCustomLaunchersBox &&
                    this._activeContainer === this.myCustomLaunchersBox)
                    whichWay = "jump-left";
                break;
            case Clutter.Tab:
                if (!this.searchActive)
                    whichWay = this.myCustomLaunchersBox ? "jump" : "right";
                else
                    navigationKey = false;
                break;
            case Clutter.ISO_Left_Tab:
                if (!this.searchActive)
                    whichWay = this.myCustomLaunchersBox ? "jump" : "left";
                else
                    navigationKey = false;
                break;
            default:
                navigationKey = false;
        }

        if (navigationKey) {
            switch (this._activeContainer) {
                case null:
                    switch (whichWay) {
                        case "jump":
                            this._activeContainer = this.myCustomLaunchersBox;
                            item_actor = this.myCustomLaunchersBoxIter.getLastVisible();
                            break;
                        case "up":
                            this._activeContainer = this.categoriesBox;
                            item_actor = this.catBoxIter.getLastVisible();
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            break;
                        case "down":
                            this._activeContainer = this.categoriesBox;
                            item_actor = this.catBoxIter.getFirstVisible();
                            item_actor = this.catBoxIter.getNextVisible(item_actor);
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            break;
                        case "right":
                            this._activeContainer = this.applicationsBox;
                            item_actor = this.appBoxIter.getFirstVisible();
                            this._scrollToButton(item_actor._delegate);
                            break;
                        case "left":
                            if (this.pref_display_fav_box) {
                                this._activeContainer = this.favoritesBox;
                                item_actor = this.favBoxIter.getFirstVisible();
                            } else {
                                this._activeContainer = this.applicationsBox;
                                item_actor = this.appBoxIter.getFirstVisible();
                                this._scrollToButton(item_actor._delegate);
                            }
                            break;
                        case "top":
                            this._activeContainer = this.categoriesBox;
                            item_actor = this.catBoxIter.getFirstVisible();
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            break;
                        case "bottom":
                            this._activeContainer = this.categoriesBox;
                            item_actor = this.catBoxIter.getLastVisible();
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            break;
                    }
                    break;
                case this.myCustomLaunchersBox:
                    switch (whichWay) {
                        case "jump-left":
                            this._previousSelectedActor = this.myCustomLaunchersBox.get_child_at_index(index);
                            item_actor = this.myCustomLaunchersBoxIter.getPrevVisible(this._previousSelectedActor);
                            break;
                        case "jump-right":
                            this._previousSelectedActor = this.myCustomLaunchersBox.get_child_at_index(index);
                            item_actor = this.myCustomLaunchersBoxIter.getNextVisible(this._previousSelectedActor);
                            break;
                        case "jump":
                        case "up":
                        case "down":
                        case "top":
                        case "bottom":
                            item_actor = this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            break;
                    }
                    break;
                case this.categoriesBox:
                    switch (whichWay) {
                        case "jump":
                            this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                            item_actor = this.myCustomLaunchersBoxIter.getLastVisible();
                            this._previousTreeSelectedActor = item_actor;
                            break;
                        case "up":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getPrevVisible(this._activeActor);
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            break;
                        case "down":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getNextVisible(this._activeActor);
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            break;
                        case "right":
                            if (((this.categoriesBox.get_child_at_index(index))
                                    ._delegate instanceof $.RecentCategoryButton &&
                                    this.noRecentDocuments) ||
                                ((this.categoriesBox.get_child_at_index(index))
                                    ._delegate instanceof $.RecentAppsCategoryButton &&
                                    this.pref_recently_used_apps.length === 0)) {
                                if (this.pref_display_fav_box) {
                                    this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                                    item_actor = this.favBoxIter.getFirstVisible();
                                } else {
                                    item_actor = this.categoriesBox.get_child_at_index(index);
                                }
                            } else {
                                if (((this.categoriesBox.get_child_at_index(index))
                                        ._delegate instanceof $.RecentCategoryButton &&
                                        this.noRecentDocuments) ||
                                    ((this.categoriesBox.get_child_at_index(index))
                                        ._delegate instanceof $.RecentAppsCategoryButton &&
                                        this.pref_recently_used_apps.length === 0)) {
                                    item_actor = this.categoriesBox.get_child_at_index(index);
                                } else {
                                    item_actor = (this._previousVisibleIndex !== null) ?
                                        this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
                                        this.appBoxIter.getFirstVisible();
                                }
                            }
                            break;
                        case "left":
                            if (this.pref_display_fav_box) {
                                this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                                item_actor = this.favBoxIter.getFirstVisible();
                            } else {
                                item_actor = (this._previousVisibleIndex !== null) ?
                                    this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
                                    this.appBoxIter.getFirstVisible();
                            }
                            break;
                        case "top":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getFirstVisible();
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            break;
                        case "bottom":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getLastVisible();
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            break;
                    }
                    break;
                case this.applicationsBox:
                    switch (whichWay) {
                        case "jump":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = this.myCustomLaunchersBoxIter.getLastVisible();
                            this._previousTreeSelectedActor = item_actor;
                            break;
                        case "up":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = this.appBoxIter.getPrevVisible(this._previousSelectedActor);
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                        case "down":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = this.appBoxIter.getNextVisible(this._previousSelectedActor);
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                        case "right":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = (this._previousTreeSelectedActor !== null) ?
                                this._previousTreeSelectedActor :
                                this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

                            if (this.pref_display_fav_box) {
                                item_actor._delegate.emit('enter-event');
                                this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                                item_actor = this.favBoxIter.getFirstVisible();
                            }
                            break;
                        case "left":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = (this._previousTreeSelectedActor !== null) ?
                                this._previousTreeSelectedActor :
                                this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            break;
                        case "top":
                            item_actor = this.appBoxIter.getFirstVisible();
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                        case "bottom":
                            item_actor = this.appBoxIter.getLastVisible();
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                    }
                    break;
                case this.favoritesBox:
                    switch (whichWay) {
                        case "jump":
                            this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
                            item_actor = this.myCustomLaunchersBoxIter.getLastVisible();
                            this._previousTreeSelectedActor = item_actor;
                            break;
                        case "up":
                            this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
                            item_actor = this.favBoxIter.getPrevVisible(this._previousSelectedActor);
                            break;
                        case "down":
                            this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
                            item_actor = this.favBoxIter.getNextVisible(this._previousSelectedActor);
                            break;
                        case "right":
                            item_actor = (this._previousTreeSelectedActor !== null) ?
                                this._previousTreeSelectedActor :
                                this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            break;
                        case "left":
                            item_actor = (this._previousTreeSelectedActor !== null) ?
                                this._previousTreeSelectedActor :
                                this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

                            item_actor._delegate.emit('enter-event');
                            item_actor = (this._previousVisibleIndex !== null) ?
                                this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
                                this.appBoxIter.getFirstVisible();
                            break;
                        case "top":
                            item_actor = this.favBoxIter.getFirstVisible();
                            break;
                        case "bottom":
                            item_actor = this.favBoxIter.getLastVisible();
                            break;
                    }
                    break;
                default:
                    break;
            }

            if (!item_actor)
                return false;

            index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);
        } else {
            if (this._activeContainer !== this.categoriesBox && (symbol === Clutter.KEY_Return ||
                    symbol === Clutter.KP_Enter)) {
                if (!altKey) {
                    item_actor = this._activeContainer.get_child_at_index(this._selectedItemIndex);
                    item_actor._delegate.activate();
                } else if (altKey && this._activeContainer === this.applicationsBox) {
                    item_actor = this.applicationsBox.get_child_at_index(this._selectedItemIndex);

                    if (item_actor._delegate instanceof $.ApplicationButton ||
                        item_actor._delegate instanceof $.RecentButton)
                        item_actor._delegate.activateContextMenus();
                }
                return true;
            } else if (this._activeContainer === this.applicationsBox && symbol === Clutter.KEY_Menu) {
                item_actor = this.applicationsBox.get_child_at_index(this._selectedItemIndex);

                if (item_actor._delegate instanceof $.ApplicationButton ||
                    item_actor._delegate instanceof $.RecentButton)
                    item_actor._delegate.activateContextMenus();
                return true;
            } else if (this._activeContainer === this.favoritesBox && symbol === Clutter.Delete) {
                item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);

                if (item_actor._delegate instanceof $.FavoritesButton) {
                    let favorites = AppFavorites.getAppFavorites().getFavorites();
                    let numFavorites = favorites.length;
                    AppFavorites.getAppFavorites().removeFavorite(item_actor._delegate.app.get_id());
                    item_actor._delegate.toggleMenu();

                    if (this._selectedItemIndex == (numFavorites - 1))
                        item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex - 1);
                    else
                        item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
                }
            } else if (this._activeContainer === this.favoritesBox &&
                (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_Up) && ctrlKey &&
                (this.favoritesBox.get_child_at_index(index))._delegate instanceof $.FavoritesButton) {
                item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
                let id = item_actor._delegate.app.get_id();
                let appFavorites = AppFavorites.getAppFavorites();
                let favorites = appFavorites.getFavorites();
                let numFavorites = favorites.length;
                let favPos = 0;

                if (this._selectedItemIndex == (numFavorites - 1) && symbol === Clutter.KEY_Down)
                    favPos = 0;
                else if (this._selectedItemIndex === 0 && symbol === Clutter.KEY_Up)
                    favPos = numFavorites - 1;
                else if (symbol === Clutter.KEY_Down)
                    favPos = this._selectedItemIndex + 1;
                else
                    favPos = this._selectedItemIndex - 1;

                appFavorites.moveFavoriteToPos(id, favPos);
                item_actor = this.favoritesBox.get_child_at_index(favPos);
            } else if (this.searchFilesystem && (this._fileFolderAccessActive ||
                    symbol === Clutter.slash)) {
                if (symbol === Clutter.Return || symbol === Clutter.KP_Enter) {
                    if (this._run(this.searchEntry.get_text())) {
                        this.menu.close();
                    }
                    return true;
                }

                if (symbol === Clutter.Escape) {
                    this.searchEntry.set_text('');
                    this._fileFolderAccessActive = false;
                }

                if (symbol === Clutter.slash) {
                    // Need preload data before get completion. GFilenameCompleter load content of parent directory.
                    // Parent directory for /usr/include/ is /usr/. So need to add fake name('a').
                    let text = this.searchEntry.get_text().concat('/a');
                    let prefix;
                    if (text.lastIndexOf(' ') == -1)
                        prefix = text;
                    else
                        prefix = text.substr(text.lastIndexOf(' ') + 1);
                    this._getCompletion(prefix);

                    return false;
                }

                if (symbol === Clutter.Tab) {
                    let text = actor.get_text();
                    let prefix;
                    if (text.lastIndexOf(' ') == -1)
                        prefix = text;
                    else
                        prefix = text.substr(text.lastIndexOf(' ') + 1);
                    let postfix = this._getCompletion(prefix);
                    if (postfix !== null && postfix.length > 0) {
                        actor.insert_text(postfix, -1);
                        actor.set_cursor_position(text.length + postfix.length);
                        if (postfix[postfix.length - 1] == '/')
                            this._getCompletion(text + postfix + 'a');
                    }
                    return true;
                }

                if (symbol === Clutter.ISO_Left_Tab) {
                    return true;
                }

                return false;
            } else if (symbol === Clutter.Tab || symbol === Clutter.ISO_Left_Tab) {
                return true;
            } else {
                return false;
            }
        }

        this.setSelectedItemTitleAndDescription(null, "", "");

        this._selectedItemIndex = index;

        if (!item_actor || item_actor === this.searchEntry)
            return false;

        // Pass whichWay as an argument so the "enter-event" callback recognises that the
        // event comes from keyboard navigation.
        item_actor._delegate.emit('enter-event', (whichWay === "up" || whichWay === "down"));
        return true;
    },

    _addEnterEvent: function(button, callback) {
        let _callback = Lang.bind(this, function(aActor, aFromKeyboard) {
            let parent = button.actor.get_parent();
            if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
                this._previousTreeSelectedActor = this._activeActor;
                this._previousSelectedActor = null;
            }

            if (this._previousTreeSelectedActor && this._activeContainer !== this.categoriesBox &&
                parent !== this._activeContainer && button !== this._previousTreeSelectedActor &&
                !this.searchActive) {
                this._previousTreeSelectedActor.style_class = "menu-category-button";
            }

            if (parent != this._activeContainer) {
                parent._vis_iter.reloadVisible();
            }

            let _maybePreviousActor = this._activeActor;
            if (_maybePreviousActor && this._activeContainer !== this.categoriesBox) {
                this._previousSelectedActor = _maybePreviousActor;
                this._clearPrevSelection();
            }

            if (parent === this.categoriesBox && !this.searchActive) {
                this._previousSelectedActor = _maybePreviousActor;
                this._clearPrevCatSelection();
            }

            this._activeContainer = parent;
            this._activeActor = button.actor;
            this._selectedItemIndex = this._activeContainer._vis_iter.getAbsoluteIndexOfChild(this._activeActor);
            this._fromKeyboard = aFromKeyboard === true;
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    },

    _clearPrevSelection: function(actor) {
        if (this._previousSelectedActor && this._previousSelectedActor != actor) {
            if (this._previousSelectedActor._delegate instanceof $.ApplicationButton ||
                this._previousSelectedActor._delegate instanceof $.RecentButton ||
                this._previousSelectedActor._delegate instanceof $.SearchProviderResultButton ||
                this._previousSelectedActor._delegate instanceof $.PlaceButton ||
                this._previousSelectedActor._delegate instanceof $.RecentClearButton ||
                this._previousSelectedActor._delegate instanceof $.RecentAppsClearButton ||
                this._previousSelectedActor._delegate instanceof $.MyCustomCommandButton ||
                this._previousSelectedActor._delegate instanceof $.TransientButton) {
                this._previousSelectedActor.style_class = "menu-application-button";
            } else if (this._previousSelectedActor._delegate instanceof $.FavoritesButton ||
                this._previousSelectedActor._delegate instanceof $.SystemButton) {
                this._previousSelectedActor.remove_style_pseudo_class("hover");
            }
        }
    },

    _clearPrevCatSelection: function(actor) {
        if (this._previousTreeSelectedActor && this._previousTreeSelectedActor != actor) {
            this._previousTreeSelectedActor.style_class = "menu-category-button";

            if (this._previousTreeSelectedActor._delegate) {
                this._previousTreeSelectedActor._delegate.emit('leave-event');
            }

            if (actor !== undefined) {
                this._previousVisibleIndex = null;
                this._previousTreeSelectedActor = actor;
            }
        } else {
            this.categoriesBox.get_children().forEach(Lang.bind(this, function(child) {
                child.style_class = "menu-category-button";
            }));
        }
    },

    makeVectorBox: function(actor) {
        this.destroyVectorBox(actor);
        if (this.pref_use_alternate_vector_box) {
            let [catbox_x, catbox_y] = this.categoriesBox.get_transformed_position();
            let [catbox_w, catbox_h] = this.categoriesBox.get_transformed_size(); // jshint ignore:line
            let [appbox_x, appbox_y] = this.applicationsBox.get_transformed_position();
            let [appbox_w, appbox_h] = this.applicationsBox.get_transformed_size();

            if ((catbox_y + catbox_h) > appbox_y) {
                this.topPosition = appbox_y;
                this.bottomPosition = appbox_y + appbox_h;

                if (catbox_x < appbox_x) {
                    this.horizontalPosition = appbox_x;
                    this.vectorOrientation = St.Side.RIGHT;
                } else {
                    this.horizontalPosition = appbox_x + appbox_w;
                    this.vectorOrientation = St.Side.LEFT;
                }

                this.current_motion_actor = actor;
                this.actor_motion_id = this.current_motion_actor.connect("motion-event", Lang.bind(this, this.maybeUpdateVectorBox));
            }
        } else {
            let [mouse_x, mouse_y, mask] = global.get_pointer(); // jshint ignore:line
            let [catbox_x, catbox_y] = this.categoriesApplicationsBox.actor.get_transformed_position();
            let [catbox_w, catbox_h] = this.categoriesApplicationsBox.actor.get_transformed_size(); // jshint ignore:line
            let [actor_x, actor_y] = actor.get_transformed_position(); // jshint ignore:line
            let [actor_w, actor_h] = actor.get_transformed_size(); // jshint ignore:line
            let [appbox_x, appbox_y] = this.applicationsBox.get_transformed_position(); // jshint ignore:line

            let pol_right_x = appbox_x - catbox_x;
            let xformed_mouse_x = mouse_x - catbox_x;
            let xformed_mouse_y = mouse_y - catbox_y;
            let pol_w = Math.max(pol_right_x - xformed_mouse_x, 0);

            let ulc_y = xformed_mouse_y + 0;
            let llc_y = xformed_mouse_y + 0;

            this.vectorBox = new St.Polygon({
                debug: false,
                width: pol_w,
                height: catbox_h,
                ulc_x: 0,
                ulc_y: ulc_y,
                llc_x: 0,
                llc_y: llc_y,
                urc_x: pol_w,
                urc_y: 0,
                lrc_x: pol_w,
                lrc_y: catbox_h
            });

            this.categoriesApplicationsBox.actor.add_actor(this.vectorBox);
            this.vectorBox.set_position(xformed_mouse_x, 0);

            this.vectorBox.show();
            this.vectorBox.set_reactive(true);
            this.vectorBox.raise_top();

            this.vectorBox.connect("leave-event", Lang.bind(this, this.destroyVectorBox));
            this.vectorBox.connect("motion-event", Lang.bind(this, this.maybeUpdateVectorBox));
            this.actor_motion_id = actor.connect("motion-event", Lang.bind(this, this.maybeUpdateVectorBox));
            this.current_motion_actor = actor;
        }
    },

    maybeUpdateVectorBox: function() {
        if (this.pref_use_alternate_vector_box) {
            try {
                if (this.vector_update_loop) {
                    Mainloop.source_remove(this.vector_update_loop);
                    this.vector_update_loop = null;
                }

                if (this.isInsideVectorBox())
                    this.vector_update_loop = Mainloop.timeout_add(35, Lang.bind(this, this.updateVectorBox));
                else {
                    this.updateVectorBox();
                }
            } catch (aErr) {
                global.logError(aErr.message);
            }
        } else {
            if (this.vector_update_loop) {
                Mainloop.source_remove(this.vector_update_loop);
                this.vector_update_loop = 0;
            }

            this.vector_update_loop = Mainloop.timeout_add(35, Lang.bind(this, this.updateVectorBox));
        }
    },

    updateVectorBox: function(actor) {
        if (this.pref_use_alternate_vector_box) {
            if (this.vector_update_loop) {
                Mainloop.source_remove(this.vector_update_loop);
                this.vector_update_loop = null;
            }

            if ((this.current_motion_actor) && (this.current_motion_actor._delegate.isHovered)) {
                if ((!this.catShow) && (this.current_motion_actor)) {
                    if (this.lastedCategoryShow) {
                        this._previousTreeSelectedActor = null;
                        this._clearPrevCatSelection(null);
                        this.lastedCategoryShow = null;
                    }
                    this._clearPrevCatSelection(this.current_motion_actor);
                    this._select_category(this.current_motion_actor._delegate.category || null);
                    this.catShow = true;
                }
                let [mouse_x, mouse_y, mask] = global.get_pointer(); // jshint ignore:line
                this.mouseVectorX = mouse_x;
                this.mouseVectorY = mouse_y;
            } else {
                this.destroyVectorBox();
            }
        } else {
            if (this.vectorBox) {
                let [mouse_x, mouse_y, mask] = global.get_pointer(); // jshint ignore:line
                let [catbox_x, catbox_y] = this.categoriesApplicationsBox.actor.get_transformed_position(); // jshint ignore:line
                let xformed_mouse_x = mouse_x - catbox_x;
                let [appbox_x, appbox_y] = this.applicationsBox.get_transformed_position(); // jshint ignore:line
                let right_x = appbox_x - catbox_x;

                if ((right_x - xformed_mouse_x) > 0) {
                    this.vectorBox.width = Math.max(right_x - xformed_mouse_x, 0);
                    this.vectorBox.set_position(xformed_mouse_x, 0);
                    this.vectorBox.urc_x = this.vectorBox.width;
                    this.vectorBox.lrc_x = this.vectorBox.width;
                    this.vectorBox.queue_repaint();
                } else {
                    this.destroyVectorBox(actor);
                }
            }
            this.vector_update_loop = 0;
        }
        return false;
    },

    destroyVectorBox: function(actor) { // jshint ignore:line
        if (!this.pref_use_alternate_vector_box) {
            if (this.vectorBox !== null) {
                this.vectorBox.destroy();
                this.vectorBox = null;
            }
        }

        if (this.actor_motion_id > 0 && this.current_motion_actor !== null) {
            this.current_motion_actor.disconnect(this.actor_motion_id);
            this.actor_motion_id = 0;
            this.current_motion_actor = null;
        }
    },

    isInsideVectorBox: function() {
        if (this.current_motion_actor) {
            let [mx, my, mask] = global.get_pointer(); // jshint ignore:line

            if ((this.vectorOrientation == St.Side.RIGHT) && (this.mouseVectorX >= mx)) {
                return false;
            }

            let mouseWidth = Math.abs(this.mouseVectorX - mx);
            let mouseHeight = Math.abs(this.mouseVectorY - my);
            let currentHeigth;

            if (my <= this.mouseVectorY)
                currentHeigth = Math.abs(this.mouseVectorY - this.topPosition);
            else
                currentHeigth = Math.abs(this.mouseVectorY - this.bottomPosition);

            let currentWidth = Math.abs(this.mouseVectorX - this.horizontalPosition);
            let realHeigth = (mouseWidth * currentHeigth) / currentWidth;
            return (realHeigth >= mouseHeight);
        }
        return false;
    },

    _refreshPlaces: function() {
        if (this._placesButtons && this._placesButtons.length > 0) {
            let p = 0,
                pLen = this._placesButtons.length;
            for (; p < pLen; p++) {
                this._placesButtons[p].actor.destroy();
            }
        }

        this._placesButtons = [];

        if (this._categoryButtons && this._categoryButtons.length > 0) {
            let c = 0,
                cLen = this._categoryButtons.length;
            for (; c < cLen; c++) {
                if (this._categoryButtons[c] instanceof $.PlaceCategoryButton) {
                    this._categoryButtons[c].actor.destroy();
                    this._categoryButtons.splice(c, 1);
                    this.placesButton = null;
                    break;
                }
            }
        }

        // Now generate Places category and places buttons and add to the list
        if (this.pref_show_places) {
            this.placesButton = new $.PlaceCategoryButton(this, null, this.pref_display_category_icons);
            let selectCat = Lang.bind(this, function() {
                this.closeContextMenus(null, false);
                this._select_category("places");
            });
            this._addEnterEvent(this.placesButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    this.placesButton.isHovered = true;
                    if (this.cat_hover_delay > 0 && !this._fromKeyboard) {
                        Tweener.addTween(this, {
                            time: this.cat_hover_delay,
                            onComplete: function() {
                                if (this.placesButton.isHovered) {
                                    this._clearPrevCatSelection(this.placesButton);
                                    this.placesButton.actor.style_class = "menu-category-button-selected";
                                    selectCat();
                                } else {
                                    this.placesButton.actor.style_class = "menu-category-button";
                                }
                            }
                        });
                    } else {
                        this._clearPrevCatSelection(this.placesButton);
                        this.placesButton.actor.style_class = "menu-category-button-selected";

                        if (this.pref_cat_select_on_hover || this._fromKeyboard) {
                            selectCat();
                        }
                    }
                    this.makeVectorBox(this.placesButton.actor);
                }
            }));

            if (!this.pref_cat_select_on_hover) {
                this.placesButton.actor.connect("button-press-event", Lang.bind(this, selectCat));
                this.placesButton.actor.connect("button-release-event", Lang.bind(this, selectCat));
                this.placesButton.connect("button-press-event", Lang.bind(this, selectCat));
                this.placesButton.connect("button-release-event", Lang.bind(this, selectCat));
            }

            this.placesButton.actor.connect('leave-event', Lang.bind(this, function() {
                if (this._previousTreeSelectedActor === null) {
                    this._previousTreeSelectedActor = this.placesButton.actor;
                } else {
                    let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
                    let nextIdx = this.catBoxIter.getVisibleIndex(this.placesButton.actor);
                    let idxDiff = Math.abs(prevIdx - nextIdx);
                    if (idxDiff <= 1 || Math.min(prevIdx, nextIdx) < 0) {
                        this._previousTreeSelectedActor = this.placesButton.actor;
                    }
                }

                this.placesButton.isHovered = false;
            }));
            this._categoryButtons.push(this.placesButton);
            this.categoriesBox.add_actor(this.placesButton.actor);

            let handleEnterEvent = Lang.bind(this, function(button) {
                this._addEnterEvent(button, Lang.bind(this, function() {
                    this._clearPrevSelection(button.actor);
                    button.actor.style_class = "menu-application-button-selected";
                    let selectedAppId = $.escapeUnescapeReplacer.unescape(button.place.id);
                    selectedAppId = selectedAppId.substr(selectedAppId.indexOf(":") + 1);
                    let fileIndex = selectedAppId.indexOf("file:///");

                    if (fileIndex !== -1)
                        selectedAppId = selectedAppId.substr(fileIndex + 7);

                    if (this._useHoverFeedback)
                        this.userPicture.refreshPlace(button.place);

                    this.setSelectedItemTitleAndDescription(button, "", selectedAppId);
                }));
            });

            let handleLeaveEvent = Lang.bind(this, function(button) {
                button.actor.connect('leave-event', Lang.bind(this, function() {
                    this._previousSelectedActor = button.actor;
                    this.setSelectedItemTitleAndDescription(button, "", "");

                    if (this._useHoverFeedback)
                        this.userPicture.refreshFace();
                }));
            });

            let bookmarks = this._listBookmarks();
            let devices = this._listDevices();
            let places = bookmarks.concat(devices);
            let i = 0,
                iLen = places.length;
            for (; i < iLen; i++) {
                let place = places[i];
                let button = new $.PlaceButton(this, place, place.name, this.pref_display_application_icons);
                handleEnterEvent(button);
                handleLeaveEvent(button);
                this._placesButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
            }
        }

        this._setCategoriesButtonActive(!this.searchActive);

        this._recalc_height();
        this._resizeApplicationsBox();
    },

    _refreshRecent: function() {
        let r = 0,
            rLen = this._recentButtons.length;
        for (; r < rLen; r++) {
            this._recentButtons[r].actor.destroy();
        }
        let c = 0,
            cLen = this._categoryButtons.length;
        for (; c < cLen; c++) {
            if (this._categoryButtons[c] instanceof $.RecentCategoryButton) {
                this._categoryButtons[c].actor.destroy();
            }
        }
        this._recentButtons = [];

        // Now generate recent category and recent files buttons and add to the list
        /**
         * START mark Odyseus
         * Just added the condition to hide Recent files category.
         * This is for people that doesn't want to disable the Remember accessed files option
         * from Privacy but wants to get rid of the Recent files category on the menu.
         */
        if (this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY) &&
            this.pref_show_recents_button) {
            this.recentButton = new $.RecentCategoryButton(this, null, this.pref_display_category_icons);
            let selectCat = Lang.bind(this, function() {
                this.closeContextMenus(null, false);
                this._select_category("recent");
            });
            this._addEnterEvent(this.recentButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    this.recentButton.isHovered = true;
                    if (this.cat_hover_delay > 0 && !this._fromKeyboard) {
                        Tweener.addTween(this, {
                            time: this.cat_hover_delay,
                            onComplete: function() {
                                if (this.recentButton.isHovered) {
                                    this._clearPrevCatSelection(this.recentButton.actor);
                                    this.recentButton.actor.style_class = "menu-category-button-selected";
                                    selectCat();
                                } else {
                                    this.recentButton.actor.style_class = "menu-category-button";
                                }
                            }
                        });
                    } else {
                        this._clearPrevCatSelection(this.recentButton.actor);
                        this.recentButton.actor.style_class = "menu-category-button-selected";

                        if (this.pref_cat_select_on_hover || this._fromKeyboard) {
                            selectCat();
                        }
                    }
                    this.makeVectorBox(this.recentButton.actor);
                }
            }));

            if (!this.pref_cat_select_on_hover) {
                this.recentButton.actor.connect("button-press-event", Lang.bind(this, selectCat));
                this.recentButton.actor.connect("button-release-event", Lang.bind(this, selectCat));
                this.recentButton.connect("button-press-event", Lang.bind(this, selectCat));
                this.recentButton.connect("button-release-event", Lang.bind(this, selectCat));
            }

            this.recentButton.actor.connect('leave-event', Lang.bind(this, function() {
                if (this._previousTreeSelectedActor === null) {
                    this._previousTreeSelectedActor = this.recentButton.actor;
                } else {
                    let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
                    let nextIdx = this.catBoxIter.getVisibleIndex(this.recentButton.actor);

                    if (Math.abs(prevIdx - nextIdx) <= 1) {
                        this._previousTreeSelectedActor = this.recentButton.actor;
                    }
                }

                this.recentButton.isHovered = false;
            }));
            this.categoriesBox.add_actor(this.recentButton.actor);
            this._categoryButtons.push(this.recentButton);

            if (this.RecentManager._infosByTimestamp.length > 0) {
                let handleEnterEvent = Lang.bind(this, function(button) {
                    this._addEnterEvent(button, Lang.bind(this, function() {
                        this._clearPrevSelection(button.actor);
                        button.actor.style_class = "menu-application-button-selected";
                        let selectedAppUri = $.escapeUnescapeReplacer.unescape(button.uri);
                        let file = Gio.file_new_for_uri(selectedAppUri);
                        let fileExists = file.query_exists(null);
                        let fileIndex = selectedAppUri.indexOf("file:///");

                        if (fileIndex !== -1)
                            selectedAppUri = selectedAppUri.substr(fileIndex + 7);

                        this.setSelectedItemTitleAndDescription(button,
                            (fileExists ?
                                "" :
                                _("This file is no longer available")),
                            selectedAppUri);

                        if (this._useHoverFeedback) {
                            if (fileExists)
                                this.userPicture.refreshFile(file);
                            else
                                this.userPicture.refresh("bookmark-missing");
                        }
                    }));
                });

                let handleLeaveEvent = Lang.bind(this, function(button) {
                    button.actor.connect('leave-event', Lang.bind(this, function() {
                        button.actor.style_class = "menu-application-button";
                        this._previousSelectedActor = button.actor;
                        this.setSelectedItemTitleAndDescription(button, "", "");

                        if (this._useHoverFeedback)
                            this.userPicture.refreshFace();
                    }));
                });

                let id = 0,
                    idLen = this.RecentManager._infosByTimestamp.length;
                for (; id < this.pref_max_recent_files && id < idLen; id++) {
                    let button = new $.RecentButton(this, this.RecentManager._infosByTimestamp[id], this.pref_display_application_icons);
                    handleEnterEvent(button);
                    handleLeaveEvent(button);

                    let file = Gio.file_new_for_uri($.escapeUnescapeReplacer.unescape(button.uri));

                    if (file.query_exists(null)) {
                        this._recentButtons.push(button);
                        this.applicationsBox.add_actor(button.actor);
                        this.applicationsBox.add_actor(button.menu.actor);
                    }
                }

                let button = new $.RecentClearButton(this);
                this._addEnterEvent(button, Lang.bind(this, function() {
                    this._clearPrevSelection(button.actor);
                    button.actor.style_class = "menu-application-button-selected";

                    if (this._useHoverFeedback)
                        this.userPicture.refresh("edit-clear");
                }));
                button.actor.connect('leave-event', Lang.bind(this, function() {
                    button.actor.style_class = "menu-application-button";
                    this._previousSelectedActor = button.actor;

                    if (this._useHoverFeedback)
                        this.userPicture.refreshFace();
                }));
                this._recentButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                this.noRecentDocuments = false;
            } else {
                // NOTE: This string could be left blank because it's a default string,
                // so it's already translated by Cinnamon. It's up to the translators.
                let button = new $.GenericButton(this, _("No recent documents"), null, false, null);
                this._recentButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                this.noRecentDocuments = true;
            }

        }

        this._setCategoriesButtonActive(!this.searchActive);

        this._recalc_height();
        this._resizeApplicationsBox();
    },

    /**
     * START mark Odyseus
     */
    _storeRecentApp: function(aAppID) {
        if (this.pref_recent_apps_ignore_favorites &&
            AppFavorites.getAppFavorites().isFavorite(aAppID))
            return;

        try {
            let t = new Date().getTime();
            let recApps = this.pref_recently_used_apps;
            // Remove object if it was previously launched.
            for (let i = recApps.length; i--;) {
                if (recApps[i]["id"] === aAppID) {
                    recApps.splice(i, 1);
                }
            }
            recApps.push({
                id: aAppID,
                lastAccess: t
            });

            // Holy ·$%&/()!!!
            // The only freaking way that I could find to remove duplicates!!!
            // Like always, Stack Overflow is a life saver.
            // http://stackoverflow.com/questions/31014324/remove-duplicated-object-in-array
            let temp = [];

            this.pref_recently_used_apps = recApps.filter(function(aVal) {
                return temp.indexOf(aVal.id) === -1 ? temp.push(aVal.id) : false;
            });

            this._refreshRecentApps();
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    _refreshRecentApps: function() {
        let r = 0,
            rLen = this._recentAppsButtons.length;
        for (; r < rLen; r++) {
            this._recentAppsButtons[r].actor.destroy();
        }

        if (!this.pref_remember_recently_used_apps) {
            let c = 0,
                cLen = this._categoryButtons.length;
            for (; c < cLen; c++) {
                if (this._categoryButtons[c] instanceof $.RecentAppsCategoryButton) {
                    this._categoryButtons[c].actor.destroy();
                }
            }
            return;
        }

        this._recentAppsButtons = [];
        this._recentAppsApps = [];

        if (this.pref_recently_used_apps.length > 0 && this.recentAppsButton !== null) {
            Array.prototype.slice.call(this._applicationsButtons).forEach(Lang.bind(this, function(aBtn) {
                let appId = aBtn.get_app_id();
                let c = 0,
                    cLen = this.pref_recently_used_apps.length;
                for (; c < cLen; c++) {
                    if (this.pref_recently_used_apps[c]["id"] === appId) {
                        aBtn.app.lastAccess = this.pref_recently_used_apps[c]["lastAccess"];
                        this._recentAppsApps.push(aBtn.app);
                        continue;
                    }
                }
            }));

            let clearBtn = new $.RecentAppsClearButton(this);
            this._addEnterEvent(clearBtn, Lang.bind(this, function() {
                this._clearPrevSelection(clearBtn.actor);
                clearBtn.actor.style_class = "menu-application-button-selected";

                if (this._useHoverFeedback)
                    this.userPicture.refresh("edit-clear");
            }));
            clearBtn.actor.connect('leave-event', Lang.bind(this, function() {
                clearBtn.actor.style_class = "menu-application-button";
                this._previousSelectedActor = clearBtn.actor;

                if (this._useHoverFeedback)
                    this.userPicture.refreshFace();
            }));

            if (this.pref_recently_used_apps_invert_order) {
                this._recentAppsButtons.push(clearBtn);
                this.applicationsBox.add_actor(clearBtn.actor);
            }

            this._recentAppsApps = this._recentAppsApps.sort(Lang.bind(this, function(a, b) {
                if (this.pref_recently_used_apps_invert_order)
                    return a["lastAccess"] > b["lastAccess"];
                return a["lastAccess"] < b["lastAccess"];
            }));

            let id = 0,
                idLen = this._recentAppsApps.length;
            for (; id < this.pref_max_recently_used_apps && id < idLen; id++) {
                let button = new $.ApplicationButton(this, this._recentAppsApps[id], this.pref_display_application_icons);
                button.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button));
                this._addEnterEvent(button, Lang.bind(this, this._appEnterEvent, button));
                this._recentAppsButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                this.applicationsBox.add_actor(button.menu.actor);
            }

            if (!this.pref_recently_used_apps_invert_order) {
                this._recentAppsButtons.push(clearBtn);
                this.applicationsBox.add_actor(clearBtn.actor);
            }
        } else {
            let button = new $.GenericButton(this, _("No recent applications"), null, false, null);
            this._recentAppsButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
        }

        this._setCategoriesButtonActive(!this.searchActive);

        this._recalc_height();
        this._resizeApplicationsBox();
    },
    /**
     * END
     */

    _refreshApps: function() {
        this.applicationsBox.destroy_all_children();
        this._applicationsButtons = [];
        this._transientButtons = [];
        this._applicationsButtonFromApp = {};
        this._applicationsBoxWidth = 0;
        //Remove all categories
        this.categoriesBox.destroy_all_children();

        if (!this.pref_hide_allapps_category && !this.pref_display_favorites_as_category_menu) {
            this._allAppsCategoryButton = new $.CategoryButton(this, null);
            let selectCat = Lang.bind(this, function() {
                this._select_category(null);
            });
            this._addEnterEvent(this._allAppsCategoryButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    this._allAppsCategoryButton.isHovered = true;
                    if (this.cat_hover_delay > 0 && !this._fromKeyboard) {
                        Tweener.addTween(this, {
                            time: this.cat_hover_delay,
                            onComplete: function() {
                                if (this._allAppsCategoryButton.isHovered) {
                                    this._clearPrevCatSelection(this._allAppsCategoryButton.actor);
                                    this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
                                    selectCat();
                                } else {
                                    this._allAppsCategoryButton.actor.style_class = "menu-category-button";
                                }
                            }
                        });
                    } else {
                        this._clearPrevCatSelection(this._allAppsCategoryButton.actor);
                        this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";

                        if (this.pref_cat_select_on_hover || this._fromKeyboard) {
                            selectCat();
                        }
                    }
                    this.makeVectorBox(this._allAppsCategoryButton.actor);
                }
            }));

            if (!this.pref_cat_select_on_hover) {
                this._allAppsCategoryButton.actor.connect("button-press-event", Lang.bind(this, selectCat));
                this._allAppsCategoryButton.actor.connect("button-release-event", Lang.bind(this, selectCat));
                this._allAppsCategoryButton.connect("button-press-event", Lang.bind(this, selectCat));
                this._allAppsCategoryButton.connect("button-release-event", Lang.bind(this, selectCat));
            }

            this._allAppsCategoryButton.actor.connect('leave-event', Lang.bind(this, function() {
                this._previousSelectedActor = this._allAppsCategoryButton.actor;
                this._allAppsCategoryButton.isHovered = false;
            }));
            this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);
        }

        /**
         * START mark Odyseus
         * Favorites category
         */

        if (this.pref_hide_allapps_category && this.pref_display_favorites_as_category_menu) {
            let favCat = {
                get_menu_id: function() {
                    return "favorites";
                },
                get_id: function() {
                    return -1;
                },
                get_description: function() {
                    return this.get_name();
                },
                get_name: function() {
                    return _("Favorites");
                },
                get_is_nodisplay: function() {
                    return false;
                },
                get_icon: function() {
                    return "user-bookmarks";
                }
            };
            this._initialSelectedCategory = "favorites";
            this._allAppsCategoryButton = new $.CategoryButton(this, favCat, this.pref_display_category_icons);

            if (!this.pref_display_fav_box) {
                this._allAppsCategoryButton.handleDragOver = function(source, actor, x, y, time) { // jshint ignore:line
                    return DND.DragMotionResult.MOVE_DROP;
                };
                this._allAppsCategoryButton.acceptDrop = function(source, actor, x, y, time) { // jshint ignore:line
                    let app = source.app;
                    let id = app.get_id();
                    let favorites = AppFavorites.getAppFavorites().getFavoriteMap();
                    let srcIsFavorite = (id in favorites);

                    Mainloop.idle_add(Lang.bind(this, function() {
                        let appFavorites = AppFavorites.getAppFavorites();

                        if (srcIsFavorite)
                            appFavorites.removeFavorite(id);
                        else
                            appFavorites.addFavorite(id);

                        return false;
                    }));

                    return true;
                };
            }

            let selectCat = Lang.bind(this, function() {
                this._select_category(this._initialSelectedCategory);
            });
            this._addEnterEvent(this._allAppsCategoryButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    this._allAppsCategoryButton.isHovered = true;
                    if (this.cat_hover_delay > 0 && !this._fromKeyboard) {
                        Tweener.addTween(this, {
                            time: this.cat_hover_delay,
                            onComplete: function() {
                                if (this._allAppsCategoryButton.isHovered) {
                                    this._clearPrevCatSelection(this._allAppsCategoryButton.actor);
                                    this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
                                    selectCat();
                                } else {
                                    this._allAppsCategoryButton.actor.style_class = "menu-category-button";
                                }
                            }
                        });
                    } else {
                        this._clearPrevCatSelection(this._allAppsCategoryButton.actor);
                        this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";

                        if (this.pref_cat_select_on_hover || this._fromKeyboard) {
                            selectCat();
                        }
                    }
                    this.makeVectorBox(this._allAppsCategoryButton.actor);
                }
            }));

            if (!this.pref_cat_select_on_hover) {
                this._allAppsCategoryButton.actor.connect("button-press-event", Lang.bind(this, selectCat));
                this._allAppsCategoryButton.actor.connect("button-release-event", Lang.bind(this, selectCat));
                this._allAppsCategoryButton.connect("button-press-event", Lang.bind(this, selectCat));
                this._allAppsCategoryButton.connect("button-release-event", Lang.bind(this, selectCat));
            }

            this._allAppsCategoryButton.actor.connect('leave-event', Lang.bind(this, function() {
                this._previousSelectedActor = this._allAppsCategoryButton.actor;
                this._allAppsCategoryButton.isHovered = false;
            }));
            this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);
        }

        /**
         * END
         */

        /**
         * START mark Odyseus
         * Recent apps category.
         * This was easy...until I started to try to sort the apps by execution time!!
         * It was a total nightmare!!!!
         */
        if (this.pref_remember_recently_used_apps) {
            this.recentAppsCatButton = new $.RecentAppsCategoryButton(this, null, this.pref_display_category_icons);
            let selectCat = Lang.bind(this, function() {
                this.closeContextMenus(null, false);
                this._select_category("recentApps");
            });
            this._addEnterEvent(this.recentAppsCatButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    this.recentAppsCatButton.isHovered = true;
                    if (this.cat_hover_delay > 0 && !this._fromKeyboard) {
                        Tweener.addTween(this, {
                            time: this.cat_hover_delay,
                            onComplete: function() {
                                if (this.recentAppsCatButton.isHovered) {
                                    this._clearPrevCatSelection(this.recentAppsCatButton.actor);
                                    this.recentAppsCatButton.actor.style_class = "menu-category-button-selected";
                                    selectCat();
                                } else {
                                    this.recentAppsCatButton.actor.style_class = "menu-category-button";
                                }
                            }
                        });
                    } else {
                        this._clearPrevCatSelection(this.recentAppsCatButton.actor);
                        this.recentAppsCatButton.actor.style_class = "menu-category-button-selected";

                        if (this.pref_cat_select_on_hover || this._fromKeyboard) {
                            selectCat();
                        }
                    }
                    this.makeVectorBox(this.recentAppsCatButton.actor);
                }
            }));

            if (!this.pref_cat_select_on_hover) {
                this.recentAppsCatButton.actor.connect("button-press-event", Lang.bind(this, selectCat));
                this.recentAppsCatButton.actor.connect("button-release-event", Lang.bind(this, selectCat));
                this.recentAppsCatButton.connect("button-press-event", Lang.bind(this, selectCat));
                this.recentAppsCatButton.connect("button-release-event", Lang.bind(this, selectCat));
            }

            this.recentAppsCatButton.actor.connect('leave-event', Lang.bind(this, function() {
                this._previousSelectedActor = this.recentAppsCatButton.actor;
                this.recentAppsCatButton.isHovered = false;
            }));
            this.categoriesBox.add_actor(this.recentAppsCatButton.actor);
            this._categoryButtons.push(this.recentAppsCatButton);

            if (this.pref_recently_used_apps_separator) {
                /**
                 * Note to myself: Do not dare to use anything other than a PopupSeparatorMenuItem.
                 * Otherwise, a lot of things can break. Keyboard navigation for one.
                 */
                let separatorBox = new PopupMenu.PopupSeparatorMenuItem();
                this.categoriesBox.add_actor(separatorBox.actor);
            }
        }

        /**
         * END
         */

        let prefCats = ["administration", "preferences"];

        let sortDirs = function(a, b) {
            let menuIdA = a.get_menu_id().toLowerCase();
            let menuIdB = b.get_menu_id().toLowerCase();

            let prefIdA = prefCats.indexOf(menuIdA);
            let prefIdB = prefCats.indexOf(menuIdB);

            if (prefIdA < 0 && prefIdB >= 0) {
                return -1;
            }
            if (prefIdA >= 0 && prefIdB < 0) {
                return 1;
            }

            let nameA = a.get_name().toLowerCase();
            let nameB = b.get_name().toLowerCase();

            if (nameA > nameB) {
                return 1;
            }
            if (nameA < nameB) {
                return -1;
            }
            return 0;
        };

        let selectCat = Lang.bind(this, function(dir) {
            this._select_category(dir.get_menu_id());
        });

        let handleCatEnterEvent = Lang.bind(this, function(categoryButton, dir) {
            this._addEnterEvent(categoryButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    categoryButton.isHovered = true;
                    if (this.cat_hover_delay > 0 && !this._fromKeyboard) {
                        Tweener.addTween(this, {
                            time: this.cat_hover_delay,
                            onComplete: function() {
                                if (categoryButton.isHovered) {
                                    this._clearPrevCatSelection(categoryButton.actor);
                                    categoryButton.actor.style_class = "menu-category-button-selected";
                                    selectCat(dir);
                                } else {
                                    categoryButton.actor.style_class = "menu-category-button";
                                }
                            }
                        });
                    } else {
                        this._clearPrevCatSelection(categoryButton.actor);
                        categoryButton.actor.style_class = "menu-category-button-selected";

                        if (this.pref_cat_select_on_hover || this._fromKeyboard) {
                            selectCat(dir);
                        }
                    }
                    this.makeVectorBox(categoryButton.actor);
                }
            }));
        });

        let handleCatLeaveEvent = Lang.bind(this, function(categoryButton, dir) { // jshint ignore:line
            categoryButton.actor.connect('leave-event', Lang.bind(this, function() {
                if (this._previousTreeSelectedActor === null) {
                    this._previousTreeSelectedActor = categoryButton.actor;
                } else {
                    let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
                    let nextIdx = this.catBoxIter.getVisibleIndex(categoryButton.actor);
                    if (Math.abs(prevIdx - nextIdx) <= 1) {
                        this._previousTreeSelectedActor = categoryButton.actor;
                    }
                }
                categoryButton.isHovered = false;
            }));
        });

        let trees = [appsys.get_tree()];

        for (let t in trees) {
            let tree = trees[t];
            let root = tree.get_root_directory();
            let dirs = [];
            let iter = root.iter();
            let nextType;

            while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
                if (nextType == CMenu.TreeItemType.DIRECTORY) {
                    dirs.push(iter.get_directory());
                }
            }

            dirs = dirs.sort(sortDirs);

            let i = 0,
                iLen = dirs.length;
            for (; i < iLen; i++) {
                let dir = dirs[i];
                if (dir.get_is_nodisplay())
                    continue;
                if (this._loadCategory(dir)) {
                    let categoryButton = new $.CategoryButton(this, dir, this.pref_display_category_icons);

                    handleCatEnterEvent(categoryButton, dir);

                    if (!this.pref_cat_select_on_hover) {
                        categoryButton.actor.connect("button-press-event",
                            Lang.bind(this, selectCat, dir));
                        categoryButton.actor.connect("button-release-event",
                            Lang.bind(this, selectCat, dir));
                        categoryButton.connect("button-press-event",
                            Lang.bind(this, selectCat, dir));
                        categoryButton.connect("button-release-event",
                            Lang.bind(this, selectCat, dir));
                    }

                    handleCatLeaveEvent(categoryButton, dir);

                    if (i === 0 && this.pref_hide_allapps_category &&
                        !this.pref_display_favorites_as_category_menu) {
                        this._initialSelectedCategory = dir;
                        this._allAppsCategoryButton = categoryButton;
                    }
                    this.categoriesBox.add_actor(categoryButton.actor);
                }
            }
        }
        // Sort apps and add to applicationsBox
        this._applicationsButtons.sort(function(a, b) {
            a = Util.latinise(a.app.get_name().toLowerCase());
            b = Util.latinise(b.app.get_name().toLowerCase());
            return a > b;
        });

        let i = 0,
            iLen = this._applicationsButtons.length;
        for (; i < iLen; i++) {
            this.applicationsBox.add_actor(this._applicationsButtons[i].actor);
            this.applicationsBox.add_actor(this._applicationsButtons[i].menu.actor);
        }

        /**
         * START mark Odyseus
         */
        // From Sane Menu
        if (this.pref_fuzzy_search_enabled)
            this._applicationsButtonsBackup = Object.create(this._applicationsButtons);
        //
        if (this._menuLayout.indexOf("searchBox") !== -1 &&
            this.pref_autofit_searchbox_width) {
            let searchEntryWidth = (this.applicationsBox.get_allocation_box().x2 -
                this.applicationsBox.get_allocation_box().x1);
            searchEntryWidth = searchEntryWidth + (this.categoriesBox.get_allocation_box().x2 -
                this.categoriesBox.get_allocation_box().x1);

            if (this.myCustomLaunchersBox && this.pref_custom_commands_box_placement !== 0)
                searchEntryWidth = searchEntryWidth - (this.myCustomLaunchersBox.get_allocation_box().x2 -
                    this.myCustomLaunchersBox.get_allocation_box().x1);

            this.searchEntry.set_width(searchEntryWidth);
        }
        /**
         * END
         */

        this._appsWereRefreshed = true;
    },

    _favEnterEvent: function(button, icon) {
        button.actor.add_style_pseudo_class("hover");

        if (button instanceof $.FavoritesButton) {
            if (this._useHoverFeedback)
                this.userPicture.refreshApp(button.app);

            this.setSelectedItemTitleAndDescription(button,
                button.app.get_name(),
                button.app.get_description() || "");
        } else if (button instanceof $.SystemButton) {
            if (this._useHoverFeedback)
                this.userPicture.refresh(icon);

            this.setSelectedItemTitleAndDescription(button,
                button.app.get_name(),
                button.app.get_description() || "");
            this.setSelectedItemTitleAndDescription(button, button.name, button.desc);
        }

    },

    _favLeaveEvent: function(widget, event, button) {
        this._previousSelectedActor = button.actor;

        if (this._useHoverFeedback)
            this.userPicture.refreshFace();

        button.actor.remove_style_pseudo_class("hover");
        this.setSelectedItemTitleAndDescription(button, "", "");
    },

    _refreshFavs: function() {
        //Remove all favorites
        this.favoritesBox.destroy_all_children();

        //Load favorites again
        this._favoritesButtons = [];
        let launchers = global.settings.get_strv('favorite-apps');
        let appSys = Cinnamon.AppSystem.get_default();
        let j = 0;
        let i = 0,
            iLen = launchers.length;
        let extraButtons = (this.pref_system_buttons_display === 1) ? 3 : 0;

        if (this.pref_system_buttons_display === 1) { // If quit buttons are inside fav box.
            if (!this.pref_show_lock_button)
                --extraButtons;
            if (!this.pref_lock_button_custom_icon)
                --extraButtons;
            if (!this.pref_show_logout_button)
                --extraButtons;
        }

        for (; i < iLen; ++i) {
            let app = appSys.lookup_app(launchers[i]);
            if (app) {
                let button = new $.FavoritesButton(this, app, launchers.length + extraButtons);
                this._favoritesButtons[app] = button;
                this.favoritesBox.add_actor(button.actor);

                this._addEnterEvent(button, Lang.bind(this, this._favEnterEvent, button));
                button.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button));

                ++j;
            }
        }

        if (launchers.length !== 0 && this.pref_system_buttons_display === 1) {
            /**
             * Note to myself: Do not dare to use anything other than a PopupSeparatorMenuItem.
             * Otherwise, a lot of things can break. Keyboard navigation for one.
             * It isn't that limited. The height can be changed and the line can be removed.
             */
            let favSeparator = new PopupMenu.PopupSeparatorMenuItem();

            if (this.pref_separator_heigth !== 0) {
                favSeparator.actor.set_height(this.pref_separator_heigth);
                favSeparator._drawingArea.hide();
            }

            this.favoritesBox.add(favSeparator.actor);
        }

        if (this.pref_system_buttons_display === 1) {
            if (this.pref_show_lock_button) { // Lock screen
                let button1 = new $.SystemButton(this, "system-lock-screen", launchers.length + 3,
                    // NOTE: This string could be left blank because it's a default string,
                    // so it's already translated by Cinnamon. It's up to the translators.
                    _("Lock screen"),
                    // NOTE: This string could be left blank because it's a default string,
                    // so it's already translated by Cinnamon. It's up to the translators.
                    _("Lock the screen"));

                this._addEnterEvent(button1,
                    Lang.bind(this, this._favEnterEvent, button1, "system-lock-screen"));
                button1.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button1));

                button1.activate = Lang.bind(this, function() {
                    this.menu.close(this.pref_animate_menu);

                    let screensaver_settings = new Gio.Settings({
                        schema_id: "org.cinnamon.desktop.screensaver"
                    });
                    let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
                    if (screensaver_dialog.query_exists(null)) {
                        if (screensaver_settings.get_boolean("ask-for-away-message")) {
                            Util.spawnCommandLine("cinnamon-screensaver-lock-dialog");
                        } else {
                            Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                        }
                    } else {
                        this._screenSaverProxy.LockRemote("");
                    }
                });

                this.favoritesBox.add_actor(button1.actor);
            }

            if (this.pref_show_logout_button) { // Logout button
                let button2 = new $.SystemButton(this, "system-log-out", launchers.length + 3,
                    // NOTE: This string could be left blank because it's a default string,
                    // so it's already translated by Cinnamon. It's up to the translators.
                    _("Logout"),
                    // NOTE: This string could be left blank because it's a default string,
                    // so it's already translated by Cinnamon. It's up to the translators.
                    _("Leave the session"));

                this._addEnterEvent(button2,
                    Lang.bind(this, this._favEnterEvent, button2, "system-log-out"));
                button2.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button2));

                button2.activate = Lang.bind(this, function() {
                    this.menu.close(this.pref_animate_menu);
                    this._session.LogoutRemote(0);
                });

                this.favoritesBox.add_actor(button2.actor);
            }

            if (this.pref_show_shutdown_button) { // Shutdown button
                let button3 = new $.SystemButton(this, "system-shutdown", launchers.length + 3,
                    // NOTE: This string could be left blank because it's a default string,
                    // so it's already translated by Cinnamon. It's up to the translators.
                    _("Quit"),
                    // NOTE: This string could be left blank because it's a default string,
                    // so it's already translated by Cinnamon. It's up to the translators.
                    _("Shutdown the computer"));

                this._addEnterEvent(button3,
                    Lang.bind(this, this._favEnterEvent, button3, "system-shutdown"));
                button3.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button3));

                button3.activate = Lang.bind(this, function() {
                    this.menu.close(this.pref_animate_menu);
                    this._session.ShutdownRemote();
                });

                this.favoritesBox.add_actor(button3.actor);
            }
        }

        this._recalc_height();
    },

    _loadCategory: function(dir, top_dir) {
        let iter = dir.iter();
        let has_entries = false;
        let nextType;

        if (!top_dir)
            top_dir = dir;

        while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
            if (nextType == CMenu.TreeItemType.ENTRY) {
                let entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    has_entries = true;

                    let app = appsys.lookup_app_by_tree_entry(entry);
                    if (!app)
                        app = appsys.lookup_settings_app_by_tree_entry(entry);
                    let app_key = app.get_id();

                    if (app_key === null) {
                        app_key = app.get_name() + ":" +
                            app.get_description();
                    }
                    if (!(app_key in this._applicationsButtonFromApp)) {

                        let applicationButton = new $.ApplicationButton(this, app, this.pref_display_application_icons);

                        if (!this.pref_disable_new_apps_highlighting) {
                            let app_is_known = false;
                            let i = 0,
                                iLen = this._knownApps.length;
                            for (; i < iLen; i++) {
                                if (this._knownApps[i] == app_key) {
                                    app_is_known = true;
                                }
                            }
                            if (!app_is_known) {
                                if (this._appsWereRefreshed) {
                                    applicationButton.highlight();
                                } else {
                                    this._knownApps.push(app_key);
                                }
                            }
                        }

                        applicationButton.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, applicationButton));
                        this._addEnterEvent(applicationButton, Lang.bind(this, this._appEnterEvent, applicationButton));
                        this._applicationsButtons.push(applicationButton);
                        applicationButton.category.push(top_dir.get_menu_id());
                        this._applicationsButtonFromApp[app_key] = applicationButton;
                    } else {
                        this._applicationsButtonFromApp[app_key].category.push(dir.get_menu_id());
                    }
                }
            } else if (nextType == CMenu.TreeItemType.DIRECTORY) {
                let subdir = iter.get_directory();
                if (this._loadCategory(subdir, top_dir)) {
                    has_entries = true;
                }
            }
        }
        return has_entries;
    },

    _appLeaveEvent: function(a, b, applicationButton) {
        this._previousSelectedActor = applicationButton.actor;
        applicationButton.actor.style_class = "menu-application-button";
        this.setSelectedItemTitleAndDescription(applicationButton, "", "");

        if (this._useHoverFeedback)
            this.userPicture.refreshFace();
    },

    _appEnterEvent: function(applicationButton) {
        this.setSelectedItemTitleAndDescription(applicationButton,
            applicationButton.app.get_name(),
            applicationButton.app.get_description() || "");
        this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(applicationButton.actor);
        this._clearPrevSelection(applicationButton.actor);
        applicationButton.actor.style_class = "menu-application-button-selected";

        if (this._useHoverFeedback)
            this.userPicture.refreshApp(applicationButton.app);
    },

    // Created a new exclusive function to avoid adding a condition to _appEnterEvent.
    _customLauncherEnterEvent: function(applicationButton) {
        this.setSelectedItemTitleAndDescription(applicationButton,
            applicationButton.app.label,
            applicationButton.app.description || "");
        this._previousVisibleIndex = this.myCustomLaunchersBoxIter.getVisibleIndex(applicationButton.actor);
        this._clearPrevSelection(applicationButton.actor);
        applicationButton.actor.style_class = "menu-application-button-selected";
    },

    _scrollToButton: function(button) {
        let current_scroll_value = this.applicationsScrollBox.get_vscroll_bar().get_adjustment().get_value();
        let box_height = this.applicationsScrollBox.get_allocation_box().y2 -
            this.applicationsScrollBox.get_allocation_box().y1;
        let new_scroll_value = current_scroll_value;

        if (current_scroll_value > button.actor.get_allocation_box().y1 - 10)
            new_scroll_value = button.actor.get_allocation_box().y1 - 10;

        if (box_height + current_scroll_value < button.actor.get_allocation_box().y2 + 10)
            new_scroll_value = button.actor.get_allocation_box().y2 - box_height + 10;

        if (new_scroll_value != current_scroll_value)
            this.applicationsScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },

    _updateMenuLayout: function() {
        let menuLayout = [
            this.pref_menu_layout_first_place,
            this.pref_menu_layout_second_place,
            this.pref_menu_layout_third_place,
            this.pref_menu_layout_fourth_place,
        ];

        // Remove duplicates
        this._menuLayout = menuLayout.filter(function(item, index, inputArray) {
            return inputArray.indexOf(item) == index;
        });

        // If at least one of the elements on this._menuLayout isn't
        // categoriesApplicationsBox, push it at the begening.
        if (this._menuLayout.indexOf("categoriesApplicationsBox") === -1) {
            this._menuLayout.unshift("categoriesApplicationsBox");
        }
    },

    _display: function() {
        this._activeContainer = null;
        this._activeActor = null;
        this.vectorBox = null;
        this.actor_motion_id = 0;
        this.vector_update_loop = null;
        this.current_motion_actor = null;
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);

        this.leftPane = new St.BoxLayout({
            vertical: true
        });

        this.leftBox = new St.BoxLayout({
            style_class: 'menu-favorites-box',
            vertical: true
        });

        if (this.pref_display_fav_box) {
            this.leftPane.add_actor(this.leftBox);
        }

        this.rightPane = new St.BoxLayout({
            vertical: true
        });

        /**
         * START mark Odyseus
         * Moved the selectedAppBox creation up here to allow me to insert it erlier in the this.rightPane.
         */
        let searchBoxContainer;

        if (this.pref_custom_commands_box_placement === 0)
            searchBoxContainer = this.rightPane;
        else {
            searchBoxContainer = new St.BoxLayout({
                vertical: false
            });
        }

        if (this.pref_appinfo_display_method === "infobox") {
            if (this.pref_user_picture_placement !== 0) {
                this.userPicture = new $.UserPicture(this, this.pref_user_picture_size);
                this.userPictureObj = {
                    y_fill: false,
                    x_fill: false,
                    x_align: St.Align.START,
                    y_align: St.Align.START,
                    expand: false
                };
            }

            this.selectedAppBoxContainer = new St.BoxLayout({
                vertical: false
            });

            this.selectedAppBox = new St.BoxLayout({
                style_class: 'menu-selected-app-box',
                vertical: true
            });

            if (this.pref_user_picture_placement === 1) { // Left of app info
                this.selectedAppBoxContainer.add(this.userPicture.container, this.userPictureObj);
            }

            this.selectedAppBoxContainer.add(this.selectedAppBox, {
                y_fill: false,
                x_fill: true,
                x_align: St.Align.START,
                y_align: St.Align.MIDDLE,
                expand: true
            });

            if (this.pref_user_picture_placement === 2) { // Right of app info
                this.selectedAppBoxContainer.add(this.userPicture.container, this.userPictureObj);
            }

            let selectedAppBoxStyle = this.pref_apps_info_box_alignment_to_the_left ?
                "text-align: left;" :
                "text-align: right;";

            if (this.pref_set_info_box_padding) {
                let paddingStyle = "padding-top: 0px;" +
                    "padding-right: " + this.pref_info_box_padding_right + "px;" +
                    "padding-bottom: 0px;" +
                    "padding-left: " + this.pref_info_box_padding_left + "px;";
                selectedAppBoxStyle = selectedAppBoxStyle + paddingStyle;
                this.selectedAppBoxContainer.set_style(paddingStyle);
            }

            this.selectedAppBox.set_style(selectedAppBoxStyle);

            if (this.selectedAppBox.peek_theme_node() === null ||
                this.selectedAppBox.get_theme_node().get_length('height') === 0)
                this.selectedAppBox.set_height(30 * global.ui_scale);

            this.selectedAppTitle = new St.Label({
                style_class: 'menu-selected-app-title',
                text: ""
            });
            this.selectedAppTitle.set_style("font-size:" +
                this.pref_info_box_title_font_size + "em;width:100%;");
            this.selectedAppBox.add_actor(this.selectedAppTitle);
            this.selectedAppDescription = new St.Label({
                style_class: 'menu-selected-app-description',
                text: ""
            });
            this.selectedAppDescription.set_style("font-size:" +
                this.pref_info_box_description_font_size + "em;width:100%;");
            this.selectedAppBox.add_actor(this.selectedAppDescription);
        }

        this.myCustomLaunchersBox = null;

        if (this._menuLayout.indexOf("myCustomLaunchersBox") !== -1 ||
            (this._menuLayout.indexOf("searchBox") !== -1 &&
                this.pref_custom_commands_box_placement !== 0)) {
            this.myCustomLaunchersBox = new St.BoxLayout({
                vertical: false,
                accessible_role: Atk.Role.LIST
            });
            this.myCustomLaunchersBox.set_width(-1);
            if (this.pref_set_custom_box_padding) {
                this.myCustomLaunchersBox.set_style("padding-top: " + this.pref_custom_command_box_padding_top +
                    "px; padding-right: " + this.pref_custom_command_box_padding_right +
                    "px; padding-bottom: " + this.pref_custom_command_box_padding_bottom +
                    "px; padding-left: " + this.pref_custom_command_box_padding_left + "px;");
            }
        }

        if (this._menuLayout.indexOf("searchBox") !== -1) {
            this.searchBox = new St.BoxLayout({
                style_class: 'menu-search-box'
            });
        }

        /**
         * START mark Odyseus
         */
        if (this._menuLayout.indexOf("searchBox") !== -1) {
            this._searchInactiveIcon = new St.Icon({
                style_class: 'menu-search-entry-icon',
                icon_name: 'edit-find',
                icon_type: St.IconType.SYMBOLIC
            });
            this._searchActiveIcon = new St.Icon({
                style_class: 'menu-search-entry-icon',
                icon_name: 'edit-clear',
                icon_type: St.IconType.SYMBOLIC
            });
            this.searchEntry = new St.Entry({
                name: 'menu-search-entry',
                // NOTE: This string could be left blank because it's a default string,
                // so it's already translated by Cinnamon. It's up to the translators.
                hint_text: _("Type to search..."),
                track_hover: true,
                can_focus: true
            });

            /**
             * START mark Odyseus
             */
            if (this.pref_set_search_entry_padding) {
                this.searchEntry.set_style("padding-top: " + this.pref_search_entry_padding_top +
                    "px; padding-right: " + this.pref_search_entry_padding_right +
                    "px; padding-bottom: " + this.pref_search_entry_padding_bottom +
                    "px; padding-left: " + this.pref_search_entry_padding_left + "px;");
            }

            if (this.pref_set_search_box_padding) {
                this.searchBox.set_style("padding-top: " + this.pref_search_box_padding_top +
                    "px; padding-right: " + this.pref_search_box_padding_right +
                    "px; padding-bottom: " + this.pref_search_box_padding_bottom +
                    "px; padding-left: " + this.pref_search_box_padding_left + "px;");
            }
            /**
             * END
             */

            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);

            this.searchBox.add(this.searchEntry, {
                x_fill: true,
                x_align: St.Align.START,
                y_align: St.Align.MIDDLE,
                y_fill: false,
                expand: true
            });
            this.searchActive = false;
            this.searchEntryText = this.searchEntry.clutter_text;
            this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
            this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
            this._previousSearchPattern = "";

            if (!this.pref_autofit_searchbox_width) {
                if (this.pref_custom_width_for_searchbox === 0) {
                    this.searchEntry.set_width(-1);
                } else {
                    this.searchEntry.set_width(this.pref_custom_width_for_searchbox);
                }
            }
        }
        /**
         * END
         */

        this.categoriesApplicationsBox = new $.CategoriesApplicationsBox();
        this.categoriesBox = new St.BoxLayout({
            style_class: 'menu-categories-box',
            vertical: true,
            accessible_role: Atk.Role.LIST
        });
        /**
         * START mark Odyseus
         */
        if (this.pref_set_categories_padding) {
            this.categoriesBox.set_style("padding-top: " + this.pref_categories_box_padding_top +
                "px; padding-right: " + this.pref_categories_box_padding_right +
                "px; padding-bottom: " + this.pref_categories_box_padding_bottom +
                "px; padding-left: " + this.pref_categories_box_padding_left + "px;");
        }
        /**
         * END
         */
        this.applicationsScrollBox = new St.ScrollView({
            x_fill: true,
            y_fill: false,
            y_align: St.Align.START,
            style_class: 'vfade menu-applications-scrollbox'
        });

        /**
         * START mark Odyseus
         * Note to myself: I don't know why I chose to use set_opacity instead of show/hide
         * in the first try. But I like show/hide better.
         */
        if (this.pref_hide_applications_list_scrollbar) {
            this.applicationsScrollBox.get_vscroll_bar().hide();
        } else {
            this.applicationsScrollBox.get_vscroll_bar().show();
        }
        /**
         * END
         */

        this.a11y_settings = new Gio.Settings({
            schema_id: "org.cinnamon.desktop.a11y.applications"
        });
        this.a11y_settings.connect("changed::screen-magnifier-enabled", Lang.bind(this, this._updateVFade));
        this.a11y_mag_settings = new Gio.Settings({
            schema_id: "org.cinnamon.desktop.a11y.magnifier"
        });
        this.a11y_mag_settings.connect("changed::mag-factor", Lang.bind(this, this._updateVFade));

        this._updateVFade();

        this._update_autoscroll();

        let vscroll = this.applicationsScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start',
            Lang.bind(this, function() {
                this.menu.passEvents = true;
            }));
        vscroll.connect('scroll-stop',
            Lang.bind(this, function() {
                this.menu.passEvents = false;
            }));

        this.applicationsBox = new St.BoxLayout({
            style_class: 'menu-applications-inner-box',
            vertical: true
        });

        this.applicationsBox.add_style_class_name('menu-applications-box'); //this is to support old themes
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        if (!this.pref_swap_categories_box)
            this.categoriesApplicationsBox.actor.add_actor(this.categoriesBox);

        this.categoriesApplicationsBox.actor.add_actor(this.applicationsScrollBox);

        if (this.pref_swap_categories_box)
            this.categoriesApplicationsBox.actor.add_actor(this.categoriesBox);

        let fav_obj = new $.FavoritesBox();
        this.favoritesBox = fav_obj.actor;
        this.leftBox.add_actor(this.favoritesBox);

        this.mainBox = new St.BoxLayout({
            style_class: 'menu-applications-outer-box',
            vertical: false
        });
        this.mainBox.add_style_class_name('menu-applications-box'); //this is to support old themes

        this.mainBox.add_actor(this.leftPane);
        this.mainBox.add_actor(this.rightPane);

        section.actor.add_actor(this.mainBox);

        this.appBoxIter = new $.VisibleChildIterator(this.applicationsBox);
        this.applicationsBox._vis_iter = this.appBoxIter;
        this.catBoxIter = new $.VisibleChildIterator(this.categoriesBox);
        this.categoriesBox._vis_iter = this.catBoxIter;
        this.favBoxIter = new $.VisibleChildIterator(this.favoritesBox);
        this.favoritesBox._vis_iter = this.favBoxIter;

        Mainloop.idle_add(Lang.bind(this, function() {
            this._clearAllSelections(true);
        }));

        /**
         * START mark Odyseus
         * Start elements insertion
         */
        let customLaunchersBoxAlignment;
        switch (this.pref_custom_commands_box_alignment) {
            case 0:
                customLaunchersBoxAlignment = St.Align.START;
                break;
            case 1:
                customLaunchersBoxAlignment = St.Align.MIDDLE;
                break;
            case 2:
                customLaunchersBoxAlignment = St.Align.END;
                break;
        }

        /**
         * Note to myself: x_align values
         * St.Align.START = 0
         * St.Align.MIDDLE = 1
         * St.Align.END = 2
         */
        let customLaunchersBoxProperties = {
            x_fill: false,
            y_fill: false,
            x_align: this.pref_custom_commands_box_alignment,
            y_align: St.Align.MIDDLE,
            expand: true
        };

        let insertCatAppBox = Lang.bind(this, function() {
            this.rightPane.add(this.categoriesApplicationsBox.actor);
        });

        let insertSearchBox = Lang.bind(this, function() {
            if (this.rightPane === searchBoxContainer) {
                this.rightPane.add(this.searchBox);
            } else {
                this.rightPane.add(searchBoxContainer);
                switch (this.pref_custom_commands_box_placement) {
                    case 1: // Launchers box placed left of search box
                        searchBoxContainer.add(this.myCustomLaunchersBox, customLaunchersBoxProperties);
                        searchBoxContainer.add(this.searchBox);
                        break;
                    case 2: // Launchers box placed right of search box
                        searchBoxContainer.add(this.searchBox);
                        searchBoxContainer.add(this.myCustomLaunchersBox, customLaunchersBoxProperties);
                        break;
                    default: // Launchers box placed on its own or not placed
                        searchBoxContainer.add(this.searchBox);
                        break;
                }
            }
        });

        let insertInfoBox = Lang.bind(this, function() {
            if (this.pref_appinfo_display_method === "infobox")
                this.rightPane.add(this.selectedAppBoxContainer, {
                    y_fill: true,
                    x_fill: true,
                    x_align: St.Align.START,
                    y_align: St.Align.MIDDLE,
                    expand: true
                });
        });

        let l = 0,
            lLen = this._menuLayout.length;
        for (; l < lLen; l++) {
            /**
             * Note to myself: Luckily, the breaks inside the switch will break the
             * switch, but not the for...loop.
             */
            switch (this._menuLayout[l]) {
                case "categoriesApplicationsBox":
                    insertCatAppBox();
                    break;
                case "selectedAppBox":
                    if (this.pref_appinfo_display_method === "infobox")
                        insertInfoBox();
                    break;
                case "myCustomLaunchersBox":
                    if (this.pref_custom_commands_box_placement === 0) // On its own
                        this.rightPane.add(this.myCustomLaunchersBox, customLaunchersBoxProperties);
                    break;
                case "searchBox":
                    insertSearchBox();
                    break;
            }
        }
        /**
         * END
         */

        this._updateCustomLaunchersBox();
    },

    /**
     * START mark Odyseus
     */
    _updateCustomLaunchersBox: function() {
        if (this.myCustomLaunchersBox !== null)
            this.myCustomLaunchersBox.destroy_all_children();

        if (this.myCustomLaunchersBox === null || this._refreshCustomCommandsTimeout !== null)
            return;

        this._refreshCustomCommandsTimeout = Mainloop.timeout_add(1000, Lang.bind(this, function() {
            this._refreshCustomCommandsTimeout = null;
        }));

        this.myCustomLaunchersBoxIter = new $.VisibleChildIterator(this.myCustomLaunchersBox);
        this.myCustomLaunchersBox._vis_iter = this.myCustomLaunchersBoxIter;

        let count = 10;
        let base = "pref_command_";
        let lbl, cmd, icn, desc;

        for (let i = count - 1; i > 0; --i) {
            lbl = this[base + i + "_label"],
                cmd = this[base + i + "_command"],
                icn = this[base + i + "_icon"],
                desc = this[base + i + "_description"];

            if (cmd === "" || icn === "")
                continue;

            let app = {
                command: cmd,
                description: desc,
                label: lbl,
                icon: icn,
                icon_size: this.pref_custom_command_icon_size
            };
            if (app) {
                let button = new $.MyCustomCommandButton(this, app, null);
                button.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button));
                this._addEnterEvent(button, Lang.bind(this, this._customLauncherEnterEvent, button));
                this.myCustomLaunchersBox.add_actor(button.actor);
            }
        }

        if (this.pref_system_buttons_display === 2)
            this._insertCustomSystemButtons();
    },
    /**
     * END
     */

    /**
     * START mark Odyseus
     */
    _insertCustomSystemButtons: function() {
        let self = this;
        if (this.pref_show_lock_button) { // Lock screen
            let button1 = new $.MyCustomCommandButton(this, {
                command: null,
                description: _("Lock the screen"),
                label: _("Lock screen"),
                icon: (this.pref_lock_button_custom_icon === "" ?
                    "system-lock-screen" :
                    this.pref_lock_button_custom_icon),
                icon_size: this.pref_custom_command_icon_size
            }, Lang.bind(self, function() {
                this.menu.close(this.pref_animate_menu);

                let screensaver_settings = new Gio.Settings({
                    schema_id: "org.cinnamon.desktop.screensaver"
                });
                let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
                if (screensaver_dialog.query_exists(null)) {
                    if (screensaver_settings.get_boolean("ask-for-away-message")) {
                        Util.spawnCommandLine("cinnamon-screensaver-lock-dialog");
                    } else {
                        Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    }
                } else {
                    this._screenSaverProxy.LockRemote("");
                }
            }));
            button1.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button1));
            this._addEnterEvent(button1, Lang.bind(this, this._customLauncherEnterEvent, button1));
            this.myCustomLaunchersBox.add_actor(button1.actor);
        }

        if (this.pref_show_logout_button) { // Logout button
            let button2 = new $.MyCustomCommandButton(this, {
                command: null,
                description: _("Leave the session"),
                label: _("Logout"),
                icon: (this.pref_logout_button_custom_icon === "" ?
                    "system-lock-screen" :
                    this.pref_logout_button_custom_icon),
                icon_size: this.pref_custom_command_icon_size
            }, Lang.bind(self, function() {
                this.menu.close(this.pref_animate_menu);
                this._session.LogoutRemote(0);
            }));
            button2.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button2));
            this._addEnterEvent(button2, Lang.bind(this, this._customLauncherEnterEvent, button2));
            this.myCustomLaunchersBox.add_actor(button2.actor);
        }

        if (this.pref_show_shutdown_button) { // Shutdown button
            let button3 = new $.MyCustomCommandButton(this, {
                command: null,
                description: _("Shutdown the computer"),
                label: _("Quit"),
                icon: (this.pref_shutdown_button_custom_icon === "" ?
                    "system-lock-screen" :
                    this.pref_shutdown_button_custom_icon),
                icon_size: this.pref_custom_command_icon_size
            }, Lang.bind(self, function() {
                this.menu.close(this.pref_animate_menu);
                this._session.ShutdownRemote();
            }));
            button3.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button3));
            this._addEnterEvent(button3, Lang.bind(this, this._customLauncherEnterEvent, button3));
            this.myCustomLaunchersBox.add_actor(button3.actor);
        }
    },

    _expand_applet_context_menu: function() {
        // NOTE: This string could be left blank because it's a default string,
        // so it's already translated by Cinnamon. It's up to the translators.
        let menuItem = new PopupMenu.PopupIconMenuItem(_("Open the menu editor"),
            "text-editor", St.IconType.SYMBOLIC);
        menuItem.connect("activate", Lang.bind(this, this._launch_editor));
        this._applet_context_menu.addMenuItem(menuItem);

        menuItem = new PopupMenu.PopupIconMenuItem(_("Help"),
            "dialog-information", St.IconType.SYMBOLIC);
        menuItem.connect("activate", Lang.bind(this, function() {
            Util.spawn_async(["xdg-open", this.applet_dir + "/HELP.html"], null);
        }));
        this._applet_context_menu.addMenuItem(menuItem);
    },
    /**
     * END
     */

    _updateVFade: function() {
        let mag_on = this.a11y_settings.get_boolean("screen-magnifier-enabled") &&
            this.a11y_mag_settings.get_double("mag-factor") > 1.0;
        if (mag_on) {
            this.applicationsScrollBox.style_class = "menu-applications-scrollbox";
        } else {
            this.applicationsScrollBox.style_class = "vfade menu-applications-scrollbox";
        }
    },

    _update_autoscroll: function() {
        this.applicationsScrollBox.set_auto_scrolling(this.pref_enable_autoscroll);
    },

    _clearAllSelections: function(hide_apps) {
        let actors1 = this.applicationsBox.get_children();
        let a = 0,
            aLen = actors1.length;
        for (; a < aLen; a++) {
            let actor = actors1[a];
            actor.style_class = "menu-application-button";
            if (hide_apps) {
                actor.hide();
            }
        }
        let actors2 = this.categoriesBox.get_children();
        let b = 0,
            bLen = actors2.length;
        for (; b < bLen; b++) {
            let actor = actors2[b];
            actor.style_class = "menu-category-button";
            actor.show();
        }

        if (this.pref_display_fav_box) {
            let actors3 = this.favoritesBox.get_children();
            let c = 0,
                cLen = actors3.length;
            for (; c < cLen; c++) {
                let actor = actors3[c];
                actor.remove_style_pseudo_class("hover");
                actor.show();
            }
        }

        if (this.myCustomLaunchersBox !== null) {
            let actors4 = this.myCustomLaunchersBox.get_children();
            let d = 0,
                dLen = actors4.length;
            for (; d < dLen; d++) {
                let actor = actors4[d];
                actor.style_class = "menu-category-button";
                actor.show();
            }
        }
    },

    _select_category: function(name) {
        if (name === this.lastSelectedCategory) {
            return;
        }

        this.lastSelectedCategory = name;

        if (name) {
            if (name === "favorites") {
                this._displayButtons(name);
            } else if (name === "recentApps") {
                this._displayButtons(name, null, null, null, null, true);
            } else if (name === "places") {
                this._displayButtons(null, -1);
            } else if (name === "recent") {
                this._displayButtons(null, null, -1);
            } else {
                this._displayButtons(this._listApplications(name));
            }
        } else {
            this._displayButtons(this._listApplications(null));
        }

        this.closeContextMenus(null, false);
    },

    closeContextMenus: function(excluded, animate) {
        for (let app in this._applicationsButtons) {
            if (app != excluded && this._applicationsButtons[app].menu.isOpen) {
                if (animate)
                    this._applicationsButtons[app].toggleMenu();
                else
                    this._applicationsButtons[app].closeMenu();
            }
        }

        for (let recent in this._recentButtons) {
            if (recent != excluded && this._recentButtons[recent].menu.isOpen) {
                if (animate)
                    this._recentButtons[recent].toggleMenu();
                else
                    this._recentButtons[recent].closeMenu();
            }
        }

        /**
         * START mark Odyseus
         * Close all recent apps context menus when switching categories.
         */
        for (let recentApp in this._recentAppsButtons) {
            if (recentApp != excluded && this._recentAppsButtons[recentApp].menu.isOpen) {
                if (animate)
                    this._recentAppsButtons[recentApp].toggleMenu();
                else
                    this._recentAppsButtons[recentApp].closeMenu();
            }
        }
        /**
         * END
         */
    },

    _resize_actor_iter: function(actor) {
        let [min, nat] = actor.get_preferred_width(-1.0); // jshint ignore:line
        if (nat > this._applicationsBoxWidth) {
            this._applicationsBoxWidth = nat;
            this.applicationsBox.set_width(this._applicationsBoxWidth + 42); // The answer to life...
        }
    },

    _resizeApplicationsBox: function() {
        this._applicationsBoxWidth = 0;
        this.applicationsBox.set_width(-1);
        let child = this.applicationsBox.get_first_child();
        this._resize_actor_iter(child);

        while ((child = child.get_next_sibling()) !== null) {
            this._resize_actor_iter(child);
        }
    },

    _displayButtons: function(appCategory, places, recent, apps, autocompletes, recentApps) {
        if (appCategory) {
            if (appCategory == "all") {
                this._applicationsButtons.forEach(function(item, index) { // jshint ignore:line
                    item.actor.show();
                });
                /**
                 * START mark Odyseus
                 */
            } else if (appCategory === "favorites") {
                this._applicationsButtons.forEach(function(item, index) { // jshint ignore:line
                    if (AppFavorites.getAppFavorites().isFavorite(item.app.get_id())) {
                        item.actor.show();
                    } else {
                        item.actor.hide();
                    }
                });
            } else {
                /**
                 * END
                 */
                this._applicationsButtons.forEach(function(item, index) { // jshint ignore:line
                    if (item.category.indexOf(appCategory) != -1) {
                        item.actor.show();
                    } else {
                        item.actor.hide();
                    }
                });
            }
        } else if (apps) {
            let i = 0,
                iLen = this._applicationsButtons.length;
            for (; i < iLen; i++) {
                /**
                 * START mark Odyseus
                 */
                // From Sane menu
                if (apps.indexOf(this._applicationsButtons[i].app.get_id()) != -1) {
                    if (this.pref_fuzzy_search_enabled && !appCategory) {
                        this.applicationsBox.add_actor(this._applicationsButtons[i].actor);
                        this.applicationsBox.add_actor(this._applicationsButtons[i].menu.actor);
                    } else
                        this._applicationsButtons[i].actor.show();
                } else {
                    this.pref_fuzzy_search_enabled || this._applicationsButtons[i].actor.hide();
                }
                /**
                 * END
                 */
            }
        } else {
            this._applicationsButtons.forEach(function(item, index) { // jshint ignore:line
                item.actor.hide();
            });
        }
        if (places) {
            if (places == -1) {
                this._placesButtons.forEach(function(item, index) { // jshint ignore:line
                    item.actor.show();
                });
            } else {
                let i = 0,
                    iLen = this._placesButtons.length;
                for (; i < iLen; i++) {
                    if (places.indexOf(this._placesButtons[i].button_name) != -1) {
                        this._placesButtons[i].actor.show();
                    } else {
                        this._placesButtons[i].actor.hide();
                    }
                }
            }
        } else {
            this._placesButtons.forEach(function(item, index) { // jshint ignore:line
                item.actor.hide();
            });
        }
        if (recent) {
            if (recent == -1) {
                this._recentButtons.forEach(function(item, index) { // jshint ignore:line
                    item.actor.show();
                });
            } else {
                let i = 0,
                    iLen = this._recentButtons.length;
                for (; i < iLen; i++) {
                    if (recent.indexOf(this._recentButtons[i].button_name) != -1) {
                        this._recentButtons[i].actor.show();
                    } else {
                        this._recentButtons[i].actor.hide();
                    }
                }
            }
        } else {
            this._recentButtons.forEach(function(item, index) { // jshint ignore:line
                item.actor.hide();
            });
        }
        if (recentApps) {
            this._recentAppsButtons.forEach(function(item, index) { // jshint ignore:line
                item.actor.show();
            });
        } else {
            this._recentAppsButtons.forEach(function(item, index) { // jshint ignore:line
                item.actor.hide();
            });
        }
        if (autocompletes) {

            this._transientButtons.forEach(function(item, index) { // jshint ignore:line
                item.actor.destroy();
            });
            this._transientButtons = [];

            let i = 0,
                iLen = autocompletes.length;
            for (; i < iLen; i++) {
                let button = new $.TransientButton(this, autocompletes[i]);
                button.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button));
                this._addEnterEvent(button, Lang.bind(this, this._appEnterEvent, button));
                this._transientButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                button.actor.realize();
            }
        }

        this._searchProviderButtons.forEach(function(item, index) { // jshint ignore:line
            if (item.actor.visible) {
                item.actor.hide();
            }
        });
    },

    _setCategoriesButtonActive: function(active) {
        try {
            let categoriesButtons = this.categoriesBox.get_children();
            for (let i in categoriesButtons) {
                let button = categoriesButtons[i];
                if (active) {
                    button.set_style_class_name("menu-category-button");
                } else {
                    button.set_style_class_name("menu-category-button-greyed");
                }
            }
        } catch (e) {
            global.log(e);
        }
    },

    resetSearch: function() {
        this.searchEntry.set_text("");
        this._previousSearchPattern = "";
        this.searchActive = false;
        this._clearAllSelections(true);
        this._setCategoriesButtonActive(true);
        global.stage.set_key_focus(this.searchEntry);
    },

    _onSearchTextChanged: function(se, prop) { // jshint ignore:line
        if (this.menuIsOpening) {
            this.menuIsOpening = false;
            return;
        } else {
            let searchString = this.searchEntry.get_text();

            if (searchString === '' && !this.searchActive)
                return;

            this._fileFolderAccessActive = this.searchActive && this.pref_search_filesystem;
            this._clearAllSelections(false);
            this.searchActive = searchString !== '';

            if (this.searchActive) {
                this.searchEntry.set_secondary_icon(this._searchActiveIcon);
                if (this._searchIconClickedId === 0) {
                    this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked',
                        Lang.bind(this, function() {
                            this.resetSearch();
                            /**
                             * START mark Odyseus
                             */
                            this._select_category(this.pref_hide_allapps_category ?
                                this._initialSelectedCategory :
                                null);
                            /**
                             * END
                             */
                        }));
                }
                this._setCategoriesButtonActive(false);
                this._doSearch();
            } else {
                /**
                 * START mark Odyseus
                 */
                // From Sane Menu
                // TODO: Find a better way to restore initial state
                if (this.pref_fuzzy_search_enabled) {
                    this._refreshApps();
                    if (this.pref_show_places)
                        this._refreshPlaces();

                    if (this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY))
                        this._refreshRecent();

                    if (this.pref_remember_recently_used_apps)
                        this._refreshRecentApps();
                }
                /**
                 * END
                 */

                if (this._searchIconClickedId > 0)
                    this.searchEntry.disconnect(this._searchIconClickedId);

                this._searchIconClickedId = 0;
                this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
                this._previousSearchPattern = "";
                this._setCategoriesButtonActive(true);
                /**
                 * START mark Odyseus
                 */
                this._select_category(this.pref_hide_allapps_category ?
                    this._initialSelectedCategory :
                    null);
                /**
                 * END
                 */
                this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
                this._activeContainer = null;
                this.setSelectedItemTitleAndDescription(null, "", "");
            }
            return;
        }
    },

    _listBookmarks: function(pattern) {
        let bookmarks = Main.placesManager.getBookmarks();
        let res = [];
        let id = 0,
            idLen = bookmarks.length;
        for (; id < idLen; id++) {
            if (!pattern || bookmarks[id].name.toLowerCase().indexOf(pattern) != -1)
                res.push(bookmarks[id]);
        }
        return res;
    },

    _listDevices: function(pattern) {
        let devices = Main.placesManager.getMounts();
        let res = [];
        let id = 0,
            idLen = devices.length;
        for (; id < idLen; id++) {
            if (!pattern || devices[id].name.toLowerCase().indexOf(pattern) != -1)
                res.push(devices[id]);
        }
        return res;
    },

    _listApplications: function(category_menu_id, pattern) {
        let applist = [];
        if (category_menu_id) {
            applist = category_menu_id;
        } else {
            applist = "all";
        }
        let res;
        if (pattern) {
            res = [];
            /**
             * START mark Odyseus
             */
            // From Sane Menu
            this._applicationsOrder = {};
            /**
             * END
             */
            for (let i in this._applicationsButtons) {
                let app = this._applicationsButtons[i].app;
                /**
                 * START mark Odyseus
                 */
                // From Sane Menu
                if (this.pref_fuzzy_search_enabled) {
                    let fuzzy = this._fuzzysearch(pattern, Util.latinise(app.get_name().toLowerCase()));
                    if (fuzzy[0]) {
                        res.push(app.get_id());
                        this._applicationsOrder[app.get_id()] = fuzzy[1];
                    }
                } else {
                    if (Util.latinise(app.get_name().toLowerCase()).indexOf(pattern) != -1 ||
                        (app.get_keywords() && Util.latinise(app.get_keywords().toLowerCase()).indexOf(pattern) != -1) ||
                        (app.get_description() && Util.latinise(app.get_description().toLowerCase()).indexOf(pattern) != -1) ||
                        (app.get_id() && Util.latinise(app.get_id().slice(0, -8).toLowerCase()).indexOf(pattern) != -1))
                        res.push(app.get_id());
                }
                /**
                 * END
                 */
            }
        } else
            res = applist;
        return res;
    },

    /**
     * START mark Odyseus
     */
    // From Sane Menu
    _fuzzysort: function(order) {
        return function(a, b) {
            a = a.app.get_id();
            b = b.app.get_id();
            let avalue = order[a] || 99999;
            let bvalue = order[b] || 99999;
            return avalue > bvalue;
        };
    },
    /**
     * END
     */

    /**
     * START mark Odyseus
     */
    // From Sane Menu
    _fuzzysearch: function(needle, haystack) {
        let hlen = haystack.length;
        let nlen = needle.length;
        let OccurrenceAt = 0;
        let previousJ = 0;
        if (nlen > hlen) {
            return [false, 0];
        }
        if (nlen === hlen) {
            return [needle === haystack, -99999];
        }
        outer: for (let i = 0, j = 0; i < nlen; i++) {
            let nch = needle.charCodeAt(i);
            while (j < hlen) {
                if (haystack.charCodeAt(j++) === nch) {
                    if (previousJ === 0) {
                        previousJ = j;
                    } else {
                        if (haystack.charCodeAt(j - 2) == 32 && (previousJ == 1 || haystack.charCodeAt(previousJ - 1) == 32)) {
                            // if every character in search pattern is preceded by a space and matches it should be first result
                            OccurrenceAt -= 100;
                        } else {
                            // otherwise sort result based on the distance between matching characters
                            OccurrenceAt = OccurrenceAt + ((j - previousJ - 1) * 10);
                        }
                        previousJ = j;
                    }

                    OccurrenceAt += j;
                    continue outer;
                }
            }
            return [false, 0];
        }
        return [true, OccurrenceAt];
    },
    /**
     * END
     */

    _doSearch: function() {
        this._searchTimeoutId = 0;
        let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
        pattern = Util.latinise(pattern);

        if (pattern == this._previousSearchPattern)
            return false;

        this._previousSearchPattern = pattern;
        this._activeContainer = null;
        this._activeActor = null;
        this._selectedItemIndex = null;
        this._previousTreeSelectedActor = null;
        this._previousSelectedActor = null;

        // _listApplications returns all the applications when the search
        // string is zero length. This will happened if you type a space
        // in the search entry.
        if (pattern.length === 0) {
            return false;
        }

        let appResults = this._listApplications(null, pattern);
        let placesResults = [];
        let bookmarks = this._listBookmarks(pattern);
        for (let a in bookmarks)
            placesResults.push(bookmarks[a].name);
        let devices = this._listDevices(pattern);
        for (let b in devices)
            placesResults.push(devices[b].name);
        let recentResults = [];
        let c = 0,
            cLen = this._recentButtons.length;
        for (; c < cLen; c++) {
            if (!(this._recentButtons[c] instanceof $.RecentClearButton) &&
                this._recentButtons[c].button_name.toLowerCase().indexOf(pattern) != -1)
                recentResults.push(this._recentButtons[c].button_name);
        }

        let acResults = []; // search box autocompletion results
        if (this.pref_search_filesystem) {
            // Don't use the pattern here, as filesystem is case sensitive
            acResults = this._getCompletions(this.searchEntryText.get_text());
        }

        /**
         * START mark Odyseus
         */
        // From Sane Menu
        // remove all buttons here for sort to have effect
        if (this.pref_fuzzy_search_enabled) {
            this.applicationsBox.remove_all_children();
            this._applicationsButtons = this._applicationsButtons.sort(this._fuzzysort(this._applicationsOrder));
        }
        /**
         * END
         */

        this._displayButtons(null, placesResults, recentResults, appResults, acResults);

        this.appBoxIter.reloadVisible();
        if (this.appBoxIter.getNumVisibleChildren() > 0) {
            let item_actor = this.appBoxIter.getFirstVisible();
            this._selectedItemIndex = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
            this._activeContainer = this.applicationsBox;

            if (item_actor && item_actor != this.searchEntry)
                item_actor._delegate.emit('enter-event');
        } else {
            this.setSelectedItemTitleAndDescription(null, "", "");
        }

        SearchProviderManager.launch_all(pattern, Lang.bind(this, function(provider, results) {
            try {
                for (let i in results) {
                    if (results[i].type != 'software') {
                        let button = new $.SearchProviderResultButton(this, provider, results[i]);
                        button.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button));
                        this._addEnterEvent(button, Lang.bind(this, this._appEnterEvent, button));
                        this._searchProviderButtons.push(button);
                        this.applicationsBox.add_actor(button.actor);
                        button.actor.realize();
                    }
                }
            } catch (e) {
                global.log(e);
            }
        }));

        return false;
    },

    _getCompletion: function(text) {
        if (text.indexOf('/') != -1) {
            if (text.substr(text.length - 1) == '/') {
                return '';
            } else {
                return this._pathCompleter.get_completion_suffix(text);
            }
        } else {
            return false;
        }
    },

    _getCompletions: function(text) {
        if (text.indexOf('/') != -1) {
            return this._pathCompleter.get_completions(text);
        } else {
            return [];
        }
    },

    _run: function(input) {
        this._commandError = false;
        if (input) {
            let path = null;

            if (input.charAt(0) == '/') {
                path = input;
            } else {
                if (input.charAt(0) == '~')
                    input = input.slice(1);
                path = GLib.get_home_dir() + '/' + input;
            }

            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                let file = Gio.file_new_for_path(path);
                try {
                    Gio.app_info_launch_default_for_uri(file.get_uri(),
                        global.create_app_launch_context());
                } catch (e) {
                    // The exception from gjs contains an error string like:
                    //     Error invoking Gio.app_info_launch_default_for_uri: No application
                    //     is registered as handling this file
                    // We are only interested in the part after the first colon.
                    //let message = e.message.replace(/[^:]*: *(.+)/, '$1');
                    return false;
                }
            } else {
                return false;
            }
        }

        return true;
    },

    setSelectedItemTitleAndDescription: function(aEl, aTitle, aDescription) {
        switch (this.pref_appinfo_display_method) {
            case "tooltip":
                if (aEl && aEl.tooltip) {
                    try {
                        aEl.tooltip._tooltip.get_clutter_text().set_markup(
                            (aTitle ?
                                '<span weight="bold">' + aTitle + '</span>' :
                                "") +
                            (aTitle && aDescription ? "\n" : "") +
                            (aDescription ?
                                aDescription :
                                "")
                        );
                    } catch (aErr) {
                        global.logError(aErr);
                        aEl.tooltip._tooltip.set_text(
                            (aTitle ?
                                aTitle :
                                "") +
                            (aTitle && aDescription ? "\n" : "") +
                            (aDescription ?
                                aDescription :
                                "")
                        );
                    }
                }
                break;
            case "infobox":
                this.selectedAppTitle.set_text(aTitle);
                this.selectedAppDescription.set_text(aDescription ? aDescription.split("\n")[0] : "");
                break;
            default:
                return;
        }
    },

    on_applet_removed_from_panel: function() {
        this.settings.finalize();
        Main.keybindingManager.removeHotKey("odyseus-custom-cinnamon-menu-" + this.instance_id);
    }
};

function main(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    let myApplet = new MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id);
    return myApplet;
}
