const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Lang = imports.lang;
const St = imports.gi.St;
const Mainloop = imports.mainloop;

function MicInputApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MicInputApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name("audio-input-microphone");
        this.set_applet_tooltip(_("Microphone Input Level"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._buildMenu();
        this._updateVolume();
        this._timeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateVolume));
    },

    _buildMenu: function() {
        this.muteSwitch = new PopupMenu.PopupSwitchMenuItem(_("Mute Microphone"), false);
        this.muteSwitch.connect('toggled', Lang.bind(this, this._onMuteToggled));
        this.menu.addMenuItem(this.muteSwitch);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.volumePercentLabel = new PopupMenu.PopupMenuItem(_("Input Volume: 0%"), { reactive: false });
        this.menu.addMenuItem(this.volumePercentLabel);

        this.volumeSlider = new PopupMenu.PopupSliderMenuItem(0);
        this.volumeSlider.connect('value-changed', Lang.bind(this, this._onVolumeChanged));
        this.menu.addMenuItem(this.volumeSlider);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let soundSettings = new PopupMenu.PopupMenuItem(_("Sound Settings"));
        soundSettings.connect('activate', function() {
            Util.spawnCommandLine("cinnamon-settings sound");
        });
        this.menu.addMenuItem(soundSettings);
    },

    _getDefaultSource: function() {
        try {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('pactl get-default-source');
            if (result) {
                return stdout.toString().trim();
            }
        } catch (e) {
            global.logError("Error getting default source: " + e);
        }
        return null;
    },

    _getSourceVolume: function(source) {
        try {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('pactl get-source-volume ' + source);
            if (result) {
                let output = stdout.toString();
                let match = output.match(/(\d+)%/);
                if (match) {
                    return parseInt(match[1]);
                }
            }
        } catch (e) {
            global.logError("Error getting source volume: " + e);
        }
        return 0;
    },

    _getSourceMute: function(source) {
        try {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('pactl get-source-mute ' + source);
            if (result) {
                let output = stdout.toString().trim();
                return output.includes("yes");
            }
        } catch (e) {
            global.logError("Error getting source mute: " + e);
        }
        return false;
    },

    _updateVolume: function() {
        let source = this._getDefaultSource();
        if (source) {
            let volume = this._getSourceVolume(source);
            let isMuted = this._getSourceMute(source);

            this._ignoreChanges = true;
            this.volumeSlider.setValue(volume / 100);
            this.muteSwitch.setToggleState(isMuted);
            this.volumePercentLabel.label.text = _("Input Volume: ") + volume + "%";
            this._ignoreChanges = false;

            this.set_applet_label(volume + "%");

            if (isMuted) {
                this.set_applet_icon_symbolic_name("microphone-sensitivity-muted");
            } else if (volume > 66) {
                this.set_applet_icon_symbolic_name("microphone-sensitivity-high");
            } else if (volume > 33) {
                this.set_applet_icon_symbolic_name("microphone-sensitivity-medium");
            } else {
                this.set_applet_icon_symbolic_name("microphone-sensitivity-low");
            }
        }
        return true;
    },

    _onVolumeChanged: function(slider, value) {
        if (this._ignoreChanges) return;

        let source = this._getDefaultSource();
        if (source) {
            let volume = Math.round(value * 100);
            Util.spawnCommandLine("pactl set-source-volume " + source + " " + volume + "%");
            this._updateVolume();
        }
    },

    _onMuteToggled: function(item) {
        if (this._ignoreChanges) return;

        let source = this._getDefaultSource();
        if (source) {
            let muteValue = item.state ? "1" : "0";
            Util.spawnCommandLine("pactl set-source-mute " + source + " " + muteValue);
            this._updateVolume();
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MicInputApplet(metadata, orientation, panel_height, instance_id);
}
