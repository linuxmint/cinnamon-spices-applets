import { PlaybackStatus } from "types";

export class PlayPauseMenuItem {

    public name: string
    public playbackStatus: PlaybackStatus

    #clickHandler: Function

    constructor(name: string, playbackStatus: PlaybackStatus) {
        this.name = name
        this.playbackStatus = playbackStatus
    }

    public connect(event: string, cb: Function) {
        this.#clickHandler = cb
    }

    public click() {
        this.#clickHandler()
    }
}