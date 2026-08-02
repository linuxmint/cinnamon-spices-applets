const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Cvc = imports.gi.Cvc;

const { connectIconScrollHandler } = require("./handlers/on-icon-scroll-handler");
const { MasterVolumeItem, MicVolumeItem } = require("./widgets/stream-volume-item");
const { InputDeviceItem, OutputDeviceItem } = require("./widgets/device-picker-item");
const { ApplicationsItem } = require("./widgets/applications-item");
const { QuickActionsItem } = require("./widgets/quick-actions-item");

function addSectionSeparator(menu) {
    const separator = new PopupMenu.PopupSeparatorMenuItem();
    separator.actor.add_style_class_name("modern-sound-separator");
    menu.addMenuItem(separator);
    return separator;
}

class ModernSoundApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        try {
            this._initApplet(metadata, orientation, panelHeight, instanceId);
        } catch (e) {
            global.logError(`[${metadata.uuid}] ${e}`);
            throw e;
        }
    }

    _initApplet(metadata, orientation, panelHeight, instanceId) {
        this.metadata = metadata;

        this._control = new Cvc.MixerControl({ name: metadata.uuid });
        this._volumeNorm = this._control.get_vol_max_norm();

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new Applet.AppletPopupMenu(this, orientation);
        this._menuManager.addMenu(this._menu);
        this._menu.actor.add_style_class_name("modern-sound-menu");

        this._settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this._settings.bind("keyOpen", "keyOpen", () => this._setKeybinding());
        this._settings.bind("hideSingleOutputDevice", "hideSingleOutputDevice", () => {
            this._syncDeviceVisibility();
        });
        this._settings.bind("hideSingleInputDevice", "hideSingleInputDevice", () => {
            this._syncDeviceVisibility();
        });

        this._masterVolume = new MasterVolumeItem(this);
        this._menu.addMenuItem(this._masterVolume);

        this._micVolume = new MicVolumeItem(this);
        this._menu.addMenuItem(this._micVolume);

        this._outputDevice = new OutputDeviceItem(this);
        this._outputDevice.bindControl(this._control);
        this._menu.addMenuItem(this._outputDevice);

        this._inputDevice = new InputDeviceItem(this);
        this._inputDevice.bindControl(this._control);
        this._menu.addMenuItem(this._inputDevice);

        addSectionSeparator(this._menu);

        this._applications = new ApplicationsItem(this);
        this._applications.bindControl(this._control);
        this._menu.addMenuItem(this._applications);

        addSectionSeparator(this._menu);

        this._quickActions = new QuickActionsItem(this);
        this._menu.addMenuItem(this._quickActions);

        this._control.connect("state-changed", () => {
            if (this._control.get_state() === Cvc.MixerControlState.READY)
                this._readStreams();
        });
        this._control.connect("active-output-update", () => this._readStreams());
        this._control.connect("active-input-update", () => this._readStreams());

        this._control.open();
        this._setKeybinding();
        connectIconScrollHandler(this);
        this.set_applet_icon_symbolic_name("audio-volume-high-symbolic");
        this.set_applet_tooltip(_("Sound"));
        global.log("[modern-sound] applet initialized");
    }

    _readStreams() {
        if (this._output && this._outputMutedId)
            this._output.disconnect(this._outputMutedId);
        if (this._output && this._outputVolumeId)
            this._output.disconnect(this._outputVolumeId);
        if (this._input && this._inputMutedId)
            this._input.disconnect(this._inputMutedId);
        if (this._input && this._inputVolumeId)
            this._input.disconnect(this._inputVolumeId);

        this._output = this._control.get_default_sink();
        this._input = this._control.get_default_source();

        this._masterVolume.connectStream(this._output);
        this._micVolume.connectStream(this._input);
        this._inputDevice._syncActiveDevice();
        this._outputDevice._syncActiveDevice();

        if (this._output) {
            this._outputMutedId = this._output.connect("notify::is-muted", () => {
                this._syncMuteStates();
                this._updatePanelIcon();
            });
            this._outputVolumeId = this._output.connect("notify::volume", () => this._updatePanelIcon());
        }

        if (this._input) {
            this._inputMutedId = this._input.connect("notify::is-muted", () => {
                this._syncMuteStates();
            });
            this._inputVolumeId = this._input.connect("notify::volume", () => {
                this._micVolume._sync();
            });
        }

        this._syncMuteStates();
        this._updatePanelIcon();
        this._syncDeviceVisibility();
    }

    _syncDeviceVisibility() {
        if (this._outputDevice)
            this._outputDevice._updateVisibility();
        if (this._inputDevice)
            this._inputDevice._updateVisibility();
    }

    _syncMuteStates() {
        if (!this._quickActions)
            return;
        this._quickActions.setSoundMuted(this._output ? this._output.is_muted : false);
        this._quickActions.setInputMuted(this._input ? this._input.is_muted : false);
    }

    toggleSoundMute() {
        if (!this._output)
            return;
        this._output.change_is_muted(!this._output.is_muted);
    }

    toggleInputMute() {
        if (!this._input)
            return;
        this._input.change_is_muted(!this._input.is_muted);
    }

    openSettings() {
        Util.spawn(["cinnamon-settings", "sound"]);
        this._menu.close();
    }

    _updatePanelIcon() {
        if (!this._output) {
            this.set_applet_icon_symbolic_name("audio-volume-muted-symbolic");
            return;
        }

        const norm = this._volumeNorm || 1;
        const max = this._output.volume_max || norm;
        const volume = this._output.is_muted ? 0 : this._output.volume;
        const ratio = volume / max;

        let icon = "audio-volume-muted-symbolic";
        if (!this._output.is_muted) {
            if (ratio >= 0.66)
                icon = "audio-volume-high-symbolic";
            else if (ratio >= 0.33)
                icon = "audio-volume-medium-symbolic";
            else if (ratio >= 0.005)
                icon = "audio-volume-low-symbolic";
        }

        this.set_applet_icon_symbolic_name(icon);
    }

    _setKeybinding() {
        Main.keybindingManager.removeXletHotKey(this, "open-menu");
        if (this.keyOpen)
            Main.keybindingManager.addXletHotKey(this, "open-menu", this.keyOpen, () => this._menu.toggle());
    }

    on_applet_clicked() {
        this._menu.toggle();
    }

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeXletHotKey(this, "open-menu");
        this._control.close();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new ModernSoundApplet(metadata, orientation, panelHeight, instanceId);
}

module.exports = { main };
