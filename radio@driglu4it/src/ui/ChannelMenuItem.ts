import { IconMenuItem } from 'ui/IconMenuItem';
import { PlaybackStatus } from 'types'


export class ChannelMenuItem extends IconMenuItem {

    private playbackIconMap: Map<PlaybackStatus, string | null> = new Map([
        ["Playing", "media-playback-start"],
        ["Paused", "media-playback-pause"],
        ["Stopped", null]
    ])


    public constructor(text: string, playbackStatus: PlaybackStatus) {
        super(text)
        this.playbackStatus = playbackStatus
    }


    public set playbackStatus(playbackStatus: PlaybackStatus) {
        this.iconName = this.playbackIconMap.get(playbackStatus)
    }

}
