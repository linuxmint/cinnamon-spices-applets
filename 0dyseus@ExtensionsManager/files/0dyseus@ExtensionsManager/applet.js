const $ = imports.applet.__init__;
const _ = $._;

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Extension = imports.ui.extension;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;

function MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    this._init(aMetadata, aOrientation, aPanel_height, aInstance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(aMetadata, aOrientation, aPanel_height, aInstance_id) {
        Applet.TextIconApplet.prototype._init.call(this, aOrientation, aPanel_height, aInstance_id);

        // Needed for retro-compatibility
        if (Applet.hasOwnProperty("AllowedLayout"))
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            this.settings = new Settings.AppletSettings(this, aMetadata.uuid, aInstance_id);
            this._bind_settings();

            this.metadata = aMetadata;
            this.orientation = aOrientation;

            Gtk.IconTheme.get_default().append_search_path(this.metadata.path + "/icons/");

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.spices_data = null;
            this.spices_file_path = GLib.get_home_dir() + "/.cinnamon/spices.cache/extension/index.json";
            this._buildMenuId = null;
            this._populateSubMenusId = 0;
            this._spicesCacheUpdatedId = null;
            this._forceMenuRebuild = false;
            this._forceMenuRebuildDelay = 200;

            global.settings.connect("changed::enabled-extensions",
                Lang.bind(this, function() {
                    this._forceMenuRebuild = this.menu && !this.menu.isOpen;
                    this._forceMenuRebuildDelay = 1000;
                    this._populateSubMenus();
                }));

            let extSpicesCache = Gio.file_new_for_path(this.spices_file_path);
            this._monitor = extSpicesCache.monitor(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect("changed", Lang.bind(this, this._spices_cache_updated));

            this.set_applet_tooltip(_(aMetadata.name));
            this._expand_applet_context_menu();
            this._updateIconAndLabel();

            if (this.pref_initial_load_done) {
                this._build_menu();
            } else {
                this.store_extension_data();
                this.pref_initial_load_done = true;
            }
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    updateLabelVisibility: function() {
        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (typeof this.hide_applet_label !== "function")
            return;

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
            this.hide_applet_label(true);
        else
            this.hide_applet_label(false);
    },

    on_orientation_changed: function(orientation) {
        this.orientation = orientation;
        this.menu.destroy();
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.connect("open-state-changed", Lang.bind(this, this._onOpenStateChanged));
        this._updateIconAndLabel();
    },

    _expand_applet_context_menu: function() {
        let menuItem = new PopupMenu.PopupIconMenuItem(
            _("Open extensions manager"),
            "extensions-manager-cs-extensions",
            St.IconType.SYMBOLIC);
        menuItem.connect("activate", Lang.bind(this, function() {
            try {
                Util.spawn_async(["cinnamon-settings", "extensions"]);
            } catch (aErr) {
                global.logError(aErr);
            }
        }));
        this._applet_context_menu.addMenuItem(menuItem);

        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Disable all extensions"),
            "edit-delete",
            St.IconType.SYMBOLIC);
        menuItem.connect("activate", Lang.bind(this, function() {
            try {
                new $.ConfirmationDialog(Lang.bind(this, function() {
                        Util.spawn_async(["gsettings", "reset", "org.cinnamon", "enabled-extensions"],
                            Lang.bind(this, this._build_menu));
                    }),
                    "Extensions",
                    _("This will disable all active extensions. Are you sure you want to do this?")).open();
            } catch (aErr) {
                global.logError(aErr);
            }
        }));
        this._applet_context_menu.addMenuItem(menuItem);

        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Refresh extension list"),
            "extensions-manager-refresh-icon",
            St.IconType.SYMBOLIC);
        menuItem.connect("activate", Lang.bind(this, this.store_extension_data));
        this._applet_context_menu.addMenuItem(menuItem);

        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Restart Cinnamon"),
            "extensions-manager-view-refresh",
            St.IconType.SYMBOLIC);
        menuItem.connect("activate", Lang.bind(this, function() {
            global.reexec_self();
        }));
        this._applet_context_menu.addMenuItem(menuItem);
    },

    getEnabledExtensionsUUIDs: function() {
        return global.settings.get_strv("enabled-extensions");
    },

    setEnabledExtensionsUUIDs: function(aExtensionsArray) {
        global.settings.set_strv("enabled-extensions", aExtensionsArray);
    },

    _bind_settings: function() {
        let settingsArray = [
            ["pref_initial_load_done", null],
            ["pref_max_width_for_menu_items_label", this._build_menu],
            ["pref_set_max_menu_height", null],
            ["pref_max_menu_height", null],
            ["pref_enabled_extensions_style", this._update_menu_items_style],
            ["pref_disabled_extensions_style", this._update_menu_items_style],
            ["pref_keep_enabled_extension_menu_open", null],
            ["pref_keep_disabled_extension_menu_open", null],
            ["pref_show_config_button", this._build_menu],
            ["pref_show_spices_button", this._build_menu],
            ["pref_show_open_extension_folder_button", this._build_menu],
            ["pref_show_edit_extension_file_button", this._build_menu],
            ["pref_use_extension_names_as_label", this._build_menu],
            ["pref_keep_only_one_menu_open", null],
            ["pref_extension_icon_size", this._build_menu],
            ["pref_extension_options_icon_size", this._build_menu],
            ["pref_icons_on_menu", this._build_menu],
            ["pref_all_extensions_list", null],
            ["pref_custom_icon_for_applet", this._updateIconAndLabel],
            ["pref_custom_label_for_applet", this._updateIconAndLabel],
        ];
        let bindingDirection = Settings.BindingDirection.BIDIRECTIONAL || null;
        let bindingType = typeof this.settings.bind === "function";
        for (let [property_name, callback] of settingsArray) {
            if (bindingType)
                this.settings.bind(property_name, property_name, callback);
            else
                this.settings.bindProperty(bindingDirection, property_name, property_name, callback, null);
        }
    },

    on_applet_clicked: function() {
        this.menu.toggle(true);
    },

    /**
     * Triggered only by the changes made to the monitored index.json file on Spices cache folder.
     */
    _spices_cache_updated: function(aMonitor, aFileObj, aN, aEventType) {
        if (aEventType && aEventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT) {
            if (this._spicesCacheUpdatedId) {
                Mainloop.source_remove(this._spicesCacheUpdatedId);
                this._spicesCacheUpdatedId = null;
            }

            this._spicesCacheUpdatedId = Mainloop.timeout_add(3000,
                Lang.bind(this, this.store_extension_data));
        }
    },

    /**
     * @param  {String} aResponse Data returned by the appletHelper.py script
     * @return {Nothing}
     */
    store_extension_data: function() {
        try {
            Util.spawn_async(["python2", this.metadata.path + "/appletHelper.py", "--list"],
                Lang.bind(this, function(aResponse) {
                    let extensionData;
                    try {
                        extensionData = JSON.parse(aResponse);
                    } catch (aErr) {
                        extensionData = {};
                    }

                    try {
                        let spicesCacheFile = Gio.file_new_for_path(this.spices_file_path);
                        if (spicesCacheFile.query_exists(null)) {
                            spicesCacheFile.load_contents_async(null,
                                Lang.bind(this, function(aFile, aResponce) {
                                    let rawData;
                                    try {
                                        rawData = aFile.load_contents_finish(aResponce)[1];
                                    } catch (aErr) {
                                        global.logError("ERROR: " + aErr.message);
                                        this.store_spices_data(null, extensionData);
                                        return;
                                    }

                                    this.store_spices_data(rawData, extensionData);
                                }));
                        } else {
                            this.store_spices_data(null, extensionData);
                        }
                    } catch (aErr) {
                        global.logError(aErr);
                    }
                }));
            this._spicesCacheUpdatedId = null;
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    /**
     * Store Spices data to the extensions data.
     * Done from JavaScript to avoid importing the "Spices harvester" in the appletHelper.py script.
     * @param  {String} aResponse Data returned by reading the index.json file on Spices cache folder
     * @return {Nothing}
     */
    store_spices_data: function(aResponse, aExtensionData) {
        let spicesData;
        try {
            spicesData = JSON.parse(aResponse);
        } catch (aErr) {
            spicesData = null;
        }

        let finalExtensionData;
        try {
            finalExtensionData = Object.keys(aExtensionData).map(function(aKey) {
                let extObj = aExtensionData[aKey];
                extObj["spices_id"] = spicesData ?
                    (spicesData[extObj.uuid] ?
                        spicesData[extObj.uuid]["spices-id"] :
                        "") :
                    "";
                return extObj;
            });
        } catch (aErr) {
            global.logError(aErr);
            finalExtensionData = [];
        } finally {
            try {
                if (finalExtensionData.length > 1) {
                    finalExtensionData = finalExtensionData.sort(Lang.bind(this, function(a, b) {
                        if (this.pref_use_extension_names_as_label)
                            return a.name.localeCompare(b.name);
                        return a.uuid.localeCompare(b.uuid);
                    }));
                }
            } finally {
                this.pref_all_extensions_list = finalExtensionData;
                this._build_menu();
            }
        }

    },

    _onOpenStateChanged: function(menu, open) {
        if (this.pref_set_max_menu_height)
            menu.actor.style = ("max-height: " + this.pref_max_menu_height + "px;");

        this._populateSubMenus();
        if (open) {
            this.actor.add_style_pseudo_class("active");
            this.ignore = true;
            if (this.pref_keep_enabled_extension_menu_open)
                this.enabledExtSubmenu.menu.open(false);

            if (this.pref_keep_disabled_extension_menu_open)
                this.disabledExtSubmenu.menu.open(false);
            this.ignore = false;
        } else {
            this.actor.remove_style_pseudo_class("active");
        }
    },

    _build_menu: function() {
        if (this._buildMenuId) {
            Mainloop.source_remove(this._buildMenuId);
            this._buildMenuId = null;
        }

        this._buildMenuId = Mainloop.timeout_add(500, Lang.bind(this, function() {
            if (this.menu) {
                this.menuManager.removeMenu(this.menu);
                this.menu.destroy();
            }

            this.menu = new Applet.AppletPopupMenu(this, this.orientation);
            this.menu.connect("open-state-changed", Lang.bind(this, this._onOpenStateChanged));
            this.menuManager.addMenu(this.menu);

            this._forceMenuRebuild = true;
            this._populateSubMenus();
            this._buildMenuId = null;
        }));
    },

    _populateSubMenus: function() {
        let enabledExtensionsGSetting = this.getEnabledExtensionsUUIDs();

        if (this._populateSubMenusId > 0) {
            Mainloop.source_remove(this._populateSubMenusId);
            this._populateSubMenusId = 0;
        }

        this._populateSubMenusId = Mainloop.timeout_add(this._forceMenuRebuildDelay, Lang.bind(this, function() {
            if (this.pref_all_extensions_list.length === 0) {
                this.menu.removeAll();
                let label = new $.GenericButton(_("There aren't any extensions installed on your system. Or you may need to refresh the list of extensions from this applet context menu."));
                label.label.set_style("text-align: left;max-width: 20em;");
                label.label.get_clutter_text().set_line_wrap(true);
                label.label.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
                label.label.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE; // Just in case
                this.menu.addMenuItem(label);
            }

            if (!this._forceMenuRebuild || this.menu.isOpen) {
                this._populateSubMenusId = 0;
                return;
            }

            if (this.enabledExtSubmenu)
                this.enabledExtSubmenu.destroy();

            if (this.disabledExtSubmenu)
                this.disabledExtSubmenu.destroy();

            this.enabledExtSubmenu = new PopupMenu.PopupSubMenuMenuItem("");
            this.enabledExtSubmenu.menu.connect("open-state-changed",
                Lang.bind(this, this._subMenuOpenStateChanged));
            this.menu.addMenuItem(this.enabledExtSubmenu);

            this.disabledExtSubmenu = new PopupMenu.PopupSubMenuMenuItem("");
            this.disabledExtSubmenu.menu.connect("open-state-changed",
                Lang.bind(this, this._subMenuOpenStateChanged));
            this.menu.addMenuItem(this.disabledExtSubmenu);

            this.enabledExtSubmenu.menu.removeAll();
            this.disabledExtSubmenu.menu.removeAll();
            this._update_menu_items_style();

            let e = 0,
                eCount = 0,
                dCount = 0,
                eLen = this.pref_all_extensions_list.length;

            try {
                for (; e < eLen; e++) {
                    let extObj = this.pref_all_extensions_list[e];
                    let prefix = extObj.version_supported ? "" : "!";
                    extObj.is_enabled = enabledExtensionsGSetting.indexOf(prefix + extObj.uuid) !== -1;

                    let item = null;
                    try {
                        item = new $.CustomSwitchMenuItem(this, extObj);
                    } catch (aErr) {
                        global.logError(aErr);
                    }

                    if (!item)
                        continue;

                    item.connect("toggled", Lang.bind(this, this._toggleExtensionState));

                    if (extObj.is_enabled) {
                        eCount++;
                        this.enabledExtSubmenu.menu.addMenuItem(item);
                    } else {
                        dCount++;
                        this.disabledExtSubmenu.menu.addMenuItem(item);
                    }
                }
            } catch (aErr) {
                global.logError(aErr);
            } finally {
                try {

                    this.enabledExtSubmenu.label.set_text(_("Enabled extensions") + " (" + eCount + ")");
                    let label;
                    if (eCount === 0) {
                        label = new $.GenericButton(_("No enabled extensions"));
                        this.enabledExtSubmenu.menu.addMenuItem(label);
                    }

                    this.disabledExtSubmenu.label.set_text(_("Disabled extensions") + " (" + dCount + ")");
                    if (dCount === 0) {
                        label = new $.GenericButton(_("No disabled extensions"));
                        this.disabledExtSubmenu.menu.addMenuItem(label);
                    }
                } catch (aErr) {
                    global.logError(aErr);
                }
            }

            this._forceMenuRebuild = false;
            this._forceMenuRebuildDelay = 200;
            this._populateSubMenusId = 0;
        }));
    },

    _toggleExtensionState: function(aSwitch) {
        let enabledExtensions = this.getEnabledExtensionsUUIDs();
        let uuid = aSwitch.extension.uuid;

        this._forceMenuRebuild = true;

        switch (aSwitch.state) {
            case true:
                if (aSwitch.extension.version_supported) {
                    Extension.loadExtension(uuid, Extension.Type.EXTENSION);
                    enabledExtensions.push(uuid);
                    this.setEnabledExtensionsUUIDs(enabledExtensions);
                    aSwitch.extension.is_enabled = true;
                } else {
                    new $.ConfirmationDialog(Lang.bind(this, function() {
                            aSwitch.extension.is_enabled = true;
                            Extension.loadExtension("!" + uuid, Extension.Type.EXTENSION);
                            enabledExtensions.push("!" + uuid);
                            this.setEnabledExtensionsUUIDs(enabledExtensions);
                            this._forceMenuRebuild = true;
                            this._populateSubMenus();
                        }),
                        "Extensions",
                        _("Extension %s is not compatible with current version of cinnamon. Using it may break your system. Load anyway?")
                        .format(aSwitch.extension.name)).open();
                }
                break;
            case false:
                if (aSwitch.extension.version_supported) {
                    Extension.unloadExtension(uuid, Extension.Type.EXTENSION);
                    enabledExtensions.splice(enabledExtensions.indexOf(uuid), 1);
                    this.setEnabledExtensionsUUIDs(enabledExtensions);
                } else {
                    Extension.unloadExtension("!" + uuid, Extension.Type.EXTENSION);
                    enabledExtensions.splice(enabledExtensions.indexOf("!" + uuid), 1);
                    this.setEnabledExtensionsUUIDs(enabledExtensions);
                }
                aSwitch.extension.is_enabled = false;
                break;
        }
    },

    _subMenuOpenStateChanged: function(aMenu, aOpen) {
        if (this.ignore || !this.pref_keep_only_one_menu_open)
            return;

        if (aOpen) {
            let children = aMenu._getTopMenu()._getMenuItems();
            let i = 0,
                iLen = children.length;
            for (; i < iLen; i++) {
                let item = children[i];
                if (item instanceof PopupMenu.PopupSubMenuMenuItem) {
                    if (aMenu !== item.menu) {
                        item.menu.close(true);
                    }
                }
            }
        }
    },

    _update_menu_items_style: function() {
        this.enabledExtSubmenu.label.set_style(this.pref_enabled_extensions_style);
        this.disabledExtSubmenu.label.set_style(this.pref_disabled_extensions_style);
    },

    _updateIconAndLabel: function() {
        try {
            if (this.pref_custom_icon_for_applet === "") {
                this.set_applet_icon_name("");
            } else if (GLib.path_is_absolute(this.pref_custom_icon_for_applet) &&
                GLib.file_test(this.pref_custom_icon_for_applet, GLib.FileTest.EXISTS)) {
                if (this.pref_custom_icon_for_applet.search("-symbolic") !== -1)
                    this.set_applet_icon_symbolic_path(this.pref_custom_icon_for_applet);
                else
                    this.set_applet_icon_path(this.pref_custom_icon_for_applet);
            } else if (Gtk.IconTheme.get_default().has_icon(this.pref_custom_icon_for_applet)) {
                if (this.pref_custom_icon_for_applet.search("-symbolic") !== -1)
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
        } catch (aErr) {
            global.logWarning("Could not load icon file \"" + this.pref_custom_icon_for_applet +
                "\" for menu button");
        }

        if (this.pref_custom_icon_for_applet === "")
            this._applet_icon_box.hide();
        else
            this._applet_icon_box.show();

        // No menu label if in a vertical panel
        if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
            this.set_applet_label("");
        } else {
            if (this.pref_custom_label_for_applet !== "")
                this.set_applet_label(_(this.pref_custom_label_for_applet));
            else
                this.set_applet_label("");
        }

        this.updateLabelVisibility();
    },

    on_applet_removed_from_panel: function() {
        this.settings.finalize();
    }
};

function main(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    let myApplet = new MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id);
    return myApplet;
}
