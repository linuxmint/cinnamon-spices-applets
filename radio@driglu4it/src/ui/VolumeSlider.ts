const { PopupSliderMenuItem } = imports.ui.popupMenu;
const St = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;

interface Arguments {
    onValueChanged: { (volume: number): void }
}


export class VolumeSlider extends PopupSliderMenuItem {

    private tooltip: imports.ui.tooltips.Tooltip
    private onValueChanged: { (volume: number): void }
    private volumeIcon: imports.gi.St.Icon

    private volumeIcons = [
        { max: 0, iconSuffix: "muted" },
        { max: 33, iconSuffix: "low" },
        { max: 66, iconSuffix: "medium" },
        { max: 100, iconSuffix: "high" },
    ]


    constructor(args: Arguments) {
        super(0);

        const {
            onValueChanged
        } = args

        this.onValueChanged = onValueChanged
        this.tooltip = new Tooltip(this.actor, `Volume: ${this.value} %`)

        this.volumeIcon = new St.Icon({ icon_name: this.volumeIconName, icon_type: St.IconType.SYMBOLIC, icon_size: 16 })


        this.removeActor(this._slider);
        this.addActor(this.volumeIcon, { span: 0 })
        this.addActor(this._slider, { span: -1, expand: true });
        this.connect('value-changed', () => this.handleValueChanged())

    }

    public handleValueChanged() {
        this.onValueChanged(this.value)

        // strictly speaking this is wrong as it is not listened to the volume interface (i.e. the mpvHandler) but who cares?
        this.refreshSlider()
        this.tooltip.show()
    }

    public get value() {
        return Math.round(super.value * 100)
    }

    public set value(newVolume: number) {
        super.setValue(newVolume / 100)
        this.refreshSlider()
    }

    private refreshSlider() {
        this.volumeIcon.icon_name = this.volumeIconName
        this.tooltip.set_text(`Volume: ${this.value} %`)
    }

    private get volumeIconName() {
        const index = this.volumeIcons.findIndex(({ max, ...rest }, index) =>
            this.value <= max
        )

        return `audio-volume-${this.volumeIcons[index].iconSuffix}`
    }

    public destroy() {
        super.destroy()
        this.tooltip.hide()
    }
}