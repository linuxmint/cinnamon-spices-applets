const Lang = imports.lang;
const Signals = imports.signals;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Cinnamon = imports.gi.Cinnamon;
const Gettext = imports.gettext;
const UUID = "pa-equalizer@jschug.com";

const CONFIG_DIR_OLD = GLib.get_home_dir() + "/.pulse";
const CONFIG_DIR_NEW = GLib.get_user_config_dir() + "/pulse";
const CONFIG_DIR = GLib.file_test(CONFIG_DIR_NEW, GLib.FileTest.IS_DIR)? CONFIG_DIR_NEW: CONFIG_DIR_OLD;

const EQCONFIG = CONFIG_DIR + "/equalizerrc";
const EQPRESETS = EQCONFIG + ".availablepresets";
const PRESETDIR1 = CONFIG_DIR + "/presets/";
const PRESETDIR2 = "/usr/share/pulseaudio-equalizer/presets/";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function Config() {
    this._init();
}

Config.prototype = {
    _init: function() {
        this.load();
    },
    load: function() {
        try {
            GLib.spawn_command_line_sync("pulseaudio-equalizer interface.getsettings");
            this._monitor = Gio.file_new_for_path(EQCONFIG).monitor(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect("changed", Lang.bind(this, function(self, file, otherFile, eventType) {
                if (eventType == Gio.FileMonitorEvent.CHANGES_DONE_HINT) {
                    this._configChanged();
                }
            }));

            this._rawdata = Cinnamon.get_file_contents_utf8_sync(EQCONFIG).split('\n');
            this.presets = Cinnamon.get_file_contents_utf8_sync(EQPRESETS).split('\n')
                        .filter(function(item) { return item.length > 0; });
        } catch (e) {
            global.logError(e);
        }
    },
    save: function() {
        try {
            this._monitor.cancel()
            let out = Gio.file_new_for_path(EQCONFIG).replace(null, false, Gio.FileCreateFlags.NONE, null);
            out.write_all(this._rawdata.join('\n'), null);
            out.close(null);

            GLib.spawn_command_line_sync("pulseaudio-equalizer interface.applysettings");
            this.load();
        } catch (e) {
            global.logError(e);
        }
    },
    enabled: function() {
        return this._rawdata[5] == 1;
    },
    set_enabled: function(enabled) {
        this._rawdata[5] = enabled?1:0;
        this.save();
    },
    toggle: function() {
        this.set_enabled(!this.enabled());
    },
    preset: function() {
        return this._rawdata[4];
    },
    set_preset: function(preset) {
        let file = Gio.file_new_for_path(PRESETDIR1 + preset + ".preset");
        let rawdata = null;
        if (file.query_exists(null)) {
            rawdata = Cinnamon.get_file_contents_utf8_sync(file.get_path()).split('\n');
        } else {
            file = Gio.file_new_for_path(PRESETDIR2 + preset + ".preset");
            if (file.query_exists(null)) {
                rawdata = Cinnamon.get_file_contents_utf8_sync(file.get_path()).split('\n');
            } else {
                return;
            }
        }
        for (let i = 0; i < 5; ++i) {
            if (i == 3) {
                continue;
            }
            this._rawdata[i] = rawdata[i];
        }
        this._rawdata[9] = rawdata[5];
        this._rawdata = this._rawdata.slice(0, 10);
        for (let i = 10; i < (11+2*parseInt(rawdata[5])); ++i) {
            this._rawdata[i] = rawdata[i - 4];
        }
        this.save();
    },
    _configChanged: function() {
        this._monitor.cancel();
        this.load();
        this.emit("changed");
    }
};
Signals.addSignalMethods(Config.prototype);

function EqualizerApplet(metadata, orientation, panel_height) {
    this._init(metadata, orientation, panel_height);
}

EqualizerApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,
    _init: function(metadata, orientation, panel_height) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);

        try {
            this.config = new Config();
            this.config.connect("changed", Lang.bind(this, this._configChanged));

            Gtk.IconTheme.get_default().append_search_path(metadata.path);
            this.set_applet_icon_symbolic_name("equalizer");

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._enabledSwitch = new PopupMenu.PopupSwitchMenuItem(_("Equalizer"),
                                    this.config.enabled());
            this.menu.addMenuItem(this._enabledSwitch);
            this._enabledSwitch.connect("toggled", Lang.bind(this.config, this.config.toggle));

            this._presetsItem = new PopupMenu.PopupSubMenuMenuItem(_("Presets"));
            this.menu.addMenuItem(this._presetsItem);

            this._settingsItem = new PopupMenu.PopupMenuItem(_("Settings"));
            this.menu.addMenuItem(this._settingsItem);
            this._settingsItem.connect("activate", function() {
                GLib.spawn_command_line_async("pulseaudio-equalizer-gtk");
            });

            this._configChanged();
        } catch (e) {
            global.logError(e);
        }
    },
    on_applet_clicked: function(event) {
        this.menu.toggle();
    },
    _configChanged: function() {
        this._enabledSwitch.setToggleState(this.config.enabled());
        this._presetsItem.menu.removeAll();
        for (let i = 0; i < this.config.presets.length; ++i) {
            let preset = this.config.presets[i];
            let menuItem = new PopupMenu.PopupMenuItem(preset);
            if (preset === this.config.preset()) {
                menuItem.setShowDot(true);
            }
            menuItem.connect("activate", Lang.bind(this.config, function() {
                this.set_preset(preset);
            }));
            this._presetsItem.menu.addMenuItem(menuItem);
        }
        this.set_applet_tooltip(_("Preset: ") + this.config.preset());
    }
};

function main(metadata, orientation, panel_height) {
    return new EqualizerApplet(metadata, orientation, panel_height);
}
