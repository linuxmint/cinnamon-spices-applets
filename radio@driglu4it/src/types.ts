export type PlayPause = "Playing" | "Paused"
export type PlaybackStatus = PlayPause | "Stopped"
export type AdvancedPlaybackStatus = PlaybackStatus | 'Loading'

export interface Channel {
    name: string,
    url: string,
    inc: boolean
}

export type IconType = 'SYMBOLIC' | 'FULLCOLOR' | 'BICOLOR'
