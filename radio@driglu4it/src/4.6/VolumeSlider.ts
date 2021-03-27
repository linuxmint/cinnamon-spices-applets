const { PopupSliderMenuItem } = imports.ui.popupMenu;
const St = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;

export class VolumeSlider extends PopupSliderMenuItem {

    private tooltip: imports.ui.tooltips.Tooltip
    private volume: number

    constructor(volume: number, onValueChanged: { (volume: number): void }) {
        super(volume / 100);

        this.volume = volume
        this.tooltip = new Tooltip(this.actor, `Volume: ${this.volume}`)

        const volumeIcon = new St.Icon({ icon_name: "audio-volume-medium", icon_type: St.IconType.SYMBOLIC, icon_size: 16 })

        // this._slider.

        this.removeActor(this._slider);
        this.addActor(volumeIcon, { span: 0 })
        this.addActor(this._slider, { span: -1, expand: true });
    }

    setValue(newVolume: number) {
        super.setValue(newVolume / 100)
    }
}