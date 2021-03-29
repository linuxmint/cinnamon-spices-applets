const { PopupBaseMenuItem } = imports.ui.popupMenu;
const St = imports.gi.St;

import { PlaybackStatus } from './types'

export class PlayMausMenuItem extends PopupBaseMenuItem {

    readonly label: imports.gi.St.Label
    private _playbackStatus: PlaybackStatus
    private icon: imports.gi.St.Icon

    public constructor(text: string) {
        super()
        this.label = new St.Label({ text })
        this.addActor(this.label)
    }

    private addIcon(playbackStatus: PlaybackStatus) {

        this._playbackStatus = playbackStatus

        let iconName: string

        if (playbackStatus === "Playing") iconName = "media-playback-start"
        if (playbackStatus === "Paused") iconName = "media-playback-pause"

        this.icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC
        })

        this.addActor(this.icon, { span: 0 })
    }

    private removeIcon() {
        // Only access "this._icon" when it exists to prevent "Object St.Icon (0x55a3f21c9810), has been already deallocated — impossible to access it ..." in logs. 
        if (this._playbackStatus === "Stopped") return

        if (this.icon) {
            this.removeActor(this.icon)
            this.icon.destroy()
        }
    }


    public set playbackStatus(newStatus: PlaybackStatus) {
        this.removeIcon()

        if (newStatus !== "Stopped") {
            this.removeActor(this.label)
            this.addIcon(newStatus)
            this.addActor(this.label)
        }

        this._playbackStatus = newStatus
    }

    public get playbackStatus() {
        return this._playbackStatus
    }

}
