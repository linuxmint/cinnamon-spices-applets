const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;

let prov_label = '';
let prov_url = '';

// l10n
const Gettext = imports.gettext;
const UUID = "search-box@mtwebster";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            this._searchInactiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
                                               icon_name: 'edit-find',
                                               icon_type: St.IconType.SYMBOLIC });
            this._searchActiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
                                             icon_name: 'edit-clear',
                                             icon_type: St.IconType.SYMBOLIC });
            this.searchIcon = new St.Icon({icon_name: "edit-find", icon_size: 24, icon_type: St.IconType.FULLCOLOR});
            this._searchIconClickedId = 0;

            this.settings.bind("show-provider", "show_provider", this._reload);
            this.settings.bind("selected-provider", "selected_provider", this._reload);
            this.settings.bind("use-custom-provider", "use_custom_provider", this._reload);
            this.settings.bind("custom-provider-label", "custom_provider_label", this._reload);
            this.settings.bind("custom-provider-url", "custom_provider_url", this._reload);
            this.settings.bind("custom-keybinding", "custom_keybinding", this.on_keybinding_changed);

            this.set_applet_icon_symbolic_name("edit-find-symbolic");
            this._orientation = orientation;

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, this._orientation);
            this.menuManager.addMenu(this.menu);

            this._searchArea = new St.BoxLayout({name: 'searchArea' });

            this.menu.addActor(this._searchArea);

            this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box' });
            this._searchArea.add(this.searchBox);

            this.buttonbox = new St.BoxLayout();
            let button = new St.Button({ child: this.searchIcon });
            button.connect('clicked', Lang.bind(this, this._search));
            this.buttonbox.add_actor(button);
            this._searchArea.add(this.buttonbox);
            this.searchEntry = new St.Entry({ name: 'menu-search-entry',
                                     hint_text: _("Type to search..."),
                                     track_hover: true,
                                     can_focus: true });
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
            this.searchBox.add_actor(this.searchEntry);
            this.searchActive = false;
            this.searchEntryText = this.searchEntry.clutter_text;
            this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
            this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
            this._previousSearchPattern = "";

            this.on_keybinding_changed();
            this.update_label_visible();
            this._reload();
        }
        catch (e) {
            global.logError(e);
        }
    },

    _reload: function() {
        if (this.use_custom_provider) {
            prov_label = this.custom_provider_label;
            prov_url = this.custom_provider_url;
        } else {
            switch(this.selected_provider) {
                case 'google':
                    prov_label = 'Google'
                    prov_url = 'http://google.com/search?q='
                    break;
                case 'bing':
                    prov_label = 'Bing'
                    prov_url = 'http://www.bing.com/search?q='
                    break;
                case 'yahoo':
                    prov_label = 'Yahoo'
                    prov_url = 'http://search.yahoo.com/search?p='
                    break;
                case 'ask':
                    prov_label = 'Ask'
                    prov_url = 'http://www.ask.com/web?q='
                    break;
                case 'duckduckgo':
                    prov_label = 'DuckDuckGo'
                    prov_url = 'https://duckduckgo.com/?q='
                    break;
            }
        }

        if (this.show_provider) {
            this.set_applet_label(prov_label);
            this.hide_applet_label(false);
        }
        else {
            this.hide_applet_label(true);
        }
    },

    _onMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol==Clutter.KEY_Return && this.menu.isOpen) {
            this._search();
            return true;
        }
        return false;
    },

    _search: function() {
        Main.Util.spawnCommandLine("xdg-open " + prov_url + "'" + this.searchEntry.get_text().replace(/'/g,"%27") + "'");
        this.searchEntry.set_text("");
        this.searchActive = false;
        this.menu.close();
    },

    resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
        global.stage.set_key_focus(this.searchEntry);
    },

    _onSearchTextChanged: function () {
        this.searchActive = this.searchEntry.get_text() != '';
        if (this.searchActive) {
            this.searchEntry.set_secondary_icon(this._searchActiveIcon);

            if (this._searchIconClickedId == 0) {
                this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked',
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
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
