const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;

var prov_label = "";
var prov_url = "";

// l10n
const Gettext = imports.gettext;
const UUID = "search-box@mtwebster";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function SearchBoxApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

SearchBoxApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            this._searchInactiveIcon = new St.Icon({ style_class: "menu-search-entry-icon",
                                               icon_name: "edit-find",
                                               icon_type: St.IconType.SYMBOLIC });
            this._searchActiveIcon = new St.Icon({ style_class: "menu-search-entry-icon",
                                             icon_name: "edit-clear",
                                             icon_type: St.IconType.SYMBOLIC });
            this.searchIcon = new St.Icon({icon_name: "edit-find", icon_size: 24, icon_type: St.IconType.FULLCOLOR});
            this._searchIconClickedId = 0;

            this.settings.bind("show-provider", "show_provider", this._reload);
            this.settings.bind("selected-provider", "selected_provider", this._reload);
            this.already_changed = false;
            this.settings.bind("providers", "providers", this._on_providers_changed);
            this.settings.bind("reset-after-search", "reset_after_search", this._reload);
            this.settings.bind("use-custom-provider", "use_custom_provider");
            this.settings.bind("custom-provider-label", "custom_provider_label");
            this.settings.bind("custom-provider-url", "custom_provider_url");
            this.settings.bind("custom-keybinding", "custom_keybinding", this.on_keybinding_changed);

            this.set_applet_icon_symbolic_name("edit-find-symbolic");
            this._orientation = orientation;

            this.populate_search_engines_menu();
            this.set_applet_tooltip(_("Right-click to select or add your search engine"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, this._orientation);
            this.menuManager.addMenu(this.menu);

            this._searchArea = new St.BoxLayout({name: "searchArea" });

            this.menu.addActor(this._searchArea);

            this.searchBox = new St.BoxLayout({ style_class: "menu-search-box" });
            this._searchArea.add(this.searchBox);

            this.buttonbox = new St.BoxLayout();
            let button = new St.Button({ child: this.searchIcon });
            button.connect("clicked", Lang.bind(this, this._search));
            this.buttonbox.add_actor(button);
            this._searchArea.add(this.buttonbox);
            this.searchEntry = new St.Entry({ name: "menu-search-entry",
                                     hint_text: _("Type to search..."),
                                     track_hover: true,
                                     can_focus: true });
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
            this.searchBox.add_actor(this.searchEntry);
            this.searchActive = false;
            this.searchEntryText = this.searchEntry.clutter_text;
            this.searchEntryText.connect("text-changed", Lang.bind(this, this._onSearchTextChanged));
            this.searchEntryText.connect("key-press-event", Lang.bind(this, this._onMenuKeyPress));
            this._previousSearchPattern = "";

            this.on_keybinding_changed();
            this.update_label_visible();
            this._on_providers_changed();
        }
        catch (e) {
            global.logError(e);
        }
    },

    populate_search_engines_menu: function() {
        if (this.context_menu_item_search_engines)
            this.context_menu_item_search_engines.destroy();

        this.context_menu_item_search_engines = new PopupMenu.PopupSubMenuMenuItem(_("Select your Search Engine:"));
        this._applet_context_menu.addMenuItem(this.context_menu_item_search_engines);

        for (let p of this.providers) {
            if (p.show != undefined && p.show == false) continue;
            p.show = true;
            let item = new PopupMenu.PopupMenuItem((p.short.length > 0) ? p.name + " ("+p.short+")" : p.name, {
                reactive: true
            });
            item.setShowDot(this.selected_provider == ""+p.name);
            item.connect("activate", () => {
                this.selected_provider = ""+p.name;
                this.update_label_visible();
            });
            this.context_menu_item_search_engines.menu.addMenuItem(item);
        }
        this.context_menu_item_search_engines.menu.open();
    },

    _on_providers_changed: function() {
        if (this.already_changed) return;

        if (this.custom_provider_label.length > 0 && this.custom_provider_url.length > 0) {
            this.providers.push({"name": ""+this.custom_provider_label, "url": ""+this.custom_provider_url});
            this.use_custom_provider = false;
            this.custom_provider_label = "";
            this.custom_provider_url = "";
        }

        this._reload();
    },

    _reload: function() {
        prov_label = this.selected_provider;
        prov_url = "";
        for (let p of this.providers) {
            if (p["name"] == prov_label) {
                prov_url = p["url"];
                break
            }
        }
        if (prov_url.length === 0) {
            prov_label = "Google";
            prov_url = "https://google.com/search?q=";
        }

        if (this.show_provider) {
            this.set_applet_label(prov_label);
            this.hide_applet_label(false);
        }
        else {
            this.hide_applet_label(true);
        }
        this.already_changed = false;
    },

    _onMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if ((symbol==Clutter.KEY_Return || symbol==Clutter.KEY_KP_Enter) && this.menu.isOpen) {
            this._search();
            return true;
        }
        return false;
    },

    _search: function() {
        let old_provider = ""+this.selected_provider;
        var _entry = this.searchEntry.get_text().replace(/'/g,"%27");
        let brief = _entry.split(" ", 1)[0];
        if (brief.length === 3) {
            for (let p of this.providers) {
                if (p.short == brief) {
                    prov_label = p.name;
                    this.selected_provider = prov_label;
                    prov_url = p.url;
                    _entry = _entry.slice(4);
                    break
                }
            }
        }
        Util.spawnCommandLineAsync("xdg-open " + prov_url + "'" + _entry + "'");
        if (this.reset_after_search) {
            this.searchEntry.set_text("");
            this.searchActive = false;
        }
        this.selected_provider = old_provider;
        this.menu.close();
    },

    resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
        global.stage.set_key_focus(this.searchEntry);
    },

    _onSearchTextChanged: function () {
        this.searchActive = this.searchEntry.get_text().length > 0; // != "";
        if (this.searchActive) {
            this.searchEntry.set_secondary_icon(this._searchActiveIcon);

            if (this._searchIconClickedId == 0) {
                this._searchIconClickedId = this.searchEntry.connect("secondary-icon-clicked",
                    Lang.bind(this, function() {
                        this.resetSearch();
                    }));
            }
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);
            this._searchIconClickedId = 0;

            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);

        }
    },

    on_keybinding_changed: function() {
        Main.keybindingManager.addHotKey("must-be-unique-id", this.custom_keybinding, Lang.bind(this, this.on_hotkey_triggered));
    },

    on_hotkey_triggered: function() {
        this.on_applet_clicked();
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
        global.stage.set_key_focus(this.searchEntry);
    },

    _onButtonPressEvent: function(actor, event) {
        let button = event.get_button();
        if (button < 3) {
            if (!this._draggable.inhibit) {
                return false;
            } else {
                if (this._applet_context_menu.isOpen) {
                    this._applet_context_menu.close();
                }
            }
        }

        if (button === 1) {
            this.on_applet_clicked(event);
        } else if (button === 2) {
            return false; //this.on_applet_middle_clicked(event);
        } else if (button === 3) {
            //this.finalizeContextMenu();
            if (this._applet_context_menu._getMenuItems().length > 0) {
                this._applet_context_menu.toggle();
                if (this._applet_context_menu.isOpen) {
                    this.populate_search_engines_menu();
                    this.context_menu_item_search_engines.menu.open();
                }
            }
        }

        return true;
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;

        this.update_label_visible();
    },

    update_label_visible: function () {
        if (this._orientation == St.Side.LEFT || this._orientation == St.Side.RIGHT)
            this.hide_applet_label(true);
        else
            this.hide_applet_label(false);
    }

};

function main(metadata, orientation, panel_height, instance_id) {
    let searchBoxApplet = new SearchBoxApplet(orientation, panel_height, instance_id);
    return searchBoxApplet;
}
