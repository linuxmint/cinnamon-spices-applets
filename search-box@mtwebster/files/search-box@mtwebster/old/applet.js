const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const UPowerGlib = imports.gi.UPowerGlib;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
let AppletSettings, AppletSettingsUI;
if (typeof require !== 'undefined') {
    AppletSettings = require('./appletSettings');
    AppletSettingsUI = require('./appletSettingsUI');
} else {
    const AppletDir = imports.ui.appletManager.applets['search-box@mtwebster'];
    AppletSettings = AppletDir.appletSettings;
    AppletSettingsUI = AppletDir.appletSettingsUI;
}


const APPLET_DIR = imports.ui.appletManager._find_applet('search-box@mtwebster');

prov_label = '';
prov_url = '';
const DEFAULT_SHOW = true;
const DEFAULT_ARRAY = ['Provider', 'Google', 'http://google.com/search?q='];
const TEXT_EDITOR = 'xdg-open';

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation) {
        Applet.TextIconApplet.prototype._init.call(this, orientation);
        try {
            this.settings = new AppletSettings.AppletSettings('search-box@mtwebster', 'providers.conf', 'providers.conf');
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._searchInactiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
                                               icon_name: 'edit-find',
                                               icon_type: St.IconType.SYMBOLIC });
            this._searchActiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
                                             icon_name: 'edit-clear',
                                             icon_type: St.IconType.SYMBOLIC });
            this.searchIcon = new St.Icon({icon_name: "edit-find", icon_size: 24, icon_type: St.IconType.FULLCOLOR});
            this._searchIconClickedId = 0;
            let ar = this.settings.getComboArray('Provider', DEFAULT_ARRAY);
            show_provider = this.settings.getBoolean('Show Provider', DEFAULT_SHOW);
            if (show_provider) {
                this.set_applet_label(ar[1]);
            } else {
                this.set_applet_label('');
            }
            prov_url = ar[2];
            this.set_applet_icon_symbolic_name("edit-find-symbolic");
            this._orientation = orientation;
            this.menu = new Applet.AppletPopupMenu(this, this._orientation);
            this.menuManager.addMenu(this.menu);

            this._searchArea = new St.BoxLayout({name: 'searchArea' });

            this.menu.addActor(this._searchArea);

            this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box' });
            this._searchArea.add(this.searchBox);

            this.buttonbox = new St.BoxLayout();
            button = new St.Button({ child: this.searchIcon });
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

            this.defaults_menu_item = new Applet.MenuItem(_("Change default programs..."), 'system-run-symbolic',
                    Lang.bind(this, this._defaults));
            this.edit_menu_item = new Applet.MenuItem(_("Edit providers"), 'accessories-text-editor-symbolic',
                    Lang.bind(this, this._edit_providers));


            this.provider_switch = new AppletSettingsUI.SwitchSetting(this.settings, 'Show Provider');
            this.provider_selection = new AppletSettingsUI.ComboSetting(this.settings, 'Provider');

            this.settings_menu = new AppletSettingsUI.SettingsMenu('Settings');


            this.settings_menu.addSetting(this.provider_switch.getSwitch());
            this.settings_menu.addSetting(this.provider_selection.getComboBox());
            this.settings_menu.addBreak();
            this.settings_menu.addSetting(this.edit_menu_item);
            this.settings_menu.addSetting(this.defaults_menu_item);

            this._applet_context_menu.addMenuItem(this.settings_menu);

            this.settings.connect('settings-file-changed', Lang.bind(this, this._reload));
        }
        catch (e) {
            global.logError(e);
        }
    },

    _edit_providers: function() {
        this.settings.editSettingsFile(TEXT_EDITOR);
    },

    _reload: function() {
        this.settings.readSettings();
        show_provider = this.settings.getBoolean('Show Provider', DEFAULT_SHOW);
        let ar = this.settings.getComboArray('Provider', DEFAULT_ARRAY);
        if (show_provider) {
            this.set_applet_label(ar[1]);
        } else {
            this.set_applet_label('');
        }
        prov_url = ar[2];
    },

    _defaults: function() {
        Util.spawn(['cinnamon-settings', 'default']);
    },

    _onMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol==Clutter.KEY_Return && this.menu.isOpen) {
            this._search();
            return true;
        }
    },

    _search: function() {
        Main.Util.spawnCommandLine("xdg-open " + prov_url + "'" + this.searchEntry.get_text() + "'");
        this.menu.close();
    },

    resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
        global.stage.set_key_focus(this.searchEntry);
    },

    _onSearchTextChanged: function (se, prop) {
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
        if (!this.searchActive) {
            if (this._searchTimeoutId > 0) {
                Mainloop.source_remove(this._searchTimeoutId);
                this._searchTimeoutId = 0;
            }
            return;
        }
        if (this._searchTimeoutId > 0)
            return;
        this._searchTimeoutId = Mainloop.timeout_add(150, Lang.bind(this, this._doSearch));
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
        global.stage.set_key_focus(this.searchEntry);
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    }

};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
