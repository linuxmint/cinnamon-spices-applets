const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;



// settings = appletSettings, key = settings key/label to tie to

function SwitchSetting(settings, key) {
    this._init(settings, key);
}


SwitchSetting.prototype = {
        _init: function (settings, key) {
            this.settings = settings;
            this.key = key;
            this._switch = new PopupMenu.PopupSwitchMenuItem(this.key, this.settings.getBoolean(this.key, false));
            this._switch.connect('toggled', Lang.bind(this, this._switch_toggled));
            this.settings.connect('settings-file-changed', Lang.bind(this, this._settings_file_edited_offline));
            try {

            } catch (e) {
                global.logError(e);
            }
        },

        getSwitch: function () {
            return this._switch;
        },

        _switch_toggled: function () {
            this._write_setting();
        },

        _write_setting: function () {
            this.settings.setBoolean(this.key, this._switch.state);
        },

        _settings_file_edited_offline: function () {
            this._switch.setToggleState(this.settings.getBoolean(this.key, false));
        }
};

function ComboSetting(settings, key) {
    this._init(settings, key);
}

ComboSetting.prototype = {
        _init: function (settings, key) {
            try {
                this.combo_settings = new Array();
                this.settings = settings;
                this.key = key;
                this.current_choice = 0;
                this._combobox = new PopupMenu.PopupComboBoxMenuItem({});
                this._combobox.connect('active-item-changed', Lang.bind(this, this._setting_changed));
                this.settings.connect('settings-file-changed', Lang.bind(this, this._settings_file_edited_offline));
                
                this._populate_options();
            } catch (e) {
                global.logError(e);
            }
        },

        _populate_options: function () {
            try {
                this.combo_settings = this.settings._get_combo_setting_raw(this.key);
                if (this.combo_settings[0][1] != 'null') {
                    this.current_choice = parseInt(this.combo_settings[0][1]);
                }
                this.combo_settings.splice(0,1);
                for (let i = 0; i < this.combo_settings.length; i++) {
                    let item = new PopupMenu.PopupMenuItem(this.combo_settings[i][1]);
                    this._combobox.addMenuItem(item, i);
                } 
                this._combobox.setActiveItem(this.current_choice);
            } catch (e) {
                global.logError(e);
            }
        },

        getComboBox: function () {
            return this._combobox;
        },

        _setting_changed: function () {
            this._write_setting();
        },

        _write_setting: function () {
            this.settings.setComboChoice(this.key, this._combobox._activeItemPos);
        },

        _settings_file_edited_offline: function () {
            this._combobox.setActiveItem(parseInt(this.settings.getString(this.key + '_CHOICE', '0')));
        }
};

function SettingsMenu(text) {
    this._init(text);
}

SettingsMenu.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(text) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});

        this.settings_icon = new St.Icon({icon_name: "preferences-system-symbolic",
                icon_size: 16, icon_type: St.IconType.SYMBOLIC});
        this.label = new St.Label({ text: text, style_class: 'popup-subtitle-menu-item' });

        this.addActor(this.settings_icon);
        this.addActor(this.label, { align: St.Align.START });
        this.menu = new PopupMenu.PopupSubMenu(this.actor, this.settings_icon);
        this.menu.actor.set_style_class_name('menu-context-menu');
        this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));

    },

    addSetting: function(setting_item) {
        this.menu.addMenuItem(setting_item);
    },

    addBreak: function() {
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },

}