const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Slider = imports.ui.slider;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const { MUTE_THRESHOLD, snapVolumeToNorm, volumePercent } = require("./utils/volume-math");
const { volumeIconName, micIconName } = require("./utils/volume-icon-resolver");

const LEVEL_SLIDER_WIDTH = 140;
const LEVEL_SLIDER_HEIGHT = 22;

class StreamVolumeItem extends PopupMenu.PopupBaseMenuItem {
    constructor(applet, options = {}) {
        super({ activate: false, hover: false });
        this._applet = applet;
        this._updating = false;
        this._buildContext = options.buildContext || null;

        for (const styleClass of this._actorStyleClasses())
            this.actor.add_style_class_name(styleClass);

        this._buildContent();
        this._slider.connect("value-changed", (_slider, value) => {
            if (!this._updating)
                this._onChanged(value);
        });

        if (options.stream)
            this.connectStream(options.stream);
    }

    _actorStyleClasses() {
        return [];
    }

    _buildContent() {
        this._icon = this._createIcon();
        this._wireIconMute(this._icon);
        this._slider = this._createSlider();
        this._percentLabel = this._createPercentLabel();
        this._addVolumeActors();
    }

    _createIcon() {
        return new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: this._defaultIconName(),
            icon_size: 16,
            style_class: this._iconStyleClass(),
            reactive: true,
            track_hover: true
        });
    }

    _defaultIconName() {
        return "audio-volume-muted-symbolic";
    }

    _iconStyleClass() {
        return "modern-sound-level-icon";
    }

    _sliderStyleClass() {
        return "modern-sound-volume-slider";
    }

    _sliderSize() {
        return [LEVEL_SLIDER_WIDTH, LEVEL_SLIDER_HEIGHT];
    }

    _percentStyleClass() {
        return "modern-sound-percent-label";
    }

    _addVolumeActors() {
        this.addActor(this._icon, { span: 0 });
        this.addActor(this._slider.actor, { span: 1, expand: true });
        this.addActor(this._percentLabel, { span: 0 });
    }

    _createSlider() {
        const slider = new Slider.Slider(0);
        const [width, height] = this._sliderSize();
        slider.actor.add_style_class_name(this._sliderStyleClass());
        slider.actor.width = width;
        slider.actor.height = height;
        return slider;
    }

    _createPercentLabel() {
        return new St.Label({
            text: "0%",
            style_class: this._percentStyleClass(),
            y_align: Clutter.ActorAlign.CENTER
        });
    }

    _wireIconMute(icon) {
        icon.connect("button-press-event", (_actor, event) => {
            if (this._stream && event.get_button() === 1) {
                this._stream.change_is_muted(!this._stream.is_muted);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    connectStream(stream) {
        if (this._stream) {
            this._stream.disconnect(this._volumeId);
            this._stream.disconnect(this._mutedId);
        }

        this._stream = stream;
        if (!stream)
            return;

        this._volumeId = stream.connect("notify::volume", () => this._sync());
        this._mutedId = stream.connect("notify::is-muted", () => this._sync());
        this._sync();
    }

    _volumeNorm() {
        return this._applet._volumeNorm;
    }

    _streamVolumeMax(norm) {
        return this._stream.volume_max || norm;
    }

    _sliderRatio(volume, max) {
        return Math.min(1, volume / max);
    }

    _setSliderValue(value) {
        this._updating = true;
        this._slider.setValue(value);
        this._updating = false;
    }

    _sync() {
        if (!this._stream)
            return;

        const norm = this._volumeNorm() || 1;
        const max = this._streamVolumeMax(norm);
        const volume = this._stream.is_muted ? 0 : this._stream.volume;
        const ratio = this._sliderRatio(volume, max);
        const percent = volumePercent(volume, norm, this._stream.is_muted);

        this._setSliderValue(ratio);
        this._percentLabel.text = `${percent}%`;
        this._updateVolumeDisplay(ratio, this._stream.is_muted, percent);
        this._afterSync();
    }

    _onChanged(value) {
        if (!this._stream)
            return;

        const norm = this._volumeNorm() || 1;
        const max = this._streamVolumeMax(norm);
        const volume = snapVolumeToNorm(value * max, norm);
        const muted = value < MUTE_THRESHOLD;
        const percent = volumePercent(volume, norm, muted);

        this._stream.volume = volume;
        this._stream.push_volume();
        if (this._stream.is_muted !== muted)
            this._stream.change_is_muted(muted);

        this._percentLabel.text = `${percent}%`;
        this._updateVolumeDisplay(value, muted, percent);
        this._afterChange();

        if (Main.soundManager)
            Main.soundManager.play("volume");
    }

    _updateVolumeDisplay(_ratio, _muted, _percent) {}

    _afterSync() {}

    _afterChange() {}
}

class MasterVolumeItem extends StreamVolumeItem {
    _defaultIconName() {
        return "xsi-audio-volume-muted";
    }

    _actorStyleClasses() {
        return ["modern-sound-level-item"];
    }

    _streamVolumeMax(norm) {
        return this._applet._masterVolumeMax || norm;
    }

    _sliderRatio(volume, max) {
        return volume / max;
    }

    _updateVolumeDisplay(ratio, muted) {
        this._icon.icon_name = volumeIconName(ratio, muted);
    }

    _afterSync() {
        if (this._applet._updatePanelIcon)
            this._applet._updatePanelIcon();
    }

    _afterChange() {
        if (this._applet._updatePanelIcon)
            this._applet._updatePanelIcon();
    }
}

class MicVolumeItem extends StreamVolumeItem {
    _defaultIconName() {
        return "xsi-microphone-sensitivity-muted";
    }

    _actorStyleClasses() {
        return ["modern-sound-level-item", "modern-sound-level-last"];
    }

    _updateVolumeDisplay(ratio, muted) {
        this._icon.icon_name = micIconName(ratio, muted);
    }

    _afterSync() {
        if (this._applet._syncMuteStates)
            this._applet._syncMuteStates();
    }

    _afterChange() {
        if (this._applet._syncMuteStates)
            this._applet._syncMuteStates();
    }
}

module.exports = {
    StreamVolumeItem,
    MasterVolumeItem,
    MicVolumeItem,
    LEVEL_SLIDER_WIDTH,
    LEVEL_SLIDER_HEIGHT
};
