const { PopupBaseMenuItem } = imports.ui.popupMenu;
const St = imports.gi.St;

import { PlaybackStatus } from './types'

export class PlayMausMenuItem extends PopupBaseMenuItem {

    readonly label: imports.gi.St.Label
    private status: PlaybackStatus
    private icon: imports.gi.St.Icon

    public constructor(text: string) {
        super()
        this.label = new St.Label({ text })
        this.addActor(this.label)
    }

    private addIcon(status: PlaybackStatus) {

        this.status = status

        let iconName: string

        if (status === "Playing") iconName = "media-playback-start"
        if (status === "Paused") iconName = "media-playback-pause"

        this.icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC
        })

        this.addActor(this.icon, { span: 0 })
    }

    private removeIcon() {
        // Only access "this._icon" when it exists to prevent "Object St.Icon (0x55a3f21c9810), has been already deallocated — impossible to access it ..." in logs. 
        if (this.status === "Stopped") return

        if (this.icon) {
            this.removeActor(this.icon)
            this.icon.destroy()
        }
    }

    public changePlayPauseOffStatus(newStatus: PlaybackStatus) {
        this.removeIcon()

        if (newStatus !== "Stopped") {
            this.removeActor(this.label)
            this.addIcon(newStatus)
            this.addActor(this.label)
        }

        this.status = newStatus

    }


}
