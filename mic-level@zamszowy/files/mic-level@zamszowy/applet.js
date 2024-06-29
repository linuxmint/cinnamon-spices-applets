const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;


function MicLevel(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MicLevel.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        this.applet_path = metadata.path;

        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("microphone-sensitivity-low");

        this.uuid = metadata.uuid;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("measure-time", "measure_time", null, null);
        this.settings.bind("sleep-time", "sleep_time", null, null);

        this.settings.bind("enable-bt-only", "bt_only", this.on_bt_only_settings_changed, null);
        this.settings.bind("enable-click-to-switch-bt-profile", "enable_click_to_switch_bt_profile", this.on_enable_click_to_switch_bt_profile, null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "enable-keybind", "enable_keybind",  this.on_enable_keybind, null);
        this.settings.bind("keybind-toggle", "keybinding", this.on_keybinding_changed);

        Main.keybindingManager.addHotKey(this.uuid, this.keybinding, Lang.bind(this, function(){
            this.on_hotkey_changed();
        }));

        this.enabled = true;
        this.run();

        this.bt_profile_watch_running = false;
        if (this.bt_only) {
            this.watch_bt_profile();
        }

        this.tooltip_info = 0;
        this.on_enable_click_to_switch_bt_profile();
    },

    on_enable_keybind: function() {
        if (this.enable_keybind && this.bt_only) {
            this.enable_keybind = false;
        }
    },

    on_enable_click_to_switch_bt_profile: function() {
        if (this.enable_click_to_switch_bt_profile) {
            if (!this.tooltip_info) {
                this.tooltip_info = Mainloop.timeout_add_seconds(5, Lang.bind(this, function () {
                    this.set_tooltip_with("info");
                    return true;
                }));
            }
        } else {
            if (this.tooltip_info) {
                Mainloop.source_remove(this.tooltip_info);
                this.tooltip_info = 0;
            }
            this.set_applet_tooltip("");
        }
    },

    set_tooltip_with: function(param) {
        let args = new Array();
        args.push('/bin/bash');
        args.push(this.applet_path + '/profile.sh');
        args.push(param);
        Util.spawn_async(args, Lang.bind(this, function(stdout){
            const out = stdout.trim();
            if (out == "a2dp") {
                this.set_applet_tooltip("Click so switch to HFP profile");
            } else if (out == "hfp") {
                this.set_applet_tooltip("Click so switch to A2DP profile");
            }
        }));
    },

    on_bt_only_settings_changed: function() {
        if (this.bt_only) {
            this.enable_keybind = false;
            if (!this.bt_profile_watch_running) {
                this.watch_bt_profile();
            }
        } else if (!this.enabled){
            this.enabled = true;
            this.set_applet_enabled(true);
            this.run();
        }
    },

    on_applet_clicked: function() {
        if (!this.enable_click_to_switch_bt_profile) {
            return;
        }

        this.set_tooltip_with("toggle");
    },

    watch_bt_profile: function() {
        if (!this.bt_only) {
            this.bt_profile_watch_running = false;
            return;
        }

        this.bt_profile_watch_running = true;

        let args = new Array();
        args.push('/bin/bash');
        args.push(this.applet_path + '/hfp.sh');
        Util.spawn_async(args, Lang.bind(this, function(stdout){
            const out = stdout.trim();
            if (out == "present" && !this.enabled) {
                this.enabled = true;
                this.set_applet_enabled(true);
                this.run();
            } else if (out == "absent" && this.enabled) {
                this.enabled = false;
                this.set_applet_enabled(false);
            }
            Util.spawn_async(['sleep', '2'], Lang.bind(this, function(_){
                this.watch_bt_profile();
            }));
        }));
    },

    on_keybinding_changed: function() {
        this.on_hotkey_changed();
    },

    on_hotkey_changed: function() {
        if (this.bt_only || !this.enable_keybind) {
            return;
        }

        this.enabled = !this.enabled;
        this.set_applet_enabled(this.enabled);
        if (this.enabled) { // was disabled, now enabling
            this.run();
        }
    },

    on_applet_removed: function() {
        Mainloop.source_remove(this.tooltip_info);
        this.settings.finalize();
        this.enabled = false;
        this.bt_only = false;
    },

    run: function() {
        if (!this.enabled) {
            return;
        }

        let args = new Array();
        args.push('/bin/bash');
        args.push(this.applet_path + '/rec.sh');
        args.push(this.measure_time.toString());

        Util.spawn_async(args, Lang.bind(this, function(stdout){
            const level = Math.round(parseFloat(stdout.trim()));
            if (level == -1) {
                this.set_applet_icon_name("microphone-sensitivity-muted");
                this.hide_applet_label(true);
            } else {
                if (level >= 0 && level < 33) {
                    this.set_applet_icon_name("microphone-sensitivity-low");
                } else if (level > 33 && level < 66) {
                    this.set_applet_icon_name("microphone-sensitivity-medium");
                } else {
                    this.set_applet_icon_name("microphone-sensitivity-high");
                }
                this.set_applet_label(level.toString() + "%");
            }

            Util.spawn_async(['sleep', this.sleep_time.toString()], Lang.bind(this, function(_){
                this.run();
            }));
        }));
    },
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MicLevel(metadata, orientation, panel_height, instance_id);
}
