"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolumeSlider = void 0;
const { PopupSliderMenuItem } = imports.ui.popupMenu;
const St = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;
class VolumeSlider extends PopupSliderMenuItem {
    constructor(volume) {
        super(volume / 100);
        this.volume = volume;
        this.tooltip = new Tooltip(this.actor, `Volume: ${this.volume}`);
        const volumeIcon = new St.Icon({ icon_name: "audio-volume-medium", icon_type: St.IconType.SYMBOLIC, icon_size: 16 });
        this.removeActor(this._slider);
        this.addActor(volumeIcon, { span: 0 });
        this.addActor(this._slider, { span: -1, expand: true });
    }
    setValue(newVolume) {
        super.setValue(newVolume / 100);
    }
}
exports.VolumeSlider = VolumeSlider;
